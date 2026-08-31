import { analyzeImportedEyeRig } from "../imported-eye-rig.js";

function base64(bytes) {
  let result = "";
  for (let offset = 0; offset < bytes.length; offset += 0x8000) {
    result += String.fromCharCode(...bytes.subarray(offset, Math.min(bytes.length, offset + 0x8000)));
  }
  return btoa(result);
}

export async function deriveImportedEyeRig(svg, parts) {
  if (!(parts || []).some(part => part.kind === "eye")) return null;
  const embedded = /<image href="(data:image\/png;base64,[A-Za-z0-9+/=]+)"/.exec(svg)?.[1];
  const source = embedded || `data:image/svg+xml;base64,${base64(new TextEncoder().encode(svg))}`;
  const image = new Image(); image.src = source;
  try { await image.decode(); } catch { return null; }
  const size = 256, canvas = new OffscreenCanvas(size, size), context = canvas.getContext("2d", { willReadFrequently: true });
  context.drawImage(image, 0, 0, size, size);
  const pixels = context.getImageData(0, 0, size, size);
  return analyzeImportedEyeRig({ data: new Uint8Array(pixels.data.buffer), width: size, height: size, parts });
}
