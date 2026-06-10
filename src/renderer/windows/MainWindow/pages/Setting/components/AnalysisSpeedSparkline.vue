<script setup>
import { computed } from 'vue'

const props = defineProps({
  /** @type {{ throughput: number, avgSpeed: number }[]} */
  series: { type: Array, default: () => [] },
  active: { type: Boolean, default: false },
  height: { type: Number, default: 44 }
})

const GRID_LINES = [0.25, 0.5, 0.75]

/** Catmull-Rom → cubic Bézier，sparkline 用平滑曲线 */
function buildSmoothPath(points) {
  if (!points.length) return ''
  if (points.length === 1) return `M${points[0].x},${points[0].y}`
  if (points.length === 2) {
    return `M${points[0].x},${points[0].y} L${points[1].x},${points[1].y}`
  }

  let d = `M${points[0].x},${points[0].y}`
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i - 1] ?? points[i]
    const p1 = points[i]
    const p2 = points[i + 1]
    const p3 = points[i + 2] ?? p2

    const cp1x = p1.x + (p2.x - p0.x) / 6
    const cp1y = p1.y + (p2.y - p0.y) / 6
    const cp2x = p2.x - (p3.x - p1.x) / 6
    const cp2y = p2.y - (p3.y - p1.y) / 6

    d += ` C${cp1x.toFixed(2)},${cp1y.toFixed(2)} ${cp2x.toFixed(2)},${cp2y.toFixed(2)} ${p2.x},${p2.y}`
  }
  return d
}

const chart = computed(() => {
  const raw = props.series
  if (raw.length < 2) return null

  const w = 100
  const h = props.height
  const padY = 4
  const innerH = h - padY * 2

  const toX = (i) => (i / (raw.length - 1)) * w

  /** 各系列独立归一化，避免 avg 恒定值把吞吐压成贴底平线 */
  const buildPath = (key, constantRefRatio = 0.32) => {
    const values = raw.map((p) => Math.max(0, p[key] ?? 0))
    const maxVal = Math.max(...values)
    const minVal = Math.min(...values)
    const span = maxVal - minVal

    let toY
    if (span < 1e-6) {
      const refY = padY + innerH * constantRefRatio
      toY = () => refY
    } else {
      const range = Math.max(span, maxVal * 0.12, 0.05)
      toY = (v) => {
        const normalized = Math.min(1, Math.max(0, (v - minVal) / range))
        return h - padY - normalized * innerH
      }
    }

    const points = values.map((v, i) => ({
      x: toX(i),
      y: toY(v)
    }))
    return buildSmoothPath(points)
  }

  return {
    throughput: buildPath('throughput', 0.72),
    avgSpeed: buildPath('avgSpeed', 0.32),
    gridYs: GRID_LINES.map((t) => padY + innerH * (1 - t))
  }
})
</script>

<template>
  <div
    class="analysis-speed-sparkline"
    :class="{ 'is-active': active }"
    :style="{ height: `${height}px` }"
  >
    <svg
      v-if="chart"
      class="analysis-speed-sparkline__svg"
      :viewBox="`0 0 100 ${height}`"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <line
        v-for="(gy, idx) in chart.gridYs"
        :key="idx"
        x1="0"
        :y1="gy"
        x2="100"
        :y2="gy"
        class="analysis-speed-sparkline__grid"
      />
      <path :d="chart.avgSpeed" class="analysis-speed-sparkline__line analysis-speed-sparkline__line--avg" />
      <path
        :d="chart.throughput"
        class="analysis-speed-sparkline__line analysis-speed-sparkline__line--live"
      />
    </svg>
    <div v-else class="analysis-speed-sparkline__placeholder">
      <span v-for="idx in 3" :key="idx" class="analysis-speed-sparkline__grid analysis-speed-sparkline__grid--ph" />
    </div>
  </div>
</template>

<style scoped lang="scss">
.analysis-speed-sparkline {
  position: relative;
  width: 100%;
  margin-bottom: 6px;
  border-radius: 6px;
  background: var(--el-fill-color-lighter);
  overflow: hidden;

  &__svg {
    display: block;
    width: 100%;
    height: 100%;
  }

  &__grid {
    stroke: var(--el-border-color-lighter);
    stroke-width: 0.6;
    vector-effect: non-scaling-stroke;
  }

  &__line {
    fill: none;
    vector-effect: non-scaling-stroke;
    stroke-linecap: round;
    stroke-linejoin: round;

    &--live {
      stroke: var(--el-color-primary);
      stroke-width: 2.2;
      opacity: 0.92;
    }

    &--avg {
      stroke: #e8a87c;
      stroke-width: 1.4;
      opacity: 0.85;
    }
  }

  &__placeholder {
    display: flex;
    flex-direction: column;
    justify-content: space-evenly;
    height: 100%;
    padding: 4px 0;
    box-sizing: border-box;
  }

  &__grid--ph {
    display: block;
    height: 1px;
    background: var(--el-border-color-lighter);
    opacity: 0.85;
  }

  &.is-active .analysis-speed-sparkline__line--live {
    filter: drop-shadow(0 0 2px color-mix(in srgb, var(--el-color-primary) 35%, transparent));
  }
}
</style>
