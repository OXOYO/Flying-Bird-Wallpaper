/**
 * 按窗口宽高比选择相机/房间预设，供所有 Three 舞台效果共用。
 * - strip：超宽屏（降低柱高、略拉远）
 * - tall：竖屏/近方屏
 * - normal：默认
 * widthRatio 过窄时略增大 FOV，避免开口过「管状」。
 */
export function getStageLayoutProfile(view, config = {}) {
  const aspect = view.aspect

  let mode = 'normal'
  if (aspect > 2.6) mode = 'strip'
  else if (aspect < 1.15) mode = 'tall'

  /** 各字段含义：vFovDeg/dist 相机；barMaxHScale 柱顶；gridMaxHScale 地柱；barZRatio 地板条带深度 */
  const presets = {
    strip: {
      vFovDeg: 42,
      dist: 6.5,
      eyeYRatio: 0.5,
      lookYRatio: 0.48,
      lookZ: 0.58,
      camZScale: 0.8,
      roomDepthMul: 1.1,
      barMaxHScale: 0.36,
      baseBarHScale: 0.032,
      beamCount: 1,
      beamSpread: 0.3,
      barZRatio: 0.58,
      gridMaxHScale: 0.24
    },
    normal: {
      vFovDeg: 40,
      dist: 7,
      eyeYRatio: 0.5,
      lookYRatio: 0.47,
      lookZ: 0.62,
      camZScale: 0.82,
      roomDepthMul: 1.22,
      barMaxHScale: 0.28,
      baseBarHScale: 0.028,
      beamCount: 1,
      beamSpread: 0.28,
      barZRatio: 0.62,
      gridMaxHScale: 0.22
    },
    tall: {
      vFovDeg: 38,
      dist: 7.2,
      eyeYRatio: 0.5,
      lookYRatio: 0.46,
      lookZ: 0.6,
      camZScale: 0.84,
      roomDepthMul: 1.18,
      barMaxHScale: 0.24,
      baseBarHScale: 0.026,
      beamCount: 1,
      beamSpread: 0.26,
      barZRatio: 0.64,
      gridMaxHScale: 0.2
    }
  }

  const base = presets[mode] || presets.normal
  const narrowWidth = (config.widthRatio ?? 1) < 0.55

  return {
    mode,
    aspect,
    ...base,
    vFovDeg: base.vFovDeg + (narrowWidth ? 1 : 0),
    stageWScale: 0.9
  }
}
