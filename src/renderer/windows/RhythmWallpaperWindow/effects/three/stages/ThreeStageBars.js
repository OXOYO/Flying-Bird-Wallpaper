import StageEffectBase from '../stage/core/StageEffectBase.js'
import { GodRayBeams } from '../lighting/GodRayBeams.js'
import { buildStageRoom } from '../StageRoomBox.js'
import { getRhythmColors, getBeamCountFromColors } from '../stageColorTheme.js'
import { mixLightsAtPoint } from '../lighting/barConeLighting.js'
import {
  mapSpectrumToBars,
  STAGE_IDLE_FRAME,
  STAGE_BAR_COUNTS
} from '../stage/core/stageAudioMap.js'
import { applyRhythmToBars, getBeatFlash } from '../stage/core/rhythmDrive.js'
import * as THREE from 'three'

/** 单根柱体径向分段（圆柱侧面） */
const BAR_SEGMENTS = 10

/**
 * 演唱会柱舞台：渐变房间 + 顶光追光 + 频谱柱。
 * 柱顶采样追光锥色（barConeLighting），与 GodRayBeams 分区联动。
 */
export class ThreeStageBars extends StageEffectBase {
  constructor(container, config) {
    super(container, config)
    this.barCount = STAGE_BAR_COUNTS[config.density] || STAGE_BAR_COUNTS.normal
    this.barGroup = null
    this.barColumns = []
    this.barHeights = new Float32Array(this.barCount)
    this.godRays = null
    this.time = 0
    this._barSegGeo = null
    this._worldProbe = new THREE.Vector3()
    this._idleValues = new Float32Array(this.barCount)
    this.layout = {}

    if (!this.renderer || !this.stageRoot) {
      console.warn('ThreeStageBars: renderer not ready, skip init')
      return
    }

    this.initStage()
    this._refitOpening()

    for (let i = 0; i < this.barCount; i++) {
      this._idleValues[i] = 0.18 + Math.sin(i * 0.35) * 0.12
    }
    this.render(STAGE_IDLE_FRAME)
  }

  initStage() {
    if (!this.layerBack) return

    const v = this.view
    const p = v.profile
    const rhythmColors = getRhythmColors(this.config)
    this.layout = {
      barMaxH: v.visibleH * (p.barMaxHScale ?? 0.3),
      baseBarH: Math.max(v.visibleH * (p.baseBarHScale ?? 0.028), v.visibleH * 0.022),
      beamCount: getBeamCountFromColors(this.config),
      rhythmColors,
      barCount: this.barCount,
      beamSpread: p.beamSpread ?? 0.3,
      profile: p
    }

    const room = buildStageRoom(this.layerBack, v, p, this.config)
    Object.assign(this.layout, room)
    this.layout.stageW = room.roomW * (p.stageWScale ?? 0.9)

    this.applySceneAtmosphere(room.roomBg ?? 0x121418, room.roomD, 0.45, 2.75)
    this.scene.add(new THREE.AmbientLight(0x0a0c10, 0.008))

    this.godRays = new GodRayBeams(this.layerMid, this.layout, {})
    this._addSpectrumBars()
  }

  getBarStageX(barIndex) {
    const stageW = this.layout.stageW ?? 10
    const n = this.barCount
    if (n < 2) return 0
    return ((barIndex / (n - 1)) - 0.5) * stageW * 0.94
  }

  _audioCtx() {
    return {
      config: this.config,
      barCount: this.barCount,
      getMappedValue: (v) => this.getMappedValue(v)
    }
  }

  mapSpectrumToBars(spectrum) {
    return mapSpectrumToBars(this._audioCtx(), spectrum)
  }

