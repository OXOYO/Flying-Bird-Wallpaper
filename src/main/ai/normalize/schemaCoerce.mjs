import {
  normalizeCollectionQuality,
  normalizeOrientationToIsLandscape
} from '../../store/collectionConstants.mjs'

const clamp = (n, min, max) => Math.min(max, Math.max(min, n))

/**
 * 轻量 schema 约束（无 AJV 依赖）：按 schema.properties 做类型/边界/截断
 * @param {object} obj
 * @param {object} schema JSON Schema subset
 */
export function coerceBySchema(obj, schema = {}) {
  const props = schema.properties || {}
  const out = { ...obj }

  for (const [key, rule] of Object.entries(props)) {
    if (!(key in out)) continue
    let val = out[key]

    if (rule.type === 'integer' || rule.type === 'number') {
      val = Number(val)
      if (!Number.isFinite(val)) {
        delete out[key]
        continue
      }
      if (rule.type === 'integer') val = Math.round(val)
      if (rule.minimum != null) val = Math.max(val, rule.minimum)
      if (rule.maximum != null) val = Math.min(val, rule.maximum)
      out[key] = val
      continue
    }

    if (rule.type === 'boolean') {
      out[key] = val !== false
      continue
    }

    if (rule.type === 'string') {
      val = String(val ?? '').trim()
      if (rule.maxLength != null) val = val.slice(0, rule.maxLength)
      out[key] = val
      continue
    }

    if (rule.type === 'array' && Array.isArray(val)) {
      let arr = val.map((item) => {
        const itemRule = rule.items || {}
        if (itemRule.type === 'string') {
          let s = String(item ?? '').trim()
          if (itemRule.maxLength != null) s = s.slice(0, itemRule.maxLength)
          return s
        }
        return item
      })
      arr = arr.filter((x) => x != null && String(x).trim() !== '')
      if (rule.maxItems != null) arr = arr.slice(0, rule.maxItems)
      out[key] = arr
    }
  }

  return out
}

/**
 * analysis-result 管线：与 legacy normalizeAnalysisResult 对齐
 * @param {object} raw
 * @param {object} schema
 */
export function normalizeAnalysisResultShape(raw, schema) {
  const obj = typeof raw === 'object' && raw ? { ...raw } : {}
  let draft = coerceBySchema(obj, schema)

  const tags = Array.isArray(draft.tags)
    ? draft.tags.map((t) => String(t).trim()).filter(Boolean).slice(0, 12)
    : []

  draft = {
    ...draft,
    score: clamp(Math.round(Number(draft.score) || 0), 0, 100),
    tags,
    title: String(draft.title || '').trim().slice(0, 120),
    desc: String(draft.desc || '').trim().slice(0, 500),
    summary: String(draft.summary || '').trim().slice(0, 200)
  }

  return draft
}

/** search-parse 管线 */
export function normalizeSearchParamsShape(raw) {
  const obj = typeof raw === 'object' && raw ? raw : {}
  const typeRaw = String(obj.filterType ?? obj.fileType ?? '')
    .trim()
    .toLowerCase()
  let filterType = ''
  if (typeRaw === 'videos' || typeRaw === 'video') filterType = 'videos'
  else if (typeRaw === 'images' || typeRaw === 'image') filterType = 'images'

  return {
    filterKeywords: String(obj.filterKeywords || '').trim(),
    tags: Array.isArray(obj.tags) ? obj.tags.map(String) : [],
    orientation: normalizeOrientationToIsLandscape(obj.orientation),
    quality: normalizeCollectionQuality(obj.quality),
    scoreMin: obj.scoreMin != null ? clamp(Number(obj.scoreMin), 0, 100) : null,
    scoreMax: obj.scoreMax != null ? clamp(Number(obj.scoreMax), 0, 100) : null,
    filterType
  }
}

/** collection-query 管线 */
export function normalizeCollectionQueryShape(raw) {
  const obj = typeof raw === 'object' && raw ? raw : {}
  const limit = clamp(Math.round(Number(obj.limitCount) || 20), 5, 50)
  return {
    filterKeywords: String(obj.filterKeywords || '').trim(),
    tags: Array.isArray(obj.tags) ? obj.tags.map(String) : [],
    tagsMode: obj.tagsMode === 'all' ? 'all' : 'any',
    orientation: [],
    quality: normalizeCollectionQuality(obj.quality),
    scoreMin: null,
    scoreMax: obj.scoreMax != null ? clamp(Number(obj.scoreMax), 0, 100) : null,
    resourceName: 'resources',
    isRandom: !!obj.isRandom,
    sortField: String(obj.sortField || 'score'),
    sortType: Number(obj.sortType) > 0 ? 1 : -1,
    semanticQuery: String(obj.semanticQuery || obj.filterKeywords || '').trim(),
    useSemantic: !!obj.useSemantic,
    limitCount: limit
  }
}

/** keyword-expand / collection-tag-expand */
export function normalizeStringListField(raw, fieldName, maxItems = 10) {
  const obj = typeof raw === 'object' && raw ? raw : {}
  const list = Array.isArray(obj[fieldName])
    ? obj[fieldName].map((x) => String(x).trim()).filter(Boolean)
    : []
  return { [fieldName]: list.slice(0, maxItems) }
}

export { clamp }
