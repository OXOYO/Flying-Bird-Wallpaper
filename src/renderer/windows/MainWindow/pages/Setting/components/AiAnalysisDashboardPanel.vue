<script setup>
import { computed } from 'vue'
import { useTranslation } from 'i18next-vue'
import AnalysisSpeedSparkline from './AnalysisSpeedSparkline.vue'

const props = defineProps({
  loading: { type: Boolean, default: false },
  stats: { type: Object, default: null },
  percent: { type: Number, default: 0 },
  statusLabel: { type: String, default: '' },
  statusTagType: { type: String, default: 'info' },
  footerHint: { type: String, default: '' },
  running: { type: Boolean, default: false },
  statusTooltip: { type: String, default: '' },
  speedLine: { type: String, default: '' },
  speedTooltip: { type: String, default: '' },
  speedSeries: { type: Array, default: () => [] },
  showSpeedChart: { type: Boolean, default: false }
})

const emit = defineEmits(['requeueRetryable'])

const { t } = useTranslation()

/** 侧栏窄：从标题左缘向上展开，向右延伸，避免左侧溢出 */
const titleTooltipPopperOptions = {
  modifiers: [
    {
      name: 'preventOverflow',
      options: { padding: 8, altAxis: true }
    },
    {
      name: 'flip',
      options: { fallbackPlacements: ['top', 'bottom-start', 'bottom'] }
    }
  ]
}

const MIN_ISSUE_SEGMENT_PX = 3

const progressSegments = computed(() => {
  const s = props.stats
  if (!s) return []

  const done = s.done ?? 0
  const pending = s.pending ?? 0
  const failed = s.failed ?? 0
  const skipped = s.skipped ?? 0
  const total = s.total ?? done + pending + failed + skipped
  if (!total) return []

  const isComplete = props.percent >= 100 && total > 0
  const items = [
    { key: 'done', count: done, tone: isComplete ? 'success' : 'done' },
    { key: 'failed', count: failed, tone: 'failed', minPx: MIN_ISSUE_SEGMENT_PX },
    { key: 'skipped', count: skipped, tone: 'skipped', minPx: MIN_ISSUE_SEGMENT_PX }
  ]

  return items.filter((item) => item.count > 0)
})

const progressCounts = computed(() => {
  const s = props.stats
  if (!s) return []

  const done = s.done ?? 0
  const pending = s.pending ?? 0
  const failed = s.failed ?? 0
  const skipped = s.skipped ?? 0
  const total = s.total ?? done + pending + failed + skipped
  const isComplete = props.percent >= 100 && total > 0

  return [
    { key: 'done', value: done, tone: isComplete ? 'success' : 'done' },
    { key: 'failed', value: failed, tone: 'failed' },
    { key: 'skipped', value: skipped, tone: 'skipped' }
  ]
})

const progressTotal = computed(() => {
  const s = props.stats
  if (!s) return 0
  const done = s.done ?? 0
  const pending = s.pending ?? 0
  const failed = s.failed ?? 0
  const skipped = s.skipped ?? 0
  return s.total ?? done + pending + failed + skipped
})

const progressSummaryTooltip = computed(() => {
  const s = props.stats
  if (!s) return ''

  const done = s.done ?? 0
  const failed = s.failed ?? 0
  const skipped = s.skipped ?? 0
  const total = progressTotal.value

  const lines = [
    t('pages.Setting.aiSetting.analysisProgressCountOrder'),
    t('pages.Setting.aiSetting.analysisProgressBreakdown', { done, failed, skipped }),
    t('pages.Setting.aiSetting.analysisProgressTotalHint', { total }),
    t('pages.Setting.aiSetting.analysisProgressPercentHint', { percent: props.percent })
  ]
  if (failed > 0) lines.push(t('pages.Setting.aiSetting.statFailedHint'))
  if (skipped > 0) lines.push(t('pages.Setting.aiSetting.statSkippedHint'))
  return lines.join('\n')
})
</script>

