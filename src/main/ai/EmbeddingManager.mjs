import VecStore from './VecStore.mjs'
import AiAnalysisProvider from './AiAnalysisProvider.mjs'

export default class EmbeddingManager {
  static _instance = null

  static getInstance(logger, db, settingManager) {
    if (!EmbeddingManager._instance) {
      EmbeddingManager._instance = new EmbeddingManager(logger, db, settingManager)
    }
    return EmbeddingManager._instance
  }

  constructor(logger, db, settingManager) {
    if (EmbeddingManager._instance) return EmbeddingManager._instance
    this.logger = logger
    this.db = db
    this.settingManager = settingManager
    this.vecStore = VecStore.getInstance(logger, db)
    this.provider = AiAnalysisProvider.getInstance(logger, settingManager)
    this.onEmbeddingDone = null
    EmbeddingManager._instance = this
  }

  get ai() {
    return this.settingManager.settingData?.ai || {}
  }

  buildResourceText(row) {
    const parts = [row.title, row.desc, row.summary, row.fileName].filter(Boolean)
    return parts.join(' ').trim() || row.fileName || 'wallpaper'
  }

  async upsertForResource(resourceId) {
    if (!this.ai.enabled) return { success: false }
    const row = this.db.prepare(`SELECT id, title, desc, summary, fileName FROM fbw_resources WHERE id = ?`).get(
      resourceId
    )
    if (!row) return { success: false, message: 'resource not found' }
    const text = this.buildResourceText(row)
    const embedModel = this.ai.embeddingModel || this.ai.textModel || ''
    const modelStartedAt = Date.now()
    try {
      const vector = await this.provider.embedText(text)
      const modelMs = Date.now() - modelStartedAt
      if (!vector?.length) return { success: false, message: 'empty embedding' }
      this.vecStore.upsert(resourceId, vector, vector.length)
      this.logger.info(
        `[EmbeddingManager] embed done id=${resourceId} modelMs=${modelMs}ms dim=${vector.length} model=${embedModel}`
      )
      if (typeof this.onEmbeddingDone === 'function') {
        setImmediate(() => this.onEmbeddingDone())
      }
      return { success: true, dim: vector.length }
    } catch (err) {
      const modelMs = Date.now() - modelStartedAt
      this.logger.error(
        `[EmbeddingManager] embed failed id=${resourceId} modelMs=${modelMs}ms model=${embedModel}: ${err}`
      )
      return { success: false, message: String(err.message || err) }
    }
  }

  getSimilarMinCosine() {
    const v = Number(this.ai.similarMinCosine)
    if (!Number.isFinite(v)) return 0.62
    return Math.min(1, Math.max(0, v))
  }

  /**
   * @returns {{ resourceIds: number[], total: number }}
   */
  async findSimilar(resourceId, limit = 20, candidateIds = null, excludeIds = []) {
    const blob = this.db
      .prepare(`SELECT embedding, dim FROM fbw_resource_vec_blob WHERE resourceId = ?`)
      .get(resourceId)
    if (!blob) {
      await this.upsertForResource(resourceId)
    }
    const row = this.db
      .prepare(`SELECT embedding, dim FROM fbw_resource_vec_blob WHERE resourceId = ?`)
      .get(resourceId)
    if (!row) return { resourceIds: [], total: 0 }

    if (Array.isArray(candidateIds) && candidateIds.length === 0) {
      return { resourceIds: [], total: 0 }
    }

    const queryVec = this.vecStore.blobToFloat32(row.embedding, row.dim)
    const excludeSet = new Set((excludeIds || []).map((id) => Number(id)))
    const minSimilarity = this.getSimilarMinCosine()
    const pageSize = Math.max(1, Number(limit) || 20)

    let ranked
    if (Array.isArray(candidateIds) && candidateIds.length) {
      ranked = this.vecStore.rankSimilarAmongIds(
        queryVec,
        candidateIds,
        resourceId,
        minSimilarity
      )
    } else {
      ranked = this.vecStore.rankSimilarGlobal(queryVec, resourceId, minSimilarity)
    }

    const total = ranked.length
    const resourceIds = ranked
      .filter((hit) => !excludeSet.has(Number(hit.resourceId)))
      .slice(0, pageSize)
      .map((hit) => hit.resourceId)

    return { resourceIds, total }
  }

  async semanticSearch(query, limit = 30) {
    const vector = await this.provider.embedText(query)
    if (!vector?.length) return []
    const knn = this.vecStore.knn(vector, limit)
    return knn.map((x) => x.resourceId)
  }
}
