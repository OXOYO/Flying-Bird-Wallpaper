<script setup>
import { ref, computed, onMounted, onBeforeUnmount, watch } from 'vue'

const videoSrc = ref('')
const videoElement = ref(null)
const isMuted = ref(true) // 默认静音
const frameRate = ref(30) // 默认帧率
const scaleMode = ref('cover') // 默认缩放模式
const brightness = ref(100) // 默认亮度
const contrast = ref(100) // 默认对比度
let rafId = null // requestAnimationFrame ID
let lastFrameTime = 0 // 上一帧时间

// 接收视频源
const handleSetVideoSource = (event, source) => {
  if (source) {
    // 将本地文件路径转换为 fbwtp 协议 URL
    if (!source.startsWith('fbwtp://') && !source.startsWith('http')) {
      // 替换反斜杠为正斜杠，并确保路径格式正确
      const formattedPath = source.replace(/\\/g, '/')
      videoSrc.value = `fbwtp://fbw/api/videos/get?filePath=${formattedPath}`
    } else {
      videoSrc.value = source
    }
  }
}

// 处理静音控制
const handleSetVideoMute = (event, mute) => {
  isMuted.value = mute
  if (videoElement.value) {
    videoElement.value.muted = mute
  }
}

// 处理帧率控制
const handleSetVideoFrameRate = (event, rate) => {
  frameRate.value = rate
}

// 控制视频播放帧率
const controlFrameRate = (timestamp) => {
  if (!videoElement.value) {
    rafId = requestAnimationFrame(controlFrameRate)
    return
  }

  const video = videoElement.value
  const frameInterval = 1000 / frameRate.value

  if (timestamp - lastFrameTime >= frameInterval) {
    // 如果视频暂停，则播放
    if (video.paused) {
      video.play()
    }

    lastFrameTime = timestamp
  } else {
    // 如果帧率需要限制，则暂停视频
    if (!video.paused) {
      video.pause()
    }
  }

  rafId = requestAnimationFrame(controlFrameRate)
}

// 处理缩放模式控制
const handleSetVideoScaleMode = (event, mode) => {
  scaleMode.value = mode
}

// 处理亮度控制
const handleSetVideoBrightness = (event, value) => {
  brightness.value = value
}

// 处理对比度控制
const handleSetVideoContrast = (event, value) => {
  contrast.value = value
}

// 计算滤镜样式
const filterStyle = computed(() => {
  return `brightness(${brightness.value / 100}) contrast(${contrast.value / 100})`
})

// 监听视频源变化
watch(videoSrc, (newSrc) => {
  if (newSrc) {
    // 重置帧率控制
    if (rafId) {
      cancelAnimationFrame(rafId)
    }
    lastFrameTime = 0
    rafId = requestAnimationFrame(controlFrameRate)
  }
})

// 监听事件注册和移除需要保持一致
onMounted(() => {
  // 监听设置视频源事件
  window.FBW.onSetVideoSource(handleSetVideoSource)
  window.FBW.onSetVideoMute(handleSetVideoMute)
  window.FBW.onSetVideoFrameRate(handleSetVideoFrameRate)
  window.FBW.onSetVideoScaleMode(handleSetVideoScaleMode)
  window.FBW.onSetVideoBrightness(handleSetVideoBrightness)
  window.FBW.onSetVideoContrast(handleSetVideoContrast)

  // 启动帧率控制
  rafId = requestAnimationFrame(controlFrameRate)
})

onBeforeUnmount(() => {
  // 移除监听，确保与注册方式一致
  window.FBW.offSetVideoSource(handleSetVideoSource)
  window.FBW.offSetVideoMute(handleSetVideoMute)
  window.FBW.offSetVideoFrameRate(handleSetVideoFrameRate)
  window.FBW.offSetVideoScaleMode(handleSetVideoScaleMode)
  window.FBW.offSetVideoBrightness(handleSetVideoBrightness)
  window.FBW.offSetVideoContrast(handleSetVideoContrast)

  // 取消帧率控制
  if (rafId) {
    cancelAnimationFrame(rafId)
  }
})
</script>

<template>
  <div class="dynamic-wallpaper">
    <video
      v-if="videoSrc"
      ref="videoElement"
      :src="videoSrc"
      autoplay
      loop
      :muted="isMuted"
      class="video-player"
      :style="{
        objectFit: scaleMode === 'stretch' ? 'fill' : scaleMode,
        filter: filterStyle
      }"
    ></video>
  </div>
</template>

<style scoped>
.dynamic-wallpaper {
  width: 100vw;
  height: 100vh;
  overflow: hidden;
  margin: 0;
  padding: 0;
  background-color: transparent;
}

.video-player {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
</style>
