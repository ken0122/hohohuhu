import test from "node:test";
import assert from "node:assert/strict";
import { transitionState } from "../src/app-state.js";
import { editingAction } from "../src/core.js";
import {
  clamp,
  cleanClaudeReply,
  limitUnicode,
  nextDodgeVelocity,
  controlVelocity,
  fitPet,
  gazeDirection,
  MODES,
  petShouldShow,
  normalizeMode,
  nextMode,
} from "../src/core.js";

test("clamp keeps values inside bounds", () => {
  assert.equal(clamp(2, 5, 10), 5);
  assert.equal(clamp(12, 5, 10), 10);
  assert.equal(clamp(7, 5, 10), 7);
});

test("native editing commands share one mapping and ignore ordinary typing", () => {
  const input = { type: "keyDown", key: "A", meta: true };
  for (const [key, action] of Object.entries({
    A: "selectAll",
    c: "copy",
    v: "paste",
    x: "cut",
    z: "undo",
  })) {
    assert.equal(editingAction({ ...input, key }, "darwin"), action);
  }
  assert.equal(editingAction({ ...input, key: "z", shift: true }, "darwin"), "redo");
  for (const changed of [{ meta: false }, { type: "keyUp" }, { alt: true }, { key: "ArrowLeft" }]) {
    assert.equal(editingAction({ ...input, ...changed }, "darwin"), undefined);
  }
  assert.equal(editingAction({ ...input, meta: false, control: true }, "win32"), "selectAll");
});

test("state transitions preserve manual hiding and restrict control to visible Pet", () => {
  for (const mode of Object.values(MODES)) {
    const original = { mode, chatOpen: false, manualHidden: false, controlActive: false };
    const hidden = transitionState(original, { type: "hide" });
    const blurred = transitionState(transitionState(hidden, { type: "focus" }), {
      type: "release-control",
    });
    assert.equal(blurred.manualHidden, true);
    assert.equal(blurred.controlActive, false);
    assert.equal(original.manualHidden, false, "transitions do not mutate their input");
    const chat = transitionState(hidden, { type: "chat" });
    assert.equal(chat.manualHidden, false);
    assert.equal(chat.mode, mode === MODES.PACMAN ? MODES.PET : mode);
    assert.equal(transitionState(chat, { type: "focus" }).controlActive, false);
    const dismissed = transitionState(chat, { type: "dismiss-chat" });
    assert.equal(
      transitionState(dismissed, { type: "focus" }).controlActive,
      dismissed.mode === MODES.PET,
    );
    const chosen = transitionState(hidden, { type: "mode", mode: "control" });
    assert.deepEqual(chosen, {
      mode: MODES.PET,
      chatOpen: false,
      manualHidden: false,
      controlActive: false,
    });
    assert.equal(transitionState(hidden, { type: "mode", mode: "unknown" }), hidden);
  }
});

test("all four control directions and diagonals have bounded speed", () => {
  for (const [key, expected] of [
    ["ArrowUp", { x: 0, y: -300 }],
    ["ArrowDown", { x: 0, y: 300 }],
    ["ArrowLeft", { x: -300, y: 0 }],
    ["ArrowRight", { x: 300, y: 0 }],
  ]) {
    assert.deepEqual(controlVelocity(new Set([key])), expected);
  }
  assert.equal(
    Math.round(Math.hypot(...Object.values(controlVelocity(new Set(["ArrowUp", "ArrowRight"]))))),
    300,
  );
  assert.deepEqual(controlVelocity(new Set(["ArrowUp", "ArrowDown"])), { x: 0, y: 0 });
});
test("gaze follows vertical and horizontal movement without mirroring the body", () => {
  assert.deepEqual(gazeDirection(0, -12), { x: 0, y: -1 });
  assert.deepEqual(gazeDirection(-12, 0), { x: -1, y: 0 });
});
test("Dodge stays visible unless manually hidden", () => {
  for (const mode of [MODES.DODGE, MODES.PET]) {
    assert.equal(petShouldShow({ mode, manualHidden: false }), true);
    assert.equal(petShouldShow({ mode, manualHidden: true }), false);
  }
  assert.equal(petShouldShow({ mode: MODES.PACMAN, manualHidden: false }), false);
});
test("recovery clamps detached/negative displays and tiny work areas", () => {
  assert.deepEqual(fitPet({ x: -5000, y: 8000 }, { x: -1920, y: 0, width: 1920, height: 1080 }), {
    x: -1920,
    y: 948,
  });
  assert.deepEqual(fitPet({ x: 100, y: 100 }, { x: 0, y: 0, width: 100, height: 100 }), {
    x: 0,
    y: 0,
  });
  assert.equal(fitPet({ x: 40.3, y: 50.7 }, { x: 0, y: 0, width: 1000, height: 800 }).x, 40.3);
});
test("there are three modes and legacy control resolves to Pet", () => {
  assert.deepEqual(Object.values(MODES), ["dodge", "pet", "pacman"]);
  assert.equal(normalizeMode("control"), "pet");
});
test("the mode shortcut cycles Dodge, Pet and Pac-Man in order", () => {
  assert.equal(nextMode("dodge"), "pet");
  assert.equal(nextMode("pet"), "pacman");
  assert.equal(nextMode("pacman"), "dodge");
  assert.equal(nextMode("control"), "pacman");
});

test("chat replies are capped by Unicode characters", () => {
  assert.equal(Array.from(limitUnicode("蓝".repeat(55))).length, 50);
  assert.equal(
    Array.from(
      new Intl.Segmenter(undefined, { granularity: "grapheme" }).segment(
        limitUnicode("👁️".repeat(60)),
      ),
    ).length,
    50,
  );
});

test("English replies end at a natural boundary", () => {
  const reply = limitUnicode(
    "Hi! I am right here on your desktop, keeping you company while you work quietly.",
  );
  assert.ok(reply.endsWith("…"));
  assert.ok(!reply.endsWith("co…"));
  assert.ok(Array.from(reply).length <= 50);
});

test("Claude formatting is removed", () => {
  assert.equal(cleanClaudeReply("```text\n“今天也要悄悄加油呀。”\n```"), "今天也要悄悄加油呀。");
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

test("chat frame clamps the whole surface on offset displays and hit-tests only speech", async () => {
  const { chatFrame, chatMotionBounds, CHAT_OFFSET, cursorInSpeech } = await import(
    "../src/core.js"
  );
  const bounds = { x: -1600, y: -300, width: 1600, height: 900 };
  const frame = chatFrame({ x: -10, y: -290 }, bounds);
  assert.deepEqual(frame, { x: -272, y: -300, width: 272, height: 242 });
  assert.equal(cursorInSpeech({ x: frame.x + 30, y: frame.y + 140 }, frame), true);
  assert.equal(cursorInSpeech({ x: frame.x + 136, y: frame.y + 193 }, frame), false);
  for (const point of [
    { x: -1700, y: -400 },
    { x: 100, y: 800 },
    { x: -800, y: 200 },
  ]) {
    const clamped = fitPet(point, chatMotionBounds(bounds));
    const native = chatFrame(clamped, bounds);
    assert.equal(native.x + CHAT_OFFSET.x, clamped.x);
    assert.equal(native.y + CHAT_OFFSET.y, clamped.y);
  }
});
