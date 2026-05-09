<script setup>
import UseCommonStore from '@h5/stores/commonStore.js'
import UseSettingStore from '@h5/stores/settingStore.js'
import * as api from '@h5/api/index.js'
import { resourceTypeList, filterTypeOptions, orientationOptions, qualityList } from '@common/publicData.js'
import { useTranslation } from 'i18next-vue'
import { infoKeys } from '@common/publicData.js'
import { handleInfoVal } from '@common/utils.js'
import VirtualList from '@h5/components/VirtualList.vue'

const { t } = useTranslation()
const commonStore = UseCommonStore()
const settingStore = UseSettingStore()

const form = reactive({
  keywords: '',
  resourceType: 'localResource',
  resourceName: '',
  filterType: 'images',
  orientation: '',
  quality: '',
  sortField: settingStore.settingData.h5SortField || 'created_at',
  sortType: settingStore.settingData.h5SortType || -1,
  isRandom: false
})

const page = reactive({
  startPage: 1,
  pageSize: 20,
  total: 0
})

const state = reactive({
  loading: false,
  refreshing: false,
  finished: false,
  showFilters: false,
  showActionPopup: false,
  showPreview: false,
  showVideoPreview: false,
  viewportHeight: typeof window !== 'undefined' ? window.innerHeight : 800,
  scrollTop: 0,
  viewportWidth: typeof window !== 'undefined' ? window.innerWidth : 375
})
const imageInfoPanelAnchors = [0, Math.round(0.55 * window.innerHeight)]
const imageInfoPanelHeight = ref(imageInfoPanelAnchors[0])
const pageWrapperRef = ref(null)
const videoPreviewRef = ref(null)
const fullscreenListRef = ref(null)
const fullscreenSliderRef = ref(null)
const fullscreenMeasuredHeight = ref(420)
const fullscreenVisibleIndex = ref(0)
let fullscreenResizeObserver = null

const DISPLAY_MODE_STORAGE_KEY = 'fbw_h5_search_display_mode'
const readStoredDisplayMode = () => {
  try {
    return localStorage.getItem(DISPLAY_MODE_STORAGE_KEY) === 'fullscreen' ? 'fullscreen' : 'waterfall'
  } catch {
    return 'waterfall'
  }
}
const displayMode = ref(readStoredDisplayMode())

const list = ref([])
const FALLBACK_ITEM_HEIGHT = 220
const GRID_GAP = 10
const GRID_BUFFER_PX = 900
const longPress = reactive({
  timer: null,
  selectedIndex: -1,
  startX: 0,
  startY: 0
})
const imageErrorState = reactive({})
const imageRetrySeed = reactive({})
const imageLoadFailText = computed(() => t('messages.imageLoadRetryHint'))

const resourceTypeOptions = computed(() => {
  return resourceTypeList.map((item) => ({
    text: t(item.locale),
    value: item.value
  }))
})

const sourceOptions = computed(() => {
  const rows = commonStore.resourceMap.resourceListByResourceType?.[form.resourceType] || []
  return rows.map((item) => ({
    text: t(item.locale) || item.label || item.value,
    value: item.value,
    supportSearchTypes: item.supportSearchTypes || ['images']
  }))
})

const filterTypeAvailable = computed(() => {
  const selected = sourceOptions.value.find((item) => item.value === form.resourceName)
  const types = selected?.supportSearchTypes || ['images']
  return filterTypeOptions.filter((item) => types.includes(item.value))
})

const filterTypeDropdownOptions = computed(() => {
  return filterTypeAvailable.value.map((item) => ({
    text: t(item.locale),
    value: item.value
  }))
})

const normalizeItem = (item) => {
  const isVideo = item.fileType === 'video'

  if (isVideo) {
    let posterRaw = ''
    let videoSrc = ''

    if (item.srcType === 'file') {
      videoSrc = `/api/videos/get?filePath=${encodeURIComponent(item.filePath)}`
      const iu = item.imageUrl || ''
      if (iu) {
        posterRaw = /^https?:\/\//i.test(iu)
          ? iu
          : `/api/images/get?filePath=${encodeURIComponent(iu)}`
      }
    } else {
      videoSrc = item.videoUrl || ''
      posterRaw = item.imageUrl || ''
    }

    return {
      ...item,
      isVideo: true,
      posterSrc: posterRaw,
      posterRawSrc: posterRaw,
      videoSrc,
      imageSrc: posterRaw,
      imageRawSrc: posterRaw
    }
  }

  if (item.srcType === 'file') {
    const rawUrl = `/api/images/get?filePath=${encodeURIComponent(item.filePath)}`
    return {
      ...item,
      isVideo: false,
      posterSrc: '',
      posterRawSrc: '',
      videoSrc: '',
      imageSrc: rawUrl,
      imageRawSrc: rawUrl
    }
  }
  return {
    ...item,
    isVideo: false,
    posterSrc: '',
    posterRawSrc: '',
    videoSrc: '',
    imageSrc: item.imageUrl || '',
    imageRawSrc: item.imageUrl || ''
  }
}

