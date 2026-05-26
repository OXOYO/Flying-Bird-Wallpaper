import * as THREE from 'three'
import { TEXTURED_SPHERE_VERT, TEXTURED_SPHERE_FRAG } from '../shaders/texturedSphereShaders.js'
import { buildRhythmShaderColors } from '../../stageColorTheme.js'
import { smoothToward } from '../core/stagePerlin.js'

/**
 * 中央纹理球：ShaderMaterial 顶点位移 + rhythmPalette 片元着色。
 * audioData[128] 由频谱重采样并平滑写入；solidMesh 默认隐藏，仅保留调试/扩展用。
 */
export class TexturedSphereVisualizer {
  constructor(parent, layout, config) {
    this.parent = parent
    this.layout = layout
    this.config = config

    this.radius = layout.sphereRadius ?? 1.2
    this.sphereSize = layout.sphereSize ?? this.radius
    const detail = layout.sphereDetail ?? 64

    const geo = new THREE.SphereGeometry(1, detail, detail)
    /** 与着色器 audioData[128] 长度一致 */
    this._audio = new Float32Array(128)

    const rhythm = buildRhythmShaderColors(config)
    const mat = new THREE.ShaderMaterial({
      uniforms: {
        uColors: { value: rhythm.colors },
        uColorCount: { value: rhythm.colorCount },
        time: { value: 0 },
        audioData: { value: this._audio },
        sphereSize: { value: this.sphereSize },
        displacementScale: { value: layout.displacementScale ?? 0.5 },
        vertexAudioMix: { value: layout.vertexAudioMix ?? 0 },
        waveIntensity: { value: layout.waveIntensity ?? 0 },
        waveFrequency: { value: layout.waveFrequency ?? 3 },
        waveSpeed: { value: layout.waveSpeed ?? 0.5 },
        noiseScale: { value: layout.noiseScale ?? 2.5 },
        noiseIntensity: { value: layout.noiseIntensity ?? 0.4 },
        noiseSpeed: { value: layout.noiseSpeed ?? 0.32 },
        colorIntensity: { value: layout.colorIntensity ?? 2.4 }
      },
      vertexShader: TEXTURED_SPHERE_VERT,
      fragmentShader: TEXTURED_SPHERE_FRAG,
      wireframe: false,
      side: THREE.DoubleSide,
      transparent: false,
      depthWrite: true,
      depthTest: true,
      toneMapped: false,
      fog: false
    })

    this.wireMesh = new THREE.Mesh(geo, mat)
    this.wireMesh.frustumCulled = false
    this.wireMesh.renderOrder = 4

    const solidMat = new THREE.MeshBasicMaterial({
      color: rhythm.colors[0].clone(),
      transparent: false
    })
    this.solidMesh = new THREE.Mesh(new THREE.SphereGeometry(0.99, detail, detail), solidMat)
    this.solidMesh.visible = false

    this.group = new THREE.Group()
    this.group.position.set(0, layout.sphereY ?? 1, layout.sphereZ ?? -2)
    this.group.add(this.solidMesh)
    this.group.add(this.wireMesh)
    parent.add(this.group)

    this._smoothing = layout.smoothingFactor ?? 0.6
    this._rotationSpeed = layout.rotationSpeed ?? 0.001
    this._sensitivity = layout.sensitivity ?? 1.5
  }

  /** 将 Byte 频谱压缩到 128 路并指数平滑，减轻闪烁 */
  _fillAudio(spectrum, sensitivity) {
    const n = spectrum.length
    const out = this._audio
    for (let i = 0; i < 128; i++) {
      const idx = Math.min(n - 1, Math.floor((i / 128) * n))
      const target = (spectrum[idx] / 255) * sensitivity
      out[i] = smoothToward(out[i], target, this._smoothing, 0.016)
    }
  }

  /** 无音频时的假频谱，保持球体缓慢呼吸 */
  _fillAudioIdle(time) {
    const out = this._audio
    for (let i = 0; i < 128; i++) {
      const target =
        0.15 +
        0.35 * (Math.sin(time * 2 + i * 0.12) * 0.5 + 0.5) +
        0.2 * (Math.cos(time * 1.1 + i * 0.08) * 0.5 + 0.5)
      out[i] = smoothToward(out[i], target, this._smoothing, 0.016)
    }
  }

  /** 同步 layout 参数、配色、缩放与缓慢自转 */
  _syncUniforms(time, dt, beatFlash = 0) {
    const u = this.wireMesh.material.uniforms
    u.time.value += dt * 0.01
    u.sphereSize.value = this.sphereSize

    const disp = this.layout.displacementScale ?? 0.62
    u.displacementScale.value = disp * (1 + beatFlash * 0.28)
    u.vertexAudioMix.value = this.layout.vertexAudioMix ?? 0
    u.waveIntensity.value = this.layout.waveIntensity ?? 0
    u.waveFrequency.value = this.layout.waveFrequency ?? 3
    u.waveSpeed.value = this.layout.waveSpeed ?? 0.5
    u.noiseScale.value = this.layout.noiseScale ?? 2.5
    u.noiseIntensity.value = this.layout.noiseIntensity ?? 0.4
    u.noiseSpeed.value = this.layout.noiseSpeed ?? 0.32
    u.colorIntensity.value = this.layout.colorIntensity ?? 2.4

    const rhythm = buildRhythmShaderColors(this.config)
    u.uColors.value = rhythm.colors
    u.uColorCount.value = rhythm.colorCount
    if (this.solidMesh?.material) {
      this.solidMesh.material.color.copy(rhythm.colors[0])
    }

    const scale = this.sphereSize / this.radius
    this.wireMesh.scale.setScalar(scale)
    this.solidMesh.scale.setScalar(scale)

    const rot = this._rotationSpeed * dt * 60
    this.group.rotation.y += rot
    this.group.rotation.x += rot * 0.5
    this.solidMesh.rotation.copy(this.wireMesh.rotation)
  }

  update(spectrum, frame, _getMappedValue, time = 0, beatFlash = 0, dt = 0.016) {
    if (spectrum?.length) {
      let sens = this._sensitivity
      if (beatFlash > 0) sens *= 1 + beatFlash * 0.35
      this._fillAudio(spectrum, sens)
    } else {
      this._fillAudioIdle(time)
    }
    this._syncUniforms(time, dt, beatFlash)
  }

  updateIdle(time, beatFlash = 0) {
    this._fillAudioIdle(time + beatFlash * 0.5)
    this._syncUniforms(time, 0.016, beatFlash)
  }

  dispose() {
    this.wireMesh?.geometry?.dispose()
    this.wireMesh?.material?.dispose()
    this.solidMesh?.geometry?.dispose()
    this.solidMesh?.material?.dispose()
    this.parent?.remove(this.group)
    this.wireMesh = null
    this.solidMesh = null
    this.group = null
  }
}
