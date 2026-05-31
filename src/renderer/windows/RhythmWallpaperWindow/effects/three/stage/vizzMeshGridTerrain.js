import { vizzPerlin3 } from './vizzPerlin.js'

/** 动画时间 */
export function scaledAnimTime(time, waveSpeed = 2.4) {
  return time * waveSpeed * 1.18
}

/** 外扩行波统一相位（与 animT、节拍同步，环带向外推进） */
export function ripplePhase(animT, intensity, beat = 0, B = 0) {
  const eff = effectiveRhythmIntensity(intensity)
  return (
    animT * (3.6 + eff * 3.1) + beat * (5.2 + eff * 6.5) + B * (2.2 + eff * 1.6)
  )
}

/** 径向衰减：中心活跃、边缘趋平 */
export function radialEnvelope(w, power = 2.8) {
  return Math.exp(-power * w * w)
}

/** 压低内外圈落差：中心略收、外围相对抬高 */
export function radialHeightTaper(w) {
  return 0.95 + 0.05 * radialEnvelope(w, 0.28)
}

/** 径向高度增益：保持 1，不按频段额外抬高或压低 */
export function spectrumHeightGain(_w, _A, _B) {
  return 1
}

/**
 * 行波环带掩模：w=0 为 0。
 * sin(k·w − phase) 在中心等于 sin(−phase)，常为负，会与穹顶相加形成中心凹坑。
 */
export function rippleRingMask(w) {
  return 1 - Math.exp(-14 * w * w)
}

/** 将原始音频强度映射到较窄区间，避免「静音全平 / 尖音炸裂」 */
export function balanceRhythmIntensity(raw) {
  const x = Math.min(1.2, Math.max(0, raw))
  const curved = Math.pow(x / 1.2, 0.68)
  return 0.3 + curved * 0.44
}

/** 中心律动强度（低音 + 节拍 + 低频能量），驱动隆起高度与扩散范围 */
export function computeCenterIntensity(centerA, B, beat, mid = 0) {
  const raw = B * 0.72 + beat * 0.88 + centerA * 0.55 + mid * 0.22
  return balanceRhythmIntensity(raw)
}

/** 用于高度/振幅：保留底噪，减弱随强度的二次放大 */
export function effectiveRhythmIntensity(intensity) {
  return 0.32 + intensity * 0.5
}

/** 强度越大包络越宽（扩散越远），强度越小缩在中心 */
export function intensitySpreadEnvelope(w, intensity) {
  const spread = 0.55 + (intensity - 0.34) * 0.65
  const power = Math.max(0.85, 2.1 - spread * 1.05)
  const core = radialEnvelope(w, power)
  const shoulder = Math.max(0, 1 - w * (1.02 - spread * 0.28))
  return Math.min(1, core * (0.48 + spread * 0.28) + shoulder * spread * 0.38)
}

/**
 * 向外扩散的多圈行波；高度与 phase 速度随 centerIntensity 变化
 */
export function outwardRippleTrain(lift, w, animT, intensity, beat = 0, B = 0) {
  const eff = effectiveRhythmIntensity(intensity)
  const phase = ripplePhase(animT, intensity, beat, B)
  const ring = rippleRingMask(w)
  const kMain = 12.5
  const kSub = 20
  const waves =
    Math.sin(kMain * w - phase) * 0.78 + Math.sin(kSub * w - phase * 1.02 + 0.25) * 0.22
  const trail = radialEnvelope(w, 0.48)
  const amp = lift * eff * (0.55 + eff * 0.38)
  return amp * waves * ring * trail
}