const getItemKey = (item) =>
  String(item?.id || item?.uniqueKey || item?.filePath || item?.videoSrc || item?.imageSrc || '')
const getDisplayImageSrc = (item) => {
  const key = getItemKey(item)
  const seed = imageRetrySeed[key] || 0
  if (!seed) return item.imageSrc
  const separator = item.imageRawSrc?.includes('?') ? '&' : '?'
  return `${item.imageRawSrc}${separator}_retry=${seed}`
}
const getDisplayPosterSrc = (item) => {
  const key = getItemKey(item)
  const seed = imageRetrySeed[key] || 0
  const raw = item.posterRawSrc || ''
  if (!raw) return ''
  if (!seed) return item.posterSrc || raw
  const separator = raw.includes('?') ? '&' : '?'
  return `${raw}${separator}_retry=${seed}`
}
const onImageLoadError = (item) => {
  const key = getItemKey(item)
  if (!key) return
  imageErrorState[key] = true
}
const onPosterLoadError = onImageLoadError
const retryLoadImage = (item) => {
  const key = getItemKey(item)
  if (!key) return
  imageErrorState[key] = false
  imageRetrySeed[key] = Date.now()
}
const retryLoadPoster = retryLoadImage

const syncFilterType = () => {
  const target = filterTypeAvailable.value.find((item) => item.value === form.filterType)
  if (!target && filterTypeAvailable.value.length) {
    form.filterType = filterTypeAvailable.value[0].value
  }
}

const loadList = async (reset = false) => {
  if (state.loading) return
  if (reset) {
    page.startPage = 1
    page.total = 0
    list.value = []
    state.finished = false
  }
  state.loading = true
  const payload = {
    ...form,
    filterKeywords: form.keywords,
    keywords: form.keywords,
    startPage: page.startPage,
    pageSize: page.pageSize
  }
  const res = await api.searchImages(payload)
  if (res?.success && Array.isArray(res?.data?.list)) {
    const merged = [...list.value, ...res.data.list.map(normalizeItem)]
    const map = new Map()
    merged.forEach((item) => map.set(item.id || item.uniqueKey, item))
    list.value = [...map.values()]
    page.total = res.data.total || list.value.length
    page.startPage += 1
    if (!res.data.list.length || list.value.length >= page.total) {
      state.finished = true
    }
  } else {
    state.finished = true
    showNotify({
      type: 'danger',
      message: res?.message || t('messages.getDataFail')
    })
  }
  state.loading = false
  state.refreshing = false
}

const onSearch = async () => {
  await loadList(true)
}

const onRefresh = async () => {
  state.refreshing = true
  await loadList(true)
}

const onLoadMore = async () => {
  if (state.finished) return
  await loadList(false)
}

const onChangeResourceType = () => {
  const first = sourceOptions.value[0]
  form.resourceName = first ? first.value : ''
  syncFilterType()
}

const onChangeSource = () => {
  syncFilterType()
}

const onToggleFavorite = async (item) => {
  const res = item.isFavorite ? await api.removeFavorites(item.id) : await api.addToFavorites(item.id)
  if (res?.success) {
    item.isFavorite = !item.isFavorite
    showNotify({ type: 'success', message: t('messages.operationSuccess') })
  } else {
    showNotify({ type: 'danger', message: res?.message || t('messages.operationFail') })
  }
}

const onResetFilters = () => {
  form.resourceType = 'localResource'
  const first = sourceOptions.value[0]
  form.resourceName = first ? first.value : ''
  form.filterType = 'images'
  form.orientation = ''
  form.quality = ''
  onSearch()
}

// 仅在打开预览时生成数组；排除视频项，避免与 van-image-preview 下标错位
const previewImages = computed(() => {
  if (!state.showPreview) return []
  return list.value.filter((item) => item.fileType !== 'video').map((item) => item.imageSrc).filter(Boolean)
})
const previewStartPosition = computed(() => {
  if (!state.showPreview || longPress.selectedIndex < 0) return 0
  const sel = list.value[longPress.selectedIndex]
  if (!sel || sel.fileType === 'video') return 0
  let pos = 0
  for (let i = 0; i < longPress.selectedIndex; i++) {
    const row = list.value[i]
    if (row?.fileType !== 'video' && row?.imageSrc) pos++
  }
  return pos
})

const videoPreviewItem = computed(() => {
  if (!state.showVideoPreview || longPress.selectedIndex < 0) return null
  return list.value[longPress.selectedIndex] || null
})
const gridColumns = computed(() => {
  const width = state.viewportWidth
  if (width >= 1200) return 4
  if (width >= 768) return 3
  return 2
})
const cardWidth = computed(() => {
  const pageWidth = Math.min(state.viewportWidth, 1080)
  const contentWidth = Math.max(0, pageWidth - 24)
  return Math.max(80, (contentWidth - GRID_GAP * (gridColumns.value - 1)) / gridColumns.value)
})

const getItemHeight = (item) => {
  const width = Number(item?.width) || 0
  const height = Number(item?.height) || 0
  if (width > 0 && height > 0) {
    const calculated = (cardWidth.value * height) / width
    return Math.max(100, Math.min(520, Math.round(calculated)))
  }
  return FALLBACK_ITEM_HEIGHT
}

