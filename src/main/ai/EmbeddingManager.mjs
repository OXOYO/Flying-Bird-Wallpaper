import fs from 'node:fs'
import VecStore from './VecStore.mjs'
import AiAnalysisProvider from './AiAnalysisProvider.mjs'
import ImageVisualEmbedder from './ImageVisualEmbedder.mjs'
import HybridSimilarSearch from './HybridSimilarSearch.mjs'
import VisualCollectionSearch from './VisualCollectionSearch.mjs'
import {
  VISUAL_EMBED_MODEL_ID,
  VISUAL_EMBED_SOURCES,
  SIMILAR_RECALL_K,
  SEMANTIC_SEARCH_MIN_COSINE,
  VISUAL_EMBED_BACKFILL_BATCH_BUILTIN,
  VISUAL_EMBED_BACKFILL_BATCH_REMOTE,
  VISUAL_EMBED_REMOTE_BATCH_PAUSE_MS
} from './aiConstants.mjs'
import { EMBED_INPUT_TYPE, isAsymmetricEmbedModel, supportsImageAsQuery } from './AsymmetricEmbedUtils.mjs'
import { buildAnalyzableResourceWhere, resolveVisionImagePath } from './AiVisionResourcePath.mjs'

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
    this.hybridSimilar = new HybridSimilarSearch(this.vecStore, logger)
    this.visualCollectionSearch = new VisualCollectionSearch(
      this.vecStore,
      this.provider,
      logger,
      () => this.ai,
      () => this.getActiveVisualModelId(),
      () => this.usesRemoteVisualEmbed()
    )
    this.onEmbeddingDone = null
    this.onVisualEmbeddingDone = null
    this._visualBackfillRunning = false
    EmbeddingManager._instance = this
  }

  get ai() {
    return this.settingManager.settingData?.ai || {}
  }

  usesRemoteVisualEmbed() {
    const ai = this.ai
    return (
      String(ai.visualEmbedSource || VISUAL_EMBED_SOURCES.BUILTIN).toLowerCase() ===
        VISUAL_EMBED_SOURCES.REMOTE &&
      !!String(ai.visualEmbedModel || '').trim()
    )
  }

  getActiveVisualModelId() {
    if (this.usesRemoteVisualEmbed()) {
      return String(this.ai.visualEmbedModel).trim()
    }
    return VISUAL_EMBED_MODEL_ID
  }

  buildResourceText(row, resourceId = row?.id) {
    const parts = [
      row.aiTitle || row.title,
      row.aiDesc || row.desc,
      row.summary,
      row.fileName
    ].filter(Boolean)
    const id = Number(resourceId)
    if (Number.isFinite(id) && id > 0) {
      try {
        const tagRows = this.db
          .prepare(
            `SELECT DISTINCT w.word
             FROM fbw_resource_words rw
             JOIN fbw_words w ON w.id = rw.wordId
             WHERE rw.resourceId = ?
             ORDER BY w.word ASC
             LIMIT 24`
          )
          .all(id)
        const tagText = tagRows.map((r) => r.word).filter(Boolean).join(' ')
        if (tagText) parts.push(tagText)
      } catch {
        /* ignore */
      }
    }
    return parts.join(' ').trim() || row.fileName || 'wallpaper'
  }

  async upsertForResource(resourceId) {
    if (!this.ai.enabled) return { success: false }
    const row = this.db
      .prepare(
        `SELECT r.id, r.title, r.desc, r.fileName,
                COALESCE(ai.summary, '') AS summary,
                COALESCE(ai.aiTitle, '') AS aiTitle,
                COALESCE(ai.aiDesc, '') AS aiDesc
         FROM fbw_resources r
         LEFT JOIN fbw_resource_ai ai ON ai.resourceId = r.id
         WHERE r.id = ?`
      )
      .get(resourceId)
    if (!row) return { success: false, message: 'resource not found' }
    const text = this.buildResourceText(row, resourceId)
    const embedModel = this.ai.embeddingModel || this.ai.textModel || ''
    const modelStartedAt = Date.now()
    try {
      const vector = await this.provider.embedText(text, {
        inputType: EMBED_INPUT_TYPE.PASSAGE
      })
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

  async _upsertBuiltinVisual(resourceId, filePath, modelOverride = null) {
    const vector = await this.visualEmbedder.embedImageFile(filePath)
    if (!vector?.length) return { success: false, message: 'empty visual embedding' }
    const model = modelOverride || VISUAL_EMBED_MODEL_ID
    this.vecStore.upsertImage(resourceId, vector, vector.length, model)
    return { success: true, dim: vector.length, kind: 'visual', model }
  }

  async _upsertRemoteVisual(resourceId, filePath) {
    const model = this.getActiveVisualModelId()
    const vector = await this.provider.embedImageFile(filePath, undefined, {
      inputType: EMBED_INPUT_TYPE.PASSAGE
    })
    if (!vector?.length) return { success: false, message: 'empty remote visual embedding' }
    this.vecStore.upsertImage(resourceId, vector, vector.length, model)
    return { success: true, dim: vector.length, kind: 'visual', model }
  }

  async upsertImageForResource(resourceId) {
    const row = this.db
      .prepare(`SELECT id, filePath, posterPath, fileType FROM fbw_resources WHERE id = ?`)
      .get(resourceId)
    if (!row) return { success: false, message: 'resource not found' }
    const visionPath = resolveVisionImagePath(row)
    if (!visionPath) {
      return { success: false, message: row.fileType === 'video' ? 'no poster' : 'not image' }
    }
    if (!fs.existsSync(visionPath)) {
      return { success: false, message: 'file missing' }
    }

    const modelStartedAt = Date.now()
    const useRemote = this.usesRemoteVisualEmbed()
    try {
      let result
      if (useRemote) {
        try {
          result = await this._upsertRemoteVisual(resourceId, visionPath)
        } catch (remoteErr) {
          this.logger.warn(
            `[EmbeddingManager] remote visual embed failed id=${resourceId}, fallback builtin: ${remoteErr}`
          )
          result = await this._upsertBuiltinVisual(
            resourceId,
            visionPath,
            this.getActiveVisualModelId()
          )
        }
      } else {
        result = await this._upsertBuiltinVisual(resourceId, visionPath)
      }

      if (!result.success) return result

      const modelMs = Date.now() - modelStartedAt
      this.logger.info(
        `[EmbeddingManager] visual embed done id=${resourceId} modelMs=${modelMs}ms dim=${result.dim} model=${result.model}`
      )
      if (typeof this.onVisualEmbeddingDone === 'function') {
        setImmediate(() => this.onVisualEmbeddingDone())
      }
      return result
    } catch (err) {
      const modelMs = Date.now() - modelStartedAt
      this.logger.error(
        `[EmbeddingManager] visual embed failed id=${resourceId} modelMs=${modelMs}ms: ${err}`
      )
      return { success: false, message: String(err.message || err) }
    }
  }

  _getVisualQueryVector(resourceId) {
    const model = this.getActiveVisualModelId()
    let row = this.db
      .prepare(
        `SELECT embedding, dim, model FROM fbw_resource_image_vec_blob WHERE resourceId = ? AND model = ?`
      )
      .get(resourceId, model)
    if (!row) {
      row = this.db
        .prepare(
          `SELECT embedding, dim, model FROM fbw_resource_image_vec_blob WHERE resourceId = ? ORDER BY updated_at DESC LIMIT 1`
        )
        .get(resourceId)
    }
    if (!row) return null
    return {
      vec: this.vecStore.blobToFloat32(row.embedding, row.dim),
      model: row.model || model
    }
  }

  _getTextQueryVector(resourceId) {
    const row = this.db
      .prepare(`SELECT embedding, dim FROM fbw_resource_vec_blob WHERE resourceId = ?`)
      .get(resourceId)
    if (!row) return null
    return { vec: this.vecStore.blobToFloat32(row.embedding, row.dim) }
  }

  async _embedAsymmetricVisualQuery(resourceId) {
    const model = this.getActiveVisualModelId()
    const row = this.db
      .prepare(`SELECT filePath, posterPath, fileType FROM fbw_resources WHERE id = ?`)
      .get(resourceId)
    const visionPath = resolveVisionImagePath(row)
    if (!visionPath || !fs.existsSync(visionPath)) return null
    try {
      const vec = await this.provider.embedImageFile(visionPath, undefined, {
        inputType: EMBED_INPUT_TYPE.QUERY
      })
      if (!vec?.length) return null
      return { vec, model }
    } catch (err) {
      this.logger.warn(
        `[EmbeddingManager] asymmetric visual query embed failed id=${resourceId}: ${err}`
      )
      return null
    }
  }

  async _ensureSimilarQueryVectors(resourceId) {
    const model = this.getActiveVisualModelId()
    const baseUrl = String(this.ai.visualEmbedBaseUrl || '')
    let visual

    const needImageQueryReembed =
      this.usesRemoteVisualEmbed() &&
      isAsymmetricEmbedModel(model) &&
      supportsImageAsQuery(model, baseUrl)

    if (needImageQueryReembed) {
      visual = await this._embedAsymmetricVisualQuery(resourceId)
    } else {
      visual = this._getVisualQueryVector(resourceId)
      if (!visual) {
        await this.upsertImageForResource(resourceId)
        visual = this._getVisualQueryVector(resourceId)
      }
    }

    let text = this._getTextQueryVector(resourceId)
    if (!text && this.ai.enabled) {
      await this.upsertForResource(resourceId)
      text = this._getTextQueryVector(resourceId)
    }

    return { visual, text }
  }

  /**
   * @returns {{ resourceIds: number[], total: number, signals?: string[] }}
   */
  async findSimilar(resourceId, limit = 20, candidateIds = null, excludeIds = []) {
    if (Array.isArray(candidateIds) && candidateIds.length === 0) {
      return { resourceIds: [], total: 0, signals: [] }
    }

    const visualModel = this.getActiveVisualModelId()
    let cached = this.hybridSimilar.getCached(resourceId, candidateIds, visualModel)
    let ranked
    let signals

    if (!cached) {
      const { visual, text } = await this._ensureSimilarQueryVectors(resourceId)
      if (!visual && !text) {
        return { resourceIds: [], total: 0, signals: [], emptyReason: 'no_vectors' }
      }

      const result = this.hybridSimilar.search({
        resourceId,
        visualQuery: visual,
        textQuery: text,
        visualModel,
        candidateIds,
        recallK: SIMILAR_RECALL_K
      })
      cached = { ranked: result.ranked, signals: result.signals }
    }

    ranked = cached.ranked
    signals = cached.signals

    const page = this.hybridSimilar.paginate(ranked, limit, excludeIds)
    return {
      resourceIds: page.resourceIds,
      total: page.total,
      signals: signals || []
    }
  }

  countImageEmbeddings(analyzedOnly = true) {
    const model = this.getActiveVisualModelId()
    if (analyzedOnly) {
      return (
        this.db
          .prepare(
            `SELECT COUNT(*) as c
             FROM fbw_resource_image_vec_blob v
             JOIN fbw_resources r ON r.id = v.resourceId
             INNER JOIN fbw_resource_ai ai ON ai.resourceId = r.id
             WHERE r.fileType IN ('image', 'video') AND ai.aiAnalysisStatus = 'done' AND v.model = ?`
          )
          .get(model)?.c || 0
      )
    }
    return (
      this.db
        .prepare(`SELECT COUNT(*) as c FROM fbw_resource_image_vec_blob WHERE model = ?`)
        .get(model)?.c || 0
    )
  }

  /**
   * 合集生成：自然语言 → 画面向量 KNN
   * @returns {Promise<number[]>}
   */
  async visualSearchByQuery(query, options = {}) {
    return this.visualCollectionSearch.searchByQuery(query, {
      ...options,
      semanticSearchFn: (q, limit) => this.semanticSearch(q, limit)
    })
  }

  /**
   * 按余弦阈值召回文本语义命中（相似度降序）
   * @returns {{ hits: { resourceId: number, similarity: number }[], resourceIds: number[], total: number }}
   */
  async semanticSearchRanked(query, options = {}) {
    const minSimilarity =
      options.minSimilarity != null ? options.minSimilarity : SEMANTIC_SEARCH_MIN_COSINE
    const maxResults =
      options.maxResults != null && options.maxResults > 0 ? Number(options.maxResults) : null
    const vector = await this.provider.embedText(query, {
      inputType: EMBED_INPUT_TYPE.QUERY
    })
    if (!vector?.length) {
      return { hits: [], resourceIds: [], total: 0 }
    }
    const ranked = this.vecStore.rankSimilarGlobal(vector, null, minSimilarity)
    const hits = maxResults != null ? ranked.slice(0, maxResults) : ranked
    return {
      hits,
      resourceIds: hits.map((h) => h.resourceId),
      total: hits.length
    }
  }

  /** 合集种子等场景：取 Top-N，不设相似度下限 */
  async semanticSearch(query, limit = 30) {
    const { resourceIds } = await this.semanticSearchRanked(query, {
      minSimilarity: 0,
      maxResults: limit
    })
    return resourceIds
  }

  /**
   * 后台补算尚未生成视觉向量的图片（按当前 active visual model）
   */
  _fetchVisualBackfillBatch(activeModel, limit) {
    const analyzable = buildAnalyzableResourceWhere('r')
    return this.db
      .prepare(
        `SELECT r.id
         FROM fbw_resources r
         WHERE ${analyzable}
           AND NOT EXISTS (
             SELECT 1 FROM fbw_resource_image_vec_blob v
             WHERE v.resourceId = r.id AND v.model = ?
           )
         ORDER BY r.id ASC
         LIMIT ?`
      )
      .all(activeModel, limit)
  }

  _scheduleVisualPumpContinue(locks) {
    setImmediate(() => {
      if (!this.ai.enabled) return
      if (locks.visualEmbed) return
      const activeModel = this.getActiveVisualModelId()
      const pending = this._fetchVisualBackfillBatch(activeModel, 1)
      if (!pending.length) return
      this.pumpVisualEmbedBackfill(locks)
    })
  }

  /**
   * 画面向量补算：内置连续大批次；远程小批次并短暂让出 GPU。
   */
  pumpVisualEmbedBackfill(locks) {
    if (!this.ai.enabled) return
    if (locks.visualEmbed) return
    locks.visualEmbed = true
    this._visualBackfillRunning = true

    const remote = this.usesRemoteVisualEmbed()
    const batchSize = remote
      ? VISUAL_EMBED_BACKFILL_BATCH_REMOTE
      : VISUAL_EMBED_BACKFILL_BATCH_BUILTIN
    const activeModel = this.getActiveVisualModelId()

    const run = async () => {
      try {
        while (true) {
          if (!this.ai.enabled) break
          const list = this._fetchVisualBackfillBatch(activeModel, batchSize)
          if (!list.length) break

          const startedAt = Date.now()
          for (const row of list) {
            await this.upsertImageForResource(row.id)
          }
          this.logger.info(
            `[EmbeddingManager] visual backfill batch=${list.length} remote=${remote} model=${activeModel} ms=${Date.now() - startedAt}`
          )

          if (remote) {
            await new Promise((r) => setTimeout(r, VISUAL_EMBED_REMOTE_BATCH_PAUSE_MS))
          }
        }
      } catch (err) {
        this.logger.warn(`[EmbeddingManager] visual backfill pump: ${err}`)
      } finally {
        locks.visualEmbed = false
        this._visualBackfillRunning = false
        this._scheduleVisualPumpContinue(locks)
      }
    }

    run().catch((err) => {
      this.logger.warn(`[EmbeddingManager] visual backfill pump fatal: ${err}`)
      locks.visualEmbed = false
      this._visualBackfillRunning = false
      this._scheduleVisualPumpContinue(locks)
    })
  }

  /** @deprecated 请使用 pumpVisualEmbedBackfill */
  intervalVisualEmbed(locks) {
    this.pumpVisualEmbedBackfill(locks)
  }
}
