import { MeshGridWireframeLayer } from '../MeshGridWireframeLayer.js'

/** 全盒线框单面 */
export class RoomMeshGridSurface {
  constructor(parent, options) {
    const {
      config,
      width,
      height,
      meshSegments = 96,
      position = [0, 0, 0],
      rotation = [0, 0, 0],
      waveHeight = 1,
      waveSpeed = 2.4,
      waveComplexity = 1,
      colorIntensity = 1.2,
      dampeningFactor = 0.85,
      jaggedness = 0.12,
      perlinNoiseIntensity = 2,
      perlinNoiseScale = 0.76,
      perlinNoiseSpeed = 0.4,
      meshBend = 0,
      radialMix = 1,
      sensitivity = 1,
      circleShape = false,
      phaseOffset = 0,
      renderOrder = 3
    } = options

    this._layer = new MeshGridWireframeLayer(parent, {
      config,
      width,
      height,
      meshSegments,
      position,
      rotation,
      useRoomDrive: true,
      waveHeight,
      waveSpeed,
      waveComplexity,
      colorIntensity,
      dampeningFactor,
      jaggedness,
      perlinNoiseIntensity,
      perlinNoiseScale,
      perlinNoiseSpeed,
      meshBend,
      circleShape,
      radialMix,
      sensitivity,
      phaseOffset,
      renderOrder
    })
  }

  update(spectrum, beatFlash = 0, time = 0, dt = 0.016) {
    this._layer.update(spectrum, beatFlash, time, dt)
  }

  updateIdle(time, beatFlash = 0) {
    this._layer.updateIdle(time, beatFlash)
  }

  dispose() {
    this._layer?.dispose()
    this._layer = null
  }
}
