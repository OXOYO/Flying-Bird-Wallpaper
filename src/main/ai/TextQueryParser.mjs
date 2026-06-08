import AiAnalysisProvider from './AiAnalysisProvider.mjs'
import { AI_ANALYSIS_STATUS } from './aiConstants.mjs'
import {
  buildSearchParsePrompt,
  buildCollectionQueryPrompt,
  buildKeywordExpandPrompt,
  buildCollectionTagExpandPrompt
} from './AiPrompts.mjs'
import {
  extractJsonObject,
  normalizeSearchParams,
  normalizeCollectionQueryJson
} from './AiResponseParser.mjs'
import { applyPackPipeline } from './normalize/NormalizeEngine.mjs'
import { resolveSkillContext } from './skills/skillContext.mjs'
import { isSkillPackAvailable } from './skills/SkillPackLoader.mjs'
import { t } from '../../i18n/server.js'

export default class TextQueryParser {
  static _instance = null

  static getInstance(logger, settingManager) {
    if (!TextQueryParser._instance) {
      TextQueryParser._instance = new TextQueryParser(logger, settingManager)
    }
    return TextQueryParser._instance
  }

  constructor(logger, settingManager) {
    if (TextQueryParser._instance) return TextQueryParser._instance
    this.logger = logger
    this.settingManager = settingManager
    this.provider = AiAnalysisProvider.getInstance(logger, settingManager)
    TextQueryParser._instance = this
  }

  get skillCtx() {
    return resolveSkillContext(this.settingManager)
  }

  async parseSearchQuery(query) {
    if (!query?.trim()) {
      return { success: false, message: t('messages.enterKeywords') }
    }
    const ai = this.settingManager.settingData?.ai
    if (!ai?.enabled) {
      return { success: true, data: { filterKeywords: query.trim() } }
    }
    try {
      const raw = await this.provider.chatText(buildSearchParsePrompt(query, this.skillCtx))
      const json = extractJsonObject(raw)
      if (!json) throw new Error('parse failed')
      return { success: true, data: normalizeSearchParams(json, this.skillCtx) }
    } catch (err) {
      this.logger.warn(`[TextQueryParser] parseSearchQuery: ${err.message}`)
      return { success: true, data: { filterKeywords: query.trim() } }
    }
  }

  async parseCollectionPrompt(prompt) {
    if (!prompt?.trim()) {
      return { success: false, message: t('messages.operationFail') }
    }
    const ai = this.settingManager.settingData?.ai
    if (!ai?.enabled) {
      return {
        success: true,
        data: normalizeCollectionQueryJson({
          filterKeywords: prompt.trim(),
          semanticQuery: prompt.trim(),
          useSemantic: false,
          limitCount: 20
        }, this.skillCtx)
      }
    }
    try {
      const raw = await this.provider.chatText(buildCollectionQueryPrompt(prompt, this.skillCtx))
      const json = extractJsonObject(raw)
      if (!json) throw new Error('parse failed')
      return { success: true, data: normalizeCollectionQueryJson(json, this.skillCtx) }
    } catch (err) {
      return {
        success: true,
        data: normalizeCollectionQueryJson({
          filterKeywords: prompt.trim(),
          semanticQuery: prompt.trim(),
          useSemantic: true,
          limitCount: 20
        }, this.skillCtx)
      }
    }
  }

  async expandCollectionKeywordTags(keyword) {
    const word = String(keyword || '').trim()
    if (!word) return { success: true, data: [] }
    const ai = this.settingManager.settingData?.ai
    if (!ai?.enabled) {
      return { success: true, data: [word] }
    }
    try {
      const raw = await this.provider.chatText(buildCollectionTagExpandPrompt(word, this.skillCtx))
      const json = extractJsonObject(raw)
      const list = isSkillPackAvailable('collection-tag-expand')
        ? applyPackPipeline('collection-tag-expand', json || {}, this.skillCtx).data?.tags || []
        : Array.isArray(json?.tags)
          ? json.tags.map((x) => String(x).trim()).filter(Boolean)
          : []
      const merged = [...new Set([word, ...list])].slice(0, 16)
      return { success: true, data: merged }
    } catch (err) {
      this.logger.warn(`[TextQueryParser] expandCollectionKeywordTags: ${err.message}`)
      return { success: true, data: [word] }
    }
  }

  async expandDownloadKeywords(keywords = []) {
    const ai = this.settingManager.settingData?.ai
    if (!ai?.enabled || !keywords?.length) {
      return { success: true, data: keywords }
    }
    try {
      const raw = await this.provider.chatText(buildKeywordExpandPrompt(keywords, this.skillCtx))
      const json = extractJsonObject(raw)
      const list = isSkillPackAvailable('keyword-expand')
        ? applyPackPipeline('keyword-expand', json || {}, this.skillCtx).data?.keywords || []
        : Array.isArray(json?.keywords)
          ? json.keywords.map(String)
          : keywords
      return { success: true, data: [...new Set([...keywords, ...list])].slice(0, 20) }
    } catch {
      return { success: true, data: keywords }
    }
  }
}

export { AI_ANALYSIS_STATUS }
