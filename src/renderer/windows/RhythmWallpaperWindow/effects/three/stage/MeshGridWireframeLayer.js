import * as THREE from 'three'
import { buildRhythmShaderColorsForHeightGrid } from '../stageColorTheme.js'
import { VIZZ_MESH_GRID_VERT, VIZZ_MESH_GRID_FRAG } from './shaders/vizzMeshGridShaders.js'
import { driveVizzMeshGrid, driveVizzMeshGridIdle } from './vizzMeshGridDrive.js'
import { driveRoomVizzMeshGrid, driveRoomVizzMeshGridIdle } from './roomMeshGrid/roomVizzMeshGridDrive.js'
import { createVizzPlaneGridGeometry, syncVizzPlaneGrid } from './vizzPlaneGridGeometry.js'
import { VIZZ_MESH_GRID_DEFAULTS, ROOM_MESH_GRID_DEFAULTS } from './vizzMeshGridDefaults.js'

const VIZZ_MESH_REF_SPAN = 177
/** 物理位移封顶系数（tanh） */
const MESH_GRID_PEAK_LIFT_SCALE = 1.06
/** 着色归一化：略抬高阈值，避免大片暖色仅因位移/频谱偏高 */
const MESH_GRID_COLOR_LIFT_RATIO = 0.62

function calcSegments(width, height, meshSegments) {
  const span = Math.max(width, height, 1e-3)
  const targetSeg = Math.max(32, Math.min(meshSegments ?? 96, Math.round(span * 10)))
  return {
    segX: Math.max(16, Math.round(targetSeg * (width / span))),
    segZ: Math.max(16, Math.round(targetSeg * (height / span)))
  }
}

/**
 * PlaneGeometry 三角线框；顶点位移沿局部 +Z（单面 / 全盒共用）
 */
export class MeshGridWireframeLayer {
  constructor(parent, options) {
    const {
      config,
      width,
      height,
      meshSegments = 96,
      position = [0, 0, 0],
      rotation = [0, 0, 0],
      useRoomDrive = false,
      phaseOffset = 0,
      renderOrder = 3,
      ...restOpts
    } = options

    const defs = useRoomDrive ? ROOM_MESH_GRID_DEFAULTS : VIZZ_MESH_GRID_DEFAULTS
    const surfaceGain = useRoomDrive ? defs.surfaceGain ?? 1 : 1
    const waveHeight = restOpts.waveHeight ?? defs.waveHeight
    const waveSpeed = restOpts.waveSpeed ?? defs.waveSpeed
    const waveComplexity = restOpts.waveComplexity ?? defs.waveComplexity
    const colorIntensity = restOpts.colorIntensity ?? defs.colorIntensity
    const dampeningFactor = restOpts.dampeningFactor ?? defs.dampeningFactor
    const jaggedness = restOpts.jaggedness ?? defs.jaggedness
    const perlinNoiseIntensity = restOpts.perlinNoiseIntensity ?? defs.perlinNoiseIntensity
    const perlinNoiseScale = restOpts.perlinNoiseScale ?? defs.perlinNoiseScale
    const perlinNoiseSpeed = restOpts.perlinNoiseSpeed ?? defs.perlinNoiseSpeed
    const meshBend = restOpts.meshBend ?? defs.meshBend
    const circleShape = restOpts.circleShape ?? defs.circleShape
    const radialMix = restOpts.radialMix ?? defs.radialMix
    const sensitivity = restOpts.sensitivity ?? defs.sensitivity

    this.parent = parent
    this.config = config
    this.layout = { ...options, ...defs, ...restOpts }
    this._useRoomDrive = useRoomDrive
    this._phaseOffset = phaseOffset
    this._time = phaseOffset

    const span = Math.max(width, height)
    const amp = Math.max(0.82, Math.min(1.25, span / VIZZ_MESH_REF_SPAN))
    const { segX, segZ } = calcSegments(width, height, meshSegments)
    this.cols = segX + 1
    this.rows = segZ + 1
    this._meshSpan = span
    this._dispAxis = 2

    this._grid = createVizzPlaneGridGeometry(width, height, segX, segZ)
    this._freqPoints = new Float32Array(this._grid.vertCount)
    this._smoothHeights = new Float32Array(this._grid.vertCount)

    const rhythm = buildRhythmShaderColorsForHeightGrid(config)
    this._material = new THREE.ShaderMaterial({
      uniforms: {
        uColors: { value: rhythm.colors },
        uColorCount: { value: rhythm.colorCount },
        time: { value: 0 },
        colorIntensity: { value: colorIntensity },
        circleMode: { value: circleShape ? 1 : 0 },
        gridHalfX: { value: width / 2 },
        gridHalfZ: { value: height / 2 },
        peakLift: { value: waveHeight * amp * surfaceGain * MESH_GRID_PEAK_LIFT_SCALE },
        colorLift: { value: waveHeight * amp * surfaceGain * MESH_GRID_COLOR_LIFT_RATIO }
      },
      vertexShader: VIZZ_MESH_GRID_VERT,
      fragmentShader: VIZZ_MESH_GRID_FRAG,
      wireframe: true,
      toneMapped: false,
      fog: false,
      transparent: true,
      opacity: 0.9,
      depthWrite: false,
      depthTest: true,
      blending: THREE.NormalBlending,
      polygonOffset: true,
      polygonOffsetFactor: 1,
      polygonOffsetUnits: 1
    })

    this.mesh = new THREE.Mesh(this._grid.geometry, this._material)
    this.mesh.position.set(position[0], position[1], position[2])
    this.mesh.rotation.set(rotation[0], rotation[1], rotation[2])
    this.mesh.frustumCulled = false
    this.mesh.renderOrder = renderOrder
    parent.add(this.mesh)

    this._params = {
      waveHeight: waveHeight * amp * surfaceGain,
      waveSpeed,
      waveComplexity,
      dampeningFactor,
      jaggedness,
      perlinNoiseIntensity,
      perlinNoiseScale,
      perlinNoiseSpeed,
      meshBend,
      radialMix,
      sensitivity
    }
  }

