import test from "node:test";
import assert from "node:assert/strict";
import {
  BLACK_CAT_PROFILE,
  BLUE_ONE_EYE_PROFILE,
  SUNNY_YELLOW_PROFILE,
  profileFromAnalysis,
  validateCharacterProfile,
} from "../src/character-profile.js";
import { BLUE_ONE_EYE, BLACK_CAT, SUNNY_YELLOW } from "../src/characters.js";
import { createInteractionPolicy } from "../src/renderer/pet-interactions.js";

test("built-in profiles carry distinct bounded voices, reactions and declarative eggs", () => {
  assert.equal(BLUE_ONE_EYE.profile, BLUE_ONE_EYE_PROFILE);
  assert.equal(BLACK_CAT.profile, BLACK_CAT_PROFILE);
  assert.equal(SUNNY_YELLOW.profile, SUNNY_YELLOW_PROFILE);
  assert.notEqual(BLUE_ONE_EYE_PROFILE.reactions.headpat.messages[0], BLACK_CAT_PROFILE.reactions.headpat.messages[0]);
  for (const profile of [BLUE_ONE_EYE_PROFILE, BLACK_CAT_PROFILE, SUNNY_YELLOW_PROFILE]) {
    assert.ok(profile.persona.traits.length <= 4);
    assert.ok(Object.values(profile.reactions).every(value => value.duration <= 2400 && value.messages.every(line => line.length <= 50)));
    assert.ok(profile.easterEgg.trigger.count >= 2);
  }
});

test("profile validation rejects executable motion and unbounded model suggestions", () => {
  const clone = () => structuredClone(BLUE_ONE_EYE_PROFILE);
  const script = clone(); script.reactions.headpat.motion = "javascript:alert(1)";
  assert.throws(() => validateCharacterProfile(script), /不支持的动作/);
  const longLine = clone(); longLine.reactions.headpat.messages = ["长".repeat(51)];
  assert.throws(() => validateCharacterProfile(longLine), /1–50/);
  const trigger = clone(); trigger.easterEgg.trigger.count = 100;
  assert.throws(() => validateCharacterProfile(trigger), /触发条件/);
});

test("interaction policy keeps histories per character and resolves each exclusive egg", () => {
  let time = 0, definition = BLUE_ONE_EYE;
  const policy = createInteractionPolicy(() => definition, { now: () => time });
  assert.equal(policy.reaction("headpat").message, "摸摸头，好舒服");
  time += 1900; assert.equal(policy.reaction("headpat").message, "嗯…可以再摸一下");
  time += 1900;
  const blueEgg = policy.reaction("headpat");
  assert.equal(blueEgg.kind, "blue-secret");
  assert.equal(blueEgg.easterEgg, "secret-double-blink");

  definition = BLACK_CAT; time += 100;
  assert.equal(policy.reaction("nuzzle").message, "我只是路过");
  time += 1900; policy.reaction("nuzzle");
  time += 1900;
  const catEgg = policy.reaction("nuzzle");
  assert.equal(catEgg.kind, "cat-secret");
  assert.equal(catEgg.message, "……被你发现了");

  definition = SUNNY_YELLOW; time += 100;
  assert.equal(policy.reaction("poke").message, "叮！收到一个小戳");
  time += 1900; policy.reaction("poke");
  time += 1900;
  const sunnyEgg = policy.reaction("poke");
  assert.equal(sunnyEgg.kind, "sunny-secret");
  assert.equal(sunnyEgg.easterEgg, "triple-spark");
  assert.equal(sunnyEgg.message, "叮叮叮，今天也亮起来！");
});

test("reviewed analysis becomes bounded dialogue and a declarative custom egg", () => {
  const dialogue = Object.fromEntries(Object.keys(BLUE_ONE_EYE_PROFILE.reactions).map(intent => [intent, [`${intent} 的专属回应`]]));
  const profile = profileFromAnalysis({
    persona: {
      archetype: "cheerful", voice: "bright", identity: "彩色桌面伙伴",
      summary: "开朗又爱回应。", traits: ["开朗", "亲近"],
    },
    dialogue,
    easterEgg: {
      label: "尾巴暗号", description: "连续贴贴三次会亮出暗号。",
      triggerIntent: "nuzzle", message: "暗号对上啦",
    },
  });
  assert.deepEqual(profile.reactions.nuzzle.messages, ["nuzzle 的专属回应"]);
  assert.equal(profile.easterEgg.label, "尾巴暗号");
  assert.deepEqual(profile.easterEgg.trigger, { intent: "nuzzle", count: 3, windowMs: 8000 });
  assert.equal(profile.easterEgg.reaction.messages[0], "暗号对上啦");
});
