import { readFileSync, writeFileSync, renameSync, unlinkSync, mkdirSync } from "node:fs";
import path from "node:path";
import { providerRequest, providerSettings } from "./chat-provider.js";

const EMPTY_STATUS = Object.freeze({ configured: false, baseUrl: "", model: "", visionModel: "" });
export function validateApiSettings(value, previous) {
  return providerSettings(value, previous);
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
      return validateApiSettings({ baseUrl: data.baseUrl, apiKey: data.key, model: data.model, visionModel: data.visionModel });
    } catch { throw new Error("无法解密或迁移 API 设置，请清除后重新配置。"); }
  }
  function statusOf(saved) {
    return saved ? { configured: true, baseUrl: saved.baseUrl, model: saved.model, visionModel: saved.visionModel } : { ...EMPTY_STATUS };
  }
  return {
    status() { return statusOf(read()); },
    provider() { return providerRequest(read()); },
    save(value) {
      const previous = value?.apiKey === "" ? read() : undefined;
      const saved = validateApiSettings(value, previous);
      available();
      try {
        mkdirSync(directory, { recursive: true });
        writeFileSync(file + ".tmp", secureStorage.encryptString(JSON.stringify(saved)), { mode: 0o600 });
        renameSync(file + ".tmp", file);
      } catch { throw new Error("保存失败，请检查应用数据目录权限后重试。"); }
      return statusOf(saved);
    },
    clear() {
      try { unlinkSync(file); } catch (error) { if (error.code !== "ENOENT") throw new Error("清除失败，请稍后重试。"); }
      return { ...EMPTY_STATUS };
    },
  };
}
