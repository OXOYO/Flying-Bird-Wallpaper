<script setup>
import * as Effects from '../effects'
import { createRhythmAudio } from '../utils/rhythmAudio.js'
import { resolveRhythmEffect } from '../utils/resolveRhythmEffect.js'
import { isLightColor } from '../utils/stageUtils.js'
import UseCommonStore from '@renderer/stores/commonStore'
import UseSettingStore from '@renderer/stores/settingStore'
import { useTranslation } from 'i18next-vue'

const { t } = useTranslation()

const commonStore = UseCommonStore()
const { commonData } = storeToRefs(commonStore)

const settingStore = UseSettingStore()
const { settingData } = storeToRefs(settingStore)

const containerRef = ref(null)
let effectInstance, rhythmAudio, source, audioContext, animationId

const config = computed(() => {
  const wallpaperColor =
    settingData.value.colorWallpaperVal || settingData.value.dynamicBackgroundColor || '#999999'
  return {
    effect: resolveRhythmEffect(settingData.value.rhythmEffect),
    widthRatio: settingData.value.rhythmWidthRatio / 100,
    heightRatio: settingData.value.rhythmHeightRatio / 100,
    colors: toRaw(settingData.value.rhythmColors),
    animation: settingData.value.rhythmAnimation,
    density: settingData.value.rhythmDensity,
    position: settingData.value.rhythmPosition,
    sampleRange: settingData.value.rhythmSampleRange,
    desktopInset: commonData.value?.desktopInset || {
      top: 0,
      bottom: 0,
      left: 0,
      right: 0
    },
    lightBackground: isLightColor(wallpaperColor),
    shadow: true,
    debug: !!commonData.value?.isDev
  }
})

// 判断是否为Three.js效果
const isThreeEffect = computed(() => {
  const effectName = config.value.effect
  return effectName.startsWith('Three')
})

const init = async () => {
  // 销毁当前效果实例
  destroyEffect()

  audioContext = new (window.AudioContext || window.webkitAudioContext)()
  // 获取所有音频输入设备
  const devices = await navigator.mediaDevices.enumerateDevices()
  const audioInputs = devices.filter((d) => d.kind === 'audioinput')

  // 查找虚拟声卡设备
  // 定义设备优先级
  const devicePriority = [
    'vb-audio',
    'blackhole',
    'stereo mix',
    '立体声混音',
    'virtual audio cable',
    'voicemeeter',
    'loopback',
    'soundflower',
    'jack audio',
    'pulseaudio monitor',
    'alsa loopback'
  ]

  // 首先找到所有匹配的设备
  const matchingDevices = audioInputs.filter((d) => {
    const lowerLabel = d.label?.toLowerCase() || ''
    return devicePriority.some((priority) => lowerLabel.includes(priority))
  })

  // 按照优先级排序匹配的设备
  if (matchingDevices.length > 1) {
    matchingDevices.sort((a, b) => {
      const aLabel = a.label?.toLowerCase() || ''
      const bLabel = b.label?.toLowerCase() || ''
      const aPriority = devicePriority.findIndex((priority) => aLabel.includes(priority))
      const bPriority = devicePriority.findIndex((priority) => bLabel.includes(priority))
      return aPriority - bPriority
    })
  }
  // 递归尝试使用设备
  const tryDevice = async (devices, index = 0) => {
    if (index >= devices.length) {
      // 所有设备都尝试过了，发送系统通知
      window.FBW.sendNotification({
        title: t('appInfo.appName'),
        body: t('messages.rhythmWallpaperNeedVirtualAudio'),
        silent: false
      })
      return
    }

    const device = devices[index]
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { deviceId: device.deviceId }
      })
      source = audioContext.createMediaStreamSource(stream)
      rhythmAudio = createRhythmAudio(audioContext, source)
      runEffect()
    } catch (error) {
      console.error(`虚拟声卡设备 ${device.label} 不可用:`, error)
      // 尝试下一个设备
      await tryDevice(devices, index + 1)
    }
  }

  // 用虚拟声卡 deviceId 采集音频
  if (matchingDevices.length > 0) {
    await tryDevice(matchingDevices)
  } else {
    // 发送系统通知
    window.FBW.sendNotification({
      title: t('appInfo.appName'),
      body: t('messages.rhythmWallpaperNeedVirtualAudio'),
      silent: false
    })
  }
}

const destroyEffect = () => {
  try {
    if (effectInstance) {
      effectInstance.destroy()
      effectInstance = null
    }
  } catch (error) {
    console.error('RhythmWallpaperWindow: Error destroying effect instance:', error)
  }
}

const runEffect = async () => {
  // 停止当前的动画循环
  if (animationId) {
    cancelAnimationFrame(animationId)
    animationId = null
  }

  // 清理容器中的所有子元素（仅对Three.js效果需要）
  if (containerRef.value && isThreeEffect.value) {
    while (containerRef.value.firstChild) {
      containerRef.value.removeChild(containerRef.value.firstChild)
    }
  }

  const EffectClass = Effects[config.value.effect]

  if (EffectClass) {
    try {
      effectInstance = new EffectClass(containerRef.value, toRaw(config.value))
      if (!animationId) {
        draw()
      }
    } catch (error) {
      console.error('RhythmWallpaperWindow: Error creating effect instance:', error)
    }
  } else {
    console.warn('RhythmWallpaperWindow: Effect class not found:', config.value.effect)
  }
}

const draw = () => {
  if (!effectInstance) {
    return
  }

  try {
    const frame = rhythmAudio?.getFrame(config.value.sampleRange)
    if (isThreeEffect.value) {
      effectInstance.render(frame || {})
    } else if (frame?.spectrum?.length > 0) {
      effectInstance.render(frame.spectrum)
    }

    animationId = requestAnimationFrame(draw)
  } catch (error) {
    console.error('RhythmWallpaperWindow: Error in draw loop:', error)
    animationId = requestAnimationFrame(draw)
  }
}

onMounted(() => {
  init()
})

watch(
  () => [
    settingData.value.rhythmEffect,
    settingData.value.rhythmWidthRatio,
    settingData.value.rhythmHeightRatio,
    settingData.value.rhythmPosition,
    settingData.value.rhythmColors,
    settingData.value.rhythmAnimation,
    settingData.value.rhythmDensity,
    settingData.value.rhythmPosition,
    settingData.value.rhythmSampleRange,
    settingData.value.colorWallpaperVal,
    settingData.value.dynamicBackgroundColor,
    commonData.value?.desktopInset
  ],
  async () => {
    destroyEffect()
    await runEffect()
  },
  {
    deep: true,
    immediate: false // 改为false，避免在初始化时重复调用
  }
)

onBeforeUnmount(() => {
  if (animationId) cancelAnimationFrame(animationId)
  if (rhythmAudio) {
    rhythmAudio.destroy()
    rhythmAudio = null
  }
  if (audioContext) audioContext.close()
  destroyEffect()
})
</script>

<template>
  <!-- 统一容器 - 用于所有效果；Three 舞台用黑底避免全屏截图里露出桌面灰边 -->
  <div
    ref="containerRef"
    class="rhythm-root"
    :class="{ 'rhythm-root--three': isThreeEffect }"
    :style="{
      width: '100vw',
      height: '100vh',
      position: 'relative',
      background: isThreeEffect ? '#000' : 'transparent'
    }"
  ></div>
</template>

<style>
html,
body,
#app,
.common-app {
  margin: 0;
  padding: 0;
  width: 100%;
  height: 100%;
}

.rhythm-root--three {
  background: #000 !important;
}
</style>
