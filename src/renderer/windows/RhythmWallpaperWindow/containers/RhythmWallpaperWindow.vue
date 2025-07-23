<script setup>
import { Leafer } from 'leafer-ui'
import * as Effects from '../effects'
import UseSettingStore from '@renderer/stores/settingStore'

const settingStore = UseSettingStore()
const { settingData } = storeToRefs(settingStore)

const leaferRef = ref(null)
let leafer, effectInstance, analyser, dataArray, source, audioContext, animationId

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
    shadow: true
  }
})

const init = async () => {
  leafer = new Leafer({ view: leaferRef.value, autoRender: true })
  audioContext = new (window.AudioContext || window.webkitAudioContext)()
  // 获取所有音频输入设备
  const devices = await navigator.mediaDevices.enumerateDevices()
  const audioInputs = devices.filter((d) => d.kind === 'audioinput')
  // console.log('audioInputs', audioInputs)
  // 查找虚拟声卡设备
  const virtualDevice = audioInputs.find(
    (d) =>
      d.label.includes('VB-Audio') ||
      d.label.includes('BlackHole') ||
      d.label.includes('立体声混音') || // 新增
      d.label.toLowerCase().includes('stereo mix') // 英文系统
  )
  // console.log('virtualDevice', virtualDevice)
  // 用虚拟声卡 deviceId 采集音频
  if (virtualDevice) {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: { deviceId: virtualDevice.deviceId }
    })
    source = audioContext.createMediaStreamSource(stream)
    analyser = audioContext.createAnalyser()
    analyser.fftSize = 2048
    dataArray = new Uint8Array(analyser.frequencyBinCount)
    source.connect(analyser)
    runEffect()
  } else {
    console.log('请先安装并切换系统音频输出到虚拟声卡（如 VB-Audio/BlackHole）')
  }
}

function runEffect() {
  if (!leafer) {
    return
  }
  if (effectInstance) {
    effectInstance.destroy()
  }
  const effectName =
    config.value.effect.charAt(0).toUpperCase() + config.value.effect.slice(1) + 'Effect'
  const EffectClass = Effects[effectName]
  if (EffectClass) {
    // 只传递当前类型的配置
    effectInstance = new EffectClass(leafer, toRaw(config.value))

    draw()
  }
}

function draw() {
  if (!analyser || !effectInstance) {
    return
  }
  analyser.getByteFrequencyData(dataArray)
  // 采样范围
  const [start, end] = config.value.sampleRange
  const startIndex = Math.floor((start * dataArray.length) / 100)
  const endIndex = Math.floor((end * dataArray.length) / 100)
  effectInstance.render(dataArray.slice(startIndex, endIndex))
  animationId = requestAnimationFrame(draw)
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
  () => {
    runEffect()
  },
  {
    deep: true,
    immediate: true
  }
)

onBeforeUnmount(() => {
  if (animationId) cancelAnimationFrame(animationId)
  if (audioContext) audioContext.close()
  leafer?.destroy()
  effectInstance?.destroy()
})
</script>

<template>
  <div ref="leaferRef" style="width: 100vw; height: 100vh; background: transparent"></div>
</template>
