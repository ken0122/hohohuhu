const INTENTS = Object.freeze([
  "headpat", "tickle", "poke", "cuddle", "nuzzle", "hop", "shy",
]);
const MOTIONS = new Set([
  ...INTENTS,
  "idle-look", "idle-stretch", "idle-bob", "idle-sway",
  "blue-secret", "cat-secret", "sunny-secret",
]);
const ARCHETYPES = new Set(["shy", "proud", "cheerful", "calm", "curious", "mischievous"]);
const VOICES = new Set(["soft", "reserved", "bright", "steady", "curious", "playful"]);

function boundedText(value, label, maximum, { optional = false } = {}) {
  if (optional && (value === undefined || value === "")) return "";
  if (typeof value !== "string" || !value.trim() || value.length > maximum || /[\x00-\x1f\x7f]/.test(value)) {
    throw new Error(`${label}需要 1–${maximum} 个字符。`);
  }
  return value.trim();
}

function recipe(value, label) {
  if (!value || typeof value !== "object" || Array.isArray(value) || !MOTIONS.has(value.motion)) {
    throw new Error(`${label}引用了不支持的动作。`);
  }
  if (!Number.isSafeInteger(value.duration) || value.duration < 300 || value.duration > 2400) {
    throw new Error(`${label}时长需要在 300–2400ms 之间。`);
  }
  if (!Array.isArray(value.messages) || value.messages.length < 1 || value.messages.length > 4) {
    throw new Error(`${label}需要 1–4 句短句。`);
  }
  return Object.freeze({
    motion: value.motion,
    duration: value.duration,
    messages: Object.freeze(value.messages.map((message, index) => boundedText(message, `${label}第 ${index + 1} 句`, 50))),
  });
}

// This is the trust boundary for app-authored profiles and future multimodal
// suggestions. A profile is data only: no selectors, CSS, scripts or callbacks.
export function validateCharacterProfile(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("角色人格格式无效。");
  const persona = value.persona;
  if (!persona || !ARCHETYPES.has(persona.archetype) || !VOICES.has(persona.voice)) {
    throw new Error("角色人格类型或说话方式无效。");
  }
  if (!Array.isArray(persona.traits) || persona.traits.length < 1 || persona.traits.length > 4) {
    throw new Error("角色需要 1–4 个性格特点。");
  }
  const reactions = {};
  for (const intent of INTENTS) reactions[intent] = recipe(value.reactions?.[intent], `互动 ${intent}`);
  if (!Array.isArray(value.idle) || value.idle.length < 1 || value.idle.length > 4) {
    throw new Error("角色需要 1–4 个闲置动作。");
  }
  const egg = value.easterEgg;
  if (!egg || typeof egg !== "object" || !INTENTS.includes(egg.trigger?.intent)
    || !Number.isSafeInteger(egg.trigger.count) || egg.trigger.count < 2 || egg.trigger.count > 5
    || !Number.isSafeInteger(egg.trigger.windowMs) || egg.trigger.windowMs < 2000 || egg.trigger.windowMs > 15000) {
    throw new Error("角色彩蛋触发条件无效。");
  }
  return Object.freeze({
    persona: Object.freeze({
      archetype: persona.archetype,
      voice: persona.voice,
      identity: boundedText(persona.identity, "角色身份", 40),
      summary: boundedText(persona.summary, "角色气质", 80),
      traits: Object.freeze(persona.traits.map((trait, index) => boundedText(trait, `性格特点 ${index + 1}`, 12))),
    }),
    reactions: Object.freeze(reactions),
    proximity: Object.freeze({
      enter: recipe(value.proximity?.enter, "靠近反馈"),
      dwell: recipe(value.proximity?.dwell, "停留反馈"),
    }),
    idle: Object.freeze(value.idle.map((item, index) => recipe(item, `闲置动作 ${index + 1}`))),
    easterEgg: Object.freeze({
      id: boundedText(egg.id, "彩蛋 ID", 32),
      label: boundedText(egg.label, "彩蛋名称", 24),
      description: boundedText(egg.description, "彩蛋说明", 80),
      trigger: Object.freeze({ intent: egg.trigger.intent, count: egg.trigger.count, windowMs: egg.trigger.windowMs }),
      reaction: recipe(egg.reaction, "彩蛋反馈"),
    }),
  });
}

