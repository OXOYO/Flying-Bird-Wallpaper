import fs from 'node:fs'
import path from 'node:path'
import AiAnalysisProvider from './AiAnalysisProvider.mjs'
import EmbeddingManager from './EmbeddingManager.mjs'
import {
  AI_ANALYSIS_STATUS,
  AI_ANALYSIS_SPEED_MIN_SAMPLES,
  AI_ANALYSIS_SPEED_SAMPLE_MAX,
  DEFAULT_AI_TIMEOUT_MS,
  resolveAnalysisMaxRetries,
  resolveEffectiveVisionTimeout
} from './aiConstants.mjs'
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
    this.onAnalysisBatchDone = null
    this._recentAnalysisMs = []
    this._lastAnalysisMs = 0
    this._currentAnalysisStartedAt = 0
    AiAnalysisManager._instance = this
  }

  recordAnalysisDuration(modelMs) {
    const ms = Math.round(Number(modelMs) || 0)
    if (ms <= 0) return
    this._lastAnalysisMs = ms
    this._recentAnalysisMs.push(ms)
    if (this._recentAnalysisMs.length > AI_ANALYSIS_SPEED_SAMPLE_MAX) {
      this._recentAnalysisMs.shift()
    }
  }

  getAnalysisSpeedStats(pending = 0) {
    const samples = this._recentAnalysisMs
    const sampleCount = samples.length
    let avgAnalysisMs = 0
    if (sampleCount > 0) {
      avgAnalysisMs = Math.round(samples.reduce((sum, n) => sum + n, 0) / sampleCount)
    }
    const etaAnalysisMs =
      sampleCount >= AI_ANALYSIS_SPEED_MIN_SAMPLES && avgAnalysisMs > 0 && pending > 0
        ? pending * avgAnalysisMs
        : 0
    return {
      lastAnalysisMs: this._lastAnalysisMs || 0,
      avgAnalysisMs,
      sampleCount,
      etaAnalysisMs,
      currentAnalysisStartedAt: this._currentAnalysisStartedAt || 0
    }
  }

  get ai() {
    return this.settingManager.settingData?.ai || {}
  }

  getAnalysisRequestContext(filePath) {
    const ai = this.ai
    let fileSizeBytes = 0
    try {
      if (filePath && fs.existsSync(filePath)) {
        fileSizeBytes = fs.statSync(filePath).size
      }
    } catch {
      // ignore
    }
    const baseTimeoutMs = Number(ai.timeout) || DEFAULT_AI_TIMEOUT_MS
    const timeoutMs = filePath
      ? resolveEffectiveVisionTimeout(ai, fileSizeBytes)
      : baseTimeoutMs
    return {
      baseTimeoutMs,
      timeoutMs,
      timeoutSec: Math.round(timeoutMs / 1000),
      baseTimeoutSec: Math.round(baseTimeoutMs / 1000),
      visionProvider: ai.visionProvider || '',
      visionModel: ai.visionModel || '',
      visionBaseUrl: ai.visionBaseUrl || '',
      filePath: filePath || '',
      fileSizeMB: fileSizeBytes ? (fileSizeBytes / (1024 * 1024)).toFixed(2) : 'unknown'
    }
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

  /** @returns {string|null} 跳过原因；null 表示可继续分析 */
  getSkipReason(row) {
    if (!row) return 'no_row'
    if (row.fileType !== 'image') return 'not_image'
    if (!row.filePath) return 'no_path'
    if (!this.isImageFile(row.filePath)) return 'unsupported_ext'
    if (!fs.existsSync(row.filePath)) return 'missing_file'
    return null
  }

  markAnalysisSkipped(row, reason) {
    this.db
      .prepare(
        `UPDATE fbw_resources SET aiAnalysisStatus = ?, updated_at = datetime('now', 'localtime') WHERE id = ?`
      )
      .run(AI_ANALYSIS_STATUS.SKIPPED, row.id)
    this.logger.warn(
      `[AiAnalysisManager] skip analyze id=${row.id} reason=${reason} file=${row.filePath || ''}`
    )
    return {
      success: false,
      skipped: true,
      message:
        reason === 'missing_file' ? t('messages.fileNotExist') : t('messages.operationFail')
    }
  }

  async analyzeResourceById(resourceId, options = {}) {
    const row = this.db
      .prepare(
        `SELECT id, filePath, fileType, resourceName, title, desc, fileName, aiAnalysisFailCount FROM fbw_resources WHERE id = ?`
      )
      .get(resourceId)
    if (!row) {
      return { success: false, message: t('messages.operationFail') }
    }
    return await this.analyzeResourceRow(row, { respectRetryLimit: false, ...options })
  }

  handleAnalysisFailure(row, err, ctx, startedAt, modelMs, { respectRetryLimit = true } = {}) {
    const totalMs = Date.now() - startedAt
    const errName = err?.name || ''
    const errMsg = String(err?.message || err)
    const isTimeout = /aborterror|timeout|超时/i.test(`${errName} ${errMsg}`)
    this.logger.error(
      `[AiAnalysisManager] analyze failed id=${row.id} pipelineMs=${modelMs}ms totalMs=${totalMs}ms configuredTimeout=${ctx.timeoutSec}s (${ctx.timeoutMs}ms) provider=${ctx.visionProvider} model=${ctx.visionModel} baseUrl=${ctx.visionBaseUrl} size=${ctx.fileSizeMB}MB likelyTimeout=${isTimeout} error=${errName}: ${errMsg} file=${ctx.filePath} (vision-http modelMs见 HttpAi/vision 日志)`
    )

    const prevCount = Number(row.aiAnalysisFailCount) || 0
    const failCount = prevCount + 1
    const maxRetries = resolveAnalysisMaxRetries(this.ai)
    if (respectRetryLimit && failCount >= maxRetries) {
      this.db
        .prepare(
          `UPDATE fbw_resources SET aiAnalysisStatus = ?, aiAnalysisFailCount = ?, updated_at = datetime('now', 'localtime') WHERE id = ?`
        )
        .run(AI_ANALYSIS_STATUS.SKIPPED, failCount, row.id)
      this.logger.warn(
        `[AiAnalysisManager] skip analyze id=${row.id} reason=max_retries failCount=${failCount} max=${maxRetries} file=${row.filePath || ''}`
      )
      return {
        success: false,
        skipped: true,
        reason: 'max_retries',
        message: t('messages.operationFail')
      }
    }

    this.db
      .prepare(
        `UPDATE fbw_resources SET aiAnalysisStatus = ?, aiAnalysisFailCount = ?, updated_at = datetime('now', 'localtime') WHERE id = ?`
      )
      .run(AI_ANALYSIS_STATUS.FAILED, failCount, row.id)
    row.aiAnalysisFailCount = failCount
    return { success: false, message: String(err.message || err) }
  }

  async analyzeResourceRow(row, { respectRetryLimit = true } = {}) {
    const skipReason = this.getSkipReason(row)
    if (skipReason) {
      return this.markAnalysisSkipped(row, skipReason)
    }

    const startedAt = Date.now()
    const ctx = this.getAnalysisRequestContext(row.filePath)
    this.logger.info(
      `[AiAnalysisManager] analyze start id=${row.id} timeout=${ctx.timeoutSec}s (base=${ctx.baseTimeoutSec}s) provider=${ctx.visionProvider} model=${ctx.visionModel} size=${ctx.fileSizeMB}MB file=${ctx.filePath}`
    )
    const modelStartedAt = Date.now()
    this._currentAnalysisStartedAt = modelStartedAt
    let modelMs = 0
    try {
      const result = await this.provider.analyzeImage(row.filePath)
      modelMs = Date.now() - modelStartedAt
      const update = this.db.prepare(`
        UPDATE fbw_resources SET
          score = @score,
          title = CASE WHEN @title != '' THEN @title ELSE title END,
          desc = CASE WHEN @desc != '' THEN @desc ELSE desc END,
          summary = @summary,
          nsfwLevel = @nsfwLevel,
          aiAnalysisStatus = @status,
          aiAnalyzedAt = datetime('now', 'localtime'),
          aiAnalysisFailCount = 0,
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

      setImmediate(() => {
        if (ai.enabled) {
          this.embeddingManager.upsertForResource(row.id).catch((err) => {
            this.logger.warn(`[AiAnalysisManager] text embedding ${row.id}: ${err}`)
          })
        }
        this.embeddingManager.upsertImageForResource(row.id).catch((err) => {
          this.logger.warn(`[AiAnalysisManager] visual embedding ${row.id}: ${err}`)
        })
      })

      if (typeof this.onAnalysisDone === 'function') {
        setImmediate(() => this.onAnalysisDone())
      }

      this.recordAnalysisDuration(modelMs)
      const totalMs = Date.now() - startedAt
      this.logger.info(
        `[AiAnalysisManager] analyze done id=${row.id} pipelineMs=${modelMs}ms totalMs=${totalMs}ms (vision-http modelMs见 HttpAi/vision 日志)`
      )
      return { success: true, message: t('messages.operationSuccess'), data: result }
    } catch (err) {
      if (!modelMs) modelMs = Date.now() - modelStartedAt
      const errCode = err?.code || ''
      const errMsg = String(err?.message || err)
      if (errCode === 'ENOENT' || /ENOENT|no such file/i.test(errMsg)) {
        return this.markAnalysisSkipped(row, 'missing_file')
      }
      return this.handleAnalysisFailure(row, err, ctx, startedAt, modelMs, { respectRetryLimit })
    } finally {
      this._currentAnalysisStartedAt = 0
    }
  }

  intervalAnalyze(locks) {
    if (!this.shouldRunBackground()) return
    if (locks.aiAnalysis) return
    locks.aiAnalysis = true

    const { startPage, pageSize } = this.params
    const mode = this.ai.analysisMode
    let query_sql = `
      SELECT id, filePath, fileType, resourceName, title, desc, fileName, aiAnalysisFailCount
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

    const batchCtx = this.getAnalysisRequestContext('')
    this.logger.info(
      `[AiAnalysisManager] batch start count=${list.length} mode=${mode} timeout=${batchCtx.timeoutSec}s provider=${batchCtx.visionProvider} model=${batchCtx.visionModel}`
    )
    this.isRunning = true
    const run = async () => {
      const batchStartedAt = Date.now()
      let doneCount = 0
      let failCount = 0
      try {
        for (const row of list) {
          if (!this.shouldRunBackground()) break
          const ret = await this.analyzeResourceRow(row, { respectRetryLimit: true })
          if (ret?.success) doneCount += 1
          else if (!ret?.skipped) failCount += 1
        }
      } finally {
        this.logger.info(
          `[AiAnalysisManager] batch done count=${list.length} ok=${doneCount} fail=${failCount} totalMs=${Date.now() - batchStartedAt}ms`
        )
        this.isRunning = false
        locks.aiAnalysis = false
        if (typeof this.onAnalysisBatchDone === 'function') {
          setImmediate(() => this.onAnalysisBatchDone())
        }
      }
    }
    run().catch(() => {
      this.isRunning = false
      locks.aiAnalysis = false
      if (typeof this.onAnalysisBatchDone === 'function') {
        setImmediate(() => this.onAnalysisBatchDone())
      }
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
    let imageEmbedding = 0
    try {
      embedding = this.db.prepare('SELECT COUNT(*) as c FROM fbw_resource_vec_blob').get()?.c || 0
      imageEmbedding =
        this.db.prepare('SELECT COUNT(*) as c FROM fbw_resource_image_vec_blob').get()?.c || 0
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
        imageEmbedding,
        running: this.isRunning,
        ...this.getAnalysisSpeedStats(pending)
      }
    }
  }

  markPendingForResources(ids = []) {
    if (!ids.length) return
    const stmt = this.db.prepare(
      `UPDATE fbw_resources SET aiAnalysisStatus='pending', aiAnalysisFailCount=0 WHERE id = ? AND fileType='image'`
    )
    const tx = this.db.transaction(() => ids.forEach((id) => stmt.run(id)))
    tx()
  }
}
