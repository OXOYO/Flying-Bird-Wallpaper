<script setup>
import pageEmpty from '@h5/components/pageEmpty.vue'

defineProps({
  description: {
    type: String,
    default: ''
  }
})
</script>

<template>
  <div class="h5-list-empty">
    <pageEmpty :description="description" />
  </div>
</template>

<style scoped lang="scss">
.h5-list-empty {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 320px;
  width: 100%;
}

.h5-list-empty :deep(.page-empty) {
  height: auto;
  min-height: 280px;
}
</style>
