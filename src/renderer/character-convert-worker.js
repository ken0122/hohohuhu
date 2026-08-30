import { inspectCharacterImage, MAX_IMAGE_PIXELS } from "../character-import.js";
import { vectorizeMonochrome } from "../character-vectorize.js";

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
    const result = vectorizeMonochrome({ width: bitmap.width, height: bitmap.height, data: new Uint8Array(pixels.data.buffer) });
    self.postMessage({ ok: true, svg: result.svg });
  } catch (error) {
    self.postMessage({ ok: false, error: error instanceof DOMException ? "图片无法解码，请重新导出为静态 PNG/JPG。" : error.message });
  } finally { bitmap?.close(); }
};
