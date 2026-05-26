/**
 * 律动配色与舞台静态环境色。
 * - getRhythmColors / buildRhythmShaderColors：用户配色 → Three.Color / GLSL uniform
 * - heightColorHex / radialColorHex：CPU 侧柱、矩阵、地板着色
 * - sample*WallColor：建盒时顶点色，强化「开口亮、深处暗」的凹感
 */
import * as THREE from 'three'

/** ShaderMaterial 最多采样 8 色，不足则重复末色 */
export const RHYTHM_SHADER_MAX_COLORS = 8

export function getRhythmColors(config) {
  const list = config?.colors
  if (Array.isArray(list) && list.length > 0) return list
  return ['#3388ff', '#5599ff', '#88ccff']
}

/** 顶光数量与律动配色数量一致（上限 6） */
export function getBeamCountFromColors(config) {
  return Math.min(Math.max(getRhythmColors(config).length, 1), 6)
}

/** WebGL 着色器 uniform：律动 colors 数组（不足 8 色则重复末色填充） */
export function buildRhythmShaderColors(config) {
  const list = getRhythmColors(config)
  const colorCount = Math.max(1, Math.min(list.length, RHYTHM_SHADER_MAX_COLORS))
  const colors = []
  for (let i = 0; i < RHYTHM_SHADER_MAX_COLORS; i++) {
    const hex = list[Math.min(i, list.length - 1)]
    colors.push(new THREE.Color(hex))
  }
  return { colors, colorCount }
}

/** 纹理球：按顶点位移强度着色（低→暗/冷，高→亮/暖） */
export function spikeColorHex(t, colors) {
  const list =
    colors?.length >= 3
      ? colors
      : ['#0a1848', '#2288ee', '#44ddaa', '#ddff55', '#ff6633']
  const n = list.length
  const clamped = Math.max(0, Math.min(1, t))
  const pos = clamped * (n - 1)
  const i0 = Math.floor(pos)
  const i1 = Math.min(n - 1, i0 + 1)
  return lerpColor(list[i0], list[i1], pos - i0)
}

/** 地柱等：按归一化高度/能量在律动配色中自下而上插值（低→首色，高→末色） */
export function heightColorHex(t, colors) {
  const list = colors
  const n = list?.length ?? 0
  if (n === 0) return 0xffffff
  if (n === 1) return hexToNumber(list[0])
  const clamped = Math.max(0, Math.min(1, t))
  const pos = clamped * (n - 1)
  const i0 = Math.floor(pos)
  const i1 = Math.min(n - 1, i0 + 1)
  return lerpColor(list[i0], list[i1], pos - i0)
}

/** 地板网格：以格子平面中心为圆心，向外径向插值律动配色（非地柱高度色） */
export function radialColorHex(x, z, cols, rows, colors) {
  const list = colors
  const n = list?.length ?? 0
  if (n === 0) return 0xffffff
  if (n === 1) return hexToNumber(list[0])

  const cx = (cols - 1) * 0.5
  const cz = (rows - 1) * 0.5
  const maxR = Math.hypot(cx, cz, 1e-3)
  const dist = Math.min(1, Math.hypot(x - cx, z - cz) / maxR)
  const t = dist * (n - 1)
  const i0 = Math.floor(t)
  const i1 = Math.min(n - 1, i0 + 1)
  return lerpColor(list[i0], list[i1], t - i0)
}

/** 按列均分配色区（N 色 → 每色约 cols/N 列，避免末色只占 1 列） */
export function colorIndexForColumn(col, cols, colorCount) {
  const n = Math.max(1, colorCount | 0)
  if (n === 1 || cols < 2) return 0
  return Math.min(n - 1, Math.floor((col * n) / cols))
}

export function hexToNumber(hex) {
  if (typeof hex === 'number') return hex
  const s = String(hex).trim()
  if (s.startsWith('#')) {
    return parseInt(s.slice(1, 7), 16)
  }
  const rgb = s.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i)
  if (rgb) {
    return (Number(rgb[1]) << 16) | (Number(rgb[2]) << 8) | Number(rgb[3])
  }
  return parseInt(s.replace('#', '').slice(0, 6), 16) || 0xffffff
}

export function lerpColor(hexA, hexB, t) {
  const a = hexToNumber(hexA)
  const b = hexToNumber(hexB)
  const ar = (a >> 16) & 255
  const ag = (a >> 8) & 255
  const ab = a & 255
  const br = (b >> 16) & 255
  const bg = (b >> 8) & 255
  const bb = b & 255
  return (
    (Math.round(ar + (br - ar) * t) << 16) |
    (Math.round(ag + (bg - ag) * t) << 8) |
    Math.round(ab + (bb - ab) * t)
  )
}