const virtualColumns = computed(() => {
  const columns = Array.from({ length: gridColumns.value }, () => ({
    items: [],
    totalHeight: 0,
    topSpacer: 0,
    bottomSpacer: 0
  }))
  list.value.forEach((item, index) => {
    const columnIndex = index % gridColumns.value
    const height = getItemHeight(item)
    columns[columnIndex].items.push({
      item,
      globalIndex: index,
      height
    })
  })

  const viewportTop = state.scrollTop - GRID_BUFFER_PX
  const viewportBottom = state.scrollTop + state.viewportHeight + GRID_BUFFER_PX

  return columns.map((column) => {
    let accumulated = 0
    let start = 0
    while (start < column.items.length) {
      const rowHeight = column.items[start].height + GRID_GAP
      if (accumulated + rowHeight >= viewportTop) break
      accumulated += rowHeight
      start += 1
    }

    let end = start
    let visibleHeight = accumulated
    while (end < column.items.length) {
      const rowHeight = column.items[end].height + GRID_GAP
      if (visibleHeight >= viewportBottom) break
      visibleHeight += rowHeight
      end += 1
    }

    const topSpacer = accumulated
    let totalHeight = 0
    for (let i = 0; i < column.items.length; i += 1) {
      totalHeight += column.items[i].height + GRID_GAP
    }
    const renderedHeight = Math.max(0, visibleHeight - accumulated)
    const bottomSpacer = Math.max(0, totalHeight - topSpacer - renderedHeight)
    return {
      items: column.items.slice(start, end),
      totalHeight,
      topSpacer,
      bottomSpacer
    }
  })
})

const slideObjectFit = computed(() =>
  settingStore.settingData?.h5ImageDisplaySize === 'cover' ? 'cover' : 'contain'
)

const measureFullscreenHeight = () => {
  const el = fullscreenSliderRef.value
  if (el?.clientHeight) {
    fullscreenMeasuredHeight.value = Math.round(el.clientHeight)
  }
}

const bindFullscreenResizeObserver = () => {
  fullscreenResizeObserver?.disconnect()
  const el = fullscreenSliderRef.value
  if (!el || typeof ResizeObserver === 'undefined') return
  fullscreenResizeObserver = new ResizeObserver((entries) => {
    const h = entries[0]?.contentRect?.height
    if (h) {
      fullscreenMeasuredHeight.value = Math.round(h)
    }
  })
  fullscreenResizeObserver.observe(el)
}

const fullscreenItemHeight = computed(() =>
  Math.max(240, fullscreenMeasuredHeight.value || Math.floor(state.viewportHeight * 0.72))
)

const slideBgUrl = (item) => {
  if (!item) return ''
  if (item.fileType === 'video') return getDisplayPosterSrc(item) || ''
  return getDisplayImageSrc(item) || ''
}

const layoutToggleTitle = computed(() =>
  displayMode.value === 'waterfall'
    ? t('h5.pages.search.displayMode.toggleToFullscreen')
    : t('h5.pages.search.displayMode.toggleToWaterfall')
)

const toggleDisplayMode = () => {
  displayMode.value = displayMode.value === 'waterfall' ? 'fullscreen' : 'waterfall'
  try {
    localStorage.setItem(DISPLAY_MODE_STORAGE_KEY, displayMode.value)
  } catch (_) {
    /* noop */
  }
}

const onFullscreenVirtualScroll = (payload) => {
  const len = list.value.length
  if (!len) {
    fullscreenVisibleIndex.value = 0
    return
  }
  const ih = Math.max(1, fullscreenItemHeight.value)
  const scrollTop = Math.max(0, Number(payload.scrollTop) || 0)
  const clientH = Math.max(ih, Number(payload.clientHeight) || ih)
  // 以视口垂直中心所在项为准，避免半屏滑动时与 visibleStart 不一致
  const center = scrollTop + clientH / 2
  const idx = Math.min(Math.max(0, Math.floor(center / ih)), len - 1)
  fullscreenVisibleIndex.value = idx
}

const fullscreenIndicatorText = computed(() => {
  const cur = fullscreenVisibleIndex.value + 1
  const tot = Math.max(1, page.total || list.value.length)
  return t('h5.pages.search.displayMode.indicator', { current: cur, total: tot })
})

watch(displayMode, (mode) => {
  if (mode !== 'fullscreen') {
    fullscreenResizeObserver?.disconnect()
    fullscreenResizeObserver = null
    return
  }
  nextTick(() => {
    bindFullscreenResizeObserver()
    measureFullscreenHeight()
  })
})

watch(
  () => list.value.length,
  () => {
    const maxIdx = Math.max(0, list.value.length - 1)
    if (fullscreenVisibleIndex.value > maxIdx) {
      fullscreenVisibleIndex.value = maxIdx
    }
  }
)

const closeVideoPreview = () => {
  state.showVideoPreview = false
}

