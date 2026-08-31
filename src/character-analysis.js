import { CHARACTER_VISION_MODEL, loadChatProvider } from "./chat-provider.js";
import { inspectCharacterImage } from "./character-import.js";
import { CHARACTER_INTENTS, profileFromPersona } from "./character-profile.js";

const DECISIONS = new Set(["pass", "warn", "reject"]);
const ISSUES = new Set([
  "multiple-subjects", "cropped", "busy-background", "low-resolution",
  "occluded", "not-character", "unclear-parts", "side-view",
]);
const PARTS = new Set(["body", "head", "eye", "mouth", "ear", "arm", "leg", "tail", "accessory"]);
const ARCHETYPES = new Set(["shy", "proud", "cheerful", "calm", "curious", "mischievous"]);
const VOICES = new Set(["soft", "reserved", "bright", "steady", "curious", "playful"]);

function text(value, label, maximum) {
  if (typeof value !== "string" || !value.trim() || value.length > maximum || /[\x00-\x1f\x7f]/.test(value)) {
    throw new Error(`${label}格式无效。`);
  }
  return value.trim();
}
function unit(value) { return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 1; }
function cleanPart(value, index) {
  if (!value || !PARTS.has(value.kind) || !unit(value.confidence) || !Array.isArray(value.box) || value.box.length !== 4
    || !value.box.every(unit) || value.box[2] <= 0 || value.box[3] <= 0
    || value.box[0] + value.box[2] > 1.001 || value.box[1] + value.box[3] > 1.001) {
    throw new Error(`第 ${index + 1} 个部件格式无效。`);
  }
  return Object.freeze({ kind: value.kind, confidence: value.confidence, box: Object.freeze(value.box.slice()) });
}

// Model output is an untrusted suggestion. Normalize it before renderer, store
// or animation code can consume any field.
export function validateCharacterAnalysis(value) {
  if (!value || typeof value !== "object" || Array.isArray(value) || !DECISIONS.has(value.quality?.decision)) {
    throw new Error("模型没有返回有效的角色分析。");
  }
  const issues = value.quality.issues;
  if (!Array.isArray(issues) || issues.length > 8 || issues.some(issue => !ISSUES.has(issue))) {
    throw new Error("模型返回了未知的图片问题。");
  }
  const persona = value.persona;
  if (!persona || !ARCHETYPES.has(persona.archetype) || !VOICES.has(persona.voice)
    || !Array.isArray(persona.traits) || persona.traits.length < 1 || persona.traits.length > 4) {
    throw new Error("模型没有返回有效的角色气质。");
  }
  if (!Array.isArray(value.parts) || value.parts.length < 1 || value.parts.length > 24) {
    throw new Error("模型没有返回有效的部件列表。");
  }
  const fallback = profileFromPersona(persona), dialogue = {};
  for (const intent of CHARACTER_INTENTS) {
    const messages = value.dialogue?.[intent] || fallback.reactions[intent].messages;
    if (!Array.isArray(messages) || messages.length < 1 || messages.length > 4) throw new Error(`模型没有返回有效的 ${intent} 互动语言。`);
    dialogue[intent] = Object.freeze(messages.map((message, index) => text(message, `${intent} 互动语言 ${index + 1}`, 50)));
  }
  const suggestedEgg = value.easterEgg || {
    label: fallback.easterEgg.label,
    description: fallback.easterEgg.description,
    triggerIntent: fallback.easterEgg.trigger.intent,
    message: fallback.easterEgg.reaction.messages[0],
  };
  if (!CHARACTER_INTENTS.includes(suggestedEgg.triggerIntent)) throw new Error("模型返回的彩蛋触发动作无效。");
  return Object.freeze({
    version: 1,
    quality: Object.freeze({
      decision: value.quality.decision,
      issues: Object.freeze([...new Set(issues)]),
      explanation: text(value.quality.explanation, "图片质量说明", 120),
    }),
    persona: Object.freeze({
      archetype: persona.archetype,
      voice: persona.voice,
      identity: text(persona.identity, "角色身份", 40),
      summary: text(persona.summary, "角色气质", 80),
      traits: Object.freeze(persona.traits.map((trait, index) => text(trait, `性格特点 ${index + 1}`, 12))),
    }),
    dialogue: Object.freeze(dialogue),
    easterEgg: Object.freeze({
      label: text(suggestedEgg.label, "彩蛋名称", 24),
      description: text(suggestedEgg.description, "彩蛋说明", 80),
      triggerIntent: suggestedEgg.triggerIntent,
      message: text(suggestedEgg.message, "彩蛋短句", 50),
    }),
    parts: Object.freeze(value.parts.map(cleanPart)),
  });
}

