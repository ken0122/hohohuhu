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
test("recognized parts override generic zones and can be supplied to gesture tracking", () => {
  const parts = [
    { kind: "body", confidence: 1, box: [.2,.15,.6,.75] },
    { kind: "head", confidence: .9, box: [.3,.58,.4,.2] },
    { kind: "tail", confidence: .9, box: [.82,.45,.16,.2] },
  ];
  assert.equal(clickReaction(.5,.66,parts), "shy", "a low recognized head is not treated as belly");
  assert.equal(clickReaction(.9,.55,parts), "nuzzle", "recognized tail uses a gentle side response");
  const gesture = createStrokeGesture({ getParts: () => parts });
  gesture.move(.31,.65,0);
  assert.equal(gesture.move(.69,.65,60), undefined);
  assert.equal(gesture.move(.31,.65,120), "headpat");
});
