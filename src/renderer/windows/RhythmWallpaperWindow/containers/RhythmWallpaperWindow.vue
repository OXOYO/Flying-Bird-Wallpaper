<script setup>
import { Leafer } from 'leafer-ui'
import * as Effects from '../effects'

const leaferRef = ref(null)
let leafer, effectInstance, analyser, dataArray, source, audioContext, animationId

// 配置对象，按类型分组
const config = ref({
  type: 'bar', // 当前可视化类型，可选值：'bar'（柱状）、'wave'（波形）、'ball'（小球）、'disco'（迪斯科）
  bar: {
    widthRatio: 1, // 柱状图宽度占画布宽度的比例，范围 0~1
    heightRatio: 0.3, // 柱状图最大高度占画布高度的比例，范围 0~1
    color: '#00ffcc', // 柱子默认颜色，未设置渐变时生效，支持任意合法 CSS 颜色
    gradient: ['#00ffcc', '#ff00cc'], // 柱子渐变色数组，支持多色渐变，数组元素为合法 CSS 颜色
    shadow: true, // 是否显示柱子阴影，可选值：true（显示）、false（不显示）
    renderType: 'parabola' // 柱子高度映射类型，可选值：'linear'（线性）、'log'（对数）、'parabola'（抛物线）
  },
  wave: {
    amplitude: 1, // 波形幅度，数值越大波动越大，建议范围 0~2
    widthRatio: 1, // 波形宽度占画布宽度的比例，范围 0~1，1为铺满
    heightRatio: 0.3, // 波形最大高度占画布高度的比例，范围 0~1
    color: '#00ffcc', // 波形颜色
    gradient: ['#00ffcc', '#ff00cc'], // 渐变色
    shadow: true, // 是否显示阴影
    renderType: 'parabola' // 可选 'linear' | 'log' | 'parabola'
  },
  ball: {
    color: '#00ffcc', // 小球颜色，支持任意合法 CSS 颜色
    shadow: true // 是否显示小球阴影，可选值：true、false
    // ...可扩展 ball 专属配置
  },
  disco: {
    color: '#00ffcc', // 迪斯科效果颜色，支持任意合法 CSS 颜色
    shadow: true // 是否显示阴影，可选值：true、false
    // ...可扩展 disco 专属配置
  }
})

function switchEffect() {
  if (effectInstance) effectInstance.destroy()
  const typeName = config.value.type.charAt(0).toUpperCase() + config.value.type.slice(1) + 'Effect'
  console.log('typeName', typeName)
  const EffectClass = Effects[typeName]
  if (EffectClass) {
    // 只传递当前类型的配置
    effectInstance = new EffectClass(leafer, config.value[config.value.type])
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
    (d) => d.label.includes('VB-Audio') || d.label.includes('BlackHole')
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
  <div ref="leaferRef" style="width: 100vw; height: 100vh; background: transparent"></div>
</template>
