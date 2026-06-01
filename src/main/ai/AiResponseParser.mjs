import {
  normalizeOrientationToIsLandscape,
  normalizeCollectionQuality,
  normalizeAutoCollectionTitleForLocale,
  resolveAtmosphereFallbackName,
  validateCollectionTitleAgainstHints,
  titleMatchesAppLocale
} from '../store/collectionConstants.mjs'
import { buildAutoCollectionStoragePrompt } from './AiPrompts.mjs'

const clamp = (n, min, max) => Math.min(max, Math.max(min, n))

/** 与 prompt 中 nsfwLevel / safeForWork 联动规则对齐 */
export const applyNsfwConsistency = (obj = {}) => {
  let nsfwLevel = clamp(Math.round(Number(obj.nsfwLevel) || 0), 0, 3)
  let safeForWork = obj.safeForWork !== false

  if (safeForWork === false && nsfwLevel < 2) {
    nsfwLevel = 2
  }
  if (nsfwLevel >= 2) {
    safeForWork = false
  }
  if (nsfwLevel === 0) {
    safeForWork = true
  }
  if (nsfwLevel === 1 && !safeForWork) {
    nsfwLevel = 2
  }

  return { nsfwLevel, safeForWork }
}

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

export const normalizeAnalysisResult = (raw) => {
  const obj = typeof raw === 'object' && raw ? raw : {}
  const tags = Array.isArray(obj.tags)
    ? obj.tags.map((t) => String(t).trim()).filter(Boolean).slice(0, 12)
    : []
  const { nsfwLevel, safeForWork } = applyNsfwConsistency(obj)
  return {
    score: clamp(Math.round(Number(obj.score) || 0), 0, 100),
    tags,
    title: String(obj.title || '').trim().slice(0, 120),
    desc: String(obj.desc || '').trim().slice(0, 500),
    summary: String(obj.summary || '').trim().slice(0, 200),
    nsfwLevel,
    safeForWork
  }
}

export const normalizeSearchParams = (raw) => {
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

export const normalizeCollectionQueryJson = (raw) => {
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

const resolvePlanName = (llmName, hints, locale, candidateId) => {
  const fromLlm = normalizeAutoCollectionTitleForLocale(llmName, locale, '', candidateId)
  if (fromLlm && validateCollectionTitleAgainstHints(fromLlm, hints)) return fromLlm
  return resolveAtmosphereFallbackName(hints, locale)
}

/** 按簇 id 单独命名，resourceIds 严格来自对应候选（禁止跨簇合并） */
export const normalizeCollectionNamingPlan = (
  raw,
  candidates,
  targetCount,
  minItems = 3,
  locale = 'enUS'
) => {
  const candidateMap = new Map(candidates.map((c) => [c.id, c]))
  const list = Array.isArray(raw?.collections) ? raw.collections : []
  const usedIds = new Set()
  const plans = []

  for (const item of list) {
    if (plans.length >= targetCount) break
    const candidateId = String(item.id || '').trim()
    const candidate = candidateMap.get(candidateId)
    if (!candidate || usedIds.has(candidateId)) continue
    if (candidate.resourceIds.length < minItems) continue

    usedIds.add(candidateId)
    const name = resolvePlanName(item.name, candidate.hints, locale, candidateId)
    if (!name || !titleMatchesAppLocale(name, locale)) continue
    plans.push({
      autoKey: candidateId,
      name,
      prompt: String(item.prompt || item.name || name).trim().slice(0, 200),
      semanticQuery: String(
        item.semanticQuery || item.prompt || item.name || candidate.hints?.themeHint || name
      ).trim(),
      tags: candidate.hints?.tags || [],
      mergeIds: [candidateId],
      resourceIds: candidate.resourceIds
    })
  }

  for (const candidate of candidates) {
    if (plans.length >= targetCount) break
    if (usedIds.has(candidate.id)) continue
    if (candidate.resourceIds.length < minItems) continue
    usedIds.add(candidate.id)
    const fallbackName = resolveAtmosphereFallbackName(candidate.hints, locale)
    if (!fallbackName || !titleMatchesAppLocale(fallbackName, locale)) continue
    plans.push({
      autoKey: candidate.id,
      name: fallbackName,
      prompt: buildAutoCollectionStoragePrompt(fallbackName, candidate.hints?.themeHint),
      semanticQuery: String(candidate.hints?.themeHint || fallbackName).trim(),
      tags: candidate.hints?.tags || [],
      mergeIds: [candidate.id],
      resourceIds: candidate.resourceIds
    })
  }

  return plans.slice(0, targetCount)
}
