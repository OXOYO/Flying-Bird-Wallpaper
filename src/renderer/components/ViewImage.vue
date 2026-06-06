<script setup>
import Viewer from 'viewerjs'
import UseSettingStore from '@renderer/stores/settingStore.js'
import { fireRecordPreviewView } from '@common/favoriteResourceUtils.js'
import { resolveNsfwGatedViewerMediaSrc } from '@common/privacyNsfwMask.js'
import NsfwContentMask from '@renderer/components/NsfwContentMask.vue'

const settingStore = UseSettingStore()
const { settingData } = storeToRefs(settingStore)

const imagesContainer = ref(null)
const galleryContainer = ref(null)
const viewerMaskHostEl = ref(null)
let gallery = null

const syncViewerMaskState = () => {
  const root = galleryContainer.value
  if (!root) {
    viewerMaskHostEl.value = null
    return
  }
  const viewerRoot = root.querySelector('.gallery-viewer-container')
  viewerMaskHostEl.value = viewerRoot ?? null
  if (!viewerRoot) return

  viewerRoot.classList.toggle('view-image--nsfw-masked', showViewerMask.value)

  viewerRoot.querySelectorAll('.viewer-list > li').forEach((li, index) => {
    li.classList.toggle(
      'view-image-navbar-item--masked',
      props.shouldMaskItem?.(imageList.value[index]) ?? false
    )
  })
}

const props = defineProps({
  options: {
    type: Object,
    default: () => ({})
  },
  /** (item) => boolean；页内未解锁时对敏感图返回 true */
  shouldMaskItem: {
    type: Function,
    default: null
  },
  onMaskClick: {
    type: Function,
    default: null
  }
})

const flags = reactive({
  visible: false,
  loading: false
})
const imageList = ref([])
const currentViewIndex = ref(-1)
let viewedIndex = -1
let lastRecordedViewIndex = -1

const showViewerMask = computed(() => {
  if (currentViewIndex.value < 0) return false
  const item = imageList.value[currentViewIndex.value]
  return props.shouldMaskItem?.(item) ?? false
})

const resolveViewerImageSrc = (item) =>
  resolveNsfwGatedViewerMediaSrc(item, props.shouldMaskItem)

const recordViewAtIndex = async (index) => {
  const item = imageList.value[index]
  if (!item || props.shouldMaskItem?.(item)) return
  await fireRecordPreviewView((it) => window.FBW.recordResourceView(it), item)
}

const emit = defineEmits(['prevMore', 'nextMore', 'close'])

const resetLoading = () => {
  flags.loading = false
}

const applyGalleryListAtIndex = (activeIndex) => {
  if (!gallery || activeIndex < 0) return
  gallery.update()
  if (gallery.index === activeIndex) {
    gallery.viewed = false
  }
  gallery.view(activeIndex)
  currentViewIndex.value = activeIndex
  viewedIndex = activeIndex
  nextTick(() => syncViewerMaskState())
}

const refreshGalleryAtCurrentIndex = () => {
  if (!gallery || currentViewIndex.value < 0) return
  applyGalleryListAtIndex(currentViewIndex.value)
}

const onViewerMaskClick = async (event) => {
  const unlocked = await props.onMaskClick?.(event)
  if (unlocked) {
    nextTick(() => refreshGalleryAtCurrentIndex())
    return
  }
  nextTick(() => {
    if (gallery && currentViewIndex.value >= 0) {
      gallery.view(currentViewIndex.value)
    }
    syncViewerMaskState()
  })
}

watch(showViewerMask, (masked, wasMasked) => {
  nextTick(() => syncViewerMaskState())
  if (wasMasked && !masked) {
    nextTick(() => refreshGalleryAtCurrentIndex())
  }
})

const destroyGallery = () => {
  viewerMaskHostEl.value = null
  if (gallery) {
    gallery.destroy()
    gallery = null
  }
}
const createGallery = () => {
  destroyGallery()
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
    interval,
    ...props.options,
    container: galleryContainer.value,
    className: 'gallery-viewer-container',
    view: ({ detail }) => {
      const { index } = detail
      if (flags.loading) {
        return
      }
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
      currentViewIndex.value = detail.index
      nextTick(() => {
        syncViewerMaskState()
        requestAnimationFrame(() => syncViewerMaskState())
      })
      if (props.shouldMaskItem?.(imageList.value[detail.index])) {
        lastRecordedViewIndex = detail.index
        return
      }
      if (detail.index !== lastRecordedViewIndex) {
        lastRecordedViewIndex = detail.index
        void recordViewAtIndex(detail.index)
      }

      const image = detail.image
      const containerWidth = gallery.containerData.width
      const containerHeight = gallery.containerData.height - 35
      const imageWidth = image.naturalWidth
      const imageHeight = image.naturalHeight

      const scale = Math.min(containerWidth / imageWidth, containerHeight / imageHeight)

      gallery.zoomTo(scale)

      gallery.moveTo(
        (containerWidth - imageWidth * scale) / 2,
        (containerHeight - imageHeight * scale) / 2
      )
    },
    hidden: () => {
      flags.visible = false
      flags.loading = false
      currentViewIndex.value = -1
      lastRecordedViewIndex = -1
      destroyGallery()
      emit('close')
    }
  })
  gallery.show()
  nextTick(() => {
    syncViewerMaskState()
    requestAnimationFrame(() => syncViewerMaskState())
  })
}