function jsonFromReply(reply) {
  const plain = String(reply).trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  const start = plain.indexOf("{"), end = plain.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("模型没有返回可读取的角色分析。");
  try { return JSON.parse(plain.slice(start, end + 1)); }
  catch { throw new Error("模型返回的角色分析不是有效 JSON，请重试。"); }
}

const ANALYSIS_PROMPT = `分析这张桌面宠物角色图片。只返回一个 JSON 对象，不要 Markdown 或额外说明。
图片要求：只有一个完整角色，不能裁切；透明或纯色简洁背景；正面或轻微侧面；眼睛、头、身体和附肢边界清楚。
quality.decision 只能是 pass、warn、reject。quality.issues 只能使用 multiple-subjects、cropped、busy-background、low-resolution、occluded、not-character、unclear-parts、side-view。
persona.archetype 只能是 shy、proud、cheerful、calm、curious、mischievous；persona.voice 只能是 soft、reserved、bright、steady、curious、playful。
dialogue 必须包含 headpat、tickle、poke、cuddle、nuzzle、hop、shy，每项给 2 句符合角色气质的中文短句，每句不超过 50 字。
easterEgg 给这个角色设计一个专属彩蛋：triggerIntent 只能使用上述七个互动名；名称、说明和触发后的短句必须符合角色形象，不得依赖声音或图片中不可动的部件。
parts 必须列出所有能确认的 body、head、eye、mouth、ear、arm、leg、tail、accessory。每只清晰可见的眼睛尽量单独给一个 eye 框，不要把整张脸当成 eye；无法可靠分开时才给一个覆盖双眼的框。box 是相对整张图片的 [x,y,width,height]，每个数 0 到 1；confidence 也是 0 到 1。
JSON 结构：{"quality":{"decision":"pass","issues":[],"explanation":""},"persona":{"archetype":"curious","voice":"curious","identity":"","summary":"","traits":[""]},"dialogue":{"headpat":["",""] ,"tickle":["",""] ,"poke":["",""] ,"cuddle":["",""] ,"nuzzle":["",""] ,"hop":["",""] ,"shy":["",""]},"easterEgg":{"label":"","description":"","triggerIntent":"headpat","message":""},"parts":[{"kind":"body","confidence":0.9,"box":[0.1,0.1,0.8,0.8]}]}`;

export async function analyzeCharacterImage({ bytes, mime }, { provider = loadChatProvider, request = fetch } = {}) {
  const source = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes || []);
  const info = inspectCharacterImage(source);
  if (mime !== info.mime) throw new Error("图片类型与文件内容不一致。");
  const { url, key } = await provider();
  try {
    const response = await request(url, {
      method: "POST", redirect: "error", signal: AbortSignal.timeout(30000),
      headers: { "content-type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({
        model: CHARACTER_VISION_MODEL, max_tokens: 1400, thinking: { type: "disabled" }, output_config: { effort: "low" },
        messages: [{ role: "user", content: [
          { type: "text", text: ANALYSIS_PROMPT },
          { type: "image", source: { type: "base64", media_type: info.mime, data: Buffer.from(source).toString("base64") } },
        ] }],
      }),
    });
    if (!response.ok) {
      await response.body?.cancel();
      if (response.status === 401 || response.status === 403) throw new Error("DeepSeek 凭证暂不可用，无法分析角色图片。");
      if (response.status === 429) throw new Error("角色分析请求较多，请稍后再试。");
      throw new Error("DeepSeek 暂时无法分析这张图片，请稍后再试。");
    }
    const data = await response.json();
    const reply = (data.content || []).filter(block => block.type === "text").map(block => block.text).join("");
    return validateCharacterAnalysis(jsonFromReply(reply));
  } catch (error) {
    if (error.name === "TimeoutError" || error.name === "AbortError") throw new Error("角色分析超过 30 秒，请重试。 ");
    if (error instanceof TypeError) throw new Error("暂时连不上 DeepSeek，无法分析角色图片。");
    if (error instanceof SyntaxError) throw new Error("DeepSeek 的角色分析暂时无法读取，请重试。");
    throw error;
  }
}
