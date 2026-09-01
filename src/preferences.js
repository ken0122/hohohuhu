import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import path from "node:path";

export const THEMES = Object.freeze(["system", "light", "dark"]);
export const LOCALE_CHOICES = Object.freeze(["system", "zh-CN", "zh-TW", "en", "ja", "fr", "de", "ru"]);
export const DEFAULT_PREFERENCES = Object.freeze({ version: 1, theme: "system", locale: "system" });

export function resolveSystemLocale(languages = []) {
  for (const language of languages) {
    const value = String(language).replaceAll("_", "-").toLowerCase();
    if (value === "zh-hant" || /^(zh-(tw|hk|mo)|zh-hant-)/.test(value)) return "zh-TW";
    if (value === "zh-hans" || /^zh(-(cn|sg|my)|-hans-)?$/.test(value)) return "zh-CN";
    for (const locale of ["en", "ja", "fr", "de", "ru"]) if (value === locale || value.startsWith(locale + "-")) return locale;
  }
  return "en";
}

export function validatePreferences(value) {
  if (!value || value.version !== 1 || !THEMES.includes(value.theme) || !LOCALE_CHOICES.includes(value.locale)) return;
  return Object.freeze({ version: 1, theme: value.theme, locale: value.locale });
}

export function createPreferencesStore({ directory, systemLanguages = () => [] }) {
  const file = path.join(directory, "preferences-v1.json");
  let preferences = DEFAULT_PREFERENCES;
  let warning = "";
  try {
    const parsed = validatePreferences(JSON.parse(readFileSync(file, "utf8")));
    if (!parsed) throw new Error("schema");
    preferences = parsed;
  } catch (error) {
    if (error.code !== "ENOENT") warning = "preferences-invalid";
  }
  const snapshot = () => Object.freeze({
    ...preferences,
    resolvedLocale: preferences.locale === "system" ? resolveSystemLocale(systemLanguages()) : preferences.locale,
    warning,
  });
  return {
    file,
    get: snapshot,
    set(change) {
      const next = validatePreferences({ ...preferences, ...change, version: 1 });
      if (!next) throw new Error("preferences-invalid-choice");
      mkdirSync(directory, { recursive: true });
      writeFileSync(file + ".tmp", JSON.stringify(next), { mode: 0o600 });
      renameSync(file + ".tmp", file);
      preferences = next;
      warning = "";
      return snapshot();
    },
  };
}
