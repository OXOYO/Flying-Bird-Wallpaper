import StageEffectBase from '../stage/core/StageEffectBase.js'
import { buildNeonRoom } from '../stage/room/StageRoomNeon.js'
import { getRhythmColors, hexToNumber } from '../stageColorTheme.js'
import { WallMatrixVisualizer } from '../stage/wall/WallMatrixVisualizer.js'
import { MatrixFloorGlow } from '../stage/wall/MatrixFloorGlow.js'
import {
  mapSpectrumToWallLevels,
  buildMatrixFromColumnLevels,
  STAGE_BAR_COUNTS,
  STAGE_IDLE_FRAME
} from '../stage/core/stageAudioMap.js'
import { getBeatFlash } from '../stage/core/rhythmDrive.js'
import * as THREE from 'three'

/**
 * 霓虹墙：后墙 Canvas 像素矩阵 + 地面列向光晕。
 * fitPlaneZ 略靠前，强化透视凹感；矩阵仅自底向上亮行（均衡器样式）。
 */
export class ThreeStageWall extends StageEffectBase {
  constructor(container, config) {
    super(container, config)
    this.barCount = STAGE_BAR_COUNTS[config.density] || STAGE_BAR_COUNTS.normal
    this.wallCols = Math.min(64, Math.max(40, this.barCount))
    this.matrix = null
    this.floorGlow = null
    this.time = 0
    this._colLevels = null
    this.layout = {}

    if (!this.renderer || !this.stageRoot) return

    this.initStage()
    this._refitOpening()
    this.updateCanvasLayout()
    this._colLevels = new Float32Array(this.layout.matrixCols)
  }

  initStage() {
    const v = this.view
    const p = v.profile
    const rhythmColors = getRhythmColors(this.config)

    const room = buildNeonRoom(this.layerBack, v, p, this.config)

    const matrixCols = this.wallCols
    const matrixRows = Math.min(36, Math.max(22, Math.floor(room.roomH * 1.55)))

    this.layout = {
      rhythmColors,
      profile: p,
      matrixCols,
      matrixRows,
      matrixPadX: 0.004,
      matrixPadY: 0.008
    }

    Object.assign(this.layout, room)
    // 贴合平面略靠前（非后墙 matrixZ），相机退远、侧墙/地面透视更明显；矩阵仍可读
    this.layout.fitPlaneZ = room.backZ * 0.28
    this.layout.fitSpanX = 1.76
    this.layout.fitSpanY = 1.66
    this.layout.stageW = room.roomW * (p.stageWScale ?? 0.9)
    this.layout.ceilingY = room.roomH
    this.layout.floorY = 0

    this.applyNeonRoomAtmosphere(room)
    this.scene.add(new THREE.AmbientLight(0x1a1e28, 0.32))
    this.scene.add(new THREE.HemisphereLight(0x2a3040, 0x050608, 0.22))

    const wallLight = new THREE.PointLight(0x99bbee, 0.55, room.roomD * 2.4)
    wallLight.position.set(0, room.roomH * 0.55, room.backZ + 0.8)
    this.scene.add(wallLight)

    const colorNums = rhythmColors.map((h) => hexToNumber(h))
    this.floorGlow = new MatrixFloorGlow(this.layerMid, room, colorNums)
    this.matrix = new WallMatrixVisualizer(this.layerFront, this.layout, this.config)
  }

  _audioCtx() {
    return {
      config: this.config,
      barCount: this.barCount,
      getMappedValue: (v) => this.getMappedValue(v)
    }
  }

  /** 列电平时间平滑：上升快、下降慢，beat 时略抬目标 */
  _smoothColumnLevels(targets, frame) {
    const cols = this._colLevels.length
    const pulse = frame?.beatPulse ?? 0
    const rise = frame?.beat ? 0.48 : pulse > 0.4 ? 0.34 : 0.24
    const fall = frame?.beat ? 0.11 : 0.09

    for (let c = 0; c < cols; c++) {
      let t = targets[c] ?? 0
      if (frame?.beat) t = Math.min(1, t + pulse * 0.1)

      const cur = this._colLevels[c]
      const k = t > cur ? rise : fall
      this._colLevels[c] += (t - cur) * k
    }
  }

  _sampleIdleLevels(time) {
    const cols = this._colLevels.length
    for (let c = 0; c < cols; c++) {
      const w1 = Math.sin(time * 2.4 + c * 0.19) * 0.5 + 0.5
      const w2 = Math.sin(time * 1.1 + c * 0.41 + 1.2) * 0.5 + 0.5
      const target = 0.1 + w1 * 0.22 + w2 * 0.14
      this._colLevels[c] += (target - this._colLevels[c]) * 0.12
    }
  }

  render(frame) {
    this.time += 0.016
    const hasSpectrum = frame?.spectrum?.length > 0
    const cols = this.layout.matrixCols
    const rows = this.layout.matrixRows

    const activeFrame = hasSpectrum ? frame : STAGE_IDLE_FRAME

    if (hasSpectrum) {
      const targets = mapSpectrumToWallLevels(this._audioCtx(), frame.spectrum, cols, frame)
      this._smoothColumnLevels(targets, activeFrame)
    } else {
      this._sampleIdleLevels(this.time)
    }

    const matrixVals = buildMatrixFromColumnLevels(this._colLevels, cols, rows)
    const beatFlash = getBeatFlash(activeFrame)

    this.matrix?.update(matrixVals, beatFlash)
    this.floorGlow?.update(matrixVals, cols, rows)
    this.renderScene()
  }

  destroy() {
    this.matrix?.dispose()
    this.floorGlow?.dispose()
    this.matrix = null
    this.floorGlow = null
    this._colLevels = null
    super.destroy()
  }
}
