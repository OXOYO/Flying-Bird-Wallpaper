/** 分析队列稳定后自动整理：至少跑一轮，之后暂停定时/防抖（手动不受限） */

export function isAnalysisQueueStable(stats = {}) {
  const pending = stats.pending ?? 0
  const failed = stats.failed ?? 0
  return pending === 0 && failed === 0 && !stats.running
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

/** 是否应继续自动整理（定时 / 分析完成防抖） */
export function shouldRunScheduledAutoCurate(stats, ai = {}) {
  if (!ai.enabled || ai.autoCollectionsEnabled === false) return false
  if (!isAutoCurateSettled(ai)) return true
  if (!isAnalysisQueueStable(stats)) return true
  const analyzed = stats.done ?? 0
  const latch = readAutoCurateLatch(ai)
  if (analyzed > latch.analyzed) return true
  return false
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
