// Convert the original M/C/S/Z body into compatible cubic keyframes without
// adding geometry. Unsupported commands fail rather than silently changing art.
export function cubicOutline(path) {
  const tokens = path.match(/[a-z]|[-+]?(?:\d*\.\d+|\d+)(?:e[-+]?\d+)?/gi);
  const segments = [];
  let i = 0, command, x = 0, y = 0, lastControl;
  while (i < tokens.length) {
    if (/^[a-z]$/i.test(tokens[i])) command = tokens[i++];
    const relative = command === command.toLowerCase(), type = command.toUpperCase();
    if (type === "Z") { segments.push({ command: "Z", points: [] }); continue; }
    const count = { M: 2, C: 6, S: 4 }[type];
    if (!count) throw new Error("Unsupported mascot path command: " + command);
    const values = tokens.slice(i, i + count).map(Number); i += count;
    if (values.length !== count || values.some(v => !Number.isFinite(v))) throw new Error("Invalid mascot path");
    const points = [];
    for (let j = 0; j < count; j += 2) points.push([values[j] + (relative ? x : 0), values[j + 1] + (relative ? y : 0)]);
    if (type === "S") points.unshift(lastControl ? [2*x-lastControl[0],2*y-lastControl[1]] : [x,y]);
    segments.push({ command: type === "M" ? "M" : "C", points });
    [x,y] = points.at(-1);
    lastControl = type === "M" ? undefined : points.at(-2);
  }
  return segments;
}

export function deformOutline(outline, phase, amplitude, profile) {
  return outline.map(segment => segment.command + segment.points.map(([x,y]) => {
    // The head/eye area never changes. A traveling wave flexes only the same
    // continuous lower outline; no new feet, masks, overlays or body panels.
    const weight = Math.max(0, Math.min(1, (y - profile.startY) / profile.depth));
    const dy = Math.sin(phase + (x - profile.originX) / profile.width * Math.PI * 2) * amplitude * weight;
    return x.toFixed(3) + " " + (y + dy).toFixed(3);
  }).join(" ")).join(" ");
}

export function gaitFrames(path, gait, profile) {
  const outline = cubicOutline(path), amplitude = profile[gait + "Amplitude"];
  return [0,1,2,3,4].map(step => ({
    d: 'path("' + deformOutline(outline, step * Math.PI / 2, amplitude, profile) + '")', offset: step / 4,
  }));
}