  _drive(spectrum, dt, beatFlash = 0) {
    const state = {
      positions: this._grid.pointPos,
      basePositions: this._grid.basePointPos,
      frequencies: this._freqPoints,
      smoothHeights: this._smoothHeights,
      cols: this.cols,
      rows: this.rows,
      meshSpan: this._meshSpan,
      bufferLength: spectrum?.length ?? 0,
      time: this._time,
      displaceAxis: this._dispAxis,
      params: { ...this._params, beatFlash }
    }

    const drive = this._useRoomDrive ? driveRoomVizzMeshGrid : driveVizzMeshGrid
    const driveIdle = this._useRoomDrive ? driveRoomVizzMeshGridIdle : driveVizzMeshGridIdle

    if (spectrum?.length) {
      drive(state, spectrum, dt)
    } else {
      driveIdle(state, dt)
    }

    syncVizzPlaneGrid(this._grid, this._grid.pointPos, this._freqPoints, this._dispAxis)

    const rhythm = buildRhythmShaderColorsForHeightGrid(this.config)
    const u = this._material.uniforms
    u.uColors.value = rhythm.colors
    u.uColorCount.value = rhythm.colorCount
    u.time.value = this._time
    u.colorIntensity.value = this.layout.colorIntensity ?? 1
    u.circleMode.value = this.layout.circleShape ? 1 : 0
    const h = this._params.waveHeight
    u.peakLift.value = h * MESH_GRID_PEAK_LIFT_SCALE
    u.colorLift.value = h * MESH_GRID_COLOR_LIFT_RATIO
  }

  update(spectrum, beatFlash = 0, time = 0, dt = 0.016) {
    this._time += dt * (this._params.waveSpeed ?? 2.4) * 0.22
    this._drive(spectrum, dt, beatFlash)
  }

  updateIdle(time, beatFlash = 0) {
    this._time += 0.016 * (this._params.waveSpeed ?? 2.4) * 0.22
    this._drive(null, 0.016, beatFlash)
  }

  dispose() {
    this.mesh?.geometry?.dispose()
    this._material?.dispose()
    this.parent?.remove(this.mesh)
    this.mesh = null
  }
}