const COMMON = {
  tickle: { motion: "tickle", duration: 800, messages: ["哎呀呀，好痒！", "哈哈，肚肚怕痒～"] },
  poke: { motion: "poke", duration: 500, messages: ["哎呀！戳到肚肚啦", "软乎乎的，不许戳～"] },
  cuddle: { motion: "cuddle", duration: 1200, messages: ["抱抱，再陪我一会儿", "贴着你，暖乎乎"] },
  nuzzle: { motion: "nuzzle", duration: 1100, messages: ["贴贴～", "蹭蹭你"] },
  hop: { motion: "hop", duration: 700, messages: ["嘿嘿！", "我在呢～"] },
  shy: { motion: "shy", duration: 800, messages: ["你来啦", "有点害羞…"] },
};

export const BLUE_ONE_EYE_PROFILE = validateCharacterProfile({
  persona: {
    archetype: "shy", voice: "soft", identity: "住在桌面上的蓝色单眼小宠物",
    summary: "乖巧亲昵，略微害羞，偶尔撒娇，但不会聒噪。", traits: ["乖巧", "亲昵", "害羞"],
  },
  reactions: {
    ...COMMON,
    headpat: { motion: "headpat", duration: 1000, messages: ["摸摸头，好舒服", "嗯…可以再摸一下"] },
  },
  proximity: {
    enter: { motion: "shy", duration: 800, messages: ["你来啦", "我有乖乖待着"] },
    dwell: { motion: "nuzzle", duration: 1100, messages: ["蹭蹭你", "再陪我一会儿"] },
  },
  idle: [
    { motion: "idle-look", duration: 1500, messages: ["我看看…", "唔唔～"] },
    { motion: "idle-stretch", duration: 1500, messages: ["嘿咻～", "伸个懒腰"] },
    { motion: "idle-bob", duration: 1300, messages: ["呼噜…", "嗯哼～"] },
    { motion: "idle-sway", duration: 1600, messages: ["晃呀晃～", "唔姆…"] },
  ],
  easterEgg: {
    id: "secret-double-blink", label: "只给你看的眨眼", description: "短时间连续摸头三次，会悄悄眨两次眼。",
    trigger: { intent: "headpat", count: 3, windowMs: 8000 },
    reaction: { motion: "blue-secret", duration: 1100, messages: ["这个只给你看"] },
  },
});

export const BLACK_CAT_PROFILE = validateCharacterProfile({
  persona: {
    archetype: "proud", voice: "reserved", identity: "住在桌面上的黑猫",
    summary: "克制、警觉、有一点傲娇，会用行动偷偷回应亲近。", traits: ["克制", "警觉", "傲娇"],
  },
  reactions: {
    headpat: { motion: "shy", duration: 900, messages: ["只是刚好没躲", "再摸一下也不是不行"] },
    tickle: { motion: "tickle", duration: 700, messages: ["爪子要伸出来了", "这里不许乱碰"] },
    poke: { motion: "poke", duration: 500, messages: ["……你戳我？", "胆子不小"] },
    cuddle: { motion: "cuddle", duration: 1100, messages: ["只准抱一会儿", "今天破例"] },
    nuzzle: { motion: "nuzzle", duration: 900, messages: ["我只是路过", "别误会"] },
    hop: { motion: "hop", duration: 650, messages: ["看见了", "我一直在"] },
    shy: { motion: "shy", duration: 750, messages: ["别一直盯着我", "……你好"] },
  },
  proximity: {
    enter: { motion: "shy", duration: 750, messages: ["别一直盯着我", "……你来了"] },
    dwell: { motion: "nuzzle", duration: 900, messages: ["我只是刚好靠近", "再待一会儿也行"] },
  },
  idle: [
    { motion: "idle-look", duration: 1400, messages: ["巡视一下", "……唔"] },
    { motion: "idle-stretch", duration: 1700, messages: ["伸展而已", "嗯——"] },
    { motion: "idle-bob", duration: 1200, messages: ["喵呜…", "哼。"] },
    { motion: "idle-sway", duration: 1500, messages: ["尾巴晃晃", "唔。"] },
  ],
  easterEgg: {
    id: "caught-caring", label: "被发现的在意", description: "短时间连续贴贴三次，会先装作没反应，再突然跳起来。",
    trigger: { intent: "nuzzle", count: 3, windowMs: 8000 },
    reaction: { motion: "cat-secret", duration: 1500, messages: ["……被你发现了"] },
  },
});

