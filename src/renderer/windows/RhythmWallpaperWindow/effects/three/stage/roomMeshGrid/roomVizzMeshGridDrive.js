import { smoothToward } from '../vizzPerlin.js'
import {
  scaledAnimTime,
  vizzVertexHeight,
  rhythmSmoothFactor,
  softenDisplacement,
  spatialBlendFrequencies,
  idleTerrainHeight,
  idleTerrainFrequency
} from '../vizzMeshGridTerrain.js'

function applyVertexHeight(positions, basePositions, i3, axis, bend, h) {
  positions[i3] = basePositions[i3]
  positions[i3 + 1] = basePositions[i3 + 1]
  positions[i3 + 2] = basePositions[i3 + 2]
  positions[i3 + axis] = basePositions[i3 + axis] + bend + h
}

/** 全盒线框：局部 XY 平面沿法线 +Z 位移 */
export function driveRoomVizzMeshGrid(state, spectrum, dt) {
  const {
    positions,
    basePositions,
    frequencies,
    smoothHeights,
    cols,
    rows,
    bufferLength,
    time,
    params
  } = state

  const {
    waveHeight,
    waveSpeed,
    waveComplexity: c = 1,
    dampeningFactor: f = 0.85,
    jaggedness: p = 0.15,
    perlinNoiseIntensity: g = 0.2,
    perlinNoiseScale: h = 0.1,
    perlinNoiseSpeed: b = 0.1,
    meshBend: v = 0,
    radialMix: x = 0.5,
    sensitivity: S = 1,
    beatFlash = 0
  } = params

  const bufLen = bufferLength || spectrum?.length || 0
  if (!bufLen) return

  const animT = scaledAnimTime(time, waveSpeed)

  const P = Math.floor(0.1 * bufLen)
  const I = Math.floor(0.5 * bufLen)
  let E = 0
  for (let i = 0; i < P; i++) E += spectrum[i]
  let F = 0
  for (let i = P; i < I; i++) F += spectrum[i]
  const B = E / (0.1 * bufLen) / 255
  const _ = F / (0.4 * bufLen) / 255

  const j = (cols - 1) / 2
  const q = (rows - 1) / 2
  const O = Math.sqrt(j * j + q * q)
  const L = O > 0 ? 1 / O : 0
  const U = cols * rows
  const lift = waveHeight * S
  const dispAxis = state.displaceAxis ?? 2

  for (let e = 0; e < U; e++) {
    const col = e % cols
    const row = (e / cols) | 0
    const d = col - j
    const y = row - q
    const w = Math.min(Math.sqrt(d * d + y * y) * L, 1)
    const C = Math.atan2(y, d)
    const M = (C + Math.PI) / (2 * Math.PI)

    const D = Math.min(Math.floor(w * (bufLen - 1)), bufLen - 1)
    const A = ((spectrum[D] ?? 0) / 255) * S

    let T = 0
    let Pj = 0
    if (x > 0) {
      const ce = Math.pow(c, 0.7)
      T = 0.3 * Math.sin(4 * C + animT) * p * x
      if (c > 0.3) {
        T += 0.2 * Math.sin(8 * C - 1.5 * animT) * p * x * ((c - 0.3) / 0.7)
      }
      if (c > 0.6) {
        T += 0.15 * Math.sin(12 * C + 0.7 * animT) * p * x * ((c - 0.6) / 0.4)
      }
      Pj =
        Math.sin(Math.floor(M * (4 + 8 * ce)) / (4 + 8 * ce) * Math.PI * (8 + 16 * ce)) *
        p *
        0.2 *
        x
    }

    let Ic = 0
    if (x < 1) {
      Ic = 0.35 * Math.sin(6 * w - 1.5 * animT) * A * (1 - x)
      if (c > 0.2) {
        const ce = Math.min(1, (c - 0.2) / 0.8)
        Ic += 0.35 * Math.sin(8 * w - animT * 1.1) * ce * A * (1 - x)
      }
      if (c > 0.4) {
        const ce = Math.min(1, (c - 0.4) / 0.6)
        Ic += Math.sin(5 * w - 2 * animT) * (B + _) * 0.45 * ce * (1 - x)
      }
    }

    let Efreq = A + T + Pj + Ic
    if (p > 0.1) {
      const steps = Math.max(3, Math.floor(20 * (1 - p)))
      Efreq = Math.floor(Efreq * steps) / steps
    }
    Efreq = Math.min(1, Math.max(0, Efreq))
    frequencies[e] = Efreq

    let Oh = vizzVertexHeight(lift, {
      w,
      A,
      B,
      beat: beatFlash,
      mid: _,
      animT,
      radialMix: x,
      waveComplexity: c,
      col,
      row,
      cols,
      rows,
      span: state.meshSpan ?? 177,
      perlinG: g,
      perlinH: h,
      perlinB: b,
      jaggedness: p
    })

    Oh = softenDisplacement(Oh, lift * 1.06)

    const smoothK = rhythmSmoothFactor(f, 0, beatFlash, B, p)
    const V = smoothToward(smoothHeights[e], Oh, smoothK, dt)
    smoothHeights[e] = V
  }

  for (let e = 0; e < U; e++) {
    const col = e % cols
    const row = (e / cols) | 0
    const d = col - j
    const y = row - q
    const w = Math.min(Math.sqrt(d * d + y * y) * L, 1)
    const bend = v !== 0 ? v * (1 - w * w * 2) : 0
    applyVertexHeight(positions, basePositions, e * 3, dispAxis, bend, smoothHeights[e])
  }

  spatialBlendFrequencies(frequencies, cols, rows, 0.2)
}

export function driveRoomVizzMeshGridIdle(state, dt) {
  const { positions, basePositions, frequencies, smoothHeights, cols, rows, time, params } =
    state
  const waveHeight = params.waveHeight ?? 1
  const waveSpeed = params.waveSpeed ?? 2.4
  const g = params.perlinNoiseIntensity ?? 0.2
  const h = params.perlinNoiseScale ?? 0.1
  const b = params.perlinNoiseSpeed ?? 0.1
  const f = params.dampeningFactor ?? 0.85
  const animT = scaledAnimTime(time, waveSpeed)
  const lift = waveHeight * (params.sensitivity ?? 1) * 0.55
  const span = state.meshSpan ?? 177

  const j = (cols - 1) / 2
  const q = (rows - 1) / 2
  const O = Math.sqrt(j * j + q * q)
  const L = O > 0 ? 1 / O : 0
  const U = cols * rows

  for (let e = 0; e < U; e++) {
    const col = e % cols
    const row = (e / cols) | 0
    const d = col - j
    const y = row - q
    const w = Math.min(Math.sqrt(d * d + y * y) * L, 1)
    const C = Math.atan2(y, d)

    frequencies[e] = idleTerrainFrequency(w, C, animT)
    const target = idleTerrainHeight(
      lift,
      w,
      animT,
      col,
      row,
      cols,
      rows,
      span,
      g,
      h,
      b,
      params.radialMix ?? 0.5,
      params.waveComplexity ?? 1
    )
    const V = smoothToward(
      smoothHeights[e],
      softenDisplacement(target, lift),
      f * (1 - 0.5 * (params.jaggedness ?? 0.15)),
      dt
    )
    smoothHeights[e] = V
  }

  const dispAxis = state.displaceAxis ?? 2
  for (let e = 0; e < U; e++) {
    applyVertexHeight(positions, basePositions, e * 3, dispAxis, 0, smoothHeights[e])
  }

  spatialBlendFrequencies(frequencies, cols, rows, 0.2)
}
