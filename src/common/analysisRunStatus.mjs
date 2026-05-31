/** 与设置页 AI 分析面板一致的状态 / 进度计算 */

export function normalizeAnalysisCounts(stats = {}, fallbackDone = 0) {
  const pending = Number(stats.pending) || 0
  const failed = Number(stats.failed) || 0
  const skipped = Number(stats.skipped) || 0
  const done = Number(stats.done) || Number(fallbackDone) || 0
  let total = Number(stats.total) || 0
  if (!total && (pending || done || failed)) {
    total = pending + done + failed
  }
  return { pending, failed, skipped, done, total }
}

export function computeAnalysisProgressPercent(stats = {}) {
  const { done, total } = normalizeAnalysisCounts(stats)
  if (!total) return done > 0 ? 100 : 0
  return Math.min(100, Math.round((done / total) * 100))
}

/**
 * @returns {'loading'|'disabled'|'running'|'onDemand'|'complete'|'queued'|'idle'}
 */
export function resolveAnalysisRunStatusKey(stats = {}, ai = {}) {
  if (!stats || !Object.keys(stats).length) return 'loading'
  if (!ai.enabled) return 'disabled'
  if (stats.running) return 'running'
  if (ai.analysisMode === 'on_demand') return 'onDemand'
  const { total, pending } = normalizeAnalysisCounts(stats)
  const percent = computeAnalysisProgressPercent(stats)
  if (percent >= 100 && total > 0 && pending === 0) return 'complete'
  if (pending > 0 || (stats.imageEmbedPending ?? 0) > 0) return 'queued'
  return 'idle'
}

/** 与设置页 AiAnalysisDashboardPanel 的 el-tag type 一致 */
export function resolveAnalysisStatusTagType(statusKey) {
  const map = {
    loading: 'info',
    running: 'primary',
    queued: 'warning',
    complete: 'success',
    idle: 'info',
    onDemand: 'info',
    settled: 'success',
    disabled: 'info'
  }
  return map[statusKey] || 'info'
}
