import fs from 'node:fs'
import VecStore from './VecStore.mjs'
import AiAnalysisProvider from './AiAnalysisProvider.mjs'
import ImageVisualEmbedder from './ImageVisualEmbedder.mjs'
import { VISUAL_EMBED_MODEL_ID } from './aiConstants.mjs'

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
    this.visualEmbedder = ImageVisualEmbedder.getInstance(logger)
    this.onEmbeddingDone = null
    this.onVisualEmbeddingDone = null
    this._visualBackfillPage = 1
    EmbeddingManager._instance = this
  }

  get ai() {
    return this.settingManager.settingData?.ai || {}
  }

  isVisualEmbedEnabled() {
    return this.ai.visualEmbedEnabled !== false
  }

  getFindSimilarMode() {
    const mode = String(this.ai.findSimilarMode || 'visual').toLowerCase()
    return mode === 'text' ? 'text' : 'visual'
  }

  buildResourceText(row) {
    const parts = [row.title, row.desc, row.summary, row.fileName].filter(Boolean)
    return parts.join(' ').trim() || row.fileName || 'wallpaper'
  }

  getSimilarMinCosine() {
    const v = Number(this.ai.similarMinCosine)
    if (!Number.isFinite(v)) return 0.62
    return Math.min(1, Math.max(0, v))
  }

  getSimilarMinCosineVisual() {
    const v = Number(this.ai.similarMinCosineVisual)
    if (!Number.isFinite(v)) return 0.72
    return Math.min(1, Math.max(0, v))
  }

  async upsertForResource(resourceId) {
    if (!this.ai.enabled) return { success: false }
    const row = this.db
      .prepare(`SELECT id, title, desc, summary, fileName FROM fbw_resources WHERE id = ?`)
      .get(resourceId)
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
        `[EmbeddingManager] text embed done id=${resourceId} modelMs=${modelMs}ms dim=${vector.length} model=${embedModel}`
      )
      if (typeof this.onEmbeddingDone === 'function') {
        setImmediate(() => this.onEmbeddingDone())
      }
      return { success: true, dim: vector.length, kind: 'text' }
    } catch (err) {
      const modelMs = Date.now() - modelStartedAt
      this.logger.error(
        `[EmbeddingManager] text embed failed id=${resourceId} modelMs=${modelMs}ms model=${embedModel}: ${err}`
      )
      return { success: false, message: String(err.message || err) }
    }
  }

  async upsertImageForResource(resourceId) {
    if (!this.isVisualEmbedEnabled()) return { success: false, message: 'visual embed disabled' }
    if (!this.visualEmbedder.isModelPresent()) {
      return { success: false, message: 'visual model missing' }
    }

    const row = this.db
      .prepare(`SELECT id, filePath, fileType FROM fbw_resources WHERE id = ?`)
      .get(resourceId)
    if (!row) return { success: false, message: 'resource not found' }
    if (row.fileType !== 'image') return { success: false, message: 'not image' }
    if (!row.filePath || !fs.existsSync(row.filePath)) {
      return { success: false, message: 'file missing' }
    }

    const modelStartedAt = Date.now()
    try {
      const vector = await this.visualEmbedder.embedImageFile(row.filePath)
      const modelMs = Date.now() - modelStartedAt
      if (!vector?.length) return { success: false, message: 'empty visual embedding' }
      this.vecStore.upsertImage(resourceId, vector, vector.length, VISUAL_EMBED_MODEL_ID)
      this.logger.info(
        `[EmbeddingManager] visual embed done id=${resourceId} modelMs=${modelMs}ms dim=${vector.length} model=${VISUAL_EMBED_MODEL_ID}`
      )
      if (typeof this.onVisualEmbeddingDone === 'function') {
        setImmediate(() => this.onVisualEmbeddingDone())
      }
      return { success: true, dim: vector.length, kind: 'visual' }
    } catch (err) {
      const modelMs = Date.now() - modelStartedAt
      this.logger.error(
        `[EmbeddingManager] visual embed failed id=${resourceId} modelMs=${modelMs}ms: ${err}`
      )
      return { success: false, message: String(err.message || err) }
    }
  }

  _getQueryVectorForSimilar(resourceId, mode) {
    if (mode === 'visual') {
      const row = this.vecStore.getImageVectorRow(resourceId)
      if (!row) return null
      return {
        vec: this.vecStore.blobToFloat32(row.embedding, row.dim),
        minSimilarity: this.getSimilarMinCosineVisual()
      }
    }
    const row = this.db
      .prepare(`SELECT embedding, dim FROM fbw_resource_vec_blob WHERE resourceId = ?`)
      .get(resourceId)
    if (!row) return null
    return {
      vec: this.vecStore.blobToFloat32(row.embedding, row.dim),
      minSimilarity: this.getSimilarMinCosine()
    }
  }

  async _ensureQueryVector(resourceId, mode) {
    let pack = this._getQueryVectorForSimilar(resourceId, mode)
    if (pack) return pack

    if (mode === 'visual') {
      await this.upsertImageForResource(resourceId)
    } else if (this.ai.enabled) {
      await this.upsertForResource(resourceId)
    }
    return this._getQueryVectorForSimilar(resourceId, mode)
  }

  /**
   * @returns {{ resourceIds: number[], total: number }}
   */
  async findSimilar(resourceId, limit = 20, candidateIds = null, excludeIds = []) {
    let mode = this.getFindSimilarMode()
    let pack = await this._ensureQueryVector(resourceId, mode)

    if (!pack && mode === 'visual') {
      mode = 'text'
      pack = await this._ensureQueryVector(resourceId, mode)
    }
    if (!pack) return { resourceIds: [], total: 0 }

    if (Array.isArray(candidateIds) && candidateIds.length === 0) {
      return { resourceIds: [], total: 0 }
    }

    const queryVec = pack.vec
    const excludeSet = new Set((excludeIds || []).map((id) => Number(id)))
    const minSimilarity = pack.minSimilarity
    const pageSize = Math.max(1, Number(limit) || 20)

    let ranked
    const useVisual = mode === 'visual'
    if (Array.isArray(candidateIds) && candidateIds.length) {
      ranked = useVisual
        ? this.vecStore.rankSimilarAmongImageIds(
            queryVec,
            candidateIds,
            resourceId,
            minSimilarity
          )
        : this.vecStore.rankSimilarAmongIds(queryVec, candidateIds, resourceId, minSimilarity)
    } else {
      ranked = useVisual
        ? this.vecStore.rankSimilarGlobalImage(queryVec, resourceId, minSimilarity)
        : this.vecStore.rankSimilarGlobal(queryVec, resourceId, minSimilarity)
    }

    const total = ranked.length
    const resourceIds = ranked
      .filter((hit) => !excludeSet.has(Number(hit.resourceId)))
      .slice(0, pageSize)
      .map((hit) => hit.resourceId)

    return { resourceIds, total, mode }
  }

  async semanticSearch(query, limit = 30) {
    const vector = await this.provider.embedText(query)
    if (!vector?.length) return []
    const knn = this.vecStore.knn(vector, limit)
    return knn.map((x) => x.resourceId)
  }

  /**
   * 后台补算尚未生成视觉向量的图片
   */
  async intervalVisualEmbed(locks) {
    if (!this.isVisualEmbedEnabled()) return
    if (!this.visualEmbedder.isModelPresent()) return
    if (locks.visualEmbed) return
    locks.visualEmbed = true

    const pageSize = 4
    try {
      const list = this.db
        .prepare(
          `SELECT r.id
           FROM fbw_resources r
           WHERE r.fileType = 'image'
             AND r.filePath IS NOT NULL AND r.filePath != ''
             AND NOT EXISTS (
               SELECT 1 FROM fbw_resource_image_vec_blob v WHERE v.resourceId = r.id
             )
           ORDER BY r.id DESC
           LIMIT ? OFFSET ?`
        )
        .all(pageSize, (this._visualBackfillPage - 1) * pageSize)

      if (!list.length) {
        this._visualBackfillPage = 1
        return
      }

      if (list.length < pageSize) {
        this._visualBackfillPage = 1
      } else {
        this._visualBackfillPage += 1
      }

      for (const row of list) {
        await this.upsertImageForResource(row.id)
      }
    } catch (err) {
      this.logger.warn(`[EmbeddingManager] visual backfill: ${err}`)
    } finally {
      locks.visualEmbed = false
    }
  }
}
