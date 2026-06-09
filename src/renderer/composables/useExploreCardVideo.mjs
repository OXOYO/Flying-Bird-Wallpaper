import { reactive, ref } from 'vue'
import { isVideoDefaultMuted } from '@common/publicData.js'

/**
 * 浏览卡片内联视频：hover 自动播放、手动互斥、静音状态（ExploreCommon / ResourceExploreCard 共用）
 * @param {object} options
 * @param {() => Array} options.getList
 * @param {() => object} options.getSettingData
 * @param {(item: object) => boolean} [options.isActionBlocked]
 * @param {() => void} [options.notifyBlocked]
 * @param {(key: string, params?: object) => string} [options.t]
 */
export function useExploreCardVideo(options = {}) {
  const { getList, getSettingData, isActionBlocked, notifyBlocked, t } = options

  const videoRefs = ref([])
  const videoMutedByIndex = reactive({})
  const playSources = new Map()
  let isUnmounting = false

  const getVideoErrorMessage = (errorCode) => {
    if (!t) return String(errorCode ?? '?')
    const keyByCode = {
      1: 'messages.videoErrAborted',
      2: 'messages.videoErrNetwork',
      3: 'messages.videoErrDecode',
      4: 'messages.videoErrUnsupported'
    }
    const key = keyByCode[errorCode]
    return key ? t(key) : t('messages.videoErrUnknown', { code: errorCode ?? '?' })
  }

  const bindVideoRef = (index) => (el) => {
    if (el) {
      videoRefs.value[index] = el
    } else if (videoRefs.value[index]) {
      delete videoRefs.value[index]
    }
  }

  const syncVideoMuteState = (index) => {
    const video = videoRefs.value[index]
    if (video && index >= 0) videoMutedByIndex[index] = video.muted
  }

  const isVideoMutedAt = (index) => {
    if (Object.prototype.hasOwnProperty.call(videoMutedByIndex, index)) {
      return !!videoMutedByIndex[index]
    }
    const video = videoRefs.value[index]
    return video?.muted ?? isVideoDefaultMuted(getSettingData?.())
  }

  const toggleVideoMute = (item, index) => {
    if (isActionBlocked?.(item)) {
      notifyBlocked?.()
      return
    }
    const list = getList?.() || []
    const video = videoRefs.value[index]
    if (!video || !list[index]?.isPlaying) return
    video.muted = !video.muted
    videoMutedByIndex[index] = video.muted
  }

  const onVideoPlaying = (index) => {
    syncVideoMuteState(index)
  }

  const onVideoMouseEnter = (item, index) => {
    const video = videoRefs.value[index]
    if (!video || !video.paused) return

    const playSource = playSources.get(item.uniqueKey)
    if (playSource === 'manual') return

    const list = getList?.() || []
    try {
      if (list[index]) list[index].isPlaying = true
      video.muted = isVideoDefaultMuted(getSettingData?.())
      syncVideoMuteState(index)
      playSources.set(item.uniqueKey, 'auto')

      const playPromise = video.play()
      if (playPromise !== undefined) {
        playPromise.catch((err) => {
          if (err.name !== 'AbortError') {
            console.error('Video auto play error:', err)
            if (list[index]) list[index].isPlaying = false
            playSources.delete(item.uniqueKey)
          }
        })
      }
    } catch (err) {
      console.error('Video auto play error:', err)
      if (list[index]) list[index].isPlaying = false
      playSources.delete(item.uniqueKey)
    }
  }

  const onVideoMouseLeave = (item, index) => {
    const video = videoRefs.value[index]
    if (!video) return

    const playSource = playSources.get(item.uniqueKey)
    if (playSource === 'manual' && video.paused) {
      playSources.delete(item.uniqueKey)
      return
    }
    if (playSource === 'manual') return

    const list = getList?.() || []
    if (playSource === 'auto' && !video.paused) {
      try {
        if (list[index]) list[index].isPlaying = false
        video.pause()
        playSources.delete(item.uniqueKey)
      } catch (err) {
        console.error('Video auto pause error:', err)
      }
    }
  }

  const toggleVideo = (item, index) => {
    if (isActionBlocked?.(item)) {
      notifyBlocked?.()
      return
    }
    const video = videoRefs.value[index]
    if (!video) return
    const list = getList?.() || []

    try {
      if (video.paused) {
        for (let i = 0; i < videoRefs.value.length; i++) {
          const otherVideo = videoRefs.value[i]
          if (otherVideo && otherVideo !== video && !otherVideo.paused) {
            otherVideo.pause()
            if (list[i]) {
              list[i].isPlaying = false
              playSources.delete(list[i].uniqueKey)
            }
          }
        }

        if (list[index]) list[index].isPlaying = true
        video.muted = isVideoDefaultMuted(getSettingData?.())
        syncVideoMuteState(index)
        playSources.set(item.uniqueKey, 'manual')

        const playPromise = video.play()
        if (playPromise !== undefined) {
          playPromise.catch((err) => {
            if (err.name !== 'AbortError') {
              console.error('Video play error:', err)
              if (list[index]) list[index].isPlaying = false
              playSources.delete(item.uniqueKey)
            }
          })
        }
      } else {
        if (list[index]) list[index].isPlaying = false
        video.pause()
        playSources.set(item.uniqueKey, 'manual')
      }
    } catch (err) {
      console.error('Video play error:', err)
      if (list[index]) list[index].isPlaying = false
      playSources.delete(item.uniqueKey)
    }
  }

  const pauseInlineVideo = (item, index) => {
    const video = videoRefs.value[index]
    const list = getList?.() || []
    if (video && !video.paused) {
      video.pause()
      if (list[index]) list[index].isPlaying = false
      playSources.delete(item.uniqueKey)
    }
  }

  const onVideoEnded = (item, index) => {
    const video = videoRefs.value[index]
    if (!video) return
    const list = getList?.() || []

    video.currentTime = 0
    if (list[index]?.isPlaying) list[index].isPlaying = false
    delete videoMutedByIndex[index]
    playSources.delete(item.uniqueKey)
  }

  const onVideoError = (item, index, event) => {
    if (isUnmounting) return

    const video = event?.target ?? videoRefs.value[index]
    if (!video) return

    const errorCode = video.error?.code
    if (errorCode === 1) return

    const errorMessage = getVideoErrorMessage(errorCode)
    console.error('Video Error Details:', {
      errorCode,
      errorMessage,
      videoSrc: video.src,
      item,
      index
    })
    if (t) {
      ElMessage({ type: 'error', message: errorMessage })
    }

    video.currentTime = 0
    const list = getList?.() || []
    if (list[index]?.isPlaying) list[index].isPlaying = false
    playSources.delete(item.uniqueKey)
  }

  const setUnmounting = (value) => {
    isUnmounting = !!value
  }

  const cleanupVideos = () => {
    videoRefs.value.forEach((video) => {
      if (video) {
        video.onerror = null
        video.pause()
        video.removeAttribute('src')
        video.load()
      }
    })
    videoRefs.value = []
    playSources.clear()
  }

  return {
    bindVideoRef,
    isVideoMutedAt,
    toggleVideoMute,
    onVideoPlaying,
    onVideoMouseEnter,
    onVideoMouseLeave,
    toggleVideo,
    pauseInlineVideo,
    onVideoEnded,
    onVideoError,
    setUnmounting,
    cleanupVideos
  }
}
