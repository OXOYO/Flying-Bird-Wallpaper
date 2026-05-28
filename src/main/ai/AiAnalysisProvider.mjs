import { OllamaProvider, OpenAiCompatibleProvider } from './providers/HttpAiProviders.mjs'
import { buildImageAnalysisPrompt } from './AiPrompts.mjs'
import { extractJsonObject, normalizeAnalysisResult } from './AiResponseParser.mjs'
import { calculateImageScore } from '../utils/utils.mjs'
import { AI_PROVIDER_TYPES, DEFAULT_AI_TIMEOUT_MS, resolveEffectiveVisionTimeout } from './aiConstants.mjs'
import { prepareVisionImageForAnalysis, formatVisionPrepLog } from './AiVisionImagePrep.mjs'
import fs from 'node:fs'
import {
  filterModelsByPurpose,
  parseAiError,
  AI_ERROR_CODE,
  MODEL_PURPOSE,
  validateModelForPurpose
} from './AiModelUtils.mjs'
import { buildRemoteExtraHeaders, presetRequiresApiKey } from '../../common/aiProviders.js'

const PURPOSE_LABEL = {
  vision: 'vision',
  text: 'text',
  embed: 'embed'
}

/** 解析失败时写入日志的模型原文最大长度 */
const AI_RAW_RESPONSE_LOG_MAX = 2000

export default class AiAnalysisProvider {
  static _instance = null

  static getInstance(logger, settingManager) {
    if (!AiAnalysisProvider._instance) {
      AiAnalysisProvider._instance = new AiAnalysisProvider(logger, settingManager)
    }
    return AiAnalysisProvider._instance
  }

  constructor(logger, settingManager) {
    if (AiAnalysisProvider._instance) return AiAnalysisProvider._instance
    this.logger = logger
    this.settingManager = settingManager
    AiAnalysisProvider._instance = this
  }

  get ai() {
    return this.settingManager.settingData?.ai || {}
  }

  resolveAi(overrides) {
    if (!overrides || typeof overrides !== 'object') return this.ai
    return { ...this.ai, ...overrides }
  }

  getApiKey(kind, ai) {
    if (kind === 'vision') return ai.visionApiKey || ai.apiKey || ''
    return ai.textApiKey || ai.apiKey || ''
  }

  isEnabled() {
    const ai = this.ai
    if (!ai.enabled) return false
    if (ai.analysisMode === 'off') return false
    return true
  }

  createProvider(kind, aiOverrides) {
    const ai = this.resolveAi(aiOverrides)
    const isVision = kind === 'vision'
    const provider = isVision ? ai.visionProvider : ai.textProvider
    const baseUrl = isVision ? ai.visionBaseUrl : ai.textBaseUrl
    const config = {
      baseUrl,
      model: isVision ? ai.visionModel : ai.textModel,
      timeout: ai.timeout || DEFAULT_AI_TIMEOUT_MS,
      apiKey: this.getApiKey(isVision ? 'vision' : 'text', ai),
      extraHeaders: buildRemoteExtraHeaders(ai, baseUrl),
      logger: this.logger,
      logTag: isVision ? 'vision' : 'text'
    }
    if (provider === AI_PROVIDER_TYPES.OPENAI_COMPATIBLE) {
      return new OpenAiCompatibleProvider(config)
    }
    return new OllamaProvider(config)
  }

  async analyzeImage(filePath) {
    const ai = this.ai
    if (ai.legacyOnnxScore && !ai.enabled) {
      const score = await calculateImageScore(filePath)
      return normalizeAnalysisResult({ score, tags: [], safeForWork: true, nsfwLevel: 0 })
    }
    if (!ai.enabled) {
      return normalizeAnalysisResult({ score: 0, tags: [], safeForWork: true, nsfwLevel: 0 })
    }

    let fileSizeBytes = 0
    try {
      fileSizeBytes = fs.statSync(filePath).size
    } catch {
      // ignore
    }

    const prepared = await prepareVisionImageForAnalysis(filePath, ai, this.logger)
    const effectiveTimeoutMs = resolveEffectiveVisionTimeout(ai, prepared.meta?.originalBytes || fileSizeBytes)
    const provider = this.createProvider('vision', { timeout: effectiveTimeoutMs })

    const visionInput = prepared.buffer
      ? { buffer: prepared.buffer, mime: 'image/jpeg' }
      : { filePath }

    const visionStartedAt = Date.now()
    const rawText = await provider.analyzeImage(
      visionInput,
      buildImageAnalysisPrompt(),
      ai.visionModel
    )
    const visionMs = Date.now() - visionStartedAt
    const parseStartedAt = Date.now()
    let parsed = extractJsonObject(rawText)
    const parseMs = Date.now() - parseStartedAt
    if (!parsed) {
      const raw = typeof rawText === 'string' ? rawText : String(rawText ?? '')
      const truncated = raw.length > AI_RAW_RESPONSE_LOG_MAX
      const preview = truncated ? `${raw.slice(0, AI_RAW_RESPONSE_LOG_MAX)}…` : raw
      this.logger?.warn(
        `[AiAnalysisProvider] JSON parse failed rawLen=${raw.length} truncated=${truncated} visionMs=${visionMs}ms model=${ai.visionModel} file=${filePath} raw=${preview}`
      )
      throw new Error('AI 返回无法解析为 JSON')
    }
    if (this.logger) {
      this.logger.info(
        `[AiAnalysisProvider] vision pipeline visionMs=${visionMs}ms parseMs=${parseMs}ms timeoutMs=${effectiveTimeoutMs} ${formatVisionPrepLog(prepared.meta)} model=${ai.visionModel} file=${filePath}`
      )
    }
    return normalizeAnalysisResult(parsed)
  }

