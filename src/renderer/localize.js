import { brand, t } from "../i18n.js";

let current = { theme: "system", resolvedLocale: "en" };
const listeners = new Set();
export const locale = () => current.resolvedLocale;
export const tr = (key, params) => t(locale(), key, params);
export const appBrand = () => brand(locale());
export const localizedError = (error, key = "operationFailed") => locale().startsWith("zh") && error?.message ? error.message : tr(key);

export function localizeDocument(root = document) {
  document.documentElement.lang = locale();
  document.documentElement.dataset.theme = current.theme || "system";
  root.querySelectorAll("[data-i18n]").forEach(node => { node.textContent = tr(node.dataset.i18n); });
  root.querySelectorAll("[data-i18n-placeholder]").forEach(node => { node.placeholder = tr(node.dataset.i18nPlaceholder); });
  root.querySelectorAll("[data-i18n-aria-label]").forEach(node => { node.setAttribute("aria-label", tr(node.dataset.i18nAriaLabel)); });
  root.querySelectorAll("[data-i18n-title]").forEach(node => { node.title = tr(node.dataset.i18nTitle); });
}

export async function installLocalization(render = localizeDocument) {
  const result = await window.bluepetPreferences.getPreferences();
  if (result.ok) current = result.value;
  render();
  return window.bluepetPreferences.onPreferencesChanged(value => {
    current = value;
    render();
    listeners.forEach(listener => listener(value));
  });
}

export function onLocaleChanged(listener) { listeners.add(listener); return () => listeners.delete(listener); }
