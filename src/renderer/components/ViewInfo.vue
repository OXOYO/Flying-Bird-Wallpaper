<script setup>
import { useTranslation } from 'i18next-vue'
import { infoKeys } from '@common/publicData.js'
import { handleInfoVal } from '@common/utils.js'

const { t } = useTranslation()

const flags = reactive({
  visible: false
})

const info = ref({})
const transform = reactive({
  scale: 1,
  originX: '50%',
  originY: '50%'
})
const showResetBtn = ref(false)

const view = (item) => {
  flags.visible = true
  info.value = item
  // 重置变换状态
  transform.scale = 1
  transform.originX = '50%'
  transform.originY = '50%'
}

const handleClose = () => {
  flags.visible = false
  // 重置变换状态
  transform.scale = 1
  transform.originX = '50%'
  transform.originY = '50%'
}

const onContainerClick = (e) => {
  e.stopPropagation()
}

const handleImageBlockMouseEnter = () => {
  // 当图片有缩放时显示还原按钮
  if (transform.scale !== 1) {
    showResetBtn.value = true
  }
}

const handleImageBlockMouseLeave = () => {
  // 鼠标离开时隐藏还原按钮
  showResetBtn.value = false
}

const handleResetZoom = () => {
  // 还原缩放比例和中心点
  transform.scale = 1
  transform.originX = '50%'
  transform.originY = '50%'
  showResetBtn.value = false
}

const handleWheel = (e) => {
  e.preventDefault()

  // 获取鼠标在图片容器中的位置
  const rect = e.currentTarget.getBoundingClientRect()
  const mouseX = e.clientX - rect.left
  const mouseY = e.clientY - rect.top

  // 计算鼠标在容器中的相对位置（百分比）
  const originXPercent = (mouseX / rect.width) * 100
  const originYPercent = (mouseY / rect.height) * 100

  // 更新变换原点为鼠标位置
  transform.originX = `${originXPercent}%`
  transform.originY = `${originYPercent}%`

  // 计算缩放因子，向上滚动放大，向下滚动缩小
  // 对于触摸板，使用 deltaY 或 deltaZ 来判断缩放方向
  const deltaY = e.deltaY || e.deltaZ || 0
  const delta = deltaY > 0 ? 0.9 : 1.1

  // 执行缩放
  const newScale = Math.max(0.1, Math.min(5, transform.scale * delta))
  transform.scale = newScale

  if (transform.scale !== 1) {
    showResetBtn.value = true
  }
}

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
      <div
        class="image-block"
        @wheel="handleWheel"
        @mouseenter="handleImageBlockMouseEnter"
        @mouseleave="handleImageBlockMouseLeave"
      >
        <el-image
          :src="info.imageSrc"
          :style="{
            pointerEvents: 'auto',
            transform: `scale(${transform.scale})`,
            transition: 'transform 0.2s ease',
            transformOrigin: `${transform.originX} ${transform.originY}`
          }"
        />
        <div v-if="showResetBtn" class="reset-zoom-btn" @click="handleResetZoom">
          <IconifyIcon class="reset-icon" icon="custom:fit" />
        </div>
      </div>
      <el-scrollbar class="info-block">
        <div v-for="key in infoKeys" :key="key" class="info-row">
          <div class="info-key">{{ t(`viewInfo.row.${key}`) }}:</div>
          <div class="info-value">{{ handleInfoVal(info, key) }}</div>
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
  justify-content: space-between;
  align-items: center;
}

.image-block {
  width: 60%;
  height: 100%;
  overflow: hidden;
  display: flex;
  justify-content: center;
  align-items: center;
  position: relative;

  .reset-zoom-btn {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    background-color: rgba(0, 0, 0, 0.6);
    border: none;
    border-radius: 20px;
    padding: 8px;
    pointer-events: auto;
    cursor: pointer;
    display: flex;
    justify-content: center;
    align-items: center;
    transition: all 0.3s ease;
    z-index: 10;

    &:hover {
      background-color: rgba(0, 0, 0, 0.8);

      .reset-icon {
        transform: scale(1.05);
      }
    }

    .reset-icon {
      cursor: pointer;
      font-size: 30px;
      color: #fff;
      transition: all 0.3s ease;
    }
  }
}
.info-block {
  width: 40%;
  height: 100%;
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
