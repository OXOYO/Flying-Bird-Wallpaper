<script setup>
/**
 * 卡片模式单图放大弹层（对齐鸿蒙 PreviewPage singleImageMode）：
 * 无列表翻页；右上角圆形关闭按钮；内嵌多级缩放。
 */
import H5ZoomableImage from '@h5/components/H5ZoomableImage.vue'

defineProps({
  show: { type: Boolean, default: false },
  src: { type: String, default: '' },
  objectFit: { type: String, default: 'contain' }
})

const emit = defineEmits(['update:show', 'close', 'error', 'load'])

const close = () => {
  emit('update:show', false)
  emit('close')
}
</script>

<template>
  <Teleport to="body">
    <div
      v-if="show"
      class="h5-single-image-preview"
      role="dialog"
      aria-modal="true"
    >
      <div class="h5-single-image-preview__stage">
        <H5ZoomableImage
          v-if="src"
          :src="src"
          :object-fit="objectFit"
          :active="show"
          @error="emit('error', $event)"
          @load="emit('load', $event)"
        />
        <slot name="cover" />
      </div>
      <button
        type="button"
        class="h5-single-image-preview__close"
        aria-label="close"
        @click="close"
      >
        <van-icon name="cross" size="18" />
      </button>
    </div>
  </Teleport>
</template>

<style scoped lang="scss">
.h5-single-image-preview {
  position: fixed;
  inset: 0;
  z-index: 3000;
  background: #000;
  touch-action: none;
}

.h5-single-image-preview__stage {
  width: 100%;
  height: 100%;
  position: relative;
}

/* 与搜索栏 ChromeIconBtn 同尺寸；圆形半透明对齐悬浮按钮 */
.h5-single-image-preview__close {
  position: absolute;
  top: calc(env(safe-area-inset-top, 0px) + (46px - 34px) / 2);
  right: 12px;
  width: 34px;
  height: 34px;
  border: none;
  border-radius: 50%;
  padding: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  background: rgba(0, 0, 0, 0.5);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.25);
  z-index: 2;
}

.h5-single-image-preview :deep(.h5-preview-nsfw-shield) {
  position: absolute;
  inset: 0;
  z-index: 1;
  pointer-events: none;
}
</style>
