/**
 * 顶光系统：配色数量决定灯数（最多 6），每灯负责一段频谱柱。
 * - SpotLight + 半透明锥体/灯盘/地面光斑
 * - update 时按区段峰值/通量/节拍平移追光，并导出 lights[] 供柱顶混色
 */
import * as THREE from 'three'
import { hexToNumber } from '../stageColorTheme.js'

/** 体积光几何用的半透明加法材质 */
function volMat(opacity = 0.1) {
  return new THREE.MeshBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide
  })
}

/**
 * 顶光：数量/颜色 = config.colors；每盏负责一段频谱，节拍跟能量突变
 */
export class GodRayBeams {
  constructor(parent, layout, hooks) {
    this.parent = parent
    this.layout = layout
    this.hooks = hooks
    this.group = new THREE.Group()
    this.beams = []
    this.beamStates = []
    this._worldTarget = new THREE.Vector3()
    this._localTarget = new THREE.Vector3()
    this._dir = new THREE.Vector3()
    this._down = new THREE.Vector3(0, -1, 0)
    this._prevEnergy = 0
    this._lightPos = new THREE.Vector3()
    this._lightTarget = new THREE.Vector3()
    this._lightDir = new THREE.Vector3()
    this._lightColor = new THREE.Color()
    this.parent.add(this.group)
    this.build()
  }

  build() {
    const { stageW, ceilingY, ceilingZ, rhythmColors = [] } = this.layout
    const spanW = this.layout.stageW ?? stageW * 0.9
    const beamLen = (ceilingY ?? 4) + 0.2
    const colors =
      rhythmColors.length > 0 ? rhythmColors : ['#3388ff', '#5599ff', '#88ccff']
    const count = Math.min(Math.max(colors.length, 1), 6)
    const radiusFloor = Math.min(spanW * 0.068, beamLen * 0.12)
    const spread = count === 1 ? 0 : spanW * 0.88

    for (let i = 0; i < count; i++) {
      const homeX = count === 1 ? 0 : (i / (count - 1) - 0.5) * spread
      const colorHex = colors[i % colors.length]
      const zoneFrom = i / count
      const zoneTo = (i + 1) / count

      const rig = new THREE.Group()
      rig.position.set(homeX, ceilingY, ceilingZ)

      const spot = new THREE.SpotLight(0xffffff, 1, beamLen * 1.5, Math.PI / 4.2, 0.55, 2)
      const spotTarget = new THREE.Object3D()
      spotTarget.position.set(0, -beamLen, 0)
      rig.add(spot)
      rig.add(spotTarget)
      spot.target = spotTarget

      const beamH = beamLen * 0.94
      const poolR = radiusFloor * 1.15
      const rBot = poolR
      const rTop = poolR * 0.16

      const beamMat = volMat(0.11)
      const beam = new THREE.Mesh(
        new THREE.CylinderGeometry(rTop, rBot, beamH, 20, 1, true),
        beamMat
      )
      beam.position.y = -beamH / 2
      rig.add(beam)

      const lampMat = volMat(0.5)
      const lamp = new THREE.Mesh(new THREE.CircleGeometry(rTop * 1.6, 14), lampMat)
      lamp.rotation.x = -Math.PI / 2
      lamp.position.y = -0.05
      rig.add(lamp)

      const floorGroup = new THREE.Group()
      const poolMat = volMat(0.28)
      const pool = new THREE.Mesh(new THREE.CircleGeometry(poolR, 24), poolMat)
      pool.rotation.x = -Math.PI / 2
      floorGroup.add(pool)
      this.group.add(floorGroup)
      this.group.add(rig)

      const beamColor = new THREE.Color(hexToNumber(colorHex))
      spot.color.copy(beamColor)
      ;[beamMat, lampMat, poolMat].forEach((m) => m.color.copy(beamColor))

      this.beams.push({
        rig,
        spot,
        spotTarget,
        beam,
        beamMat,
        lamp,
        lampMat,
        floorGroup,
        pool,
        poolMat,
        homeX,
        colorHex,
        zoneFrom,
        zoneTo,
        smoothX: homeX,
        smoothDrive: 0.28,
        poolR,
        baseConeH: beamH,
        _prevZone: null
      })
    }
  }

  _barIndexToStageX(barIdx, barCount, spanW) {
    if (barCount < 2) return 0
    return ((barIdx / (barCount - 1)) - 0.5) * spanW * 0.94
  }

