<script setup>
import { Leafer } from 'leafer-ui'
import * as Effects from '../effects'
import UseSettingStore from '@renderer/stores/settingStore'
import { useTranslation } from 'i18next-vue'

const { t } = useTranslation()

const settingStore = UseSettingStore()
const { settingData } = storeToRefs(settingStore)

const containerRef = ref(null)
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
    shadow: true,
    debug: false
  }
})

// 判断是否为Three.js效果
const isThreeEffect = computed(() => {
  const effectName = config.value.effect
  return effectName.startsWith('Three')
})

const init = async () => {
  // 等待容器准备好
  await nextTick()

  // 清理现有的Leafer实例
  if (leafer) {
    try {
      leafer.destroy()
    } catch (error) {
      console.error('RhythmWallpaperWindow: Error destroying existing Leafer:', error)
    }
    leafer = null
  }

  console.log('RhythmWallpaperWindow: Container initialized, ready for effects')

  audioContext = new (window.AudioContext || window.webkitAudioContext)()
  // 获取所有音频输入设备
  const devices = await navigator.mediaDevices.enumerateDevices()
  const audioInputs = devices.filter((d) => d.kind === 'audioinput')
  console.log(
    'RhythmWallpaperWindow: Available audio inputs:',
    audioInputs.map((d) => d.label)
  )

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
    console.log('RhythmWallpaperWindow: Audio context setup complete')
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

async function runEffect() {
  // 停止当前的动画循环
  if (animationId) {
    cancelAnimationFrame(animationId)
    animationId = null
  }

  // 销毁当前效果实例
  if (effectInstance) {
    try {
      effectInstance.destroy()
    } catch (error) {
      console.error('RhythmWallpaperWindow: Error destroying effect instance:', error)
    }
    effectInstance = null
  }

  // 清理容器中的所有子元素（仅对Three.js效果需要）
  if (containerRef.value && isThreeEffect.value) {
    while (containerRef.value.firstChild) {
      containerRef.value.removeChild(containerRef.value.firstChild)
    }
  }

  // 检查容器是否准备好
  if (!containerRef.value) {
    console.warn('RhythmWallpaperWindow: Container not ready, skipping effect creation')
    return
  }

  const EffectClass = Effects[config.value.effect]

  if (EffectClass) {
    try {
      if (isThreeEffect.value) {
        // Three.js效果使用DOM容器
        console.log('RhythmWallpaperWindow: Creating Three.js effect:', config.value.effect)

        // 确保Leafer被清理
        if (leafer) {
          try {
            leafer.destroy()
          } catch (error) {
            console.error('RhythmWallpaperWindow: Error destroying Leafer for Three.js:', error)
          }
          leafer = null
        }

        effectInstance = new EffectClass(containerRef.value, toRaw(config.value))
      } else {
        // Leafer效果使用Leafer
        // 每次切换效果时都重新创建Leafer实例，确保完全清理
        if (leafer) {
          try {
            leafer.destroy()
          } catch (error) {
            console.error('RhythmWallpaperWindow: Error destroying existing Leafer:', error)
          }
          leafer = null
        }

        console.log('RhythmWallpaperWindow: Creating new Leafer instance')
        leafer = new Leafer({ view: containerRef.value, autoRender: true })

        console.log('RhythmWallpaperWindow: Creating Leafer effect:', config.value.effect)

        // 等待Leafer完全初始化
        await nextTick()
        await new Promise((resolve) => setTimeout(resolve, 50))
        await nextTick()

        // 如果Leafer尺寸仍然为0，尝试强制设置
        if (leafer.width === 0 || leafer.height === 0) {
          console.warn('RhythmWallpaperWindow: Leafer size is 0, forcing resize')
          leafer.resize(containerRef.value.offsetWidth, containerRef.value.offsetHeight)
          await nextTick()
        }

        effectInstance = new EffectClass(leafer, toRaw(config.value))
      }
      draw()
    } catch (error) {
      console.error('RhythmWallpaperWindow: Error creating effect instance:', error)
    }
  } else {
    console.warn('RhythmWallpaperWindow: Effect class not found:', config.value.effect)
  }
}

function draw() {
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
    // 确保容器准备好后再运行效果
    await nextTick()
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
  leafer?.destroy()
  if (effectInstance) {
    try {
      effectInstance.destroy()
    } catch (error) {
      console.error('RhythmWallpaperWindow: Error destroying effect instance:', error)
    }
  }
})
</script>

<template>
  <!-- 统一容器 - 用于所有效果 -->
  <div
    ref="containerRef"
    style="width: 100vw; height: 100vh; background: transparent; position: relative"
  ></div>
</template>
