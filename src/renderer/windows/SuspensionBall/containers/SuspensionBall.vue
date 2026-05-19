<script setup>
import { useTranslation } from 'i18next-vue'
import UseSettingStore from '@renderer/stores/settingStore.js'
import iconLogo from '@resources/icons/icon_64x64.png'

const { t } = useTranslation()
const settingStore = UseSettingStore()
const { settingData } = storeToRefs(settingStore)

const isExpanded = ref(false)
/** true：LOGO 在左、工具栏向右展开（悬浮球在屏幕左侧时） */
const expandToRight = ref(false)
const isDragging = ref(false)
const suppressHover = ref(false)
const pointerStart = ref(null)
const moveThreshold = 5
let collapseTimer = null
let dragListening = false
let dragActivated = false
const logoHitRef = ref(null)
const hoveredTip = ref('')

const autoSwitchLabel = computed(() =>
  settingData.value.autoSwitchWallpaper
    ? t('actions.autoSwitchWallpaper.stop')
    : t('actions.autoSwitchWallpaper.start')
)

const setBallMode = async (mode) => {
  if (typeof window.FBW?.setSuspensionBallMode !== 'function') return
  const res = await window.FBW.setSuspensionBallMode(mode)
  if (res?.expandDirection) {
    expandToRight.value = res.expandDirection === 'right'
  }
}

const canHoverExpand = () => !suppressHover.value && !isDragging.value

const syncExpandDirection = async () => {
  const res = await window.FBW.peekSuspensionBallExpandDirection()
  if (res?.success && res.expandDirection) {
    expandToRight.value = res.expandDirection === 'right'
  }
}

const onMouseEnter = async () => {
  if (!canHoverExpand()) return
  if (collapseTimer) {
    clearTimeout(collapseTimer)
    collapseTimer = null
  }
  await syncExpandDirection()
  isExpanded.value = true
  await nextTick()
  await setBallMode('expanded')
  if (!canHoverExpand()) {
    isExpanded.value = false
    await setBallMode('collapsed')
    return
  }
}

const onMouseLeave = () => {
  if (!canHoverExpand()) return
  if (collapseTimer) clearTimeout(collapseTimer)
  collapseTimer = setTimeout(async () => {
    collapseTimer = null
    if (!canHoverExpand()) return
    hoveredTip.value = ''
    isExpanded.value = false
    await nextTick()
    await setBallMode('collapsed')
  }, 280)
}

const detachDragListeners = () => {
  if (!dragListening) return
  document.removeEventListener('pointermove', onDocumentPointerMove)
  document.removeEventListener('pointerup', onDocumentPointerUp)
  document.removeEventListener('pointercancel', onDocumentPointerUp)
  dragListening = false
}

const onDocumentPointerMove = async (e) => {
  if (!dragListening || !pointerStart.value || dragActivated) return

  const distance = Math.hypot(e.screenX - pointerStart.value.x, e.screenY - pointerStart.value.y)
  if (distance <= moveThreshold) return

  dragActivated = true
  isDragging.value = true
  await window.FBW.suspensionBallDragActivate()
}

const onDocumentPointerUp = async (e) => {
  if (!dragListening) return

  try {
    logoHitRef.value?.releasePointerCapture?.(e.pointerId)
  } catch (_) {
    /* noop */
  }

  detachDragListeners()

  const wasDrag = isDragging.value
  await window.FBW.suspensionBallDragEnd()

  if (!wasDrag) {
    window.FBW.toggleMainWindow()
  }

  pointerStart.value = null
  isDragging.value = false
  dragActivated = false
  setTimeout(() => {
    suppressHover.value = false
  }, 320)
}

const onPointerDown = async (e) => {
  if (e.button !== 0) return

  suppressHover.value = true
  detachDragListeners()

  if (collapseTimer) {
    clearTimeout(collapseTimer)
    collapseTimer = null
  }
  hoveredTip.value = ''
  isExpanded.value = false
  isDragging.value = false
  dragActivated = false
  pointerStart.value = { x: e.screenX, y: e.screenY }

  try {
    logoHitRef.value?.setPointerCapture?.(e.pointerId)
  } catch (_) {
    /* noop */
  }

  await setBallMode('collapsed')
  await window.FBW.suspensionBallDragPrepare()

  dragListening = true
  document.addEventListener('pointermove', onDocumentPointerMove)
  document.addEventListener('pointerup', onDocumentPointerUp)
  document.addEventListener('pointercancel', onDocumentPointerUp)
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
  window.FBW.onSettingDataUpdate(onSettingDataUpdateCallback)
})

onMounted(async () => {
  await setBallMode('collapsed')
  const res = await window.FBW.getSettingData()
  if (res.success && res.data) {
    settingStore.updateSettingData(res.data)
  }
})

onBeforeUnmount(() => {
  if (collapseTimer) clearTimeout(collapseTimer)
  detachDragListeners()
  void window.FBW.suspensionBallDragEnd()
  window.FBW.offSettingDataUpdate(onSettingDataUpdateCallback)
})
</script>

