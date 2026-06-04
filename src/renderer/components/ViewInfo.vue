<script setup>
import { useTranslation } from 'i18next-vue'
import { infoKeys } from '@common/publicData.js'
import { handleInfoVal } from '@common/utils.js'
import { cloneForIpc } from '@renderer/utils/cloneForIpc.js'

const { t } = useTranslation()

const flags = reactive({
  visible: false
})

const info = ref({})
const previewStageRef = ref(null)
const isPanning = ref(false)

const transform = reactive({
  scale: 1,
  rotate: 0,
  scaleX: 1,
  scaleY: 1,
  x: 0,
  y: 0,
  originX: '50%',
  originY: '50%'
})

const previewSrc = computed(() => info.value.rawImageUrl || info.value.imageSrc || '')

const transformStyle = computed(() => ({
  transform: [
    `translate(${transform.x}px, ${transform.y}px)`,
    `rotate(${transform.rotate}deg)`,
    `scale(${transform.scale * transform.scaleX}, ${transform.scale * transform.scaleY})`
  ].join(' '),
  transformOrigin: `${transform.originX} ${transform.originY}`,
  transition: isPanning.value ? 'none' : 'transform 0.2s ease'
}))

const clampScale = (value) => Math.max(0.1, Math.min(5, value))

const resetPreviewTransform = () => {
  transform.scale = 1
  transform.rotate = 0
  transform.scaleX = 1
  transform.scaleY = 1
  transform.x = 0
  transform.y = 0
  transform.originX = '50%'
  transform.originY = '50%'
}

const loadResourceTags = async (row) => {
  if (!row || !window.FBW?.getResourceTags) return row
  try {
    const res = await window.FBW.getResourceTags(cloneForIpc(row))
    if (res?.success && Array.isArray(res.data) && res.data.length) {
      return { ...row, _tagWords: res.data }
    }
  } catch {
    /* ignore */
  }
  return row
}

const zoomBy = (factor) => {
  transform.scale = clampScale(transform.scale * factor)
}

const toggleOneToOne = () => {
  if (transform.scale === 1 && transform.x === 0 && transform.y === 0) {
    transform.scale = 2
    return
  }
  transform.scale = 1
  transform.x = 0
  transform.y = 0
  transform.originX = '50%'
  transform.originY = '50%'
}

const rotateLeft = () => {
  transform.rotate -= 90
}

const rotateRight = () => {
  transform.rotate += 90
}

const flipHorizontal = () => {
  transform.scaleX *= -1
}

const flipVertical = () => {
  transform.scaleY *= -1
}

const handleWheel = (e) => {
  e.preventDefault()
  const rect = e.currentTarget.getBoundingClientRect()
  const mouseX = e.clientX - rect.left
  const mouseY = e.clientY - rect.top
  transform.originX = `${(mouseX / rect.width) * 100}%`
  transform.originY = `${(mouseY / rect.height) * 100}%`
  const deltaY = e.deltaY || e.deltaZ || 0
  const delta = deltaY > 0 ? 0.9 : 1.1
  transform.scale = clampScale(transform.scale * delta)
}

let panStart = null

const onPanMouseDown = (e) => {
  if (e.button !== 0) return
  e.preventDefault()
  isPanning.value = true
  panStart = {
    x: e.clientX,
    y: e.clientY,
    baseX: transform.x,
    baseY: transform.y
  }
  document.addEventListener('mousemove', onPanMouseMove)
  document.addEventListener('mouseup', onPanMouseUp)
}

const onPanMouseMove = (e) => {
  if (!panStart) return
  transform.x = panStart.baseX + (e.clientX - panStart.x)
  transform.y = panStart.baseY + (e.clientY - panStart.y)
}

const onPanMouseUp = () => {
  isPanning.value = false
  panStart = null
  document.removeEventListener('mousemove', onPanMouseMove)
  document.removeEventListener('mouseup', onPanMouseUp)
}

const view = async (item) => {
  resetPreviewTransform()
  flags.visible = true
  info.value = item ? { ...item } : {}
  if (item) {
    info.value = await loadResourceTags(info.value)
  }
}

const handleClose = () => {
  onPanMouseUp()
  flags.visible = false
  resetPreviewTransform()
}

const onContainerClick = (e) => {
  e.stopPropagation()
}

onUnmounted(() => {
  onPanMouseUp()
})

defineExpose({
  view
})
</script>

