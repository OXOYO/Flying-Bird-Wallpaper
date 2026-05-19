/**
 * 铺满模式自动翻页（仅会话态，不写 settingData / 数据库）
 */
export function useH5FullscreenAutoPlay({
  getPagerRef,
  getCurrentIndex,
  setCurrentIndex,
  getListLength,
  getFinished,
  getLoading,
  onLoadMore,
  isCurrentVideo,
  isPlaybackAllowed
}) {
  const autoPlayOn = ref(false)
  const intervalSec = ref(3)
  const countdown = ref(3)
  const intervalOptions = ref([3, 6, 9, 12])

  let switchTimer = null
  let countdownTimer = null
  /** 程序翻页中：避免滚动中间态触发「用户滑动则停止」 */
  let advancing = false

  const stopCountdown = () => {
    if (countdownTimer) {
      clearInterval(countdownTimer)
      countdownTimer = null
    }
  }

  const startCountdown = () => {
    stopCountdown()
    countdown.value = intervalSec.value
    countdownTimer = setInterval(() => {
      if (countdown.value > 0) {
        countdown.value -= 1
      } else {
        stopCountdown()
      }
    }, 1000)
  }

  const stop = () => {
    autoPlayOn.value = false
    if (switchTimer) {
      clearInterval(switchTimer)
      switchTimer = null
    }
    stopCountdown()
  }

  const advance = async () => {
    const len = getListLength()
    if (!len) return
    const idx = getCurrentIndex()
    const pager = getPagerRef()
    advancing = true
    try {
      if (idx < len - 1) {
        const next = idx + 1
        setCurrentIndex(next)
        await pager?.scrollToIndex?.(next)
        countdown.value = intervalSec.value
        startCountdown()
        if (next >= len - 3 && !getFinished() && !getLoading()) {
          stopCountdown()
          await onLoadMore?.()
          startCountdown()
        }
        return
      }
      if (!getFinished()) {
        stopCountdown()
        await onLoadMore?.()
        const lenAfter = getListLength()
        if (idx < lenAfter - 1) {
          const next = idx + 1
          setCurrentIndex(next)
          await pager?.scrollToIndex?.(next)
          countdown.value = intervalSec.value
          startCountdown()
        } else {
          startCountdown()
        }
        return
      }
      stop()
    } finally {
      advancing = false
    }
  }

  const start = () => {
    if (!isPlaybackAllowed?.()) return
    if (isCurrentVideo?.()) return
    const len = getListLength()
    if (!len) return
    if (getCurrentIndex() >= len - 1 && getFinished()) {
      return
    }
    autoPlayOn.value = true
    countdown.value = intervalSec.value
    startCountdown()
    if (switchTimer) clearInterval(switchTimer)
    switchTimer = setInterval(() => {
      void advance()
    }, intervalSec.value * 1000)
  }

  const toggle = () => {
    if (autoPlayOn.value) {
      stop()
    } else {
      start()
    }
  }

  const cycleInterval = () => {
    const list = intervalOptions.value
    const cur = intervalSec.value
    let idx = list.indexOf(cur)
    if (idx < 0) {
      intervalOptions.value = [...list, cur].sort((a, b) => a - b)
      idx = intervalOptions.value.indexOf(cur)
    }
    const next = intervalOptions.value[(idx + 1) % intervalOptions.value.length]
    intervalSec.value = next
    countdown.value = next
    if (autoPlayOn.value) {
      stop()
      start()
    }
  }

  watch(
    () => isCurrentVideo?.(),
    (video) => {
      if (video && autoPlayOn.value) stop()
    }
  )

  watch(
    () => isPlaybackAllowed?.(),
    (ok) => {
      if (!ok && autoPlayOn.value) stop()
    }
  )

  onBeforeUnmount(() => {
    stop()
  })

  const isAdvancing = () => advancing

  return {
    autoPlayOn,
    intervalSec,
    countdown,
    toggle,
    cycleInterval,
    stop,
    start,
    isAdvancing
  }
}
