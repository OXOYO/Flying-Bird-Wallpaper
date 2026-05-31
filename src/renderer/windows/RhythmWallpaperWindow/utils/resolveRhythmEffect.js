/** 已移除效果映射到当前 Three.js 舞台效果 */
const LEGACY_RHYTHM_EFFECT_MAP = {
  ThreeStage: 'ThreeStageBars',
  ThreeStagePool: 'ThreeStageBars',
  ThreeBar: 'ThreeStageBars',
  ThreeWave: 'ThreeStageBars',
  ThreeParticle: 'ThreeStageBars',
  ThreeSphere: 'ThreeStageTexturedSphere',
  ThreeAudioVisualizer: 'ThreeStageBars',
  ThreeStageMeshGrid: 'ThreeStageBars'
}

const REMOVED_LEAFER_PREFIX = 'Leafer'

/** @param {string | undefined} effect */
export function resolveRhythmEffect(effect) {
  if (!effect) return 'ThreeStageBars'
  if (effect in LEGACY_RHYTHM_EFFECT_MAP) {
    return LEGACY_RHYTHM_EFFECT_MAP[effect]
  }
  if (effect.startsWith(REMOVED_LEAFER_PREFIX)) {
    return 'ThreeStageBars'
  }
  return effect
}
