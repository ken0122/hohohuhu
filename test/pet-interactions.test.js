import test from "node:test";
import assert from "node:assert/strict";
import { clickReaction, createStrokeGesture, REACTIONS } from "../src/renderer/pet-interactions.js";

test("head, belly, cheek and face clicks have different bounded feedback", () => {
  assert.equal(clickReaction(.5,.2),"shy");
  assert.equal(clickReaction(.5,.75),"poke");
  assert.equal(clickReaction(.2,.5),"nuzzle");
  assert.equal(clickReaction(.5,.5),"hop");
  assert.ok(Object.values(REACTIONS).every(r=>r.duration<=1200&&r.messages.length>1));
});
test("head strokes and repeated belly wiggles are distinct at any sprite size", () => {
  const gesture = createStrokeGesture();
  gesture.move(.2,.25,0);
  assert.equal(gesture.move(.8,.25,60),"headpat");
  gesture.reset();
  assert.equal(gesture.move(.3,.75,100),undefined);
  assert.equal(gesture.move(.7,.75,160),undefined);
  assert.equal(gesture.move(.3,.75,220),undefined);
  assert.equal(gesture.move(.7,.75,280),"tickle");
});
test("slow stale movement, zone changes and leaving do not accidentally tickle", () => {
  const gesture = createStrokeGesture();
  gesture.move(.3,.75,0); gesture.move(.7,.75,60);
  assert.equal(gesture.move(.3,.75,900),undefined);
  assert.equal(gesture.move(.7,.5,960),undefined);
  gesture.reset();
  assert.equal(gesture.move(.3,.75,1000),undefined);
});
