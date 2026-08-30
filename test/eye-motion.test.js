import test from "node:test";
import assert from "node:assert/strict";
import { eyeFrames, blinkDelay, idleDelay } from "../src/renderer/eye-motion.js";
import { BLUE_ONE_EYE } from "../src/characters.js";
const OPEN_EYE = "translateY(-20px)";

test("blinks and emotions always finish fully open, with no closed-eye hold", () => {
  for (const kind of ["blink", "headpat", "nuzzle", "shy"]) {
    const frames = eyeFrames(kind, BLUE_ONE_EYE.eyes);
    assert.equal(frames[0].transform, OPEN_EYE);
    assert.equal(frames.at(-1).transform, OPEN_EYE);
    assert.equal(frames.length, 3);
    assert.equal(frames[1].offset, .36);
    assert.notEqual(frames[1].transform, OPEN_EYE);
  }
});
test("autonomous motions have long quiet gaps and variable timing", () => {
  assert.equal(blinkDelay(() => 0), 3800);
  assert.equal(blinkDelay(() => 1), 7200);
  assert.equal(idleDelay(() => 0), 12000);
  assert.equal(idleDelay(() => 1), 22000);
});
