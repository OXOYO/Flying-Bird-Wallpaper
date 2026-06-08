import { OllamaProvider, OpenAiCompatibleProvider } from './providers/HttpAiProviders.mjs'
import { buildImageAnalysisPrompt, buildVideoPosterAnalysisPrompt } from './AiPrompts.mjs'
import { extractJsonObject, normalizeAnalysisResultWithMeta } from './AiResponseParser.mjs'
import { resolveSkillContext } from './skills/skillContext.mjs'
import { calculateImageScore } from '../utils/utils.mjs'
import { AI_PROVIDER_TYPES, DEFAULT_AI_TIMEOUT_MS, AI_TEST_CONNECTION_TIMEOUT_MS, resolveEffectiveVisionTimeout, AI_VISION_LONG_EDGE_MIN } from './aiConstants.mjs'
import { prepareVisionImageForAnalysis, prepareVisionImageForEmbed, shrinkBufferToEmbedLimit, formatVisionPrepLog } from './AiVisionImagePrep.mjs'
import fs from 'node:fs'
import {
  filterModelsByPurpose,
  parseAiError,
  AI_ERROR_CODE,
  MODEL_PURPOSE,
  validateModelForPurpose
} from './AiModelUtils.mjs'
import { buildRemoteExtraHeaders, presetRequiresApiKey } from '../../common/aiProviders.js'
import { t } from '../../i18n/server.js'
import i18next from '../../i18n/i18next.js'

const PURPOSE_LABEL = {
  vision: 'vision',
  text: 'text',
  embed: 'embed',
  'visual-embed': 'visual-embed'
}

/** 解析失败时写入日志的模型原文最大长度 */
const AI_RAW_RESPONSE_LOG_MAX = 2000

