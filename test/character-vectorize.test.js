import test from "node:test";
import assert from "node:assert/strict";
import { readFile, mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import sharp from "sharp";
import { mapPartBox, prepareColorRaster, vectorizeMonochrome } from "../src/character-vectorize.js";

const source = new URL("../assets/characters/black-cat/source.png", import.meta.url);
function bitmap(width = 12, height = 12) {
  const data = new Uint8Array(width * height * 4).fill(255);
  const pixel = (x, y, rgba) => data.set(rgba, (y * width + x) * 4);
  for (let y = 2; y < height - 2; y++) for (let x = 2; x < width - 2; x++) pixel(x, y, [17, 17, 17, 255]);
  return { data, width, height, pixel };
}

test("monochrome conversion preserves white interiors and transparent holes separately", async () => {
  const input = bitmap();
  input.pixel(4, 5, [255, 255, 255, 255]);
  input.pixel(7, 5, [255, 0, 0, 0]); // Hidden RGB is neither ink nor a colored detail.
  const result = vectorizeMonochrome(input);
  assert.equal(result.report.lightContours, 1);
  assert.equal(result.report.darkContours, 3);
  assert.doesNotMatch(result.svg, /<image|href=|script|foreignObject|style=/i);
  const { data } = await sharp(Buffer.from(result.svg)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { scale, offsetX, offsetY } = result.report.transform;
  const sample = (x, y) => {
    const px = Math.floor((x + .5) * scale + offsetX), py = Math.floor((y + .5) * scale + offsetY);
    return [...data.subarray((py * 64 + px) * 4, (py * 64 + px) * 4 + 4)];
  };
  assert.deepEqual(sample(4, 5), [255, 255, 255, 255]);
  assert.equal(sample(7, 5)[3], 0);
  assert.equal(data[3], 0, "outer background is transparent");
});

test("the supplied black cat converts reproducibly and preserves its dark silhouette", async () => {
  const { data, info } = await sharp(await readFile(source)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const result = vectorizeMonochrome({ data, width: info.width, height: info.height });
  assert.equal(result.svg, await readFile(new URL("../assets/characters/black-cat/character.svg", import.meta.url), "utf8"));
  assert.equal(result.report.color, "#111111");
  assert.equal(result.report.lightContours, 2);
  const { data: raster } = await sharp(Buffer.from(result.svg)).resize(640, 640).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { scale, offsetX, offsetY } = result.report.transform;
  let intersection = 0, union = 0;
  for (let y = 0; y < 640; y++) for (let x = 0; x < 640; x++) {
    const sx = Math.floor(((x + .5) / 10 - offsetX) / scale), sy = Math.floor(((y + .5) / 10 - offsetY) / scale);
    const inside = sx >= 0 && sy >= 0 && sx < info.width && sy < info.height;
    const i = (sy * info.width + sx) * 4, j = (y * 640 + x) * 4;
    const expected = inside && data[i + 3] >= 128 && (data[i] + data[i + 1] + data[i + 2]) / 3 < 160;
    const actual = raster[j + 3] >= 128 && raster[j] < 160;
    if (expected || actual) union++;
    if (expected && actual) intersection++;
  }
  assert.ok(intersection / union > .97, `dark silhouette IoU: ${intersection / union}`);
  console.log(`Black cat dark silhouette IoU: ${(intersection / union).toFixed(4)}`);
});

test("rejects invalid buffers, oversized images, blank images, color and clipped subjects", () => {
  assert.throws(() => vectorizeMonochrome({ data: new Uint8Array(), width: 1025, height: 1025 }), /RGBA/);
  assert.throws(() => vectorizeMonochrome({ data: new Uint8Array(4), width: 12, height: 12 }), /RGBA/);
  const blank = bitmap(); blank.data.fill(255);
  assert.throws(() => vectorizeMonochrome(blank), /未找到/);
  const color = bitmap();
  for (let x = 3; x < 9; x++) color.pixel(x, 3, [30, 80, 220, 255]);
  assert.throws(() => vectorizeMonochrome(color), /彩色/);
  const clipped = bitmap(); clipped.pixel(0, 4, [0, 0, 0, 255]);
  assert.throws(() => vectorizeMonochrome(clipped), /边缘/);
});

test("color preparation preserves foreground colors and removes only a connected solid background", () => {
  const input = bitmap(20, 20); input.data.fill(255);
  for (let y = 4; y < 17; y++) for (let x = 5; x < 15; x++) input.pixel(x, y, [40, 90, 220, 255]);
  input.pixel(9, 8, [250, 190, 40, 255]);
  const result = prepareColorRaster(input);
  assert.equal(result.backgroundRemoved, true);
  assert.deepEqual(result.bounds, { x: 5, y: 4, width: 10, height: 13 });
  assert.equal(result.data[(8 * 20 + 9) * 4], 250);
  assert.equal(result.data[3], 0);
  const noisy = bitmap(20, 20); noisy.data.fill(255); noisy.pixel(19, 19, [20, 50, 90, 255]);
  assert.throws(() => prepareColorRaster(noisy), /四角颜色一致/);
});
test("model part boxes map from source pixels into the normalized 64 unit artwork", () => {
  assert.deepEqual(mapPartBox([.25,.2,.5,.6], 200, 100, { scale:.28, offsetX:4, offsetY:18 }), [.2813,.3688,.4375,.2625]);
  assert.deepEqual(mapPartBox([0,0,1,1], 100, 100, { scale:1, offsetX:-20, offsetY:-20 }), [0,0,1,1]);
});

test("bounds contour complexity rather than producing a huge SVG", () => {
  const input = bitmap(160, 160); input.data.fill(255);
  for (let y = 2; y < 158; y += 2) for (let x = 2; x < 158; x += 2) input.pixel(x, y, [0, 0, 0, 255]);
  assert.throws(() => vectorizeMonochrome(input), /复杂|细碎/);
});

test("developer CLI decodes PNG/JPG, rejects SVG input and never overwrites an output", async t => {
  const dir = await mkdtemp(path.join(tmpdir(), "bluepet-conversion-test-"));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const cli = new URL("../scripts/convert-character.mjs", import.meta.url);
  const run = (input, output) => spawnSync(process.execPath, [cli.pathname, input, output], { encoding: "utf8" });
  const png = path.join(dir, "sample.png"), jpg = path.join(dir, "sample.jpg"), pngOutput = path.join(dir, "png");
  await writeFile(png, await readFile(source));
  await sharp(await readFile(source)).jpeg({ quality: 95 }).toFile(jpg);
  assert.equal(run(png, pngOutput).status, 0);
  assert.equal(run(jpg, path.join(dir, "jpg")).status, 0);
  const prior = await readFile(path.join(pngOutput, "character.svg"));
  const again = run(jpg, pngOutput);
  assert.equal(again.status, 1); assert.match(again.stderr, /已存在/);
  assert.deepEqual(await readFile(path.join(pngOutput, "character.svg")), prior);
  const invalid = path.join(dir, "fake.png");
  await writeFile(invalid, '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"/>');
  assert.equal(run(invalid, path.join(dir, "rejected")).status, 1);
});
