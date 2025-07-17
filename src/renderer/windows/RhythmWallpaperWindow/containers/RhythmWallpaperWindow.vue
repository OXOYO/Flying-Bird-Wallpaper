<script setup>
import { Leafer } from 'leafer-ui'
import * as Effects from '../effects'

const leaferRef = ref(null)
let leafer, effectInstance, analyser, dataArray, source, audioContext, animationId

// 配置对象，按类型分组
const config = ref({
  rhythmEffect: 'rainbow', // 当前可视化类型，可选值：
  // 'bar'（柱状）、'wave'（波形）、'ball'（小球）、'disco'（迪斯科）、
  // 'spectrumRing'（频谱环）、'particleFountain'（粒子喷泉）、'breathingHalo'（呼吸光圈）、'dynamicGrid'（动态网格）、
  // 'flowingLines'（流动线条）、'musicNoteRain'（音符雨）、'rotatingStarburst'（旋转星芒）、'bars3D'（3D柱状）、
  // 'liquidRipple'（液体波纹）、'spectrumFlower'（频谱花朵）、'rainbow'（彩虹）
  widthRatio: 1,
  heightRatio: 0.3,
  color: '#00ffcc',
  gradient: [
    '#ff3cac',
    '#784ba0',
    '#2b86c5',
    '#42e695',
    '#ffb347',
    '#ffcc33',
    '#f7971e',
    '#ffd200',
    '#f44369',
    '#43cea2',
    '#185a9d',
    '#f857a6'
  ],
  shadow: true,
  renderType: 'parabola', // 柱高/波形等数值的映射类型，可选：
  // 'linear'（线性）、'log'（对数）、'parabola'（抛物线）、'sqrt'（平方根，柔和）、
  // 'exp'（指数，爆发感）、'sin'（正弦，弹性）、'bounce'（弹跳回弹）、'step'（阶梯/像素跳跃）
  // 数量密集程度：可选：'sparse' (稀疏) | 'normal' (正常) | 'dense' (密集)
  densityType: 'normal'
})

function switchEffect() {
  if (effectInstance) effectInstance.destroy()
  const effectName =
    config.value.rhythmEffect.charAt(0).toUpperCase() +
    config.value.rhythmEffect.slice(1) +
    'Effect'
  const EffectClass = Effects[effectName]
  if (EffectClass) {
    // 只传递当前类型的配置
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
  () => config.value.rhythmEffect,
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
  <div ref="leaferRef" style="width: 100vw; height: 100vh; background: transparent"></div>
</template>
