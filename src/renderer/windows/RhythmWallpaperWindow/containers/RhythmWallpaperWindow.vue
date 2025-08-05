<script setup>
import * as Effects from '../effects'
import UseSettingStore from '@renderer/stores/settingStore'
import { useTranslation } from 'i18next-vue'

const { t } = useTranslation()

const settingStore = UseSettingStore()
const { settingData } = storeToRefs(settingStore)

const containerRef = ref(null)
let effectInstance, analyser, dataArray, source, audioContext, animationId

const config = computed(() => {
  return {
    effect: settingData.value.rhythmEffect,
    widthRatio: settingData.value.rhythmWidthRatio / 100,
    heightRatio: settingData.value.rhythmHeightRatio / 100,
    colors: toRaw(settingData.value.rhythmColors),
    animation: settingData.value.rhythmAnimation,
    density: settingData.value.rhythmDensity,
    position: settingData.value.rhythmPosition,
    sampleRange: settingData.value.rhythmSampleRange,
    shadow: true,
    debug: true
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
  const virtualDevice = audioInputs.find(
    (d) =>
      d.label.includes('VB-Audio') ||
      d.label.includes('BlackHole') ||
      d.label.includes('立体声混音') || // 新增
      d.label.toLowerCase().includes('stereo mix') // 英文系统
  )
  console.log('RhythmWallpaperWindow: Virtual device found:', virtualDevice)

  // 用虚拟声卡 deviceId 采集音频
  if (virtualDevice) {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: { deviceId: virtualDevice.deviceId }
    })
    source = audioContext.createMediaStreamSource(stream)
    analyser = audioContext.createAnalyser()
    analyser.fftSize = 1024
    dataArray = new Uint8Array(analyser.frequencyBinCount)
    source.connect(analyser)
    // 执行效果
    runEffect()
  } else {
    // console.log('请先安装并切换系统音频输出到虚拟声卡（如 VB-Audio/BlackHole）')
    // 发送系统通知
    window.FBW.sendNotification({
      title: t('appInfo.name'),
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
      console.log('RhythmWallpaperWindow destroyEffect successfully')
    } else {
      console.log('RhythmWallpaperWindow destroyEffect not need')
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
  // if (containerRef.value && isThreeEffect.value) {
  //   while (containerRef.value.firstChild) {
  //     containerRef.value.removeChild(containerRef.value.firstChild)
  //   }
  // }

  const EffectClass = Effects[config.value.effect]

  if (EffectClass) {
    try {
      effectInstance = new EffectClass(containerRef.value, toRaw(config.value))
      draw()
    } catch (error) {
      console.error('RhythmWallpaperWindow: Error creating effect instance:', error)
    }
  } else {
    console.warn('RhythmWallpaperWindow: Effect class not found:', config.value.effect)
  }
}

const draw = () => {
  if (!analyser || !effectInstance) {
    return
  }

  try {
    analyser.getByteFrequencyData(dataArray)
    // 采样范围
    const [start, end] = config.value.sampleRange
    const startIndex = Math.floor((start * dataArray.length) / 100)
    const endIndex = Math.floor((end * dataArray.length) / 100)

    // 确保数据有效
    if (dataArray && dataArray.length > 0) {
      const audioData = dataArray.slice(startIndex, endIndex)
      effectInstance.render(audioData)
    }

    animationId = requestAnimationFrame(draw)
  } catch (error) {
    console.error('RhythmWallpaperWindow: Error in draw loop:', error)
    // 继续动画循环，避免完全停止
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
    settingData.value.rhythmColors,
    settingData.value.rhythmAnimation,
    settingData.value.rhythmDensity,
    settingData.value.rhythmPosition,
    settingData.value.rhythmSampleRange
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
  if (audioContext) audioContext.close()
  destroyEffect()
})
</script>

<template>
  <!-- 统一容器 - 用于所有效果 -->
  <div
    ref="containerRef"
    style="width: 100vw; height: 100vh; background: transparent; position: relative"
  ></div>
</template>
