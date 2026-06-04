import { computed, onMounted, onUnmounted, ref, unref, watch } from 'vue'
import { useTranslation } from 'i18next-vue'
import { resolveAnalysisStatusTagType } from '@common/analysisRunStatus.mjs'
import { formatAnalysisRemaining, msToAnalysisSeconds } from './formatAnalysisDuration.js'

const ANALYSIS_SPEED_MIN_SAMPLES = 3

/**
 * AI 分析进度侧边栏（与 AiAnalysisDashboardPanel 配套）
 * @param {import('vue').ComputedRef<object>|import('vue').Ref<object>} aiSource settingData.ai 或 aiForm
 * @param {{ tabActive?: import('vue').Ref<boolean>|boolean }} options 当前 Tab 是否可见，用于控制轮询
 */
export function useAiAnalysisDashboard(aiSource, options = {}) {
  const { t } = useTranslation()
  const tabActive = options.tabActive ?? ref(true)

  const analysisStats = ref(null)
  const loadingAnalysisStats = ref(false)
  let statsTimer = null

  /** 设置侧栏 AI 分析卡片始终展示（与「启用 AI」开关无关） */
  const showAnalysisProgress = computed(() => true)

  const analysisProgressPercent = computed(() => {
    const s = analysisStats.value
    if (!s) return 0
    const total = s.total || 0
    if (!total) return s.done > 0 ? 100 : 0
    return Math.min(100, Math.round((s.done / total) * 100))
  })

  const analysisRunStatus = computed(() => {
    const s = analysisStats.value
    const ai = unref(aiSource) || {}
    if (!s) return 'loading'
    if (!ai.enabled) return 'disabled'
    if (s.running) return 'running'
    if (ai.analysisMode === 'on_demand') return 'onDemand'
    if (analysisProgressPercent.value >= 100 && (s.total ?? 0) > 0) return 'complete'
    if ((s.pending ?? 0) > 0) return 'queued'
    return 'idle'
  })

  const analysisStatusLabel = computed(() => {
    const map = {
      loading: 'runStatusLoading',
      disabled: 'runStatusDisabled',
      running: 'runStatusRunning',
      queued: 'runStatusQueued',
      complete: 'runStatusComplete',
      idle: 'runStatusIdle',
      onDemand: 'runStatusOnDemand'
    }
    return t(`pages.Setting.aiSetting.${map[analysisRunStatus.value]}`)
  })

  const analysisStatusTooltip = computed(() => {
    const reason = analysisStats.value?.pumpBlockReason
    if (analysisRunStatus.value === 'queued' && reason) {
      const reasonKey = `pumpBlockReason_${reason}`
      const specific = t(`pages.Setting.aiSetting.${reasonKey}`, { defaultValue: '' })
      if (specific) return specific
    }
    const map = {
      queued: 'runStatusQueuedHint',
      running: 'statsRunning',
      onDemand: 'statsOnDemandHint',
      disabled: 'runStatusDisabledHint',
      complete: 'statsComplete'
    }
    const key = map[analysisRunStatus.value]
    return key ? t(`pages.Setting.aiSetting.${key}`) : ''
  })

  const analysisStatusTagType = computed(() => resolveAnalysisStatusTagType(analysisRunStatus.value))

  const analysisProgressSummary = computed(() => {
    const s = analysisStats.value
    return t('pages.Setting.aiSetting.analysisProgressCount', {
      done: s?.done ?? 0,
      total: s?.total ?? 0
    })
  })

  const analysisFooterHint = computed(() => '')

  const nowTick = ref(Date.now())
  let tickTimer = null

  const stopSpeedTick = () => {
    if (tickTimer) {
      clearInterval(tickTimer)
      tickTimer = null
    }
  }

  const startSpeedTick = () => {
    stopSpeedTick()
    nowTick.value = Date.now()
    tickTimer = setInterval(() => {
      nowTick.value = Date.now()
    }, 1000)
  }

  watch(
    () => !!(analysisStats.value?.running && analysisStats.value?.currentAnalysisStartedAt),
    (active) => {
      if (active) startSpeedTick()
      else stopSpeedTick()
    },
    { immediate: true }
  )

  const currentAnalysisElapsedMs = computed(() => {
    const s = analysisStats.value
    if (!s?.running || !s.currentAnalysisStartedAt) return 0
    return Math.max(0, nowTick.value - s.currentAnalysisStartedAt)
  })

  const analysisSpeedTooltip = computed(() => t('pages.Setting.aiSetting.analysisSpeedTooltip'))

  const analysisSpeedLine = computed(() => {
    const s = analysisStats.value
    if (!s) return ''

    const parts = []

    if (s.running && currentAnalysisElapsedMs.value > 0) {
      parts.push(
        t('pages.Setting.aiSetting.analysisSpeedCurrent', {
          sec: msToAnalysisSeconds(currentAnalysisElapsedMs.value)
        })
      )
    }

    const sampleCount = s.sampleCount ?? 0
    const avgMs = s.avgAnalysisMs ?? 0
    if (sampleCount >= ANALYSIS_SPEED_MIN_SAMPLES && avgMs > 0) {
      parts.push(
        t('pages.Setting.aiSetting.analysisSpeedPerImage', {
          sec: msToAnalysisSeconds(avgMs)
        })
      )
      const pending = s.pending ?? 0
      const etaMs = s.etaAnalysisMs ?? 0
      if (pending > 0 && etaMs > 0 && s.running) {
        parts.push(
          t('pages.Setting.aiSetting.analysisSpeedEta', {
            duration: formatAnalysisRemaining(t, etaMs)
          })
        )
      }
    }

    if (parts.length) return parts.join('，')
    if (s.running) return t('pages.Setting.aiSetting.analysisSpeedGathering')
    return ''
  })

  const fetchAnalysisStats = async () => {
    loadingAnalysisStats.value = true
    try {
      const res = await window.FBW.getAiAnalysisStats()
      if (res?.success) analysisStats.value = res.data
    } finally {
      loadingAnalysisStats.value = false
    }
  }

  const resolveStatsPollIntervalMs = () => {
    const s = analysisStats.value
    const ai = unref(aiSource) || {}
    if (s?.running) return 5000
    if (ai.enabled && (s?.pending ?? 0) > 0) return 10000
    const fast = ai.analysisMode === 'background_slow' || ai.analysisMode === 'new_only'
    return fast ? 10000 : 30000
  }

  const scheduleStatsPoll = () => {
    if (statsTimer) {
      clearTimeout(statsTimer)
      statsTimer = null
    }
    if (!unref(tabActive)) return
    statsTimer = setTimeout(async () => {
      await fetchAnalysisStats()
      scheduleStatsPoll()
    }, resolveStatsPollIntervalMs())
  }

  const startStatsPolling = () => {
    stopStatsPolling()
    if (!unref(tabActive)) {
      analysisStats.value = null
      return
    }
    fetchAnalysisStats().then(() => scheduleStatsPoll())
  }

  const stopStatsPolling = () => {
    if (statsTimer) {
      clearTimeout(statsTimer)
      statsTimer = null
    }
  }

  watch(
    () => {
      const ai = unref(aiSource) || {}
      return [unref(tabActive), ai.enabled, ai.analysisMode]
    },
    () => startStatsPolling(),
    { deep: true }
  )

  const requeueFailedAiAnalysis = async () => {
    const failed = analysisStats.value?.failed ?? 0
    if (!failed) return { success: false }
    try {
      await ElMessageBox.confirm(t('pages.Setting.aiSetting.requeueFailedConfirm', { count: failed }), {
        type: 'warning',
        draggable: true,
        dangerouslyUseHTMLString: true
      })
    } catch {
      return { success: false, cancelled: true }
    }
    const res = await window.FBW.requeueFailedAiAnalysis()
    if (res?.message) {
      ElMessage({
        type: res.success ? 'success' : 'error',
        message: res.message
      })
    }
    if (res?.success) await fetchAnalysisStats()
    return res
  }

  onMounted(() => startStatsPolling())
  onUnmounted(() => {
    stopStatsPolling()
    stopSpeedTick()
  })

  return {
    analysisStats,
    loadingAnalysisStats,
    showAnalysisProgress,
    analysisProgressPercent,
    analysisStatusLabel,
    analysisStatusTooltip,
    analysisStatusTagType,
    analysisProgressSummary,
    analysisFooterHint,
    analysisSpeedLine,
    analysisSpeedTooltip,
    fetchAnalysisStats,
    startStatsPolling,
    stopStatsPolling,
    requeueFailedAiAnalysis
  }
}
