import fs from 'node:fs'
import path from 'node:path'
import AiAnalysisProvider from './AiAnalysisProvider.mjs'
import EmbeddingManager from './EmbeddingManager.mjs'
import {
  AI_ANALYSIS_STATUS,
  AI_ANALYSIS_SPEED_MIN_SAMPLES,
  AI_ANALYSIS_SPEED_SAMPLE_MAX,
  DEFAULT_AI_TIMEOUT_MS,
  resolveAnalysisConcurrency,
  resolveAnalysisMaxRetries,
  resolveEffectiveVisionTimeout
} from './aiConstants.mjs'
import { t } from '../../i18n/server.js'
import {
  buildClearAutoCurateLatchFields,
  isAutoCurateSettled
} from '../store/collectionCurateGate.mjs'
import {
  clearAiAnalysisDataForResourceIds,
  deleteAutoCollections
} from '../store/resourceDeleteCleanup.mjs'
import {
  AI_ANALYZABLE_FILE_TYPES_WHERE,
  buildAnalyzableResourceWhere,
  resolveVisionImagePath
} from './AiVisionResourcePath.mjs'

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
    this.isRunning = false
    this.maintenancePaused = false
    this.onAnalysisDone = null
    this.onAnalysisBatchDone = null
    this._recentAnalysisMs = []
    this._lastAnalysisMs = 0
    /** @type {Map<number, { startedAt: number, phase: string }>} */
    this._activeAnalyses = new Map()
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
    const currentAnalyses = [...this._activeAnalyses.entries()]
      .map(([id, meta]) => ({
        id,
        startedAt: meta?.startedAt ?? meta,
        phase: meta?.phase || 'vision'
      }))
      .sort((a, b) => a.startedAt - b.startedAt)
    const primary = currentAnalyses[0]
    return {
      lastAnalysisMs: this._lastAnalysisMs || 0,
      avgAnalysisMs,
      sampleCount,
      etaAnalysisMs,
      currentAnalyses,
      currentAnalysisResourceId: primary?.id || 0,
      currentAnalysisStartedAt: primary?.startedAt || 0
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

  setMaintenancePaused(paused) {
    this.maintenancePaused = !!paused
  }

  shouldRunBackground() {
    if (this.maintenancePaused) return false
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
    if (row.fileType !== 'image' && row.fileType !== 'video') return 'unsupported_type'
    const visionPath = resolveVisionImagePath(row)
    if (!visionPath) {
      return row.fileType === 'video' ? 'no_poster' : 'no_path'
    }
    if (!this.isImageFile(visionPath)) return 'unsupported_ext'
    if (!fs.existsSync(visionPath)) return 'missing_file'
    return null
  }

  _upsertAiStatus(resourceId, status, failCount = 0) {
    this.db
      .prepare(
        `INSERT INTO fbw_resource_ai (resourceId, aiAnalysisStatus, aiAnalysisFailCount, updated_at)
         VALUES (?, ?, ?, datetime('now', 'localtime'))
         ON CONFLICT(resourceId) DO UPDATE SET
           aiAnalysisStatus = excluded.aiAnalysisStatus,
           aiAnalysisFailCount = excluded.aiAnalysisFailCount,
           updated_at = excluded.updated_at`
      )
      .run(resourceId, status, failCount)
  }

  markAnalysisSkipped(row, reason) {
    this._upsertAiStatus(row.id, AI_ANALYSIS_STATUS.SKIPPED, Number(row.aiAnalysisFailCount) || 0)
    const visionPath = resolveVisionImagePath(row) || row.filePath || row.posterPath || ''
    this.logger.warn(
      `[AiAnalysisManager] skip analyze id=${row.id} reason=${reason} fileType=${row.fileType || ''} vision=${visionPath}`
    )
    let message = t('messages.operationFail')
    if (reason === 'missing_file') message = t('messages.fileNotExist')
    else if (reason === 'no_poster') message = t('messages.noVideoPoster')
    return {
      success: false,
      skipped: true,
      message
    }
  }

  async analyzeResourceById(resourceId, options = {}) {
    const row = this.db
      .prepare(
        `SELECT r.id, r.filePath, r.posterPath, r.fileType, r.resourceName, r.title, r.desc, r.fileName,
                COALESCE(ai.aiAnalysisFailCount, 0) AS aiAnalysisFailCount
         FROM fbw_resources r
         LEFT JOIN fbw_resource_ai ai ON ai.resourceId = r.id
         WHERE r.id = ?`
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
      this._upsertAiStatus(row.id, AI_ANALYSIS_STATUS.SKIPPED, failCount)
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

    this._upsertAiStatus(row.id, AI_ANALYSIS_STATUS.FAILED, failCount)
    row.aiAnalysisFailCount = failCount
    return { success: false, message: String(err.message || err) }
  }

  async analyzeResourceRow(row, { respectRetryLimit = true } = {}) {
    const skipReason = this.getSkipReason(row)
    if (skipReason) {
      return this.markAnalysisSkipped(row, skipReason)
    }

    const visionPath = resolveVisionImagePath(row)
    const startedAt = Date.now()
    const ctx = this.getAnalysisRequestContext(visionPath)
    this.logger.info(
      `[AiAnalysisManager] analyze start id=${row.id} fileType=${row.fileType} timeout=${ctx.timeoutSec}s (base=${ctx.baseTimeoutSec}s) provider=${ctx.visionProvider} model=${ctx.visionModel} size=${ctx.fileSizeMB}MB vision=${ctx.filePath}`
    )
    const modelStartedAt = Date.now()
    this._activeAnalyses.set(row.id, { startedAt: modelStartedAt, phase: 'vision' })
    let modelMs = 0
    try {
      const result = await this.provider.analyzeImage(visionPath, {
        videoPoster: row.fileType === 'video'
      })
      modelMs = Date.now() - modelStartedAt
      const safeForWork = result.safeForWork === false ? 0 : 1
      this.db
        .prepare(
          `INSERT INTO fbw_resource_ai (
            resourceId, aiTitle, aiDesc, summary, aiScore, nsfwLevel, safeForWork,
            aiAnalysisStatus, aiAnalyzedAt, aiAnalysisFailCount, updated_at
          ) VALUES (
            @id, @title, @desc, @summary, @score, @nsfwLevel, @safeForWork,
            @status, datetime('now', 'localtime'), 0, datetime('now', 'localtime')
          )
          ON CONFLICT(resourceId) DO UPDATE SET
            aiTitle = excluded.aiTitle,
            aiDesc = excluded.aiDesc,
            summary = excluded.summary,
            aiScore = excluded.aiScore,
            nsfwLevel = excluded.nsfwLevel,
            safeForWork = excluded.safeForWork,
            aiAnalysisStatus = excluded.aiAnalysisStatus,
            aiAnalyzedAt = excluded.aiAnalyzedAt,
            aiAnalysisFailCount = 0,
            updated_at = excluded.updated_at`
        )
        .run({
          id: row.id,
          score: result.score,
          title: result.title || '',
          desc: result.desc || '',
          summary: result.summary,
          nsfwLevel: result.nsfwLevel,
          safeForWork,
          status: AI_ANALYSIS_STATUS.DONE
        })
      this.db
        .prepare(
          `UPDATE fbw_resources SET updated_at = datetime('now', 'localtime') WHERE id = ?`
        )
        .run(row.id)

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
        if (ai.enabled) {
          this.embeddingManager.upsertImageForResource(row.id).catch((err) => {
            this.logger.warn(`[AiAnalysisManager] visual embedding ${row.id}: ${err}`)
          })
        }
      })

      if (typeof this.onAnalysisDone === 'function') {
        setImmediate(() => this.onAnalysisDone(row.id))
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
      this._activeAnalyses.delete(row.id)
    }
  }

  _buildPendingQuerySql() {
    const mode = this.ai.analysisMode
    const analyzable = buildAnalyzableResourceWhere('r')
    let query_sql = `
      SELECT r.id, r.filePath, r.posterPath, r.fileType, r.resourceName, r.title, r.desc, r.fileName,
             COALESCE(ai.aiAnalysisFailCount, 0) AS aiAnalysisFailCount
      FROM fbw_resources r
      LEFT JOIN fbw_resource_ai ai ON ai.resourceId = r.id
      WHERE ${analyzable}
        AND (ai.resourceId IS NULL OR ai.aiAnalysisStatus IN ('pending', 'failed'))
    `
    if (mode === 'new_only') {
      query_sql += ` AND (ai.resourceId IS NULL OR ai.aiAnalyzedAt IS NULL)`
    }
    return query_sql
  }

  fetchPendingBatch(limit) {
    const n = Math.max(1, Math.min(50, Number(limit) || 1))
    const query_sql = `${this._buildPendingQuerySql()} ORDER BY id ASC LIMIT ?`
    return this.db.prepare(query_sql).all(n)
  }

  countPendingInQueue() {
    const analyzable = buildAnalyzableResourceWhere('r')
    const row = this.db
      .prepare(
        `SELECT COUNT(*) as c FROM fbw_resources r
         LEFT JOIN fbw_resource_ai ai ON ai.resourceId = r.id
         WHERE ${analyzable}
           AND (ai.resourceId IS NULL OR ai.aiAnalysisStatus IN ('pending','failed'))${
          this.ai.analysisMode === 'new_only' ? ' AND (ai.resourceId IS NULL OR ai.aiAnalyzedAt IS NULL)' : ''
        }`
      )
      .get()
    return row?.c || 0
  }

  _finishPump(locks) {
    this.isRunning = false
    locks.aiAnalysis = false
    if (typeof this.onAnalysisBatchDone === 'function') {
      setImmediate(() => this.onAnalysisBatchDone())
    }
  }

  _schedulePumpContinue(locks) {
    setImmediate(() => {
      if (!this.shouldRunBackground()) return
      if (locks.aiAnalysis) return
      if (this.countPendingInQueue() <= 0) return
      this.pumpBackgroundAnalysis(locks)
    })
  }

  /**
   * 连续处理待分析队列，按 ai.concurrency 并行，直至无积压或不应再跑。
   */
  pumpBackgroundAnalysis(locks) {
    if (!this.shouldRunBackground()) return
    if (locks.aiAnalysis) return
    locks.aiAnalysis = true

    const concurrency = resolveAnalysisConcurrency(this.ai)
    const batchCtx = this.getAnalysisRequestContext('')
    this.logger.info(
      `[AiAnalysisManager] pump start concurrency=${concurrency} mode=${this.ai.analysisMode} timeout=${batchCtx.timeoutSec}s provider=${batchCtx.visionProvider} model=${batchCtx.visionModel}`
    )
    this.isRunning = true

    const run = async () => {
      try {
        while (this.shouldRunBackground()) {
          const list = this.fetchPendingBatch(concurrency)
          if (!list.length) break

          const batchStartedAt = Date.now()
          let doneCount = 0
          let failCount = 0
          let skipCount = 0

          const results = await Promise.all(
            list.map(async (row) => {
              if (!this.shouldRunBackground()) {
                return { aborted: true }
              }
              return this.analyzeResourceRow(row, { respectRetryLimit: true })
            })
          )

          for (const ret of results) {
            if (ret?.aborted) break
            if (ret?.success) doneCount += 1
            else if (ret?.skipped) skipCount += 1
            else failCount += 1
          }

          this.logger.info(
            `[AiAnalysisManager] pump batch count=${list.length} ok=${doneCount} fail=${failCount} skip=${skipCount} totalMs=${Date.now() - batchStartedAt}ms`
          )

          if (results.some((r) => r?.aborted)) break
        }
      } catch (err) {
        this.logger.error(`[AiAnalysisManager] pump error: ${err}`)
      } finally {
        this._finishPump(locks)
        this._schedulePumpContinue(locks)
      }
    }

    run().catch((err) => {
      this.logger.error(`[AiAnalysisManager] pump fatal: ${err}`)
      this._finishPump(locks)
      this._schedulePumpContinue(locks)
    })
  }

  /** @deprecated 兼容旧调用；请使用 pumpBackgroundAnalysis */
  intervalAnalyze(locks) {
    this.pumpBackgroundAnalysis(locks)
  }

  getStats() {
    const rows = this.db
      .prepare(
        `SELECT COALESCE(ai.aiAnalysisStatus, 'pending') AS status, COUNT(*) AS count
         FROM fbw_resources r
         LEFT JOIN fbw_resource_ai ai ON ai.resourceId = r.id
         WHERE ${AI_ANALYZABLE_FILE_TYPES_WHERE}
         GROUP BY status`
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
    const total = pending + done + failed + skipped
    let embedding = 0
    let imageEmbedding = 0
    let imageEmbedPending = 0
    try {
      embedding = this.db.prepare('SELECT COUNT(*) as c FROM fbw_resource_vec_blob').get()?.c || 0
      imageEmbedding =
        this.db.prepare('SELECT COUNT(*) as c FROM fbw_resource_image_vec_blob').get()?.c || 0
      const activeModel = this.embeddingManager?.getActiveVisualModelId?.()
      if (activeModel) {
        imageEmbedPending =
          this.db
            .prepare(
              `SELECT COUNT(*) as c
               FROM fbw_resources r
               INNER JOIN fbw_resource_ai ai ON ai.resourceId = r.id
               WHERE r.fileType IN ('image', 'video')
                 AND ai.aiAnalysisStatus = ?
                 AND NOT EXISTS (
                   SELECT 1 FROM fbw_resource_image_vec_blob v
                   WHERE v.resourceId = r.id AND v.model = ?
                 )`
            )
            .get(AI_ANALYSIS_STATUS.DONE, activeModel)?.c || 0
      }
    } catch {
      // ignore
    }
    let visualEmbedBackfillPending = 0
    let visualEmbedBackfillRunning = false
    let visualEmbedSkipped = 0
    let visualEmbedActiveModel = ''
    try {
      const visualStats = this.embeddingManager?.getVisualBackfillStats?.()
      if (visualStats) {
        visualEmbedBackfillPending = visualStats.pending ?? 0
        visualEmbedBackfillRunning = !!visualStats.running
        visualEmbedSkipped = visualStats.skipped ?? 0
        visualEmbedActiveModel = visualStats.activeModel || ''
      }
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
        imageEmbedPending,
        visualEmbedBackfillPending,
        visualEmbedBackfillRunning,
        visualEmbedSkipped,
        visualEmbedActiveModel,
        running: this.isRunning,
        concurrency: resolveAnalysisConcurrency(this.ai),
        ...this.getAnalysisSpeedStats(pending)
      }
    }
  }

  markPendingForResources(ids = []) {
    if (!ids.length) return
    const stmt = this.db.prepare(
      `INSERT INTO fbw_resource_ai (resourceId, aiAnalysisStatus, aiAnalysisFailCount, updated_at)
       VALUES (?, 'pending', 0, datetime('now', 'localtime'))
       ON CONFLICT(resourceId) DO UPDATE SET
         aiAnalysisStatus='pending', aiAnalysisFailCount=0, updated_at=datetime('now', 'localtime')`
    )
    const tx = this.db.transaction(() => ids.forEach((id) => stmt.run(id)))
    tx()
  }

  /**
   * 清空库内全部可分析资源（图片与有封面视频）的 AI 分析数据（评分、摘要、标题、描述、敏感等级、标签、向量等），并标为待分析。
   * @returns {{ success: boolean, message: string, data?: { affected: number, autoPump: boolean } }}
   */
  clearAllAiAnalysisData() {
    const analyzableWhere = AI_ANALYZABLE_FILE_TYPES_WHERE
    const count =
      this.db.prepare(`SELECT COUNT(*) as c FROM fbw_resources WHERE ${analyzableWhere}`).get()?.c || 0
    const autoCollectionCount =
      this.db.prepare(`SELECT COUNT(*) as c FROM fbw_collections WHERE source = 'auto'`).get()?.c || 0
    if (!count) {
      return {
        success: true,
        message: t('pages.Utils.resetAiAnalysisEmpty'),
        data: { affected: 0, autoCollectionsRemoved: 0, autoPump: false }
      }
    }

    const resourceIds = this.db
      .prepare(`SELECT id FROM fbw_resources WHERE ${analyzableWhere}`)
      .all()
      .map((r) => r.id)

    const tx = this.db.transaction(() => {
      if (resourceIds.length) {
        clearAiAnalysisDataForResourceIds(this.db, resourceIds)
      }
      deleteAutoCollections(this.db)
    })
    tx()

    const ai = this.ai
    if (isAutoCurateSettled(ai)) {
      const cleared = buildClearAutoCurateLatchFields(ai)
      this.settingManager.settingData.ai = cleared
      void this.settingManager.updateSettingData({ ai: cleared }).catch((err) => {
        this.logger.warn(`[AiAnalysisManager] clearAllAiAnalysisData: clear autoCurate latch failed: ${err}`)
      })
    }
    const autoPump =
      !!this.provider.isEnabled() &&
      ai.analysisMode !== 'off' &&
      ai.analysisMode !== 'on_demand'

    this.logger.info(
      `[AiAnalysisManager] clearAllAiAnalysisData affected=${count} autoCollections=${autoCollectionCount} autoPump=${autoPump}`
    )

    const msgParams = { count, autoCollections: autoCollectionCount }
    let message = t('pages.Utils.resetAiAnalysisSuccess', msgParams)
    if (!this.provider.isEnabled()) {
      message = t('pages.Utils.resetAiAnalysisSuccessNoAi', msgParams)
    } else if (!autoPump) {
      message = t('pages.Utils.resetAiAnalysisSuccessNoPump', msgParams)
    }

    return {
      success: true,
      message,
      data: { affected: count, autoCollectionsRemoved: autoCollectionCount, autoPump }
    }
  }

  /** @deprecated 使用 clearAllAiAnalysisData */
  resetAiAnalysisScope() {
    return this.clearAllAiAnalysisData()
  }

  /** 将全部 failed 标为 pending 并入队（不改动分析结果字段） */
  requeueFailedAiAnalysis() {
    return this._requeueAnalysisByStatuses([AI_ANALYSIS_STATUS.FAILED], 'requeueFailed')
  }

  /** 将全部 skipped 标为 pending 并入队（重置失败次数，便于手动重试） */
  requeueSkippedAiAnalysis() {
    return this._requeueAnalysisByStatuses([AI_ANALYSIS_STATUS.SKIPPED], 'requeueSkipped')
  }

  /** 将 failed + skipped 一并标为 pending（手动重新分析） */
  requeueRetryableAiAnalysis() {
    return this._requeueAnalysisByStatuses(
      [AI_ANALYSIS_STATUS.FAILED, AI_ANALYSIS_STATUS.SKIPPED],
      'requeueRetryable'
    )
  }

  _requeueAnalysisByStatuses(statuses, messagePrefix) {
    const normalized = (statuses || []).filter(Boolean)
    if (!normalized.length) {
      return {
        success: true,
        message: t(`pages.Setting.aiSetting.${messagePrefix}Empty`),
        data: { affected: 0, autoPump: false }
      }
    }
    const placeholders = normalized.map(() => '?').join(', ')
    const row = this.db
      .prepare(
        `SELECT COUNT(*) as c FROM fbw_resource_ai ai
         JOIN fbw_resources r ON r.id = ai.resourceId
         WHERE r.fileType IN ('image', 'video') AND ai.aiAnalysisStatus IN (${placeholders})`
      )
      .get(...normalized)
    const count = row?.c || 0
    if (!count) {
      return {
        success: true,
        message: t(`pages.Setting.aiSetting.${messagePrefix}Empty`),
        data: { affected: 0, autoPump: false }
      }
    }

    this.db
      .prepare(
        `UPDATE fbw_resource_ai SET aiAnalysisStatus = ?, aiAnalysisFailCount = 0, updated_at = datetime('now', 'localtime')
         WHERE aiAnalysisStatus IN (${placeholders})
           AND resourceId IN (SELECT id FROM fbw_resources WHERE fileType IN ('image', 'video'))`
      )
      .run(AI_ANALYSIS_STATUS.PENDING, ...normalized)

    const ai = this.ai
    const autoPump =
      !!this.provider.isEnabled() &&
      ai.analysisMode !== 'off' &&
      ai.analysisMode !== 'on_demand'

    this.logger.info(
      `[AiAnalysisManager] ${messagePrefix} affected=${count} statuses=${normalized.join(',')} autoPump=${autoPump}`
    )

    let message = t(`pages.Setting.aiSetting.${messagePrefix}Success`, { count })
    if (!this.provider.isEnabled()) {
      message = t(`pages.Setting.aiSetting.${messagePrefix}SuccessNoAi`, { count })
    } else if (!autoPump) {
      message = t(`pages.Setting.aiSetting.${messagePrefix}SuccessNoPump`, { count })
    }

    return { success: true, message, data: { affected: count, autoPump } }
  }
}
