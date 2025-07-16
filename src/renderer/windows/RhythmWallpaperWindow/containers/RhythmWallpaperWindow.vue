<script setup>
import { Leafer } from 'leafer-ui'
import * as Effects from '../effects'

const leaferRef = ref(null)
let leafer, effectInstance, analyser, dataArray, source, audioContext, animationId

// 配置对象，按类型分组
const config = ref({
  type: 'bar', // 当前可视化类型，可选值：
  // 'bar'（柱状）、'wave'（波形）、'ball'（小球）、'disco'（迪斯科）、
  // 'spectrumRing'（频谱环）、'particleFountain'（粒子喷泉）、'breathingHalo'（呼吸光圈）、'dynamicGrid'（动态网格）、
  // 'flowingLines'（流动线条）、'musicNoteRain'（音符雨）、'rotatingStarburst'（旋转星芒）、'bars3D'（3D柱状）、
  // 'liquidRipple'（液体波纹）、'spectrumFlower'（频谱花朵）
  bar: {
    widthRatio: 1, // 柱状图宽度占画布宽度的比例，范围 0~1
    heightRatio: 0.3, // 柱状图最大高度占画布高度的比例，范围 0~1
    color: '#00ffcc', // 柱子默认颜色，未设置渐变时生效，支持任意合法 CSS 颜色
    gradient: ['#00ffcc', '#ff00cc'], // 柱子渐变色数组，支持多色渐变，数组元素为合法 CSS 颜色
    shadow: true, // 是否显示柱子阴影，可选值：true（显示）、false（不显示）
    renderType: 'parabola', // 柱子高度映射类型，可选：
    // 'linear'（线性）、'log'（对数）、'parabola'（抛物线）、'sqrt'（平方根，柔和）、
    // 'exp'（指数，爆发感）、'sin'（正弦，弹性）、'bounce'（弹跳回弹）、'step'（阶梯/像素跳跃）
    barCount: 64
  },
  wave: {
    amplitude: 1, // 波形幅度，数值越大波动越大，建议范围 0~2
    widthRatio: 1, // 波形宽度占画布宽度的比例，范围 0~1，1为铺满
    heightRatio: 0.3, // 波形最大高度占画布高度的比例，范围 0~1
    color: '#00ffcc', // 波形颜色
    gradient: ['#00ffcc', '#ff00cc'], // 渐变色
    shadow: true, // 是否显示阴影
    renderType: 'parabola', // 波形高度映射类型，可选：
    // 'linear'（线性）、'log'（对数）、'parabola'（抛物线）、'sqrt'（平方根，柔和）、
    // 'exp'（指数，爆发感）、'sin'（正弦，弹性）、'bounce'（弹跳回弹）、'step'（阶梯/像素跳跃）
    pointCount: 128
  },
  ball: {
    widthRatio: 1, // 小球分布宽度占画布宽度的比例，范围 0~1，1为铺满
    heightRatio: 0.3, // 小球最大弹跳高度占画布高度的比例，范围 0~1
    color: '#00ffcc', // 小球默认颜色，未设置渐变时生效，支持任意合法 CSS 颜色
    gradient: ['#00ffcc', '#ff00cc'], // 小球渐变色数组，支持多色渐变，数组元素为合法 CSS 颜色
    shadow: true, // 是否显示小球阴影，true 显示，false 不显示
    renderType: 'parabola', // 小球弹跳高度的映射类型，可选：
    // 'linear'（线性）、'log'（对数）、'parabola'（抛物线）、'sqrt'（平方根，柔和）、
    // 'exp'（指数，爆发感）、'sin'（正弦，弹性）、'bounce'（弹跳回弹）、'step'（阶梯/像素跳跃）
    ballCount: 16 // 小球数量，建议 8~32，根据画布宽度自适应
  },
  disco: {
    color: '#00ffcc', // 迪斯科效果颜色，支持任意合法 CSS 颜色
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
    shadow: true, // 是否显示阴影，可选值：true、false
    renderType: 'parabola', // 光束长度/透明度的映射类型，可选：
    // 'linear'（线性）、'log'（对数）、'parabola'（抛物线）、'sqrt'（平方根，柔和）、
    // 'exp'（指数，爆发感）、'sin'（正弦，弹性）、'bounce'（弹跳回弹）、'step'（阶梯/像素跳跃）
    lightCount: 12
  },
  spectrumRing: {
    segments: 32, // 环形分段数，越多越细腻，建议16~64
    radius: 120, // 内半径，单位px
    width: 32, // 柱状宽度，单位px
    gradient: ['#00ffcc', '#ff00cc'], // 环形渐变色数组，支持多色
    shadow: true, // 是否显示阴影
    renderType: 'parabola' // 柱高映射类型，可选：
    // 'linear'（线性）、'log'（对数）、'parabola'（抛物线）、'sqrt'（平方根，柔和）、
    // 'exp'（指数，爆发感）、'sin'（正弦，弹性）、'bounce'（弹跳回弹）、'step'（阶梯/像素跳跃）
  },
  particleFountain: {
    particleCount: 64, // 粒子数量，建议32~128
    gradient: ['#00ffcc', '#ff00cc', '#ffb347', '#43cea2'], // 粒子颜色数组
    shadow: true, // 是否显示阴影
    renderType: 'exp' // 粒子喷射幅度映射类型，可选：
    // 'linear'、'log'、'parabola'、'sqrt'、'exp'、'sin'、'bounce'、'step'
  },
  breathingHalo: {
    gradient: ['#00ffcc', '#ff00cc'], // 光圈渐变色
    shadow: true, // 是否显示发光阴影
    renderType: 'sin' // 光圈呼吸律动类型，可选：
    // 'linear'、'log'、'parabola'、'sqrt'、'exp'、'sin'、'bounce'、'step'
  },
  dynamicGrid: {
    rows: 8, // 网格行数
    cols: 16, // 网格列数
    gradient: ['#00ffcc', '#ff00cc', '#ffb347', '#43cea2'], // 格子颜色
    shadow: false, // 是否显示阴影
    renderType: 'step' // 格子高度/亮度映射类型，可选：
    // 'linear'、'log'、'parabola'、'sqrt'、'exp'、'sin'、'bounce'、'step'
  },
  flowingLines: {
    lineCount: 5, // 线条数量
    pointCount: 64, // 每条线的采样点数
    gradient: ['#00ffcc', '#ff00cc', '#ffb347', '#43cea2'], // 线条颜色
    shadow: false, // 是否显示阴影
    renderType: 'sin' // 线条波动律动类型，可选：
    // 'linear'、'log'、'parabola'、'sqrt'、'exp'、'sin'、'bounce'、'step'
  },
  musicNoteRain: {
    noteCount: 32, // 音符/泡泡数量
    gradient: ['#00ffcc', '#ff00cc', '#ffb347', '#43cea2'], // 音符颜色
    shadow: false, // 是否显示阴影
    renderType: 'exp' // 音符下落速度律动类型，可选：
    // 'linear'、'log'、'parabola'、'sqrt'、'exp'、'sin'、'bounce'、'step'
  },
  rotatingStarburst: {
    rayCount: 24, // 星芒射线数量
    gradient: ['#00ffcc', '#ff00cc', '#ffb347', '#43cea2'], // 射线颜色
    shadow: false, // 是否显示阴影
    renderType: 'parabola' // 射线长度律动类型，可选：
    // 'linear'、'log'、'parabola'、'sqrt'、'exp'、'sin'、'bounce'、'step'
  },
  bars3D: {
    barCount: 32, // 3D 柱子数量
    gradient: ['#00ffcc', '#ff00cc', '#ffb347', '#43cea2'], // 柱子颜色
    shadow: false, // 是否显示阴影
    renderType: 'parabola' // 柱高律动类型，可选：
    // 'linear'、'log'、'parabola'、'sqrt'、'exp'、'sin'、'bounce'、'step'
  },
  liquidRipple: {
    rippleCount: 6, // 波纹数量
    gradient: ['#00ffcc', '#ff00cc', '#ffb347', '#43cea2'], // 波纹颜色
    shadow: false, // 是否显示阴影
    renderType: 'sin' // 波纹扩散律动类型，可选：
    // 'linear'、'log'、'parabola'、'sqrt'、'exp'、'sin'、'bounce'、'step'
  },
  spectrumFlower: {
    petalCount: 16, // 花瓣数量
    gradient: ['#00ffcc', '#ff00cc', '#ffb347', '#43cea2'], // 花瓣颜色
    shadow: false, // 是否显示阴影
    renderType: 'parabola' // 花瓣绽放律动类型，可选：
    // 'linear'、'log'、'parabola'、'sqrt'、'exp'、'sin'、'bounce'、'step'
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
