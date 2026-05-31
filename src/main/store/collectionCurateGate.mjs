/** 分析队列稳定后自动整理：渐进 → 定格 → 锁存；锁存后仅增量加入 */

import {
  computeAnalysisProgressPercent,
  normalizeAnalysisCounts,
  resolveAnalysisRunStatusKey
} from '../../common/analysisRunStatus.mjs'

export function isAnalysisQueueStable(stats = {}) {
  const pending = stats.pending ?? 0
  const failed = stats.failed ?? 0
  return pending === 0 && failed === 0 && !stats.running
}

/** 分析队列稳定且已分析图的画面向量已补全 */
export function isAiPipelineStable(stats = {}) {
  if (!isAnalysisQueueStable(stats)) return false
  return (stats.imageEmbedPending ?? 0) === 0
}

export function isAutoCurateSettled(ai = {}) {
  return ai.autoCurateSettled === true
}

export function readAutoCurateLatch(ai = {}) {
  return {
    settled: isAutoCurateSettled(ai),
    analyzed: Number(ai.autoCurateSettledAnalyzed) || 0
  }
}

/** 是否应继续全量自动整理（定时 / 防抖）；锁存后不再全量整理 */
export function shouldRunScheduledAutoCurate(stats, ai = {}) {
  void stats
  if (!ai.enabled || ai.autoCollectionsEnabled === false) return false
  if (isAutoCurateSettled(ai)) return false
  return true
}

export function buildAutoCurateLatchFields(stats = {}) {
  return {
    autoCurateSettled: true,
    autoCurateSettledAnalyzed: stats.done ?? 0
  }
}

export function buildClearAutoCurateLatchFields(ai = {}) {
  return {
    ...ai,
    autoCurateSettled: false,
    autoCurateSettledAnalyzed: 0
  }
}

/** 页脚状态条：AI分析 · 状态 · 进度 · 百分比 · 推荐合集 */
export function buildCuratorFooterStats(curator = {}, analysis = {}, ai = {}) {
  const done = Number(analysis.done) || Number(curator.analyzed) || 0
  const total = Number(analysis.total) || 0
  const percent =
    total > 0 ? Math.min(100, Math.round((done / total) * 100)) : done > 0 ? 100 : 0

  let footerStatusKey = 'idle'
  if (!ai.enabled) {
    footerStatusKey = 'disabled'
  } else if (curator.autoCurateSettled) {
    footerStatusKey = 'settled'
  } else if (analysis.running) {
    footerStatusKey = 'running'
  } else if (ai.analysisMode === 'on_demand') {
    footerStatusKey = 'onDemand'
  } else if (total > 0 && done >= total && (analysis.pending ?? 0) === 0) {
    footerStatusKey = 'complete'
  } else if ((analysis.pending ?? 0) > 0 || (analysis.imageEmbedPending ?? 0) > 0) {
    footerStatusKey = 'queued'
  }

  return {
    ...curator,
    analysisDone: done,
    analysisTotal: total,
    analysisPercent: percent,
    analysisPending: analysis.pending ?? 0,
    imageEmbedPending: analysis.imageEmbedPending ?? 0,
    analysisRunning: !!analysis.running,
    footerStatusKey
  }
}
