import fs from 'node:fs'
import path from 'node:path'
import AiAnalysisProvider from './AiAnalysisProvider.mjs'
import EmbeddingManager from './EmbeddingManager.mjs'
import { AI_ANALYSIS_STATUS } from './aiConstants.mjs'
import { t } from '../../i18n/server.js'

export default class AiAnalysisManager {
  static _instance = null

  static getInstance(logger, dbManager, settingManager, wordsManager, embeddingManager) {
    if (!AiAnalysisManager._instance) {
      AiAnalysisManager._instance = new AiAnalysisManager(
        logger,
        dbManager,
        settingManager,
        wordsManager,
        embeddingManager
      )
    }
    return AiAnalysisManager._instance
  }

  constructor(logger, dbManager, settingManager, wordsManager, embeddingManager) {
    if (AiAnalysisManager._instance) return AiAnalysisManager._instance
    this.logger = logger
    this.db = dbManager.db
    this.settingManager = settingManager
    this.wordsManager = wordsManager
    this.embeddingManager = embeddingManager
    this.provider = AiAnalysisProvider.getInstance(logger, settingManager)
    this.params = { startPage: 1, pageSize: 5 }
    this.isRunning = false
    this.onAnalysisDone = null
    AiAnalysisManager._instance = this
  }

  get ai() {
    return this.settingManager.settingData?.ai || {}
  }

  shouldRunBackground() {
    const ai = this.ai
    if (!this.provider.isEnabled()) return false
    if (ai.analysisMode !== 'background_slow' && ai.analysisMode !== 'new_only') return false
    return true
  }

  isImageFile(filePath) {
    const ext = path.extname(filePath || '').toLowerCase()
    return ['.jpg', '.jpeg', '.png', '.webp', '.bmp', '.gif'].includes(ext)
  }

  async analyzeResourceById(resourceId) {
    const row = this.db
      .prepare(`SELECT id, filePath, fileType, resourceName, title, desc, fileName FROM fbw_resources WHERE id = ?`)
      .get(resourceId)
    if (!row) {
      return { success: false, message: t('messages.operationFail') }
    }
    if (row.fileType !== 'image' || !row.filePath || !fs.existsSync(row.filePath)) {
      this.db
        .prepare(
          `UPDATE fbw_resources SET aiAnalysisStatus = ?, updated_at = datetime('now', 'localtime') WHERE id = ?`
        )
        .run(AI_ANALYSIS_STATUS.SKIPPED, resourceId)
      return { success: false, message: t('messages.operationFail') }
    }
    return await this.analyzeResourceRow(row)
  }

  async analyzeResourceRow(row) {
    try {
      const result = await this.provider.analyzeImage(row.filePath)
      const update = this.db.prepare(`
        UPDATE fbw_resources SET
          score = @score,
          title = CASE WHEN @title != '' THEN @title ELSE title END,
          desc = CASE WHEN @desc != '' THEN @desc ELSE desc END,
          summary = @summary,
          nsfwLevel = @nsfwLevel,
          aiAnalysisStatus = @status,
          aiAnalyzedAt = datetime('now', 'localtime'),
          updated_at = datetime('now', 'localtime')
        WHERE id = @id
      `)
      update.run({
        id: row.id,
        score: result.score,
        title: result.title,
        desc: result.desc,
        summary: result.summary,
        nsfwLevel: result.nsfwLevel,
        status: AI_ANALYSIS_STATUS.DONE
      })

      const ai = this.ai
      if (result.tags?.length && ai.enabled && !ai.legacyJiebaTags) {
        this.wordsManager.applyTagsFromAnalysis(row, result.tags)
      } else if (ai.legacyJiebaTags) {
        this.wordsManager.handleWords([row])
      }

      if (this.ai.enableEmbedding) {
        setImmediate(() => {
          this.embeddingManager.upsertForResource(row.id).catch((err) => {
            this.logger.warn(`[AiAnalysisManager] embedding ${row.id}: ${err}`)
          })
        })
      }

      if (typeof this.onAnalysisDone === 'function') {
        setImmediate(() => this.onAnalysisDone())
      }

      return { success: true, message: t('messages.operationSuccess'), data: result }
    } catch (err) {
      this.logger.error(`[AiAnalysisManager] analyze ${row.id}: ${err}`)
      this.db
        .prepare(
          `UPDATE fbw_resources SET aiAnalysisStatus = ?, updated_at = datetime('now', 'localtime') WHERE id = ?`
        )
        .run(AI_ANALYSIS_STATUS.FAILED, row.id)
      return { success: false, message: String(err.message || err) }
    }
  }

  intervalAnalyze(locks) {
    if (!this.shouldRunBackground()) return
    if (locks.aiAnalysis) return
    locks.aiAnalysis = true

    const { startPage, pageSize } = this.params
    const mode = this.ai.analysisMode
    let query_sql = `
      SELECT id, filePath, fileType, resourceName, title, desc, fileName
      FROM fbw_resources
      WHERE fileType = 'image'
        AND aiAnalysisStatus IN ('pending', 'failed')
    `
    if (mode === 'new_only') {
      query_sql += ` AND aiAnalyzedAt IS NULL`
    }
    query_sql += ` ORDER BY id ASC LIMIT ? OFFSET ?`

    const list = this.db.prepare(query_sql).all(pageSize, (startPage - 1) * pageSize)
    if (!list.length) {
      locks.aiAnalysis = false
      this.params.startPage = 1
      return
    }

    if (list.length < pageSize) {
      this.params.startPage = 1
    } else {
      this.params.startPage += 1
    }

    this.isRunning = true
    const run = async () => {
      try {
        for (const row of list) {
          if (!this.shouldRunBackground()) break
          await this.analyzeResourceRow(row)
        }
      } finally {
        this.isRunning = false
        locks.aiAnalysis = false
      }
    }
    run().catch(() => {
      this.isRunning = false
      locks.aiAnalysis = false
    })
  }

  getStats() {
    const rows = this.db
      .prepare(
        `SELECT aiAnalysisStatus as status, COUNT(*) as count FROM fbw_resources WHERE fileType='image' GROUP BY aiAnalysisStatus`
      )
      .all()
    const map = {}
    rows.forEach((r) => {
      map[r.status] = r.count
    })
    const pending = map.pending || 0
    const done = map.done || 0
    const failed = map.failed || 0
    const skipped = map.skipped || 0
    const total = pending + done + failed
    let embedding = 0
    try {
      embedding = this.db.prepare('SELECT COUNT(*) as c FROM fbw_resource_vec_blob').get()?.c || 0
    } catch {
      // ignore
    }
    return {
      success: true,
      data: {
        ...map,
        pending,
        done,
        failed,
        skipped,
        total,
        embedding,
        running: this.isRunning
      }
    }
  }

  markPendingForResources(ids = []) {
    if (!ids.length) return
    const stmt = this.db.prepare(
      `UPDATE fbw_resources SET aiAnalysisStatus='pending' WHERE id = ? AND fileType='image'`
    )
    const tx = this.db.transaction(() => ids.forEach((id) => stmt.run(id)))
    tx()
  }
}
