// Only timings and stable error codes cross IPC. No prompts, credentials or replies.
export function cleanCharacterDiagnostics(value) {
  if (!Array.isArray(value?.attempts)) return undefined;
  return { attempts: value.attempts.slice(0, 2).map(attempt => ({
    phase: ['generation', 'translation', 'repair'].includes(attempt.phase) ? attempt.phase : 'generation',
    durationMs: Number.isSafeInteger(attempt.durationMs) && attempt.durationMs >= 0 ? attempt.durationMs : 0,
    ...(typeof attempt.reason === 'string' && /^CHAR_[A-Z_]{1,40}$/.test(attempt.reason) ? { reason: attempt.reason } : {}),
  })), ...(value.timeoutSeconds === 90 ? { timeoutSeconds: 90 } : {}) };
}
const labels = {
  'zh-CN': ['生成用时 {first} 秒', '翻译用时 {first} 秒', '调整用时 {repair} 秒', '正在调整内容…'],
  'zh-TW': ['產生用時 {first} 秒', '翻譯用時 {first} 秒', '調整用時 {repair} 秒', '正在調整內容…'],
  en: ['Generation took {first}s', 'Translation took {first}s', 'Adjustments took {repair}s', 'Adjusting the text…'],
  ja: ['生成に{first}秒', '翻訳に{first}秒', '調整に{repair}秒', '文章を調整中…'],
  fr: ['Création : {first}s', 'Traduction : {first}s', 'Ajustement : {repair}s', 'Ajustement du texte…'],
  de: ['Erstellung: {first}s', 'Übersetzung: {first}s', 'Anpassung: {repair}s', 'Text wird angepasst…'],
  ru: ['Создание: {first}с', 'Перевод: {first}с', 'Правки: {repair}с', 'Уточняем текст…'],
};
const extendedRepair = {
  'zh-CN': '正在重试，最多等待 90 秒…', 'zh-TW': '正在重試，最多等待 90 秒…',
  en: 'Retrying; this may take up to 90 seconds…', ja: '再試行中です。最大90秒かかります…',
  fr: 'Nouvel essai, jusqu’à 90 secondes…', de: 'Erneuter Versuch, bis zu 90 Sekunden…',
  ru: 'Повторная попытка, до 90 секунд…',
};
export function characterTimingMessage(locale, value, repairing = false) {
  const attempts = cleanCharacterDiagnostics(value)?.attempts;
  if (!attempts?.length) return '';
  const [generation, translation, repair, active] = labels[locale] || labels.en;
  const seconds = ms => (ms / 1000).toFixed(1);
  const first = attempts[0].phase === 'translation' ? translation : generation;
  const adjustment = attempts[1] ? repair.replace('{repair}', seconds(attempts[1].durationMs))
    : repairing ? value?.timeoutSeconds === 90 ? extendedRepair[locale] || extendedRepair.en : active : '';
  return first.replace('{first}', seconds(attempts[0].durationMs)) + (adjustment ? ' · ' + adjustment : '');
}
