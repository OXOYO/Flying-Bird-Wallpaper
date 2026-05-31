<script setup>
import UseCommonStore from '@h5/stores/commonStore.js'
import search from '@h5/pages/search/index.vue'
import collections from '@h5/pages/collections/index.vue'
import favorites from '@h5/pages/favorites/index.vue'
import history from '@h5/pages/history/index.vue'

const commonStore = UseCommonStore()
const { activeBrowsePage } = storeToRefs(commonStore)

const browsePages = {
  search,
  collections,
  favorites,
  history
}

const currentBrowsePage = computed(() => browsePages[activeBrowsePage.value] || search)

const browseRef = ref(null)

const refresh = () => browseRef.value?.refresh?.()
const init = () => browseRef.value?.init?.()

defineExpose({ refresh, init })
</script>

<template>
  <keep-alive>
    <component :is="currentBrowsePage" ref="browseRef" />
  </keep-alive>
</template>
