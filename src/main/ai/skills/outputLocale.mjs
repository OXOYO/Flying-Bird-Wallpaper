/** UI locale → model-facing output language name */
const OUTPUT_LANGUAGE_NAMES = {
  enUS: 'English',
  zhCN: 'Simplified Chinese',
  zhTW: 'Traditional Chinese',
  jaJP: 'Japanese',
  koKR: 'Korean',
  deDE: 'German',
  frFR: 'French',
  esES: 'Spanish',
  itIT: 'Italian',
  ptBR: 'Portuguese (Brazil)',
  ruRU: 'Russian',
  arSA: 'Arabic'
}

/** @param {string} [locale] i18next language id */
export function resolveOutputLanguageName(locale) {
  const key = String(locale || 'enUS').replace(/-/g, '')
  return OUTPUT_LANGUAGE_NAMES[key] || OUTPUT_LANGUAGE_NAMES.enUS
}

/** outputLocaleFooter 模板（热路径不依赖 i18next）；en/zh 专用句，其它语言回退英文 */
const OUTPUT_LOCALE_TEMPLATES = {
  enUS:
    'Output title, summary, desc, and tags entirely in {languageName}. Match the app UI language; avoid meaningless mixed languages unless visible text in the image requires it.',
  zhCN:
    '请将 title、summary、desc、tags 全部使用{languageName}输出，与当前界面语言一致；除非画面内可见文字需要，否则不要无意义混用语言。'
}

/** @param {string} [locale] */
export function buildOutputLocaleFooter(locale) {
  const key = String(locale || 'enUS').replace(/-/g, '')
  const languageName = resolveOutputLanguageName(locale)
  const template =
    OUTPUT_LOCALE_TEMPLATES[key] ||
    (key.startsWith('zh') ? OUTPUT_LOCALE_TEMPLATES.zhCN : OUTPUT_LOCALE_TEMPLATES.enUS)
  return template.replace(/\{languageName\}/g, languageName)
}