export function pickBandColor(colors, bands = {}, energy = 0.4) {
  const n = colors.length
  if (n === 1) return colors[0]
  const low = bands.low ?? 0.3
  const mid = bands.mid ?? 0.25
  const high = bands.high ?? 0.2
  const wSum = low + mid + high + 0.001
  const t = (low * 0 + mid * 0.5 + high * 1) / wSum
  const idx = Math.min(Math.floor(t * (n - 1)), n - 2)
  const mix = t * (n - 1) - idx
  const base = lerpColor(colors[idx], colors[idx + 1], mix)
  if (energy > 0.55) {
    return lerpColor(base, colors[n - 1], (energy - 0.55) * 1.8)
  }
  return base
}

function dimColorNum(rgb, towardBlack = 0.12) {
  const t = Math.min(0.6, Math.max(0, towardBlack))
  const k = 1 - t
  const r = ((rgb >> 16) & 255) * k
  const g = ((rgb >> 8) & 255) * k
  const b = (rgb & 255) * k
  return (Math.round(r) << 16) | (Math.round(g) << 8) | Math.round(b)
}

/** 舞台环境中性暗色：开口侧更亮、深处更暗，拉大对比以增强凹进感 */
const STAGE_AMBIENT_GRAD = {
  wallNear: 0x4a5668,
  wallFar: 0x020304,
  wallBottom: 0x010102,
  wallTop: 0x3a4554,
  floorFront: 0x2a3340,
  floorBack: 0x000101,
  ceilFront: 0x323c4a,
  ceilBack: 0x3a4554
}

function scaleColorNum(hex, factor) {
  const f = Math.max(0, Math.min(1.65, factor))
  const r = Math.min(255, Math.round(((hex >> 16) & 255) * f))
  const g = Math.min(255, Math.round(((hex >> 8) & 255) * f))
  const b = Math.min(255, Math.round((hex & 255) * f))
  return (r << 16) | (g << 8) | b
}

/** 后墙：下暗上亮；中部略聚光，两侧与底缘压暗 */
export function sampleBackWallColor(g, u, v) {
  if (v >= 0.94) return g.wallTop
  let c = lerpColor(g.wallBottom, g.wallTop, Math.pow(v, 0.78))
  const edgeFalloff = 1 - 0.48 * Math.pow(Math.abs(u - 0.5) * 2, 1.15) * (1 - v) ** 1.35
  c = scaleColorNum(c, 0.34 + 0.66 * edgeFalloff)
  const spot = Math.exp(-((u - 0.5) ** 2) * 6.2 - (v - 0.62) ** 2 * 4.8) * 0.32
  const floorBounce = Math.exp(-v * 14) * 0.12
  if (v > 0.8) {
    c = lerpColor(c, g.wallTop, ((v - 0.8) / 0.2) * 0.65)
  }
  return scaleColorNum(c, 1 + spot + floorBounce)
}

/** 侧墙：u→1 为开口（更亮），u→0 为深处；底暗顶亮 + 开口边缘高光 */
export function sampleSideWallColor(g, u, v) {
  const depth = lerpColor(g.wallFar, g.wallNear, Math.pow(u, 0.52))
  const height = lerpColor(g.wallBottom, g.wallTop, Math.pow(v, 0.7))
  let c = lerpColor(depth, height, 0.48)
  const opening = 0.55 + 0.45 * Math.pow(u, 1.35)
  const floorDark = 0.42 + 0.58 * v
  c = scaleColorNum(c, opening * floorDark)
  const rim = Math.exp(-Math.pow(1 - u, 2) * 22) * 0.18
  const ceilBand = v > 0.88 ? ((v - 0.88) / 0.12) * 0.5 : 0
  if (ceilBand > 0) c = lerpColor(c, g.wallTop, ceilBand)
  return scaleColorNum(c, 1 + rim)
}

/** 地面：前亮后暗 + 侧缘暗角（透视灭点在后角） */
export function sampleFloorColor(g, u, v) {
  let c = lerpColor(g.floorFront, g.floorBack, Math.pow(v, 0.72))
  const side = 1 - 0.36 * Math.pow(Math.abs(u - 0.5) * 2, 1.05)
  const front = 1.18 - v * 0.38
  const corner = Math.exp(-((u - 0.5) ** 2 * 4 + v ** 2 * 6)) * 0.14
  return scaleColorNum(c, side * front * (1 + corner))
}

/** 天花：前缘略亮、深处接后墙顶；侧缘微暗 */
export function sampleCeilColor(g, u, v) {
  if (v >= 0.9) return g.wallTop
  const depth = Math.pow(v, 0.42) * 0.55
  let c = lerpColor(g.ceilFront, g.wallTop, depth)
  const side = 1 - 0.22 * Math.pow(Math.abs(u - 0.5) * 2, 1.1)
  const frontGlow = (1 - v) * 0.14
  return scaleColorNum(c, side * (1 + frontGlow))
}

/** 墙近黑；线框用律动色勾勒空间层次 */
export function buildStageTheme(_config) {
  return {
    wall: 0x030508,
    ceiling: 0x04060a,
    floor: 0x020304,
    grad: { ...STAGE_AMBIENT_GRAD }
  }
}
