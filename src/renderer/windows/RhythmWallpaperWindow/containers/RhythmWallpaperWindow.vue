<script setup>
import { Leafer } from 'leafer-ui'
import * as Effects from '../effects'

const leaferRef = ref(null)
let leafer, effectInstance, analyser, dataArray, source, audioContext, animationId

const config = ref({
  type: 'bar', // 可选 'bar' | 'wave' | 'ball' | 'disco'
  widthRatio: 1,
  heightRatio: 0.8,
  color: '#00ffcc',
  gradient: ['#00ffcc', '#ff00cc'],
  shadow: true,
  amplitude: 1 // 仅 wave 用
})

function switchEffect() {
  if (effectInstance) effectInstance.destroy()
  const typeName = config.value.type.charAt(0).toUpperCase() + config.value.type.slice(1) + 'Effect'
  console.log('typeName', typeName)
  const EffectClass = Effects[typeName]
  if (EffectClass) {
    effectInstance = new EffectClass(leafer, config.value)
  }
}

function draw() {
  if (!analyser || !effectInstance) return
  analyser.getByteFrequencyData(dataArray)
  effectInstance.render(dataArray)
  animationId = requestAnimationFrame(draw)
}

onMounted(async () => {
  leafer = new Leafer({ view: leaferRef.value, autoRender: true })
  audioContext = new (window.AudioContext || window.webkitAudioContext)()
  // 方案一
  // 获取所有音频输入设备
  const devices = await navigator.mediaDevices.enumerateDevices()
  const audioInputs = devices.filter((d) => d.kind === 'audioinput')
  console.log('audioInputs', audioInputs)
  // 查找虚拟声卡设备
  const virtualDevice = audioInputs.find(
    (d) => d.label.includes('VB-Audio') || d.label.includes('BlackHole')
  )
  console.log('virtualDevice', virtualDevice)
  // 用虚拟声卡 deviceId 采集音频
  if (virtualDevice) {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: { deviceId: virtualDevice.deviceId }
    })
    source = audioContext.createMediaStreamSource(stream)
    analyser = audioContext.createAnalyser()
    analyser.fftSize = 256
    dataArray = new Uint8Array(analyser.frequencyBinCount)
    source.connect(analyser)
    switchEffect()
    draw()
  } else {
    console.log('请先安装并切换系统音频输出到虚拟声卡（如 VB-Audio/BlackHole）')
  }

  // 方案二
  // navigator.mediaDevices
  //   .getUserMedia({
  //     audio: true
  //     // audio: {
  //     //   mandatory: { chromeMediaSource: 'desktop' }
  //     // },
  //     // video: {
  //     //   mandatory: { chromeMediaSource: 'desktop' }
  //     // }
  //   })
  //   .then((stream) => {
  //     const hasAudio = stream.getAudioTracks().length > 0
  //     console.log('音频轨道数量:', hasAudio)
  //     source = audioContext.createMediaStreamSource(stream)
  //     analyser = audioContext.createAnalyser()
  //     analyser.fftSize = 256
  //     dataArray = new Uint8Array(analyser.frequencyBinCount)
  //     source.connect(analyser)
  //     switchEffect()
  //     draw()
  //   })
})

watch(
  () => config.value.type,
  () => {
    switchEffect()
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
  <div ref="leaferRef" style="width: 100vw; height: 100vh; background: #000"></div>
</template>
