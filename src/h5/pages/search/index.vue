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
  sortTypeOptions,
  imageDisplaySizeOptions,
  isQualityFilterApplicable
} from '@common/publicData.js'
import { useTranslation } from 'i18next-vue'
import { infoKeys } from '@common/publicData.js'
import { handleInfoVal, resolveApiUserMessage, isTransientSearchFailure } from '@common/utils.js'
import { usePrivacyNsfwMask } from '@common/composables/usePrivacyNsfwMask.mjs'
import H5PrivacyPasswordDialog from '@h5/components/H5PrivacyPasswordDialog.vue'
import H5NsfwContentMask from '@h5/components/H5NsfwContentMask.vue'
import H5FullscreenPager from '@h5/components/H5FullscreenPager.vue'
import H5FloatingButtons from '@h5/components/H5FloatingButtons.vue'
import H5ListEmpty from '@h5/components/H5ListEmpty.vue'
import H5BrowseChrome from '@h5/components/H5BrowseChrome.vue'
import { useH5FullscreenAutoPlay } from '@h5/composables/useH5FullscreenAutoPlay.js'
import {
  applyH5CardImageCompress,
  applyH5ImageCompress,
  buildH5LocalImageUrl
} from '@h5/utils/imageUrl.js'
import { getH5NumberIndicatorStyle } from '@h5/utils/indicatorStyle.js'

const { t } = useTranslation()
const commonStore = UseCommonStore()
const settingStore = UseSettingStore()
const { settingData } = storeToRefs(settingStore)
const { immersiveMode } = storeToRefs(commonStore)

const privacyPasswordDialogRef = ref(null)

const {
  shouldMaskItem,
  onMaskClick: onNsfwMaskClick,
  lockPage: lockNsfwMaskPage,
  refreshHasPassword: refreshNsfwMaskHasPassword,
  isActionBlocked: isNsfwActionBlocked
} = usePrivacyNsfwMask({
  settingData,
  hasPrivacyPassword: () => api.hasPrivacyPassword(),
  openPasswordDialog: () => privacyPasswordDialogRef.value?.open(),
  checkPrivacyPassword: (pwd) => api.checkPrivacyPassword(pwd),
  onVerifyFail: (res) => {
    const isNoPwd = res?.errorCode === 'PRIVACY_PASSWORD_NOT_SET'
    showNotify({
      type: isNoPwd ? 'warning' : 'danger',
      message: isNoPwd
        ? t('messages.privacyPasswordNotSet')
        : resolveApiUserMessage(res, t) || t('messages.verifyPrivacyPasswordFail')
    })
  }
})

const notifyNsfwMaskBlocked = () => {
  showNotify({ type: 'warning', message: t('privacyNsfwMask.actionBlocked') })
}

const blockIfNsfwMasked = (item) => {
  if (item && isNsfwActionBlocked(item)) {
    notifyNsfwMaskBlocked()
    return true
  }
  return false
}

const useSemanticSearch = computed(() => !!settingData.value?.search?.useSemanticSearch)

const semanticSearchAvailable = computed(() => !!settingData.value?.ai?.enabled)

const onSemanticSearchChange = async (val) => {
  await settingStore.h5UpdateSettingData({
    search: {
      ...(settingData.value?.search || {}),
      useSemanticSearch: !!val
    }
  })
}

/** 搜索页本地资源排序默认值（与首页设置 h5Sort* 独立） */
const SEARCH_LOCAL_SORT_DEFAULT = {
  sortField: 'created_at',
  sortType: -1
}

/** 进入搜索页默认本地资源库（与旧 h5Resource 一致） */
const DEFAULT_LOCAL_RESOURCE_NAME = 'resources'

/** H5 叠层：高于 van-image-preview 默认层级（约 2000） */
const H5_OVERLAY_Z = {
  actionPopup: 3001,
  imageInfoBackdrop: 3010,
  imageInfoPanel: 3020,
  confirmDialog: 3030
}

const form = reactive({
  keywords: '',
  resourceType: 'localResource',
  resourceName: DEFAULT_LOCAL_RESOURCE_NAME,
  filterType: 'images',
  orientation: '',
  quality: '',
  sortField: SEARCH_LOCAL_SORT_DEFAULT.sortField,
  sortType: SEARCH_LOCAL_SORT_DEFAULT.sortType,
  isRandom: false,
  displaySize: 'cover'
})

const resetSearchLocalSort = () => {
  form.sortField = SEARCH_LOCAL_SORT_DEFAULT.sortField
  form.sortType = SEARCH_LOCAL_SORT_DEFAULT.sortType
}

