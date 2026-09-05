export const CHARACTER_TEXT_LOCALES = Object.freeze(['zh-CN', 'zh-TW', 'en', 'ja', 'fr', 'de', 'ru']);
const intents = ['headpat', 'tickle', 'poke', 'cuddle', 'nuzzle', 'hop', 'shy'];
const same = (a, b) => {
  if (Object.is(a, b)) return true;
  if (!a || !b || typeof a !== "object" || typeof b !== "object" || Array.isArray(a) !== Array.isArray(b)) return false;
  const keys = Object.keys(a);
  return keys.length === Object.keys(b).length && keys.every(key => Object.hasOwn(b, key) && same(a[key], b[key]));
};

// Language versions are independently authored. Viewing a fallback never creates
// a translation, and editing one language never erases another language's work.
export function characterText(entry, locale) {
  const { analysis, name } = entry;
  const source = analysis.sourceLocale || 'zh-CN';
  const order = [...new Set([locale, ...(analysis.textLocaleOrder || []), source, ...CHARACTER_TEXT_LOCALES])];
  const sources = {};
  function pick(key, intent) {
    for (const language of order) {
      const value = language === source ? (intent ? analysis.dialogue[intent] : key === 'name' ? name : analysis[key])
        : intent ? analysis.dialogueTranslations?.[language]?.[intent] : analysis.textVersions?.[language]?.[key];
      if (value !== undefined) { sources[intent ? `dialogue:${intent}` : key] = language; return value; }
    }
  }
  return { name: pick('name'), analysis: { ...analysis, persona: pick('persona'), easterEgg: pick('easterEgg'),
    dialogue: Object.fromEntries(intents.map(intent => [intent, pick('dialogue', intent)])) }, sources };
}

// Accept raw edits here; the main-process validator remains the save boundary.
export function writeCharacterText(entry, locale, patch, { force = false } = {}) {
  if (!CHARACTER_TEXT_LOCALES.includes(locale)) throw new Error('Unsupported character text locale');
  const visible = characterText(entry, locale), source = entry.analysis.sourceLocale || 'zh-CN';
  let name = entry.name, analysis = { ...entry.analysis }, changed = false;
  const versions = { ...analysis.textVersions }, translations = { ...analysis.dialogueTranslations };
  for (const key of ['name', 'persona', 'easterEgg']) {
    if (!Object.hasOwn(patch, key) || (!force && same(patch[key], key === 'name' ? visible.name : visible.analysis[key]))) continue;
    changed = true;
    if (locale === source) { if (key === 'name') name = patch[key]; else analysis[key] = patch[key]; }
    else versions[locale] = { ...versions[locale], [key]: patch[key] };
  }
  for (const intent of intents) {
    if (!Object.hasOwn(patch.dialogue || {}, intent) || (!force && same(patch.dialogue[intent], visible.analysis.dialogue[intent]))) continue;
    changed = true;
    translations[locale] = { ...translations[locale], [intent]: patch.dialogue[intent] };
    if (locale === source) analysis.dialogue = { ...analysis.dialogue, [intent]: patch.dialogue[intent] };
  }
  if (Object.hasOwn(patch, 'parts')) analysis.parts = patch.parts;
  if (changed) analysis = { ...analysis, textVersions: versions, dialogueTranslations: translations,
    textLocaleOrder: [locale, ...(analysis.textLocaleOrder || []).filter(value => value !== locale)] };
  return { name, analysis };
}

export function characterTextPatch(entry, scope) {
  if (scope === 'all') return { name: entry.name, persona: entry.analysis.persona, dialogue: entry.analysis.dialogue, easterEgg: entry.analysis.easterEgg };
  if (scope === 'persona') return { name: entry.name, persona: entry.analysis.persona };
  if (scope.startsWith('dialogue:')) { const intent = scope.split(':')[1]; return { dialogue: { [intent]: entry.analysis.dialogue[intent] } }; }
  return { [scope]: entry.analysis[scope] };
}

export function editSourceDialogue(analysis, dialogue) {
  return writeCharacterText({ analysis }, analysis.sourceLocale || 'zh-CN', { dialogue }).analysis;
}