<template>
  <div
    class="window-container"
    :class="{
      'window-container--expanded': isExpanded,
      'window-container--expand-right': expandToRight && isExpanded,
      'window-container--expand-left': !expandToRight && isExpanded
    }"
    @mouseenter="onMouseEnter"
    @mouseleave="onMouseLeave"
  >
    <div class="window-inner">
      <div v-show="isExpanded" class="ball-tip-row">
        <span class="ball-tip">{{ hoveredTip }}</span>
      </div>
      <div class="ball-main-row">
        <div v-show="!isExpanded" class="drag-surface" aria-hidden="true" />
        <div ref="logoHitRef" class="logo-hit" @pointerdown.prevent="onPointerDown">
        <el-avatar class="logo-btn" :size="30" :src="iconLogo" shape="circle" draggable="false" />
      </div>
      <div v-show="isExpanded" class="toolbar">
          <div
            class="tool-item tool-item--play"
            @mouseenter="hoveredTip = autoSwitchLabel"
            @mouseleave="hoveredTip = ''"
          >
            <el-button class="tool-btn" link @click.stop="onToolClick('toggleAutoSwitchWallpaper')">
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
          </div>
          <div
            class="tool-item tool-item--prev"
            @mouseenter="hoveredTip = $t('actions.prevWallpaper')"
            @mouseleave="hoveredTip = ''"
          >
            <el-button class="tool-btn" link @click.stop="onToolClick('prevWallpaper')">
              <IconifyIcon class="tool-btn-icon" icon="custom:skip-previous-outline-rounded" />
            </el-button>
          </div>
          <div
            class="tool-item tool-item--next"
            @mouseenter="hoveredTip = $t('actions.nextWallpaper')"
            @mouseleave="hoveredTip = ''"
          >
            <el-button class="tool-btn" link @click.stop="onToolClick('nextWallpaper')">
              <IconifyIcon class="tool-btn-icon" icon="custom:skip-next-outline-rounded" />
            </el-button>
          </div>
          <div
            class="tool-item tool-item--close"
            @mouseenter="hoveredTip = $t('actions.closeSuspensionBall')"
            @mouseleave="hoveredTip = ''"
          >
            <el-button class="tool-btn tool-btn-close" link @click.stop="onToolClick('closeSuspensionBall')">
              <IconifyIcon class="tool-btn-icon" icon="custom:close-circle" />
            </el-button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.window-container {
  width: 100%;
  height: 100%;
  box-sizing: border-box;
  padding: 0;
  background-color: transparent;
  overflow: hidden;

  .window-inner {
    position: relative;
    width: 100%;
    height: 100%;
    box-sizing: border-box;
    border-radius: 16px;
    overflow: hidden;
    -webkit-app-region: no-drag;
    transition: background-color 0.2s ease;
  }

  .ball-tip-row {
    position: absolute;
    top: 3px;
    left: 0;
    right: 0;
    z-index: 2;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0 10px;
    box-sizing: border-box;
    pointer-events: none;
  }

  .ball-tip {
    width: 100%;
    text-align: center;
    font-size: 10px;
    line-height: 1.2;
    color: rgba(245, 245, 245, 0.92);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .ball-main-row {
    width: 100%;
    height: 100%;
    display: flex;
    flex-direction: row;
    align-items: center;
    justify-content: flex-end;
    gap: 14px;
    padding: 0 12px 0 10px;
    box-sizing: border-box;
  }

  .drag-surface {
    flex: 1;
    min-width: 6px;
    align-self: stretch;
    -webkit-app-region: drag;
  }

  &--expanded .window-inner {
    background-color: rgba(50, 57, 65, 0.9);
  }

  /* 屏幕左侧：LOGO 在左，工具栏向右展开 */
  &--expand-right.window-container--expanded .ball-main-row {
    flex-direction: row;
    justify-content: flex-start;
  }

  /* 屏幕右侧：工具栏在左，LOGO 在右，整体向左展开 */
  &--expand-left.window-container--expanded .ball-main-row {
    flex-direction: row-reverse;
    justify-content: flex-end;
  }

  .toolbar {
    display: flex;
    flex-direction: row;
    align-items: center;
    flex: 0 0 auto;
    gap: 6px;
    -webkit-app-region: no-drag;
  }

  /* 向左展开：关闭钮靠最外侧，上一张/下一张顺序与向右展开一致 */
  &--expand-left .toolbar {
    flex-direction: row;
  }

  &--expand-left .tool-item--close {
    order: 1;
  }

  &--expand-left .tool-item--prev {
    order: 2;
  }

  &--expand-left .tool-item--next {
    order: 3;
  }

  &--expand-left .tool-item--play {
    order: 4;
  }

  .tool-item {
    display: inline-flex;
    flex-shrink: 0;
  }

  &--expand-right .tool-item--close {
    margin-left: 2px;
  }

  &--expand-left .tool-item--close {
    margin-right: 2px;
  }

  .logo-hit {
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    touch-action: none;
  }

  .logo-btn {
    flex-shrink: 0;
    -webkit-app-region: no-drag;
    background-color: transparent;
    cursor: pointer;
    user-select: none;

    :deep(img) {
      pointer-events: none;
      user-select: none;
    }
  }

  .tool-btn {
    margin: 0;
    padding: 5px;
    border-radius: 8px;
    transition: background-color 0.15s ease;

    &:hover {
      background-color: rgba(255, 255, 255, 0.16);
    }

    &:hover:not(.tool-btn-close) .tool-btn-icon {
      color: #ffffff;
    }

    &:active:not(.tool-btn-close) .tool-btn-icon {
      color: #67c23a;
    }

    &.tool-btn-close:hover {
      background-color: rgba(245, 108, 108, 0.28);
    }

    &.tool-btn-close:hover .tool-btn-icon {
      color: #ff9e9e;
    }

    &.tool-btn-close:active .tool-btn-icon {
      color: #f56c6c;
    }

    .tool-btn-icon {
      font-size: 22px;
      color: #e0e0e0;
      display: block;
      transition: color 0.15s ease;

      &.switch-btn-pause {
        color: #67c23a;
      }

      &.switch-btn-play {
        color: #e6a23c;
      }
    }

    &.tool-btn-close .tool-btn-icon {
      color: #f0a0a0;
    }
  }
}
</style>