/** 轻柔 Perlin 流动（强度由 perlinNoiseIntensity 控制，vizz 默认 0.2） */
export function softTerrainNoise(col, row, cols, rows, span, animT, g, h, b, lift, w) {
  if (g <= 0) return 0
  const nx = (col / Math.max(cols - 1, 1)) * span
  const nz = (row / Math.max(rows - 1, 1)) * span
  const pn = vizzPerlin3(nx * h * 0.8, nz * h * 0.8, animT * b * 0.85)
  const env = (0.22 + 0.78 * rippleRingMask(w)) * (0.3 + 0.7 * radialEnvelope(w, 1.3))
  return (2 * pn - 1) * g * lift * 0.12 * env
}

/** 软封顶（vizz: tanh 限幅）；压低尖峰上限，中段起伏相对保留 */
export function softenDisplacement(h, lift, peakScale = 1) {
  const cap = Math.max(lift * (1.1 + Math.max(0, peakScale - 1) * 0.35), 0.04)
  return cap * Math.tanh(h / cap)
}

/**
 * 频谱/节拍尖峰：只抬高局部尖峰，不抬整体基线
 */
export function spectrumPeakSpike(lift, w, A, beat, B = 0) {
  const local = A * A
  const gate = Math.max(beat * 0.95, local * 0.9, B * 0.28)
  if (gate < 0.05) return 0
  const shape = radialEnvelope(w, 1.2) * 0.55 + rippleRingMask(w) * radialEnvelope(w, 0.65) * 0.45
  return lift * shape * gate * (local * 0.85 + beat * 0.72 + B * 0.18)
}

/**
 * vizz 径向频谱高度：每格由该点频谱 A 驱动（Uh 基项 ∝ A），非整体涟漪包络
 */
export function radialSpectrumHeight(w, A, B, beat, animT, radialMix, c, mid) {
  const x = radialMix
  let Fh = 0
  let Uh = 0
  const phase = animT * 2 + beat * 3 + B * 1.6

  const ring = rippleRingMask(w)
  const aScale = 1

  if (x > 0) {
    Fh = A * (1 + B) * 1.1 * x * radialEnvelope(w, 0.72) * aScale
    if (c > 0.3) {
      const ce = Math.min(1, (c - 0.3) / 0.7)
      Fh += Math.sin(10 * w - phase) * B * 0.45 * ce * x * radialEnvelope(w, 0.65) * ring
    }
    if (c > 0.7) {
      const ce = Math.min(1, (c - 0.7) / 0.3)
      Fh += Math.sin(18 * w - phase * 1.05) * B * 0.35 * ce * x * radialEnvelope(w, 0.58) * ring
    }
  }

  if (x < 1) {
    Uh = A * (1 + B) * 1.5 * (1 - x) * aScale
    if (c > 0.2) {
      const ce = Math.min(1, (c - 0.2) / 0.8)
      Uh += Math.sin(9 * w - phase * 0.95) * B * 0.8 * ce * (1 - x) * ring
    }
    if (c > 0.4) {
      const ce = Math.min(1, (c - 0.4) / 0.6)
      Uh +=
        Math.sin(14 * w - phase * 1.02 + 0.4) * (B + mid * 0.45) * 0.55 * ce * (1 - x) * ring +
        Math.sin(20 * w - phase * 1.06 + 0.9) * B * 0.3 * ce * (1 - x) * ring
    }
    if (c > 0.8) {
      const ce = Math.min(1, (c - 0.8) / 0.2)
      Uh += Math.sin(26 * w - phase * 1.1) * mid * 0.42 * ce * (1 - x) * ring
    }
  }

  return Fh + Uh
}

/**
 * vizz 单顶点高度：频谱柱 + Perlin；jaggedness 量化高度形成「逐格隆起」
 */
export function vizzVertexHeight(lift, opts) {
  const {
    w,
    A,
    B,
    beat,
    mid,
    animT,
    radialMix,
    waveComplexity: c,
    col,
    row,
    cols,
    rows,
    span,
    perlinG: g,
    perlinH: h,
    perlinB: b,
    jaggedness: p
  } = opts

  let Oh =
    radialSpectrumHeight(w, A, B, beat, animT, radialMix, c, mid) * lift * radialHeightTaper(w) +
    softTerrainNoise(col, row, cols, rows, span, animT, g, h, b, lift, w) * 0.65

  Oh *= spectrumHeightGain(w, A, B)

  if (p > 0.1) {
    const steps = Math.max(3, Math.floor(20 * (1 - p)))
    Oh = Math.floor(Oh * steps) / steps
  }

  return Math.max(0, Oh)
}

