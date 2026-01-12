<script setup>
import { useTranslation } from 'i18next-vue'
import { infoKeys } from '@common/publicData.js'
import { handleInfoVal } from '@common/utils.js'

const { t } = useTranslation()

const flags = reactive({
  visible: false
})

const info = ref({})

const view = (item) => {
  flags.visible = true
  info.value = item
}

const handleClose = () => {
  flags.visible = false
}

const onContainerClick = (e) => {
  e.stopPropagation()
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
      <div class="image-block">
        <el-image :src="info.imageSrc" style="pointer-events: auto" />
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
  img {
    max-width: 100%;
    max-height: 100%;
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