<template>
  <div v-loading="loading" class="ai-sidebar-card analysis-dashboard">
    <div class="analysis-dashboard__head">
      <el-tooltip
        :content="t('pages.Setting.aiSetting.analysisProgressCardDesc')"
        placement="top-start"
        :offset="6"
        :show-after="300"
        popper-class="ai-setting-feature-tip ai-analysis-dashboard-title-tip"
        :popper-options="titleTooltipPopperOptions"
      >
        <h4 class="analysis-dashboard__title">
          {{ t('pages.Setting.aiSetting.analysisProgressCardTitle') }}
        </h4>
      </el-tooltip>
      <div class="analysis-dashboard__head-actions">
        <el-tooltip
          v-if="statusLabel"
          :content="statusTooltip"
          placement="top"
          :disabled="!statusTooltip"
          :show-after="300"
          popper-class="ai-setting-feature-tip"
        >
          <el-tag
            :type="statusTagType"
            size="small"
            effect="plain"
            class="analysis-dashboard__status-tag"
          >
            <span class="analysis-dashboard__status-dot" :class="{ 'is-pulse': running }" />
            {{ statusLabel }}
          </el-tag>
        </el-tooltip>
        <el-tooltip
          :content="t('pages.Setting.aiSetting.requeueRetryableButton')"
          placement="top"
          :show-after="300"
          popper-class="ai-setting-feature-tip"
        >
          <el-button
            class="analysis-dashboard__requeue-btn"
            text
            :aria-label="t('pages.Setting.aiSetting.requeueRetryableButton')"
            @click="emit('requeueRetryable')"
          >
            <IconifyIcon icon="custom:refresh-right" />
          </el-button>
        </el-tooltip>
      </div>
    </div>

    <el-tooltip
      :content="progressSummaryTooltip"
      placement="top-start"
      :offset="6"
      :show-after="300"
      :disabled="!progressSummaryTooltip"
      popper-class="ai-setting-feature-tip ai-analysis-dashboard-title-tip ai-analysis-dashboard-progress-tip"
      :popper-options="titleTooltipPopperOptions"
    >
      <div class="analysis-dashboard__progress-row">
        <div class="analysis-dashboard__counts">
          <template v-for="(item, idx) in progressCounts" :key="item.key">
            <span v-if="idx > 0" class="analysis-dashboard__count-sep">/</span>
            <span
              class="analysis-dashboard__count"
              :class="[
                `analysis-dashboard__count--${item.tone}`,
                { 'is-zero': item.value === 0 }
              ]"
            >
              {{ item.value }}
            </span>
          </template>
          <template v-if="progressTotal > 0">
            <span class="analysis-dashboard__count-sep">/</span>
            <span class="analysis-dashboard__count analysis-dashboard__count--total">{{ progressTotal }}</span>
            <span class="analysis-dashboard__count-unit">{{
              t('pages.Setting.aiSetting.analysisProgressUnit')
            }}</span>
          </template>
        </div>
        <span class="analysis-dashboard__percent">{{ percent }}%</span>
      </div>
    </el-tooltip>
    <div
      class="analysis-dashboard__bar"
      role="progressbar"
      :aria-valuenow="percent"
      aria-valuemin="0"
      aria-valuemax="100"
      :aria-label="progressSummaryTooltip"
    >
      <div
        v-for="segment in progressSegments"
        :key="segment.key"
        class="analysis-dashboard__bar-segment"
          :class="[
            `analysis-dashboard__bar-segment--${segment.tone}`
          ]"
        :style="{
          flexGrow: segment.count,
          minWidth: segment.minPx ? `${segment.minPx}px` : undefined
        }"
      />
    </div>

    <el-tooltip
      v-if="showSpeedChart"
      :content="speedTooltip"
      placement="top-start"
      :show-after="300"
      :disabled="!speedTooltip"
      popper-class="ai-setting-feature-tip ai-analysis-dashboard-title-tip"
      :popper-options="titleTooltipPopperOptions"
    >
      <div class="analysis-dashboard__chart-wrap">
        <AnalysisSpeedSparkline :series="speedSeries" :active="running" />
        <div v-if="showSpeedChart" class="analysis-dashboard__chart-legend">
          <span class="analysis-dashboard__legend-item analysis-dashboard__legend-item--live">
            {{ t('pages.Setting.aiSetting.analysisSpeedChartLive') }}
          </span>
          <span class="analysis-dashboard__legend-item analysis-dashboard__legend-item--avg">
            {{ t('pages.Setting.aiSetting.analysisSpeedChartAvg') }}
          </span>
        </div>
      </div>
    </el-tooltip>

    <el-tooltip
      v-if="speedLine"
      :content="speedTooltip"
      placement="top-start"
      :show-after="300"
      :disabled="!speedTooltip"
      popper-class="ai-setting-feature-tip ai-analysis-dashboard-title-tip"
      :popper-options="titleTooltipPopperOptions"
    >
      <p class="analysis-dashboard__speed">{{ speedLine }}</p>
    </el-tooltip>

    <p v-if="footerHint" class="analysis-dashboard__footer-hint">{{ footerHint }}</p>
  </div>
</template>

<style scoped lang="scss">
.analysis-dashboard {
  flex-shrink: 0;
  box-sizing: border-box;
}

