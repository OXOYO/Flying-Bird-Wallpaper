/**
 * vizz.fm mesh-grid 控件默认值（bundle id:"mesh-grid"）
 * @see docs/temp/vizz-mesh-sphere-extract.txt
 */
export const VIZZ_MESH_GRID_DEFAULTS = {
  waveHeight: 3.15,
  waveSpeed: 2.75,
  waveComplexity: 1,
  colorIntensity: 1.25,
  /** 越低顶点跟拍越快（过渡越少「糊」） */
  dampeningFactor: 0.85,
  jaggedness: 0.15,
  perlinNoiseIntensity: 0.2,
  perlinNoiseScale: 0.1,
  perlinNoiseSpeed: 0.1,
  meshBend: 0,
  circleShape: false,
  radialMix: 0.5,
  sensitivity: 1
}

/** 全盒五面：沿用 vizz 公式，整体幅度缩小，避免地板/天花对撞 */
export const ROOM_MESH_GRID_DEFAULTS = {
  ...VIZZ_MESH_GRID_DEFAULTS,
  waveHeight: 2.45,
  waveSpeed: 2.85,
  colorIntensity: 1.15,
  dampeningFactor: 0.76,
  radialMix: 0.72,
  sensitivity: 1.12,
  /** 相对单面地板的位移增益 */
  surfaceGain: 0.54
}
