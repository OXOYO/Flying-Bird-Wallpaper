<script setup>
import { fireRecordPreviewView } from '@common/favoriteResourceUtils.js'
import { isVideoDefaultMuted } from '@common/publicData.js'
import NsfwContentMask from '@renderer/components/NsfwContentMask.vue'
import UseSettingStore from '@renderer/stores/settingStore.js'

const settingStore = UseSettingStore()
const { settingData } = storeToRefs(settingStore)

const props = defineProps({
  shouldMaskItem: {
    type: Function,
    default: null
  },
  onMaskClick: {
    type: Function,
    default: null
  }
})

const emit = defineEmits(['close'])

const flags = reactive({ visible: false })
const currentItem = ref(null)
const videoRef = ref(null)

const showMask = computed(() => {
  const item = currentItem.value
  return !!(item && (props.shouldMaskItem?.(item) ?? false))
})

const resetVideo = () => {
  const video = videoRef.value
  if (!video) return
  video.pause()
  video.currentTime = 0
}

const close = () => {
  resetVideo()
  flags.visible = false
  currentItem.value = null
  emit('close')
}

const onKeydown = (event) => {
  if (event.key === 'Escape' && flags.visible) {
    close()
  }
}

const tryPlay = async () => {
  const video = videoRef.value
  if (!video || showMask.value) return
  try {
    video.muted = isVideoDefaultMuted(settingData.value)
    await video.play()
    void fireRecordPreviewView((it) => window.FBW.recordResourceView(it), currentItem.value)
  } catch (err) {
    console.error('ViewVideo play error:', err)
  }
}

const onViewerMaskClick = async (event) => {
  const unlocked = await props.onMaskClick?.(event)
  if (unlocked) {
    await nextTick()
    await tryPlay()
  }
}

const view = (item) => {
  if (!item?.videoSrc || item.fileType !== 'video') return
  currentItem.value = item
  flags.visible = true
  nextTick(() => {
    void tryPlay()
  })
}

onMounted(() => {
  window.addEventListener('keydown', onKeydown)
})

onUnmounted(() => {
  window.removeEventListener('keydown', onKeydown)
  close()
})

defineExpose({ view, close })
</script>

<template>
  <div v-if="flags.visible" class="view-video-wrapper">
    <button type="button" class="view-video-close" aria-label="close" @click="close">
      <IconifyIcon icon="custom:close" />
    </button>
    <div class="view-video-stage">
      <video
        ref="videoRef"
        class="view-video-player"
        :src="currentItem?.videoSrc"
        :poster="currentItem?.imageSrc"
        controls
        playsinline
        loop
      />
      <div v-if="showMask" class="view-video-nsfw-shield">
        <NsfwContentMask :visible="true" @click="onViewerMaskClick" />
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.view-video-wrapper {
  position: absolute;
  inset: 0;
  z-index: 21;
  background-color: rgba(12, 14, 18, 0.92);
  backdrop-filter: blur(16px) saturate(0.88);
  -webkit-backdrop-filter: blur(16px) saturate(0.88);
}

.view-video-close {
  position: absolute;
  top: 10px;
  right: 10px;
  z-index: 3;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  padding: 0;
  border: none;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.16);
  color: #fff;
  cursor: pointer;
  opacity: 0;
  pointer-events: none;
  transition:
    opacity 0.2s ease,
    background-color 0.2s ease;

  &:hover {
    background: rgba(255, 255, 255, 0.3);
  }

  &:focus-visible {
    opacity: 1;
    pointer-events: auto;
    outline: 2px solid rgba(255, 255, 255, 0.55);
    outline-offset: 2px;
  }
}

.view-video-wrapper:hover .view-video-close {
  opacity: 1;
  pointer-events: auto;
}

.view-video-stage {
  position: absolute;
  inset: 0;
}

.view-video-player {
  width: 100%;
  height: 100%;
  display: block;
  object-fit: cover;
  object-position: center;
  background: #000;
}

.view-video-nsfw-shield {
  position: absolute;
  inset: 0;
  pointer-events: auto;
}

.view-video-nsfw-shield :deep(.nsfw-content-mask) {
  background: var(--fbw-nsfw-mask-bg, rgba(12, 14, 18, 0.88));
  backdrop-filter: blur(var(--fbw-nsfw-mask-blur, 56px)) saturate(0.85);
  -webkit-backdrop-filter: blur(var(--fbw-nsfw-mask-blur, 56px)) saturate(0.85);
}
</style>