const view = (activeIndex = -1, list = []) => {
  if (typeof activeIndex === 'number' && activeIndex > -1 && Array.isArray(list) && list.length) {
    lastRecordedViewIndex = -1
    flags.visible = true
    imageList.value = list
    nextTick(() => {
      createGallery()
      if (gallery) {
        gallery.view(activeIndex)
        currentViewIndex.value = activeIndex
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
      applyGalleryListAtIndex(activeIndex)
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
      applyGalleryListAtIndex(activeIndex)
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
      <img
        v-for="item in imageList"
        :key="item.uniqueKey"
        :src="resolveViewerImageSrc(item)"
        alt=""
      />
    </div>
    <div ref="galleryContainer" class="gallery-container"></div>
    <Teleport v-if="showViewerMask && viewerMaskHostEl" :to="viewerMaskHostEl">
      <div :key="currentViewIndex" class="view-image-nsfw-shield">
        <NsfwContentMask :visible="true" @click="onViewerMaskClick" />
      </div>
    </Teleport>
  </div>
</template>

<style scoped lang="scss">
.view-image-wrapper {
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  left: 0;
  /* 高于 ListCountIndicator / CuratorStatsIndicator（z-index: 20），避免预览与页脚叠层冲突 */
  z-index: 21;
  overflow: visible;
}
.images-container {
  visibility: hidden;
}
.gallery-container {
  position: relative;
  z-index: 1;
}
.view-image-nsfw-shield {
  position: absolute;
  inset: 0;
  pointer-events: auto;
}

.view-image-nsfw-shield :deep(.nsfw-content-mask) {
  background: var(--fbw-nsfw-mask-bg, rgba(12, 14, 18, 0.88));
  backdrop-filter: blur(var(--fbw-nsfw-mask-blur, 56px)) saturate(0.85);
  -webkit-backdrop-filter: blur(var(--fbw-nsfw-mask-blur, 56px)) saturate(0.85);
}
</style>

<style>
.gallery-viewer-container {
  top: 35px;
}

/* 窗口内预览：关闭钮默认 top:-40px 会被裁切或落到标题栏后 */
.gallery-viewer-container > .viewer-button {
  top: 10px;
  right: 10px;
  width: 40px;
  height: 40px;
  z-index: 6;
}

.gallery-viewer-container > .viewer-button::before {
  position: absolute;
  top: 50%;
  left: 50%;
  bottom: auto;
  margin: 0;
  transform: translate(-50%, -50%);
}

.gallery-viewer-container > .viewer-footer {
  z-index: 5;
  pointer-events: auto;
}

.gallery-viewer-container > .view-image-nsfw-shield {
  z-index: 2;
  pointer-events: auto;
}

/* 遮罩时不展示画布图片与尺寸标题 */
.gallery-viewer-container.view-image--nsfw-masked .viewer-canvas > img {
  visibility: hidden !important;
}

.gallery-viewer-container.view-image--nsfw-masked .viewer-title {
  visibility: hidden;
}

/* 底部缩略图：敏感项不显示预览图，用浅色边框占位便于在全遮罩列表中辨认 */
.gallery-viewer-container .viewer-list > li.view-image-navbar-item--masked img {
  visibility: hidden !important;
}

.gallery-viewer-container .viewer-list > li.view-image-navbar-item--masked {
  position: relative;
  background-color: rgba(255, 255, 255, 0.1) !important;
  border: 1px solid rgba(255, 255, 255, 0.32);
  border-radius: 3px;
  box-sizing: border-box;
  opacity: 1 !important;
}

.gallery-viewer-container .viewer-list > li.view-image-navbar-item--masked::after {
  content: '';
  position: absolute;
  left: 50%;
  top: 50%;
  width: 14px;
  height: 14px;
  transform: translate(-50%, -50%);
  opacity: 0.72;
  background: center / contain no-repeat url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23ffffff' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24'/%3E%3Cline x1='1' y1='1' x2='23' y2='23'/%3E%3C/svg%3E");
  pointer-events: none;
}

.gallery-viewer-container .viewer-list > li.view-image-navbar-item--masked.viewer-active,
.gallery-viewer-container .viewer-list > li.view-image-navbar-item--masked.viewer-active:focus,
.gallery-viewer-container .viewer-list > li.view-image-navbar-item--masked.viewer-active:hover {
  background-color: rgba(255, 255, 255, 0.22) !important;
  border-color: rgba(255, 255, 255, 0.78);
  box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.28);
  opacity: 1 !important;
}

.gallery-viewer-container .viewer-list > li.view-image-navbar-item--masked.viewer-active::after {
  opacity: 0.95;
}

.gallery-viewer-container.view-image--nsfw-masked .viewer-navbar {
  background-color: rgba(0, 0, 0, 0.28) !important;
}

.gallery-viewer-container .viewer-toolbar > ul > li {
  background-color: rgba(255, 255, 255, 0.16);
}

.gallery-viewer-container .viewer-toolbar > ul > li:focus,
.gallery-viewer-container .viewer-toolbar > ul > li:hover {
  background-color: rgba(255, 255, 255, 0.3);
}

/* 窗口内预览背景：加深 + 毛玻璃，弱化背后列表干扰 */
.gallery-viewer-container.viewer-backdrop {
  background-color: rgba(12, 14, 18, 0.9) !important;
  backdrop-filter: blur(16px) saturate(0.88) !important;
  -webkit-backdrop-filter: blur(16px) saturate(0.88) !important;
}

.viewer-navbar {
  background-color: transparent !important;
}

.gallery-viewer-container .viewer-list > li.view-image-navbar-item--masked + li.view-image-navbar-item--masked {
  margin-left: 4px;
}
</style>
