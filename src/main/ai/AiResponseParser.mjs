import { applyPackPipeline } from './normalize/NormalizeEngine.mjs'
import {
  normalizeCollectionQueryShape,
  normalizeSearchParamsShape
} from './normalize/schemaCoerce.mjs'
import { normalizeCollectionNamingPlan as hookCollectionNamingPlan } from './normalize/normalizeHooks.mjs'
import { applyNsfwConsistency as applyNsfwFromRepairs } from './normalize/repairEngine.mjs'
import { isSkillPackAvailable } from './skills/SkillPackLoader.mjs'

const clamp = (n, min, max) => Math.min(max, Math.max(min, n))

/** @deprecated 请使用 normalize.json repairs；保留兼容导出 */
export const applyNsfwConsistency = applyNsfwFromRepairs

export const extractJsonObject = (text) => {
  if (!text || typeof text !== 'string') return null
  const trimmed = text.trim()
  try {
    return JSON.parse(trimmed)
  } catch {
    const match = trimmed.match(/\{[\s\S]*\}/)
    if (!match) return null
    try {
      return JSON.parse(match[0])
    } catch {
      return null
    }
  }
}

function packOrLegacy(packId, raw, ctx, legacyFn) {
  if (isSkillPackAvailable(packId)) {
    return applyPackPipeline(packId, raw, ctx).data
  }
  return legacyFn(raw)
}

export const normalizeAnalysisResult = (raw, ctx = {}) => {
  const packId = ctx.packId || 'image-analysis'
  return packOrLegacy(packId, raw, ctx, (obj) => {
    const data = typeof obj === 'object' && obj ? obj : {}
    const tags = Array.isArray(data.tags)
      ? data.tags.map((t) => String(t).trim()).filter(Boolean).slice(0, 12)
      : []
    const { nsfwLevel, safeForWork } = applyNsfwConsistency(data)
    return {
      score: clamp(Math.round(Number(data.score) || 0), 0, 100),
      tags,
      title: String(data.title || '').trim().slice(0, 120),
      desc: String(data.desc || '').trim().slice(0, 500),
      summary: String(data.summary || '').trim().slice(0, 200),
      nsfwLevel,
      safeForWork
    }
  })
}

export const normalizeSearchParams = (raw, ctx = {}) =>
  packOrLegacy('search-parse', raw, ctx, normalizeSearchParamsShape)

export const normalizeCollectionQueryJson = (raw, ctx = {}) =>
  packOrLegacy('collection-query', raw, ctx, normalizeCollectionQueryShape)

/** 按簇 id 单独命名，resourceIds 严格来自对应候选（禁止跨簇合并） */
export const normalizeCollectionNamingPlan = (
  raw,
  candidates,
  targetCount,
  minItems = 3,
  locale = 'enUS',
  ctx = {}
) => {
  const packCtx = {
    ...ctx,
    candidates,
    targetCount,
    minItems,
    locale,
    outputLocale: locale
  }
  if (isSkillPackAvailable('collection-naming')) {
    return applyPackPipeline('collection-naming', raw, packCtx).data
  }
  return hookCollectionNamingPlan(raw, packCtx)
}

/** 带 pack 元数据的 normalize（供分析入库） */
export const normalizeAnalysisResultWithMeta = (raw, ctx = {}) => {
  const packId = ctx.packId || 'image-analysis'
  if (isSkillPackAvailable(packId)) {
    const result = applyPackPipeline(packId, raw, ctx)
    return { data: result.data, meta: result }
  }
  return {
    data: normalizeAnalysisResult(raw, ctx),
    meta: { packId, packVersion: 'legacy', normalizeVersion: 'legacy', profile: ctx.profile || 'default' }
  }
}
