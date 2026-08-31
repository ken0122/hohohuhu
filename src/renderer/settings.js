const form = document.querySelector("form");
const fields = document.querySelector("fieldset");
const baseUrl = document.querySelector("#base-url");
const apiKey = document.querySelector("#api-key");
const status = document.querySelector("#status");
const clear = document.querySelector("#clear");
let configured = false;
function render(value) {
  configured = value.configured;
  baseUrl.value = value.baseUrl;
  apiKey.value = "";
  apiKey.placeholder = configured ? "已保存，留空不变" : "粘贴 DeepSeek API Key";
  apiKey.required = !configured;
  clear.disabled = !configured;
}
async function perform(action, success) {
  fields.disabled = true;
  try {
    const result = await action();
    if (!result.ok) throw new Error(result.error);
    render(result.value);
    status.dataset.error = "false";
    status.textContent = success || (configured ? "正在使用这台 Mac 保存的配置。" : "没有单独配置，将尝试使用本机现有配置。");
  } catch (error) {
    status.dataset.error = "true";
    status.textContent = error.message || "操作失败，请重试。";
    clear.disabled = false;
  } finally { fields.disabled = false; }
}
form.addEventListener("submit", event => {
  event.preventDefault();
  const value = { baseUrl: baseUrl.value, apiKey: apiKey.value };
  apiKey.value = "";
  perform(() => window.apiSettings.save(value), "已保存，下次聊天生效。尚未测试连接。");
});
clear.addEventListener("click", () => {
  if (window.confirm("清除聊天配置？之后会改用本机现有配置。"))
    perform(() => window.apiSettings.clear(), "已清除，将使用本机现有配置。");
});
document.querySelector("#cancel").addEventListener("click", () => window.apiSettings.close());
document.addEventListener("keydown", event => { if (event.key === "Escape") window.apiSettings.close(); });
perform(() => window.apiSettings.load());
