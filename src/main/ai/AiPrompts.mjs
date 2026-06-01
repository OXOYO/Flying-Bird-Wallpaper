import { t } from '../../i18n/server.js'
import i18next from '../../i18n/i18next.js'
import {
  AUTO_COLLECTION_NAME_MAX_LEN,
  AUTO_COLLECTION_NAME_MIN_LEN
} from '../store/collectionConstants.mjs'

export const buildImageAnalysisPrompt = () => t('ai.prompts.imageAnalysis')

export const buildSearchParsePrompt = (query) => t('ai.prompts.searchParse', { query })

export const buildCollectionQueryPrompt = (prompt) => t('ai.prompts.collectionQuery', { prompt })

export const buildKeywordExpandPrompt = (keywords) =>
  t('ai.prompts.keywordExpand', { keywords: JSON.stringify(keywords) })

export const buildCollectionTagExpandPrompt = (keyword) =>
  t('ai.prompts.collectionTagExpand', { keyword })

/** 为每个画面向量簇单独起名（不合并簇；依据 titleSamples + samples + tags） */
export const buildCollectionNamingPrompt = (candidates, targetCount) => {
  const payload = candidates.map((item) => ({
    id: item.id,
    count: item.resourceIds.length,
    tags: item.hints?.tags?.slice(0, 8) || [],
    titleSamples: item.hints?.titleSamples?.slice(0, 6) || [],
    samples: (item.hints?.namingSamples || item.hints?.samples)?.slice(0, 6) || []
  }))
  return t('ai.prompts.collectionNaming', {
    targetCount,
    nameMinLen: AUTO_COLLECTION_NAME_MIN_LEN,
    nameMaxLen: AUTO_COLLECTION_NAME_MAX_LEN,
    uiLocale: i18next.language || 'enUS',
    candidates: JSON.stringify(payload)
  })
}

/** 系统合集入库 prompt（降级路径） */
export const buildAutoCollectionStoragePrompt = (name, themeHint = '') => {
  const detail = String(themeHint || name || '').trim()
  if (!detail) return String(name || '').trim().slice(0, 200)
  return t('pages.Collections.auto.storagePrompt', { detail }).slice(0, 200)
}
