/**
 * 舞台系律动增益：把 rhythmAudio 帧里的低频包络、节拍脉冲、总能量合成单一乘子。
 * 频谱负责「形状」，本模块负责「起伏幅度」。
 */

/** @param {object} frame rhythmAudio.getFrame() 返回值 */
export function getRhythmGain(frame = {}) {
  const pulse = frame.beatPulse ?? 0
  const bass = frame.kickEnvelope ?? frame.bassEnvelope ?? frame.bands?.low ?? 0
  const energy = frame.energy ?? 0
  return Math.min(1.45, 0.12 + bass * 0.55 + pulse * 0.48 + energy * 0.12)
}

/** 极低能量时视为静音，柱高/矩阵会压到近零 */
export function isRhythmSilent(frame = {}) {
  if (frame.silent) return true
  const energy = frame.energy ?? 0
  const bass = frame.kickEnvelope ?? frame.bassEnvelope ?? frame.bands?.low ?? 0
  const rms = frame.rms ?? 0
  return energy < 0.034 && bass < 0.024 && rms < 0.016
}

/** 频谱柱 × 律动增益 */
export function applyRhythmToBars(bars, frame) {
  if (!bars?.length) return bars
  if (isRhythmSilent(frame)) {
    return bars.map((v) => v * 0.04)
  }
  const gain = getRhythmGain(frame)
  const pulse = frame.beatPulse ?? 0
  return bars.map((v) => Math.min(1, v * gain * (0.78 + pulse * 0.22)))
}

/** 顶光 / 矩阵闪动：使用平滑后的 beatPulse */
export function getBeatFlash(frame) {
  return frame?.beatPulse ?? 0
}
