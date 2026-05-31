/**
 * 频谱 → 舞台可视化数据：对数分桶、分区归一化、矩阵/地柱专用映射。
 * ctx 通常含 { config, barCount, getMappedValue }，getMappedValue 来自 EffectBase 动画曲线。
 */
import { getRhythmColors } from '../../stageColorTheme.js'

/** 对数分桶；按配色区段分别归一化，避免某一频段长期顶满 */
export function mapSpectrumToBars(ctx, spectrum) {
  const n = spectrum?.length ?? 0
  const count = ctx.barCount
  if (!n || !count) return new Array(count).fill(0)

  const logN = Math.log(Math.max(n, 2))
  const raw = []
  for (let i = 0; i < count; i++) {
    const start = Math.min(n - 1, Math.max(0, Math.floor(Math.exp((i / count) * logN)) - 1))
    const end = Math.min(n, Math.max(start + 1, Math.floor(Math.exp(((i + 1) / count) * logN))))
    let max = 0
    for (let j = start; j < end; j++) {
      max = Math.max(max, spectrum[j])
    }
    raw[i] = ctx.getMappedValue(max)
  }

  const rhythmColors = getRhythmColors(ctx.config)
  const zones = Math.max(rhythmColors.length, 1)
  for (let z = 0; z < zones; z++) {
    const from = Math.floor((z / zones) * count)
    const to = Math.max(from + 1, Math.floor(((z + 1) / zones) * count))
    let max = 0.001
    for (let j = from; j < to; j++) {
      max = Math.max(max, raw[j])
    }
    for (let j = from; j < to; j++) {
      raw[j] /= max * 0.55 + 0.45
    }
  }
  return raw
}

/** 频谱柱 → 矩阵列电平（线性插值到 cols） */
export function barsToColumnLevels(bars, cols) {
  const n = bars?.length ?? 0
  const out = new Float32Array(cols)
  if (!n || !cols) return out

  for (let c = 0; c < cols; c++) {
    const t = cols === 1 ? 0 : c / (cols - 1)
    const idx = Math.min(n - 1, Math.floor(t * (n - 1)))
    const next = Math.min(n - 1, idx + 1)
    const mix = t * (n - 1) - idx
    out[c] = bars[idx] * (1 - mix) + bars[next] * mix
  }
  return out
}

/** 列电平后处理：阈值、曲线、低频列节拍（墙/地柱共用） */
function applyColumnLevelsPost(colLevels, cols, frame = null) {
  for (let i = 0; i < cols; i++) {
    let v = colLevels[i] ?? 0
    if (v < 0.1) {
      colLevels[i] = 0
      continue
    }
    colLevels[i] = Math.min(1, Math.pow(v, 0.85) * 1.05)
  }

  if (frame?.beat && (frame.kickEnvelope ?? 0) > 0.12) {
    const kick = frame.kickEnvelope ?? frame.kick ?? 0
    const lift = Math.max(2, Math.floor(cols * 0.38))
    for (let c = 0; c < lift; c++) {
      const fall = 1 - (c / lift) * 0.4
      colLevels[c] = Math.min(1, Math.max(colLevels[c], kick * fall * 0.45))
    }
  }
  return colLevels
}

/**
 * 霓虹墙列电平：mapSpectrumToBars（barCount=cols）→ 插值到列
 */
export function mapSpectrumToWallLevels(ctx, spectrum, cols, frame = null) {
  const n = spectrum?.length ?? 0
  const out = new Float32Array(cols)
  if (!n || !cols) return out

  const bars = mapSpectrumToBars({ ...ctx, barCount: cols }, spectrum)
  const colLevels = barsToColumnLevels(bars, cols)
  applyColumnLevelsPost(colLevels, cols, frame)
  out.set(colLevels)
  return out
}

/**
 * 列电平 → 矩阵：仅自底部向上亮 N 行（经典均衡器，上方一律灭）
 * 行 0 = 底，rows-1 = 顶
 */
