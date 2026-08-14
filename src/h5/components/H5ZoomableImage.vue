<script setup>
/**
 * 对齐鸿蒙 PreviewZoomImage：
 * 双击多级循环 1→2→3→5→1（以点击点为中心）、双指捏合、放大后拖移。
 */
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'

const ZOOM_LEVELS = [1, 2, 3, 5]
const PINCH_MAX = 5

const props = defineProps({
  src: { type: String, default: '' },
  objectFit: { type: String, default: 'contain' },
  /** 未放大时是否仍拦截触摸（铺满原位需 true 以吃掉双击；卡片弹层亦 true） */
  active: { type: Boolean, default: true }
})

const emit = defineEmits(['zoom-change', 'pinch-active', 'error', 'load', 'double-tap', 'tap'])

const rootRef = ref(null)
const scale = ref(1)
const offsetX = ref(0)
const offsetY = ref(0)
const containerW = ref(0)
const containerH = ref(0)

let pinchBaseScale = 1
let panBaseX = 0
let panBaseY = 0
let pinchStartDist = 0
let pinchStartCenterX = 0
let pinchStartCenterY = 0
const pinchActive = ref(false)
let isPinching = false
let isPanning = false
let lastTapAt = 0
let lastTapX = 0
let lastTapY = 0
let touchStartX = 0
let touchStartY = 0
let moved = false

const isZoomed = () => scale.value > 1.01

/** 未放大时必须 pan-y，否则铺满 VirtualList 无法纵向滚动 */
const rootTouchAction = computed(() =>
  scale.value > 1.01 || pinchActive.value ? 'none' : 'pan-y'
)

const notifyZoom = () => {
  emit('zoom-change', isZoomed())
}

const resetTransform = () => {
  scale.value = 1
  offsetX.value = 0
  offsetY.value = 0
  pinchBaseScale = 1
  notifyZoom()
}

watch(
  () => props.active,
  (v) => {
    if (!v) resetTransform()
  }
)

watch(
  () => props.src,
  () => {
    resetTransform()
  }
)

const nextZoomScale = () => {
  const maxLevel = ZOOM_LEVELS[ZOOM_LEVELS.length - 1]
  if (scale.value >= maxLevel - 0.05) return 1
  for (let i = 0; i < ZOOM_LEVELS.length; i++) {
    if (ZOOM_LEVELS[i] > scale.value + 0.05) return ZOOM_LEVELS[i]
  }
  return 1
}

const zoomToAt = (target, focalX, focalY) => {
  if (target <= 1.01) {
    resetTransform()
    return
  }
  const cx = containerW.value / 2
  const cy = containerH.value / 2
  const fx = focalX - cx
  const fy = focalY - cy
  const from = Math.max(scale.value, 0.01)
  const ratio = target / from
  offsetX.value = fx - (fx - offsetX.value) * ratio
  offsetY.value = fy - (fy - offsetY.value) * ratio
  scale.value = target
  pinchBaseScale = target
  notifyZoom()
}

const dist = (a, b) => {
  const dx = a.clientX - b.clientX
  const dy = a.clientY - b.clientY
  return Math.sqrt(dx * dx + dy * dy)
}

const midpoint = (a, b) => ({
  x: (a.clientX + b.clientX) / 2,
  y: (a.clientY + b.clientY) / 2
})

const localPoint = (clientX, clientY) => {
  const el = rootRef.value
  if (!el) return { x: containerW.value / 2, y: containerH.value / 2 }
  const rect = el.getBoundingClientRect()
  return { x: clientX - rect.left, y: clientY - rect.top }
}

const applyPinch = (nextScale, focalX, focalY) => {
  let s = Math.min(PINCH_MAX, Math.max(1, nextScale))
  if (!(s > 0)) return
  if (scale.value >= PINCH_MAX * 0.8 && s < scale.value * 0.55) return
  if (s <= 1.01) {
    scale.value = 1
    offsetX.value = 0
    offsetY.value = 0
    notifyZoom()
    return
  }
  const cx = containerW.value / 2
  const cy = containerH.value / 2
  const fx = focalX - cx
  const fy = focalY - cy
  const ratio = s / Math.max(scale.value, 0.01)
  offsetX.value = fx - (fx - offsetX.value) * ratio
  offsetY.value = fy - (fy - offsetY.value) * ratio
  scale.value = s
  notifyZoom()
}

const finishPinch = () => {
  if (scale.value <= 1.05) {
    resetTransform()
    return
  }
  if (scale.value >= PINCH_MAX - 0.02) scale.value = PINCH_MAX
  pinchBaseScale = scale.value
  notifyZoom()
}

