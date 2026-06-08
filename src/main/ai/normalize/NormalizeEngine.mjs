import { applyRepairGroups } from './repairEngine.mjs'
import {
  coerceBySchema,
  normalizeAnalysisResultShape,
  normalizeCollectionQueryShape,
  normalizeSearchParamsShape,
  normalizeStringListField
} from './schemaCoerce.mjs'
import { getNormalizeHooks, registerNormalizeHook } from './normalizeHooks.mjs'
import {
  getPackMeta,
  loadPackNormalize,
  loadPackSchema
} from '../skills/SkillPackLoader.mjs'

/**
 * @param {object} raw
 * @param {object} normalizeConfig
 * @param {object} schema
 * @param {object} [ctx]
 */
function applyNormalizeConfig(raw, normalizeConfig, schema, ctx = {}) {
  const obj = typeof raw === 'object' && raw ? { ...raw } : {}

  const ignore = normalizeConfig.ignoreFromModel || []
  for (const key of ignore) {
    delete obj[key]
  }

  const defaults = normalizeConfig.defaults || {}
  for (const [key, val] of Object.entries(defaults)) {
    if (normalizeConfig.defaultsMode === 'force' || obj[key] == null || obj[key] === '') {
      obj[key] = val
    }
  }

  const pipeline = normalizeConfig.pipeline || 'generic'

  if (pipeline === 'analysis-result') {
    let draft = normalizeAnalysisResultShape(obj, schema)
    applyRepairGroups(draft, normalizeConfig.repairs || [])
    draft = coerceBySchema(draft, schema)

    const nsfwLevel = draft.nsfwLevel
    const safeForWork = draft.safeForWork
    return {
      score: draft.score,
      tags: draft.tags,
      title: draft.title,
      desc: draft.desc,
      summary: draft.summary,
      nsfwLevel,
      safeForWork
    }
  }

  if (pipeline === 'search-params') {
    let draft = normalizeSearchParamsShape(obj)
    applyRepairGroups(draft, normalizeConfig.repairs || [])
    return draft
  }

  if (pipeline === 'collection-query') {
    let draft = normalizeCollectionQueryShape(obj)
    applyRepairGroups(draft, normalizeConfig.repairs || [])
    return draft
  }

  if (pipeline === 'keywords-list') {
    const field = normalizeConfig.listField || 'keywords'
    const maxItems = normalizeConfig.maxItems ?? 10
    return normalizeStringListField(obj, field, maxItems)
  }

  if (pipeline === 'tags-list') {
    const maxItems = normalizeConfig.maxItems ?? 8
    return normalizeStringListField(obj, 'tags', maxItems)
  }

  if (pipeline === 'collection-naming-plan') {
    const hooks = getNormalizeHooks(ctx.hooks)
    for (const hookId of normalizeConfig.hooks || ['collectionNamingPlan']) {
      const hook = hooks[hookId]
      if (typeof hook === 'function') {
        return hook(obj, ctx)
      }
    }
    return []
  }

  if (pipeline === 'storage-prompt') {
    const detail = String(obj.detail ?? obj.name ?? '').trim()
    const maxLen = normalizeConfig.maxLength ?? 200
    if (!detail) return String(obj.name || '').trim().slice(0, maxLen)
    return detail.slice(0, maxLen)
  }

  let draft = coerceBySchema(obj, schema)
  applyRepairGroups(draft, normalizeConfig.repairs || [])

  const hookIds = normalizeConfig.hooks || []
  const hooks = getNormalizeHooks(ctx.hooks)
  for (const hookId of hookIds) {
    const hook = hooks[hookId]
    if (typeof hook === 'function') {
      draft = hook(draft, ctx) ?? draft
    }
  }

  return draft
}

/**
 * @param {string} packId
 * @param {object} raw
 * @param {object} [ctx]
 */
export function validatePackOutput(packId, raw, ctx = {}) {
  const schema = loadPackSchema(packId)
  const coerced = coerceBySchema(typeof raw === 'object' && raw ? raw : {}, schema)
  return { ok: true, data: coerced, schema }
}

/**
 * @param {string} packId
 * @param {object} raw
 * @param {object} [ctx]
 */
export function normalizePackOutput(packId, raw, ctx = {}) {
  const normalizeConfig = loadPackNormalize(packId, ctx)
  const schema = loadPackSchema(packId)
  const data = applyNormalizeConfig(raw, normalizeConfig, schema, ctx)
  const meta = getPackMeta(packId, ctx)
  return {
    ok: true,
    data,
    packId,
    packVersion: meta.packVersion,
    normalizeVersion: meta.normalizeVersion,
    profile: meta.profile
  }
}

/**
 * @param {string} packId
 * @param {object} raw
 * @param {object} [ctx]
 */
export function applyPackPipeline(packId, raw, ctx = {}) {
  return normalizePackOutput(packId, raw, ctx)
}

export { registerNormalizeHook }
