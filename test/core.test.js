import test from "node:test";
import assert from "node:assert/strict";
import { clamp, cleanClaudeReply, limitUnicode, nextDodgeVelocity } from "../src/core.js";

test("clamp keeps values inside bounds", () => {
  assert.equal(clamp(2, 5, 10), 5);
  assert.equal(clamp(12, 5, 10), 10);
  assert.equal(clamp(7, 5, 10), 7);
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
