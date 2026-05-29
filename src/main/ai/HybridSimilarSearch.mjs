import {
  SIMILAR_RECALL_K,
  SIMILAR_RRF_K,
  SIMILAR_SESSION_TTL_MS,
  SIMILAR_TEXT_BOOST_WEIGHT,
  SIMILAR_TEXT_MIN_COSINE,
  SIMILAR_VISUAL_MIN_COSINE
} from './aiConstants.mjs'

/**
 * Reciprocal Rank Fusion（保留供测试或其它场景）
 * @param {{ channel: string, hits: { resourceId: number }[] }[]} lists
 * @param {{ rrfK?: number, weights?: Record<string, number> }} opts
 */
export function fuseRRF(lists, opts = {}) {
  const rrfK = opts.rrfK ?? SIMILAR_RRF_K
  const weights = opts.weights || {}
  const scores = new Map()

  for (const { channel, hits } of lists) {
    const w = weights[channel] ?? 1
    for (let i = 0; i < hits.length; i++) {
      const id = Number(hits[i].resourceId)
      if (!Number.isFinite(id) || id <= 0) continue
      scores.set(id, (scores.get(id) || 0) + w / (rrfK + i + 1))
    }
  }

  return [...scores.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([resourceId, score]) => ({ resourceId, score }))
}

const filterByMinSimilarity = (hits, minSim, fallbackCount = 20) => {
  const filtered = hits.filter((h) => (h.similarity ?? 0) >= minSim)
  if (filtered.length) return filtered
  return hits.slice(0, Math.max(1, fallbackCount))
}

export default class HybridSimilarSearch {
  constructor(vecStore, logger) {
    this.vecStore = vecStore
    this.logger = logger
    /** @type {Map<string, { ranked: { resourceId: number, score: number }[], signals: string[], at: number }>} */
    this._cache = new Map()
  }

  _scopeKey(candidateIds) {
    if (!Array.isArray(candidateIds)) return '*'
    return candidateIds
      .map((id) => Number(id))
      .filter((id) => id > 0)
      .sort((a, b) => a - b)
      .join(',')
  }

  cacheKey(resourceId, candidateIds, visualModel) {
    return `${resourceId}:${visualModel || 'builtin'}:${this._scopeKey(candidateIds)}`
  }

  getCached(resourceId, candidateIds, visualModel) {
    const key = this.cacheKey(resourceId, candidateIds, visualModel)
    const entry = this._cache.get(key)
    if (!entry) return null
    if (Date.now() - entry.at > SIMILAR_SESSION_TTL_MS) {
      this._cache.delete(key)
      return null
    }
    return entry
  }

  putCache(resourceId, candidateIds, visualModel, ranked, signals) {
    const key = this.cacheKey(resourceId, candidateIds, visualModel)
    this._cache.set(key, { ranked, signals, at: Date.now() })
  }

  /**
   * 找相似：画面路为主（阈值过滤），文案路仅在同批画面候选内加权，不引入无关图。
   * @param {{
   *   resourceId: number,
   *   visualQuery?: { vec: number[] } | null,
   *   textQuery?: { vec: number[] } | null,
   *   visualModel?: string | null,
   *   candidateIds?: number[] | null,
   *   recallK?: number,
   *   rrfK?: number
   * }} params
   */
  search(params) {
    const {
      resourceId,
      visualQuery,
      textQuery,
      visualModel = null,
      candidateIds = null,
      recallK = SIMILAR_RECALL_K,
      rrfK = SIMILAR_RRF_K
    } = params

    const k = Math.max(1, Math.min(recallK, SIMILAR_RECALL_K))
    let ranked = []
    let signals = []

    const visualHits = visualQuery?.vec?.length
      ? this._recallVisual(visualQuery.vec, resourceId, candidateIds, visualModel, k)
      : []

    if (visualHits.length) {
      const visualCandidates = filterByMinSimilarity(visualHits, SIMILAR_VISUAL_MIN_COSINE)
      const textHits = textQuery?.vec?.length
        ? this._recallText(textQuery.vec, resourceId, candidateIds, k)
        : []
      const textRank = new Map(textHits.map((h, i) => [Number(h.resourceId), i]))

      ranked = visualCandidates
        .map((h, i) => {
          const visualScore = Number(h.similarity ?? 0) || 1 - i * 1e-4
          const tr = textRank.get(Number(h.resourceId))
          const textBoost =
            tr != null ? SIMILAR_TEXT_BOOST_WEIGHT / (rrfK + tr + 1) : 0
          return { resourceId: h.resourceId, score: visualScore + textBoost }
        })
        .sort((a, b) => b.score - a.score)

      signals = textHits.length ? ['visual', 'text_boost'] : ['visual']
    } else if (textQuery?.vec?.length) {
      const textHits = this._recallText(textQuery.vec, resourceId, candidateIds, k)
      const textCandidates = filterByMinSimilarity(textHits, SIMILAR_TEXT_MIN_COSINE, 30)
      ranked = textCandidates.map((h, i) => ({
        resourceId: h.resourceId,
        score: Number(h.similarity ?? 0) || 1 - i * 1e-4
      }))
      signals = ['text']
    }

    this.putCache(resourceId, candidateIds, visualModel, ranked, signals)
    this.logger.info(
      `[HybridSimilarSearch] id=${resourceId} channels=${signals.join('+') || 'none'} hits=${ranked.length}`
    )

    return { ranked, signals }
  }

  _recallVisual(queryVec, excludeId, candidateIds, model, limit) {
    if (Array.isArray(candidateIds) && candidateIds.length) {
      return this.vecStore.recallTopKImageAmongIds(
        queryVec,
        candidateIds,
        excludeId,
        limit,
        model
      )
    }
    return this.vecStore.recallTopKImageGlobal(queryVec, excludeId, limit, model)
  }

  _recallText(queryVec, excludeId, candidateIds, limit) {
    if (Array.isArray(candidateIds) && candidateIds.length) {
      return this.vecStore.recallTopKAmongIds(queryVec, candidateIds, excludeId, limit)
    }
    return this.vecStore.recallTopKGlobal(queryVec, excludeId, limit)
  }

  paginate(ranked, limit, excludeIds = []) {
    const excludeSet = new Set((excludeIds || []).map((id) => Number(id)))
    const filtered = ranked.filter((h) => !excludeSet.has(Number(h.resourceId)))
    const pageSize = Math.max(1, Number(limit) || 20)
    return {
      resourceIds: filtered.slice(0, pageSize).map((h) => h.resourceId),
      total: filtered.length
    }
  }
}
