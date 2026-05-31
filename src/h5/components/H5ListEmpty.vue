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
    <pageEmpty fill-parent :description="description" />
  </div>
</template>

<style scoped lang="scss">
.h5-list-empty {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  min-height: 0;
  box-sizing: border-box;
}

.h5-list-empty :deep(.page-empty) {
  height: 100%;
  min-height: 0;
}

.h5-list-empty :deep(.van-empty) {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}
</style>
