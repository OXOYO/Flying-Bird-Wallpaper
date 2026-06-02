<script setup>
defineProps({
  message: { type: String, required: true },
  sourceImageSrc: { type: String, default: '' },
  backAriaLabel: { type: String, default: '' },
  barBackground: { type: String, default: 'rgba(50, 57, 65, 0.96)' }
})

defineEmits(['back'])
</script>

<template>
  <div class="h5-similar-banner" role="status" aria-live="polite">
    <div class="h5-similar-banner__bar" :style="{ backgroundColor: barBackground }">
      <div v-if="sourceImageSrc" class="h5-similar-banner__thumb-wrap">
        <img
          class="h5-similar-banner__thumb"
          :src="sourceImageSrc"
          alt=""
          draggable="false"
        />
      </div>
      <span class="h5-similar-banner__text">{{ message }}</span>
      <button
        type="button"
        class="h5-similar-banner__back"
        :aria-label="backAriaLabel || undefined"
        @click="$emit('back')"
      >
        <IconifyIcon icon="custom:arrow-right" class="h5-similar-banner__back-icon" />
      </button>
    </div>
  </div>
</template>

<style scoped lang="scss">
.h5-similar-banner {
  position: absolute;
  inset: 0;
  z-index: 2;
  box-sizing: border-box;
  overflow: hidden;
  pointer-events: none;
}

.h5-similar-banner__bar {
  pointer-events: auto;
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  height: 100%;
  max-height: 100%;
  min-height: 0;
  padding: 0 8px 0 0;
  box-sizing: border-box;
  overflow: hidden;
}

.h5-similar-banner__thumb-wrap {
  flex-shrink: 0;
  align-self: stretch;
  width: 40px;
  min-width: 40px;
  max-width: 40px;
  height: 100%;
  max-height: 100%;
  min-height: 0;
  overflow: hidden;
  background: rgba(0, 0, 0, 0.25);
}

.h5-similar-banner__thumb {
  display: block;
  width: 100%;
  height: 100%;
  min-height: 0;
  min-width: 0;
  object-fit: cover;
}

.h5-similar-banner__text {
  flex: 1;
  min-width: 0;
  font-size: 13px;
  line-height: 1.4;
  color: rgba(255, 255, 255, 0.88);
}

.h5-similar-banner__back {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  margin: 0;
  padding: 0;
  border: none;
  border-radius: 50%;
  background: transparent;
  color: #95d475;
  cursor: pointer;

  &:active {
    opacity: 0.85;
    background: rgba(149, 212, 117, 0.15);
  }
}

.h5-similar-banner__back-icon {
  font-size: 20px;
  transform: rotate(180deg);
}
</style>
