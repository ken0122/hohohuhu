import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { analyzeCharacterImage, validateCharacterAnalysis } from "../src/character-analysis.js";

const valid = {
  quality: { decision: "pass", issues: [], explanation: "单个完整角色，背景简洁。" },
  persona: { archetype: "proud", voice: "reserved", identity: "一只黑猫", summary: "警觉而克制。", traits: ["警觉", "克制"] },
  dialogue: {
    headpat: ["只是刚好没躲"], tickle: ["爪子要伸出来了"], poke: ["……你戳我？"],
    cuddle: ["只准抱一会儿"], nuzzle: ["我只是路过"], hop: ["看见了"], shy: ["别一直盯着我"],
  },
  easterEgg: { label: "被发现的在意", description: "连续贴贴三次会露出真心。", triggerIntent: "nuzzle", message: "……被你发现了" },
  parts: [
    { kind: "body", confidence: .98, box: [.15, .08, .7, .86] },
    { kind: "eye", confidence: .92, box: [.28, .32, .12, .1] },
  ],
};

test("vision analysis uses the dedicated model and validates normalized part boxes", async () => {
  const bytes = await readFile(new URL("../assets/characters/black-cat/source.png", import.meta.url));
  const result = await analyzeCharacterImage({ bytes, mime: "image/png" }, {
    provider: async () => ({ url: "https://models.example/v1/messages", key: "test-only", model: "chat-model", visionModel: "vision-model" }),
    request: async (_url, options) => {
      const body = JSON.parse(options.body);
      assert.equal(body.model, "vision-model");
      assert.equal(body.messages[0].content[1].type, "image");
      assert.equal(body.messages[0].content[1].source.media_type, "image/png");
      assert.ok(body.messages[0].content[1].source.data.length > 100);
      return Response.json({ content: [{ type: "text", text: "```json\n" + JSON.stringify(valid) + "\n```" }] });
    },
  });
  assert.equal(result.persona.archetype, "proud");
  assert.equal(result.parts[1].kind, "eye");
  assert.equal(result.dialogue.nuzzle[0], "我只是路过");
  assert.equal(result.easterEgg.triggerIntent, "nuzzle");
});

test("vision suggestions cannot introduce unknown issues, parts or invalid geometry", () => {
  assert.throws(() => validateCharacterAnalysis({ ...valid, quality: { ...valid.quality, issues: ["run-code"] } }), /未知/);
  assert.throws(() => validateCharacterAnalysis({ ...valid, parts: [{ kind: "script", confidence: 1, box: [0,0,1,1] }] }), /部件/);
  assert.throws(() => validateCharacterAnalysis({ ...valid, parts: [{ kind: "body", confidence: 1, box: [.8,.8,.5,.5] }] }), /部件/);
});
