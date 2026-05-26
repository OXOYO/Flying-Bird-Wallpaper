/**
 * 律动壁纸音频分析：频谱 + 低频包络 + 谱通量 onset + 节拍脉冲
 * 节拍以全谱超低音（Kick）为准，不受 sampleRange 切片影响
 */

const BEAT_COOLDOWN_FRAMES = 30
const ONSET_COOLDOWN_FRAMES = 12
const HISTORY_SIZE = 56
const KICK_HISTORY_SIZE = 40
const BEAT_PULSE_DECAY = 0.93
const BEAT_PULSE_ATTACK = 0.28
const BEAT_PULSE_RELEASE = 0.1
const BASS_ATTACK = 0.45
const BASS_RELEASE = 0.09
const KICK_BAND_RATIO = 0.14

function bandAverage(spectrum, from, to) {
  if (to <= from) return 0
  let sum = 0
  for (let i = from; i < to; i++) {
    sum += spectrum[i]
  }
  return sum / (to - from) / 255
}

function measureKick(freqBuffer) {
  const end = Math.max(2, Math.floor(freqBuffer.length * KICK_BAND_RATIO))
  let peak = 0
  let sum = 0
  for (let i = 0; i < end; i++) {
    const v = freqBuffer[i]
    peak = Math.max(peak, v)
    sum += v
  }
  const avg = sum / end / 255
  return peak / 255 * 0.55 + avg * 0.45
}

function median(arr) {
  if (!arr.length) return 0
  const s = [...arr].sort((a, b) => a - b)
  const m = Math.floor(s.length / 2)
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
}

/**
 * @param {AudioContext} audioContext
 * @param {MediaStreamAudioSourceNode} source
 */
