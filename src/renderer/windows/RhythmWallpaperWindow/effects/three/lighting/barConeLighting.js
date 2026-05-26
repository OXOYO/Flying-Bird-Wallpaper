/**
 * 追光锥体采样：供频谱柱顶面混色，与 GodRayBeams 几何一致（锥体 + 地面圆斑）。
 * 复用模块级 Vector3/Color，避免每柱每帧分配。
 */
import * as THREE from 'three'

/**
 * 单灯对 worldPos 的照度权重（锥内 + 地面光斑 + 距离衰减）。
 * @returns {number} 0..1，光斑外为 0
 */
export function sampleConeLit(worldPos, light) {
  const dx = worldPos.x - light.targetX
  const dz = worldPos.z - light.targetZ
  const poolDist = Math.hypot(dx, dz)
  const pr = light.poolRadius
  if (poolDist > pr * 0.94) return 0
  const pool = 1 - THREE.MathUtils.smoothstep(pr * 0.55, pr * 0.9, poolDist)

  const toP = _v0.subVectors(worldPos, light.position)
  const t = toP.dot(light.direction)
  const beamLen = light.beamLength
  if (t < 0 || t > beamLen * 1.06) return 0

  const onAxis = _v1.copy(light.direction).multiplyScalar(t)
  const radial = _v2.copy(toP).sub(onAxis).length()
  const along = Math.min(t / Math.max(beamLen, 0.001), 1)
  const rAtT = pr * along
  const cone = 1 - THREE.MathUtils.smoothstep(rAtT * 0.85, rAtT * 1.02, radial)
  if (cone < 0.02) return 0

  const dist = toP.length()
  const att = 1 / (1 + 0.05 * dist + 0.0006 * dist * dist)
  return pool * cone * att
}

/** 多灯叠加混色；光斑外保持近黑 */
export function mixLightsAtPoint(worldPos, lights, energy = 1) {
  _acc.setRGB(0, 0, 0)
  for (let i = 0; i < lights.length; i++) {
    const L = lights[i]
    const w = sampleConeLit(worldPos, L)
    if (w < 0.06) continue
    const gain = (0.9 + energy * 0.35) * w * (L.strength ?? 1)
    _acc.r = Math.min(_acc.r + L.color.r * gain, 1)
    _acc.g = Math.min(_acc.g + L.color.g * gain, 1)
    _acc.b = Math.min(_acc.b + L.color.b * gain, 1)
  }
  return _acc
}

/** 采样过程临时向量/累加色，勿在并发路径复用 */
const _v0 = new THREE.Vector3()
const _v1 = new THREE.Vector3()
const _v2 = new THREE.Vector3()
const _acc = new THREE.Color()