const onVideoPreviewClosed = () => {
  const el = videoPreviewRef.value
  if (!el) return
  try {
    el.pause()
    el.removeAttribute('src')
    el.load()
  } catch (_) {
    /* noop */
  }
}

const openPreview = (index) => {
  const row = list.value[index]
  if (!row) return
  longPress.selectedIndex = index
  if (row.fileType === 'video') {
    if (!row.videoSrc) {
      showNotify({
        type: 'warning',
        message: t('messages.noData')
      })
      return
    }
    state.showVideoPreview = true
    return
  }
  if (!row.imageSrc) return
  state.showPreview = true
}

const onImageTouchStart = (index, event) => {
  if (!event.touches?.length) return
  longPress.startX = event.touches[0].clientX
  longPress.startY = event.touches[0].clientY
  longPress.timer = setTimeout(() => {
    longPress.selectedIndex = index
    state.showActionPopup = true
  }, 500)
}

const onImageTouchMove = (event) => {
  if (!longPress.timer || !event.touches?.length) return
  const moveX = event.touches[0].clientX - longPress.startX
  const moveY = event.touches[0].clientY - longPress.startY
  if (Math.sqrt(moveX * moveX + moveY * moveY) > 10) {
    clearTimeout(longPress.timer)
    longPress.timer = null
  }
}

const onImageTouchEnd = () => {
  if (longPress.timer) {
    clearTimeout(longPress.timer)
    longPress.timer = null
  }
}

const selectedItem = computed(() =>
  longPress.selectedIndex >= 0 ? list.value[longPress.selectedIndex] || null : null
)

const showImageInfo = () => {
  if (!selectedItem.value) return
  state.showActionPopup = false
  imageInfoPanelHeight.value = imageInfoPanelAnchors[1]
}

const saveImage = async () => {
  const item = selectedItem.value
  if (!item) return
  try {
    const link = document.createElement('a')
    const isVideo = item.fileType === 'video'
    link.href = isVideo ? item.videoSrc : item.imageSrc
    const defaultExt = isVideo ? 'mp4' : 'jpg'
    link.download = `${item.fileName || item.id || Date.now()}.${item.fileExt || defaultExt}`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    if (item.id) {
      await api.updateDownloadCount(item.id, 1)
    }
    showNotify({ type: 'success', message: t('messages.saveSuccess') })
  } catch (error) {
    showNotify({ type: 'danger', message: t('messages.saveFail') })
  } finally {
    state.showActionPopup = false
  }
}

const deleteImage = async () => {
  const item = selectedItem.value
  if (!item) return
  try {
    await showConfirmDialog({
      title: t('h5.pages.home.actions.confirmDelete'),
      message: t('h5.pages.home.actions.confirmDeleteMessage'),
      confirmButtonText: t('h5.pages.home.actions.confirmDeleteBtn'),
      cancelButtonText: t('h5.pages.home.actions.cancelDeleteBtn'),
      confirmButtonColor: '#ee0a24',
      closeOnClickOverlay: true
    })
    const res = await api.deleteImage(toRaw(item))
    if (res?.success) {
      list.value = list.value.filter((row) => (row.id || row.uniqueKey) !== (item.id || item.uniqueKey))
      showNotify({ type: 'success', message: t('messages.deleteSuccess') })
    } else {
      showNotify({ type: 'danger', message: res?.message || t('messages.deleteFail') })
    }
  } catch (error) {
    if (error !== 'cancel') {
      showNotify({ type: 'danger', message: t('messages.deleteFail') })
    }
  } finally {
    state.showActionPopup = false
  }
}

const toggleSelectedFavorite = async () => {
  const item = selectedItem.value
  if (!item) return
  await onToggleFavorite(item)
  state.showActionPopup = false
}

const openActionByIndex = (index) => {
  longPress.selectedIndex = index
  state.showActionPopup = true
}

const onPageScroll = (event) => {
  if (displayMode.value === 'fullscreen') return
  const container = event?.target || pageWrapperRef.value
  if (!container) return
  const scrollTop = container.scrollTop || 0
  state.scrollTop = scrollTop
  const clientHeight = container.clientHeight || state.viewportHeight
  const scrollHeight = container.scrollHeight || clientHeight
  if (
    scrollHeight - (scrollTop + clientHeight) < 240 &&
    !state.loading &&
    !state.finished
  ) {
    onLoadMore()
  }
}

const onPageResize = () => {
  state.viewportHeight = window.innerHeight
  state.viewportWidth = window.innerWidth
  if (displayMode.value === 'fullscreen') {
    nextTick(() => measureFullscreenHeight())
  }
}

const onFilterResourceTypeChange = () => {
  const first = sourceOptions.value[0]
  form.resourceName = first ? first.value : ''
  syncFilterType()
}

const onApplyFilters = async () => {
  state.showFilters = false
  await onSearch()
}

const onImageInfoHeightChange = (height) => {
  if (height === 0 && !state.showActionPopup) {
    longPress.selectedIndex = -1
  }
}

onUnmounted(() => {
  if (longPress.timer) {
    clearTimeout(longPress.timer)
    longPress.timer = null
  }
  fullscreenResizeObserver?.disconnect()
  fullscreenResizeObserver = null
  window.removeEventListener('resize', onPageResize)
})

