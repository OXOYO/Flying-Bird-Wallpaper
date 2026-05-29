import { EMBED_INPUT_TYPE } from './AsymmetricEmbedUtils.mjs'
import {
  COLLECTION_VISUAL_SEARCH_MIN_COSINE,
  COLLECTION_VISUAL_SEED_COUNT
} from './aiConstants.mjs'

/**
 * 合集画面语义检索：远程多模态 embed 直查；内置模型则文本种子 → 画面质心 → KNN
 */
export default class VisualCollectionSearch {
  constructor(vecStore, provider, logger, getAi, getActiveVisualModelId, usesRemoteVisualEmbed) {
    this.vecStore = vecStore
    this.provider = provider
    this.logger = logger
    this.getAi = getAi
    this.getActiveVisualModelId = getActiveVisualModelId
    this.usesRemoteVisualEmbed = usesRemoteVisualEmbed
  }

  _computeVisualCentroid(resourceIds, model) {
    if (!resourceIds?.length) return null
    const stmt = this.vecStore.db.prepare(
      `SELECT embedding, dim FROM fbw_resource_image_vec_blob WHERE resourceId = ? AND model = ?`
    )
    const vecs = []
    for (const id of resourceIds) {
      const row = stmt.get(id, model)
      if (!row) continue
      vecs.push(this.vecStore.blobToFloat32(row.embedding, row.dim))
    }
    if (!vecs.length) return null

    const dim = vecs[0].length
    const sum = new Float32Array(dim)
    for (const vec of vecs) {
      for (let i = 0; i < dim; i++) sum[i] += vec[i]
    }
    const n = vecs.length
    for (let i = 0; i < dim; i++) sum[i] /= n

    let norm = 0
    for (let i = 0; i < dim; i++) norm += sum[i] * sum[i]
    norm = Math.sqrt(norm) || 1
    const out = new Array(dim)
    for (let i = 0; i < dim; i++) out[i] = sum[i] / norm
    return out
  }

  async _embedVisualQueryText(query) {
    if (!this.usesRemoteVisualEmbed()) return null
    try {
      const ai = this.getAi()
      const model = this.getActiveVisualModelId()
      const embedProvider = this.provider.createProvider('visualEmbed', ai)
      if (typeof embedProvider.embed !== 'function') return null
      const vec = await embedProvider.embed(String(query).trim(), model, {
        inputType: EMBED_INPUT_TYPE.QUERY
      })
      return vec?.length ? vec : null
    } catch (err) {
      this.logger.warn(`[VisualCollectionSearch] remote visual query embed failed: ${err.message}`)
      return null
    }
  }

  async _visualQueryFromTextSeeds(query, semanticSearchFn, model) {
    if (!this.getAi()?.enabled || typeof semanticSearchFn !== 'function') return null
    try {
      const seedIds = await semanticSearchFn(query, COLLECTION_VISUAL_SEED_COUNT)
      if (!seedIds?.length) return null
      return this._computeVisualCentroid(seedIds, model)
    } catch (err) {
      this.logger.warn(`[VisualCollectionSearch] seed centroid failed: ${err.message}`)
      return null
    }
  }

  /**
   * @param {string} query
   * @param {{ limit?: number, candidateIds?: number[]|null, minSimilarity?: number, semanticSearchFn?: Function }} options
   * @returns {Promise<number[]>}
   */
  async searchByQuery(query, options = {}) {
    const q = String(query || '').trim()
    if (!q) return []

    const {
      limit = 30,
      candidateIds = null,
      minSimilarity = COLLECTION_VISUAL_SEARCH_MIN_COSINE,
      semanticSearchFn
    } = options

    const model = this.getActiveVisualModelId()
    const seedFn =
      candidateIds?.length && typeof semanticSearchFn === 'function'
        ? async (queryText, seedLimit) => {
            const ids = await semanticSearchFn(queryText, seedLimit * 3)
            const allowed = new Set(candidateIds)
            return ids.filter((id) => allowed.has(id)).slice(0, seedLimit)
          }
        : semanticSearchFn

    let queryVec = await this._embedVisualQueryText(q)
    if (!queryVec?.length) {
      queryVec = await this._visualQueryFromTextSeeds(q, seedFn, model)
    }
    if (!queryVec?.length) return []

    const recallK = Math.max(limit * 3, 60)
    const hits = candidateIds?.length
      ? this.vecStore.recallTopKImageAmongIds(queryVec, candidateIds, null, recallK, model)
      : this.vecStore.recallTopKImageGlobal(queryVec, null, recallK, model)

    return hits
      .filter((h) => h.similarity >= minSimilarity)
      .slice(0, limit)
      .map((h) => h.resourceId)
  }
}
