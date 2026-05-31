<script setup>
import UseCommonStore from '@h5/stores/commonStore.js'

defineProps({
  immersiveMode: {
    type: Boolean,
    default: false
  },
  privacyMode: {
    type: Boolean,
    default: false
  }
})

const commonStore = UseCommonStore()

const openDrawer = () => {
  commonStore.openDrawer()
}
</script>

<template>
  <div
    v-if="!immersiveMode"
    class="h5-browse-chrome"
    :class="{ 'h5-browse-chrome--privacy': privacyMode }"
  >
    <van-button class="h5-chrome-icon-btn" plain :aria-label="'menu'" @click="openDrawer">
      <van-icon name="wap-nav" />
    </van-button>
    <div v-if="$slots.default" class="h5-browse-chrome__main">
      <slot />
    </div>
    <div v-else class="h5-browse-chrome__spacer" />
    <div v-if="$slots.trailing" class="h5-browse-chrome__trailing">
      <slot name="trailing" />
    </div>
  </div>
  <div
    v-else
    class="h5-browse-chrome h5-browse-chrome--mini"
    :class="{ 'h5-browse-chrome--privacy': privacyMode }"
  >
    <div class="h5-browse-chrome__mini-start">
      <van-button class="chrome-mini-btn" plain @click="openDrawer">
        <van-icon name="wap-nav" />
      </van-button>
    </div>
    <div v-if="$slots['mini-trailing']" class="h5-browse-chrome__mini-end">
      <slot name="mini-trailing" />
    </div>
  </div>
</template>

<style scoped lang="scss">
.h5-browse-chrome {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px 4px;
  box-sizing: border-box;
  width: 100%;
}

.h5-browse-chrome__main {
  flex: 1;
  min-width: 0;
}

.h5-browse-chrome__spacer {
  flex: 1;
  min-width: 0;
}

.h5-browse-chrome__trailing {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 6px;
  margin-left: auto;
}

.h5-browse-chrome--mini {
  position: absolute;
  top: calc(8px + env(safe-area-inset-top, 0px));
  left: 0;
  right: 0;
  z-index: 20;
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  width: 100%;
  padding: 0 8px;
  box-sizing: border-box;
  pointer-events: none;
}

.h5-browse-chrome__mini-start,
.h5-browse-chrome__mini-end {
  display: flex;
  align-items: center;
  gap: 8px;
  pointer-events: auto;
}

.h5-browse-chrome__mini-end {
  margin-left: auto;
  flex-shrink: 0;
}

.chrome-mini-btn {
  width: 40px;
  height: 40px;
  min-width: 40px;
  border-radius: 50%;
  padding: 0;
  background: rgba(0, 0, 0, 0.45);
  backdrop-filter: blur(8px);
  border: none;
  color: #fff;

  :deep(.van-icon) {
    color: #fff;
  }
}
</style>
