import { appBrand, installLocalization, localizeDocument, localizedError, tr } from "./localize.js";

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
  apiKey.placeholder = tr(configured ? "keySavedPlaceholder" : "keyPlaceholder");
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
    status.textContent = success || tr(configured ? "localConfigActive" : "automaticConfig");
  } catch (error) {
    status.dataset.error = "true";
    status.textContent = localizedError(error, "settingsOperationFailed");
    clear.disabled = false;
  } finally { fields.disabled = false; }
}
form.addEventListener("submit", event => {
  event.preventDefault();
  const value = { baseUrl: baseUrl.value, apiKey: apiKey.value };
  apiKey.value = "";
  perform(() => window.apiSettings.save(value), tr("savedChat"));
});
clear.addEventListener("click", () => {
  if (window.confirm(tr("clearConfirm")))
    perform(() => window.apiSettings.clear(), tr("clearedChat"));
});
document.querySelector("#cancel").addEventListener("click", () => window.apiSettings.close());
document.addEventListener("keydown", event => { if (event.key === "Escape") window.apiSettings.close(); });
await installLocalization(() => {
  localizeDocument();
  document.title = tr("settingsTitle", { brand: appBrand() });
  if (baseUrl.value) render({ configured, baseUrl: baseUrl.value });
});
perform(() => window.apiSettings.load());