  /** 在频谱区段内选追光落点：节拍/onset 偏通量峰，否则能量质心 */
  _focusXInZone(barValues, spanW, zoneFrom, zoneTo, beam, hitBeat, hitOnset, flux = 0) {
    const n = barValues.length
    if (n < 2) return 0
    const from = Math.floor(zoneFrom * n)
    const to = Math.max(from + 1, Math.floor(zoneTo * n))

    let maxV = 0.001
    let peakI = from
    let fluxI = from
    let maxFlux = 0
    let wSum = 0
    let wPos = 0
    const prev = beam._prevZone

    for (let i = from; i < to; i++) {
      const v = barValues[i]
      if (v >= maxV) {
        maxV = v
        peakI = i
      }
      const w = v * v
      wSum += w
      wPos += i * w
      const delta = prev ? v - (prev[i - from] ?? v) : 0
      if (delta > maxFlux) {
        maxFlux = delta
        fluxI = i
      }
    }

    beam._prevZone = barValues.slice(from, to)

    if (hitBeat && maxFlux > 0.01) {
      return this._barIndexToStageX(fluxI, n, spanW)
    }
    if (hitOnset && maxFlux > 0.015) {
      return this._barIndexToStageX(fluxI, n, spanW)
    }
    if (wSum > 0.002) {
      const centroid = wPos / wSum
      return this._barIndexToStageX(centroid, n, spanW)
    }
    return this._barIndexToStageX(peakI, n, spanW)
  }

  _snapFocusToBar(stageX, spanW, barCount, zoneFrom, zoneTo) {
    if (barCount < 2) return stageX
    const from = Math.floor(zoneFrom * barCount)
    const to = Math.max(from + 1, Math.floor(zoneTo * barCount))
    const t = stageX / (spanW * 0.94) + 0.5
    let barIdx = Math.round(t * (barCount - 1))
    barIdx = THREE.MathUtils.clamp(barIdx, from, to - 1)
    return this._barIndexToStageX(barIdx, barCount, spanW)
  }

  _sampleBarDrive(barValues, centerIdx, radius = 3) {
    const n = barValues.length
    const from = Math.max(0, centerIdx - radius)
    const to = Math.min(n, centerIdx + radius + 1)
    let sum = 0
    let peak = 0
    for (let i = from; i < to; i++) {
      const v = barValues[i]
      sum += v
      if (v > peak) peak = v
    }
    const avg = sum / (to - from)
    return avg * 0.6 + peak * 0.4
  }

  _stageXToBarIndex(stageX, spanW, barCount) {
    const t = stageX / (spanW * 0.94) + 0.5
    return THREE.MathUtils.clamp(Math.round(t * (barCount - 1)), 0, barCount - 1)
  }

  _bandDriveForZone(zoneFrom, bands = {}) {
    if (zoneFrom < 0.34) return bands.low ?? 0.3
    if (zoneFrom < 0.67) return bands.mid ?? 0.25
    return bands.high ?? 0.2
  }