.analysis-dashboard__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 8px;
}

.analysis-dashboard__title {
  margin: 0;
  flex: 1;
  min-width: 0;
  font-size: 12px;
  font-weight: 600;
  line-height: 1.2;
  color: var(--el-text-color-primary);
  cursor: help;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.analysis-dashboard__head-actions {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;
  max-width: 58%;
}

.analysis-dashboard__status-tag {
  flex-shrink: 1;
  min-width: 0;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  max-width: 100%;
  height: 20px;
  padding: 0 6px;
  font-size: 10px;
  line-height: 1.2;

  :deep(.el-tag__content) {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
}

.analysis-dashboard__status-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--el-text-color-placeholder);

  &.is-pulse {
    background: var(--el-color-primary);
    animation: analysis-status-pulse 1.2s ease-in-out infinite;
  }
}

@keyframes analysis-status-pulse {
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

.analysis-dashboard__progress-row {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 6px;
  margin-bottom: 4px;
  font-size: 10px;
  line-height: 1.35;
  cursor: help;
}

.analysis-dashboard__counts {
  display: flex;
  align-items: baseline;
  flex-wrap: wrap;
  flex: 1;
  min-width: 0;
  font-variant-numeric: tabular-nums;
}

.analysis-dashboard__count {
  font-size: 11px;
  font-weight: 600;

  &--done {
    color: var(--el-color-primary);
  }

  &--success {
    color: var(--el-color-success);
  }

  &--failed {
    color: var(--el-color-danger);
  }

  &--skipped {
    color: var(--el-text-color-placeholder);
  }

  &.is-zero {
    opacity: 0.42;
    font-weight: 500;
  }

  &--total {
    color: var(--el-text-color-primary);
  }
}

.analysis-dashboard__count-unit {
  margin-left: 2px;
  font-size: 10px;
  font-weight: 400;
  color: var(--el-text-color-secondary);
}

.analysis-dashboard__count-sep {
  margin: 0 1px;
  color: var(--el-text-color-placeholder);
  font-weight: 400;
}

.analysis-dashboard__percent {
  flex-shrink: 0;
  font-size: 12px;
  font-weight: 600;
  line-height: 1.35;
  color: var(--el-text-color-primary);
}

.analysis-dashboard__bar {
  display: flex;
  height: 6px;
  margin-bottom: 6px;
  border-radius: 100px;
  overflow: hidden;
  background: var(--el-border-color-extra-light);
}

.analysis-dashboard__bar-segment {
  flex-shrink: 0;
  height: 100%;
  min-width: 0;
  transition: flex-grow 0.25s ease;

  &--done {
    background: var(--el-color-primary);
  }

  &--success {
    background: var(--el-color-success);
  }

  &--failed {
    background: var(--el-color-danger);
  }

  &--skipped {
    background: var(--el-text-color-placeholder);
  }
}

.analysis-dashboard__chart-wrap {
  margin-bottom: 4px;
}

.analysis-dashboard__chart-legend {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 4px;
  font-size: 9px;
  line-height: 1.2;
  color: var(--el-text-color-secondary);
}

.analysis-dashboard__legend-item {
  display: inline-flex;
  align-items: center;
  gap: 4px;

  &::before {
    content: '';
    width: 12px;
    height: 2px;
    border-radius: 1px;
  }

  &--live::before {
    background: var(--el-color-primary);
  }

  &--avg::before {
    background: #e8a87c;
  }
}

.analysis-dashboard__speed {
  margin: 0 0 8px;
  font-size: 10px;
  line-height: 1.4;
  color: var(--el-text-color-secondary);
  cursor: help;
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  overflow: hidden;
}

.analysis-dashboard__requeue-btn {
  flex-shrink: 0;
  width: 20px;
  height: 20px;
  padding: 0;
  margin: 0;
  border: 1px solid var(--el-color-primary-light-5);
  border-radius: 4px;
  color: var(--el-color-primary);
  background: transparent;

  &:hover,
  &:focus-visible {
    color: var(--el-color-primary);
    border-color: var(--el-color-primary-light-3);
    background: var(--el-color-primary-light-9);
  }

  :deep(svg) {
    width: 12px;
    height: 12px;
  }
}

.analysis-dashboard__footer-hint {
  margin: 6px 0 0;
  font-size: 10px;
  line-height: 1.35;
  color: var(--el-text-color-secondary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>

<style lang="scss">
.ai-analysis-dashboard-title-tip {
  max-width: 172px !important;
}

.ai-analysis-dashboard-progress-tip {
  white-space: pre-line;
}
</style>
