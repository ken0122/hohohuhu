function bounded(value, maximum) {
  return typeof value === "string" && value.trim() && value.length <= maximum && !/[\x00-\x1f\x7f]/.test(value)
    ? value.trim()
    : undefined;
}

export function messagesUrl(baseUrl) {
  const value = bounded(baseUrl, 2048);
  if (!value) throw new Error("请输入有效的 Base URL。");
  let url;
  try { url = new URL(value); } catch { throw new Error("Base URL 格式不正确。"); }
  if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash) {
    throw new Error("Base URL 必须是无账号、查询参数或片段的 HTTPS 地址。");
  }
  // Assign once: URL normalizes an empty pathname back to '/', which would
  // otherwise turn a bare host into '//v1/messages'. Keep version bases intact.
  const pathname = url.pathname.replace(/\/+$/, "");
  url.pathname = pathname.endsWith("/v1/messages") ? pathname
    : pathname.endsWith("/v1") ? pathname + "/messages" : pathname + "/v1/messages";
  return url.toString();
}

export function providerSettings(value, previous) {
  if (!value || typeof value !== "object") throw new Error("请输入有效的 API 设置。");
  const baseUrl = bounded(value.baseUrl, 2048);
  const model = bounded(value.model, 200);
  const visionModel = bounded(value.visionModel, 200) || model;
  const key = bounded(value.apiKey, 4096) || previous?.key;
  messagesUrl(baseUrl);
  if (!key || /\s/.test(key)) throw new Error("请输入有效的 API Key；不能包含空白字符。");
  if (!model) throw new Error("请输入对话模型标识。");
  return { baseUrl, key, model, visionModel };
}

export function providerFromEnvironment(env = process.env) {
  if (!env.BLUEPET_API_BASE_URL || !env.BLUEPET_API_KEY || !env.BLUEPET_CHAT_MODEL) return;
  return providerSettings({
    baseUrl: env.BLUEPET_API_BASE_URL,
    apiKey: env.BLUEPET_API_KEY,
    model: env.BLUEPET_CHAT_MODEL,
    visionModel: env.BLUEPET_VISION_MODEL,
  });
}

export function providerRequest(value) {
  if (!value) return;
  const settings = providerSettings({ ...value, apiKey: value.key });
  return { ...settings, url: messagesUrl(settings.baseUrl) };
}

export async function loadChatProvider({ env = process.env } = {}) {
  const configured = providerFromEnvironment(env);
  if (configured) return providerRequest(configured);
  const error = new Error("请先前往聊天设置添加兼容接口");
  error.code = PROVIDER_NOT_CONFIGURED;
  throw error;
}
export const PROVIDER_NOT_CONFIGURED = "PROVIDER_NOT_CONFIGURED";
