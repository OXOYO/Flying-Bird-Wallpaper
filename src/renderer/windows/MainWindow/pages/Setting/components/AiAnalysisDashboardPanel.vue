<script setup>
import { computed } from 'vue'
import { useTranslation } from 'i18next-vue'

const props = defineProps({
  loading: { type: Boolean, default: false },
  stats: { type: Object, default: null },
  percent: { type: Number, default: 0 },
  statusLabel: { type: String, default: '' },
  statusTagType: { type: String, default: 'info' },
  summary: { type: String, default: '' },
  footerHint: { type: String, default: '' },
  running: { type: Boolean, default: false },
  statusTooltip: { type: String, default: '' },
  speedLine: { type: String, default: '' },
  speedTooltip: { type: String, default: '' }
})

const emit = defineEmits(['requeueFailed', 'requeueSkipped', 'requeueRetryable'])

const { t } = useTranslation()

const retryableCount = computed(
  () => (Number(props.stats?.failed) || 0) + (Number(props.stats?.skipped) || 0)
)

const onFailedChipClick = () => {
  if (!(Number(props.stats?.failed) > 0)) return
  emit('requeueFailed')
}

const onSkippedChipClick = () => {
  if (!(Number(props.stats?.skipped) > 0)) return
  emit('requeueSkipped')
}

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
    </div>

    <div class="analysis-dashboard__progress-row">
      <span class="analysis-dashboard__summary">{{ summary }}</span>
      <span class="analysis-dashboard__percent">{{ percent }}%</span>
    </div>
    <el-progress
      class="analysis-dashboard__bar"
      :percentage="percent"
      :stroke-width="6"
      :show-text="false"
      :striped="running"
      :striped-flow="running"
      :status="running ? undefined : percent >= 100 && stats?.total ? 'success' : undefined"
    />

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

    <div class="analysis-dashboard__chips">
      <span class="stat-chip stat-chip--done">
        {{ t('pages.Setting.aiSetting.statDoneLabel') }} {{ stats?.done ?? 0 }}
      </span>
      <span class="stat-chip stat-chip--pending">
        {{ t('pages.Setting.aiSetting.statPendingLabel') }} {{ stats?.pending ?? 0 }}
      </span>
      <el-tooltip
        :content="t('pages.Setting.aiSetting.statFailedHint')"
        placement="top"
        :disabled="!(stats?.failed > 0)"
        :show-after="300"
        popper-class="ai-setting-feature-tip"
      >
        <span
          class="stat-chip stat-chip--failed"
          :class="{ 'stat-chip--clickable': (stats?.failed ?? 0) > 0 }"
          role="button"
          :tabindex="(stats?.failed ?? 0) > 0 ? 0 : -1"
          @click="onFailedChipClick"
          @keydown.enter.prevent="onFailedChipClick"
        >
          {{ t('pages.Setting.aiSetting.statFailedLabel') }} {{ stats?.failed ?? 0 }}
        </span>
      </el-tooltip>
      <el-tooltip
        :content="t('pages.Setting.aiSetting.statSkippedHint')"
        placement="top"
        :disabled="!(stats?.skipped > 0)"
        :show-after="300"
        popper-class="ai-setting-feature-tip"
      >
        <span
          class="stat-chip stat-chip--skipped"
          :class="{ 'stat-chip--clickable': (stats?.skipped ?? 0) > 0 }"
          role="button"
          :tabindex="(stats?.skipped ?? 0) > 0 ? 0 : -1"
          @click="onSkippedChipClick"
          @keydown.enter.prevent="onSkippedChipClick"
        >
          {{ t('pages.Setting.aiSetting.statSkippedLabel') }} {{ stats?.skipped ?? 0 }}
        </span>
      </el-tooltip>
    </div>

    <el-button
      v-if="retryableCount > 0"
      class="analysis-dashboard__requeue-btn"
      type="primary"
      size="small"
      text
      @click="emit('requeueRetryable')"
    >
      {{ t('pages.Setting.aiSetting.requeueRetryableButton') }}
    </el-button>

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

.analysis-dashboard__status-tag {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  max-width: 52%;
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
  color: var(--el-text-color-secondary);
}

.analysis-dashboard__summary {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.analysis-dashboard__percent {
  flex-shrink: 0;
  font-size: 12px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.analysis-dashboard__bar {
  margin-bottom: 6px;
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

.analysis-dashboard__chips {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.stat-chip {
  padding: 2px 5px;
  border-radius: 4px;
  font-size: 10px;
  line-height: 1.3;
  background: var(--el-fill-color-light);
  border: 1px solid var(--el-border-color-lighter);
  white-space: nowrap;

  &--done {
    color: var(--el-color-success);
  }

  &--pending {
    color: var(--el-color-warning);
  }

  &--failed {
    color: var(--el-color-danger);
  }

  &--skipped {
    color: var(--el-text-color-secondary);
  }

  &--clickable {
    cursor: pointer;
  }

  &--clickable.stat-chip--failed:hover {
    background: var(--el-color-danger-light-9);
    border-color: var(--el-color-danger-light-5);
  }

  &--clickable.stat-chip--skipped:hover {
    background: var(--el-fill-color);
    border-color: var(--el-border-color);
  }
}

.analysis-dashboard__requeue-btn {
  margin-top: 8px;
  padding: 0;
  height: auto;
  font-size: 11px;
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
</style>
