<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue'

const canvasRef = ref(null)
let audioContext, analyser, dataArray, source, animationId

const draw = () => {
  const canvas = canvasRef.value
  if (!canvas || !analyser) return
  const ctx = canvas.getContext('2d')
  const width = canvas.width
  const height = canvas.height

  analyser.getByteTimeDomainData(dataArray)
  ctx.clearRect(0, 0, width, height)
  ctx.beginPath()
  for (let i = 0; i < dataArray.length; i++) {
    const x = (i / dataArray.length) * width
    const y = (dataArray[i] / 255.0) * height
    if (i === 0) ctx.moveTo(x, y)
    else ctx.lineTo(x, y)
  }
  ctx.strokeStyle = '#00ffcc'
  ctx.lineWidth = 2
  ctx.stroke()

  animationId = requestAnimationFrame(draw)
}

onMounted(async () => {
  audioContext = new (window.AudioContext || window.webkitAudioContext)()
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
  source = audioContext.createMediaStreamSource(stream)
  analyser = audioContext.createAnalyser()
  analyser.fftSize = 2048
  dataArray = new Uint8Array(analyser.fftSize)
  source.connect(analyser)
  draw()
})

onBeforeUnmount(() => {
  if (animationId) cancelAnimationFrame(animationId)
  if (audioContext) audioContext.close()
})
</script>

<template>
  <canvas
    ref="canvasRef"
    width="800"
    height="300"
    style="width: 100vw; height: 100vh; display: block; background: #000"
  ></canvas>
</template>
