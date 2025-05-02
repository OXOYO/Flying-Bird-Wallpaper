<script setup>
import Viewer from 'viewerjs'
import { storeToRefs } from 'pinia'
import UseSettingStore from '@renderer/stores/settingStore.js'

const settingStore = UseSettingStore()
const { settingData } = storeToRefs(settingStore)

const imagesContainer = ref(null)
const galleryContainer = ref(null)
let gallery = null

const props = defineProps({
  options: {
    type: Object,
    default: () => ({})
  }
})

const flags = reactive({
  visible: false,
  loading: false
})
const imageList = ref([])
let viewedIndex = -1

const emit = defineEmits(['prevMore', 'nextMore', 'close'])

const resetLoading = () => {
  flags.loading = false
}

const destroyGallery = () => {
  if (gallery) {
    gallery.destroy()
    gallery = null
  }
}
const createGallery = () => {
  destroyGallery()
  // 处理播放间隔
  const { viewImageIntervalUnit: unit, viewImageIntervalTime: intervalTime } = settingData.value
  let interval = 5
  if (unit && intervalTime) {
    switch (unit) {
      case 's':
        interval = intervalTime
        break
      case 'm':
        interval = intervalTime * 60
        break
      case 'h':
        interval = intervalTime * 60 * 60
        break
      case 'd':
        interval = intervalTime * 24 * 60 * 60
        break
    }
  }
  interval *= 1000

  gallery = new Viewer(imagesContainer.value, {
    toolbar: {
      zoomIn: true,
      zoomOut: true,
      oneToOne: true,
      reset: true,
      prev: true,
      play: {
        show: true,
        size: 'large'
      },
      next: true,
      rotateLeft: true,
      rotateRight: true,
      flipHorizontal: true,
      flipVertical: true
    },
    inline: false,
    backdrop: 'static',
    button: true,
    navbar: true,
    transition: false,
    loop: true,
    fullscreen: false,
    // 自动播放延时
    interval,
    ...props.options,
    container: galleryContainer.value,
    className: 'gallery-viewer-container',
    url(image) {
      return image.src.split('?')[0]
    },
    view: ({ detail }) => {
      const { index } = detail
      if (flags.loading) {
        return
      }
      // 判断是否最后一张向后或者最前一张向前
      if (viewedIndex === 0 && index === imageList.value.length - 1) {
        flags.loading = true
        emit('prevMore', imageList.value[viewedIndex])
      } else if (index === 0 && viewedIndex === imageList.value.length - 1) {
        flags.loading = true
        emit('nextMore', imageList.value[viewedIndex])
      }
    },
    viewed: ({ detail }) => {
      viewedIndex = detail.index
    },
    hidden: () => {
      flags.visible = false
      flags.loading = false
      destroyGallery()
      emit('close')
    }
  })
  gallery.show()
}

// 显示激活项
const view = (activeIndex = -1, list = []) => {
  if (typeof activeIndex === 'number' && activeIndex > -1 && Array.isArray(list) && list.length) {
    flags.visible = true
    imageList.value = list
    nextTick(() => {
      createGallery()
      if (gallery) {
        gallery.view(activeIndex)
      }
      flags.loading = false
    })
  } else {
    flags.loading = false
  }
}

const append = (activeIndex = -1, list = []) => {
  if (typeof activeIndex === 'number' && activeIndex > -1 && Array.isArray(list) && list.length) {
    imageList.value = list
    nextTick(() => {
      if (gallery) {
        gallery.update()
        gallery.view(activeIndex)
      }
      flags.loading = false
    })
  } else {
    flags.loading = false
  }
}

const prepend = (activeIndex = -1, list = []) => {
  if (typeof activeIndex === 'number' && activeIndex > -1 && Array.isArray(list) && list.length) {
    imageList.value = list
    nextTick(() => {
      if (gallery) {
        gallery.update()
        gallery.view(activeIndex)
      }
      flags.loading = false
    })
  } else {
    flags.loading = false
  }
}

onUnmounted(() => {
  destroyGallery()
})

defineExpose({
  resetLoading,
  view,
  append,
  prepend
})
</script>

<template>
  <div v-if="flags.visible" class="view-image-wrapper">
    <div ref="imagesContainer" class="images-container">
      <img v-for="item in imageList" :key="item.uniqueKey" :src="item.src + '?size=100'" />
    </div>
    <div ref="galleryContainer" class="gallery-container"></div>
  </div>
</template>

<style scoped lang="scss">
.view-image-wrapper {
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  left: 0;
  z-index: 10;
  overflow: hidden;
}
.view-image-inner {
  visibility: hidden;
}
.images-container {
  visibility: hidden;
}
.gallery-container {
}
</style>

<style>
.gallery-viewer-container {
  top: 35px;
}
.viewer-footer {
}
.viewer-backdrop {
  background-color: rgba(50, 57, 65, 0.8) !important;
  backdrop-filter: blur(2px) !important;
}
.viewer-navbar {
  background-color: transparent !important;
}
</style>
