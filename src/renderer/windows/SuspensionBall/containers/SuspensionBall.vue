<script setup>
import UseSettingStore from '@renderer/stores/settingStore.js'
import iconLogo from '@resources/icons/icon_64x64.png'

const settingStore = UseSettingStore()
const { settingData } = storeToRefs(settingStore)

// 添加拖拽相关的状态
const startPos = ref(null)
const isDragging = ref(false)
const moveThreshold = 5
const windowStartPos = ref(null) // 添加窗口初始位置

const onMouseDown = async (e) => {
  startPos.value = { x: e.screenX, y: e.screenY }
  windowStartPos.value = await window.FBW.getWindowPosition('suspensionBall')
  isDragging.value = false
  window.addEventListener('mousemove', onMouseMove, { passive: true })
  window.addEventListener('mouseup', onMouseUp)
}

const onMouseMove = (e) => {
  if (!startPos.value || !windowStartPos.value) return

  const deltaX = e.screenX - startPos.value.x
  const deltaY = e.screenY - startPos.value.y
  const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY)

  if (distance > moveThreshold || isDragging.value) {
    isDragging.value = true
    // 使用窗口初始位置加上总位移
    const newX = windowStartPos.value.x + deltaX
    const newY = windowStartPos.value.y + deltaY
    window.FBW.setWindowPosition('suspensionBall', { x: newX, y: newY })
  }
}

const onMouseUp = () => {
  if (!isDragging.value) {
    // 如果没有拖拽，则认为是点击事件
    window.FBW.toggleMainWindow()
  }

  startPos.value = null
  isDragging.value = false
  window.removeEventListener('mousemove', onMouseMove)
  window.removeEventListener('mouseup', onMouseUp)
}

const onToolClick = async (funcName) => {
  if (typeof window.FBW[funcName] === 'function') {
    await window.FBW[funcName]()
  }
}

const onSettingDataUpdateCallback = (event, data) => {
  settingStore.updateSettingData(data)
}

onBeforeMount(() => {
  // 监听设置数据更新事件
  window.FBW.onSettingDataUpdate(onSettingDataUpdateCallback)
})

onMounted(async () => {
  // 查询设置数据
  const res = await window.FBW.getSettingData()
  if (res.success && res.data) {
    settingStore.updateSettingData(res.data)
  }
})

onBeforeUnmount(() => {
  // 取消监听设置数据更新事件
  window.FBW.offSettingDataUpdate(onSettingDataUpdateCallback)
})
</script>

<template>
  <div class="window-container">
    <div class="window-inner">
      <el-avatar
        class="logo-btn"
        :size="30"
        :src="iconLogo"
        shape="circle"
        draggable="false"
        @mousedown.prevent="onMouseDown"
      />
      <div class="btn-wrapper">
        <el-button
          class="tool-btn"
          :title="
            settingData.autoSwitchWallpaper
              ? $t('actions.autoSwitchWallpaper.stop')
              : $t('actions.autoSwitchWallpaper.start')
          "
          link
          @click="onToolClick('toggleAutoSwitchWallpaper')"
        >
          <IconifyIcon
            :class="[
              'tool-btn-icon',
              settingData.autoSwitchWallpaper ? 'switch-btn-pause' : 'switch-btn-play'
            ]"
            :icon="
              settingData.autoSwitchWallpaper
                ? 'custom:pause-circle-outline-rounded'
                : 'custom:play-circle-outline-rounded'
            "
          />
        </el-button>
        <el-button
          class="tool-btn"
          :title="$t('actions.nextWallpaper')"
          link
          @click="onToolClick('nextWallpaper')"
        >
          <IconifyIcon class="tool-btn-icon" icon="custom:skip-next-outline-rounded" />
        </el-button>
        <el-button
          class="tool-btn"
          :title="$t('actions.prevWallpaper')"
          link
          @click="onToolClick('prevWallpaper')"
        >
          <IconifyIcon class="tool-btn-icon" icon="custom:skip-previous-outline-rounded" />
        </el-button>
        <el-button
          class="tool-btn tool-btn-close"
          :title="$t('actions.closeSuspensionBall')"
          link
          @click="onToolClick('closeSuspensionBall')"
        >
          <IconifyIcon class="tool-btn-icon" icon="custom:circle-close" />
        </el-button>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.window-container {
  width: 100%;
  height: 100%;
  padding: 4px;
  background-color: transparent;

  &:hover {
    .window-inner {
      background-color: rgba(50, 57, 65, 0.6);
      box-shadow: 0 0 6px rgba(0, 0, 0, 0.12);
    }

    .btn-wrapper {
      visibility: visible;
    }
  }

  .window-inner {
    width: 100%;
    height: 100%;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    align-items: center;
    position: relative;
    border-radius: 4px;
    padding: 15px 10px 10px;
    transition: all 0.3s ease-in-out;
  }
  .logo-btn {
    -webkit-app-region: no-drag;
    background-color: transparent;
    cursor: pointer;
    user-select: none;
    -webkit-user-drag: none;

    :deep(img) {
      pointer-events: none;
      user-select: none;
      -webkit-user-drag: none;
      draggable: false;
    }
  }

  .btn-wrapper {
    width: 100%;
    display: flex;
    flex-direction: column;
    justify-content: flex-end;
    align-items: center;
    visibility: hidden;
  }

  .tool-btn {
    margin: 0;
    &:hover {
      opacity: 0.8;
    }

    &:active {
      opacity: 0.6;
      .tool-btn-icon {
        color: #67c23a;
      }
    }

    &.tool-btn-close {
      margin-top: 10px;
      .tool-btn-icon {
        color: red;
      }
    }

    .tool-btn-icon {
      font-size: 28px;
      color: #dddddd;

      &.switch-btn-pause {
        color: #67c23a;
      }

      &.switch-btn-play {
        color: #e6a23c;
      }
    }
  }
}
</style>
