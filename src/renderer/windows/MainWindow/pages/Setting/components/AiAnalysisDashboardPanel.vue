<script setup>
import { useTranslation } from 'i18next-vue'

defineProps({
  loading: { type: Boolean, default: false },
  stats: { type: Object, default: null },
  enableEmbedding: { type: Boolean, default: false },
  percent: { type: Number, default: 0 },
  statusLabel: { type: String, default: '' },
  statusTagType: { type: String, default: 'info' },
  summary: { type: String, default: '' },
  footerHint: { type: String, default: '' },
  running: { type: Boolean, default: false },
  statusTooltip: { type: String, default: '' }
})

const { t } = useTranslation()
</script>

<template>
  <div v-loading="loading" class="ai-sidebar-card analysis-dashboard">
    <div class="analysis-dashboard__head">
      <el-tooltip
        :content="t('pages.Setting.aiSetting.analysisProgressCardDesc')"
        placement="right"
        :show-after="300"
        popper-class="ai-setting-feature-tip"
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

    <div class="analysis-dashboard__chips">
      <span class="stat-chip stat-chip--done">
        {{ t('pages.Setting.aiSetting.statDoneLabel') }} {{ stats?.done ?? 0 }}
      </span>
      <span class="stat-chip stat-chip--pending">
        {{ t('pages.Setting.aiSetting.statPendingLabel') }} {{ stats?.pending ?? 0 }}
      </span>
      <span class="stat-chip stat-chip--failed">
        {{ t('pages.Setting.aiSetting.statFailedLabel') }} {{ stats?.failed ?? 0 }}
      </span>
      <span v-if="enableEmbedding" class="stat-chip stat-chip--embedding">
        {{ t('pages.Setting.aiSetting.statEmbeddingLabel') }} {{ stats?.embedding ?? 0 }}
      </span>
      <span v-if="(stats?.skipped ?? 0) > 0" class="stat-chip stat-chip--skipped">
        {{ t('pages.Setting.aiSetting.statSkippedLabel') }} {{ stats?.skipped ?? 0 }}
      </span>
    </div>

    <p v-if="footerHint" class="analysis-dashboard__footer-hint">{{ footerHint }}</p>
  </div>
</template>

<style scoped lang="scss">
.analysis-dashboard {
  flex-shrink: 0;
  margin-top: auto;
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
  margin-bottom: 8px;
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

  &--embedding {
    color: var(--el-color-primary);
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
