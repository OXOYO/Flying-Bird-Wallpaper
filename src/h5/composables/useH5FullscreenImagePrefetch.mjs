import { onUnmounted, watch } from 'vue'
import {
  FULLSCREEN_MOUNT_RANGE,
  FULLSCREEN_PREFETCH_AHEAD_SLOW,
  FullscreenImagePrefetch,
  resolvePrefetchAhead
} from '@h5/utils/FullscreenImagePrefetch.mjs'

const CURRENT_SETTLE_TIMEOUT_MS = 8000

/**
 * H5 铺满：上屏仍 ±1，后台 Image() 预取（与鸿蒙 FullscreenImagePrefetch 同策略）
 * @param {{
 *   list: import('vue').Ref<any[]>
 *   currentIndex: import('vue').Ref<number>
 *   displayMode: import('vue').Ref<string>
 *   getImageSrc: (item: any) => string
 *   isVideoItem?: (item: any) => boolean
 *   compressEnabled?: import('vue').Ref<boolean> | import('vue').ComputedRef<boolean>
 *   getItemKey?: (item: any) => string
 * }} options
 */
export function useH5FullscreenImagePrefetch(options) {
  const {
    list,
    currentIndex,
    displayMode,
    getImageSrc,
    isVideoItem = (item) => item?.fileType === 'video',
    compressEnabled = null,
    getItemKey = (item) => item?.id || item?.imageSrc || ''
  } = options

  const prefetch = new FullscreenImagePrefetch()
  const settledIndexes = new Set()
  let lastIndexChangeAt = 0
  let prefetchAhead = FULLSCREEN_PREFETCH_AHEAD_SLOW
  let settleTimerId = 0
  let prevIndex = currentIndex.value

  const clearSettleTimer = () => {
    if (settleTimerId) {
      clearTimeout(settleTimerId)
      settleTimerId = 0
    }
  }

  const buildPrefetchUrls = () => {
    const items = list.value || []
    const urls = []
    for (let i = 0; i < items.length; i++) {
      const item = items[i]
      if (!item || isVideoItem(item)) {
        urls.push('')
        continue
      }
      urls.push(getImageSrc(item) || '')
    }
    return urls
  }

  const onCurrentMediaSettled = () => {
    clearSettleTimer()
    settledIndexes.add(currentIndex.value)
    prefetch.notifyCurrentLoaded()
  }

  const armSettleTimeout = () => {
    clearSettleTimer()
    settleTimerId = setTimeout(() => {
      settleTimerId = 0
      onCurrentMediaSettled()
    }, CURRENT_SETTLE_TIMEOUT_MS)
  }

  const syncPrefetchWindow = (hard) => {
    if (displayMode.value !== 'fullscreen') {
      prefetch.cancel()
      clearSettleTimer()
      return
    }
    const urls = buildPrefetchUrls()
    const idx = currentIndex.value
    if (hard) {
      prefetch.hardReset(urls, idx, prefetchAhead)
    } else {
      prefetch.updateWindow(urls, idx, prefetchAhead)
    }

    const cur = list.value?.[idx]
    if (!cur || isVideoItem(cur) || !getImageSrc(cur)) {
      onCurrentMediaSettled()
      return
    }
    if (settledIndexes.has(idx)) {
      onCurrentMediaSettled()
      return
    }
    prefetch.notifyAllowNextOnly()
    armSettleTimeout()
  }

  const noteIndexChange = (from, to) => {
    const now = Date.now()
    const interval = lastIndexChangeAt > 0 ? now - lastIndexChangeAt : 99999
    lastIndexChangeAt = now
    prefetchAhead = resolvePrefetchAhead(interval, to - from)
  }

  const shouldLoadFullscreenImage = (index) => {
    if (displayMode.value !== 'fullscreen') return false
    const cur = currentIndex.value
    if (typeof index !== 'number' || index < 0) return false
    return Math.abs(index - cur) <= FULLSCREEN_MOUNT_RANGE
  }

  /** 当前可见张 load/error 后放开整窗预取 */
  const notifyFullscreenImageSettled = (item) => {
    if (displayMode.value !== 'fullscreen') return
    const items = list.value || []
    const idx = items.indexOf(item)
    const resolved =
      idx >= 0
        ? idx
        : items.findIndex((row) => getItemKey(row) && getItemKey(row) === getItemKey(item))
    if (resolved < 0) return
    settledIndexes.add(resolved)
    if (resolved === currentIndex.value) {
      onCurrentMediaSettled()
    }
  }

  const cancelFullscreenPrefetch = () => {
    clearSettleTimer()
    settledIndexes.clear()
    lastIndexChangeAt = 0
    prefetchAhead = FULLSCREEN_PREFETCH_AHEAD_SLOW
    prefetch.cancel()
  }

  watch(
    currentIndex,
    (next) => {
      const from = prevIndex
      prevIndex = next
      if (displayMode.value !== 'fullscreen') return
      if (from !== next) {
        noteIndexChange(from, next)
      }
      syncPrefetchWindow(false)
    }
  )

  watch(
    () => list.value?.length ?? 0,
    (len, prevLen) => {
      if (displayMode.value !== 'fullscreen') return
      const hard = !prevLen || len < prevLen
      if (hard) {
        settledIndexes.clear()
        lastIndexChangeAt = 0
        prefetchAhead = FULLSCREEN_PREFETCH_AHEAD_SLOW
      }
      syncPrefetchWindow(hard)
    }
  )

  watch(
    () => {
      const first = list.value?.[0]
      return first ? getItemKey(first) : ''
    },
    (key, prevKey) => {
      if (displayMode.value !== 'fullscreen') return
      if (!prevKey || key === prevKey) return
      settledIndexes.clear()
      lastIndexChangeAt = 0
      prefetchAhead = FULLSCREEN_PREFETCH_AHEAD_SLOW
      syncPrefetchWindow(true)
    }
  )

  watch(displayMode, (mode, prev) => {
    if (mode === 'fullscreen') {
      settledIndexes.clear()
      lastIndexChangeAt = 0
      prefetchAhead = FULLSCREEN_PREFETCH_AHEAD_SLOW
      prevIndex = currentIndex.value
      syncPrefetchWindow(true)
      return
    }
    if (prev === 'fullscreen') {
      cancelFullscreenPrefetch()
    }
  })

  if (compressEnabled) {
    watch(compressEnabled, () => {
      if (displayMode.value !== 'fullscreen') return
      settledIndexes.clear()
      syncPrefetchWindow(true)
    })
  }

  onUnmounted(() => {
    cancelFullscreenPrefetch()
  })

  // 首次若已是铺满，启动预取
  if (displayMode.value === 'fullscreen') {
    syncPrefetchWindow(true)
  }

  return {
    shouldLoadFullscreenImage,
    notifyFullscreenImageSettled,
    cancelFullscreenPrefetch,
    FULLSCREEN_MOUNT_RANGE
  }
}
