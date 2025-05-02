<script setup>
import ExploreCommon from '../components/ExploreCommon.vue'

const props = defineProps({
  menuParams: Object
})
</script>

<template>
  <explore-common menu="Explore" class="page-explore" :menu-params="props.menuParams" />
</template>

<style scoped lang="scss"></style>
