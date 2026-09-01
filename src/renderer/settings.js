import { appBrand, installLocalization, localizeDocument, localizedError, tr } from "./localize.js";

const form = document.querySelector("form");
const fields = document.querySelector("fieldset");
const baseUrl = document.querySelector("#base-url");
const apiKey = document.querySelector("#api-key");
const chatModel = document.querySelector("#chat-model");
const visionModel = document.querySelector("#vision-model");
const status = document.querySelector("#status");
const clear = document.querySelector("#clear");
let configured = false;
function render(value) {
  configured = value.configured;
  baseUrl.value = value.baseUrl;
  apiKey.value = "";
  chatModel.value = value.model || "";
  visionModel.value = value.visionModel === value.model ? "" : value.visionModel || "";
  apiKey.placeholder = tr(configured ? "keySavedPlaceholder" : "keyPlaceholder");
  apiKey.required = !configured;
  clear.disabled = !configured;
}
async function perform(action, pending, success, allowClearOnFailure = false) {
  fields.disabled = true;
  document.body.setAttribute("aria-busy", "true");
  status.dataset.error = "false";
  status.textContent = pending;
  try {
    const result = await action();
    if (!result.ok) throw new Error(result.error);
    render(result.value);
    status.dataset.error = "false";
    status.textContent = success || tr(configured ? "localConfigActive" : "automaticConfig");
  } catch (error) {
    status.dataset.error = "true";
    status.textContent = localizedError(error, "settingsOperationFailed");
    clear.disabled = allowClearOnFailure ? false : !configured;
  } finally {
    fields.disabled = false;
    document.body.setAttribute("aria-busy", "false");
  }
}
form.addEventListener("submit", event => {
  event.preventDefault();
  const value = { baseUrl: baseUrl.value, apiKey: apiKey.value, model: chatModel.value, visionModel: visionModel.value };
  perform(() => window.apiSettings.save(value), tr("savingChat"), tr("savedChat"));
});
clear.addEventListener("click", () => {
  if (window.confirm(tr("clearConfirm")))
    perform(() => window.apiSettings.clear(), tr("clearingChat"), tr("clearedChat"));
});
document.querySelector("#cancel").addEventListener("click", () => window.apiSettings.close());
document.addEventListener("keydown", event => { if (event.key === "Escape") window.apiSettings.close(); });
await installLocalization(() => {
  localizeDocument();
  document.title = tr("settingsTitle", { brand: appBrand() });
  if (baseUrl.value) render({ configured, baseUrl: baseUrl.value, model: chatModel.value, visionModel: visionModel.value });
});
perform(() => window.apiSettings.load(), tr("loading"), undefined, true);