const init = async () => {
  state.viewportHeight = window.innerHeight
  state.viewportWidth = window.innerWidth
  state.scrollTop = pageWrapperRef.value?.scrollTop || 0
  window.addEventListener('resize', onPageResize, { passive: true })
  const first = sourceOptions.value[0]
  form.resourceName = first ? first.value : ''
  syncFilterType()
  await onSearch()
}

defineExpose({
  refresh: onRefresh
})

onMounted(async () => {
  await init()
  if (displayMode.value === 'fullscreen') {
    nextTick(() => {
      bindFullscreenResizeObserver()
      measureFullscreenHeight()
    })
  }
})
</script>

<template>
  <div
    ref="pageWrapperRef"
    class="page-wrapper page-search"
    :class="{ 'page-search--fullscreen': displayMode === 'fullscreen' }"
    @scroll.passive="onPageScroll"
  >
    <div class="page-search-inner">
      <div class="search-toolbar">
        <div class="search-row">
          <van-search
            v-model="form.keywords"
            class="search-input"
            :placeholder="t('h5.pages.search.keywordPlaceholder')"
            @search="onSearch"
          />
          <van-button
            class="layout-mode-btn"
            plain
            :title="layoutToggleTitle"
            :aria-label="layoutToggleTitle"
            @click="toggleDisplayMode"
          >
            <van-icon :name="displayMode === 'waterfall' ? 'expand-o' : 'apps-o'" />
          </van-button>
          <van-button class="filter-btn" plain @click="state.showFilters = true">
            <van-icon name="arrow-down" />
          </van-button>
        </div>
      </div>

      <van-pull-refresh v-model="state.refreshing" :disabled="state.loading" @refresh="onRefresh">
        <div
          class="search-pull-inner"
          :class="{ 'search-pull-inner--fullscreen': displayMode === 'fullscreen' }"
        >
          <div v-if="state.loading && !list.length" class="result-list result-list-skeleton">
            <van-skeleton v-for="i in 4" :key="i" avatar :row="2" />
          </div>
          <template v-else-if="displayMode === 'waterfall'">
            <div v-if="list.length" class="result-list-wrap">
              <div class="result-list">
                <div
                  v-for="(column, columnIndex) in virtualColumns"
                  :key="`col-${columnIndex}`"
                  class="result-column"
                >
                  <div class="virtual-spacer" :style="{ height: `${column.topSpacer}px` }"></div>
                  <div
                    v-for="row in column.items"
                    :key="row.item.id || row.item.uniqueKey"
                    class="result-item"
                    @touchstart="(e) => onImageTouchStart(row.globalIndex, e)"
                    @touchmove="onImageTouchMove"
                    @touchend="onImageTouchEnd"
                    @touchcancel="onImageTouchEnd"
                    @contextmenu.prevent="openActionByIndex(row.globalIndex)"
                  >
                    <div
                      class="preview-wrap"
                      :class="{ 'preview-wrap--video': row.item.fileType === 'video' }"
                      :style="{ height: `${row.height}px` }"
                      role="button"
                      tabindex="0"
                      @click="openPreview(row.globalIndex)"
                      @keydown.enter.prevent="openPreview(row.globalIndex)"
                    >
                      <template v-if="row.item.fileType === 'video'">
                        <div
                          v-if="row.item.posterSrc && imageErrorState[getItemKey(row.item)]"
                          class="preview-fallback"
                          @click.stop="retryLoadPoster(row.item)"
                        >
                          <van-icon name="photo-fail" size="22" />
                          <div class="preview-fallback-text">{{ imageLoadFailText }}</div>
                        </div>
                        <img
                          v-else-if="row.item.posterSrc"
                          class="preview preview--poster"
                          :src="getDisplayPosterSrc(row.item)"
                          alt=""
                          loading="lazy"
                          decoding="async"
                          :style="{ height: `${row.height}px` }"
                          @error="onPosterLoadError(row.item)"
                        />
                        <div v-else class="preview-video-placeholder" :style="{ minHeight: `${row.height}px` }">
                          <IconifyIcon class="preview-video-ph-icon" icon="custom:video" />
                        </div>
                        <div class="video-play-badge" aria-hidden="true">
                          <IconifyIcon class="video-play-badge-icon" icon="custom:play-circle" />
                        </div>
                      </template>
                      <template v-else>
                        <div
                          v-if="imageErrorState[getItemKey(row.item)]"
                          class="preview-fallback"
                          @click.stop="retryLoadImage(row.item)"
                        >
                          <van-icon name="photo-fail" size="22" />
                          <div class="preview-fallback-text">{{ imageLoadFailText }}</div>
                        </div>
                        <img
                          v-else
                          class="preview"
                          :src="getDisplayImageSrc(row.item)"
                          alt="preview"
                          loading="lazy"
                          decoding="async"
                          :style="{ height: `${row.height}px` }"
                          @error="onImageLoadError(row.item)"
                        />
                      </template>
                    </div>
                  </div>
                  <div class="virtual-spacer" :style="{ height: `${column.bottomSpacer}px` }"></div>
                </div>
              </div>
            </div>
            <van-empty v-else-if="state.finished && !state.loading" image="default" :description="t('messages.noData')" />
            <div v-if="state.loading && list.length" class="load-more-text">{{ t('messages.loading') }}</div>
            <div v-else-if="state.finished && list.length" class="load-more-text">{{ t('messages.noMoreData') }}</div>
          </template>
          <template v-else>
            <div ref="fullscreenSliderRef" class="fullscreen-slider">
              <VirtualList
                v-if="list.length"
                ref="fullscreenListRef"
                :items="list"
                :item-height="fullscreenItemHeight"
                :container-height="fullscreenItemHeight"
                :loading="state.loading"
                :finished="state.finished"
                @scroll="onFullscreenVirtualScroll"
                @load-more="onLoadMore"
              >
                <template #default="{ item, index }">
                  <div
                    class="fullscreen-slide"
                    :style="{
                      backgroundImage: slideBgUrl(item) ? `url(${slideBgUrl(item)})` : 'none',
                      backgroundSize: slideObjectFit,
                      backgroundPosition: 'center',
                      backgroundRepeat: 'no-repeat',
                      backgroundColor: 'rgba(0, 0, 0, 0.07)'
                    }"
                    @touchstart="(e) => onImageTouchStart(index, e)"
                    @touchmove="onImageTouchMove"
                    @touchend="onImageTouchEnd"
                    @touchcancel="onImageTouchEnd"
                    @contextmenu.prevent="openActionByIndex(index)"
                    @click="openPreview(index)"
                  >
                    <div v-if="item.fileType === 'video'" class="fullscreen-slide-video-hint" aria-hidden="true">
                      <IconifyIcon class="fullscreen-slide-play-icon" icon="custom:play-circle" />
                    </div>
                  </div>
                </template>
              </VirtualList>
              <van-empty
                v-else-if="state.finished && !state.loading"
                image="default"
                :description="t('messages.noData')"
              />
              <div v-if="state.loading && list.length" class="load-more-text">{{ t('messages.loading') }}</div>
              <div v-else-if="state.finished && list.length" class="load-more-text">{{ t('messages.noMoreData') }}</div>
            </div>
          </template>
        </div>
      </van-pull-refresh>
    </div>

    <van-popup v-model:show="state.showFilters" position="bottom" round>
      <div class="filter-panel">
        <div class="filter-title">{{ t('h5.pages.search.filters.title') }}</div>
        <van-search
          v-model="form.keywords"
          class="filter-keyword-input"
          :placeholder="t('h5.pages.search.keywordPlaceholder')"
          @search="onApplyFilters"
        />
        <div class="filter-group">
          <div class="group-title">{{ t('exploreCommon.searchForm.resourceType.placeholder') }}</div>
          <van-radio-group
            v-model="form.resourceType"
            class="filter-options"
            direction="horizontal"
            @change="onFilterResourceTypeChange"
          >
            <van-radio v-for="o in resourceTypeOptions" :key="o.value" :name="o.value">{{ o.text }}</van-radio>
          </van-radio-group>
        </div>
        <div class="filter-group">
          <div class="group-title">{{ t('exploreCommon.searchForm.resourceName.placeholder') }}</div>
          <van-radio-group v-model="form.resourceName" class="filter-options" direction="horizontal" @change="onChangeSource">
            <van-radio v-for="o in sourceOptions" :key="o.value" :name="o.value">{{ o.text }}</van-radio>
          </van-radio-group>
        </div>
        <div class="filter-group">
          <div class="group-title">{{ t('exploreCommon.searchForm.filterType.placeholder') }}</div>
          <van-radio-group v-model="form.filterType" class="filter-options" direction="horizontal">
            <van-radio v-for="o in filterTypeDropdownOptions" :key="o.value" :name="o.value">
              {{ o.text }}
            </van-radio>
          </van-radio-group>
        </div>
        <div class="filter-group">
          <div class="group-title">{{ t('exploreCommon.searchForm.orientation.placeholder') }}</div>
          <van-radio-group v-model="form.orientation" class="filter-options" direction="horizontal">
            <van-radio name="">{{ t('h5.pages.search.filters.all') }}</van-radio>
            <van-radio v-for="o in orientationOptions" :key="o.value" :name="String(o.value)">
              {{ t(o.locale) }}
            </van-radio>
          </van-radio-group>
        </div>
        <div class="filter-group">
          <div class="group-title">{{ t('exploreCommon.searchForm.quality.placeholder') }}</div>
          <van-radio-group v-model="form.quality" class="filter-options" direction="horizontal">
            <van-radio name="">{{ t('h5.pages.search.filters.all') }}</van-radio>
            <van-radio v-for="q in qualityList" :key="q" :name="q">{{ q }}</van-radio>
          </van-radio-group>
        </div>
        <div class="filter-actions">
          <van-button class="filter-reset-btn" plain @click="onResetFilters">
            <van-icon name="replay" />
          </van-button>
          <van-button class="filter-search-btn" type="primary" @click="onApplyFilters">
            <van-icon name="search" />
          </van-button>
        </div>
      </div>
    </van-popup>

    <van-popup
      v-model:show="state.showVideoPreview"
      position="center"
      teleport="body"
      class="h5-video-preview-popup"
      :overlay-style="{ background: 'rgba(0,0,0,0.92)' }"
      @closed="onVideoPreviewClosed"
    >
      <div class="h5-video-preview-shell">
        <button type="button" class="h5-video-preview-close" @click="closeVideoPreview">×</button>
        <video
          ref="videoPreviewRef"
          class="h5-video-preview-el"
          controls
          playsinline
          webkit-playsinline
          x5-video-player-type="h5"
          x5-playsinline
          preload="metadata"
          :poster="videoPreviewItem?.posterSrc || ''"
          :src="videoPreviewItem?.videoSrc || ''"
        />
      </div>
    </van-popup>

    <van-image-preview
      v-model:show="state.showPreview"
      :images="previewImages"
      :start-position="previewStartPosition"
      closeable
    />

    <van-popup
      v-model:show="state.showActionPopup"
      destroy-on-close
      position="bottom"
      :style="{ padding: '16px' }"
    >
      <div class="action-popup-content">
        <div class="action-item" @click="showImageInfo">
          <div class="action-icon-wrapper">
            <IconifyIcon class="action-icon-inner" icon="custom:info-line" />
          </div>
          <span class="action-label">{{ t('h5.pages.home.actions.imageInfo') }}</span>
        </div>
        <div class="action-item" @click="toggleSelectedFavorite">
          <div class="action-icon-wrapper">
            <IconifyIcon
              class="action-icon-inner"
              :icon="selectedItem?.isFavorite ? 'custom:star-fill' : 'custom:star'"
              :style="{ color: selectedItem?.isFavorite ? 'gold' : '' }"
            />
          </div>
          <span class="action-label">{{
            selectedItem?.isFavorite ? t('exploreCommon.removeFavorites') : t('exploreCommon.addToFavorites')
          }}</span>
        </div>
        <div class="action-item" @click="saveImage">
          <div class="action-icon-wrapper">
            <IconifyIcon class="action-icon-inner" icon="custom:download-line" />
          </div>
          <span class="action-label">{{ t('h5.pages.home.actions.saveImage') }}</span>
        </div>
        <div class="action-item delete-action" @click="deleteImage">
          <div class="action-icon-wrapper">
            <IconifyIcon class="action-icon-inner" icon="custom:delete-line" />
          </div>
          <span class="action-label">{{ t('h5.pages.home.actions.deleteImage') }}</span>
        </div>
      </div>
    </van-popup>

    <van-floating-panel
      v-model:height="imageInfoPanelHeight"
      :anchors="imageInfoPanelAnchors"
      @height-change="onImageInfoHeightChange"
    >
      <div class="image-info-content">
        <van-cell-group v-if="selectedItem">
          <van-cell
            v-for="key in infoKeys"
            :key="key"
            value-class="image-info-value"
            :title="t(`h5.pages.home.imageInfo.${key}`)"
            :value="handleInfoVal(selectedItem, key)"
          />
        </van-cell-group>
      </div>
    </van-floating-panel>

    <div v-if="displayMode === 'fullscreen' && list.length" class="fullscreen-page-indicator">
      {{ fullscreenIndicatorText }}
    </div>
  </div>
