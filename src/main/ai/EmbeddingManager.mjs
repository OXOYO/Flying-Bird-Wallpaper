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
    if (!this.ai.enableEmbedding || !this.ai.enabled) return { success: false }
    const row = this.db.prepare(`SELECT id, title, desc, summary, fileName FROM fbw_resources WHERE id = ?`).get(
      resourceId
    )
    if (!row) return { success: false, message: 'resource not found' }
    const text = this.buildResourceText(row)
    try {
      const vector = await this.provider.embedText(text)
      if (!vector?.length) return { success: false, message: 'empty embedding' }
      this.vecStore.upsert(resourceId, vector, vector.length)
      if (typeof this.onEmbeddingDone === 'function') {
        setImmediate(() => this.onEmbeddingDone())
      }
      return { success: true, dim: vector.length }
    } catch (err) {
      this.logger.error(`[EmbeddingManager] upsert ${resourceId}: ${err}`)
      return { success: false, message: String(err.message || err) }
    }
  }

  async findSimilar(resourceId, limit = 20) {
    const blob = this.db
      .prepare(`SELECT embedding, dim FROM fbw_resource_vec_blob WHERE resourceId = ?`)
      .get(resourceId)
    if (!blob) {
      await this.upsertForResource(resourceId)
    }
    const row = this.db
      .prepare(`SELECT embedding, dim FROM fbw_resource_vec_blob WHERE resourceId = ?`)
      .get(resourceId)
    if (!row) return []
    const queryVec = this.vecStore.blobToFloat32(row.embedding, row.dim)
    const knn = this.vecStore.knn(queryVec, limit, resourceId)
    return knn.map((x) => x.resourceId)
  }

  async semanticSearch(query, limit = 30) {
    const vector = await this.provider.embedText(query)
    if (!vector?.length) return []
    const knn = this.vecStore.knn(vector, limit)
    return knn.map((x) => x.resourceId)
  }
}
