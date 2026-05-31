<script setup>
import { useTranslation } from 'i18next-vue'

defineProps({
  tooltipKey: { type: String, default: 'pages.Setting.aiSetting.copyApiKey' }
})

const emit = defineEmits(['copy'])

const { t } = useTranslation()

const onClick = () => emit('copy')
</script>

<template>
  <el-tooltip
    :content="t(tooltipKey)"
    placement="top"
    :show-after="300"
    popper-class="ai-setting-feature-tip"
  >
    <el-button class="ai-icon-action-btn" :aria-label="t(tooltipKey)" @click="onClick">
      <IconifyIcon icon="custom:copy" />
    </el-button>
  </el-tooltip>
</template>

<style scoped lang="scss">
.ai-icon-action-btn {
  padding: 8px;
  min-width: 32px;
}
</style>
