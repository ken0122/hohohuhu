function brightness(r, g, b) { return (r + g + b) / 3; }
function colorDistance(a, b) { return Math.max(Math.abs(a[0] - b[0]), Math.abs(a[1] - b[1]), Math.abs(a[2] - b[2])); }
function hex(values) { return "#" + values.map(value => Math.round(value).toString(16).padStart(2, "0")).join(""); }

function components(data, width, height, bounds, accept) {
  const left = Math.max(0, Math.floor(bounds.left)), top = Math.max(0, Math.floor(bounds.top));
  const right = Math.min(width, Math.ceil(bounds.right)), bottom = Math.min(height, Math.ceil(bounds.bottom));
  const regionWidth = right - left, regionHeight = bottom - top;
  const visited = new Uint8Array(regionWidth * regionHeight), queue = new Uint32Array(regionWidth * regionHeight);
  const results = [];
  const local = (x, y) => (y - top) * regionWidth + x - left;
  for (let y = top; y < bottom; y++) for (let x = left; x < right; x++) {
    const start = local(x, y);
    if (visited[start]) continue;
    visited[start] = 1;
    if (!accept(x, y)) continue;
    let head = 0, tail = 0, area = 0, minX = x, minY = y, maxX = x, maxY = y;
    let sumX = 0, sumY = 0, sumR = 0, sumG = 0, sumB = 0;
    queue[tail++] = y * width + x;
    while (head < tail) {
      const index = queue[head++], px = index % width, py = Math.floor(index / width), offset = index * 4;
      area++; sumX += px; sumY += py; sumR += data[offset]; sumG += data[offset + 1]; sumB += data[offset + 2];
      minX = Math.min(minX, px); minY = Math.min(minY, py); maxX = Math.max(maxX, px); maxY = Math.max(maxY, py);
      for (const [nx, ny] of [[px - 1, py], [px + 1, py], [px, py - 1], [px, py + 1]]) {
        if (nx < left || nx >= right || ny < top || ny >= bottom) continue;
        const next = local(nx, ny);
        if (visited[next]) continue;
        visited[next] = 1;
        if (accept(nx, ny)) queue[tail++] = ny * width + nx;
      }
    }
    results.push({ area, minX, minY, maxX, maxY, x: sumX / area, y: sumY / area, color: [sumR / area, sumG / area, sumB / area] });
  }
  return results;
}

function eyeCandidates(data, width, height, box) {
  const [x, y, w, h] = box;
  const bounds = {
    left: (x - w * .3) * width, top: (y - h * .22) * height,
    right: (x + w * 1.3) * width, bottom: (y + h * 1.22) * height,
  };
  const regionArea = Math.max(1, (bounds.right - bounds.left) * (bounds.bottom - bounds.top));
  const light = components(data, width, height, bounds, (px, py) => {
    const i = (py * width + px) * 4, r = data[i], g = data[i + 1], b = data[i + 2];
    return data[i + 3] >= 128 && brightness(r, g, b) >= 190 && Math.max(r, g, b) - Math.min(r, g, b) <= 110;
  }).filter(component => component.area >= Math.max(6, regionArea * .008)
    && (component.maxX - component.minX + 1) * (component.maxY - component.minY + 1) < regionArea * .72);
  const expectedX = (x + w / 2) * width, expectedY = (y + h / 2) * height;
  light.sort((a, b) => {
    const score = component => Math.hypot(component.x - expectedX, component.y - expectedY) - Math.sqrt(component.area) * .35;
    return score(a) - score(b);
  });
  const count = w / h > 1.8 ? 2 : 1;
  return light.slice(0, count).sort((a, b) => a.x - b.x);
}

function pupilFor(data, width, height, eye) {
  const eyeWidth = eye.maxX - eye.minX + 1, eyeHeight = eye.maxY - eye.minY + 1;
  const cx = (eye.minX + eye.maxX) / 2, cy = (eye.minY + eye.maxY) / 2;
  const bounds = { left: eye.minX, top: eye.minY, right: eye.maxX + 1, bottom: eye.maxY + 1 };
  const light = brightness(...eye.color);
  const dark = components(data, width, height, bounds, (x, y) => {
    const dx = (x - cx) / Math.max(1, eyeWidth * .42), dy = (y - cy) / Math.max(1, eyeHeight * .42);
    if (dx * dx + dy * dy > 1) return false;
    const i = (y * width + x) * 4, color = [data[i], data[i + 1], data[i + 2]];
    return data[i + 3] >= 128 && brightness(...color) < light - 30 && colorDistance(color, eye.color) > 35;
  }).filter(component => component.area >= 2 && component.area < eye.area * .45);
  dark.sort((a, b) => {
    const score = component => component.area / (1 + Math.hypot(component.x - cx, component.y - cy));
    return score(b) - score(a);
  });
  const pupil = dark[0];
  if (!pupil) {
    const radius = Math.max(.006, Math.min(.018, Math.min(eyeWidth / width, eyeHeight / height) * .12));
    return {
      x: eye.x / width, y: eye.y / height, radius,
      travelX: Math.max(.008, Math.min(.035, eyeWidth / width / 2 - radius - .006)),
      travelY: Math.max(.008, Math.min(.035, eyeHeight / height / 2 - radius - .006)),
    };
  }
  const pupilWidth = pupil.maxX - pupil.minX + 1, pupilHeight = pupil.maxY - pupil.minY + 1;
  const radius = Math.max(.006, Math.min(.018, Math.min(pupilWidth / width, pupilHeight / height) * .42));
  return {
    x: pupil.x / width, y: pupil.y / height,
    radius,
    travelX: Math.max(.008, Math.min(.035, eyeWidth / width / 2 - radius - .006)),
    travelY: Math.max(.008, Math.min(.035, eyeHeight / height / 2 - radius - .006)),
    mask: {
      rx: Math.max(.009, (pupilWidth / 2 + 2.4) / width),
      ry: Math.max(.009, (pupilHeight / 2 + 2.4) / height),
      fill: hex(eye.color),
    },
  };
}

// Analyze only bounded, decoded pixels supplied by the app's validated SVG.
// The result is ephemeral app-owned geometry, never executable upload data.
export function analyzeImportedEyeRig({ data, width, height, parts }) {
  if (!(data instanceof Uint8Array) || data.length !== width * height * 4 || !Number.isSafeInteger(width) || !Number.isSafeInteger(height)) return null;
  const eyes = (parts || []).filter(part => part.kind === "eye").slice(0, 4);
  const result = [];
  for (const eye of eyes) for (const candidate of eyeCandidates(data, width, height, eye.box)) {
    const found = pupilFor(data, width, height, candidate);
    if (!result.some(existing => Math.hypot(existing.x - found.x, existing.y - found.y) < .025)) result.push(found);
  }
  return result.length ? Object.freeze({ eyes: Object.freeze(result.map(eye => Object.freeze(eye))) }) : null;
}