export function createRhythmAudio(audioContext, source) {
  const freqAnalyser = audioContext.createAnalyser()
  const timeAnalyser = audioContext.createAnalyser()

  freqAnalyser.fftSize = 2048
  freqAnalyser.smoothingTimeConstant = 0.38
  freqAnalyser.minDecibels = -88
  freqAnalyser.maxDecibels = -12

  timeAnalyser.fftSize = 2048
  timeAnalyser.smoothingTimeConstant = 0.5

  source.connect(freqAnalyser)
  source.connect(timeAnalyser)

  const freqBuffer = new Uint8Array(freqAnalyser.frequencyBinCount)
  const timeBuffer = new Uint8Array(timeAnalyser.fftSize)

  let beatCooldown = 0
  let onsetCooldown = 0
  const energyHistory = []
  const fluxHistory = []
  const kickHistory = []
  let lastEnergy = 0
  let lastLow = 0
  let lastKick = 0
  let lastKickEnvelope = 0
  let kickEnvelope = 0
  let beatPulseRaw = 0
  let beatPulse = 0
  let bassEnvelope = 0
  let spectrumScratch = null
  let prevSpectrumScratch = null
  let lastSliceLen = -1

  const resetState = () => {
    beatCooldown = 0
    onsetCooldown = 0
    energyHistory.length = 0
    fluxHistory.length = 0
    kickHistory.length = 0
    lastEnergy = 0
    lastLow = 0
    lastKick = 0
    lastKickEnvelope = 0
    kickEnvelope = 0
    beatPulseRaw = 0
    beatPulse = 0
    bassEnvelope = 0
    prevSpectrumScratch = null
  }

  return {
    getFrame(sampleRange = [0, 100]) {
      freqAnalyser.getByteFrequencyData(freqBuffer)
      timeAnalyser.getByteTimeDomainData(timeBuffer)

      const kick = measureKick(freqBuffer)

      const [startPct, endPct] = sampleRange
      const start = Math.floor((startPct * freqBuffer.length) / 100)
      const end = Math.max(start + 1, Math.floor((endPct * freqBuffer.length) / 100))

      const sliceLen = end - start
      if (sliceLen !== lastSliceLen) {
        resetState()
        lastSliceLen = sliceLen
      }

      if (!spectrumScratch || spectrumScratch.length !== sliceLen) {
        spectrumScratch = new Uint8Array(sliceLen)
      }
      spectrumScratch.set(freqBuffer.subarray(start, end))

      let sumSq = 0
      for (let i = 0; i < timeBuffer.length; i++) {
        const v = (timeBuffer[i] - 128) / 128
        sumSq += v * v
      }
      const rms = Math.sqrt(sumSq / timeBuffer.length)

      const len = spectrumScratch.length
      const third = Math.max(1, Math.floor(len / 3))
      const lowEnd = third
      const midEnd = third * 2

      const bands = {
        low: bandAverage(spectrumScratch, 0, lowEnd),
        mid: bandAverage(spectrumScratch, lowEnd, midEnd),
        high: bandAverage(spectrumScratch, midEnd, len)
      }

      let flux = 0
      let fluxSum = 0
      if (prevSpectrumScratch && prevSpectrumScratch.length === len) {
        for (let i = 0; i < len; i++) {
          const d = (spectrumScratch[i] - prevSpectrumScratch[i]) / 255
          if (d > 0) {
            fluxSum += d
            if (d > flux) flux = d
          }
        }
        flux = flux * 0.55 + (fluxSum / len) * 0.45
      }
      if (!prevSpectrumScratch || prevSpectrumScratch.length !== len) {
        prevSpectrumScratch = new Uint8Array(len)
      }
      prevSpectrumScratch.set(spectrumScratch)

      const lowDelta = Math.max(0, bands.low - lastLow)
      lastLow = bands.low * 0.65 + lastLow * 0.35

      if (bands.low > bassEnvelope) {
        bassEnvelope += (bands.low - bassEnvelope) * BASS_ATTACK
      } else {
        bassEnvelope += (bands.low - bassEnvelope) * BASS_RELEASE
      }

      if (kick > kickEnvelope) {
        kickEnvelope += (kick - kickEnvelope) * 0.58
      } else {
        kickEnvelope += (kick - kickEnvelope) * 0.1
      }

      const kickDelta = Math.max(0, kick - lastKick)
      const kickRising = kickEnvelope > lastKickEnvelope * 1.04 && kickDelta > 0.012

      kickHistory.push(kickEnvelope)
      if (kickHistory.length > KICK_HISTORY_SIZE) kickHistory.shift()

      const energy = bands.low * 0.42 + bands.mid * 0.33 + bands.high * 0.25 + rms * 0.12
      const onsetStrength = flux * 0.5 + lowDelta * 0.35 + Math.max(0, energy - lastEnergy) * 0.4

      energyHistory.push(energy)
      fluxHistory.push(flux)
      if (energyHistory.length > HISTORY_SIZE) energyHistory.shift()
      if (fluxHistory.length > HISTORY_SIZE) fluxHistory.shift()

      const medKick = median(kickHistory)
      const medFlux = median(fluxHistory)
      const kickThreshold = medKick * 1.22 + 0.045
      const fluxThreshold = medFlux * 1.45 + 0.022

      let beat = false
      let onset = false

      if (
        beatCooldown <= 0 &&
        kickRising &&
        kickEnvelope > kickThreshold &&
        kick > lastKick * 1.06
      ) {
        beat = true
        beatCooldown = BEAT_COOLDOWN_FRAMES
        onsetCooldown = ONSET_COOLDOWN_FRAMES
      } else if (
        onsetCooldown <= 0 &&
        beatCooldown <= 3 &&
        onsetStrength > fluxThreshold * 1.3 &&
        flux > medFlux * 1.4
      ) {
        onset = true
        onsetCooldown = ONSET_COOLDOWN_FRAMES
      }

      if (beatCooldown > 0) beatCooldown -= 1
      if (onsetCooldown > 0) onsetCooldown -= 1
      lastEnergy = energy * 0.55 + lastEnergy * 0.45
      lastKick = kick * 0.45 + lastKick * 0.55
      lastKickEnvelope = kickEnvelope

      if (beat) beatPulseRaw = 1
      beatPulseRaw *= BEAT_PULSE_DECAY

      const pulseK = beatPulseRaw > beatPulse ? BEAT_PULSE_ATTACK : BEAT_PULSE_RELEASE
      beatPulse += (beatPulseRaw - beatPulse) * pulseK

      const silent = energy < 0.034 && kickEnvelope < 0.022 && rms < 0.016

      return {
        spectrum: spectrumScratch,
        bands,
        beat,
        onset,
        energy,
        flux,
        onsetStrength,
        rms,
        bass: bands.low,
        kick,
        kickEnvelope,
        bassEnvelope,
        beatPulse,
        silent
      }
    },

    reset() {
      resetState()
      lastSliceLen = -1
    },

    destroy() {
      try {
        freqAnalyser.disconnect()
        timeAnalyser.disconnect()
      } catch {
        /* ignore */
      }
      resetState()
    }
  }
}
