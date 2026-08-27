import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { cubicOutline, deformOutline, gaitFrames } from "../src/renderer/shape-motion.js";
const svg = readFileSync(new URL("../assets/blue-one-eye-mascot.svg",import.meta.url),"utf8");
const path = svg.match(/class="body" d="([^"]+)"/)[1];

test("shape animation keeps the original topology, head and bounds", () => {
  const original = cubicOutline(path);
  assert.equal(original[0].command,"M");
  assert.equal(original.at(-1).command,"Z");
  for(const phase of [0,Math.PI/2,Math.PI,Math.PI*1.5]) {
    const changed=cubicOutline(deformOutline(original,phase,2.1));
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
    const frames=gaitFrames(path,gait);
    assert.equal(frames[0].d,frames.at(-1).d);
    assert.notEqual(frames[0].d,frames[1].d);
    assert.ok(frames.every(frame=>frame.d.endsWith('Z")')));
  }
});