/**
 * 蹦床地表：中心抬升 + 外扩行波，均由 centerIntensity 统一缩放
 */
export function elasticSurfaceHeight(lift, w, _C, animT, intensity = 0, beat = 0, B = 0) {
  const eff = effectiveRhythmIntensity(intensity)
  const dome = lift * radialEnvelope(w, 1.2) * eff * 0.36
  const train = outwardRippleTrain(lift, w, animT, intensity, beat, B) * 1.05
  return dome + train
}

/** 节拍脉冲：强拍时相位前冲 + 额外一圈 */
export function rhythmPulseHeight(lift, w, intensity, beat, animT) {
  if (beat < 0.04) return 0
  const eff = effectiveRhythmIntensity(intensity)
  const surge = outwardRippleTrain(lift, w, animT, intensity * (0.9 + beat * 0.5), beat * 1.15, 0)
  const peak = lift * radialEnvelope(w, 1.05) * eff * beat * beat * 0.42
  return surge * 0.55 + peak
}

/** vizz: smoothK = dampeningFactor * (1 - 0.5 * jaggedness) */
export function rhythmSmoothFactor(baseSmooth, _intensity, _beat, _B, jaggedness = 0.15) {
  return baseSmooth * (1 - 0.5 * jaggedness)
}

export function idleTerrainHeight(lift, w, animT, col, row, cols, rows, span, g, h, b, radialMix, c) {
  return vizzVertexHeight(lift, {
    w,
    A: 0.07,
    B: 0,
    beat: 0,
    mid: 0,
    animT,
    radialMix,
    waveComplexity: c,
    col,
    row,
    cols,
    rows,
    span,
    perlinG: g,
    perlinH: h,
    perlinB: b,
    jaggedness: 0
  })
}

export function idleTerrainFrequency(w, C, animT) {
  const env = radialEnvelope(w, 2.2)
  const idle =
    env *
    (0.32 + 0.28 * Math.sin(5 * w - animT * 0.85) + 0.14 * Math.sin(4 * C + animT * 0.65))
  return Math.min(1, idle * 0.42)
}

export function spatialBlendFrequencies(freq, cols, rows, blend = 0.22) {
  const tmp = new Float32Array(freq.length)
  const a = Math.max(0, Math.min(0.4, blend))
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const e = row * cols + col
      let sum = freq[e] * 2
      let n = 2
      if (col > 0) {
        sum += freq[e - 1]
        n++
      }
      if (col < cols - 1) {
        sum += freq[e + 1]
        n++
      }
      if (row > 0) {
        sum += freq[e - cols]
        n++
      }
      if (row < rows - 1) {
        sum += freq[e + cols]
        n++
      }
      tmp[e] = freq[e] * (1 - a) + (sum / n) * a
    }
  }
  freq.set(tmp)
}

export function spatialBlendHeights(heights, cols, rows, blend = 0.28) {
  const tmp = new Float32Array(heights.length)
  const a = Math.max(0, Math.min(0.45, blend))
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const e = row * cols + col
      let sum = heights[e] * 2
      let n = 2
      if (col > 0) {
        sum += heights[e - 1]
        n++
      }
      if (col < cols - 1) {
        sum += heights[e + 1]
        n++
      }
      if (row > 0) {
        sum += heights[e - cols]
        n++
      }
      if (row < rows - 1) {
        sum += heights[e + cols]
        n++
      }
      const avg = sum / n
      tmp[e] = heights[e] * (1 - a) + avg * a
    }
  }
  heights.set(tmp)
}