const page = reactive({
  startPage: 1,
  total: 0,
  lastPageSize: 20
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
  showJumpPopup: false,
  jumpScrollLock: false,
  isFavoriteHolding: false,
  showFavoriteToast: false,
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
const inlineVideoRefs = {}
const inlineVideoPlayingKeys = ref(new Set())
const inlineVideoVisibilityObservers = {}
const INLINE_VIDEO_MIN_VISIBLE_RATIO = 0.15
const fullscreenPagerRef = ref(null)
const fullscreenVisibleIndex = ref(0)
const fullscreenScrollTop = ref(0)

const DISPLAY_MODE_STORAGE_KEY = 'fbw_h5_search_display_mode'
/** 非通用 name，降低浏览器把历史搜索词当作自动填充的概率 */
const H5_SEARCH_FIELD_NAME = 'fbw-h5-search-keywords'
const readStoredDisplayMode = () => {
  try {
    const stored = localStorage.getItem(DISPLAY_MODE_STORAGE_KEY)
    if (stored === 'waterfall') return 'waterfall'
    return 'fullscreen'
  } catch {
    return 'fullscreen'
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
const GRID_HORIZONTAL_PADDING = 24
const GRID_MIN_CARD_WIDTH = 160
const GRID_MAX_COLUMNS = 8
const GRID_BUFFER_PX = 900
const FULLSCREEN_PAGE_SIZE = 20
const WATERFALL_PAGE_SIZE_MIN = 24
const WATERFALL_PAGE_SIZE_MAX = 160
const WATERFALL_VIEWPORT_BUFFER_ROWS = 2
/** 铺满模式：仅为当前张及相邻张设置图片 src，避免虚拟列表缓冲项拉原图 */
const FULLSCREEN_IMAGE_PRELOAD_RANGE = 1
/** 与 .search-pull-inner 的 padding-top 保持一致 */
const SEARCH_WATERFALL_CONTENT_GAP_PX = 10
/** 顶部指示器与首行卡片顶边的间距 */
const SEARCH_INDICATOR_TOP_CARD_GAP_PX = 8
const longPress = reactive({
  timer: null,
  selectedIndex: -1,
  startX: 0,
  startY: 0,
  /** 长按已触发时抑制紧随其后的 click 打开预览 */
  suppressClick: false
})

const previewCurrentIndex = ref(0)

const previewLongPress = {
  timer: null,
  startX: 0,
  startY: 0
}

/** 瀑布流卡片按下态（点击/长按过程） */
const cardPressIndex = ref(-1)

const favoriteClick = reactive({
  lastClickTime: 0,
  timer: null,
  startTime: 0,
  startX: 0,
  startY: 0
})

const favoriteHold = reactive({
  timer: null,
  count: 0,
  interval: null
})
const imageErrorState = reactive({})
const imageRetrySeed = reactive({})
const imageLoadedKeys = ref(new Set())
/** 预览层当前张是否加载失败（用于 Teleport 提示） */
const previewImageErrorAt = ref(-1)
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

const applyDefaultSearchResource = () => {
  form.resourceType = 'localResource'
  const sources = sourceOptions.value
  const preferred = sources.find((item) => item.value === DEFAULT_LOCAL_RESOURCE_NAME)
  const first = sources[0]
  form.resourceName = preferred?.value || first?.value || DEFAULT_LOCAL_RESOURCE_NAME
  syncFilterType()
}

const ensureResourceMapReady = async () => {
  const sources =
    commonStore.resourceMap?.resourceListByResourceType?.localResource || []
  if (sources.length) return
  await commonStore.getResourceMap()
}

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

const listModeRadioOptions = computed(() => [
  { value: false, text: t('h5.pages.search.filters.listModeOrder') },
  { value: true, text: t('h5.pages.search.filters.listModeRandom') }
])

const showSearchQualityFilter = computed(() => isQualityFilterApplicable(form.filterType))

watch(
  () => form.filterType,
  (type) => {
    if (!isQualityFilterApplicable(type)) {
      form.quality = ''
    }
  }
)

const displaySizeRadioOptions = computed(() =>
  imageDisplaySizeOptions.map((item) => ({
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

const getItemRawImageUrl = (item) => item?.imageRawSrc || item?.imageSrc || ''

const appendImageRetryQuery = (url, item) => {
  if (!url) return ''
  const key = getItemKey(item)
  const seed = imageRetrySeed[key] || 0
  if (!seed) return url
  const separator = url.includes('?') ? '&' : '?'
  return `${url}${separator}_retry=${seed}`
}

/** 铺满列表是否附加压缩参数（卡片模式始终压缩） */
const isFullscreenListCompressEnabled = () => !!settingData.value.h5FullscreenImageCompress

const buildFullscreenListImageUrl = (url, options = {}) => {
  if (!url) return ''
  return applyH5ImageCompress(url, {
    width: resolveImageCompressWidth(options),
    settingData: settingData.value,
    enabled: isFullscreenListCompressEnabled()
  })
}

const getWaterfallImageSrc = (item, options = {}) => {
  const base = getItemRawImageUrl(item)
  const url = applyH5CardImageCompress(base, {
    width: resolveImageCompressWidth(options),
    settingData: settingData.value
  })
  return appendImageRetryQuery(url, item)
}

const getFullscreenListImageSrc = (item, options = {}) => {
  const url = buildFullscreenListImageUrl(getItemRawImageUrl(item), options)
  return appendImageRetryQuery(url, item)
}

/** 预览始终原图（与铺满列表压缩策略无关） */
const getPreviewImageSrc = (item) => appendImageRetryQuery(getItemRawImageUrl(item), item)

const getDisplayImageSrc = (item, options = {}) => {
  if (displayMode.value === 'waterfall') {
    return getWaterfallImageSrc(item, options)
  }
  return getFullscreenListImageSrc(item, options)
}

const getDisplayPosterSrc = (item, options = {}) => {
  const raw = item.posterRawSrc || ''
  if (!raw) return ''
  const url =
    displayMode.value === 'waterfall'
      ? applyH5CardImageCompress(raw, {
          width: resolveImageCompressWidth(options),
          settingData: settingData.value
        })
      : buildFullscreenListImageUrl(raw, options)
  return appendImageRetryQuery(url, item)
}

const shouldLoadFullscreenImage = (index) => {
  if (displayMode.value !== 'fullscreen') return false
  const cur = fullscreenVisibleIndex.value
  if (typeof index !== 'number' || index < 0) return false
  return Math.abs(index - cur) <= FULLSCREEN_IMAGE_PRELOAD_RANGE
}
const clearImageLoadedKey = (key) => {
  if (!key) return
  const next = new Set(imageLoadedKeys.value)
  next.delete(key)
  imageLoadedKeys.value = next
}

const markImageLoaded = (item) => {
  const key = getItemKey(item)
  if (!key) return
  const next = new Set(imageLoadedKeys.value)
  next.add(key)
  imageLoadedKeys.value = next
}

const isSlideImageLoaded = (item) => {
  const key = getItemKey(item)
  return key ? imageLoadedKeys.value.has(key) : false
}

const onImageLoadError = (item, event) => {
  const img = event?.target
  if (img instanceof HTMLImageElement) {
    if (!img.isConnected) return
    if (!(img.currentSrc || img.src)) return
  }
  const key = getItemKey(item)
  if (!key) return
  imageErrorState[key] = true
  clearImageLoadedKey(key)
}
const onPosterLoadError = onImageLoadError
const onSlideImageLoad = (item) => {
  const key = getItemKey(item)
  if (!key) return
  imageErrorState[key] = false
  markImageLoaded(item)
}
const retryLoadImage = (item) => {
  const key = getItemKey(item)
  if (!key) return
  imageErrorState[key] = false
  clearImageLoadedKey(key)
  imageRetrySeed[key] = Date.now()
}
const retryLoadPoster = retryLoadImage

const markInlineVideoPlaying = (key, playing) => {
  if (!key) return
  const next = new Set(inlineVideoPlayingKeys.value)
  if (playing) next.add(key)
  else next.delete(key)
  inlineVideoPlayingKeys.value = next
}

const isInlineVideoPlaying = (item) => {
  const key = getItemKey(item)
  return key ? inlineVideoPlayingKeys.value.has(key) : false
}

const findVideoKeyByEl = (el) => {
  for (const [key, refEl] of Object.entries(inlineVideoRefs)) {
    if (refEl === el) return key
  }
  return ''
}

const getVideoScrollRoot = () => {
  if (displayMode.value === 'fullscreen') {
    const rootEl = fullscreenPagerRef.value?.getScrollElement?.()
    if (rootEl?.classList?.contains?.('virtual-list')) return rootEl
    return rootEl?.querySelector?.('.virtual-list') ?? rootEl ?? null
  }
  return pageWrapperRef.value
}

const teardownVideoVisibilityObserver = (key) => {
  inlineVideoVisibilityObservers[key]?.disconnect()
  delete inlineVideoVisibilityObservers[key]
}

const setupVideoVisibilityObserver = (key, el) => {
  teardownVideoVisibilityObserver(key)
  if (!key || !el) return
  const root = getVideoScrollRoot()
  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting && entry.intersectionRatio >= INLINE_VIDEO_MIN_VISIBLE_RATIO) {
          continue
        }
        const videoEl = entry.target
        try {
          videoEl.pause()
        } catch (_) {
          /* noop */
        }
        const videoKey = findVideoKeyByEl(videoEl)
        if (videoKey) markInlineVideoPlaying(videoKey, false)
      }
    },
    {
      root: root || null,
      rootMargin: '0px',
      threshold: [0, 0.05, 0.15, 0.25, 0.5, 1]
    }
  )
  observer.observe(el)
  inlineVideoVisibilityObservers[key] = observer
}

const refreshAllVideoVisibilityObservers = () => {
  for (const [key, el] of Object.entries(inlineVideoRefs)) {
    if (el) setupVideoVisibilityObserver(key, el)
  }
}

const disconnectAllVideoVisibilityObservers = () => {
  for (const key of Object.keys(inlineVideoVisibilityObservers)) {
    teardownVideoVisibilityObserver(key)
  }
}

const setInlineVideoRef = (item, el) => {
  const key = getItemKey(item)
  if (!key) return
  if (el) {
    inlineVideoRefs[key] = el
    setupVideoVisibilityObserver(key, el)
  } else {
    delete inlineVideoRefs[key]
    teardownVideoVisibilityObserver(key)
    markInlineVideoPlaying(key, false)
  }
}

const pauseAllInlineVideos = () => {
  for (const el of Object.values(inlineVideoRefs)) {
    if (!el) continue
    try {
      el.pause()
    } catch (_) {
      /* noop */
    }
  }
  inlineVideoPlayingKeys.value = new Set()
}

const pauseInlineVideo = (item) => {
  const key = getItemKey(item)
  if (!key) return
  const el = inlineVideoRefs[key]
  try {
    el?.pause()
  } catch (_) {
    /* noop */
  }
  markInlineVideoPlaying(key, false)
}

const onInlineVideoSurfaceClick = (item) => {
  if (!isInlineVideoPlaying(item)) return
  pauseInlineVideo(item)
}

const playInlineVideo = async (item, { preferMuted = false } = {}) => {
  if (!item?.videoSrc) return false
  const key = getItemKey(item)
  let el = inlineVideoRefs[key]
  if (!el) {
    await nextTick()
    el = inlineVideoRefs[key]
  }
  if (!el) return false

  markInlineVideoPlaying(key, true)
  el.loop = true

  const tryPlay = async (muted) => {
    el.muted = muted
    try {
      await el.play()
      return true
    } catch (_) {
      return false
    }
  }

  if (preferMuted && (await tryPlay(true))) return true
  if (await tryPlay(false)) return true
  if (!preferMuted && (await tryPlay(true))) return true
  markInlineVideoPlaying(key, false)
  return false
}

const syncFullscreenActiveMedia = async () => {
  if (displayMode.value !== 'fullscreen' || state.showPreview) return
  const current = fullscreenCurrentItem.value
  const currentKey = current ? getItemKey(current) : ''

  for (const [key, el] of Object.entries(inlineVideoRefs)) {
    if (!el || key === currentKey) continue
    try {
      el.pause()
    } catch (_) {
      /* noop */
    }
    markInlineVideoPlaying(key, false)
  }

  if (current?.fileType === 'video' && current.videoSrc) {
    await playInlineVideo(current, { preferMuted: true })
  }
}

const toggleInlineVideo = async (item, index) => {
  if (blockIfNsfwMasked(item)) return
  if (!item?.videoSrc) {
    showNotify({ type: 'warning', message: t('messages.noData') })
    return
  }
  const key = getItemKey(item)
  let el = inlineVideoRefs[key]
  if (!el) {
    await nextTick()
    el = inlineVideoRefs[key]
  }
  if (!el) return

  longPress.selectedIndex = index

  if (isInlineVideoPlaying(item) && !el.paused) {
    pauseInlineVideo(item)
    return
  }

  const ok = await playInlineVideo(item, { preferMuted: false })
  if (!ok) {
    showNotify({ type: 'danger', message: t('messages.operationFail') })
  }
}

const onInlineVideoPaused = (item) => {
  markInlineVideoPlaying(getItemKey(item), false)
}

const onInlineVideoError = (item) => {
  markInlineVideoPlaying(getItemKey(item), false)
  showNotify({ type: 'danger', message: t('messages.operationFail') })
}

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

let ensureWaterfallSeq = 0
let waterfallFillEnsuring = false

/** 首屏高度不足时连续补拉，直到可滚动或已无更多数据 */
const ensureWaterfallCanScroll = async () => {
  if (waterfallFillEnsuring) return
  if (displayMode.value !== 'waterfall' || state.finished || state.loading) return
  const seq = ++ensureWaterfallSeq
  const wrap = pageWrapperRef.value
  if (!wrap || !list.value.length) return

  waterfallFillEnsuring = true
  try {
    await nextTick()
    if (seq !== ensureWaterfallSeq) return

    const needsMore = () => wrap.scrollHeight <= wrap.clientHeight + 80

    let guard = 0
    while (
      guard < 8 &&
      seq === ensureWaterfallSeq &&
      !state.finished &&
      !state.loading &&
      list.value.length > 0 &&
      needsMore()
    ) {
      guard += 1
      const prevLen = list.value.length
      await loadList(false)
      if (seq !== ensureWaterfallSeq) return
      await nextTick()
      if (list.value.length === prevLen) break
    }
  } finally {
    waterfallFillEnsuring = false
  }
}

const loadList = async (reset = false) => {
  if (state.loading) return
  const reqSeq = ++loadListSeq
  if (reset) {
    pauseAllInlineVideos()
    page.startPage = 1
    page.total = 0
    list.value = []
    state.finished = false
    state.scrollTop = 0
    fullscreenVisibleIndex.value = 0
    fullscreenScrollTop.value = 0
    nextTick(() => {
      if (pageWrapperRef.value) {
        pageWrapperRef.value.scrollTop = 0
      }
      fullscreenPagerRef.value?.scrollToIndex?.(0, false)
    })
  }
  state.loading = true
  const requestPageSize = resolveSearchPageSize()
  page.lastPageSize = requestPageSize
  try {
    const rawForm = toRaw(form)
    const payload = {
      ...rawForm,
      filterKeywords: rawForm.keywords,
      keywords: rawForm.keywords,
      startPage: page.startPage,
      pageSize: requestPageSize,
      sortField: rawForm.sortField || SEARCH_LOCAL_SORT_DEFAULT.sortField,
      sortType: Number(rawForm.sortType) || SEARCH_LOCAL_SORT_DEFAULT.sortType,
      isRandom: !!rawForm.isRandom,
      quality: isQualityFilterApplicable(rawForm.filterType) ? rawForm.quality || '' : ''
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
      if (!pageRows || pageRows < requestPageSize || noNewRows) {
        state.finished = true
        if (list.value.length > 0) {
          showToast({ message: t('messages.noMoreData') })
        }
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
    if (reqSeq === loadListSeq) {
      nextTick(() => {
        void syncFullscreenActiveMedia()
        if (displayMode.value === 'waterfall' && !waterfallFillEnsuring) {
          void ensureWaterfallCanScroll()
        }
      })
    }
  }
}

const onSearch = async () => {
  pauseAllInlineVideos()
  await loadList(true)
}

const onRefresh = async () => {
  pauseAllInlineVideos()
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

/** 默认不自动播放，仅用户手动开启悬浮钮后才会 start */
const fullscreenAutoPlayUserStopped = ref(true)

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
  applyDefaultSearchResource()
  form.filterType = 'images'
  form.orientation = ''
  form.quality = ''
  form.isRandom = false
  resetSearchLocalSort()
  onSearch()
}

// 仅在打开预览时生成数组；排除视频项，避免与 van-image-preview 下标错位
const previewImages = computed(() => {
  if (!state.showPreview) return []
  return list.value
    .filter((item) => item.fileType !== 'video')
    .map((item) => getPreviewImageSrc(item))
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

const resolveListIndexFromPreviewIndex = (previewIndex) => {
  let pos = 0
  for (let i = 0; i < list.value.length; i++) {
    const row = list.value[i]
    if (row?.fileType === 'video' || !row?.imageSrc) continue
    if (pos === previewIndex) return i
    pos++
  }
  return -1
}

const getPreviewIndexForListIndex = (listIndex) => {
  let pos = 0
  for (let i = 0; i < listIndex; i++) {
    const row = list.value[i]
    if (row?.fileType !== 'video' && row?.imageSrc) pos++
  }
  return pos
}

const gridColumns = computed(() => {
  const contentWidth = Math.max(0, state.viewportWidth - GRID_HORIZONTAL_PADDING)
  const cols = Math.floor((contentWidth + GRID_GAP) / (GRID_MIN_CARD_WIDTH + GRID_GAP))
  return Math.max(2, Math.min(GRID_MAX_COLUMNS, cols))
})
const cardWidth = computed(() => {
  const contentWidth = Math.max(0, state.viewportWidth - GRID_HORIZONTAL_PADDING)
  return Math.max(80, (contentWidth - GRID_GAP * (gridColumns.value - 1)) / gridColumns.value)
})

/** 瀑布流每页条数：按列数与视口高度估算，避免宽屏首屏无法滚动 */
const estimateWaterfallPageSize = () => {
  const cols = Math.max(1, gridColumns.value)
  const wrap = pageWrapperRef.value
  const viewportH = Math.max(
    state.viewportHeight || 0,
    wrap?.clientHeight || 0,
    typeof window !== 'undefined' ? window.innerHeight : 800
  )
  const toolbarH = immersiveMode.value ? 0 : searchToolbarHeight.value || 52
  const availableH = Math.max(280, viewportH - toolbarH - SEARCH_WATERFALL_CONTENT_GAP_PX - 16)
  const avgItemH = FALLBACK_ITEM_HEIGHT + GRID_GAP
  const rowsNeeded = Math.ceil(availableH / avgItemH) + WATERFALL_VIEWPORT_BUFFER_ROWS
  const itemsNeeded = rowsNeeded * cols
  return Math.max(
    WATERFALL_PAGE_SIZE_MIN,
    Math.min(WATERFALL_PAGE_SIZE_MAX, itemsNeeded)
  )
}

const resolveSearchPageSize = () =>
  displayMode.value === 'waterfall' ? estimateWaterfallPageSize() : FULLSCREEN_PAGE_SIZE

const getItemHeight = (item) => {
  const width = Number(item?.width) || 0
  const height = Number(item?.height) || 0
  if (width > 0 && height > 0) {
    const calculated = (cardWidth.value * height) / width
    return Math.max(100, Math.min(520, Math.round(calculated)))
  }
  return FALLBACK_ITEM_HEIGHT
}

const pickShortestColumnIndex = (columns) => {
  let columnIndex = 0
  let minHeight = columns[0]?.totalHeight ?? 0
  for (let i = 1; i < columns.length; i += 1) {
    if (columns[i].totalHeight < minHeight) {
      minHeight = columns[i].totalHeight
      columnIndex = i
    }
  }
  return columnIndex
}

/** 瀑布流分列布局（含每张卡片的列内 top，供虚拟列表与模式切换对齐） */
const buildWaterfallColumnLayouts = () => {
  const columns = Array.from({ length: gridColumns.value }, () => ({
    items: [],
    totalHeight: 0
  }))
  list.value.forEach((item, index) => {
    const height = getItemHeight(item)
    const columnIndex = pickShortestColumnIndex(columns)
    const top = columns[columnIndex].totalHeight
    columns[columnIndex].items.push({
      item,
      globalIndex: index,
      height,
      top
    })
    columns[columnIndex].totalHeight += height + GRID_GAP
  })
  return columns
}

/** 视口内最靠上的一张（含未完全露出的卡片；并列取 globalIndex 更小） */
const getFirstVisibleWaterfallListIndex = () => {
  if (!list.value.length) return 0
  const viewportTop = Math.max(0, state.scrollTop)
  const viewportBottom = state.scrollTop + (state.viewportHeight || window.innerHeight)
  const columns = buildWaterfallColumnLayouts()
  let bestIndex = 0
  let bestTop = Infinity
  for (const column of columns) {
    for (const row of column.items) {
      const itemTop = row.top
      const itemBottom = row.top + row.height
      if (itemBottom <= viewportTop) continue
      if (itemTop >= viewportBottom) continue
      if (itemTop < bestTop || (itemTop === bestTop && row.globalIndex < bestIndex)) {
        bestTop = itemTop
        bestIndex = row.globalIndex
      }
    }
  }
  if (bestTop !== Infinity) return bestIndex
  return 0
}

const getWaterfallScrollTopForListIndex = (listIndex) => {
  const idx = Math.max(0, Math.min(Number(listIndex) || 0, list.value.length - 1))
  const columns = buildWaterfallColumnLayouts()
  for (const column of columns) {
    const row = column.items.find((entry) => entry.globalIndex === idx)
    if (row) {
      return Math.max(0, row.top - SEARCH_WATERFALL_CONTENT_GAP_PX)
    }
  }
  return 0
}

const virtualColumns = computed(() => {
  const columns = buildWaterfallColumnLayouts()

  const viewportTop = Math.max(0, state.scrollTop - GRID_BUFFER_PX)
  const viewportBottom = state.scrollTop + state.viewportHeight + GRID_BUFFER_PX
  const maxColumnHeight = columns.reduce((max, column) => Math.max(max, column.totalHeight), 0)

  return columns.map((column) => {
    const totalHeight = column.totalHeight
    let start = 0
    while (start < column.items.length && column.items[start].top + column.items[start].height < viewportTop) {
      start += 1
    }

    let end = start
    let visibleBottom = start < column.items.length ? column.items[start].top : viewportBottom
    while (end < column.items.length) {
      const row = column.items[end]
      if (row.top >= viewportBottom) break
      visibleBottom = row.top + row.height + GRID_GAP
      end += 1
    }

    if (
      end <= start &&
      start < column.items.length &&
      totalHeight > 0 &&
      viewportTop < maxColumnHeight
    ) {
      end = Math.min(column.items.length, start + 1)
      visibleBottom =
        column.items[start].top + column.items[start].height + GRID_GAP
    }

    const topSpacer = start < column.items.length ? column.items[start].top : totalHeight
    const renderedHeight = Math.max(0, visibleBottom - topSpacer)
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

const mediaObjectFit = computed(() => (form.displaySize === 'cover' ? 'cover' : 'contain'))

const fullscreenCurrentItem = computed(() => list.value[fullscreenVisibleIndex.value] || null)

const isCurrentFullscreenItemVideo = computed(
  () => fullscreenCurrentItem.value?.fileType === 'video'
)

const isCurrentFullscreenFavorite = computed(() => !!fullscreenCurrentItem.value?.isFavorite)

const showImagePlaybackFloats = computed(
  () =>
    displayMode.value === 'fullscreen' &&
    !isCurrentFullscreenItemVideo.value &&
    !state.showPreview
)

const fullscreenAutoPlay = useH5FullscreenAutoPlay({
  getPagerRef: () => fullscreenPagerRef.value,
  getCurrentIndex: () => fullscreenVisibleIndex.value,
  setCurrentIndex: (idx) => {
    fullscreenVisibleIndex.value = idx
  },
  getListLength: () => list.value.length,
  getFinished: () => state.finished,
  getLoading: () => state.loading,
  onLoadMore: () => loadList(false),
  isCurrentVideo: () => isCurrentFullscreenItemVideo.value,
  isPlaybackAllowed: () => displayMode.value === 'fullscreen' && !state.showPreview
})

const {
  autoPlayOn: fullscreenAutoPlayOn,
  countdown: fullscreenAutoPlayCountdown,
  intervalSec: fullscreenAutoPlayIntervalSec
} = fullscreenAutoPlay

const toggleDisplaySize = () => {
  settingStore.vibrate()
  if (displayMode.value === 'fullscreen') {
    fullscreenAutoPlay.stop()
  }
  form.displaySize = form.displaySize === 'cover' ? 'contain' : 'cover'
}

const layoutToggleTitle = computed(() =>
  displayMode.value === 'waterfall'
    ? t('h5.pages.search.displayMode.toggleToFullscreen')
    : t('h5.pages.search.displayMode.toggleToWaterfall')
)

const showSearchListEmpty = computed(
  () => state.finished && !state.loading && !list.value.length
)

const toggleDisplayMode = () => {
  if (displayMode.value === 'waterfall') {
    persistWaterfallScrollPosition()
    fullscreenVisibleIndex.value = getFirstVisibleWaterfallListIndex()
  }
  displayMode.value = displayMode.value === 'waterfall' ? 'fullscreen' : 'waterfall'
  try {
    localStorage.setItem(DISPLAY_MODE_STORAGE_KEY, displayMode.value)
  } catch (_) {
    /* noop */
  }
  if (displayMode.value === 'waterfall') {
    nextTick(() => {
      syncWaterfallViewportMetrics()
      void ensureWaterfallCanScroll()
    })
  }
}

const onFullscreenPagerScroll = (payload) => {
  fullscreenScrollTop.value = Math.max(0, Number(payload.scrollTop) || 0)
}

const onFullscreenPagerIndexChange = (idx) => {
  if (state.jumpScrollLock) return
  if (fullscreenAutoPlay.isAdvancing?.()) {
    return
  }
  if (idx !== fullscreenVisibleIndex.value && fullscreenAutoPlayOn.value) {
    fullscreenAutoPlay.stop()
    fullscreenAutoPlayUserStopped.value = true
  }
  fullscreenVisibleIndex.value = idx
  nextTick(() => {
    void syncFullscreenActiveMedia()
  })
}

// 铺满模式：当前所在张（从 1 计）/ 服务端总数（当前索引不超过已加载条数）
const fullscreenIndicatorText = computed(() => {
  const len = list.value.length
  const cur = len ? Math.min(fullscreenVisibleIndex.value + 1, len) : 0
  const total = searchResultTotal.value
  return t('h5.pages.search.displayMode.indicator', { current: cur, total })
})

/** 铺满模式滚动在 VirtualList 内，外层 pull-refresh 无法感知 scrollTop，需手动限制 */
const isPullRefreshDisabled = computed(() => {
  if (state.loading) return true
  if (displayMode.value !== 'fullscreen') return false
  if (fullscreenVisibleIndex.value > 0) return true
  return fullscreenScrollTop.value > 2
})

const isFullscreenPullAtTop = computed(
  () => displayMode.value === 'fullscreen' && !isPullRefreshDisabled.value
)

const isImageInfoPanelOpen = computed(() => imageInfoPanelHeight.value > imageInfoPanelAnchors[0])

const closeImageInfoPanel = () => {
  imageInfoPanelHeight.value = imageInfoPanelAnchors[0]
}

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
  const compactTopChrome = immersiveMode.value || displayMode.value === 'fullscreen'
  let topOffset = compactTopChrome
    ? 'calc(8px + env(safe-area-inset-top, 0px))'
    : `calc(${searchToolbarHeight.value}px + env(safe-area-inset-top, 0px) + 4px)`

  // 顶部指示器：搜索栏 + 列表上留白 + 与首行卡片间距（非沉浸瀑布流）
  if (position === 'top' && displayMode.value === 'waterfall' && !immersiveMode.value) {
    topOffset = `calc(${searchToolbarHeight.value}px + ${SEARCH_WATERFALL_CONTENT_GAP_PX}px + ${SEARCH_INDICATOR_TOP_CARD_GAP_PX}px + env(safe-area-inset-top, 0px))`
  }

  return getH5NumberIndicatorStyle(position, { topOffset })
})

const openJumpPopup = () => {
  if (displayMode.value !== 'fullscreen') return
  state.showJumpPopup = true
}

const jumpIndex = ref('')

const JUMP_DIALOG_TOP_VAR = '--fbw-jump-dialog-top'
let jumpDialogViewportBound = false

const onJumpDialogViewportChange = (forceTightTop = false) => {
  if (!state.showJumpPopup) return
  const vv = window.visualViewport
  const layoutH = window.innerHeight || document.documentElement.clientHeight || 0
  let topPx
  if (vv && typeof vv.height === 'number' && layoutH > 0) {
    const offTop = Math.max(0, vv.offsetTop)
    const keyboardLikely = forceTightTop || vv.height < layoutH * 0.72
    const pad = keyboardLikely
      ? Math.max(8, Math.min(40, vv.height * 0.03))
      : Math.max(16, Math.min(72, vv.height * 0.08))
    topPx = Math.round(offTop + pad)
  } else {
    topPx = Math.round(Math.max(48, layoutH * 0.08))
  }
  document.documentElement.style.setProperty(JUMP_DIALOG_TOP_VAR, `${topPx}px`)
}

const bindJumpDialogViewport = () => {
  if (jumpDialogViewportBound) return
  jumpDialogViewportBound = true
  const vv = window.visualViewport
  if (vv) {
    vv.addEventListener('resize', onJumpDialogViewportChange)
    vv.addEventListener('scroll', onJumpDialogViewportChange)
  }
  window.addEventListener('resize', onJumpDialogViewportChange)
}

const unbindJumpDialogViewport = () => {
  if (!jumpDialogViewportBound) return
  jumpDialogViewportBound = false
  const vv = window.visualViewport
  if (vv) {
    vv.removeEventListener('resize', onJumpDialogViewportChange)
    vv.removeEventListener('scroll', onJumpDialogViewportChange)
  }
  window.removeEventListener('resize', onJumpDialogViewportChange)
}

const jumpToIndex = async () => {
  const index = parseInt(jumpIndex.value, 10) - 1
  if (Number.isNaN(index) || index < 0) {
    jumpIndex.value = ''
    showNotify({ type: 'warning', message: t('messages.invalidIndex') })
    return
  }

  state.jumpScrollLock = true
  fullscreenAutoPlay.stop()
  try {
    if (index >= list.value.length) {
      let guard = 0
      while (index >= list.value.length && !state.finished && guard < 24) {
        guard += 1
        const prevLen = list.value.length
        await loadList(false)
        if (list.value.length === prevLen) break
        if (guard < 24) {
          await sleep(48)
        }
      }
      if (index >= list.value.length) {
        showNotify({ type: 'warning', message: t('messages.indexTooLarge') })
        jumpIndex.value = ''
        return
      }
    }

    if (index >= list.value.length) {
      jumpIndex.value = ''
      showNotify({ type: 'warning', message: t('messages.indexOutOfRange') })
      return
    }

    fullscreenVisibleIndex.value = index
    state.showJumpPopup = false
    jumpIndex.value = ''
    await nextTick()
    await fullscreenPagerRef.value?.scrollToIndex?.(index, false)
    await sleep(120)
  } finally {
    setTimeout(() => {
      state.jumpScrollLock = false
    }, 280)
  }
}

const handleFavoriteTouchStart = (event) => {
  const current = fullscreenCurrentItem.value
  if (current && isNsfwActionBlocked(current)) return
  favoriteClick.startTime = Date.now()
  favoriteClick.startX = event.touches[0].clientX
  favoriteClick.startY = event.touches[0].clientY
  favoriteHold.timer = setTimeout(() => {
    state.isFavoriteHolding = true
    favoriteHold.count = 0
    favoriteHold.interval = setInterval(() => {
      if (favoriteHold.count < 100) {
        favoriteHold.count += 1
        state.showFavoriteToast = true
        settingStore.vibrate(Math.min(Math.max(10, favoriteHold.count), 50))
      } else {
        clearInterval(favoriteHold.interval)
        favoriteHold.interval = null
        state.showFavoriteToast = false
        showNotify({ type: 'warning', message: t('messages.maxFavoriteCountReached') })
      }
    }, 200)
  }, 800)
}

const handleFavoriteTouchMove = (event) => {
  const moveX = event.touches[0].clientX - favoriteClick.startX
  const moveY = event.touches[0].clientY - favoriteClick.startY
  if (Math.sqrt(moveX * moveX + moveY * moveY) > 10) {
    if (favoriteHold.timer) {
      clearTimeout(favoriteHold.timer)
      favoriteHold.timer = null
    }
    if (favoriteHold.interval) {
      clearInterval(favoriteHold.interval)
      favoriteHold.interval = null
    }
    state.isFavoriteHolding = false
    state.showFavoriteToast = false
    favoriteHold.count = 0
  }
}

const handleFavoriteTouchEnd = async () => {
  const touchDuration = Date.now() - favoriteClick.startTime
  if (favoriteHold.timer) {
    clearTimeout(favoriteHold.timer)
    favoriteHold.timer = null
  }
  if (favoriteHold.interval) {
    clearInterval(favoriteHold.interval)
    favoriteHold.interval = null
  }

  const currentImage = fullscreenCurrentItem.value
  if (!currentImage) return

  if (state.isFavoriteHolding && favoriteHold.count > 0) {
    if (!currentImage.isFavorite) {
      await api.addToFavorites(currentImage.id)
    }
    const res = await api.updateFavoriteCount(currentImage.id, favoriteHold.count)
    if (res?.success) {
      currentImage.favoriteCount = (currentImage.favoriteCount || 0) + favoriteHold.count
      currentImage.isFavorite = true
    }
    state.isFavoriteHolding = false
    state.showFavoriteToast = false
    favoriteHold.count = 0
    return
  }

  if (touchDuration < 300) {
    const currentTime = Date.now()
    const timeDiff = currentTime - favoriteClick.lastClickTime
    if (favoriteClick.timer) {
      clearTimeout(favoriteClick.timer)
      favoriteClick.timer = null
    }
    if (timeDiff < 300) {
      const res = await api.removeFavorites(currentImage.id)
      if (res?.success) {
        currentImage.isFavorite = false
        settingStore.vibrate(20)
      }
      favoriteClick.lastClickTime = 0
    } else {
      favoriteClick.lastClickTime = currentTime
      favoriteClick.timer = setTimeout(async () => {
        const res = await api.addToFavorites(currentImage.id)
        if (res?.success) {
          currentImage.isFavorite = true
          state.showFavoriteToast = true
          settingStore.vibrate(() => {
            state.showFavoriteToast = false
          })
        }
        favoriteClick.timer = null
      }, 300)
    }
  }
}

const onFullscreenBackTop = async () => {
  if (!list.value.length) return
  settingStore.vibrate()
  fullscreenAutoPlay.stop()
  state.jumpScrollLock = true
  try {
    fullscreenVisibleIndex.value = 0
    await nextTick()
    // 与旧首页一致：回到第一张使用滚动动画（scrollToPosition 默认 animated=true）
    await fullscreenPagerRef.value?.scrollToIndex?.(0, true)
    await nextTick()
    const scrollTop = fullscreenPagerRef.value?.getScrollTop?.() ?? 0
    if (scrollTop > 2) {
      await fullscreenPagerRef.value?.scrollToIndex?.(0, true)
    }
    fullscreenVisibleIndex.value = 0
    fullscreenScrollTop.value = 0
  } finally {
    setTimeout(() => {
      state.jumpScrollLock = false
    }, 320)
  }
}

const onWaterfallBackTop = () => {
  settingStore.vibrate()
  const wrap = pageWrapperRef.value
  if (!wrap) return
  wrap.scrollTo({ top: 0, behavior: 'smooth' })
  state.scrollTop = 0
}

const onFloatingBackTop = () => {
  if (displayMode.value === 'fullscreen') {
    void onFullscreenBackTop()
  } else {
    onWaterfallBackTop()
  }
}

const onToggleFullscreenAutoPlay = () => {
  settingStore.vibrate()
  fullscreenAutoPlay.toggle()
  fullscreenAutoPlayUserStopped.value = !fullscreenAutoPlayOn.value
}

const onCycleFullscreenInterval = () => {
  settingStore.vibrate()
  fullscreenAutoPlay.cycleInterval()
}

const onToggleImmersiveMode = () => {
  settingStore.vibrate()
  commonStore.toggleImmersiveMode()
}

const syncWaterfallViewportMetrics = () => {
  const wrap = pageWrapperRef.value
  if (!wrap || displayMode.value !== 'waterfall') return
  if (wrap.clientHeight > 0) {
    state.viewportHeight = wrap.clientHeight
  }
}

/** 离开页面前保存瀑布流滚动位置（keep-alive 下 DOM scrollTop 会丢失） */
const persistWaterfallScrollPosition = () => {
  const wrap = pageWrapperRef.value
  if (!wrap || displayMode.value !== 'waterfall') return
  state.scrollTop = Math.max(0, wrap.scrollTop || state.scrollTop || 0)
}

/** 将瀑布流滚动到指定 list 索引（与全屏当前张对齐） */
const restoreWaterfallScrollToListIndex = async (listIndex) => {
  if (displayMode.value !== 'waterfall' || !list.value.length) return
  const top = getWaterfallScrollTopForListIndex(listIndex)
  state.scrollTop = top
  await nextTick()
  syncWaterfallViewportMetrics()
  const wrap = pageWrapperRef.value
  if (!wrap) return
  wrap.scrollTop = top
  await nextTick()
  if (Math.abs(wrap.scrollTop - top) > 2) {
    wrap.scrollTop = top
  }
  state.scrollTop = wrap.scrollTop
}

/** Tab 切回后恢复瀑布流滚动位置（沿用 state.scrollTop） */
const restoreWaterfallScrollPosition = async () => {
  if (displayMode.value !== 'waterfall') return
  await nextTick()
  syncWaterfallViewportMetrics()
  const wrap = pageWrapperRef.value
  if (!wrap) return
  const top = Math.max(0, Number(state.scrollTop) || 0)
  wrap.scrollTop = top
  await nextTick()
  if (Math.abs(wrap.scrollTop - top) > 2) {
    wrap.scrollTop = top
  }
  state.scrollTop = wrap.scrollTop
}

/** Tab 切回或全屏模式显示时：按 fullscreenVisibleIndex 恢复 VirtualList 滚动，避免指示器与画面错位 */
const restoreFullscreenPagerPosition = async () => {
  if (displayMode.value !== 'fullscreen' || !list.value.length) return
  const maxIdx = Math.max(0, list.value.length - 1)
  const idx = Math.max(0, Math.min(fullscreenVisibleIndex.value, maxIdx))
  fullscreenVisibleIndex.value = idx
  await nextTick()
  fullscreenPagerRef.value?.measureHeight?.()
  await nextTick()
  const pager = fullscreenPagerRef.value
  if (!pager) return
  await pager.scrollToIndex?.(idx, false)
  fullscreenScrollTop.value = Math.max(0, Number(pager.getScrollTop?.()) || 0)
  await syncFullscreenActiveMedia()
}

watch(displayMode, (mode) => {
  if (mode !== 'fullscreen') {
    fullscreenAutoPlay.stop()
    pauseAllInlineVideos()
    nextTick(() => {
      const idx = Math.max(
        0,
        Math.min(fullscreenVisibleIndex.value, Math.max(0, list.value.length - 1))
      )
      void restoreWaterfallScrollToListIndex(idx)
      measureSearchToolbarHeight()
      refreshAllVideoVisibilityObservers()
    })
    return
  }
  nextTick(() => {
    void restoreFullscreenPagerPosition()
    refreshAllVideoVisibilityObservers()
  })
})

watch(
  () => commonStore.resourceMap?.resourceListByResourceType?.localResource,
  (sources) => {
    if (!sources?.length) return
    if (form.resourceType !== 'localResource') return
    const valid = sourceOptions.value.some((item) => item.value === form.resourceName)
    if (!valid) applyDefaultSearchResource()
  }
)

watch(immersiveMode, () => {
  nextTick(() => measureSearchToolbarHeight())
})

watch(
  () => state.showJumpPopup,
  (show) => {
    if (show) {
      nextTick(() => {
        onJumpDialogViewportChange()
        bindJumpDialogViewport()
        requestAnimationFrame(() => {
          onJumpDialogViewportChange()
          setTimeout(onJumpDialogViewportChange, 120)
          setTimeout(onJumpDialogViewportChange, 320)
        })
      })
    } else {
      unbindJumpDialogViewport()
      document.documentElement.style.removeProperty(JUMP_DIALOG_TOP_VAR)
    }
  }
)

watch(
  () => list.value.length,
  () => {
    const maxIdx = Math.max(0, list.value.length - 1)
    if (fullscreenVisibleIndex.value > maxIdx) {
      fullscreenVisibleIndex.value = maxIdx
    }
  }
)

const openPreview = (index) => {
  if (longPress.suppressClick) {
    longPress.suppressClick = false
    return
  }
  const row = list.value[index]
  if (!row) return
  if (blockIfNsfwMasked(row)) return
  longPress.selectedIndex = index
  if (row.fileType === 'video') {
    if (isInlineVideoPlaying(row)) pauseInlineVideo(row)
    return
  }
  if (!row.imageSrc) return
  previewCurrentIndex.value = getPreviewIndexForListIndex(index)
  state.showPreview = true
}

const onPreviewIndexChange = (payload) => {
  const raw = typeof payload === 'number' ? payload : payload?.index
  previewCurrentIndex.value = Math.max(0, Number(raw) || 0)
  previewImageErrorAt.value = -1
}

let previewImageErrorCaptureEl = null
const onPreviewImageCaptureError = (event) => {
  if (!state.showPreview) return
  const target = event?.target
  if (!(target instanceof HTMLImageElement)) return
  if (!target.closest('.van-image-preview')) return
  const listIdx = resolveListIndexFromPreviewIndex(previewCurrentIndex.value)
  const item = list.value[listIdx]
  if (!item) return
  previewImageErrorAt.value = previewCurrentIndex.value
  onImageLoadError(item, event)
  showNotify({ type: 'warning', message: imageLoadFailText.value })
}

const bindPreviewImageErrorCapture = () => {
  unbindPreviewImageErrorCapture()
  nextTick(() => {
    previewImageErrorCaptureEl = document.querySelector('.van-image-preview')
    previewImageErrorCaptureEl?.addEventListener('error', onPreviewImageCaptureError, true)
  })
}

const unbindPreviewImageErrorCapture = () => {
  previewImageErrorCaptureEl?.removeEventListener('error', onPreviewImageCaptureError, true)
  previewImageErrorCaptureEl = null
}

const retryPreviewImage = () => {
  const listIdx = resolveListIndexFromPreviewIndex(previewCurrentIndex.value)
  const item = list.value[listIdx]
  if (!item) return
  previewImageErrorAt.value = -1
  retryLoadImage(item)
}

const clearPreviewLongPressTimer = () => {
  if (previewLongPress.timer) {
    clearTimeout(previewLongPress.timer)
    previewLongPress.timer = null
  }
}

const onPreviewLayerTouchStart = (event) => {
  if (!state.showPreview) return
  const el = event.target
  if (!(el instanceof Element) || !el.closest('.van-image-preview')) return
  const touch = event.touches?.[0]
  if (!touch) return
  clearPreviewLongPressTimer()
  previewLongPress.startX = touch.clientX
  previewLongPress.startY = touch.clientY
  previewLongPress.timer = setTimeout(() => {
    previewLongPress.timer = null
    const listIdx = resolveListIndexFromPreviewIndex(previewCurrentIndex.value)
    if (listIdx < 0) return
    openActionByIndex(listIdx)
    longPress.suppressClick = true
    settingStore.vibrate()
  }, 500)
}

const onPreviewLayerTouchMove = (event) => {
  if (!previewLongPress.timer || !event.touches?.length) return
  const moveX = event.touches[0].clientX - previewLongPress.startX
  const moveY = event.touches[0].clientY - previewLongPress.startY
  if (Math.sqrt(moveX * moveX + moveY * moveY) > 10) {
    clearPreviewLongPressTimer()
  }
}

const onPreviewLayerTouchEnd = () => {
  clearPreviewLongPressTimer()
}

const clearCardPress = () => {
  cardPressIndex.value = -1
}

const onImageTouchStart = (index, event) => {
  if (!event.touches?.length) return
  const row = list.value[index]
  if (row && isNsfwActionBlocked(row)) return
  cardPressIndex.value = index
  longPress.startX = event.touches[0].clientX
  longPress.startY = event.touches[0].clientY
  longPress.timer = setTimeout(() => {
    longPress.timer = null
    const current = list.value[index]
    if (current && isNsfwActionBlocked(current)) return
    openActionByIndex(index)
    if (!state.showActionPopup) return
    longPress.suppressClick = true
    settingStore.vibrate()
  }, 500)
}

const onImageTouchMove = (event) => {
  if (!event.touches?.length) return
  const moveX = event.touches[0].clientX - longPress.startX
  const moveY = event.touches[0].clientY - longPress.startY
  if (Math.sqrt(moveX * moveX + moveY * moveY) > 10) {
    clearCardPress()
    if (longPress.timer) {
      clearTimeout(longPress.timer)
      longPress.timer = null
    }
  }
}

const onImageTouchEnd = () => {
  clearCardPress()
  if (longPress.timer) {
    clearTimeout(longPress.timer)
    longPress.timer = null
  }
}

const onCardMouseDown = (index, event) => {
  if (event?.button != null && event.button !== 0) return
  const row = list.value[index]
  if (row && isNsfwActionBlocked(row)) return
  cardPressIndex.value = index
  if (longPress.timer) {
    clearTimeout(longPress.timer)
    longPress.timer = null
  }
  longPress.startX = event?.clientX ?? 0
  longPress.startY = event?.clientY ?? 0
  longPress.timer = setTimeout(() => {
    longPress.timer = null
    longPress.suppressClick = true
    openActionByIndex(index)
  }, 500)
}

const onCardMouseMove = (event) => {
  if (!longPress.timer) return
  const moveX = (event?.clientX ?? 0) - longPress.startX
  const moveY = (event?.clientY ?? 0) - longPress.startY
  if (Math.sqrt(moveX * moveX + moveY * moveY) > 10) {
    clearCardPress()
    if (longPress.timer) {
      clearTimeout(longPress.timer)
      longPress.timer = null
    }
  }
}

const onCardMouseUp = () => {
  clearCardPress()
  if (longPress.timer) {
    clearTimeout(longPress.timer)
    longPress.timer = null
  }
}

/** 操作菜单目标：预览打开时以当前预览张为准，否则为长按项 */
const actionTargetListIndex = computed(() => {
  if (state.showPreview) {
    const idx = resolveListIndexFromPreviewIndex(previewCurrentIndex.value)
    if (idx >= 0) return idx
  }
  return longPress.selectedIndex
})

const selectedItem = computed(() => {
  const idx = actionTargetListIndex.value
  return idx >= 0 ? list.value[idx] ?? null : null
})

const imageInfoTagWords = ref([])

const imageInfoItem = computed(() => {
  const base = selectedItem.value
  if (!base) return null
  if (!imageInfoTagWords.value.length) return base
  return { ...base, _tagWords: imageInfoTagWords.value }
})

const selectedFavoriteActionLabel = computed(() => {
  if (!selectedItem.value?.isFavorite) {
    return t('h5.pages.search.actions.favoriteAdd')
  }
  return t('h5.pages.search.actions.favoriteRemove')
})

const getSelectedItemKey = (item = selectedItem.value) => {
  if (!item) return ''
  return item.id != null && item.id !== '' ? `id:${item.id}` : getItemKey(item)
}

const getMediaDownloadUrl = (item) => {
  if (!item) return ''
  if (item.fileType === 'video') {
    return item.videoSrc || item.videoUrl || ''
  }
  return getItemRawImageUrl(item) || item.imageUrl || ''
}

const getMediaDownloadFilename = (item) => {
  const isVideo = item?.fileType === 'video'
  const defaultExt = isVideo ? 'mp4' : 'jpg'
  const base = item?.fileName || item?.id || Date.now()
  if (String(base).includes('.')) return String(base)
  return `${base}.${item?.fileExt || defaultExt}`
}

const triggerBrowserDownload = (url, filename) => {
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.rel = 'noopener'
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}

const showImageInfo = async () => {
  if (!selectedItem.value) return
  if (blockIfNsfwMasked(selectedItem.value)) return
  state.showActionPopup = false
  imageInfoPanelHeight.value = imageInfoPanelAnchors[1]
  imageInfoTagWords.value = []
  const id = selectedItem.value.id
  if (id) {
    const res = await api.getResourceTags(id)
    if (res?.success && Array.isArray(res.data)) {
      imageInfoTagWords.value = res.data
    }
  }
}

const saveSelectedMedia = async () => {
  const item = selectedItem.value
  if (!item) return
  const url = getMediaDownloadUrl(item)
  if (!url) {
    showNotify({ type: 'warning', message: t('messages.noData') })
    return
  }
  const filename = getMediaDownloadFilename(item)
  try {
    settingStore.vibrate()
    let blobUrl = ''
    try {
      const res = await fetch(url)
      if (!res.ok) throw new Error('fetch failed')
      const blob = await res.blob()
      blobUrl = URL.createObjectURL(blob)
      triggerBrowserDownload(blobUrl, filename)
    } catch (_) {
      triggerBrowserDownload(url, filename)
    } finally {
      if (blobUrl) URL.revokeObjectURL(blobUrl)
    }
    if (item.id) {
      await api.updateDownloadCount(item.id, 1)
    }
    showNotify({ type: 'success', message: t('messages.saveSuccess') })
  } catch (_) {
    showNotify({ type: 'danger', message: t('messages.saveFail') })
  } finally {
    state.showActionPopup = false
  }
}

const removeSelectedItemFromList = (item) => {
  const key = getSelectedItemKey(item)
  if (!key) return -1
  const deletedIndex = list.value.findIndex((row) => getSelectedItemKey(row) === key)
  if (deletedIndex < 0) return -1

  const wasPreviewTarget = state.showPreview && longPress.selectedIndex === deletedIndex

  list.value = list.value.filter((row) => getSelectedItemKey(row) !== key)

  if (wasPreviewTarget) {
    state.showPreview = false
  }

  if (displayMode.value === 'fullscreen') {
    const maxIdx = Math.max(0, list.value.length - 1)
    if (fullscreenVisibleIndex.value > maxIdx) {
      fullscreenVisibleIndex.value = maxIdx
    }
    if (deletedIndex < fullscreenVisibleIndex.value) {
      fullscreenVisibleIndex.value = Math.max(0, fullscreenVisibleIndex.value - 1)
    }
    nextTick(() => {
      fullscreenPagerRef.value?.scrollToIndex?.(fullscreenVisibleIndex.value, false)
      void syncFullscreenActiveMedia()
    })
  }

  if (longPress.selectedIndex === deletedIndex) {
    longPress.selectedIndex = -1
  } else if (longPress.selectedIndex > deletedIndex) {
    longPress.selectedIndex -= 1
  }

  return deletedIndex
}

const deleteSelectedMedia = async () => {
  const item = selectedItem.value
  if (!item) return
  try {
    await showConfirmDialog({
      title: t('h5.pages.search.actions.confirmDelete'),
      message: t('h5.pages.search.actions.confirmDeleteMessage'),
      confirmButtonText: t('h5.pages.search.actions.confirmDeleteBtn'),
      cancelButtonText: t('h5.pages.search.actions.cancelDeleteBtn'),
      confirmButtonColor: '#ee0a24',
      closeOnClickOverlay: true,
      zIndex: H5_OVERLAY_Z.confirmDialog
    })
    settingStore.vibrate()
    const res = await api.deleteImage(toRaw(item))
    if (res?.success) {
      removeSelectedItemFromList(item)
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
  if (!item?.id) {
    showNotify({ type: 'warning', message: t('messages.noData') })
    return
  }
  await onToggleFavorite(item)
  state.showActionPopup = false
}

const addSelectedToPrivacySpace = async () => {
  const item = selectedItem.value
  if (!item?.id) {
    showNotify({ type: 'warning', message: t('messages.noData') })
    return
  }
  try {
    const res = await api.addToFavorites(item.id, true)
    if (!res?.success) {
      showNotify({
        type: 'danger',
        message: resolveApiUserMessage(res, t) || t('messages.operationFail')
      })
      return
    }
    if (item.isFavorite) {
      await api.removeFavorites(item.id, false)
      item.isFavorite = 0
    }
    showNotify({ type: 'success', message: t('messages.operationSuccess') })
  } catch (_) {
    showNotify({ type: 'danger', message: t('messages.operationFail') })
  } finally {
    state.showActionPopup = false
  }
}

const openActionByIndex = (index) => {
  const row = list.value[index]
  if (blockIfNsfwMasked(row)) return
  longPress.selectedIndex = index
  state.showActionPopup = true
}

/** 列表/全屏/预览内媒体区域，用于捕获阶段拦截系统 contextmenu */
const SEARCH_MEDIA_CONTEXT_SELECTOR =
  '.result-item, .fullscreen-slide, .van-image-preview, .preview-wrap'

const SEARCH_MEDIA_CAPTURE_EVENTS = ['contextmenu', 'selectstart', 'dragstart']

const isTouchLikeContextMenu = (event) => {
  if (event.pointerType === 'touch') return true
  if (event.sourceCapabilities?.firesTouchEvents) return true
  if (longPress.suppressClick) return true
  return false
}

const isSearchPageMediaTarget = (el) =>
  !!(
    el.closest(SEARCH_MEDIA_CONTEXT_SELECTOR) ||
    el.closest('.media-touch-shield') ||
    el.tagName === 'IMG' ||
    el.tagName === 'VIDEO'
  )

/** 捕获阶段：阻止浏览器默认菜单；桌面右键在冒泡或预览层打开操作菜单 */
const onSearchMediaContextMenuCapture = (event) => {
  const el = event.target
  if (!(el instanceof Element)) return
  if (!el.closest('.page-search') && !el.closest('.van-image-preview')) return
  if (!isSearchPageMediaTarget(el)) return
  event.preventDefault()

  if (isTouchLikeContextMenu(event)) return

  if (el.closest('.van-image-preview')) {
    event.stopPropagation()
    const listIdx = resolveListIndexFromPreviewIndex(previewCurrentIndex.value)
    if (listIdx >= 0) openActionByIndex(listIdx)
  }
}

/** 小米等国产浏览器：长按还会走 selectstart / 拖拽出图，需一并拦截 */
const onSearchMediaAuxEventCapture = (event) => {
  const el = event.target
  if (!(el instanceof Element)) return
  if (!el.closest('.page-search') && !el.closest('.van-image-preview')) return
  if (!isSearchPageMediaTarget(el)) return
  event.preventDefault()
}

/** 列表/全屏：桌面右键打开操作菜单；触摸长按仅拦截系统菜单（菜单由 touch 定时器打开） */
const onMediaContextMenu = (index, event) => {
  event.preventDefault()
  event.stopPropagation()
  if (isTouchLikeContextMenu(event)) return
  openActionByIndex(index)
}

const onPageScroll = (event) => {
  if (displayMode.value === 'fullscreen') return
  const container = event?.target || pageWrapperRef.value
  if (!container) return
  const scrollTop = container.scrollTop || 0
  state.scrollTop = scrollTop
  const clientHeight = container.clientHeight || state.viewportHeight
  if (clientHeight > 0) {
    state.viewportHeight = clientHeight
  }
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
  state.viewportWidth = window.innerWidth
  nextTick(() => {
    measureSearchToolbarHeight()
    if (displayMode.value === 'fullscreen') {
      state.viewportHeight = window.innerHeight
      fullscreenPagerRef.value?.measureHeight?.()
    } else {
      syncWaterfallViewportMetrics()
      void ensureWaterfallCanScroll()
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
watch(
  () => state.showPreview,
  (show) => {
    if (show) {
      previewImageErrorAt.value = -1
      pauseAllInlineVideos()
      bindPreviewImageErrorCapture()
      document.addEventListener('touchstart', onPreviewLayerTouchStart, true)
      document.addEventListener('touchmove', onPreviewLayerTouchMove, true)
      document.addEventListener('touchend', onPreviewLayerTouchEnd, true)
      document.addEventListener('touchcancel', onPreviewLayerTouchEnd, true)
    } else {
      previewImageErrorAt.value = -1
      unbindPreviewImageErrorCapture()
      document.removeEventListener('touchstart', onPreviewLayerTouchStart, true)
      document.removeEventListener('touchmove', onPreviewLayerTouchMove, true)
      document.removeEventListener('touchend', onPreviewLayerTouchEnd, true)
      document.removeEventListener('touchcancel', onPreviewLayerTouchEnd, true)
      clearPreviewLongPressTimer()
      if (displayMode.value === 'fullscreen') {
        nextTick(() => void syncFullscreenActiveMedia())
      }
    }
  }
)

onActivated(() => {
  void refreshNsfwMaskHasPassword()
  nextTick(() => {
    measureSearchToolbarHeight()
    if (displayMode.value === 'fullscreen') {
      void restoreFullscreenPagerPosition()
    } else {
      void restoreWaterfallScrollPosition()
    }
  })
})

onDeactivated(() => {
  lockNsfwMaskPage()
  persistWaterfallScrollPosition()
  clearCardPress()
  fullscreenAutoPlay.stop()
  commonStore.setImmersiveMode(false)
  if (favoriteHold.timer) {
    clearTimeout(favoriteHold.timer)
    favoriteHold.timer = null
  }
  if (favoriteHold.interval) {
    clearInterval(favoriteHold.interval)
    favoriteHold.interval = null
  }
  if (favoriteClick.timer) {
    clearTimeout(favoriteClick.timer)
    favoriteClick.timer = null
  }
})

onUnmounted(() => {
  unbindPreviewImageErrorCapture()
  for (const type of SEARCH_MEDIA_CAPTURE_EVENTS) {
    const handler =
      type === 'contextmenu' ? onSearchMediaContextMenuCapture : onSearchMediaAuxEventCapture
    document.removeEventListener(type, handler, true)
  }
  document.removeEventListener('touchstart', onPreviewLayerTouchStart, true)
  document.removeEventListener('touchmove', onPreviewLayerTouchMove, true)
  document.removeEventListener('touchend', onPreviewLayerTouchEnd, true)
  document.removeEventListener('touchcancel', onPreviewLayerTouchEnd, true)
  clearPreviewLongPressTimer()
  if (longPress.timer) {
    clearTimeout(longPress.timer)
    longPress.timer = null
  }
  if (favoriteHold.timer) {
    clearTimeout(favoriteHold.timer)
    favoriteHold.timer = null
  }
  if (favoriteHold.interval) {
    clearInterval(favoriteHold.interval)
    favoriteHold.interval = null
  }
  if (favoriteClick.timer) {
    clearTimeout(favoriteClick.timer)
    favoriteClick.timer = null
  }
  unbindJumpDialogViewport()
  document.documentElement.style.removeProperty(JUMP_DIALOG_TOP_VAR)
  disconnectAllVideoVisibilityObservers()
  pauseAllInlineVideos()
  fullscreenAutoPlay.stop()
  searchToolbarResizeObserver?.disconnect()
  searchToolbarResizeObserver = null
  window.removeEventListener('resize', onPageResize)
})

const init = async () => {
  state.viewportHeight = window.innerHeight
  state.viewportWidth = window.innerWidth
  state.scrollTop = pageWrapperRef.value?.scrollTop || 0
  window.addEventListener('resize', onPageResize, { passive: true })
  await ensureResourceMapReady()
  applyDefaultSearchResource()
  await onSearch()
}

defineExpose({
  refresh: onRefresh
})

onMounted(async () => {
  for (const type of SEARCH_MEDIA_CAPTURE_EVENTS) {
    const handler =
      type === 'contextmenu' ? onSearchMediaContextMenuCapture : onSearchMediaAuxEventCapture
    document.addEventListener(type, handler, true)
  }
  await init()
  nextTick(() => {
    measureSearchToolbarHeight()
    bindSearchToolbarResizeObserver()
    syncWaterfallViewportMetrics()
    if (displayMode.value === 'fullscreen') {
      void restoreFullscreenPagerPosition()
    }
  })
})
</script>

<template>
  <div
    ref="pageWrapperRef"
    class="page-wrapper page-search"
    :class="{
      'page-search--fullscreen': displayMode === 'fullscreen',
      'page-search--immersive': immersiveMode
    }"
    @scroll.passive="onPageScroll"
  >
    <div class="page-search-inner">
      <div ref="searchToolbarRef" class="search-toolbar-wrap">
      <H5BrowseChrome :immersive-mode="immersiveMode">
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
          <van-button class="h5-chrome-icon-btn" plain @click="state.showFilters = true">
            <van-icon name="arrow-down" />
          </van-button>
        </div>
        <template #trailing>
          <van-button
            class="h5-chrome-icon-btn"
            plain
            :title="layoutToggleTitle"
            :aria-label="layoutToggleTitle"
            @click="toggleDisplayMode"
          >
            <van-icon :name="displayMode === 'waterfall' ? 'expand-o' : 'apps-o'" />
          </van-button>
        </template>
        <template #mini-trailing>
          <van-button class="chrome-mini-btn filter-btn" plain @click="state.showFilters = true">
            <van-icon name="arrow-down" />
          </van-button>
          <van-button
            class="chrome-mini-btn"
            plain
            :title="layoutToggleTitle"
            :aria-label="layoutToggleTitle"
            @click="toggleDisplayMode"
          >
            <van-icon :name="displayMode === 'waterfall' ? 'expand-o' : 'apps-o'" />
          </van-button>
        </template>
      </H5BrowseChrome>
      </div>


      <van-pull-refresh v-model="state.refreshing" :disabled="isPullRefreshDisabled" @refresh="onRefresh">
        <div
          class="search-pull-inner"
          :class="{
            'search-pull-inner--fullscreen': displayMode === 'fullscreen',
            'h5-browse-empty-stage': showSearchListEmpty
          }"
        >
          <div
            v-if="state.loading && !list.length"
            class="search-skeleton"
            :class="{ 'search-skeleton--fullscreen': displayMode === 'fullscreen' }"
          >
            <template v-if="displayMode === 'fullscreen'">
              <div class="fullscreen-skeleton-slide">
                <van-skeleton title :row="3" />
              </div>
            </template>
            <div
              v-else
              class="result-list result-list-skeleton"
              :style="{ gridTemplateColumns: `repeat(${gridColumns}, minmax(0, 1fr))` }"
            >
              <van-skeleton
                v-for="i in gridColumns * 2"
                :key="`sk-${i}`"
                avatar
                :row="2"
              />
            </div>
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
                    :key="`wf-${row.globalIndex}-${getItemKey(row.item)}`"
                    class="result-item"
                    :class="{ 'result-item--pressing': cardPressIndex === row.globalIndex }"
                    @touchstart="(e) => onImageTouchStart(row.globalIndex, e)"
                    @touchmove="onImageTouchMove"
                    @touchend="onImageTouchEnd"
                    @touchcancel="onImageTouchEnd"
                    @mousedown="(e) => onCardMouseDown(row.globalIndex, e)"
                    @mousemove="onCardMouseMove"
                    @mouseup="onCardMouseUp"
                    @mouseleave="onCardMouseUp"
                    @contextmenu="onMediaContextMenu(row.globalIndex, $event)"
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
                        <video
                          v-if="row.item.videoSrc"
                          :ref="(el) => setInlineVideoRef(row.item, el)"
                          class="preview preview--inline-video"
                          :style="{ objectFit: mediaObjectFit }"
                          :src="row.item.videoSrc"
                          :poster="getDisplayPosterSrc(row.item)"
                          loop
                          playsinline
                          webkit-playsinline
                          x5-playsinline
                          x5-video-player-type="h5"
                          preload="metadata"
                          @click.stop="onInlineVideoSurfaceClick(row.item)"
                          @pause="onInlineVideoPaused(row.item)"
                          @error="onInlineVideoError(row.item)"
                        />
                        <template v-if="!isInlineVideoPlaying(row.item)">
                          <div
                            v-if="row.item.posterSrc && imageErrorState[getItemKey(row.item)]"
                            class="preview-fallback preview-fallback--overlay"
                            @click.stop="retryLoadPoster(row.item)"
                          >
                            <van-icon name="photo-fail" size="22" />
                            <div class="preview-fallback-text">{{ imageLoadFailText }}</div>
                          </div>
                          <img
                            v-else-if="row.item.posterSrc"
                            class="preview preview--poster preview--poster-overlay"
                            :style="{ objectFit: mediaObjectFit }"
                            :src="getDisplayPosterSrc(row.item)"
                            alt=""
                            draggable="false"
                            loading="lazy"
                            decoding="async"
                            @error="onPosterLoadError(row.item)"
                          />
                          <div
                            v-if="row.item.posterSrc && !imageErrorState[getItemKey(row.item)]"
                            class="media-touch-shield"
                            aria-hidden="true"
                          />
                          <div
                            v-else-if="!row.item.videoSrc"
                            class="preview-video-placeholder"
                            :style="{ minHeight: `${row.height}px` }"
                          >
                            <IconifyIcon class="preview-video-ph-icon" icon="custom:video" />
                          </div>
                        </template>
                        <button
                          v-if="
                            row.item.videoSrc &&
                            !isInlineVideoPlaying(row.item) &&
                            !shouldMaskItem(row.item)
                          "
                          type="button"
                          class="video-play-badge"
                          :aria-label="t('h5.pages.search.videoPreview.play')"
                          @click.stop="toggleInlineVideo(row.item, row.globalIndex)"
                        >
                          <IconifyIcon
                            class="video-play-badge-icon"
                            icon="custom:play-circle"
                          />
                        </button>
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
                          :style="{ objectFit: mediaObjectFit }"
                          :src="getDisplayImageSrc(row.item)"
                          alt="preview"
                          draggable="false"
                          loading="lazy"
                          decoding="async"
                          @error="onImageLoadError(row.item, $event)"
                        />
                        <div class="media-touch-shield" aria-hidden="true" />
                      </template>
                      <H5NsfwContentMask
                        :visible="shouldMaskItem(row.item)"
                        @click="onNsfwMaskClick"
                      />
                    </div>
                  </div>
                  <div class="virtual-spacer" :style="{ height: `${column.bottomSpacer}px` }"></div>
                </div>
              </div>
            </div>
            <H5ListEmpty v-else-if="state.finished && !state.loading" :description="t('messages.noData')" />
            <div v-if="state.loading && list.length" class="load-more-text">{{ t('messages.loading') }}</div>
          </template>
          <template v-else>
            <div class="fullscreen-slider">
              <H5FullscreenPager
                v-if="list.length"
                ref="fullscreenPagerRef"
                :items="list"
                :loading="state.loading"
                :finished="state.finished"
                :suppress-load-more="state.jumpScrollLock"
                :allow-top-pull="isFullscreenPullAtTop"
                @scroll="onFullscreenPagerScroll"
                @index-change="onFullscreenPagerIndexChange"
                @load-more="onLoadMore"
              >
                <template #default="{ item, index }">
                  <div
                    class="fullscreen-slide"
                    :class="{ 'fullscreen-slide--video': item.fileType === 'video' }"
                    :style="item.fileType === 'video' ? { backgroundColor: '#000' } : undefined"
                    @touchstart="(e) => onImageTouchStart(index, e)"
                    @touchmove="onImageTouchMove"
                    @touchend="onImageTouchEnd"
                    @touchcancel="onImageTouchEnd"
                    @mousedown="(e) => onCardMouseDown(index, e)"
                    @mousemove="onCardMouseMove"
                    @mouseup="onCardMouseUp"
                    @mouseleave="onCardMouseUp"
                    @contextmenu="onMediaContextMenu(index, $event)"
                    @click="openPreview(index)"
                  >
                    <div
                      v-if="item.fileType !== 'video' && shouldLoadFullscreenImage(index)"
                      class="fullscreen-slide-media"
                    >
                      <div
                        v-if="imageErrorState[getItemKey(item)]"
                        class="preview-fallback fullscreen-slide-fallback"
                        @click.stop="retryLoadImage(item)"
                      >
                        <van-icon name="photo-fail" size="28" />
                        <div class="preview-fallback-text">{{ imageLoadFailText }}</div>
                      </div>
                      <template v-else>
                        <van-loading
                          v-if="!isSlideImageLoaded(item)"
                          class="fullscreen-slide-loading"
                          type="spinner"
                          color="var(--van-gray-5)"
                        />
                        <img
                          class="fullscreen-slide-img"
                          :class="{ 'fullscreen-slide-img--ready': isSlideImageLoaded(item) }"
                          :style="{ objectFit: mediaObjectFit }"
                          :src="getFullscreenListImageSrc(item)"
                          alt=""
                          draggable="false"
                          decoding="async"
                          :loading="index === fullscreenVisibleIndex ? 'eager' : 'lazy'"
                          @load="onSlideImageLoad(item)"
                          @error="onImageLoadError(item, $event)"
                        />
                        <div class="media-touch-shield" aria-hidden="true" />
                      </template>
                    </div>
                    <div
                      v-else-if="item.fileType !== 'video'"
                      class="fullscreen-slide-placeholder"
                      aria-hidden="true"
                    />
                    <template v-if="item.fileType === 'video' && item.videoSrc">
                      <video
                        :ref="(el) => setInlineVideoRef(item, el)"
                        class="fullscreen-slide-video"
                        :style="{ objectFit: mediaObjectFit }"
                        :src="item.videoSrc"
                        :poster="getDisplayPosterSrc(item)"
                        loop
                        playsinline
                        webkit-playsinline
                        x5-playsinline
                        preload="metadata"
                        @click.stop="onInlineVideoSurfaceClick(item)"
                        @pause="onInlineVideoPaused(item)"
                        @error="onInlineVideoError(item)"
                      />
                      <button
                        v-if="!isInlineVideoPlaying(item) && !shouldMaskItem(item)"
                        type="button"
                        class="fullscreen-slide-video-btn"
                        :aria-label="t('h5.pages.search.videoPreview.play')"
                        @click.stop="toggleInlineVideo(item, index)"
                      >
                        <IconifyIcon
                          class="fullscreen-slide-play-icon"
                          icon="custom:play-circle"
                        />
                      </button>
                    </template>
                    <div
                      v-else-if="item.fileType === 'video'"
                      class="fullscreen-slide-video-hint"
                      aria-hidden="true"
                    >
                      <IconifyIcon class="fullscreen-slide-play-icon" icon="custom:play-circle" />
                    </div>
                    <H5NsfwContentMask
                      :visible="shouldMaskItem(item)"
                      @click="onNsfwMaskClick"
                    />
                  </div>
                </template>
              </H5FullscreenPager>
              <H5ListEmpty
                v-else-if="state.finished && !state.loading"
                :description="t('messages.noData')"
              />
              <div v-if="state.loading && list.length" class="load-more-text">{{ t('messages.loading') }}</div>
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
        <div class="filter-group filter-group--switch">
          <div class="filter-switch-row">
            <div class="group-title">{{ t('exploreCommon.header.useSemanticSearch') }}</div>
            <van-switch
              :model-value="useSemanticSearch"
              :disabled="!semanticSearchAvailable"
              size="20px"
              @update:model-value="onSemanticSearchChange"
            />
          </div>
          <p v-if="!semanticSearchAvailable" class="filter-semantic-hint">
            {{ t('exploreCommon.header.useSemanticSearchHint') }}
          </p>
        </div>
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
            <div class="group-title">{{ t('h5.pages.search.filters.listMode') }}</div>
            <van-radio-group v-model="form.isRandom" class="filter-options" direction="horizontal">
              <van-radio v-for="o in listModeRadioOptions" :key="String(o.value)" :name="o.value">
                {{ o.text }}
              </van-radio>
            </van-radio-group>
          </div>
          <div v-if="!form.isRandom" class="filter-group">
            <div class="group-title">{{ t('pages.Setting.settingDataForm.sortField') }}</div>
            <van-radio-group v-model="form.sortField" class="filter-options filter-options--sort" direction="horizontal">
              <van-radio v-for="o in sortFieldRadioOptions" :key="o.value" :name="o.value">{{ o.text }}</van-radio>
            </van-radio-group>
          </div>
          <div v-if="!form.isRandom" class="filter-group">
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
        <div v-if="showSearchQualityFilter" class="filter-group">
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

    <van-image-preview
      v-model:show="state.showPreview"
      :images="previewImages"
      :start-position="previewStartPosition"
      closeable
      @change="onPreviewIndexChange"
    />

    <Teleport to="body">
      <div
        v-if="
          state.showPreview &&
          previewImageErrorAt >= 0 &&
          previewImageErrorAt === previewCurrentIndex
        "
        class="h5-preview-error-hint"
        @click.stop="retryPreviewImage"
      >
        <van-icon name="photo-fail" size="32" />
        <div class="preview-fallback-text">{{ imageLoadFailText }}</div>
      </div>
    </Teleport>

    <van-popup
      v-model:show="state.showActionPopup"
      destroy-on-close
      position="bottom"
      :z-index="H5_OVERLAY_Z.actionPopup"
      :style="{ padding: '16px' }"
    >
      <div class="action-popup-content">
        <div class="action-item" @click="showImageInfo">
          <div class="action-icon-wrapper">
            <IconifyIcon class="action-icon-inner" icon="custom:info-line" />
          </div>
          <span class="action-label">{{ t('h5.pages.search.actions.info') }}</span>
        </div>
        <div class="action-item" @click="toggleSelectedFavorite">
          <div class="action-icon-wrapper">
            <IconifyIcon
              class="action-icon-inner"
              :icon="selectedItem?.isFavorite ? 'custom:star-fill' : 'custom:star'"
              :style="{ color: selectedItem?.isFavorite ? 'gold' : '' }"
            />
          </div>
          <span class="action-label">{{ selectedFavoriteActionLabel }}</span>
        </div>
        <div class="action-item" @click="addSelectedToPrivacySpace">
          <div class="action-icon-wrapper">
            <IconifyIcon class="action-icon-inner" icon="custom:privacy-tip-outline" />
          </div>
          <span class="action-label">{{ t('exploreCommon.addToPrivacySpace') }}</span>
        </div>
        <div class="action-item" @click="saveSelectedMedia">
          <div class="action-icon-wrapper">
            <IconifyIcon class="action-icon-inner" icon="custom:download-line" />
          </div>
          <span class="action-label">{{ t('h5.pages.search.actions.save') }}</span>
        </div>
        <div class="action-item delete-action" @click="deleteSelectedMedia">
          <div class="action-icon-wrapper">
            <IconifyIcon class="action-icon-inner" icon="custom:delete-line" />
          </div>
          <span class="action-label">{{ t('h5.pages.search.actions.delete') }}</span>
        </div>
      </div>
    </van-popup>

    <div
      v-show="isImageInfoPanelOpen"
      class="image-info-backdrop"
      aria-hidden="true"
      @click="closeImageInfoPanel"
    />
    <van-floating-panel
      v-model:height="imageInfoPanelHeight"
      :anchors="imageInfoPanelAnchors"
      class="image-info-panel"
      @height-change="onImageInfoHeightChange"
    >
      <div class="image-info-content">
        <van-cell-group v-if="imageInfoItem">
          <van-cell
            v-for="key in infoKeys"
            :key="key"
            value-class="image-info-value"
            :title="t(`h5.pages.home.imageInfo.${key}`)"
            :value="handleInfoVal(imageInfoItem, key, t)"
          />
        </van-cell-group>
      </div>
    </van-floating-panel>

    <div
      v-if="list.length"
      class="search-page-indicator"
      :class="{ 'search-page-indicator--clickable': displayMode === 'fullscreen' }"
      :style="searchPageIndicatorStyle"
      @click="openJumpPopup"
    >
      {{ displayMode === 'fullscreen' ? fullscreenIndicatorText : waterfallIndicatorText }}
    </div>

    <H5FloatingButtons
      v-if="list.length"
      :enabled-keys="settingData.h5EnabledFloatingButtons || []"
      :position="settingData.h5FloatingButtonPosition || 'left'"
      :auto-play-on="fullscreenAutoPlayOn"
      :countdown="fullscreenAutoPlayCountdown"
      :interval-sec="fullscreenAutoPlayIntervalSec"
      :display-size="form.displaySize"
      :immersive-mode="immersiveMode"
      :is-current-favorite="isCurrentFullscreenFavorite"
      :show-image-playback-controls="showImagePlaybackFloats"
      :show-favorites="displayMode === 'fullscreen'"
      :hidden="state.showPreview"
      @toggle-auto-play="onToggleFullscreenAutoPlay"
      @cycle-interval="onCycleFullscreenInterval"
      @favorite-touch-start="handleFavoriteTouchStart"
      @favorite-touch-move="handleFavoriteTouchMove"
      @favorite-touch-end="handleFavoriteTouchEnd"
      @toggle-display-size="toggleDisplaySize"
      @toggle-immersive="onToggleImmersiveMode"
      @back-top="onFloatingBackTop"
    />

    <van-toast
      v-model:show="state.showFavoriteToast"
      :overlay="false"
      style="background-color: transparent"
    >
      <template #message>
        <img class="favorite-toast-icon" src="@h5/assets/images/star.gif" alt="" />
        <div v-if="state.isFavoriteHolding && favoriteHold.count" class="favorite-toast-count">
          +{{ favoriteHold.count }}
        </div>
      </template>
    </van-toast>

    <van-dialog
      v-model:show="state.showJumpPopup"
      class-name="search-jump-dialog"
      :title="t('h5.pages.home.actions.jumpToIndex')"
      show-cancel-button
      @opened="() => onJumpDialogViewportChange()"
      @confirm="jumpToIndex"
      @cancel="jumpIndex = ''"
    >
      <van-field
        v-model="jumpIndex"
        :placeholder="t('h5.pages.home.actions.enterIndex')"
        type="digit"
        :maxlength="String(searchResultTotal).length"
        @focus="onJumpDialogViewportChange(true)"
      />
    </van-dialog>

    <H5PrivacyPasswordDialog ref="privacyPasswordDialogRef" />
  </div>
</template>

<style scoped lang="scss">
.page-search-inner {
  width: 100%;
  max-width: none;
  box-sizing: border-box;
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
  background-color: rgba(0, 0, 0, 0.07);
}
.fullscreen-slide-media {
  position: absolute;
  inset: 0;
  z-index: 1;

  .fullscreen-slide-img {
    pointer-events: none;
    -webkit-user-drag: none;
    user-drag: none;
    touch-action: manipulation;
  }

  .media-touch-shield {
    z-index: 6;
  }
}
.fullscreen-slide-fallback {
  z-index: 2;
  color: var(--van-text-color-2);
  background: rgba(0, 0, 0, 0.06);
}
.fullscreen-slide-loading {
  position: absolute;
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%);
  z-index: 1;
}
.fullscreen-slide-img {
  width: 100%;
  height: 100%;
  display: block;
  object-position: center;
  opacity: 0;
  transition: opacity 0.2s ease;
}
.fullscreen-slide-img--ready {
  opacity: 1;
}
.fullscreen-slide-placeholder {
  width: 100%;
  height: 100%;
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
  opacity: 0.82;
}

.page-search--immersive .search-toolbar {
  display: none;
}
.search-chrome-mini {
  position: fixed;
  top: calc(8px + env(safe-area-inset-top, 0px));
  right: 12px;
  z-index: 120;
  display: flex;
  gap: 8px;
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
}
.chrome-mini-btn :deep(.van-icon) {
  color: #fff;
}
.search-page-indicator--clickable {
  pointer-events: auto;
  cursor: pointer;
}
.favorite-toast-icon {
  width: 72px;
  height: 72px;
}
.favorite-toast-count {
  margin-top: 4px;
  font-size: 18px;
  font-weight: 600;
  color: gold;
  text-align: center;
}

.search-page-indicator {
  padding: 4px 10px;
  border-radius: 999px;
  font-size: 13px;
  color: #fff;
  background: rgba(0, 0, 0, 0.45);
  pointer-events: none;
}
/* 顶栏基础样式见 h5/assets/styles/main.css */

.search-toolbar-wrap .search-row {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1;
  min-width: 0;
}
.search-toolbar-wrap .search-form {
  flex: 1;
  min-width: 0;
  margin: 0;
}
.search-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0;
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

.filter-keyword-input {
  padding: 0;
  margin: 0;
}

.filter-keyword-input :deep(.van-search__content) {
  align-items: center;
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
.search-skeleton--fullscreen {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.fullscreen-skeleton-slide {
  flex: 1;
  min-height: 240px;
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  padding: 24px 16px;
  box-sizing: border-box;
  background: rgba(0, 0, 0, 0.04);
}

.result-list-skeleton {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
  width: 100%;
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
  cursor: pointer;
  transition:
    transform 0.18s ease,
    box-shadow 0.18s ease,
    border-color 0.18s ease;
  -webkit-tap-highlight-color: transparent;
  transform: translateZ(0);

  &--pressing {
    transform: scale(0.97) translateZ(0);
    box-shadow: 0 1px 4px rgba(0, 0, 0, 0.1);
    border-color: rgba(0, 0, 0, 0.1);

    .preview-wrap::after {
      opacity: 1;
    }
  }
}
.preview-wrap > .h5-nsfw-content-mask,
.fullscreen-slide > .h5-nsfw-content-mask {
  z-index: 50;
}
.preview-wrap {
  border-radius: 0;
  overflow: hidden;
  background: rgba(0, 0, 0, 0.05);
  position: relative;

  &::after {
    content: '';
    position: absolute;
    inset: 0;
    z-index: 4;
    background: rgba(0, 0, 0, 0.1);
    opacity: 0;
    transition: opacity 0.18s ease;
    pointer-events: none;
  }
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
.preview:not(.preview--inline-video),
.preview--poster-overlay {
  pointer-events: none;
  -webkit-user-drag: none;
  user-drag: none;
}
.preview {
  width: 100%;
  height: 100%;
  display: block;
  object-position: center;
  -webkit-touch-callout: none;
  -webkit-user-select: none;
  user-select: none;
  touch-action: manipulation;
}
.media-touch-shield {
  position: absolute;
  inset: 0;
  z-index: 5;
  background: transparent;
  -webkit-touch-callout: none;
  touch-action: manipulation;
}
.preview-wrap video,
.fullscreen-slide-media img,
.fullscreen-slide-video {
  -webkit-touch-callout: none;
  -webkit-user-select: none;
  user-select: none;
}
.preview-wrap--video .media-touch-shield {
  z-index: 2;
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
.preview--inline-video {
  position: relative;
  z-index: 1;
  width: 100%;
  height: 100%;
  display: block;
  object-position: center;
  background: #000;
}
.preview--poster-overlay,
.preview-fallback--overlay {
  position: absolute;
  inset: 0;
  z-index: 2;
}
.video-play-badge {
  position: absolute;
  inset: 0;
  z-index: 3;
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0;
  padding: 0;
  border: none;
  background: transparent;
  cursor: pointer;
  color: rgba(255, 255, 255, 0.58);
  filter: drop-shadow(0 1px 4px rgba(0, 0, 0, 0.35));
}
.preview-video-ph-icon {
  font-size: 40px;
  opacity: 0.55;
}
.video-play-badge-icon {
  font-size: 44px;
  opacity: 0.82;
}
.fullscreen-slide--video {
  position: relative;
}
.fullscreen-slide-video {
  width: 100%;
  height: 100%;
  display: block;
  object-position: center;
  background: #000;
}
.fullscreen-slide-video-btn {
  position: absolute;
  inset: 0;
  z-index: 2;
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0;
  padding: 0;
  border: none;
  background: transparent;
  cursor: pointer;
  color: rgba(255, 255, 255, 0.58);
  filter: drop-shadow(0 1px 4px rgba(0, 0, 0, 0.35));
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
  width: 100%;
  max-width: none;
  max-height: 60dvh;
  overflow: hidden;
}
.filter-panel {
  display: flex;
  flex-direction: column;
  width: 100%;
  max-width: none;
  max-height: 60dvh;
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
.filter-group--switch {
  .filter-switch-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;

    .group-title {
      margin-bottom: 0;
    }
  }

  .filter-semantic-hint {
    margin: 8px 0 0;
    font-size: 12px;
    line-height: 1.4;
    color: var(--van-text-color-2);
  }
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

.image-info-backdrop {
  position: fixed;
  inset: 0;
  z-index: v-bind('H5_OVERLAY_Z.imageInfoBackdrop');
  background: rgba(0, 0, 0, 0.35);
}

.image-info-panel {
  z-index: v-bind('H5_OVERLAY_Z.imageInfoPanel');

  /* 滚动必须在 Vant 的 __content 上，否则 scrollTop 恒为 0 会跟手收起面板 */
  :deep(.van-floating-panel__content) {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    -webkit-overflow-scrolling: touch;
    touch-action: pan-y;
  }
}

.image-info-content {
  padding-bottom: env(safe-area-inset-bottom, 0px);
}
</style>

<!-- 预览 teleport 到 body，需非 scoped：禁用长按系统菜单/保存图片等 -->
<style lang="scss">
.h5-preview-error-hint {
  position: fixed;
  left: 50%;
  top: 50%;
  z-index: 2500;
  transform: translate(-50%, -50%);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  padding: 16px 20px;
  max-width: 80vw;
  border-radius: 12px;
  color: #fff;
  background: rgba(0, 0, 0, 0.72);
  pointer-events: auto;
}
.van-image-preview {
  -webkit-touch-callout: none;
}
.van-image-preview :deep(.van-image__error),
.van-image-preview :deep(.van-image__loading) {
  display: none;
}
.van-image-preview :deep(.van-swipe-item),
.van-image-preview__image {
  position: relative;
}
.van-image-preview img,
.van-image-preview__image img {
  pointer-events: none !important;
  -webkit-touch-callout: none !important;
  -webkit-user-select: none !important;
  -webkit-user-drag: none !important;
  user-select: none !important;
  touch-action: manipulation !important;
}
/* 国产浏览器（含小米）长按识别 img 节点；透明层承接触摸 */
.van-image-preview :deep(.van-swipe-item)::after {
  content: '';
  position: absolute;
  inset: 0;
  z-index: 20;
  background: transparent;
  -webkit-touch-callout: none;
  touch-action: manipulation;
}
</style>
