import { inspectCharacterImage, MAX_IMAGE_PIXELS } from "../character-import.js";
import { prepareColorRaster, vectorizeMonochrome } from "../character-vectorize.js";

function base64(bytes) {
  let result = "";
  for (let offset = 0; offset < bytes.length; offset += 0x8000) {
    result += String.fromCharCode(...bytes.subarray(offset, Math.min(bytes.length, offset + 0x8000)));
  }
  return btoa(result);
}

async function colorSvg(pixels, width, height) {
  const prepared = prepareColorRaster({ data: new Uint8Array(pixels.data.buffer), width, height });
  const source = new OffscreenCanvas(width, height), sourceContext = source.getContext("2d");
  sourceContext.putImageData(new ImageData(new Uint8ClampedArray(prepared.data.buffer), width, height), 0, 0);
  const canvas = new OffscreenCanvas(256, 256), context = canvas.getContext("2d");
  const scale = 224 / Math.max(prepared.bounds.width, prepared.bounds.height);
  const targetWidth = prepared.bounds.width * scale, targetHeight = prepared.bounds.height * scale;
  const targetX = (256 - targetWidth) / 2, targetY = 240 - targetHeight;
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  context.drawImage(source, prepared.bounds.x, prepared.bounds.y, prepared.bounds.width, prepared.bounds.height,
    targetX, targetY, targetWidth, targetHeight);
  const blob = await canvas.convertToBlob({ type: "image/png" });
  if (blob.size > 500000) throw new Error("规范化后的彩色角色仍然过大，请简化纹理或降低尺寸。");
  const encoded = base64(new Uint8Array(await blob.arrayBuffer()));
  return {
    svg: `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">\n`
      + `  <image href="data:image/png;base64,${encoded}" x="0" y="0" width="64" height="64" preserveAspectRatio="xMidYMid meet"/>\n`
      + `</svg>\n`,
    transform: { scale: scale / 4, offsetX: targetX / 4 - prepared.bounds.x * scale / 4, offsetY: targetY / 4 - prepared.bounds.y * scale / 4 },
  };
}

// Decoding and contour work live outside both the main process and UI thread.
self.onmessage = async ({ data }) => {
  let bitmap;
  try {
    const info = inspectCharacterImage(data);
    bitmap = await createImageBitmap(new Blob([data], { type: info.mime }));
    if (bitmap.width * bitmap.height > MAX_IMAGE_PIXELS || bitmap.width * bitmap.height !== info.width * info.height)
      throw new Error("解码后的图片尺寸无效，请重新导出图片。");
    const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
    const context = canvas.getContext("2d", { willReadFrequently: true });
    context.drawImage(bitmap, 0, 0);
    const pixels = context.getImageData(0, 0, bitmap.width, bitmap.height);
    let result;
    try {
      const vector = vectorizeMonochrome({ width: bitmap.width, height: bitmap.height, data: new Uint8Array(pixels.data.buffer) });
      result = { svg: vector.svg, transform: vector.report.transform };
    }
    catch (error) {
      // A bright-colored subject can contain no pixels below the monochrome
      // threshold at all. It still belongs on the color path; a blank image is
      // rejected later when the simple background leaves no foreground.
      if (!/只支持单色形象|未找到深色角色/.test(error.message)) throw error;
      result = await colorSvg(pixels, bitmap.width, bitmap.height);
    }
    self.postMessage({ ok: true, ...result });
  } catch (error) {
    self.postMessage({ ok: false, error: error instanceof DOMException ? "图片无法解码，请重新导出为静态 PNG/JPG。" : error.message });
  } finally { bitmap?.close(); }
};
