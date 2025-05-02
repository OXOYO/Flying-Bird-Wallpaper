<script setup>
import UseMenuStore from '@renderer/stores/menuStore.js'

const menuStore = UseMenuStore()

const props = defineProps({
  text: {
    type: String,
    default: ''
  },
  enableJump: {
    type: Boolean,
    default: true
  },
  jumpText: {
    type: String,
    default: ''
  },
  jumpPage: {
    type: String,
    default: 'Setting'
  }
})
const jumpToPage = () => {
  menuStore.setSelected(props.jumpPage || 'Setting')
}
</script>

<template>
  <el-empty class="empty-help" :description="props.text || $t('emptyHelp.text')">
    <el-button v-if="props.enableJump" type="primary" @click="jumpToPage">{{
      props.jumpText || $t('emptyHelp.jumpText')
    }}</el-button>
  </el-empty>
</template>

<style scoped lang="scss">
.empty-help {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
}
</style>