export const SUNNY_YELLOW_PROFILE = validateCharacterProfile({
  persona: {
    archetype: "cheerful", voice: "bright", identity: "一只像小太阳的黄色桌面玩偶",
    summary: "开朗、热情，喜欢把小事变成轻快的庆祝。", traits: ["开朗", "热情", "爱庆祝"],
  },
  reactions: {
    headpat: { motion: "headpat", duration: 900, messages: ["摸摸会充电", "亮起来啦"] },
    tickle: { motion: "tickle", duration: 760, messages: ["哈哈，光芒乱跑啦", "痒得要闪起来了"] },
    poke: { motion: "poke", duration: 480, messages: ["叮！收到一个小戳", "戳出一点好心情"] },
    cuddle: { motion: "cuddle", duration: 1100, messages: ["暖暖地抱一下", "给你一个太阳抱抱"] },
    nuzzle: { motion: "nuzzle", duration: 1000, messages: ["贴贴，分你一点阳光", "靠近一点，暖乎乎"] },
    hop: { motion: "hop", duration: 680, messages: ["耶！我在这儿", "小太阳起飞啦"] },
    shy: { motion: "shy", duration: 720, messages: ["嘿，你看到我啦", "今天也要亮亮的"] },
  },
  proximity: {
    enter: { motion: "shy", duration: 720, messages: ["嘿，你看到我啦", "今天也要亮亮的"] },
    dwell: { motion: "nuzzle", duration: 1000, messages: ["分你一点阳光", "一起暖一会儿"] },
  },
  idle: [
    { motion: "idle-look", duration: 1300, messages: ["看看四周～", "亮晶晶～"] },
    { motion: "idle-stretch", duration: 1450, messages: ["嘿咻～", "伸展光芒"] },
    { motion: "idle-bob", duration: 1250, messages: ["叮咚～", "蹦一下！"] },
    { motion: "idle-sway", duration: 1500, messages: ["摇呀摇～", "啦啦～"] },
  ],
  easterEgg: {
    id: "triple-spark", label: "三连点亮", description: "短时间连续戳三次，会开心地闪跳两下。",
    trigger: { intent: "poke", count: 3, windowMs: 8000 },
    reaction: { motion: "sunny-secret", duration: 1200, messages: ["叮叮叮，今天也亮起来！"] },
  },
});

export const BASIC_PROFILE = validateCharacterProfile({
  persona: {
    archetype: "curious", voice: "curious", identity: "住在桌面上的小伙伴",
    summary: "好奇、友善，会用轻巧动作回应陪伴。", traits: ["好奇", "友善"],
  },
  reactions: { ...COMMON, headpat: { motion: "headpat", duration: 1000, messages: ["谢谢你摸摸我", "再陪我一下吧"] } },
  proximity: {
    enter: { motion: "shy", duration: 800, messages: ["你好呀", "我看见你了"] },
    dwell: { motion: "nuzzle", duration: 1000, messages: ["一起待一会儿吧", "我在这里"] },
  },
  idle: [
    { motion: "idle-look", duration: 1500, messages: ["看看四周", "唔嗯～"] },
    { motion: "idle-stretch", duration: 1500, messages: ["嘿咻～", "伸个懒腰"] },
    { motion: "idle-bob", duration: 1300, messages: ["呼噜…", "嗯哼～"] },
    { motion: "idle-sway", duration: 1600, messages: ["晃一晃～", "唔姆…"] },
  ],
  easterEgg: {
    id: "hello-hop", label: "熟悉之后的招呼", description: "短时间连续摸头三次，会开心地跳一下。",
    trigger: { intent: "headpat", count: 3, windowMs: 8000 },
    reaction: { motion: "hop", duration: 900, messages: ["我们熟悉起来啦"] },
  },
});

export function profileFromPersona(persona) {
  const base = persona?.archetype === "proud" ? BLACK_CAT_PROFILE
    : persona?.archetype === "shy" ? BLUE_ONE_EYE_PROFILE : BASIC_PROFILE;
  return validateCharacterProfile({
    persona,
    reactions: base.reactions,
    proximity: base.proximity,
    idle: base.idle,
    easterEgg: base.easterEgg,
  });
}

export function profileFromAnalysis(analysis) {
  const base = profileFromPersona(analysis.persona);
  const reactions = Object.fromEntries(Object.entries(base.reactions).map(([intent, value]) => [intent, {
    ...value,
    messages: analysis.dialogue?.[intent] || value.messages,
  }]));
  const suggestedEgg = analysis.easterEgg;
  return validateCharacterProfile({
    persona: analysis.persona,
    reactions,
    proximity: {
      enter: { ...base.proximity.enter, messages: reactions.shy.messages },
      dwell: { ...base.proximity.dwell, messages: reactions.nuzzle.messages },
    },
    idle: base.idle,
    easterEgg: suggestedEgg ? {
      id: "custom-egg",
      label: suggestedEgg.label,
      description: suggestedEgg.description,
      trigger: { intent: suggestedEgg.triggerIntent, count: 3, windowMs: 8000 },
      reaction: { motion: base.easterEgg.reaction.motion, duration: base.easterEgg.reaction.duration, messages: [suggestedEgg.message] },
    } : base.easterEgg,
  });
}

export const CHARACTER_INTENTS = INTENTS;
