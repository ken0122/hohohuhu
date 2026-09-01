import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { automaticGaitProfile, cubicOutline, deformOutline, gaitFrames, outlineBounds } from "../src/renderer/shape-motion.js";
import { BLUE_ONE_EYE } from "../src/characters.js";
const svg = readFileSync(new URL("../assets/blue-one-eye-mascot.svg",import.meta.url),"utf8");
const path = svg.match(/class="body" d="([^"]+)"/)[1];
const sunnySvg = readFileSync(new URL("../assets/characters/sunny-yellow/character.svg",import.meta.url),"utf8");
const sunnyBody = Array.from(sunnySvg.matchAll(/<path d="([^"]+)"/g), match => match[1])[2];

test("sunny filled silhouette has no outer stroke", () => {
  const filledPaths = Array.from(sunnySvg.matchAll(/<path\b[^>]*\bfill="(?!none)[^"]+"[^>]*>/g), match => match[0]);
  assert.equal(filledPaths.length, 2);
  assert.ok(filledPaths.every(element => !/\bstroke=/.test(element)));
});

test("shape animation keeps the original topology, head and bounds", () => {
  const original = cubicOutline(path);
  assert.equal(original[0].command,"M");
  assert.equal(original.at(-1).command,"Z");
  for(const phase of [0,Math.PI/2,Math.PI,Math.PI*1.5]) {
    const changed=cubicOutline(deformOutline(original,phase,2.1,BLUE_ONE_EYE.gait));
    assert.equal(changed.length,original.length);
    original.forEach((segment,i)=>segment.points.forEach(([x,y],j)=>{
      assert.equal(changed[i].points[j][0],Number(x.toFixed(3)));
      if(y<=42) assert.equal(changed[i].points[j][1],Number(y.toFixed(3)));
      assert.ok(Math.abs(changed[i].points[j][1]-y)<=2.101);
    }));
  }
});
test("walking and running morph the same closed body; cycles join seamlessly", () => {
  for(const gait of ["walk","run"]) {
    const frames=gaitFrames(path,gait,BLUE_ONE_EYE.gait);
    assert.equal(frames[0].d,frames.at(-1).d);
    assert.notEqual(frames[0].d,frames[1].d);
    assert.ok(frames.every(frame=>frame.d.endsWith('Z")')));
  }
});

test("converted quadratic outlines get an automatic lower-body biped wave", () => {
  const converted = "M8 8Q32 2 56 8L56 56Q44 61 32 56Q20 61 8 56Z";
  const outline = cubicOutline(converted), bounds = outlineBounds(outline);
  const profile = automaticGaitProfile(converted);
  assert.deepEqual(bounds, { minX: 8, maxX: 56, minY: 2, maxY: 61 });
  assert.ok(profile.startY > 40);
  const frames = gaitFrames(converted, "run", { ...profile, runDuration: 220 });
  assert.equal(frames[0].d, frames.at(-1).d);
  assert.match(frames[1].d, /Q/);
  const changed = cubicOutline(deformOutline(outline, Math.PI / 2, profile.runAmplitude, profile));
  outline.forEach((segment, i) => segment.points.forEach(([x, y], j) => {
    if (y <= profile.startY || x === bounds.minX || x === bounds.maxX) {
      assert.equal(changed[i].points[j][1], Number(y.toFixed(3)));
    }
  }));
});

test("horizontal and vertical SVG commands normalize into animated sunny body lines", () => {
  const outline = cubicOutline(sunnyBody);
  assert.equal(outline.some(segment => ["H", "V"].includes(segment.command)), false);
  const frames = gaitFrames(sunnyBody, "walk", automaticGaitProfile(sunnyBody, [.23,.24,.54,.68]));
  assert.equal(frames[0].d, frames.at(-1).d);
  assert.notEqual(frames[0].d, frames[1].d);
  assert.ok(frames.every(frame => !/[HV]/.test(frame.d)));
});