<template>
  <div v-if="flags.visible" class="view-info-wrapper">
    <div class="view-info-backdrop" @click.self="handleClose"></div>
    <div class="view-info-close" @click="handleClose">
      <IconifyIcon class="close-icon" icon="custom:close-rounded" />
    </div>
    <div class="view-info-container" @click="onContainerClick">
      <div class="image-block">
        <div
          ref="previewStageRef"
          class="image-preview-stage"
          :class="{ 'image-preview-stage--panning': isPanning }"
          @wheel="handleWheel"
          @mousedown="onPanMouseDown"
        >
          <div class="image-preview-transform" :style="transformStyle">
            <el-image
              v-if="previewSrc"
              :key="previewSrc"
              class="image-preview-inner"
              :src="previewSrc"
              fit="contain"
            />
          </div>
        </div>
        <div class="image-preview-toolbar">
          <div class="viewer-toolbar">
            <ul>
              <li role="button" tabindex="0" class="viewer-zoom-in" @click="zoomBy(1.1)" />
              <li role="button" tabindex="0" class="viewer-zoom-out" @click="zoomBy(0.9)" />
              <li role="button" tabindex="0" class="viewer-one-to-one" @click="toggleOneToOne" />
              <li role="button" tabindex="0" class="viewer-reset" @click="resetPreviewTransform" />
              <li role="button" tabindex="0" class="viewer-rotate-left" @click="rotateLeft" />
              <li role="button" tabindex="0" class="viewer-rotate-right" @click="rotateRight" />
              <li role="button" tabindex="0" class="viewer-flip-horizontal" @click="flipHorizontal" />
              <li role="button" tabindex="0" class="viewer-flip-vertical" @click="flipVertical" />
            </ul>
          </div>
        </div>
      </div>
      <el-scrollbar class="info-block">
        <div v-for="key in infoKeys" :key="key" class="info-row">
          <div class="info-key">{{ t(`viewInfo.row.${key}`) }}:</div>
          <div class="info-value">{{ handleInfoVal(info, key, t) }}</div>
        </div>
      </el-scrollbar>
    </div>
  </div>
</template>

<style scoped lang="scss">
.view-info-wrapper {
  position: fixed;
  top: 35px;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 1000;
  display: flex;
  justify-content: center;
  align-items: center;
  pointer-events: none;
  overflow: hidden;
}

.view-info-backdrop {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: -1;
  background-color: rgba(50, 57, 65, 0.8);
  backdrop-filter: blur(2px);
  pointer-events: auto;
}

.view-info-close {
  position: absolute;
  top: -40px;
  right: -40px;
  width: 80px;
  height: 80px;
  background-color: rgba(0, 0, 0, 0.5);
  border-radius: 50%;
  overflow: hidden;
  transition: background-color 0.15s;
  pointer-events: auto;
  cursor: pointer;

  &:focus,
  &:hover {
    background-color: rgba(0, 0, 0, 0.8);
  }

  .close-icon {
    position: absolute;
    left: 15px;
    bottom: 15px;
    width: 20px;
    height: 20px;
    color: #fff;
  }
}

.view-info-container {
  position: relative;
  width: calc(100% - 200px);
  height: calc(100% - 200px);
  overflow: hidden;
  display: flex;
  flex-direction: row;
  align-items: stretch;
}

.image-block {
  flex: 0 0 60%;
  width: 60%;
  height: 100%;
  min-width: 0;
  position: relative;
  overflow: hidden;
  pointer-events: auto;
}

.image-preview-stage {
  position: relative;
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  cursor: grab;
  user-select: none;

  &::after {
    content: '';
    position: absolute;
    inset: 0;
    z-index: 1;
    background: rgba(0, 0, 0, 0.22);
    opacity: 0;
    pointer-events: none;
    transition: opacity 0.2s ease;
  }
}

.image-block:hover .image-preview-stage::after {
  opacity: 1;
}

.image-preview-stage--panning {
  cursor: grabbing;
}

.image-preview-transform {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.image-preview-inner {
  width: 100%;
  height: 100%;

  :deep(.el-image__inner) {
    max-width: 100%;
    max-height: 100%;
    object-fit: contain;
    pointer-events: none;
  }
}

.image-preview-toolbar {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 2;
  display: flex;
  justify-content: center;
  padding: 10px 0 12px;
  background: rgba(0, 0, 0, 0.5);
  opacity: 0;
  visibility: hidden;
  pointer-events: none;
  transition: opacity 0.2s ease, visibility 0.2s ease;
}

.image-block:hover .image-preview-toolbar,
.image-preview-toolbar:focus-within {
  opacity: 1;
  visibility: visible;
  pointer-events: auto;
}

.image-preview-toolbar :deep(.viewer-toolbar > ul) {
  margin: 0 auto;
}

.info-block {
  flex: 0 0 40%;
  width: 40%;
  height: 100%;
  min-width: 0;
  overflow: hidden;
  pointer-events: auto;
}

.info-row {
  display: flex;
  flex-direction: row;
  justify-content: space-between;
  align-items: flex-start;
  gap: 10px;
  margin-bottom: 10px;

  .info-key {
    width: 100px;
    font-size: 14px;
    font-weight: 600;
    color: #fff;
    white-space: pre-wrap;
    word-break: break-all;
    text-align: right;
  }

  .info-value {
    flex: 1;
    font-size: 14px;
    font-weight: 400;
    color: #fff;
    white-space: pre-wrap;
    word-break: break-all;
    user-select: all;
  }
}
</style>
