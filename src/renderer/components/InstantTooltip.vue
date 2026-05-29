<script setup>
defineProps({
  content: { type: String, default: '' },
  placement: { type: String, default: 'top' },
  disabled: { type: Boolean, default: false }
})
</script>

<template>
  <el-tooltip
    v-if="content && !disabled"
    :content="content"
    :placement="placement"
    :show-after="0"
    :hide-after="0"
  >
    <span class="instant-tooltip-trigger"><slot /></span>
  </el-tooltip>
  <span v-else class="instant-tooltip-trigger"><slot /></span>
</template>

<style scoped lang="scss">
.instant-tooltip-trigger {
  display: inline-flex;
  max-width: 100%;
  vertical-align: top;
}
</style>
