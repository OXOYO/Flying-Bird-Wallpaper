/**
 * 法律文档外链（GitHub 仓库 main 分支 docs/legal）
 */
import { appInfo } from './config.js'

const LEGAL_BASE = `${appInfo.github}/blob/main/docs/legal`

/** @param {string} [locale] i18n locale，如 zhCN / enUS */
export function getLegalUrls(locale = 'enUS') {
  const useZh = String(locale ?? 'enUS').toLowerCase().startsWith('zh')
  return {
    privacy: `${LEGAL_BASE}/${useZh ? 'privacy-zh-CN.md' : 'privacy-en.md'}`,
    disclaimer: `${LEGAL_BASE}/${useZh ? 'disclaimer-zh-CN.md' : 'disclaimer-en.md'}`,
    license: `${appInfo.github}/blob/main/LICENSE`
  }
}