export function buildMatrixFromColumnLevels(colLevels, cols, rows) {
  const out = new Float32Array(cols * rows)

  for (let c = 0; c < cols; c++) {
    const v = Math.min(1, Math.max(0, colLevels[c] ?? 0))
    if (v < 0.06) continue

    const litRows = Math.max(1, Math.round(Math.pow(v, 0.8) * rows))
    for (let r = 0; r < litRows; r++) {
      const t = litRows <= 1 ? 1 : r / (litRows - 1)
      out[r * cols + c] = Math.min(1, 0.38 + t * 0.32 + v * 0.38)
    }
  }
  return out
}

/** 频谱 → 矩阵（无时间平滑，供需要原始响应的场景） */
export function mapSpectrumToMatrix(ctx, spectrum, cols, rows) {
  const bars = mapSpectrumToBars(ctx, spectrum)
  const colLevels = barsToColumnLevels(bars, cols)
  return buildMatrixFromColumnLevels(colLevels, cols, rows)
}

/** 无有效频谱时的占位帧，保证场景仍有微弱律动 */
export const STAGE_IDLE_FRAME = {
  spectrum: null,
  energy: 0.42,
  flux: 0,
  beat: false,
  onset: false,
  rms: 0.2,
  bands: { low: 0.32, mid: 0.24, high: 0.18 },
  bass: 0.32,
  kick: 0.3,
  kickEnvelope: 0.3,
  bassEnvelope: 0.3,
  beatPulse: 0,
  silent: false
}

export const STAGE_BAR_COUNTS = { sparse: 48, normal: 64, dense: 88 }

export const STAGE_GRID_COUNTS = {
  sparse: { cols: 28, rows: 14 },
  normal: { cols: 36, rows: 18 },
  dense: { cols: 48, rows: 22 }
}

/** 线框网格平面细分段数（与律动「密集度」联动） */
export const STAGE_MESH_SEGMENTS = {
  sparse: 72,
  normal: 96,
  dense: 128
}

/** 格子极坐标（中心 = 地板中心） */
function gridCellPolar(x, z, cols, rows) {
  const cx = (cols - 1) * 0.5
  const cz = (rows - 1) * 0.5
  const maxR = Math.hypot(cx, cz, 1e-3)
  const dist = Math.min(1, Math.hypot(x - cx, z - cz) / maxR)
  const angle = Math.atan2(z - cz, x - cx)
  return { dist, angle }
}

/** 超低频带峰值（中心空心时补底鼓能量） */
function sampleGridLowBand(ctx, spectrum, ratio = 0.16) {
  const n = spectrum.length
  const end = Math.max(2, Math.floor(n * ratio))
  let max = 0
  for (let j = 0; j < end; j++) max = Math.max(max, spectrum[j])
  return ctx.getMappedValue(max)
}

/** 径向主频 + 方位窄窗 + 中心低频融合 */
function sampleGridCellRadialSpectrum(ctx, spectrum, x, z, cols, rows) {
  const n = spectrum.length
  const logN = Math.log(Math.max(n, 2))
  const { dist, angle } = gridCellPolar(x, z, cols, rows)

  const center = Math.min(n - 1, Math.max(0, Math.floor(Math.exp(dist * logN) - 1)))
  const span = Math.max(1, Math.min(3, Math.floor(n / (cols + rows + 8)) + 1))
  const angBins = Math.max(cols, rows, 12)
  const angOff = Math.floor(((angle + Math.PI) / (2 * Math.PI)) * angBins)
  const hash =
    Math.sin(x * 12.9898 + z * 78.233) * 43758.5453 -
    Math.floor(Math.sin(x * 12.9898 + z * 78.233) * 43758.5453)
  const seedOff = Math.floor(hash * span)
  const slide = Math.min(Math.max(0, n - span), angOff % Math.max(1, n - span))
  const start = Math.min(n - 1, Math.max(0, center + seedOff - Math.floor(span / 2)))
  const end = Math.min(n, Math.max(start + 1, start + span))

  let max = 0
  for (let j = start; j < end; j++) max = Math.max(max, spectrum[j])
  const micro = 0.9 + Math.sin(x * 1.91 + z * 2.47 + angle * 2) * 0.1
  let radial = ctx.getMappedValue(max) * micro

  const core = Math.max(0, 1 - dist / 0.32)
  if (core > 0) {
    const low = sampleGridLowBand(ctx, spectrum)
    radial = radial * (1 - core * 0.62) + low * core * 0.62
  }
  return radial
}

