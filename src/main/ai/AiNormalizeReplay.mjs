import { normalizeAnalysisResultWithMeta } from './AiResponseParser.mjs'
import { getPackMeta } from './skills/SkillPackLoader.mjs'
import {
  parseAnalysisMeta,
  parseRawLlmJson,
  stringifyAnalysisMeta
} from './normalize/analysisMetaUtils.mjs'

/**
 * 是否应对该行执行 normalize 重放
 * @param {object} row fbw_resource_ai + resourceId
 * @param {object} ctx
 * @param {string} [ctx.profile] 目标 profile
 * @param {boolean} [ctx.force]
 * @param {string} [ctx.reason] profile-change | startup-version-check | manual
 */
export function shouldReplayNormalizeRow(row, ctx = {}) {
  const raw = parseRawLlmJson(row.rawLlmJson)
  if (!raw) return false

  const meta = parseAnalysisMeta(row.analysisMeta)
  const packId = meta.packId || (row.fileType === 'video' ? 'video-poster-analysis' : 'image-analysis')
  const targetProfile = ctx.profile || meta.profile || 'default'

  if (ctx.force) return true
  if (ctx.reason === 'profile-change') return true

  const current = getPackMeta(packId, { profile: targetProfile })
  if (meta.profile !== targetProfile) return true
  if (meta.normalizeVersion !== current.normalizeVersion) return true
  if (meta.packVersion !== current.packVersion) return true

  return false
}

/**
 * 对单条 raw 重放 normalize（不写库）
 * @param {object} raw
 * @param {object} row
 * @param {object} ctx
 */
export function replayNormalizeRaw(raw, row, ctx = {}) {
  const meta = parseAnalysisMeta(row.analysisMeta)
  const packId = meta.packId || (row.fileType === 'video' ? 'video-poster-analysis' : 'image-analysis')
  const profile = ctx.profile || meta.profile || 'default'
  const { data, meta: pipelineMeta } = normalizeAnalysisResultWithMeta(raw, { packId, profile })

  const outputLocale = meta.outputLocale || ctx.outputLocale || 'enUS'
  const analysisMeta = {
    packId: pipelineMeta.packId || packId,
    packVersion: pipelineMeta.packVersion,
    normalizeVersion: pipelineMeta.normalizeVersion,
    profile,
    outputLocale,
    normalizedAt: new Date().toISOString(),
    replayedFromProfile: meta.profile,
    replayedFromNormalizeVersion: meta.normalizeVersion,
    replayReason: ctx.reason || 'manual'
  }

  return {
    data,
    analysisMeta,
    rawLlmJson: typeof row.rawLlmJson === 'string' ? row.rawLlmJson : JSON.stringify(raw)
  }
}

export { parseAnalysisMeta, parseRawLlmJson, stringifyAnalysisMeta }