/** 仅放大/捏合时拦截，避免误伤铺满列表原生滚动 */
const blockParentTouch = (e) => {
  if (typeof e.cancelable === 'boolean' && !e.cancelable) {
    e.stopPropagation()
    return
  }
  e.preventDefault()
  e.stopPropagation()
}

const setPinching = (active) => {
  isPinching = active
  pinchActive.value = active
  emit('pinch-active', active)
}

const onTouchStart = (e) => {
  if (!props.active) return
  const touches = e.touches
  if (!touches?.length) return
  moved = false
  if (touches.length >= 2) {
    blockParentTouch(e)
    isPanning = false
    pinchBaseScale = scale.value
    pinchStartDist = dist(touches[0], touches[1]) || 1
    const mid = midpoint(touches[0], touches[1])
    const local = localPoint(mid.x, mid.y)
    pinchStartCenterX = local.x
    pinchStartCenterY = local.y
    setPinching(true)
    return
  }
  touchStartX = touches[0].clientX
  touchStartY = touches[0].clientY
  if (isZoomed()) {
    // 放大态才阻断父级；未放大勿 preventDefault，否则铺满列表滚不动
    blockParentTouch(e)
    isPanning = true
    panBaseX = offsetX.value
    panBaseY = offsetY.value
  }
}

const onTouchMove = (e) => {
  if (!props.active) return
  const touches = e.touches
  if (!touches?.length) return
  if (isPinching && touches.length >= 2) {
    blockParentTouch(e)
    const d = dist(touches[0], touches[1]) || 1
    const mid = midpoint(touches[0], touches[1])
    const local = localPoint(mid.x, mid.y)
    applyPinch(pinchBaseScale * (d / pinchStartDist), local.x, local.y)
    return
  }
  if (isPanning && isZoomed() && touches.length === 1) {
    blockParentTouch(e)
    const dx = touches[0].clientX - touchStartX
    const dy = touches[0].clientY - touchStartY
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) moved = true
    offsetX.value = panBaseX + dx
    offsetY.value = panBaseY + dy
  } else if (touches.length === 1) {
    const dx = touches[0].clientX - touchStartX
    const dy = touches[0].clientY - touchStartY
    if (Math.abs(dx) > 8 || Math.abs(dy) > 8) moved = true
  }
}

const onTouchEnd = (e) => {
  if (!props.active) return
  if (isPinching) {
    if (!e.touches || e.touches.length < 2) {
      setPinching(false)
      finishPinch()
    }
    return
  }
  // 放大后 touchstart 会置 isPanning；若未拖移，必须继续走单击/双击，否则只能放大一次
  if (isPanning) {
    isPanning = false
    if (moved) return
  }
  if (moved) return
  if (e.changedTouches?.length !== 1) return
  const t = e.changedTouches[0]
  const local = localPoint(t.clientX, t.clientY)
  const now = Date.now()
  if (now - lastTapAt < 320 && Math.hypot(t.clientX - lastTapX, t.clientY - lastTapY) < 36) {
    lastTapAt = 0
    const next = nextZoomScale()
    zoomToAt(next, local.x, local.y)
    emit('double-tap')
    return
  }
  lastTapAt = now
  lastTapX = t.clientX
  lastTapY = t.clientY
  emit('tap')
}

const onTouchCancel = () => {
  if (isPinching) {
    setPinching(false)
    pinchBaseScale = scale.value
  }
  isPanning = false
}

const measure = () => {
  const el = rootRef.value
  if (!el) return
  containerW.value = el.clientWidth
  containerH.value = el.clientHeight
}

onMounted(() => {
  measure()
  window.addEventListener('resize', measure)
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', measure)
})

const imgStyle = computed(() => ({
  objectFit: props.objectFit,
  transform: `translate(${offsetX.value}px, ${offsetY.value}px) scale(${scale.value})`,
  transformOrigin: 'center center'
}))

const rootStyle = computed(() => ({
  touchAction: rootTouchAction.value
}))
</script>

<template>
  <div
    ref="rootRef"
    class="h5-zoomable-image"
    :style="rootStyle"
    @touchstart="onTouchStart"
    @touchmove="onTouchMove"
    @touchend="onTouchEnd"
    @touchcancel="onTouchCancel"
  >
    <img
      class="h5-zoomable-image__img"
      :src="src"
      alt=""
      draggable="false"
      decoding="async"
      :style="imgStyle"
      @load="emit('load', $event)"
      @error="emit('error', $event)"
    />
  </div>
</template>

<style scoped lang="scss">
.h5-zoomable-image {
  width: 100%;
  height: 100%;
  overflow: hidden;
  position: relative;
  background: #000;
}

.h5-zoomable-image__img {
  width: 100%;
  height: 100%;
  display: block;
  user-select: none;
  -webkit-user-drag: none;
  will-change: transform;
}
</style>
