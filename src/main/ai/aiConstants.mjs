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
export const DEFAULT_AI_TIMEOUT_MS = 120_000

export const AI_TIMEOUT_MIN_SEC = 30
export const AI_TIMEOUT_MAX_SEC = 600

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
  concurrency: 1,
  analysisMode: 'on_demand',
  legacyOnnxScore: false,
  legacyJiebaTags: false,
  enableEmbedding: true,
  enableNsfwCheck: false,
  allowRemoteImageUpload: false,
  runOnBattery: false,
  runOnWifiOnly: false,
  embeddingDim: 768,
  autoCollectionsEnabled: true
}

export const AI_ANALYSIS_STATUS = {
  PENDING: 'pending',
  DONE: 'done',
  FAILED: 'failed',
  SKIPPED: 'skipped'
}

export const AI_ANALYSIS_MODES = ['off', 'on_demand', 'background_slow', 'new_only']