  /** 分段圆柱柱体叠放，便于按段采样顶光颜色 */
  _addSpectrumBars() {
    const { stageW, baseBarH, floorY, floorZ } = this.layout
    const deckTopY = (floorY ?? 0) + 0.04
    const slotW = stageW / this.barCount
    const barW = slotW *  0.52
    const barD = slotW * 0.48
    const segH = baseBarH / BAR_SEGMENTS
    this._barSegGeo = new THREE.BoxGeometry(barW, segH, barD)

    this.barGroup = new THREE.Group()
    this.barColumns = []
    for (let i = 0; i < this.barCount; i++) {
      const column = new THREE.Group()
      column.position.set(this.getBarStageX(i), deckTopY, floorZ)
      const segments = []
      for (let s = 0; s < BAR_SEGMENTS; s++) {
        const mat = new THREE.MeshBasicMaterial({
          color: 0x020203,
          toneMapped: false,
          fog: false
        })
        mat.userData.baseEmissive = 0
        const mesh = new THREE.Mesh(this._barSegGeo, mat)
        mesh.frustumCulled = false
        mesh.position.y = (s + 0.5) * segH
        column.add(mesh)
        segments.push({ mesh, mat })
      }
      this.barGroup.add(column)
      this.barColumns.push({ column, segments })
      this.barHeights[i] = baseBarH
    }

    this._barLayout = {
      barMaxH: this.layout.barMaxH,
      baseBarH,
      deckTopY,
      segH
    }
    this.layerFront.add(this.barGroup)
  }

  /** 柱高平滑 + 每段 world 位置混色（无光则近黑） */
  updateBars(values, frame = {}) {
    const { barMaxH, baseBarH, deckTopY } = this._barLayout
    const lights = this.godRays?.getSpotlightDescriptors?.() ?? []
    const pulse = frame.beatPulse ?? 0
    const lerpH = frame.beat ? 0.42 : pulse > 0.55 ? 0.34 : pulse > 0.25 ? 0.26 : 0.2
    this.barGroup?.updateMatrixWorld(true)

    for (let i = 0; i < this.barCount; i++) {
      const col = this.barColumns[i]
      if (!col) continue

      const v = values[i] || 0
      const pulseBoost = 1 + (frame.beatPulse ?? 0) * 0.12
      const target = baseBarH + v * barMaxH * pulseBoost
      this.barHeights[i] += (target - this.barHeights[i]) * lerpH
      const h = this.barHeights[i]
      col.column.scale.set(1, Math.max(h / baseBarH, 0.25), 1)
      col.column.position.y = deckTopY
      col.column.updateMatrixWorld(true)

      for (let s = 0; s < col.segments.length; s++) {
        const seg = col.segments[s]
        seg.mesh.getWorldPosition(this._worldProbe)
        const lit = mixLightsAtPoint(this._worldProbe, lights, v)
        if (lit.r + lit.g + lit.b > 0.1) {
          seg.mat.color.copy(lit)
          const boost = 1.15 + v * 0.65
          seg.mat.color.r = Math.min(1, lit.r * boost)
          seg.mat.color.g = Math.min(1, lit.g * boost)
          seg.mat.color.b = Math.min(1, lit.b * boost)
        } else {
          seg.mat.color.setRGB(0.006, 0.005, 0.008)
        }
      }
    }
  }

  render(frame) {
    if (!this.barColumns?.length) {
      this.renderScene()
      return
    }
    this.time += 0.016
    const hasSpectrum = frame?.spectrum?.length > 0
    const activeFrame = hasSpectrum ? frame : STAGE_IDLE_FRAME
    let values = hasSpectrum ? this.mapSpectrumToBars(frame.spectrum) : this._idleValues
    if (hasSpectrum) {
      values = applyRhythmToBars(values, activeFrame)
    }
    const beatFlash = getBeatFlash(activeFrame)
    this.godRays?.update(activeFrame, this.time, beatFlash, values)
    this.updateBars(values, activeFrame)
    this.renderScene()
  }

  destroy() {
    this.godRays?.dispose()
    this.godRays = null
    this.barColumns?.forEach((col) => {
      col.segments?.forEach((seg) => seg.mat?.dispose())
    })
    this._barSegGeo?.dispose()
    this._barSegGeo = null
    this.barColumns = []
    this.barGroup = null
    super.destroy()
  }
}