export function mapGridIdleLevels(cols, rows, time) {
  const out = new Float32Array(cols * rows)
  const cx = (cols - 1) * 0.5
  const cz = (rows - 1) * 0.5
  const maxR = Math.hypot(cx, cz, 1e-3)
  for (let z = 0; z < rows; z++) {
    for (let x = 0; x < cols; x++) {
      const i = z * cols + x
      const distN = Math.min(1, Math.hypot(x - cx, z - cz) / maxR)
      const ang = Math.atan2(z - cz, x - cx)
      const w =
        Math.sin(time * 1.8 + distN * 0.35 + ang * 2) * 0.5 +
        0.5 +
        Math.cos(time * 0.85 + x * 0.31 + z * 0.27) * 0.22
      const core = Math.max(0, 1 - distN / 0.35)
      out[i] = 0.06 + w * 0.2 + core * 0.14
    }
  }
  return out
}

/** 地柱网格：径向频谱取样 + 中心节拍扩散 */
export function mapSpectrumToGridLevels(ctx, spectrum, cols, rows, frame = null) {
  const cellCount = cols * rows
  const out = new Float32Array(cellCount)
  if (!spectrum?.length || !cellCount) return out

  const raw = new Float32Array(cellCount)
  let gMax = 0.001
  for (let z = 0; z < rows; z++) {
    for (let x = 0; x < cols; x++) {
      const i = z * cols + x
      const v = sampleGridCellRadialSpectrum(ctx, spectrum, x, z, cols, rows)
      raw[i] = v
      gMax = Math.max(gMax, v)
    }
  }

  const denom = gMax * 0.52 + 0.48
  const cx = (cols - 1) * 0.5
  const cz = (rows - 1) * 0.5
  const maxR = Math.hypot(cx, cz, 1e-3)
  const bass =
    frame?.bassEnvelope ??
    frame?.bass ??
    frame?.bands?.low ??
    frame?.energy ??
    0

  for (let z = 0; z < rows; z++) {
    for (let x = 0; x < cols; x++) {
      const i = z * cols + x
      let v = raw[i] / denom
      const distN = Math.min(1, Math.hypot(x - cx, z - cz) / maxR)
      const gate = 0.05 + distN * 0.05
      if (v < gate) v = 0
      else v = Math.min(1, Math.pow(v, 0.88) * 1.02)
      if (distN < 0.38) {
        const core = 1 - distN / 0.38
        v = Math.max(v, bass * core * 0.62)
      }
      out[i] = v
    }
  }

  if (frame?.beat && (frame.kickEnvelope ?? 0) > 0.12) {
    const kick = frame.kickEnvelope ?? frame.kick ?? 0
    const beatR = maxR * 0.62
    for (let z = 0; z < rows; z++) {
      for (let x = 0; x < cols; x++) {
        const i = z * cols + x
        const dist = Math.hypot(x - cx, z - cz)
        if (dist > beatR) continue
        const fall = 1 - dist / beatR
        const wobble = 0.78 + Math.sin(x * 2.4 + z * 1.85) * 0.22
        out[i] = Math.min(1, Math.max(out[i], kick * fall * 0.48 * wobble))
      }
    }
  }

  return out
}
