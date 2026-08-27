import { readFileSync, writeFileSync, renameSync, unlinkSync, mkdirSync } from "node:fs";
import path from "node:path";
import { deepseekCredentials } from "./chat-provider.js";

export const DEFAULT_BASE_URL = "https://api.deepseek.com/anthropic";
export function validateApiSettings(value, previous) {
  if (!value || typeof value.baseUrl !== "string" || typeof value.apiKey !== "string" || value.baseUrl.length > 256 || value.apiKey.length > 4096)
    throw new Error("请输入有效的 Base URL 和 API Key。");
  let url;
  try { url = new URL(value.baseUrl.trim()); } catch { throw new Error("Base URL 格式不正确。"); }
  if (url.protocol !== "https:" || url.host !== "api.deepseek.com" || url.username || url.password || url.search || url.hash || !["/", "/anthropic", "/anthropic/"].includes(url.pathname))
    throw new Error("仅支持 https://api.deepseek.com 或其 /anthropic 地址。");
  const key = value.apiKey.trim() || previous?.key;
  if (!key || /[\s\x00-\x1f\x7f]/.test(key)) throw new Error("请输入有效的 API Key；不能包含空白字符。");
  return { baseUrl: DEFAULT_BASE_URL, key };
}

// Only ciphertext is stored in app userData, never in the repository or a database.
export function createApiSettingsStore({ directory, secureStorage }) {
  const file = path.join(directory, "api-settings.enc");
  function available() {
    if (!secureStorage.isEncryptionAvailable()) throw new Error("系统加密暂不可用，请稍后重试；不会明文保存密钥。");
  }
  function read() {
    let encrypted;
    try { encrypted = readFileSync(file); } catch (error) { if (error.code === "ENOENT") return; throw new Error("无法读取 API 设置，请清除后重新配置。"); }
    available();
    try {
      const data = JSON.parse(secureStorage.decryptString(encrypted));
      return validateApiSettings({ baseUrl: data.baseUrl, apiKey: data.key });
    } catch { throw new Error("无法解密 API 设置，请清除后重新配置。"); }
  }
  return {
    status() { const saved = read(); return { configured: Boolean(saved), baseUrl: saved?.baseUrl || DEFAULT_BASE_URL }; },
    provider() { const saved = read(); return saved && deepseekCredentials({ ANTHROPIC_BASE_URL: saved.baseUrl, ANTHROPIC_API_KEY: saved.key }); },
    save(value) {
      const previous = value?.apiKey === "" ? read() : undefined;
      const saved = validateApiSettings(value, previous);
      available();
      try {
        mkdirSync(directory, { recursive: true });
        writeFileSync(file + ".tmp", secureStorage.encryptString(JSON.stringify(saved)), { mode: 0o600 });
        renameSync(file + ".tmp", file);
      } catch { throw new Error("保存失败，请检查应用数据目录权限后重试。"); }
      return this.status();
    },
    clear() {
      try { unlinkSync(file); } catch (error) { if (error.code !== "ENOENT") throw new Error("清除失败，请稍后重试。"); }
      return { configured: false, baseUrl: DEFAULT_BASE_URL };
    },
  };
}
