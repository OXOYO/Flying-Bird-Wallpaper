const VISION_MODEL_RE =
  /vl|llava|vision|moondream|minicpm-v|bakllava|cogvlm|internvl|pixtral|gemma.*vision|qwen.*vl/i
const EMBED_MODEL_RE = /embed|bge-|e5-|mxbai-embed|nomic-embed|text-embedding|snowflake-arctic-embed/i

export {
  MODEL_PURPOSE,
  inferModalitiesFromName,
  normalizeModelDescriptor,
  mapOllamaCapabilities,
  mapOpenAiCompatibleModel,
  modelMatchesPurpose,
  filterModelsByPurpose,
  validateModelForPurpose,
  purposeToConnectionType
} from '../../common/aiModelCatalog.js'

export { formatAiErrorMessage, parseAiError, resolveAiUserMessage, AI_ERROR_CODE } from '../../common/aiErrorUtils.js'

/** @deprecated 仅兼容旧调用 */
export function filterModelsByPurposeLegacy(models, purpose = 'text') {
  const list = [...new Set((models || []).filter(Boolean))].sort((a, b) => a.localeCompare(b))
  if (!list.length) return list

  let filtered = list
  if (purpose === 'vision') {
    filtered = list.filter((name) => VISION_MODEL_RE.test(name))
  } else if (purpose === 'embed') {
    filtered = list.filter((name) => EMBED_MODEL_RE.test(name))
  } else if (purpose === 'text') {
    filtered = list.filter((name) => !EMBED_MODEL_RE.test(name) || VISION_MODEL_RE.test(name))
  }

  return filtered.length ? filtered : list
}

export { VISION_MODEL_RE, EMBED_MODEL_RE }
