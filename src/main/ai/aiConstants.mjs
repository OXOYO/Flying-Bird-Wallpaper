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
  scoreMinFilter: 70,
  /** 找相似最低余弦相似度 0~1（文本回退；0.42 过松易凑数，默认 0.62） */
  similarMinCosine: 0.62,
  /** 找相似：visual=视觉向量 | text=文本向量 */
  findSimilarMode: 'visual',
  /** 视觉找相似最低余弦相似度（MobileCLIP2-S0，默认 0.72） */
  similarMinCosineVisual: 0.72,
  /** 内置 MobileCLIP2-S0 视觉向量（不依赖 Ollama） */
  visualEmbedEnabled: true,
  /** 后台分析单张最大失败次数 */
  analysisMaxRetries: 5,
  autoCurateSettled: false,
  autoCurateSettledAnalyzed: 0
}

export const VISUAL_EMBED_MODEL_ID = 'mobileclip2-s0'
export const VISUAL_EMBED_DIM = 512
export const VISUAL_EMBED_IMAGE_SIZE = 256

export const AI_ANALYSIS_MAX_RETRIES_MIN = 1
export const AI_ANALYSIS_MAX_RETRIES_MAX = 20
export const AI_ANALYSIS_MAX_RETRIES_DEFAULT = 5

export function resolveAnalysisMaxRetries(ai = {}) {
  const v = ai.analysisMaxRetries
  if (v == null || v === '') return AI_ANALYSIS_MAX_RETRIES_DEFAULT
  const n = Math.round(Number(v))
  if (!Number.isFinite(n)) return AI_ANALYSIS_MAX_RETRIES_DEFAULT
  return Math.min(
    AI_ANALYSIS_MAX_RETRIES_MAX,
    Math.max(AI_ANALYSIS_MAX_RETRIES_MIN, n)
  )
}

export const AI_ANALYSIS_STATUS = {
  PENDING: 'pending',
  DONE: 'done',
  FAILED: 'failed',
  SKIPPED: 'skipped'
}

export const AI_ANALYSIS_MODES = ['off', 'on_demand', 'background_slow', 'new_only']

/** 分析速度统计：内存滑动窗口（仅成功样本的 vision pipelineMs） */
export const AI_ANALYSIS_SPEED_SAMPLE_MAX = 30
export const AI_ANALYSIS_SPEED_MIN_SAMPLES = 3
