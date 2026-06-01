import {
  computed,
  nextTick,
  onActivated,
  onDeactivated,
  onMounted,
  onUnmounted,
  reactive,
  ref,
  toRaw,
  unref,
  watch
} from 'vue'
import { storeToRefs } from 'pinia'
import { showConfirmDialog, showNotify, showToast } from 'vant/es'
import UseCommonStore from '@h5/stores/commonStore.js'
import UseSettingStore from '@h5/stores/settingStore.js'
import * as api from '@h5/api/index.js'
import { useTranslation } from 'i18next-vue'
import {
  infoKeys,
  filterTypeOptions,
  orientationOptions,
  qualityList,
  sortFieldOptions,
  sortTypeOptions,
  isQualityFilterApplicable
} from '@common/publicData.js'
import { handleInfoVal, resolveApiUserMessage, isTransientSearchFailure } from '@common/utils.js'
import { usePrivacyNsfwMask } from '@common/composables/usePrivacyNsfwMask.mjs'
import { useH5FullscreenAutoPlay } from '@h5/composables/useH5FullscreenAutoPlay.js'
import {
  applyH5CardImageCompress,
  applyH5ImageCompress
} from '@h5/utils/imageUrl.js'
import { getH5NumberIndicatorStyle } from '@h5/utils/indicatorStyle.js'
import {
  normalizeBrowseItem,
  getBrowseItemKey,
  getBrowseListDedupKey
} from '@h5/utils/normalizeBrowseItem.mjs'
import { useH5SimilarResults } from '@h5/composables/useH5SimilarResults.mjs'
import { buildH5BrowseSimilarScope } from '@h5/utils/h5SimilarScope.mjs'

/** H5 叠层：高于 van-image-preview 默认层级（约 2000） */
const H5_OVERLAY_Z = {
  actionPopup: 3001,
  imageInfoBackdrop: 3010,
  imageInfoPanel: 3020,
  confirmDialog: 3030
}

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
const FULLSCREEN_IMAGE_PRELOAD_RANGE = 1
const BROWSE_WATERFALL_CONTENT_GAP_PX = 10
const BROWSE_INDICATOR_TOP_CARD_GAP_PX = 8
const INLINE_VIDEO_MIN_VISIBLE_RATIO = 0.15

const BROWSE_MEDIA_CONTEXT_SELECTOR =
  '.result-item, .fullscreen-slide, .van-image-preview, .preview-wrap'

const BROWSE_MEDIA_CAPTURE_EVENTS = ['contextmenu', 'selectstart', 'dragstart']

const JUMP_DIALOG_TOP_VAR = '--fbw-jump-dialog-top'

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

/**
 * 收藏 / 回忆 / 合集详情共用浏览逻辑（从 search 页抽取）
 * @param {{
 *   browseType: 'favorites' | 'history' | 'collection',
 *   collectionId?: import('vue').Ref|null,
 *   displayModeStorageKey: string,
 *   removeOnUnfavorite?: boolean,
 *   pageClass?: string
 * }} options
 */
