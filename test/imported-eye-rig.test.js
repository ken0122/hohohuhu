import test from "node:test";
import assert from "node:assert/strict";
import { analyzeImportedEyeRig } from "../src/imported-eye-rig.js";

function syntheticEyes() {
  const width = 128, height = 128, data = new Uint8Array(width * height * 4);
  function ellipse(cx, cy, rx, ry, color) {
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
      if (((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 > 1) continue;
      const i = (y * width + x) * 4; data.set([...color, 255], i);
    }
  }
  ellipse(44, 45, 11, 17, [250, 250, 248]); ellipse(84, 45, 11, 17, [250, 250, 248]);
  ellipse(49, 47, 3, 4, [15, 20, 28]); ellipse(80, 43, 3, 4, [15, 20, 28]);
  return { data, width, height };
}

test("pixel eye analysis finds original pupils, sclera colors and bounded masks", () => {
  const result = analyzeImportedEyeRig({
    ...syntheticEyes(),
    parts: [{ kind: "eye", confidence: 1, box: [.2, .2, .6, .3] }],
  });
  assert.equal(result.eyes.length, 2);
  assert.ok(Math.abs(result.eyes[0].x - 49 / 128) < .01);
  assert.ok(Math.abs(result.eyes[1].x - 80 / 128) < .01);
  assert.ok(result.eyes.every(eye => eye.mask.fill === "#fafaf8"));
  assert.ok(result.eyes.every(eye => eye.mask.rx < .05 && eye.mask.ry < .055));
  assert.ok(result.eyes.every(eye => eye.travelY * 64 > 1.15), "large sclera keeps visible upward travel after replacing fixed pupils");
});

test("eye analysis fails closed when no reliable sclera is visible", () => {
  const width = 64, height = 64, data = new Uint8Array(width * height * 4);
  assert.equal(analyzeImportedEyeRig({ data, width, height, parts: [{ kind: "eye", box: [.2, .2, .3, .3] }] }), null);
});
