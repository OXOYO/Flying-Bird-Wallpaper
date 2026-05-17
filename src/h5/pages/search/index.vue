<script setup>
import UseCommonStore from '@h5/stores/commonStore.js'
import UseSettingStore from '@h5/stores/settingStore.js'
import * as api from '@h5/api/index.js'
import {
  resourceTypeList,
  filterTypeOptions,
  orientationOptions,
  qualityList,
  sortFieldOptions,
  sortTypeOptions
} from '@common/publicData.js'
import { useTranslation } from 'i18next-vue'
import { infoKeys } from '@common/publicData.js'
import { handleInfoVal, resolveApiUserMessage, isTransientSearchFailure } from '@common/utils.js'
import VirtualList from '@h5/components/VirtualList.vue'
import {
  applyH5ImageCompress,
  buildH5LocalImageUrl,
  isH5LocalImageApiUrl
} from '@h5/utils/imageUrl.js'
import { getH5NumberIndicatorStyle } from '@h5/utils/indicatorStyle.js'

const { t } = useTranslation()
const commonStore = UseCommonStore()
const settingStore = UseSettingStore()
const { settingData } = storeToRefs(settingStore)

/** 搜索页本地资源排序默认值（与首页设置 h5Sort* 独立） */
const SEARCH_LOCAL_SORT_DEFAULT = {
  sortField: 'created_at',
  sortType: -1
}

const form = reactive({
  keywords: '',
  resourceType: 'localResource',
  resourceName: '',
  filterType: 'images',
  orientation: '',
  quality: '',
  sortField: SEARCH_LOCAL_SORT_DEFAULT.sortField,
  sortType: SEARCH_LOCAL_SORT_DEFAULT.sortType,
  isRandom: false
})

const resetSearchLocalSort = () => {
  form.sortField = SEARCH_LOCAL_SORT_DEFAULT.sortField
  form.sortType = SEARCH_LOCAL_SORT_DEFAULT.sortType
}

const page = reactive({
  startPage: 1,
  pageSize: 20,
  total: 0
})

let loadListSeq = 0

const getSearchListDedupKey = (item) => {
  if (item?.id != null && item.id !== '') return `id:${item.id}`
  if (item?.fileName) return `fn:${item.fileName}`
  if (item?.filePath) return `fp:${item.filePath}`
  const url =
    item?.imageRawSrc ||
    item?.imageSrc ||
    item?.imageUrl ||
    item?.posterRawSrc ||
    item?.posterSrc ||
    item?.videoSrc ||
    item?.videoUrl ||
    ''
  if (url) return `url:${url}`
  if (item?.uniqueKey) return `uk:${item.uniqueKey}`
  return ''
}

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
const searchToolbarRef = ref(null)
const searchToolbarHeight = ref(52)
let searchToolbarResizeObserver = null
const videoPreviewRef = ref(null)
const videoPreviewViewportRef = ref(null)
const videoPreviewForcedLandscape = ref(false)
const fullscreenListRef = ref(null)
const fullscreenSliderRef = ref(null)
const fullscreenMeasuredHeight = ref(420)
const fullscreenVisibleIndex = ref(0)
let fullscreenResizeObserver = null

const DISPLAY_MODE_STORAGE_KEY = 'fbw_h5_search_display_mode'
/** 非通用 name，降低浏览器把历史搜索词当作自动填充的概率 */
const H5_SEARCH_FIELD_NAME = 'fbw-h5-search-keywords'
const readStoredDisplayMode = () => {
  try {
    return localStorage.getItem(DISPLAY_MODE_STORAGE_KEY) === 'fullscreen' ? 'fullscreen' : 'waterfall'
  } catch {
    return 'waterfall'
  }
}
const displayMode = ref(readStoredDisplayMode())

// 瀑布流模式下防止触底滚动在短时间内多次触发加载（与 VirtualList 侧 latch 同理）
const waterfallLoadMoreLatch = ref(false)
watch(
  () => state.loading,
  (loading) => {
    if (!loading) waterfallLoadMoreLatch.value = false
  }
)

