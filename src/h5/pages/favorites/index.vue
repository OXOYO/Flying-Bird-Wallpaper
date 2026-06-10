<script setup>
import H5ResourceBrowseView from '@h5/components/H5ResourceBrowseView.vue'

const browseRef = ref(null)

defineExpose({
  refresh: () => browseRef.value?.refresh?.(),
  init: () => browseRef.value?.init?.()
})
</script>

<template>
  <H5ResourceBrowseView
    ref="browseRef"
    browse-type="favorites"
    nsfw-page-key="h5:favorites"
    display-mode-storage-key="fbw_h5_favorites_display_mode"
    :remove-on-unfavorite="true"
  />
</template>