  async chatText(prompt, useTextProvider = true) {
    const ai = this.ai
    if (!ai.enabled && !useTextProvider) {
      throw new Error('AI 未启用')
    }
    const provider = this.createProvider('text')
    const content = await provider.chat({
      model: ai.textModel,
      messages: [{ role: 'user', content: prompt }]
    })
    return content
  }

  async embedText(text) {
    const ai = this.ai
    if (!ai.enabled) return []
    const provider = this.createProvider('text')
    const model = ai.embeddingModel || ai.textModel
    if (typeof provider.embed === 'function') {
      return await provider.embed(text, model)
    }
    return []
  }

  assertModelPurpose(modelId, purpose) {
    if (!modelId || validateModelForPurpose(modelId, purpose)) return null
    return {
      success: false,
      errorCode: AI_ERROR_CODE.MODEL_PURPOSE_MISMATCH,
      errorParams: {
        model: modelId,
        purpose,
        purposeLabel: PURPOSE_LABEL[purpose] || purpose
      },
      message: ''
    }
  }

  async listModels(kind = 'vision', purpose = 'text', aiOverrides) {
    const ai = this.resolveAi(aiOverrides)
    const isVision = kind === 'vision'
    const providerType = isVision ? ai.visionProvider : ai.textProvider
    const baseUrl = isVision ? ai.visionBaseUrl : ai.textBaseUrl
    const catalogPurpose =
      purpose === 'embed' ? MODEL_PURPOSE.EMBED : purpose === 'vision' ? MODEL_PURPOSE.VISION : MODEL_PURPOSE.TEXT

    const presetId = isVision ? ai.visionPreset : ai.textPreset
    if (
      providerType === AI_PROVIDER_TYPES.OPENAI_COMPATIBLE &&
      presetRequiresApiKey(presetId, baseUrl) &&
      !this.getApiKey(kind, ai)
    ) {
      return { success: false, errorCode: AI_ERROR_CODE.API_KEY_MISSING, message: '' }
    }

    try {
      const provider = this.createProvider(kind, ai)
      const catalog =
        typeof provider.listModelCatalog === 'function'
          ? await provider.listModelCatalog(catalogPurpose)
          : (await provider.listModels(catalogPurpose)).map((id) => ({ id }))
      const data = filterModelsByPurpose(catalog, catalogPurpose)
      return {
        success: true,
        data,
        meta: {
          total: catalog.length,
          matched: data.length,
          purpose: catalogPurpose
        }
      }
    } catch (err) {
      const parsed = parseAiError(err, { providerType, baseUrl })
      return { success: false, message: '', ...parsed }
    }
  }

  async testConnection(type = 'vision', aiOverrides) {
    const ai = this.resolveAi(aiOverrides)
    const kind = type === 'text' || type === 'embed' ? 'text' : 'vision'
    const providerType = kind === 'vision' ? ai.visionProvider : ai.textProvider
    const baseUrl = kind === 'vision' ? ai.visionBaseUrl : ai.textBaseUrl

    const presetId = kind === 'vision' ? ai.visionPreset : ai.textPreset
    if (
      providerType === AI_PROVIDER_TYPES.OPENAI_COMPATIBLE &&
      presetRequiresApiKey(presetId, baseUrl) &&
      !this.getApiKey(kind, ai)
    ) {
      return { success: false, errorCode: AI_ERROR_CODE.API_KEY_MISSING, message: '' }
    }

    const purpose =
      type === 'embed' ? MODEL_PURPOSE.EMBED : type === 'text' ? MODEL_PURPOSE.TEXT : MODEL_PURPOSE.VISION
    const model =
      type === 'embed' ? ai.embeddingModel || ai.textModel : type === 'text' ? ai.textModel : ai.visionModel

    const mismatch = this.assertModelPurpose(model, purpose)
    if (mismatch) return mismatch

    try {
      if (type === 'embed') {
        const provider = this.createProvider('text', ai)
        return await provider.testConnection('embed', model)
      }
      const provider = this.createProvider(kind, ai)
      return await provider.testConnection('chat', model)
    } catch (err) {
      const parsed = parseAiError(err, { providerType, baseUrl })
      return { success: false, message: '', ...parsed }
    }
  }
}
