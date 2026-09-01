// Normalize the path into compatible absolute keyframes without adding
// geometry. This covers both the hand-authored mascot and converter output.
export function cubicOutline(path) {
  const tokens = path.match(/[a-z]|[-+]?(?:\d*\.\d+|\d+)(?:e[-+]?\d+)?/gi);
  const segments = [];
  let i = 0, command, x = 0, y = 0, lastControl;
  while (i < tokens.length) {
    if (/^[a-z]$/i.test(tokens[i])) command = tokens[i++];
    const relative = command === command.toLowerCase(), type = command.toUpperCase();
    if (type === "Z") { segments.push({ command: "Z", points: [] }); continue; }
    const count = { M: 2, L: 2, H: 1, V: 1, Q: 4, C: 6, S: 4 }[type];
    if (!count) throw new Error("Unsupported mascot path command: " + command);
    const values = tokens.slice(i, i + count).map(Number); i += count;
    if (values.length !== count || values.some(v => !Number.isFinite(v))) throw new Error("Invalid mascot path");
    const points = type === "H" ? [[values[0] + (relative ? x : 0), y]]
      : type === "V" ? [[x, values[0] + (relative ? y : 0)]] : [];
    for (let j = 0; !["H", "V"].includes(type) && j < count; j += 2) points.push([values[j] + (relative ? x : 0), values[j + 1] + (relative ? y : 0)]);
    if (type === "S") points.unshift(lastControl ? [2*x-lastControl[0],2*y-lastControl[1]] : [x,y]);
    segments.push({ command: type === "S" ? "C" : ["H", "V"].includes(type) ? "L" : type, points });
    [x,y] = points.at(-1);
    lastControl = ["C", "S"].includes(type) ? points.at(-2) : undefined;
  }
  return segments;
}

export function outlineBounds(outline) {
  const points = outline.flatMap(segment => segment.points);
  if (!points.length) throw new Error("Empty mascot path");
  const xs = points.map(point => point[0]), ys = points.map(point => point[1]);
  return {
    minX: Math.min(...xs), maxX: Math.max(...xs),
    minY: Math.min(...ys), maxY: Math.max(...ys),
  };
}

export function bodyBoxGaitProfile(bodyBox, fallbackBounds = { minX: 0, minY: 0, maxX: 64, maxY: 64 }) {
  const bounds = fallbackBounds;
  const body = Array.isArray(bodyBox) && bodyBox.length === 4
    ? { minX: bodyBox[0] * 64, minY: bodyBox[1] * 64, maxX: (bodyBox[0] + bodyBox[2]) * 64, maxY: (bodyBox[1] + bodyBox[3]) * 64 }
    : bounds;
  const width = body.maxX - body.minX, height = body.maxY - body.minY;
  if (width < 8 || height < 8) throw new Error("Mascot body path is too small");
  const startY = body.minY + height * .68;
  return {
    startY, depth: Math.max(1, body.maxY - startY),
    originX: body.minX, width,
    walkAmplitude: Math.max(.55, Math.min(1.2, width * .018)),
    runAmplitude: Math.max(1.3, Math.min(2.6, width * .045)),
  };
}

export function automaticGaitProfile(path, bodyBox) {
  return bodyBoxGaitProfile(bodyBox, outlineBounds(cubicOutline(path)));
}

export function bipedSupport(progress) {
  if (progress <= 0 || progress >= 1) return 0;
  const bell = center => Math.exp(-Math.pow((progress - center) / .14, 2));
  return bell(.28) - bell(.72);
}

export function deformOutline(outline, phase, amplitude, profile) {
  return outline.map(segment => segment.command + segment.points.map(([x,y]) => {
    // The head/eye area never changes. Alternating support flexes only the same
    // continuous lower outline; no new feet, masks, overlays or body panels.
    const weight = Math.max(0, Math.min(1, (y - profile.startY) / profile.depth));
    const progress = Math.max(0, Math.min(1, (x - profile.originX) / profile.width));
    // Pin the sides while alternating the two lower lobes. The result reads as
    // left/right support rather than making the whole silhouette wobble.
    const feet = bipedSupport(progress) * Math.sin(phase);
    const dy = feet * amplitude * weight;
    return x.toFixed(3) + " " + (y + dy).toFixed(3);
  }).join(" ")).join(" ");
}

export function gaitFrames(path, gait, profile) {
  const outline = cubicOutline(path), amplitude = profile[gait + "Amplitude"];
  return [0,1,2,3,4].map(step => ({
    d: 'path("' + deformOutline(outline, step * Math.PI / 2, amplitude, profile) + '")', offset: step / 4,
  }));
}
