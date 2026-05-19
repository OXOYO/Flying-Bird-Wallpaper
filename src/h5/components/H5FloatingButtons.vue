<script setup>
import UseSettingStore from '@h5/stores/settingStore.js'

const props = defineProps({
  enabledKeys: {
    type: Array,
    default: () => []
  },
  position: {
    type: String,
    default: 'left'
  },
  autoPlayOn: {
    type: Boolean,
    default: false
  },
  countdown: {
    type: Number,
    default: 3
  },
  intervalSec: {
    type: Number,
    default: 3
  },
  displaySize: {
    type: String,
    default: 'contain'
  },
  immersiveMode: {
    type: Boolean,
    default: false
  },
  isCurrentFavorite: {
    type: Boolean,
    default: false
  },
  showImagePlaybackControls: {
    type: Boolean,
    default: true
  },
  showDisplaySize: {
    type: Boolean,
    default: true
  },
  /** 收藏等仅铺满模式可用的按钮 */
  showFavorites: {
    type: Boolean,
    default: true
  },
  hidden: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits([
  'toggle-auto-play',
  'cycle-interval',
  'toggle-favorite',
  'favorite-touch-start',
  'favorite-touch-move',
  'favorite-touch-end',
  'toggle-display-size',
  'toggle-immersive',
  'back-top'
])

const settingStore = UseSettingStore()

const has = (key) => props.enabledKeys.includes(key)

const style = computed(() => {
  const ret = {}
  if (props.position === 'right') {
    ret.right = '20px'
  } else {
    ret.left = '20px'
  }
  if (props.hidden) {
    ret.display = 'none'
  }
  return ret
})
</script>

<template>
  <div v-show="!hidden" class="h5-floating-buttons" :style="style">
    <div
      v-if="has('autoSwitch') && showImagePlaybackControls"
      class="floating-button"
      :class="{ 'progress-button': autoPlayOn }"
      :style="{ '--animation-duration': intervalSec + 's' }"
      @click="emit('toggle-auto-play')"
    >
      <IconifyIcon
        class="floating-button-icon"
        :icon="autoPlayOn ? 'custom:pause-fill' : 'custom:play-fill'"
      />
    </div>

    <div
      v-if="has('intervalTime') && showImagePlaybackControls"
      class="floating-button"
      @click="emit('cycle-interval')"
    >
      {{ autoPlayOn ? countdown : intervalSec }}s
    </div>

    <div
      v-if="has('favorites') && showFavorites"
      class="floating-button"
      @touchstart="(e) => emit('favorite-touch-start', e)"
      @touchmove="(e) => emit('favorite-touch-move', e)"
      @touchend="(e) => emit('favorite-touch-end', e)"
      @touchcancel="(e) => emit('favorite-touch-end', e)"
    >
      <IconifyIcon
        class="floating-button-icon"
        :icon="isCurrentFavorite ? 'custom:star-fill' : 'custom:star'"
        :style="{ color: isCurrentFavorite ? 'gold' : '' }"
      />
    </div>

    <div
      v-if="has('displaySize') && showDisplaySize"
      class="floating-button"
      @click="emit('toggle-display-size')"
    >
      <IconifyIcon
        class="floating-button-icon"
        :icon="
          displaySize === 'cover'
            ? 'custom:collapse-diagonal-line'
            : 'custom:expand-diagonal-line'
        "
      />
    </div>

    <div v-if="has('toggleTabbar')" class="floating-button" @click="emit('toggle-immersive')">
      <IconifyIcon
        class="floating-button-icon"
        :icon="immersiveMode ? 'custom:home-2-line' : 'custom:home-3-line'"
      />
    </div>

    <div v-if="has('backtop')" class="floating-button" @click="emit('back-top')">
      <IconifyIcon class="floating-button-icon" icon="custom:backtop" />
    </div>
  </div>
</template>

<style scoped lang="scss">
.h5-floating-buttons {
  position: fixed;
  /* 固定视口位置：用 TabBar 标称高度计算，沉浸隐藏底栏时也不跳动 */
  bottom: calc(var(--van-tabbar-height, 50px) + 72px + env(safe-area-inset-bottom, 0px));
  display: flex;
  flex-direction: column;
  gap: 12px;
  z-index: 110;
}

.floating-button {
  width: 46px;
  height: 46px;
  line-height: 1;
  border-radius: 50%;
  background-color: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(10px);
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  user-select: none;
  cursor: pointer;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
  transition: transform 0.2s ease, background-color 0.2s ease;
  -webkit-tap-highlight-color: transparent;

  &:active {
    transform: scale(0.8);
    background-color: rgba(0, 0, 0, 0.8);
  }
}

.floating-button-icon {
  font-size: 30px;
  color: #fff;
  transition: transform 0.2s ease-out;
  pointer-events: none;
  will-change: transform;
}

.progress-button {
  position: relative;
  overflow: hidden;
}

.progress-button::before {
  content: '';
  position: absolute;
  inset: -2px;
  border-radius: 50%;
  border: 2px solid transparent;
  border-top-color: rgba(255, 255, 255, 0.85);
  animation: h5-float-spin var(--animation-duration, 3s) linear infinite;
}

@keyframes h5-float-spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
