<script setup>
defineProps({
  label: { type: String, required: true },
  hint: { type: String, required: true }
})
</script>

<template>
  <span class="form-item-label-with-tip">
    <span class="form-item-label-with-tip__text">{{ label }}</span>
    <el-tooltip
      :content="hint"
      placement="top"
      :show-after="300"
      popper-class="ai-setting-feature-tip"
    >
      <span
        class="form-item-tip-trigger"
        tabindex="0"
        role="button"
        :aria-label="hint"
        @click.stop
      >
        <IconifyIcon icon="custom:info-outline-rounded" />
      </span>
    </el-tooltip>
  </span>
</template>
