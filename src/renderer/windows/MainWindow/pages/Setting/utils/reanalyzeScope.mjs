export const REANALYZE_MODE = {
  RETRYABLE: 'retryable',
  FULL_NO_CLEAR: 'fullNoClear',
  FULL_CLEAR: 'fullClear'
}

export function resolveDefaultReanalyzeMode({ failed = 0, skipped = 0, done = 0, total = 0 } = {}) {
  const retryable = Math.max(0, failed) + Math.max(0, skipped)
  const fullNoClear = retryable + Math.max(0, done)
  if (retryable > 0) return REANALYZE_MODE.RETRYABLE
  if (fullNoClear > 0) return REANALYZE_MODE.FULL_NO_CLEAR
  if (total > 0) return REANALYZE_MODE.FULL_CLEAR
  return REANALYZE_MODE.RETRYABLE
}

export function hasActionableReanalyzeMode({ failed = 0, skipped = 0, done = 0, total = 0 } = {}) {
  const retryable = Math.max(0, failed) + Math.max(0, skipped)
  const fullNoClear = retryable + Math.max(0, done)
  return retryable > 0 || fullNoClear > 0 || total > 0
}