function resolveServiceProfile(kind, ai) {
  if (kind === 'visualEmbed') {
    return {
      providerType: ai.visualEmbedProvider,
      baseUrl: ai.visualEmbedBaseUrl,
      presetId: ai.visualEmbedPreset,
      model: ai.visualEmbedModel,
      apiKeyKind: 'visualEmbed',
      logTag: 'visual-embed'
    }
  }
  if (kind === 'vision') {
    return {
      providerType: ai.visionProvider,
      baseUrl: ai.visionBaseUrl,
      presetId: ai.visionPreset,
      model: ai.visionModel,
      apiKeyKind: 'vision',
      logTag: 'vision'
    }
  }
  return {
    providerType: ai.textProvider,
    baseUrl: ai.textBaseUrl,
    presetId: ai.textPreset,
    model: ai.textModel,
    apiKeyKind: 'text',
    logTag: 'text'
  }
}

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
    if (kind === 'visualEmbed') return ai.visualEmbedApiKey || ai.apiKey || ''
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
    const profile = resolveServiceProfile(kind, ai)
    const config = {
      baseUrl: profile.baseUrl,
      model: profile.model,
      timeout: ai.timeout || DEFAULT_AI_TIMEOUT_MS,
      apiKey: this.getApiKey(profile.apiKeyKind, ai),
      extraHeaders: buildRemoteExtraHeaders(ai, profile.baseUrl),
      logger: this.logger,
      logTag: profile.logTag
    }
    if (profile.providerType === AI_PROVIDER_TYPES.OPENAI_COMPATIBLE) {
      return new OpenAiCompatibleProvider(config)
    }
    return new OllamaProvider(config)
  }

  async analyzeImage(filePath, options = {}) {
    const ai = this.ai
    if (ai.legacyOnnxScore && !ai.enabled) {
      const score = await calculateImageScore(filePath)
      const raw = { score, tags: [], safeForWork: true, nsfwLevel: 0 }
      const { data, meta } = normalizeAnalysisResultWithMeta(raw, { packId: 'image-analysis' })
      return {
        ...data,
        rawLlmJson: raw,
        analysisMeta: { ...meta, outputLocale: i18next.language || 'enUS' }
      }
    }
    if (!ai.enabled) {
      const raw = { score: 0, tags: [], safeForWork: true, nsfwLevel: 0 }
      const { data, meta } = normalizeAnalysisResultWithMeta(raw, { packId: 'image-analysis' })
      return {
        ...data,
        rawLlmJson: raw,
        analysisMeta: { ...meta, outputLocale: i18next.language || 'enUS' }
      }
    }

    let fileSizeBytes = 0
    try {
      fileSizeBytes = fs.statSync(filePath).size
    } catch {
      // ignore
    }

    const prepared = await prepareVisionImageForAnalysis(filePath, ai, this.logger)
    const effectiveTimeoutMs = resolveEffectiveVisionTimeout(
      ai,
      prepared.meta?.originalBytes || fileSizeBytes
    )
    const provider = this.createProvider('vision', { timeout: effectiveTimeoutMs })

    const visionInput = prepared.buffer
      ? { buffer: prepared.buffer, mime: 'image/jpeg' }
      : { filePath }

    const visionStartedAt = Date.now()
    const skillCtx = resolveSkillContext(this.settingManager, { outputLocale: i18next.language })
    const analysisPackId = options.videoPoster ? 'video-poster-analysis' : 'image-analysis'
    const prompt = options.videoPoster
      ? buildVideoPosterAnalysisPrompt(skillCtx)
      : buildImageAnalysisPrompt(skillCtx)
    const rawText = await provider.analyzeImage(visionInput, prompt, ai.visionModel)
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
      throw new Error(t('messages.aiJsonParseFailed'))
    }
    const { data: result, meta } = normalizeAnalysisResultWithMeta(parsed, {
      packId: analysisPackId,
      ...skillCtx
    })
    if (this.logger) {
      this.logger.info(
        `[AiAnalysisProvider] vision pipeline visionMs=${visionMs}ms parseMs=${parseMs}ms timeoutMs=${effectiveTimeoutMs} ${formatVisionPrepLog(prepared.meta)} model=${ai.visionModel} file=${filePath}`
      )
    }
    return {
      ...result,
      rawLlmJson: parsed,
      analysisMeta: {
        packId: meta.packId,
        packVersion: meta.packVersion,
        normalizeVersion: meta.normalizeVersion,
        profile: meta.profile || skillCtx.profile,
        outputLocale: skillCtx.outputLocale || i18next.language || 'enUS',
        normalizedAt: new Date().toISOString()
      }
    }
  }

  async chatText(prompt, useTextProvider = true) {
    const ai = this.ai
    if (!ai.enabled && !useTextProvider) {
      throw new Error(t('messages.aiNotEnabled'))
    }
    const provider = this.createProvider('text')
    const content = await provider.chat({
      model: ai.textModel,
      messages: [{ role: 'user', content: prompt }]
    })
    return content
  }

  async embedText(text, options = {}) {
    const ai = this.ai
    if (!ai.enabled) return []
    const provider = this.createProvider('text')
    const model = ai.embeddingModel || ai.textModel
    if (typeof provider.embed === 'function') {
      return await provider.embed(text, model, options)
    }
    return []
  }

  async embedImageFile(filePath, aiOverrides, options = {}) {
    const ai = this.resolveAi(aiOverrides)
    const model = String(ai.visualEmbedModel || '').trim()
    if (!model) return []
    const prepared = await prepareVisionImageForEmbed(filePath, ai, this.logger)
    const provider = this.createProvider('visualEmbed', ai)
    if (typeof provider.embedImage !== 'function') return []
    const embedInput = prepared.buffer
      ? { buffer: prepared.buffer, mime: 'image/jpeg' }
      : { filePath }
    if (this.logger) {
      this.logger.info(
        `[AiAnalysisProvider] visual-embed prep ${formatVisionPrepLog(prepared.meta)} file=${filePath}`
      )
    }
    try {
      return await provider.embedImage(embedInput, model, options)
    } catch (err) {
      const msg = String(err?.message || err)
      if (!/string_too_long/i.test(msg) || !prepared.buffer) throw err
      if (this.logger) {
        this.logger.warn(
          `[AiAnalysisProvider] visual-embed payload still too large, retry with aggressive shrink file=${filePath}`
        )
      }
      const retried = await shrinkBufferToEmbedLimit(
        prepared.buffer,
        { ...ai, visionMaxLongEdge: AI_VISION_LONG_EDGE_MIN },
        this.logger,
        filePath,
        prepared.meta
      )
      return await provider.embedImage(
        { buffer: retried.buffer, mime: 'image/jpeg' },
        model,
        options
      )
    }
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
    const profile = resolveServiceProfile(kind === 'visualEmbed' ? 'visualEmbed' : kind, ai)
    const catalogPurpose =
      purpose === 'visual-embed'
        ? MODEL_PURPOSE.VISUAL_EMBED
        : purpose === 'embed'
          ? MODEL_PURPOSE.EMBED
          : purpose === 'vision'
            ? MODEL_PURPOSE.VISION
            : MODEL_PURPOSE.TEXT

    if (
      profile.providerType === AI_PROVIDER_TYPES.OPENAI_COMPATIBLE &&
      presetRequiresApiKey(profile.presetId, profile.baseUrl) &&
      !this.getApiKey(profile.apiKeyKind, ai)
    ) {
      return { success: false, errorCode: AI_ERROR_CODE.API_KEY_MISSING, message: '' }
    }

    try {
      const providerKind = kind === 'visualEmbed' ? 'visualEmbed' : kind === 'vision' ? 'vision' : 'text'
      const provider = this.createProvider(providerKind, ai)
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
      const parsed = parseAiError(err, { providerType: profile.providerType, baseUrl: profile.baseUrl })
      return { success: false, message: '', ...parsed }
    }
  }

  async testConnection(type = 'vision', aiOverrides) {
    const ai = this.resolveAi(aiOverrides)
    if (type === 'visual-embed') {
      const profile = resolveServiceProfile('visualEmbed', ai)
      if (
        profile.providerType === AI_PROVIDER_TYPES.OPENAI_COMPATIBLE &&
        presetRequiresApiKey(profile.presetId, profile.baseUrl) &&
        !this.getApiKey('visualEmbed', ai)
      ) {
        return { success: false, errorCode: AI_ERROR_CODE.API_KEY_MISSING, message: '' }
      }
      const model = ai.visualEmbedModel || ''
      const mismatch = this.assertModelPurpose(model, MODEL_PURPOSE.VISUAL_EMBED)
      if (mismatch) return mismatch
      try {
        const provider = this.createProvider('visualEmbed', { ...ai, timeout: AI_TEST_CONNECTION_TIMEOUT_MS })
        if (typeof provider.testConnection === 'function' && typeof provider.embedImage === 'function') {
          return await provider.testConnection('embed-image', model)
        }
        return await provider.testConnection('embed', model)
      } catch (err) {
        const parsed = parseAiError(err, {
          providerType: profile.providerType,
          baseUrl: profile.baseUrl
        })
        return { success: false, message: '', ...parsed }
      }
    }

    const kind = type === 'text' || type === 'embed' ? 'text' : 'vision'
    const profile = resolveServiceProfile(kind, ai)

    if (
      profile.providerType === AI_PROVIDER_TYPES.OPENAI_COMPATIBLE &&
      presetRequiresApiKey(profile.presetId, profile.baseUrl) &&
      !this.getApiKey(profile.apiKeyKind, ai)
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
      const testAi = { ...ai, timeout: AI_TEST_CONNECTION_TIMEOUT_MS }
      if (type === 'embed') {
        const provider = this.createProvider('text', testAi)
        return await provider.testConnection('embed', model)
      }
      const provider = this.createProvider(kind, testAi)
      if (type === 'vision') {
        return await provider.testConnection('vision', model)
      }
      return await provider.testConnection('chat', model)
    } catch (err) {
      const parsed = parseAiError(err, { providerType: profile.providerType, baseUrl: profile.baseUrl })
      return { success: false, message: '', ...parsed }
    }
  }
}
