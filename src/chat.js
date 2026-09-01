import { cleanClaudeReply } from "./core.js";
import { CHAT_MODEL, loadChatProvider } from "./chat-provider.js";
import { BLUE_ONE_EYE_PROFILE } from "./character-profile.js";

const VOICE = Object.freeze({
  soft: "语气柔软、亲昵、稍微害羞",
  reserved: "语气克制、简短、带一点不直说的关心",
  bright: "语气明快但不聒噪",
  steady: "语气平静、可靠",
  curious: "语气好奇、友善",
  playful: "语气俏皮但不过分卖萌",
});
const INSTRUCTION = Object.freeze({
  "zh-CN": "始终保持这个角色的气质，用用户的语言回答，只说一句自然短句，不使用 Markdown，最多 50 个字符。不要声称你操作了电脑，不要索取敏感信息。",
  "zh-TW": "始終保持這個角色的氣質，使用者用什麼語言就用什麼語言回答，只說一句自然短句，不使用 Markdown，最多 50 個字元。不要聲稱你操作了電腦，不要索取敏感資訊。",
  en: "Stay in character. Reply in the user's language with one natural sentence, no Markdown, at most 50 visible characters. Never claim to operate the computer or request sensitive information.",
  ja: "キャラクターらしさを守り、ユーザーの言語で自然な短文を一つだけ返してください。Markdownは使わず、表示50文字以内。パソコンを操作したと主張せず、機密情報を求めないでください。",
  fr: "Reste fidèle au personnage. Réponds dans la langue de l’utilisateur en une seule phrase naturelle, sans Markdown, 50 caractères visibles maximum. Ne prétends pas utiliser l’ordinateur et ne demande aucune donnée sensible.",
  de: "Bleibe in der Rolle. Antworte in der Sprache des Nutzers mit genau einem natürlichen kurzen Satz ohne Markdown und höchstens 50 sichtbaren Zeichen. Behaupte nie, den Computer zu bedienen, und frage nicht nach vertraulichen Daten.",
  ru: "Сохраняй характер персонажа. Отвечай на языке пользователя одной естественной короткой фразой без Markdown, не более 50 видимых знаков. Не утверждай, что управляешь компьютером, и не запрашивай конфиденциальные данные.",
});
export function chatSystemPrompt(persona = BLUE_ONE_EYE_PROFILE.persona, { locale = "zh-CN" } = {}) {
  const traits = persona.traits.join("、");
  const introduction = locale === "zh-CN" ? `你是${persona.identity}。角色气质：${persona.summary} 性格特点：${traits}。${VOICE[persona.voice]}。`
    : `Character identity: ${persona.identity}. Character summary: ${persona.summary}. Traits: ${persona.traits.join(", ")}. `;
  return introduction + (INSTRUCTION[locale] || INSTRUCTION.en);
}
export async function askClaude(prompt,{provider=loadChatProvider,request=fetch,persona=BLUE_ONE_EYE_PROFILE.persona,locale="zh-CN"}={}) {
  const safePrompt=String(prompt).trim().slice(0,500);
  if(!safePrompt)throw new Error("悄悄说点什么吧。");
  const {url,key}=await provider();
  try {
    // No CLI startup, tool discovery or agent loop for a one-sentence reply.
    const response=await request(url,{
      method:"POST",redirect:"error",signal:AbortSignal.timeout(15000),
      headers:{"content-type":"application/json","x-api-key":key,"anthropic-version":"2023-06-01"},
      body:JSON.stringify({model:CHAT_MODEL,max_tokens:160,thinking:{type:"disabled"},output_config:{effort:"low"},
        system:chatSystemPrompt(persona,{locale}),messages:[{role:"user",content:safePrompt}]}),
    });
    if(!response.ok) {
      await response.body?.cancel();
      if(response.status===401||response.status===403)throw new Error("DeepSeek 凭证暂不可用，请检查本机 provider 配置。");
      if(response.status===429)throw new Error("聊得有点快啦，稍等一下再试好吗？");
      throw new Error("DeepSeek 暂时没回应，请稍后再试。");
    }
    const data=await response.json();
    const reply=cleanClaudeReply((data.content||[]).filter(block=>block.type==="text").map(block=>block.text).join(""));
    if(!reply)throw new Error("我刚刚走神了，再说一次好吗？");
    return reply;
  } catch(error) {
    if(error.name==="TimeoutError"||error.name==="AbortError")throw new Error("刚刚没听清，再问一次好吗？");
    if(error instanceof TypeError)throw new Error("暂时连不上 DeepSeek，请检查网络后再试。");
    if(error instanceof SyntaxError)throw new Error("DeepSeek 的回复暂时没接住，请再试一次。");
    throw error;
  }
}
