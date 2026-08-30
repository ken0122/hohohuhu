import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile, rm, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import sharp from "sharp";
import { createCharacterStore } from "../src/character-store.js";
import { inspectCharacterImage, validateGeneratedSvg, MAX_IMAGE_BYTES } from "../src/character-import.js";

const sample = new URL("../assets/characters/black-cat/", import.meta.url);
async function temporary(t) {
  const directory = await mkdtemp(path.join(tmpdir(), "bluepet-character-store-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  return directory;
}
test("raster boundary rejects oversized, animated, truncated and disguised files before decoding", async () => {
  const png = await readFile(new URL("source.png", sample));
  assert.deepEqual(inspectCharacterImage(png), { width:400,height:300,mime:"image/png" });
  const jpg = await sharp(png).jpeg().toBuffer();
  assert.equal(inspectCharacterImage(jpg).mime, "image/jpeg");
  assert.throws(() => inspectCharacterImage(Buffer.alloc(MAX_IMAGE_BYTES + 1)), /10 MB/);
  assert.throws(() => inspectCharacterImage(Buffer.from('<svg onload="alert(1)">not png</svg>')), /PNG\/JPG/);
  assert.throws(() => inspectCharacterImage(png.subarray(0, 40)), /不完整/);
  const oversized = Buffer.from(png); oversized.writeUInt32BE(20000, 16);
  assert.throws(() => inspectCharacterImage(oversized), /总像素/);
  const animated = Buffer.concat([png.subarray(0,33), Buffer.from([0,0,0,0,97,99,84,76,0,0,0,0]), png.subarray(33)]);
  assert.throws(() => inspectCharacterImage(animated), /动画/);
});
test("generated SVG grammar rejects executable XML, arbitrary attributes and unbounded coordinates", async () => {
  const svg = await readFile(new URL("character.svg", sample), "utf8");
  assert.equal(validateGeneratedSvg(svg), svg);
  for (const bad of [svg.replace('<path ', '<path onload="alert(1)" '), svg.replace('</svg>', '<script/>\n</svg>'), svg.replace('fill="#111111"', 'fill="url(https://evil.test)"'), svg.replace(/d="M[^Q]+Q/, 'd="M999 1Q'), svg.replace(/d="M[^Q]+Q/, 'd="MNaN 1Q'), svg.replace(/d="M[^Q]+Q/, 'd="M1 1 1Q'), svg.replace('<svg ', '<!DOCTYPE svg [<!ENTITY x SYSTEM "file:///etc/passwd">]><svg '), svg.repeat(200)]) {
    assert.throws(() => validateGeneratedSvg(bad));
  }
});
test("local library atomically persists import/selection/removal, rejects bad input and serializes mutations", async t => {
  const dir = await temporary(t), svg = await readFile(new URL("character.svg", sample), "utf8");
  let store = await createCharacterStore(dir);
  assert.equal(store.catalog().selected, "blue-one-eye");
  assert.equal(store.catalog().items.length, 2);
  await store.select("black-cat");
  await assert.rejects(store.select("../../bad"));
  await assert.rejects(store.import({name:"",svg}));
  await assert.rejects(store.import({name:"fake",svg:"<svg/>"}));
  const result = await store.import({name:"我的黑猫",svg});
  const id = result.selected;
  assert.match(id, /^local-/);
  store = await createCharacterStore(dir);
  assert.equal(store.catalog().selected, id);
  assert.equal(store.source().svg, svg);
  assert.ok(!JSON.stringify(store.catalog()).includes('<svg'));
  await Promise.all([store.select("black-cat"), store.select("blue-one-eye")]);
  assert.equal(store.catalog().selected, "blue-one-eye");
  await assert.rejects(store.remove("blue-one-eye"));
  await store.select(id); await store.remove(id);
  assert.equal(store.catalog().selected, "blue-one-eye");
  assert.throws(() => store.source(id));
});
test("corrupt libraries fall back without overwriting; failed writes preserve the active character", async t => {
  const dir = await temporary(t), file = path.join(dir,"characters-v1.json");
  await writeFile(file, "{broken");
  const corrupt = await createCharacterStore(dir);
  assert.equal(corrupt.source().id,"blue-one-eye");
  assert.ok(corrupt.catalog().warning);
  await assert.rejects(corrupt.select("black-cat"));
  assert.equal(await readFile(file,"utf8"),"{broken");
  const other = path.join(dir,"other");
  const store = await createCharacterStore(other);
  await mkdir(path.join(other,"characters-v1.json.tmp"),{recursive:true});
  await assert.rejects(store.select("black-cat"), /保存失败/);
  assert.equal(store.source().id,"blue-one-eye");
});
