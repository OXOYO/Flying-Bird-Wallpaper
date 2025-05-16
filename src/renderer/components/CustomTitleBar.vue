<script setup>
import UseCommonStore from '@renderer/stores/commonStore.js'

const commonStore = UseCommonStore()
const { commonData } = storeToRefs(commonStore)

const props = defineProps({
  resizeWindow: {
    type: Boolean,
    default: false
  },
  windowName: String
})

const btns = computed(() => {
  return [
    {
      icon: 'mdi:minus-thick',
      action: 'minimize'
    },
    {
      icon: 'mdi:maximize',
      action: 'maximize'
    },
    {
      icon: 'mdi:close',
      action: 'close'
    }
  ]
})

const onResizeWindow = (action) => {
  window.FBW.resizeWindow(props.windowName, action)
}
</script>

<template>
  <div class="custom-title-bar">
    <template v-if="commonData?.isWin && props.resizeWindow">
      <div
        v-for="item in btns"
        :key="item.icon"
        :class="['resize-btn', 'resize-btn__' + item.action]"
        @click="onResizeWindow(item.action)"
      >
        <IconifyIcon class="resize-btn-icon" :icon="item.icon" />
      </div>
    </template>
  </div>
</template>

<style scoped lang="scss">
.custom-title-bar {
  background: transparent;
  display: flex;
  justify-content: flex-end;
  align-items: center;
  gap: 0;
  padding: 0;
  margin: 0;
  /* 避免被收缩 */
  flex-shrink: 0;
  /* 高度与 main.js 中 titleBarOverlay.height 一致  */
  height: 35px;
  width: 100%;
  /* 标题栏始终在最顶层（避免后续被 Modal 之类的覆盖） */
  z-index: 9999;
  color: white;
  font-size: 14px;
  user-select: none;
  /* 设置该属性表明这是可拖拽区域，用来移动窗口 */
  -webkit-app-region: drag;
}

.resize-btn {
  -webkit-app-region: no-drag;
  cursor: pointer;
  font-size: 18px;
  width: 45px;
  height: 100%;
  color: var(--primary-color);
  display: flex;
  justify-content: center;
  align-items: center;

  &:hover {
    background-color: rgba(0, 0, 0, 0.1);
  }
  &:active {
    opacity: 0.8;
  }

  &.resize-btn__close {
    &:hover {
      background-color: #c42b1c;
    }
  }

  .resize-btn-icon {
  }
}
</style>