export function useH5ResourceBrowse(options) {
  const {
    browseType,
    collectionId = null,
    displayModeStorageKey,
    removeOnUnfavorite = false,
    pageClass = 'page-browse',
    openPrivacyPasswordDialog = null
  } = options

  const { t } = useTranslation()
  const commonStore = UseCommonStore()
  const settingStore = UseSettingStore()
  const { settingData } = storeToRefs(settingStore)
  const { immersiveMode } = storeToRefs(commonStore)

  const form = reactive({
    displaySize: 'cover'
  })

  const showBrowseSearch = browseType === 'favorites' || browseType === 'history'
  /** 收藏页顶栏：进入/退出隐私空间浏览模式 */
  const enablePrivacySpaceToolbar = browseType === 'favorites'
  /** 长按菜单：加入/移出隐私空间（收藏、回忆、合集） */
  const showPrivacySpaceActions = true

  const getBrowseSortDefaults = () => ({
    sortField: settingData.value?.sortField || 'created_at',
    sortType: Number(settingData.value?.sortType) || -1,
    isRandom: false
  })

  const searchForm = reactive({
    filterKeywords: '',
    filterType: 'images',
    orientation: '',
    quality: '',
    ...getBrowseSortDefaults()
  })

  const inPrivacySpace = ref(false)

  const nsfwMask = usePrivacyNsfwMask({
    settingData,
    inPrivacySpace,
    hasPrivacyPassword: () => api.hasPrivacyPassword(),
    openPasswordDialog: () => openPrivacyPasswordDialog?.(),
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
    if (item && nsfwMask.isActionBlocked(item)) {
      notifyNsfwMaskBlocked()
      return true
    }
    return false
  }

  const shouldMaskNsfwItem = nsfwMask.shouldMaskItem
  const onNsfwMaskClick = nsfwMask.onMaskClick
  const lockNsfwMaskPage = nsfwMask.lockPage
  const refreshNsfwMaskHasPassword = nsfwMask.refreshHasPassword

  const page = reactive({
    startPage: 1,
    total: 0,
    lastPageSize: 20
  })

  let loadListSeq = 0

  const state = reactive({
    loading: false,
    refreshing: false,
    finished: false,
    showActionPopup: false,
    showFilters: false,
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
  const browseToolbarRef = ref(null)
  const browseToolbarHeight = ref(52)
  let browseToolbarResizeObserver = null
  const inlineVideoRefs = {}
  const inlineVideoPlayingKeys = ref(new Set())
  const inlineVideoVisibilityObservers = {}
  const fullscreenPagerRef = ref(null)
  const fullscreenVisibleIndex = ref(0)
  const fullscreenScrollTop = ref(0)

  const readStoredDisplayMode = () => {
    try {
      const stored = localStorage.getItem(displayModeStorageKey)
      if (stored === 'waterfall') return 'waterfall'
      return 'fullscreen'
    } catch {
      return 'fullscreen'
    }
  }
  const displayMode = ref(readStoredDisplayMode())

  const waterfallLoadMoreLatch = ref(false)
  watch(
    () => state.loading,
    (loading) => {
      if (!loading) waterfallLoadMoreLatch.value = false
    }
  )

  const list = ref([])

  const {
    similarMode,
    similarSourceItem,
    similarTotal,
    similarHasMore,
    resetSimilar,
    startSimilar,
    appendSimilarPage,
    resolvePageSize: resolveSimilarPageSize
  } = useH5SimilarResults({
    normalizeRows: (rows) => rows.map(normalizeBrowseItem),
    getPageSize: () => resolveBrowsePageSize(),
    getDedupKey: getBrowseListDedupKey
  })

  const similarListSnapshot = ref(null)

  const similarSourceImageSrc = computed(() => {
    const item = similarSourceItem.value
    return item?.imageSrc || item?.imageRawSrc || ''
  })

  const buildSimilarScope = () =>
    buildH5BrowseSimilarScope({
      browseType,
      inPrivacySpace: inPrivacySpace.value,
      collectionId: unref(collectionId)
    })

  const exitSimilarMode = () => {
    const snap = similarListSnapshot.value
    resetSimilar()
    if (!snap) return
    list.value = snap.list
    page.total = snap.total
    state.finished = snap.finished
    similarListSnapshot.value = null
    nextTick(() => {
      if (displayMode.value === 'fullscreen') {
        fullscreenVisibleIndex.value = 0
        fullscreenPagerRef.value?.scrollToIndex?.(0, false)
      } else if (pageWrapperRef.value) {
        pageWrapperRef.value.scrollTop = snap.scrollTop ?? 0
        state.scrollTop = snap.scrollTop ?? 0
      }
    })
  }

  const loadSimilarMore = async () => {
    if (state.loading || !similarHasMore.value) return
    state.loading = true
    try {
      const hasMore = await appendSimilarPage(
        () => list.value,
        (next) => {
          list.value = next
        }
      )
      state.finished = !hasMore
      if (!hasMore && list.value.length) {
        showToast({ message: t('messages.noMoreData') })
      }
    } finally {
      state.loading = false
      state.refreshing = false
      nextTick(() => {
        void syncFullscreenActiveMedia()
      })
    }
  }

  const longPress = reactive({
    timer: null,
    selectedIndex: -1,
    startX: 0,
    startY: 0,
    suppressClick: false
  })

  const previewCurrentIndex = ref(0)

  const previewLongPress = {
    timer: null,
    startX: 0,
    startY: 0
  }

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
  const previewImageErrorAt = ref(-1)

  const imageLoadFailText = computed(() => t('messages.imageLoadRetryHint'))

  const getItemKey = getBrowseItemKey

  const resolveImageCompressWidth = (opts = {}) => {
    if (opts.width) return Math.max(1, Math.round(opts.width))
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

  const isFullscreenListCompressEnabled = () => !!settingData.value.h5FullscreenImageCompress

  const buildFullscreenListImageUrl = (url, opts = {}) => {
    if (!url) return ''
    return applyH5ImageCompress(url, {
      width: resolveImageCompressWidth(opts),
      settingData: settingData.value,
      enabled: isFullscreenListCompressEnabled()
    })
  }

  const getWaterfallImageSrc = (item, opts = {}) => {
    const base = getItemRawImageUrl(item)
    const url = applyH5CardImageCompress(base, {
      width: resolveImageCompressWidth(opts),
      settingData: settingData.value
    })
    return appendImageRetryQuery(url, item)
  }

  const getFullscreenListImageSrc = (item, opts = {}) => {
    const url = buildFullscreenListImageUrl(getItemRawImageUrl(item), opts)
    return appendImageRetryQuery(url, item)
  }

  const getPreviewImageSrc = (item) => appendImageRetryQuery(getItemRawImageUrl(item), item)

  const getDisplayImageSrc = (item, opts = {}) => {
    if (displayMode.value === 'waterfall') {
      return getWaterfallImageSrc(item, opts)
    }
    return getFullscreenListImageSrc(item, opts)
  }

  const getDisplayPosterSrc = (item, opts = {}) => {
    const raw = item.posterRawSrc || ''
    if (!raw) return ''
    const url =
      displayMode.value === 'waterfall'
        ? applyH5CardImageCompress(raw, {
            width: resolveImageCompressWidth(opts),
            settingData: settingData.value
          })
        : buildFullscreenListImageUrl(raw, opts)
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

  const fetchCollectionPageWithRetry = async (payload) => {
    const maxAttempts = 3
    let lastRes = null
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      lastRes = await api.collectionsGet(payload)
      if (lastRes?.success && Array.isArray(lastRes?.data?.items)) {
        return lastRes
      }
      const retryable = isTransientSearchFailure(lastRes)
      if (!retryable || attempt === maxAttempts - 1) break
      await sleep(320 * (attempt + 1))
    }
    return lastRes
  }

  const fetchBrowsePage = async (startPage, pageSize) => {
    if (browseType === 'collection') {
      const id = unref(collectionId)
      return fetchCollectionPageWithRetry({ id, startPage, pageSize })
    }
    const keywordText = String(searchForm.filterKeywords ?? '')
      .trim()
      .replace(/^#+/, '')
    const resourceName =
      browseType === 'history' ? 'history' : inPrivacySpace.value ? 'privacy_space' : 'favorites'
    return fetchSearchPageWithRetry({
      resourceType: 'localResource',
      resourceName,
      startPage,
      pageSize,
      sortField: searchForm.sortField || 'created_at',
      sortType: Number(searchForm.sortType) || -1,
      filterType: searchForm.filterType || 'images',
      filterKeywords: keywordText,
      keywords: keywordText,
      orientation: searchForm.orientation || '',
      quality: isQualityFilterApplicable(searchForm.filterType) ? searchForm.quality || '' : '',
      isRandom: !!searchForm.isRandom
    })
  }

  const filterTypeDropdownOptions = computed(() =>
    filterTypeOptions
      .filter((item) => ['images', 'videos'].includes(item.value))
      .map((item) => ({
        value: item.value,
        text: t(item.locale)
      }))
  )

  const listModeRadioOptions = computed(() => [
    { value: false, text: t('h5.pages.search.filters.listModeOrder') },
    { value: true, text: t('h5.pages.search.filters.listModeRandom') }
  ])

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

  const showBrowseQualityFilter = computed(() =>
    isQualityFilterApplicable(searchForm.filterType)
  )

  watch(
    () => searchForm.filterType,
    (type) => {
      if (!isQualityFilterApplicable(type)) {
        searchForm.quality = ''
      }
    }
  )

  const onSearch = async () => {
    if (similarMode.value) exitSimilarMode()
    state.showFilters = false
    await reload()
  }

  const onResetBrowseFilters = () => {
    searchForm.filterKeywords = ''
    searchForm.filterType = 'images'
    searchForm.orientation = ''
    searchForm.quality = ''
    Object.assign(searchForm, getBrowseSortDefaults())
  }

  const onApplyBrowseFilters = async () => {
    state.showFilters = false
    await onSearch()
  }

  const enterPrivacySpace = async () => {
    inPrivacySpace.value = true
    await reload()
  }

  const exitPrivacySpace = async () => {
    inPrivacySpace.value = false
    await reload()
  }

  const extractPageRows = (res) => {
    if (browseType === 'collection') {
      return Array.isArray(res?.data?.items) ? res.data.items : []
    }
    return Array.isArray(res?.data?.list) ? res.data.list : []
  }

  const isBrowseResponseValid = (res) => {
    if (!res?.success) return false
    if (browseType === 'collection') {
      return Array.isArray(res?.data?.items)
    }
    return Array.isArray(res?.data?.list)
  }

  let ensureWaterfallSeq = 0
  let waterfallFillEnsuring = false

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
    if (similarMode.value && !reset) {
      await loadSimilarMore()
      return
    }
    if (reset && similarMode.value) {
      exitSimilarMode()
    }
    if (state.loading) return
    if (browseType === 'collection' && !unref(collectionId)) {
      state.finished = true
      return
    }
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
    const requestPageSize = resolveBrowsePageSize()
    page.lastPageSize = requestPageSize
    try {
      const res = await fetchBrowsePage(page.startPage, requestPageSize)
      if (reqSeq !== loadListSeq) return
      if (isBrowseResponseValid(res)) {
        const prevCount = list.value.length
        const merged = [...list.value, ...extractPageRows(res).map(normalizeBrowseItem)]
        const map = new Map()
        merged.forEach((item) => {
          const key = getBrowseListDedupKey(item)
          if (key) map.set(key, item)
        })
        list.value = [...map.values()]
        if (typeof res.data.total === 'number' && res.data.total >= 0) {
          page.total = res.data.total
        } else if (reset || page.total === 0) {
          page.total = list.value.length
        }
        page.startPage += 1
        const pageRows = extractPageRows(res).length
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

  const reload = async () => {
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

  const removeItemAfterUnfavorite = (item) => {
    if (!removeOnUnfavorite || browseType !== 'favorites') return
    removeSelectedItemFromList(item)
  }

  const onToggleFavorite = async (item) => {
    if (blockIfNsfwMasked(item)) return
    const isPrivacy = enablePrivacySpaceToolbar && inPrivacySpace.value
    const res = item.isFavorite
      ? await api.removeFavorites(item.id, isPrivacy)
      : await api.addToFavorites(item.id, isPrivacy)
    if (res?.success) {
      item.isFavorite = !item.isFavorite
      if (!item.isFavorite) {
        removeItemAfterUnfavorite(item)
      }
      showNotify({ type: 'success', message: t('messages.operationSuccess') })
    } else {
      showNotify({ type: 'danger', message: resolveApiUserMessage(res, t) || t('messages.operationFail') })
    }
  }

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

  const estimateWaterfallPageSize = () => {
    const cols = Math.max(1, gridColumns.value)
    const wrap = pageWrapperRef.value
    const viewportH = Math.max(
      state.viewportHeight || 0,
      wrap?.clientHeight || 0,
      typeof window !== 'undefined' ? window.innerHeight : 800
    )
    const toolbarH = immersiveMode.value ? 0 : browseToolbarHeight.value || 52
    const availableH = Math.max(280, viewportH - toolbarH - BROWSE_WATERFALL_CONTENT_GAP_PX - 16)
    const avgItemH = FALLBACK_ITEM_HEIGHT + GRID_GAP
    const rowsNeeded = Math.ceil(availableH / avgItemH) + WATERFALL_VIEWPORT_BUFFER_ROWS
    const itemsNeeded = rowsNeeded * cols
    return Math.max(
      WATERFALL_PAGE_SIZE_MIN,
      Math.min(WATERFALL_PAGE_SIZE_MAX, itemsNeeded)
    )
  }

  const resolveBrowsePageSize = () =>
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
        return Math.max(0, row.top - BROWSE_WATERFALL_CONTENT_GAP_PX)
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
        visibleBottom = column.items[start].top + column.items[start].height + GRID_GAP
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

  const browseResultTotal = computed(() => {
    if (similarMode.value) {
      const total = Number(similarTotal.value) || 0
      if (total > 0) return total
      return Math.max(1, list.value.length)
    }
    const server = Number(page.total) || 0
    const loaded = list.value.length
    if (server > 0) return server
    return Math.max(1, loaded)
  })

  const waterfallIndicatorText = computed(() => {
    const loaded = list.value.length
    const total = browseResultTotal.value
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

  const fullscreenAutoPlayUserStopped = ref(true)

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

  const toggleDisplayMode = () => {
    if (displayMode.value === 'waterfall') {
      persistWaterfallScrollPosition()
      fullscreenVisibleIndex.value = getFirstVisibleWaterfallListIndex()
    }
    displayMode.value = displayMode.value === 'waterfall' ? 'fullscreen' : 'waterfall'
    try {
      localStorage.setItem(displayModeStorageKey, displayMode.value)
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

  const fullscreenIndicatorText = computed(() => {
    const len = list.value.length
    const cur = len ? Math.min(fullscreenVisibleIndex.value + 1, len) : 0
    const total = browseResultTotal.value
    return t('h5.pages.search.displayMode.indicator', { current: cur, total })
  })

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

  const measureBrowseToolbarHeight = () => {
    const el = browseToolbarRef.value
    if (!el) return
    const h = Math.round(el.getBoundingClientRect().height)
    if (h > 0) browseToolbarHeight.value = h
  }

  const bindBrowseToolbarResizeObserver = () => {
    browseToolbarResizeObserver?.disconnect()
    const el = browseToolbarRef.value
    if (!el || typeof ResizeObserver === 'undefined') return
    browseToolbarResizeObserver = new ResizeObserver(() => measureBrowseToolbarHeight())
    browseToolbarResizeObserver.observe(el)
  }

  const browsePageIndicatorStyle = computed(() => {
    const position = settingData.value.h5NumberIndicatorPosition
    const compactTopChrome = immersiveMode.value || displayMode.value === 'fullscreen'
    let topOffset = compactTopChrome
      ? 'calc(8px + env(safe-area-inset-top, 0px))'
      : `calc(${browseToolbarHeight.value}px + env(safe-area-inset-top, 0px) + 4px)`

    if (position === 'top' && displayMode.value === 'waterfall' && !immersiveMode.value) {
      topOffset = `calc(${browseToolbarHeight.value}px + ${BROWSE_WATERFALL_CONTENT_GAP_PX}px + ${BROWSE_INDICATOR_TOP_CARD_GAP_PX}px + env(safe-area-inset-top, 0px))`
    }

    return getH5NumberIndicatorStyle(position, { topOffset })
  })

  const openJumpPopup = () => {
    if (displayMode.value !== 'fullscreen') return
    state.showJumpPopup = true
  }

  const jumpIndex = ref('')

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
    if (current && nsfwMask.isActionBlocked(current)) return
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
          removeItemAfterUnfavorite(currentImage)
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

  const persistWaterfallScrollPosition = () => {
    const wrap = pageWrapperRef.value
    if (!wrap || displayMode.value !== 'waterfall') return
    state.scrollTop = Math.max(0, wrap.scrollTop || state.scrollTop || 0)
  }

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
        measureBrowseToolbarHeight()
        refreshAllVideoVisibilityObservers()
      })
      return
    }
    nextTick(() => {
      void restoreFullscreenPagerPosition()
      refreshAllVideoVisibilityObservers()
    })
  })

  watch(immersiveMode, () => {
    nextTick(() => measureBrowseToolbarHeight())
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

  if (collectionId) {
    watch(collectionId, (id, prev) => {
      if (id != null && id !== '' && id !== prev) {
        void reload()
      }
    })
  }

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
    if (row && nsfwMask.isActionBlocked(row)) return
    cardPressIndex.value = index
    longPress.startX = event.touches[0].clientX
    longPress.startY = event.touches[0].clientY
    longPress.timer = setTimeout(() => {
      longPress.timer = null
      const current = list.value[index]
      if (current && nsfwMask.isActionBlocked(current)) return
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
    if (row && nsfwMask.isActionBlocked(row)) return
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

  const canFindSimilarSelected = computed(
    () => !!selectedItem.value?.id && selectedItem.value?.fileType !== 'video'
  )

  const onFindSimilarSelected = async () => {
    const item = selectedItem.value
    if (!item?.id || item.fileType === 'video') return
    if (blockIfNsfwMasked(item)) return
    state.showActionPopup = false

    const scope = buildSimilarScope()
    const pageSize = resolveSimilarPageSize()
    state.loading = true
    try {
      const res = await api.findSimilar({
        resourceId: Number(item.id),
        limit: pageSize,
        ...(scope ? { scope } : {})
      })
      if (res?.success && res.data?.list?.length) {
        if (!similarMode.value) {
          similarListSnapshot.value = {
            list: list.value.slice(),
            total: page.total,
            finished: state.finished,
            scrollTop: state.scrollTop
          }
        }
        list.value = startSimilar({
          resourceId: item.id,
          scope: scope || undefined,
          sourceItem: normalizeBrowseItem(item),
          firstRows: res.data.list.map(normalizeBrowseItem),
          pageSize,
          total: res.data.total
        })
        state.finished = !similarHasMore.value
        page.total = similarTotal.value
        fullscreenVisibleIndex.value = 0
        state.scrollTop = 0
        nextTick(() => {
          fullscreenPagerRef.value?.scrollToIndex?.(0, false)
          if (pageWrapperRef.value) pageWrapperRef.value.scrollTop = 0
        })
      } else {
        showNotify({ type: 'warning', message: t('exploreCommon.findSimilarEmpty') })
      }
    } catch (_) {
      showNotify({ type: 'danger', message: t('messages.operationFail') })
    } finally {
      state.loading = false
    }
  }

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
      removeItemAfterUnfavorite(item)
      showNotify({ type: 'success', message: t('messages.operationSuccess') })
    } catch (_) {
      showNotify({ type: 'danger', message: t('messages.operationFail') })
    } finally {
      state.showActionPopup = false
    }
  }

  const removeSelectedFromPrivacySpace = async () => {
    const item = selectedItem.value
    if (!item?.id) {
      showNotify({ type: 'warning', message: t('messages.noData') })
      return
    }
    const res = await api.removeFavorites(item.id, true)
    if (res?.success) {
      removeItemAfterUnfavorite(item)
      showNotify({ type: 'success', message: t('messages.operationSuccess') })
    } else {
      showNotify({
        type: 'danger',
        message: resolveApiUserMessage(res, t) || t('messages.operationFail')
      })
    }
    state.showActionPopup = false
  }

  const openActionByIndex = (index) => {
    const row = list.value[index]
    if (blockIfNsfwMasked(row)) return
    longPress.selectedIndex = index
    state.showActionPopup = true
  }

  const isTouchLikeContextMenu = (event) => {
    if (event.pointerType === 'touch') return true
    if (event.sourceCapabilities?.firesTouchEvents) return true
    if (longPress.suppressClick) return true
    return false
  }

  const isBrowsePageMediaTarget = (el) =>
    !!(
      el.closest(BROWSE_MEDIA_CONTEXT_SELECTOR) ||
      el.closest('.media-touch-shield') ||
      el.tagName === 'IMG' ||
      el.tagName === 'VIDEO'
    )

  const pageRootSelector = `.${pageClass}`

  const onBrowseMediaContextMenuCapture = (event) => {
    const el = event.target
    if (!(el instanceof Element)) return
    if (!el.closest(pageRootSelector) && !el.closest('.van-image-preview')) return
    if (!isBrowsePageMediaTarget(el)) return
    event.preventDefault()

    if (isTouchLikeContextMenu(event)) return

    if (el.closest('.van-image-preview')) {
      event.stopPropagation()
      const listIdx = resolveListIndexFromPreviewIndex(previewCurrentIndex.value)
      if (listIdx >= 0) openActionByIndex(listIdx)
    }
  }

  const onBrowseMediaAuxEventCapture = (event) => {
    const el = event.target
    if (!(el instanceof Element)) return
    if (!el.closest(pageRootSelector) && !el.closest('.van-image-preview')) return
    if (!isBrowsePageMediaTarget(el)) return
    event.preventDefault()
  }

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
      measureBrowseToolbarHeight()
      if (displayMode.value === 'fullscreen') {
        state.viewportHeight = window.innerHeight
        fullscreenPagerRef.value?.measureHeight?.()
      } else {
        syncWaterfallViewportMetrics()
        void ensureWaterfallCanScroll()
      }
    })
  }

  const onImageInfoHeightChange = (height) => {
    if (height === 0 && !state.showActionPopup) {
      longPress.selectedIndex = -1
    }
  }

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
    nextTick(() => {
      measureBrowseToolbarHeight()
      if (displayMode.value === 'fullscreen') {
        void restoreFullscreenPagerPosition()
      } else {
        void restoreWaterfallScrollPosition()
      }
    })
  })

  onDeactivated(() => {
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

  const cleanup = () => {
    unbindPreviewImageErrorCapture()
    for (const type of BROWSE_MEDIA_CAPTURE_EVENTS) {
      const handler =
        type === 'contextmenu' ? onBrowseMediaContextMenuCapture : onBrowseMediaAuxEventCapture
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
    browseToolbarResizeObserver?.disconnect()
    browseToolbarResizeObserver = null
    window.removeEventListener('resize', onPageResize)
  }

  onDeactivated(() => {
    lockNsfwMaskPage()
    if (browseType === 'favorites' && inPrivacySpace.value) {
      void exitPrivacySpace()
    }
  })

  onActivated(() => {
    void refreshNsfwMaskHasPassword()
  })

  onUnmounted(() => {
    cleanup()
  })

  const init = async () => {
    state.viewportHeight = window.innerHeight
    state.viewportWidth = window.innerWidth
    state.scrollTop = pageWrapperRef.value?.scrollTop || 0
    window.addEventListener('resize', onPageResize, { passive: true })
    await loadList(true)
  }

  onMounted(async () => {
    for (const type of BROWSE_MEDIA_CAPTURE_EVENTS) {
      const handler =
        type === 'contextmenu' ? onBrowseMediaContextMenuCapture : onBrowseMediaAuxEventCapture
      document.addEventListener(type, handler, true)
    }
    await init()
    nextTick(() => {
      measureBrowseToolbarHeight()
      bindBrowseToolbarResizeObserver()
      syncWaterfallViewportMetrics()
      if (displayMode.value === 'fullscreen') {
        void restoreFullscreenPagerPosition()
      }
    })
  })

  return {
    browseType,
    pageClass,
    H5_OVERLAY_Z,
    JUMP_DIALOG_TOP_VAR,
    BROWSE_WATERFALL_CONTENT_GAP_PX,
    infoKeys,
    handleInfoVal,
    t,
    settingData,
    immersiveMode,
    form,
    state,
    page,
    list,
    displayMode,
    pageWrapperRef,
    browseToolbarRef,
    fullscreenPagerRef,
    fullscreenVisibleIndex,
    imageInfoPanelAnchors,
    imageInfoPanelHeight,
    cardPressIndex,
    previewCurrentIndex,
    previewImageErrorAt,
    favoriteHold,
    jumpIndex,
    imageErrorState,
    gridColumns,
    virtualColumns,
    browseResultTotal,
    waterfallIndicatorText,
    fullscreenIndicatorText,
    mediaObjectFit,
    fullscreenCurrentItem,
    isCurrentFullscreenFavorite,
    showImagePlaybackFloats,
    fullscreenAutoPlayOn,
    fullscreenAutoPlayCountdown,
    fullscreenAutoPlayIntervalSec,
    layoutToggleTitle,
    isPullRefreshDisabled,
    isFullscreenPullAtTop,
    isImageInfoPanelOpen,
    browsePageIndicatorStyle,
    previewImages,
    previewStartPosition,
    selectedItem,
    canFindSimilarSelected,
    similarMode,
    similarSourceImageSrc,
    exitSimilarMode,
    onFindSimilarSelected,
    imageInfoItem,
    selectedFavoriteActionLabel,
    imageLoadFailText,
    showBrowseSearch,
    enablePrivacySpaceToolbar,
    showPrivacySpaceActions,
    searchForm,
    inPrivacySpace,
    filterTypeDropdownOptions,
    orientationOptions,
    qualityList,
    listModeRadioOptions,
    sortFieldRadioOptions,
    sortTypeRadioOptions,
    showBrowseQualityFilter,
    onSearch,
    onResetBrowseFilters,
    onApplyBrowseFilters,
    enterPrivacySpace,
    exitPrivacySpace,
    addSelectedToPrivacySpace,
    removeSelectedFromPrivacySpace,
    getItemKey,
    getDisplayImageSrc,
    getDisplayPosterSrc,
    getFullscreenListImageSrc,
    shouldLoadFullscreenImage,
    isSlideImageLoaded,
    onImageLoadError,
    onPosterLoadError,
    onSlideImageLoad,
    retryLoadImage,
    retryLoadPoster,
    setInlineVideoRef,
    isInlineVideoPlaying,
    onInlineVideoSurfaceClick,
    toggleInlineVideo,
    onInlineVideoPaused,
    onInlineVideoError,
    loadList,
    reload,
    onRefresh,
    onLoadMore,
    init,
    refresh: onRefresh,
    onToggleFavorite,
    toggleDisplayMode,
    toggleDisplaySize,
    onFullscreenPagerScroll,
    onFullscreenPagerIndexChange,
    openJumpPopup,
    jumpToIndex,
    onJumpDialogViewportChange,
    handleFavoriteTouchStart,
    handleFavoriteTouchMove,
    handleFavoriteTouchEnd,
    onToggleFullscreenAutoPlay,
    onCycleFullscreenInterval,
    onToggleImmersiveMode,
    onFloatingBackTop,
    openPreview,
    onPreviewIndexChange,
    retryPreviewImage,
    onImageTouchStart,
    onImageTouchMove,
    onImageTouchEnd,
    onCardMouseDown,
    onCardMouseMove,
    onCardMouseUp,
    onMediaContextMenu,
    showImageInfo,
    toggleSelectedFavorite,
    saveSelectedMedia,
    deleteSelectedMedia,
    closeImageInfoPanel,
    onImageInfoHeightChange,
    onPageScroll,
    nsfwMask,
    shouldMaskNsfwItem,
    onNsfwMaskClick,
    refreshNsfwMaskHasPassword
  }
}
