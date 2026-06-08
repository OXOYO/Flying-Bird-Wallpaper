import {
  normalizeAutoCollectionTitleForLocale,
  resolveAtmosphereFallbackName,
  validateCollectionTitleAgainstHints,
  titleMatchesAppLocale
} from '../../store/collectionConstants.mjs'

const resolvePlanName = (llmName, hints, locale, candidateId) => {
  const fromLlm = normalizeAutoCollectionTitleForLocale(llmName, locale, '', candidateId)
  if (fromLlm && validateCollectionTitleAgainstHints(fromLlm, hints)) return fromLlm
  return resolveAtmosphereFallbackName(hints, locale)
}

/** @param {object} raw LLM JSON */
export function normalizeCollectionNamingPlan(raw, ctx = {}) {
  const candidates = ctx.candidates || []
  const targetCount = ctx.targetCount ?? 20
  const minItems = ctx.minItems ?? 3
  const locale = ctx.locale || ctx.outputLocale || 'enUS'

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
      prompt: String(candidate.hints?.themeHint || fallbackName).trim().slice(0, 200),
      semanticQuery: String(candidate.hints?.themeHint || fallbackName).trim(),
      tags: candidate.hints?.tags || [],
      mergeIds: [candidate.id],
      resourceIds: candidate.resourceIds
    })
  }

  return plans.slice(0, targetCount)
}

/** @type {Record<string, Function>} */
export const NORMALIZE_HOOKS = {
  collectionNamingPlan: normalizeCollectionNamingPlan
}

export function getNormalizeHooks(extra = {}) {
  return { ...NORMALIZE_HOOKS, ...extra }
}

export function registerNormalizeHook(id, fn) {
  NORMALIZE_HOOKS[id] = fn
}
