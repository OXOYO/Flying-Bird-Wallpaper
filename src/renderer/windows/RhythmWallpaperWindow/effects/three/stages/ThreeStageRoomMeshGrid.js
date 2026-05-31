import StageEffectBase from '../stage/core/StageEffectBase.js'
import { buildNeonRoom } from '../stage/room/StageRoomNeon.js'
import { STAGE_MESH_SEGMENTS, STAGE_IDLE_FRAME } from '../stage/core/stageAudioMap.js'
import { getBeatFlash } from '../stage/core/rhythmDrive.js'
import { RoomMeshGrid } from '../stage/roomMeshGrid/RoomMeshGrid.js'
import { ROOM_MESH_GRID_DEFAULTS } from '../stage/vizzMeshGridDefaults.js'
import { buildStageStarfield, disposeStageStarfield } from '../stage/StageStarfield.js'
import * as THREE from 'three'

/**
 * 脉动空间：盒内五面线框随音乐起伏、呼吸（正面开口）。
 */
export class ThreeStageRoomMeshGrid extends StageEffectBase {
  constructor(container, config) {
    super(container, config)
    this.meshSegments = STAGE_MESH_SEGMENTS[config.density] || STAGE_MESH_SEGMENTS.normal
    this.meshGrid = null
    this.starfield = null
    this.time = 0
    this.layout = {}

    if (!this.renderer || !this.stageRoot) return

    this.initStage()
    this._refitOpening()
    this.render(STAGE_IDLE_FRAME)
  }

  initStage() {
    const v = this.view
    const p = v.profile
    const room = buildNeonRoom(this.layerBack, v, p, this.config)

    const meshParams = { ...ROOM_MESH_GRID_DEFAULTS }

    this.layout = { profile: p, meshSegments: this.meshSegments, ...meshParams, ...room }

    this.applyNeonRoomAtmosphere(room)
    this.starfield = buildStageStarfield(this.scene, room.roomD * 1.4, { room })
    this.scene.add(new THREE.AmbientLight(0x1a1e28, 0.22))
    this.scene.add(new THREE.HemisphereLight(0x2a3040, 0x050608, 0.16))

    const wallLight = new THREE.PointLight(0xaa88ff, 0.35, room.roomD * 2.4)
    wallLight.position.set(0, room.roomH * 0.55, room.backZ + 0.8)
    this.scene.add(wallLight)

    this.meshGrid = new RoomMeshGrid(this.layerFront, room, this.config, this.meshSegments, meshParams)
  }

  render(frame) {
    if (!this.meshGrid) return

    const hasSpectrum = frame?.spectrum?.length > 0
    const active = hasSpectrum ? frame : STAGE_IDLE_FRAME
    const beatFlash = getBeatFlash(active)

    this.time += 0.016
    this.meshGrid.update(
      hasSpectrum ? frame.spectrum : null,
      active,
      (v) => this.getMappedValue(v),
      beatFlash,
      this.time,
      0.016
    )

    this.renderScene()
  }

  destroy() {
    disposeStageStarfield(this.starfield)
    this.starfield = null
    this.meshGrid?.dispose()
    this.meshGrid = null
    super.destroy()
  }
}
