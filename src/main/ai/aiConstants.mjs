/** AI 相关默认配置（2.0.0） */
export const AI_PROVIDER_TYPES = {
  OLLAMA: 'ollama',
  OPENAI_COMPATIBLE: 'openai-compatible'
}

export const AI_PROVIDER_DEFAULTS = {
  [AI_PROVIDER_TYPES.OLLAMA]: {
    baseUrl: 'http://127.0.0.1:11434'
  },
  [AI_PROVIDER_TYPES.OPENAI_COMPATIBLE]: {
    baseUrl: 'https://api.openai.com'
  }
}

/** AI HTTP 请求默认超时（毫秒） */
export const DEFAULT_AI_TIMEOUT_MS = 300_000

export const AI_TIMEOUT_MIN_SEC = 60
export const AI_TIMEOUT_MAX_SEC = 1800

/** 视觉分析动态超时：每 MB 额外等待 + 上限（仅 analyzeImage） */
export const AI_VISION_TIMEOUT_BONUS_PER_MB_MS = 30_000
export const AI_VISION_TIMEOUT_BONUS_CAP_MS = 600_000

export const AI_VISION_LONG_EDGE_MIN = 1024
export const AI_VISION_LONG_EDGE_MAX = 4096
export const AI_VISION_LONG_EDGE_DEFAULT = 2048

export const AI_VISION_PREPROCESS_MIN_MB_DEFAULT = 1.5
export const AI_VISION_PREPROCESS_MIN_MB_MAX = 20

export const AI_VISION_JPEG_QUALITY_MIN = 75
export const AI_VISION_JPEG_QUALITY_MAX = 95
export const AI_VISION_JPEG_QUALITY_DEFAULT = 88

/**
 * 视觉分析有效超时 = min(基础超时 + 按文件体积加成, 全局上限)
 * @param {object} ai
 * @param {number} fileSizeBytes
 */
export function resolveEffectiveVisionTimeout(ai = {}, fileSizeBytes = 0) {
  const baseMs = Number(ai?.timeout) || DEFAULT_AI_TIMEOUT_MS
  const fileMB = fileSizeBytes > 0 ? fileSizeBytes / (1024 * 1024) : 0
  const bonusMs = Math.min(
    fileMB * AI_VISION_TIMEOUT_BONUS_PER_MB_MS,
    AI_VISION_TIMEOUT_BONUS_CAP_MS
  )
  const maxMs = AI_TIMEOUT_MAX_SEC * 1000
  return Math.min(Math.round(baseMs + bonusMs), maxMs)
}

export const defaultAiSettings = {
  enabled: false,
  visionProvider: AI_PROVIDER_TYPES.OLLAMA,
  textProvider: AI_PROVIDER_TYPES.OLLAMA,
  visionPreset: 'ollama',
  textPreset: 'ollama',
  visionBaseUrl: AI_PROVIDER_DEFAULTS.ollama.baseUrl,
  textBaseUrl: AI_PROVIDER_DEFAULTS.ollama.baseUrl,
  visionModel: 'qwen2.5vl:7b',
  textModel: 'qwen2.5:7b',
  embeddingModel: 'nomic-embed-text',
  apiKey: '',
  visionApiKey: '',
  textApiKey: '',
  remoteReferer: '',
  remoteAppTitle: 'Flying Bird Wallpaper',
  timeout: DEFAULT_AI_TIMEOUT_MS,
  visionPreprocess: true,
  visionMaxLongEdge: AI_VISION_LONG_EDGE_DEFAULT,
  visionPreprocessMinSizeMB: AI_VISION_PREPROCESS_MIN_MB_DEFAULT,
  visionJpegQuality: AI_VISION_JPEG_QUALITY_DEFAULT,
  concurrency: 1,
  analysisMode: 'on_demand',
  legacyOnnxScore: false,
  legacyJiebaTags: false,
  enableNsfwCheck: false,
  runOnWifiOnly: false,
  embeddingDim: 768,
  autoCollectionsEnabled: true,
  autoCollectionsMaxCount: 20,
  scoreMinFilter: 70
}

export const AI_ANALYSIS_STATUS = {
  PENDING: 'pending',
  DONE: 'done',
  FAILED: 'failed',
  SKIPPED: 'skipped'
}

export const AI_ANALYSIS_MODES = ['off', 'on_demand', 'background_slow', 'new_only']
