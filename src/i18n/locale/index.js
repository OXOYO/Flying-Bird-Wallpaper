import zhCN from './lang/zh-CN.json'
import zhTW from './lang/zh-TW.json'
import enUS from './lang/en-US.json'
import ruRU from './lang/ru-RU.json'
import deDE from './lang/de-DE.json'
import frFR from './lang/fr-FR.json'
import jaJP from './lang/ja-JP.json'
import koKR from './lang/ko-KR.json'
import esES from './lang/es-ES.json'
import ptBR from './lang/pt-BR.json'
import itIT from './lang/it-IT.json'
import arSA from './lang/ar-SA.json'

export const resources = {
  zhCN: {
    translation: zhCN
  },
  zhTW: {
    translation: zhTW
  },
  enUS: {
    translation: enUS
  },
  ruRU: {
    translation: ruRU
  },
  deDE: {
    translation: deDE
  },
  frFR: {
    translation: frFR
  },
  jaJP: {
    translation: jaJP
  },
  koKR: {
    translation: koKR
  },
  esES: {
    translation: esES
  },
  ptBR: {
    translation: ptBR
  },
  itIT: {
    translation: itIT
  },
  arSA: {
    translation: arSA
  }
}

export const localeOptions = [
  { label: '简体中文', value: 'zhCN' },
  { label: '繁體中文', value: 'zhTW' },
  { label: 'English', value: 'enUS' },
  { label: 'Русский', value: 'ruRU' },
  { label: 'Deutsch', value: 'deDE' },
  { label: 'Français', value: 'frFR' },
  { label: '日本語', value: 'jaJP' },
  { label: '한국어', value: 'koKR' },
  { label: 'Español', value: 'esES' },
  { label: 'Português (Brasil)', value: 'ptBR' },
  { label: 'Italiano', value: 'itIT' },
  { label: 'العربية', value: 'arSA' }
]

// 系统语言到应用语言的映射
// 用于将系统返回的语言代码映射到应用支持的语言代码
export const systemLocaleMap = {
  // 中文
  'zh-CN': 'zhCN',
  'zh-TW': 'zhTW',
  'zh-HK': 'zhTW',
  // 英语
  en: 'enUS',
  'en-US': 'enUS',
  'en-GB': 'enUS',
  // 俄语
  ru: 'ruRU',
  'ru-RU': 'ruRU',
  // 德语
  de: 'deDE',
  'de-DE': 'deDE',
  // 法语
  fr: 'frFR',
  'fr-FR': 'frFR',
  // 日语
  ja: 'jaJP',
  'ja-JP': 'jaJP',
  // 韩语
  ko: 'koKR',
  'ko-KR': 'koKR',
  // 西班牙语
  es: 'esES',
  'es-ES': 'esES',
  // 葡萄牙语
  'pt-BR': 'ptBR',
  pt: 'ptBR',
  // 意大利语
  it: 'itIT',
  'it-IT': 'itIT',
  // 阿拉伯语
  ar: 'arSA',
  'ar-SA': 'arSA'
}
