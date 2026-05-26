import StageEffectBase from '../stage/core/StageEffectBase.js'
import { buildNeonRoom } from '../stage/room/StageRoomNeon.js'
import { STAGE_IDLE_FRAME } from '../stage/core/stageAudioMap.js'
import { getBeatFlash } from '../stage/core/rhythmDrive.js'
import { TexturedSphereVisualizer } from '../stage/sphere/TexturedSphereVisualizer.js'
import * as THREE from 'three'

/** 经纬球细分（常见 64–350；波形已去掉 atan 避免接缝） */
const SPHERE_DETAIL = { sparse: 56, normal: 80, dense: 100 }

/** 霓虹盒中央悬空纹理球 */
export class ThreeStageTexturedSphere extends StageEffectBase {
  constructor(container, config) {
    super(container, config)
    this.sphereDetail = SPHERE_DETAIL[config.density] ?? SPHERE_DETAIL.normal
    this.sphere = null
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

    const fit = Math.min(room.roomW, room.roomH, room.roomD)
    const sphereRadius = fit * 0.26

    this.layout = {
      profile: p,
      sphereRadius,
      sphereSize: sphereRadius * 1.08,
      sphereY: room.roomH * 0.5,
      sphereZ: -room.roomD * 0.5,
      sphereDetail: this.sphereDetail,
      displacementScale: 0.55,
      noiseScale: 2.8,
      noiseIntensity: 0.48,
      noiseSpeed: 0.38,
      colorIntensity: 2.6,
      vertexAudioMix: 0.06,
      waveIntensity: 0.04,
      waveFrequency: 3.5,
      waveSpeed: 0.45,
      smoothingFactor: 0.55,
      sensitivity: 1.65,
      rotationSpeed: 0.0012,
      showSolidInterior: false
    }
    Object.assign(this.layout, room)

    this.applyNeonRoomAtmosphere(room)
    this.scene.add(new THREE.AmbientLight(0x1a1e28, 0.3))
    this.scene.add(new THREE.HemisphereLight(0x2a3040, 0x050608, 0.22))

    const wallLight = new THREE.PointLight(0x99bbee, 0.5, room.roomD * 2.8)
    wallLight.position.set(0, room.roomH * 0.55, room.backZ + 0.6)
    this.scene.add(wallLight)

    const rim = new THREE.PointLight(0xff6688, 0.35, sphereRadius * 6)
    rim.position.set(0, this.layout.sphereY + sphereRadius * 0.3, this.layout.sphereZ)
    this.scene.add(rim)

    this.sphere = new TexturedSphereVisualizer(this.layerFront, this.layout, this.config)
  }

  render(frame) {
    if (!this.sphere) return

    const hasSpectrum = frame?.spectrum?.length > 0
    const active = hasSpectrum ? frame : STAGE_IDLE_FRAME
    const beatFlash = getBeatFlash(active)

    if (hasSpectrum) {
      this.time += 0.016
      this.sphere.update(
        frame.spectrum,
        active,
        (val) => this.getMappedValue(val),
        this.time,
        beatFlash,
        0.016
      )
    } else {
      this.time += 0.016
      this.sphere.updateIdle(this.time, beatFlash)
    }

    this.renderScene()
  }

  destroy() {
    this.sphere?.dispose()
    this.sphere = null
    super.destroy()
  }
}
