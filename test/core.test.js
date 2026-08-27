import test from "node:test";
import assert from "node:assert/strict";
import { clamp, cleanClaudeReply, limitUnicode, nextDodgeVelocity, controlVelocity, fitPet, gazeDirection, MODES, petShouldShow } from "../src/core.js";

test("clamp keeps values inside bounds", () => {
  assert.equal(clamp(2, 5, 10), 5);
  assert.equal(clamp(12, 5, 10), 10);
  assert.equal(clamp(7, 5, 10), 7);
});

test("all four control directions and diagonals have bounded speed", () => {
  for (const [key, expected] of [["ArrowUp", {x:0,y:-300}], ["ArrowDown", {x:0,y:300}], ["ArrowLeft", {x:-300,y:0}], ["ArrowRight", {x:300,y:0}]]) {
    assert.deepEqual(controlVelocity(new Set([key])), expected);
  }
  assert.equal(Math.round(Math.hypot(...Object.values(controlVelocity(new Set(["ArrowUp", "ArrowRight"]))))), 300);
  assert.deepEqual(controlVelocity(new Set(["ArrowUp", "ArrowDown"])), {x:0,y:0});
});
test("gaze follows vertical and horizontal movement without mirroring the body", () => {
  assert.deepEqual(gazeDirection(0,-12), {x:0,y:-1});
  assert.deepEqual(gazeDirection(-12,0), {x:-1,y:0});
});
test("Dodge stays visible unless manually hidden", () => {
  for (const mode of [MODES.DODGE, MODES.PET, MODES.CONTROL]) {
    assert.equal(petShouldShow({mode,manualHidden:false}),true);
    assert.equal(petShouldShow({mode,manualHidden:true}),false);
  }
  assert.equal(petShouldShow({mode:MODES.PACMAN,manualHidden:false}),false);
});
test("recovery clamps detached/negative displays and tiny work areas", () => {
  assert.deepEqual(fitPet({x:-5000,y:8000},{x:-1920,y:0,width:1920,height:1080}),{x:-1920,y:936});
  assert.deepEqual(fitPet({x:100,y:100},{x:0,y:0,width:100,height:100}),{x:0,y:0});
  assert.equal(fitPet({x:40.3,y:50.7},{x:0,y:0,width:1000,height:800}).x,40.3);
});

test("chat replies are capped by Unicode characters", () => {
  assert.equal(Array.from(limitUnicode("蓝".repeat(55))).length, 50);
  assert.equal(Array.from(new Intl.Segmenter(undefined, { granularity: "grapheme" }).segment(limitUnicode("👁️".repeat(60)))).length, 50);
});

test("English replies end at a natural boundary", () => {
  const reply = limitUnicode("Hi! I am right here on your desktop, keeping you company while you work quietly.");
  assert.ok(reply.endsWith("…"));
  assert.ok(!reply.endsWith("co…"));
  assert.ok(Array.from(reply).length <= 50);
});

test("Claude formatting is removed", () => {
  assert.equal(cleanClaudeReply('```text\n“今天也要悄悄加油呀。”\n```'), "今天也要悄悄加油呀。");
});

test("dodge accelerates away from a nearby cursor", () => {
  const next = nextDodgeVelocity({
    petCenter: { x: 100, y: 100 },
    cursor: { x: 130, y: 100 },
    velocity: { x: 0, y: 0 },
    dt: 0.1,
    bounds: { x: 0, y: 0, width: 1000, height: 800 },
    random: () => 0.5,
  });
  assert.ok(next.x < 0);
});