const list = ref([])
const FALLBACK_ITEM_HEIGHT = 220
const GRID_GAP = 10
const GRID_BUFFER_PX = 900
/** 与 .search-pull-inner 的 padding-top 保持一致 */
const SEARCH_WATERFALL_CONTENT_GAP_PX = 10
/** 顶部指示器与首行卡片顶边的间距 */
const SEARCH_INDICATOR_TOP_CARD_GAP_PX = 8
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

const sortFieldRadioOptions = computed(() =>
  sortFieldOptions.map((item) => ({
    value: item.value,
    text: t(item.locale)
  }))
)

const sortTypeRadioOptions = computed(() =>
  sortTypeOptions.map((item) => ({
    value: item.value,
    text: t(item.locale)
  }))
)

const normalizeItem = (item) => {
  const isVideo = item.fileType === 'video'

  if (isVideo) {
    let posterRaw = ''
    let videoSrc = ''

    if (item.srcType === 'file') {
      videoSrc = `/api/videos/get?filePath=${encodeURIComponent(item.filePath)}`
      const iu = item.imageUrl || ''
      if (iu) {
        posterRaw = /^https?:\/\//i.test(iu) ? iu : buildH5LocalImageUrl(iu)
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
    const rawUrl = buildH5LocalImageUrl(item.filePath)
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
const resolveImageCompressWidth = (options = {}) => {
  if (options.width) return Math.max(1, Math.round(options.width))
  if (displayMode.value === 'fullscreen') {
    return Math.max(240, Math.round(state.viewportWidth || 375))
  }
  return Math.max(80, Math.round(cardWidth.value || 160))
}

const withH5ImageCompress = (url, options = {}) => {
  if (!url || !isH5LocalImageApiUrl(url)) return url
  return applyH5ImageCompress(url, {
    width: resolveImageCompressWidth(options),
    settingData: settingData.value
  })
}

const getDisplayImageSrc = (item, options = {}) => {
  const key = getItemKey(item)
  const seed = imageRetrySeed[key] || 0
  const base = item.imageRawSrc || item.imageSrc || ''
  if (!seed) return withH5ImageCompress(base, options)
  const compressed = withH5ImageCompress(base, options)
  const separator = compressed.includes('?') ? '&' : '?'
  return `${compressed}${separator}_retry=${seed}`
}
const getDisplayPosterSrc = (item, options = {}) => {
  const key = getItemKey(item)
  const seed = imageRetrySeed[key] || 0
  const raw = item.posterRawSrc || ''
  if (!raw) return ''
  if (!seed) return withH5ImageCompress(item.posterSrc || raw, options)
  const compressed = withH5ImageCompress(raw, options)
  const separator = compressed.includes('?') ? '&' : '?'
  return `${compressed}${separator}_retry=${seed}`
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

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

const fetchSearchPageWithRetry = async (payload) => {
  const maxAttempts = 3
  let lastRes = null
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    lastRes = await api.searchImages(payload)
    if (lastRes?.success && Array.isArray(lastRes?.data?.list)) {
      return lastRes
    }
    const retryable = isTransientSearchFailure(lastRes)
    if (!retryable || attempt === maxAttempts - 1) break
    await sleep(320 * (attempt + 1))
  }
  return lastRes
}

const loadList = async (reset = false) => {
  if (state.loading) return
  const reqSeq = ++loadListSeq
  if (reset) {
    page.startPage = 1
    page.total = 0
    list.value = []
    state.finished = false
  }
  state.loading = true
  try {
    const rawForm = toRaw(form)
    const payload = {
      ...rawForm,
      filterKeywords: rawForm.keywords,
      keywords: rawForm.keywords,
      startPage: page.startPage,
      pageSize: page.pageSize,
      sortField: rawForm.sortField || SEARCH_LOCAL_SORT_DEFAULT.sortField,
      sortType: Number(rawForm.sortType) || SEARCH_LOCAL_SORT_DEFAULT.sortType,
      isRandom: !!rawForm.isRandom
    }
    const res = await fetchSearchPageWithRetry(payload)
    if (reqSeq !== loadListSeq) return
    if (res?.success && Array.isArray(res?.data?.list)) {
      const prevCount = list.value.length
      const merged = [...list.value, ...res.data.list.map(normalizeItem)]
      const map = new Map()
      merged.forEach((item) => {
        const key = getSearchListDedupKey(item)
        if (key) map.set(key, item)
      })
      list.value = [...map.values()]
      if (typeof res.data.total === 'number' && res.data.total >= 0) {
        page.total = res.data.total
      } else if (reset || page.total === 0) {
        page.total = list.value.length
      }
      page.startPage += 1
      const pageRows = res.data.list.length
      const noNewRows = pageRows > 0 && list.value.length === prevCount
      if (!pageRows || pageRows < page.pageSize || noNewRows) {
        state.finished = true
      }
    } else {
      if (!isTransientSearchFailure(res)) {
        state.finished = true
      }
      showNotify({
        type: 'danger',
        message: resolveApiUserMessage(res, t)
      })
    }
  } catch (err) {
    if (!isTransientSearchFailure(err)) {
      state.finished = true
    }
    showNotify({
      type: 'danger',
      message: resolveApiUserMessage(err, t)
    })
  } finally {
    state.loading = false
    state.refreshing = false
  }
}

const onSearch = async () => {
  await loadList(true)
}

const onRefresh = async () => {
  state.refreshing = true
  await loadList(true)
}

const onLoadMore = async () => {
  if (state.finished || state.showActionPopup) return
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
    showNotify({ type: 'danger', message: resolveApiUserMessage(res, t) || t('messages.operationFail') })
  }
}

const onResetFilters = () => {
  form.resourceType = 'localResource'
  const first = sourceOptions.value[0]
  form.resourceName = first ? first.value : ''
  form.filterType = 'images'
  form.orientation = ''
  form.quality = ''
  resetSearchLocalSort()
  onSearch()
}

// 仅在打开预览时生成数组；排除视频项，避免与 van-image-preview 下标错位
const previewImages = computed(() => {
  if (!state.showPreview) return []
  return list.value
    .filter((item) => item.fileType !== 'video')
    .map((item) => getDisplayImageSrc(item, { width: state.viewportWidth }))
    .filter(Boolean)
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

/** 服务端返回的匹配总数（用于指示器分母） */
const searchResultTotal = computed(() => {
  const server = Number(page.total) || 0
  const loaded = list.value.length
  if (server > 0) return server
  return Math.max(1, loaded)
})

// 瀑布流指示器：已加载条数 / 服务端总数
const waterfallIndicatorText = computed(() => {
  const loaded = list.value.length
  const total = searchResultTotal.value
  return t('h5.pages.search.displayMode.indicatorLoadedTotal', {
    loaded: Math.min(loaded, total),
    total
  })
})

const previewObjectFit = computed(() =>
  settingData.value?.h5ImageDisplaySize === 'cover' ? 'cover' : 'contain'
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

// 铺满模式：当前所在张（从 1 计）/ 服务端总数（当前索引不超过已加载条数）
const fullscreenIndicatorText = computed(() => {
  const len = list.value.length
  const cur = len ? Math.min(fullscreenVisibleIndex.value + 1, len) : 0
  const total = searchResultTotal.value
  return t('h5.pages.search.displayMode.indicator', { current: cur, total })
})

const measureSearchToolbarHeight = () => {
  const el = searchToolbarRef.value
  if (!el) return
  const h = Math.round(el.getBoundingClientRect().height)
  if (h > 0) searchToolbarHeight.value = h
}

const bindSearchToolbarResizeObserver = () => {
  searchToolbarResizeObserver?.disconnect()
  const el = searchToolbarRef.value
  if (!el || typeof ResizeObserver === 'undefined') return
  searchToolbarResizeObserver = new ResizeObserver(() => measureSearchToolbarHeight())
  searchToolbarResizeObserver.observe(el)
}

const searchPageIndicatorStyle = computed(() => {
  const position = settingData.value.h5NumberIndicatorPosition
  let topOffset =
    displayMode.value === 'fullscreen'
      ? 'calc(8px + env(safe-area-inset-top, 0px))'
      : `calc(${searchToolbarHeight.value}px + env(safe-area-inset-top, 0px) + 4px)`

  // 顶部指示器：搜索栏 + 列表上留白 + 与首行卡片间距
  if (position === 'top' && displayMode.value !== 'fullscreen') {
    topOffset = `calc(${searchToolbarHeight.value}px + ${SEARCH_WATERFALL_CONTENT_GAP_PX}px + ${SEARCH_INDICATOR_TOP_CARD_GAP_PX}px + env(safe-area-inset-top, 0px))`
  }

  return getH5NumberIndicatorStyle(position, { topOffset })
})

const syncWaterfallScrollMetrics = () => {
  const wrap = pageWrapperRef.value
  if (!wrap || displayMode.value !== 'waterfall') return
  state.scrollTop = wrap.scrollTop || 0
}

watch(displayMode, (mode) => {
  if (mode !== 'fullscreen') {
    fullscreenResizeObserver?.disconnect()
    fullscreenResizeObserver = null
    nextTick(() => {
      syncWaterfallScrollMetrics()
      measureSearchToolbarHeight()
    })
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

const videoPreviewDeviceLandscape = computed(
  () => state.viewportWidth > state.viewportHeight
)

const videoPreviewInLandscapeView = computed(
  () => videoPreviewForcedLandscape.value || videoPreviewDeviceLandscape.value
)

const videoPreviewRotateIcon = computed(() =>
  videoPreviewInLandscapeView.value ? 'custom:portrait-outline' : 'custom:landscape-outline'
)

const videoPreviewRotateLabel = computed(() =>
  videoPreviewInLandscapeView.value
    ? t('h5.pages.search.videoPreview.exitLandscape')
    : t('h5.pages.search.videoPreview.enterLandscape')
)

const canLockScreenOrientation = () =>
  typeof screen !== 'undefined' && typeof screen.orientation?.lock === 'function'

const releaseVideoPreviewLandscape = async () => {
  try {
    screen.orientation?.unlock?.()
  } catch (_) {
    /* noop */
  }
  try {
    const fs = document.fullscreenElement
    const viewport = videoPreviewViewportRef.value
    if (fs && viewport && (fs === viewport || viewport.contains(fs))) {
      await document.exitFullscreen()
    }
  } catch (_) {
    /* noop */
  }
}

const tryLockVideoPreviewLandscape = async () => {
  if (!canLockScreenOrientation()) return false
  try {
    const viewport = videoPreviewViewportRef.value
    if (!viewport) return false
    if (!document.fullscreenElement) {
      await viewport.requestFullscreen()
    }
    await screen.orientation.lock('landscape')
    return true
  } catch (_) {
    return false
  }
}

const toggleVideoPreviewLandscape = async () => {
  if (videoPreviewInLandscapeView.value) {
    videoPreviewForcedLandscape.value = false
    await releaseVideoPreviewLandscape()
    return
  }
  videoPreviewForcedLandscape.value = true
  await tryLockVideoPreviewLandscape()
}

const resetVideoPreviewLandscape = () => {
  videoPreviewForcedLandscape.value = false
  void releaseVideoPreviewLandscape()
}

const closeVideoPreview = () => {
  state.showVideoPreview = false
}

const onVideoPreviewClosed = () => {
  resetVideoPreviewLandscape()
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

const startVideoPreviewPlayback = () => {
  const el = videoPreviewRef.value
  if (!el?.src) return
  const play = () => {
    el.play?.().catch(() => {})
  }
  if (el.readyState >= 2) {
    play()
    return
  }
  el.addEventListener('loadeddata', play, { once: true })
}

const onVideoPreviewOpened = () => {
  nextTick(() => startVideoPreviewPlayback())
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
      showNotify({
        type: 'danger',
        message: resolveApiUserMessage(res, t) || t('messages.deleteFail')
      })
    }
  } catch (error) {
    if (error !== 'cancel') {
      showNotify({
        type: 'danger',
        message: resolveApiUserMessage(error, t) || t('messages.deleteFail')
      })
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
    !state.showActionPopup &&
    !state.loading &&
    !state.finished &&
    !waterfallLoadMoreLatch.value
  ) {
    waterfallLoadMoreLatch.value = true
    onLoadMore()
  }
}

const onPageResize = () => {
  state.viewportHeight = window.innerHeight
  state.viewportWidth = window.innerWidth
  nextTick(() => {
    measureSearchToolbarHeight()
    if (displayMode.value === 'fullscreen') {
      measureFullscreenHeight()
    }
  })
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

// 预览弹层挂载在 body，长按 img 会触发浏览器默认菜单；捕获阶段阻止
const onImagePreviewContextMenu = (e) => {
  const el = e.target
  if (!(el instanceof Element)) return
  if (el.closest('.van-image-preview')) {
    e.preventDefault()
  }
}

watch(
  () => state.showPreview,
  (show) => {
    if (show) {
      document.addEventListener('contextmenu', onImagePreviewContextMenu, true)
    } else {
      document.removeEventListener('contextmenu', onImagePreviewContextMenu, true)
    }
  }
)

onUnmounted(() => {
  document.removeEventListener('contextmenu', onImagePreviewContextMenu, true)
  if (longPress.timer) {
    clearTimeout(longPress.timer)
    longPress.timer = null
  }
  fullscreenResizeObserver?.disconnect()
  fullscreenResizeObserver = null
  searchToolbarResizeObserver?.disconnect()
  searchToolbarResizeObserver = null
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
  nextTick(() => {
    measureSearchToolbarHeight()
    bindSearchToolbarResizeObserver()
    syncWaterfallScrollMetrics()
    if (displayMode.value === 'fullscreen') {
      bindFullscreenResizeObserver()
      measureFullscreenHeight()
    }
  })
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
      <div ref="searchToolbarRef" class="search-toolbar">
        <div class="search-row">
          <form class="search-form" autocomplete="off" @submit.prevent="onSearch">
            <van-search
              v-model="form.keywords"
              class="search-input"
              :name="H5_SEARCH_FIELD_NAME"
              autocomplete="off"
              autocorrect="off"
              autocapitalize="off"
              :spellcheck="false"
              :placeholder="t('h5.pages.search.keywordPlaceholder')"
              @search="onSearch"
            />
          </form>
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
                          :style="{ objectFit: previewObjectFit }"
                          :src="getDisplayPosterSrc(row.item)"
                          alt=""
                          loading="lazy"
                          decoding="async"
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
                          :style="{ objectFit: previewObjectFit }"
                          :src="getDisplayImageSrc(row.item)"
                          alt="preview"
                          loading="lazy"
                          decoding="async"
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
                      backgroundSize: previewObjectFit,
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

    <van-popup v-model:show="state.showFilters" position="bottom" round class="search-filters-popup">
      <div class="filter-panel">
        <div class="filter-panel-header">
          <div class="filter-title">{{ t('h5.pages.search.filters.title') }}</div>
          <form class="filter-keyword-form" autocomplete="off" @submit.prevent="onApplyFilters">
            <van-search
              v-model="form.keywords"
              class="filter-keyword-input"
              :name="H5_SEARCH_FIELD_NAME"
              autocomplete="off"
              autocorrect="off"
              autocapitalize="off"
              :spellcheck="false"
              :placeholder="t('h5.pages.search.keywordPlaceholder')"
              @search="onApplyFilters"
            />
          </form>
        </div>
        <div class="filter-panel-body">
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
        <template v-if="form.resourceType === 'localResource'">
          <div class="filter-group">
            <div class="group-title">{{ t('pages.Setting.settingDataForm.sortField') }}</div>
            <van-radio-group v-model="form.sortField" class="filter-options filter-options--sort" direction="horizontal">
              <van-radio v-for="o in sortFieldRadioOptions" :key="o.value" :name="o.value">{{ o.text }}</van-radio>
            </van-radio-group>
          </div>
          <div class="filter-group">
            <div class="group-title">{{ t('pages.Setting.settingDataForm.sortType') }}</div>
            <van-radio-group v-model="form.sortType" class="filter-options" direction="horizontal">
              <van-radio v-for="o in sortTypeRadioOptions" :key="o.value" :name="o.value">{{ o.text }}</van-radio>
            </van-radio-group>
          </div>
        </template>
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
      :overlay-style="{ background: 'rgba(0,0,0,0.94)' }"
      :style="{ width: '100%', height: '100%', maxWidth: '100%', background: 'transparent' }"
      @opened="onVideoPreviewOpened"
      @closed="onVideoPreviewClosed"
    >
      <div
        ref="videoPreviewViewportRef"
        class="h5-video-preview-viewport"
        :class="{
          'h5-video-preview-viewport--natural-landscape': videoPreviewDeviceLandscape,
          'h5-video-preview-viewport--forced-landscape':
            videoPreviewForcedLandscape && !videoPreviewDeviceLandscape
        }"
      >
        <button
          type="button"
          class="h5-video-preview-rotate"
          :aria-label="videoPreviewRotateLabel"
          @click.stop="toggleVideoPreviewLandscape"
        >
          <IconifyIcon class="h5-video-preview-rotate-icon" :icon="videoPreviewRotateIcon" />
        </button>
        <button
          type="button"
          class="h5-video-preview-close"
          :aria-label="t('h5.pages.search.videoPreview.close')"
          @click.stop="closeVideoPreview"
        >
          <van-icon name="cross" size="22" />
        </button>
        <div class="h5-video-preview-stage">
          <video
          ref="videoPreviewRef"
          class="h5-video-preview-el"
          controls
          playsinline
          webkit-playsinline
          x5-video-player-type="h5"
          x5-playsinline
          controlslist="nodownload"
          preload="auto"
          :poster="videoPreviewItem?.posterSrc || ''"
          :src="videoPreviewItem?.videoSrc || ''"
            @click.stop
          />
        </div>
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

    <div
      v-if="list.length"
      class="search-page-indicator"
      :style="searchPageIndicatorStyle"
    >
      {{ displayMode === 'fullscreen' ? fullscreenIndicatorText : waterfallIndicatorText }}
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
.search-pull-inner:not(.search-pull-inner--fullscreen) {
  padding-top: 10px;
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
.search-page-indicator {
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
.search-form {
  flex: 1;
  min-width: 0;
  margin: 0;
}
.search-input {
  width: 100%;
  padding: 0;
}
.filter-keyword-form {
  margin: 0;
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
  position: relative;
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
  height: 100%;
  display: block;
  object-position: center;
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
.h5-video-preview-viewport {
  position: fixed;
  inset: 0;
  z-index: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
  width: 100%;
  height: 100%;
  max-width: 100%;
  max-height: 100%;
  padding:
    calc(56px + env(safe-area-inset-top, 0px))
    calc(12px + env(safe-area-inset-right, 0px))
    calc(12px + env(safe-area-inset-bottom, 0px))
    calc(12px + env(safe-area-inset-left, 0px));
  background: transparent;
  overflow: hidden;
  overscroll-behavior: none;
  -webkit-overflow-scrolling: auto;
}
.h5-video-preview-viewport--natural-landscape {
  padding:
    calc(12px + env(safe-area-inset-top, 0px))
    env(safe-area-inset-right, 0px)
    env(safe-area-inset-bottom, 0px)
    env(safe-area-inset-left, 0px);
}
.h5-video-preview-viewport--forced-landscape {
  padding: env(safe-area-inset-top, 0px) env(safe-area-inset-right, 0px)
    env(safe-area-inset-bottom, 0px) env(safe-area-inset-left, 0px);
}
.h5-video-preview-viewport--forced-landscape .h5-video-preview-stage {
  position: absolute;
  inset: 0;
  flex: none;
  width: auto;
  height: auto;
  max-width: none;
  max-height: none;
  transform: none;
}
.h5-video-preview-viewport--forced-landscape .h5-video-preview-el {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 100dvh;
  width: 100vh;
  height: 100dvw;
  height: 100vw;
  max-width: none;
  max-height: none;
  transform: translate(-50%, -50%) rotate(90deg);
  transform-origin: center center;
}
.h5-video-preview-stage {
  position: relative;
  display: flex;
  flex: 1 1 auto;
  align-items: center;
  justify-content: center;
  width: 100%;
  min-width: 0;
  min-height: 0;
  max-width: 100%;
  max-height: 100%;
  overflow: hidden;
}
.h5-video-preview-el {
  display: block;
  width: auto;
  height: auto;
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
  background: #000;
  border-radius: 0;
}
.h5-video-preview-rotate {
  position: fixed;
  top: calc(10px + env(safe-area-inset-top, 0px));
  right: calc(62px + env(safe-area-inset-right, 0px));
  z-index: 3001;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  padding: 0;
  border: none;
  border-radius: 50%;
  color: #fff;
  background: rgba(0, 0, 0, 0.45);
  backdrop-filter: blur(6px);
  -webkit-backdrop-filter: blur(6px);
  cursor: pointer;
  touch-action: manipulation;
}
.h5-video-preview-rotate:active {
  background: rgba(0, 0, 0, 0.62);
}
.h5-video-preview-rotate-icon {
  font-size: 22px;
}
.h5-video-preview-close {
  position: fixed;
  top: calc(10px + env(safe-area-inset-top, 0px));
  right: calc(10px + env(safe-area-inset-right, 0px));
  z-index: 3001;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  padding: 0;
  border: none;
  border-radius: 50%;
  color: #fff;
  background: rgba(0, 0, 0, 0.45);
  backdrop-filter: blur(6px);
  -webkit-backdrop-filter: blur(6px);
  cursor: pointer;
  touch-action: manipulation;
}
.h5-video-preview-close:active {
  background: rgba(0, 0, 0, 0.62);
}
:deep(.h5-video-preview-popup.van-popup) {
  top: 0 !important;
  left: 0 !important;
  width: 100% !important;
  max-width: 100% !important;
  height: 100% !important;
  max-height: 100% !important;
  margin: 0;
  transform: none !important;
  overflow: hidden !important;
  background: transparent !important;
  box-shadow: none;
}
:deep(.h5-video-preview-popup.van-popup--center) {
  transform: none !important;
}
:deep(.h5-video-preview-popup .van-popup__content) {
  width: 100%;
  height: 100%;
  max-width: 100%;
  max-height: 100%;
  overflow: hidden !important;
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
.search-filters-popup :deep(.van-popup) {
  max-height: 60dvh;
  overflow: hidden;
}
.filter-panel {
  display: flex;
  flex-direction: column;
  max-height: 60dvh;
  max-width: 820px;
  margin: 0 auto;
  padding: 16px 16px calc(16px + env(safe-area-inset-bottom, 0px));
  box-sizing: border-box;
}
.filter-panel-header {
  flex-shrink: 0;
}
.filter-panel-body {
  flex: 1 1 auto;
  min-height: 0;
  overflow-x: hidden;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
  overscroll-behavior: contain;
  margin: 0 -4px;
  padding: 0 4px;
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
  flex-shrink: 0;
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid var(--van-border-color);
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

<!-- 预览 teleport 到 body，需非 scoped：禁用长按系统菜单/保存图片等 -->
<style lang="scss">
.van-image-preview {
  -webkit-touch-callout: none;
}
.van-image-preview img,
.van-image-preview__image img {
  -webkit-touch-callout: none !important;
  -webkit-user-select: none !important;
  user-select: none !important;
}
</style>
