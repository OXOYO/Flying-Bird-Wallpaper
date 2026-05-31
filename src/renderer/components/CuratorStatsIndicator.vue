<script setup>

import { useTranslation } from 'i18next-vue'

import { resolveAnalysisStatusTagType } from '@common/analysisRunStatus.mjs'



const { t } = useTranslation()



const stats = ref(null)

let refreshTimer = null



const POLL_FAST_MS = 10 * 1000

const POLL_SLOW_MS = 30 * 1000



const statusKey = computed(() => stats.value?.footerStatusKey || 'idle')



const statusLabel = computed(() => t(`pages.Collections.curatorFooterStatus.${statusKey.value}`))



const statusTagType = computed(() => resolveAnalysisStatusTagType(statusKey.value))



const isStatusPulsing = computed(

  () => statusKey.value === 'running' && !!stats.value?.analysisRunning

)



const footerMetrics = computed(() => {

  if (!stats.value) return null

  return {

    done: stats.value.analysisDone ?? stats.value.analyzed ?? 0,

    total: stats.value.analysisTotal ?? 0,

    percent: stats.value.analysisPercent ?? 0,

    auto: stats.value.autoCollections ?? 0,

    target: stats.value.targetCollections ?? 0

  }

})



const shouldPollFast = computed(() => {

  const key = statusKey.value

  return key === 'running' || key === 'queued'

})



const scheduleRefresh = () => {

  if (refreshTimer) {

    clearInterval(refreshTimer)

    refreshTimer = null

  }

  const interval = shouldPollFast.value ? POLL_FAST_MS : POLL_SLOW_MS

  refreshTimer = setInterval(refresh, interval)

}



const refresh = async () => {

  try {

    const res = await window.FBW.collectionsCuratorStats()

    if (res?.success) {

      stats.value = res.data

      scheduleRefresh()

    }

  } catch {

    // ignore

  }

}



onMounted(() => {

  void refresh()

})



onUnmounted(() => {

  if (refreshTimer) {

    clearInterval(refreshTimer)

    refreshTimer = null

  }

})



defineExpose({ stats, refresh })

</script>



<template>

  <span v-if="footerMetrics" class="curator-stats-indicator" role="status">

    <span class="curator-stats-indicator__label">{{ t('pages.Collections.curatorFooterLabel') }}</span>

    <span class="curator-stats-indicator__sep">·</span>

    <span

      class="curator-stats-indicator__status"

      :class="[`curator-stats-indicator__status--${statusTagType}`, { 'is-pulse': isStatusPulsing }]"

    >

      <span v-if="isStatusPulsing" class="curator-stats-indicator__dot" aria-hidden="true" />

      {{ statusLabel }}

    </span>

    <span class="curator-stats-indicator__sep">·</span>

    <span class="curator-stats-indicator__metric">

      {{ t('pages.Collections.curatorFooterProgress', footerMetrics) }}

    </span>

    <span class="curator-stats-indicator__sep">·</span>

    <span class="curator-stats-indicator__metric">{{ footerMetrics.percent }}%</span>

    <span class="curator-stats-indicator__sep">·</span>

    <span class="curator-stats-indicator__metric">

      {{ t('pages.Collections.curatorFooterCollections', footerMetrics) }}

    </span>

  </span>

</template>



<style scoped lang="scss">

.curator-stats-indicator {

  position: fixed;

  bottom: 8px;

  left: 80px;

  z-index: 20;

  display: inline-flex;

  align-items: center;

  gap: 4px;

  max-width: min(720px, calc(100% - 120px));

  font-size: 12px;

  line-height: 1.4;

  white-space: nowrap;

  overflow: hidden;

  text-overflow: ellipsis;

  pointer-events: none;

  user-select: none;

  color: var(--el-text-color-secondary);

}



.curator-stats-indicator__label,

.curator-stats-indicator__metric,

.curator-stats-indicator__sep {

  flex-shrink: 0;

}



.curator-stats-indicator__status {

  display: inline-flex;

  align-items: center;

  gap: 4px;

  flex-shrink: 0;

  font-weight: 600;



  &--primary {

    color: var(--el-color-primary);

  }



  &--warning {

    color: var(--el-color-warning);

  }



  &--success {

    color: var(--el-color-success);

  }



  &--info {

    color: var(--el-text-color-secondary);

  }

}



.curator-stats-indicator__dot {

  width: 6px;

  height: 6px;

  border-radius: 50%;

  background: currentColor;

  flex-shrink: 0;

}



.curator-stats-indicator__status.is-pulse .curator-stats-indicator__dot {

  animation: curator-status-pulse 1.2s ease-in-out infinite;

}



@keyframes curator-status-pulse {

  0%,

  100% {

    opacity: 1;

    transform: scale(1);

  }

  50% {

    opacity: 0.45;

    transform: scale(0.85);

  }

}

</style>


