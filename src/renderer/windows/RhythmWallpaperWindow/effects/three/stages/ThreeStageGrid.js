import StageEffectBase from '../stage/core/StageEffectBase.js'
import { buildNeonRoom } from '../stage/room/StageRoomNeon.js'
import {
  mapSpectrumToGridLevels,
  mapGridIdleLevels,
  STAGE_GRID_COUNTS,
  STAGE_IDLE_FRAME
} from '../stage/core/stageAudioMap.js'
import { getBeatFlash } from '../stage/core/rhythmDrive.js'
import { FloorGridPillars } from '../stage/floorGrid/FloorGridPillars.js'
import * as THREE from 'three'

/**
 * 地柱网格：每格独立 Box，径向频谱取样 + 中心低频/节拍扩散。
 * 柱数多，渲染器 DPR 上限 2 以保持边缘清晰。
 */
export class ThreeStageGrid extends StageEffectBase {
  constructor(container, config) {
    super(container, config)
    const density = STAGE_GRID_COUNTS[config.density] || STAGE_GRID_COUNTS.normal
    this.gridCols = density.cols
    this.gridRows = density.rows
    this.pillars = null
    this._cellLevels = null
    this.time = 0
    this.layout = {}

    if (!this.renderer || !this.stageRoot) return

    this.initStage()
    this._cellLevels = new Float32Array(this.gridCols * this.gridRows)
    this._refitOpening()
    this.render(STAGE_IDLE_FRAME)
  }

  initStage() {
    const v = this.view
    const p = v.profile
    const room = buildNeonRoom(this.layerBack, v, p, this.config)

    const padX = room.roomW * 0.04
    const padZ = room.roomD * 0.05
    const gridW = room.roomW - padX * 2
    const gridD = room.roomD - padZ * 2
    const cellW = gridW / this.gridCols
    const cellD = gridD / this.gridRows
    const floorY = 0.01
    const deckY = floorY

    const pillarBaseH = Math.max(v.visibleH * 0.008, 0.025)
    const pillarMaxH = v.visibleH * (p.gridMaxHScale ?? 0.22)

    this.layout = {
      profile: p,
      gridCols: this.gridCols,
      gridRows: this.gridRows,
      gridCellW: cellW,
      gridCellD: cellD,
      gridOx: -room.roomW / 2 + padX,
      gridOz: -room.roomD + padZ,
      pillarBaseH,
      pillarMaxH,
      deckY,
      floorY
    }

    Object.assign(this.layout, room)

    this.applyNeonRoomAtmosphere(room)
    this.scene.add(new THREE.AmbientLight(0x1a1e28, 0.32))
    this.scene.add(new THREE.HemisphereLight(0x2a3040, 0x050608, 0.22))

    const wallLight = new THREE.PointLight(0x99bbee, 0.45, room.roomD * 2.4)
    wallLight.position.set(0, room.roomH * 0.55, room.backZ + 0.8)
    this.scene.add(wallLight)

    this.pillars = new FloorGridPillars(this.layerFront, this.layout, this.config)
    this._applyCrispRenderer()
  }

  /** 地柱网格柱体多且细，提高 DPR、避免颜色过曝导致发糊 */
  _applyCrispRenderer() {
    if (!this.renderer) return
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    this.renderer.setPixelRatio(dpr)
    const { width, height } = this.bodySize
    if (width > 0 && height > 0) {
      this.renderer.setSize(width, height, false)
    }
  }

  _audioCtx() {
    return {
      config: this.config,
      barCount: this.gridCols * this.gridRows,
      getMappedValue: (v) => this.getMappedValue(v)
    }
  }

  _smoothCells(targets, frame) {
    const n = this._cellLevels.length
    const pulse = frame?.beatPulse ?? 0
    const rise = frame?.beat || pulse > 0.5 ? 0.55 : 0.38
    const fall = frame?.beat ? 0.14 : 0.1

    for (let i = 0; i < n; i++) {
      let t = targets[i] ?? 0
      if (frame?.beat) t = Math.min(1, t + pulse * 0.12)

      const cur = this._cellLevels[i]
      const k = t > cur ? rise : fall
      this._cellLevels[i] += (t - cur) * k
    }
  }

  _sampleIdleCells(time) {
    const cols = this.gridCols
    const rows = this.gridRows
    const targets = mapGridIdleLevels(cols, rows, time)
    this._smoothCells(targets, STAGE_IDLE_FRAME)
  }

  render(frame) {
    if (!this._cellLevels?.length) return

    const hasSpectrum = frame?.spectrum?.length > 0
    const active = hasSpectrum ? frame : STAGE_IDLE_FRAME
    const cols = this.layout.gridCols ?? this.gridCols
    const rows = this.layout.gridRows ?? this.gridRows

    if (hasSpectrum) {
      const targets = mapSpectrumToGridLevels(
        this._audioCtx(),
        frame.spectrum,
        cols,
        rows,
        frame
      )
      this._smoothCells(targets, active)
    } else {
      this.time += 0.016
      this._sampleIdleCells(this.time)
    }

    const beatFlash = getBeatFlash(active)
    this.pillars?.update(this._cellLevels, beatFlash)
    this.renderScene()
  }

  destroy() {
    this.pillars?.dispose()
    this.pillars = null
    this._cellLevels = null
    super.destroy()
  }
}
