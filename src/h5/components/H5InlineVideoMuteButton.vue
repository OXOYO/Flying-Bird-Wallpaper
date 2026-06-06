<script setup>
import { useTranslation } from 'i18next-vue'

defineProps({
  visible: { type: Boolean, default: false },
  muted: { type: Boolean, default: true }
})

const emit = defineEmits(['toggle'])

const { t } = useTranslation()
</script>

<template>
  <div v-show="visible" class="inline-video-mute-btn-host">
    <button
      type="button"
      class="inline-video-mute-btn"
      :aria-label="
        muted
          ? t('h5.pages.search.videoPreview.unmute')
          : t('h5.pages.search.videoPreview.mute')
      "
      @click.stop="emit('toggle')"
    >
      <IconifyIcon
        class="inline-video-mute-btn-icon"
        :icon="muted ? 'custom:volume-mute' : 'custom:volume-on'"
      />
    </button>
  </div>
</template>

<style scoped lang="scss">
.inline-video-mute-btn-host {
  position: absolute;
  right: 10px;
  bottom: 10px;
  z-index: 5;
  pointer-events: auto;
}

.inline-video-mute-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  margin: 0;
  padding: 0;
  border: none;
  border-radius: 50%;
  color: #fff;
  background: rgba(0, 0, 0, 0.45);
  backdrop-filter: blur(6px);
  -webkit-backdrop-filter: blur(6px);
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;

  &:active {
    background: rgba(0, 0, 0, 0.62);
  }
}

.inline-video-mute-btn-icon {
  width: 20px;
  height: 20px;
  font-size: 20px;
}
</style>
