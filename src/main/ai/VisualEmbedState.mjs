import {
  VISUAL_EMBED_STATUS,
  isIrrecoverableVisualEmbedError,
  resolveAnalysisMaxRetries
} from './aiConstants.mjs'

export default class VisualEmbedState {
  constructor(db, logger) {
    this.db = db
    this.logger = logger
  }

  isSkipped(resourceId, model) {
    const row = this.db
      .prepare(
        `SELECT status FROM fbw_resource_visual_embed_state WHERE resourceId = ? AND model = ?`
      )
      .get(resourceId, model)
    return row?.status === VISUAL_EMBED_STATUS.SKIPPED
  }

  clear(resourceId, model) {
    this.db
      .prepare(`DELETE FROM fbw_resource_visual_embed_state WHERE resourceId = ? AND model = ?`)
      .run(resourceId, model)
  }

  /**
   * @returns {{ failCount: number, skipped: boolean }}
   */
  recordFailure(resourceId, model, err, ai = {}) {
    const prev = this.db
      .prepare(
        `SELECT failCount FROM fbw_resource_visual_embed_state WHERE resourceId = ? AND model = ?`
      )
      .get(resourceId, model)
    const failCount = (Number(prev?.failCount) || 0) + 1
    const maxRetries = resolveAnalysisMaxRetries(ai)
    const irrecoverable = isIrrecoverableVisualEmbedError(err)
    const skipped = irrecoverable || failCount >= maxRetries
    const status = skipped ? VISUAL_EMBED_STATUS.SKIPPED : VISUAL_EMBED_STATUS.FAILED
    const lastError = String(err?.message || err).slice(0, 500)

    this.db
      .prepare(
        `INSERT INTO fbw_resource_visual_embed_state (resourceId, model, failCount, status, lastError, updated_at)
         VALUES (?, ?, ?, ?, ?, datetime('now', 'localtime'))
         ON CONFLICT(resourceId, model) DO UPDATE SET
           failCount = excluded.failCount,
           status = excluded.status,
           lastError = excluded.lastError,
           updated_at = excluded.updated_at`
      )
      .run(resourceId, model, failCount, status, lastError)

    if (skipped) {
      this.logger.warn(
        `[EmbeddingManager] skip visual embed id=${resourceId} model=${model} failCount=${failCount} max=${maxRetries} irrecoverable=${irrecoverable} error=${lastError}`
      )
    }

    return { failCount, skipped }
  }
}
