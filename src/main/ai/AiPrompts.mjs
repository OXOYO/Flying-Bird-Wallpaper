import i18next from '../../i18n/i18next.js'
import {
  AUTO_COLLECTION_NAME_MAX_LEN,
  AUTO_COLLECTION_NAME_MIN_LEN
} from '../store/collectionConstants.mjs'
import { applyPackPipeline } from './normalize/NormalizeEngine.mjs'
import { buildSkillPrompt, isSkillPackAvailable } from './skills/SkillPackRegistry.mjs'

function visionCtx(ctx = {}) {
  return {
    outputLocale: ctx.outputLocale || i18next.language,
    profile: ctx.profile || 'default',
    appendOutputLocaleFooter: true,
    ...ctx
  }
}

function textCtx(ctx = {}) {
  return {
    profile: ctx.profile || 'default',
    ...ctx
  }
}

export const buildImageAnalysisPrompt = (ctx = {}) =>
  buildSkillPrompt('image-analysis', visionCtx(ctx))

/** 视频封面帧分析（方案 A） */
export const buildVideoPosterAnalysisPrompt = (ctx = {}) =>
  buildSkillPrompt('video-poster-analysis', visionCtx(ctx))

export const buildSearchParsePrompt = (query, ctx = {}) =>
  buildSkillPrompt('search-parse', {
    ...textCtx(ctx),
    vars: { query: String(query ?? '') }
  })

export const buildCollectionQueryPrompt = (prompt, ctx = {}) =>
  buildSkillPrompt('collection-query', {
    ...textCtx(ctx),
    vars: { prompt: String(prompt ?? '') }
  })

export const buildKeywordExpandPrompt = (keywords, ctx = {}) =>
  buildSkillPrompt('keyword-expand', {
    ...textCtx(ctx),
    vars: { keywords: JSON.stringify(keywords) }
  })

export const buildCollectionTagExpandPrompt = (keyword, ctx = {}) =>
  buildSkillPrompt('collection-tag-expand', {
    ...textCtx(ctx),
    vars: { keyword: String(keyword ?? '') }
  })

/** 为每个画面向量簇单独起名（不合并簇；依据 titleSamples + samples + tags） */
export const buildCollectionNamingPrompt = (candidates, targetCount, ctx = {}) => {
  const payload = candidates.map((item) => ({
    id: item.id,
    count: item.resourceIds.length,
    tags: item.hints?.tags?.slice(0, 8) || [],
    titleSamples: item.hints?.titleSamples?.slice(0, 6) || [],
    samples: (item.hints?.namingSamples || item.hints?.samples)?.slice(0, 6) || []
  }))
  return buildSkillPrompt('collection-naming', {
    ...textCtx(ctx),
    vars: {
      targetCount,
      nameMinLen: AUTO_COLLECTION_NAME_MIN_LEN,
      nameMaxLen: AUTO_COLLECTION_NAME_MAX_LEN,
      uiLocale: ctx.outputLocale || i18next.language || 'enUS',
      candidates: JSON.stringify(payload)
    }
  })
}

/** 系统合集入库 prompt（降级路径） */
export const buildAutoCollectionStoragePrompt = (name, themeHint = '', ctx = {}) => {
  const detail = String(themeHint || name || '').trim()
  if (!detail) return String(name || '').trim().slice(0, 200)
  if (isSkillPackAvailable('auto-collection-storage')) {
    return applyPackPipeline('auto-collection-storage', { detail, name }, textCtx(ctx)).data
  }
  return detail.slice(0, 200)
}
