<template>
  <div class="page-empty">
    <van-empty :image="props.image" :description="description" />
  </div>
</template>

<script setup>
import { useTranslation } from 'i18next-vue'

const { t } = useTranslation()

const props = defineProps({
  image: {
    type: String,
    default: 'default'
  },
  description: {
    type: String,
    default: ''
  }
})

const description = computed(() => {
  return props.description || t('comingSoon')
})
</script>

<style scoped>
.page-empty {
  width: 100%;
  height: 100vh;
  display: flex;
  justify-content: center;
  align-items: center;
}
</style>