  /**
   * 每帧更新追光：平移 rig、拉伸锥体、调 SpotLight，并写入 beamStates。
   * barValues 来自 mapSpectrumToBars，与柱体同源。
   */
  update(frame, time, beatFlash, barValues) {
    const { beat, onset = false, energy, flux = 0, bands = {}, rms = 0, beatPulse = 0 } = frame
    const flash = Math.max(beatFlash, beatPulse)
    const { floorY = 0, ceilingY, ceilingZ, floorZ, stageW, barCount = 64 } = this.layout
    const spanW = stageW ?? 10
    const hasBars = barValues?.length > 0
    const barN = barValues?.length ?? barCount

    const punch = Math.max(0, energy - this._prevEnergy) * 0.85 + rms * 0.25
    this._prevEnergy = energy
    const hitBeat = beat || flash > 0.5 || punch > 0.18
    const hitOnset = onset && flash > 0.35
    const globalPulse = (beat ? 0.4 : 0) + (hitOnset ? 0.15 : 0) + flash * 0.28 + punch * 0.45

    this.beamStates = []

    this.beams.forEach((b) => {
      let targetX = b.homeX
      if (hasBars) {
        targetX = this._focusXInZone(
          barValues,
          spanW,
          b.zoneFrom,
          b.zoneTo,
          b,
          hitBeat,
          hitOnset,
          flux
        )
        if (hitBeat) {
          targetX = this._snapFocusToBar(targetX, spanW, barN, b.zoneFrom, b.zoneTo)
        }
      }

      const aimLerp = hitBeat ? 0.62 : hitOnset ? 0.32 : 0.16
      b.smoothX += (targetX - b.smoothX) * aimLerp

      const focusBar = hasBars ? this._stageXToBarIndex(b.smoothX, spanW, barN) : 0
      const bandDrive = this._bandDriveForZone(b.zoneFrom, bands)
      const localDrive = hasBars
        ? bandDrive * 0.55 + this._sampleBarDrive(barValues, focusBar, 3) * 0.45 + energy * 0.15
        : 0.3

      const driveTarget = Math.max(
        0.22,
        localDrive + energy * 0.2 + globalPulse * 0.32 + (beat ? localDrive * 0.4 : 0)
      )

      b.smoothDrive +=
        (driveTarget - b.smoothDrive) *
        (driveTarget > b.smoothDrive ? (hitBeat ? 0.36 : 0.18) : 0.08)

      const strength = 0.3 + b.smoothDrive * 0.85 + globalPulse * 0.4
      const hitY = floorY + 0.04
      this._worldTarget.set(b.smoothX, hitY, floorZ)
      b.rig.position.set(b.homeX, ceilingY, ceilingZ)

      this._dir.subVectors(this._worldTarget, b.rig.position).normalize()
      if (this._dir.lengthSq() > 0.0001) {
        b.rig.quaternion.setFromUnitVectors(this._down, this._dir)
      } else {
        b.rig.quaternion.identity()
      }

      const beamDist = Math.max(b.rig.position.distanceTo(this._worldTarget), 0.15)
      const lenScale = beamDist / b.baseConeH
      const poolS = 0.55 + strength * 0.32
      b.beam.scale.set(poolS, lenScale, poolS)
      b.beam.position.y = -beamDist / 2

      this._localTarget.copy(this._worldTarget)
      b.rig.worldToLocal(this._localTarget)
      b.spotTarget.position.copy(this._localTarget)

      const floorDist = Math.max(beamDist, 0.2)
      const spotHalfAngle = Math.atan((b.poolR * poolS) / floorDist)
      b.spot.angle = THREE.MathUtils.clamp(spotHalfAngle * 2.02, 0.12, Math.PI / 2.4)
      b.spot.penumbra = 0.42
      b.spot.distance = beamDist * 1.35
      b.spot.decay = 2
      b.spot.intensity = 280 + b.smoothDrive * 520 + globalPulse * 180
      b._beamDist = beamDist
      b._poolRadius = b.poolR * poolS

      b.beamMat.opacity = THREE.MathUtils.clamp(0.055 + strength * 0.1, 0.045, 0.18)
      b.lampMat.opacity = THREE.MathUtils.clamp(0.28 + strength * 0.38, 0.25, 0.82)

      b.floorGroup.position.set(b.smoothX, floorY + 0.02, floorZ)
      b.pool.scale.set(poolS, poolS, 1)
      b.poolMat.opacity = THREE.MathUtils.clamp(0.1 + strength * 0.22, 0.08, 0.38)

      this.beamStates.push({
        x: b.smoothX,
        colorHex: b.colorHex,
        radius: b.poolR * poolS,
        zoneFrom: b.zoneFrom,
        zoneTo: b.zoneTo
      })
    })
  }

  getBeamStates() {
    return this.beamStates
  }

  /** 世界空间追光（供频谱柱 CPU 锥体着色） */
  getSpotlightDescriptors() {
    const out = []
    this.group.updateMatrixWorld(true)

    for (const b of this.beams) {
      b.rig.updateMatrixWorld(true)
      b.spotTarget.updateMatrixWorld(true)
      b.rig.getWorldPosition(this._lightPos)
      b.spotTarget.getWorldPosition(this._lightTarget)
      this._lightDir.subVectors(this._lightTarget, this._lightPos)
      const beamLength = this._lightDir.length()
      if (beamLength < 0.001) continue
      this._lightDir.multiplyScalar(1 / beamLength)
      this._lightColor.setHex(hexToNumber(b.colorHex))

      out.push({
        position: this._lightPos.clone(),
        direction: this._lightDir.clone(),
        color: this._lightColor.clone(),
        beamLength,
        poolRadius: b._poolRadius ?? b.poolR,
        targetX: b.smoothX,
        targetZ: this.layout.floorZ ?? 0,
        strength: 1.15
      })
    }
    return out
  }

  dispose() {
    this.beams.forEach((b) => {
      b.rig.traverse((c) => {
        c.geometry?.dispose()
        if (c.material) {
          const mats = Array.isArray(c.material) ? c.material : [c.material]
          mats.forEach((m) => m.dispose?.())
        }
      })
      b.floorGroup.traverse((c) => {
        c.geometry?.dispose()
        if (c.material) c.material.dispose?.()
      })
    })
    this.parent.remove(this.group)
  }
}