</template>

<style scoped lang="scss">
.page-search-inner {
  padding-bottom: var(--fbw-tabbar-height);
}
.page-search.page-search--fullscreen {
  height: 100vh;
  height: 100dvh;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
}
.page-search--fullscreen .page-search-inner {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}
.page-search--fullscreen :deep(.van-pull-refresh) {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.page-search--fullscreen :deep(.van-pull-refresh__track) {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}
.search-pull-inner--fullscreen {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}
.page-search--fullscreen .fullscreen-slider {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}
.page-search--fullscreen :deep(.virtual-list) {
  flex: 1;
  min-height: 0;
}
.fullscreen-slide {
  width: 100%;
  height: 100%;
  cursor: pointer;
  position: relative;
  box-sizing: border-box;
}
.fullscreen-slide-video-hint {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: none;
  color: rgba(255, 255, 255, 0.92);
  filter: drop-shadow(0 2px 8px rgba(0, 0, 0, 0.45));
}
.fullscreen-slide-play-icon {
  font-size: 56px;
}
.fullscreen-page-indicator {
  position: fixed;
  z-index: 200;
  right: 12px;
  bottom: calc(var(--fbw-tabbar-height, 50px) + 12px);
  padding: 4px 10px;
  border-radius: 999px;
  font-size: 13px;
  color: #fff;
  background: rgba(0, 0, 0, 0.45);
  pointer-events: none;
}
.layout-mode-btn {
  width: 34px;
  height: 34px;
  min-width: 34px;
  border-radius: 8px;
  padding: 0;
}
.search-toolbar {
  position: sticky;
  top: 0;
  z-index: 10;
  background: #fff;
  box-shadow: 0 1px 0 rgba(0, 0, 0, 0.06);
}
.search-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px 10px;
}
.search-input {
  flex: 1;
}
.filter-btn {
  width: 34px;
  height: 34px;
  min-width: 34px;
  border-radius: 8px;
  padding: 0;
}
.result-list {
  padding: 0 12px;
  display: flex;
  gap: 10px;
  align-items: flex-start;
}
.result-column {
  flex: 1;
  min-width: 0;
}
.result-list-wrap {
  padding-bottom: 12px;
}
.result-list-skeleton {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}
.result-item {
  width: 100%;
  margin-bottom: 10px;
  padding: 0;
  background: #fff;
  border-radius: 10px;
  border: 1px solid rgba(0, 0, 0, 0.06);
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.04);
  overflow: hidden;
  break-inside: avoid;
  content-visibility: auto;
  contain-intrinsic-size: 280px;
}
.preview-wrap {
  border-radius: 0;
  overflow: hidden;
  background: rgba(0, 0, 0, 0.05);
}
.preview-fallback {
  width: 100%;
  height: 100%;
  min-height: 120px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  gap: 8px;
  color: var(--van-text-color-2);
  background: rgba(0, 0, 0, 0.03);
}
.preview-fallback-text {
  font-size: 12px;
  line-height: 1.2;
  max-width: calc(100% - 20px);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  text-align: center;
}
.preview {
  width: 100%;
  display: block;
  object-fit: contain;
}
.preview-wrap--video {
  position: relative;
  cursor: pointer;
}
.preview-video-placeholder {
  width: 100%;
  height: 100%;
  min-height: 120px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--van-text-color-3);
  background: rgba(0, 0, 0, 0.06);
}
.video-play-badge {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: none;
  color: rgba(255, 255, 255, 0.95);
  filter: drop-shadow(0 2px 8px rgba(0, 0, 0, 0.45));
}
.preview-video-ph-icon {
  font-size: 40px;
  opacity: 0.55;
}
.video-play-badge-icon {
  font-size: 44px;
}
.h5-video-preview-shell {
  position: relative;
  width: min(100vw, 960px);
  margin: 0 auto;
  padding: 44px 12px 20px;
  box-sizing: border-box;
}
.h5-video-preview-el {
  display: block;
  width: 100%;
  max-height: min(78vh, 720px);
  border-radius: 8px;
  background: #000;
}
.h5-video-preview-close {
  position: absolute;
  top: 4px;
  right: 8px;
  z-index: 2;
  width: 40px;
  height: 40px;
  padding: 0;
  border: none;
  border-radius: 50%;
  font-size: 28px;
  line-height: 40px;
  color: #fff;
  background: rgba(0, 0, 0, 0.35);
  cursor: pointer;
}
.h5-video-preview-close:active {
  background: rgba(0, 0, 0, 0.5);
}
:deep(.h5-video-preview-popup.van-popup) {
  width: 100%;
  max-width: 100vw;
  height: 100%;
  max-height: 100vh;
  overflow: hidden;
  background: transparent;
}
.virtual-spacer {
  width: 100%;
}
.load-more-text {
  text-align: center;
  color: var(--van-text-color-3);
  font-size: 12px;
  padding: 8px 0 12px;
}
.filter-panel {
  padding: 16px;
  max-width: 820px;
  margin: 0 auto;
}
.filter-title {
  margin-bottom: 12px;
  font-weight: 600;
  font-size: 15px;
}
.filter-group {
  padding: 10px 0;
  border-bottom: 1px solid var(--van-border-color);
}
.group-title {
  margin-bottom: 8px;
  font-size: 13px;
  color: var(--van-text-color-2);
}
.filter-keyword-input {
  margin-bottom: 10px;
}
.filter-options {
  display: flex;
  flex-wrap: wrap;
  gap: 10px 14px;
}
.filter-options :deep(.van-radio) {
  min-width: 96px;
}
.filter-actions {
  margin-top: 16px;
  display: flex;
  gap: 10px;
}
.filter-reset-btn {
  width: 44px;
  min-width: 44px;
  padding: 0;
}
.filter-search-btn {
  flex: 1;
}

.action-popup-content {
  display: flex;
  justify-content: space-evenly;
  align-items: center;
  flex-direction: row;
  gap: 16px;
}

.action-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  font-size: 16px;
}

.action-icon-wrapper {
  display: flex;
  justify-content: center;
  align-items: center;
  background-color: #eee;
  border-radius: 10px;
  padding: 14px;
  font-size: 24px;
}

.action-icon-inner {
  transition: transform 0.3s ease-out;
}

.action-label {
  font-size: 12px;
}

.delete-action {
  color: #ff4d4f;
}

.image-info-content {
  max-height: 60vh;
  overflow: auto;
}

@media (min-width: 768px) {
  .page-search-inner {
    max-width: 1080px;
    margin: 0 auto;
  }

  .result-list {
    gap: 10px;
  }
}

@media (min-width: 1200px) {
  .result-list {
    gap: 10px;
  }
}
</style>
