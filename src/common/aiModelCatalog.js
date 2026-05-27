/** @typedef {'vision'|'text'|'embed'} ModelPurpose */

/** @typedef {{ id: string, inputModalities?: string[], outputModalities?: string[], source?: string }} ModelDescriptor */

export const MODEL_PURPOSE = {
  VISION: 'vision',
  TEXT: 'text',
  EMBED: 'embed'
}

const VISION_NAME_RE =
  /(?:vl|llava|vision|moondream|minicpm-v|bakllava|cogvlm|internvl|pixtral|qwen[\w.-]*vl|gemma-4|gemma3|nemotron-nano-12b-v2-vl|nemotron-3-nano-omni|gpt-4o|gpt-4\.1|claude-3|claude-4|flash-image)/i

const EMBED_NAME_RE =
  /(?:embed|bge-|e5-|mxbai-embed|nomic-embed|text-embedding|snowflake-arctic-embed|nemotron-embed)/i

const uniq = (list) => [...new Set((list || []).filter(Boolean))]

const normalizeModalities = (modalities, fallback = []) => {
  const list = uniq(modalities)
  return list.length ? list : fallback
}

export function inferModalitiesFromName(modelId = '') {
  const id = String(modelId || '').trim()
  if (!id) {
    return { inputModalities: ['text'], outputModalities: ['text'] }
  }

  if (EMBED_NAME_RE.test(id)) {
    return { inputModalities: ['text'], outputModalities: ['embeddings'] }
  }

  const inputModalities = ['text']
  const outputModalities = ['text']
  if (VISION_NAME_RE.test(id)) {
    inputModalities.push('image')
  }
  return { inputModalities: uniq(inputModalities), outputModalities: uniq(outputModalities) }
}

/**
 * @param {string|ModelDescriptor|null|undefined} raw
 * @returns {ModelDescriptor}
 */
export function normalizeModelDescriptor(raw) {
  if (typeof raw === 'string') {
    const inferred = inferModalitiesFromName(raw)
    return {
      id: raw,
      inputModalities: inferred.inputModalities,
      outputModalities: inferred.outputModalities,
      source: 'name'
    }
  }

  const id = String(raw?.id || raw?.name || '').trim()
  const inferred = inferModalitiesFromName(id)
  return {
    id,
    inputModalities: normalizeModalities(raw?.inputModalities, inferred.inputModalities),
    outputModalities: normalizeModalities(raw?.outputModalities, inferred.outputModalities),
    source: raw?.source || 'mixed'
  }
}

export function mapOllamaCapabilities(capabilities = []) {
  const caps = uniq(capabilities.map((item) => String(item || '').toLowerCase()))
  const inputModalities = ['text']
  const outputModalities = []

  if (caps.includes('vision')) inputModalities.push('image')
  if (caps.includes('completion') || caps.includes('chat') || caps.includes('generate')) {
    outputModalities.push('text')
  }
  if (caps.includes('embed') || caps.includes('embedding') || caps.includes('embeddings')) {
    outputModalities.push('embeddings')
  }

  return {
    inputModalities: uniq(inputModalities),
    outputModalities: normalizeModalities(outputModalities, ['text'])
  }
}

export function mapOpenAiCompatibleModel(item = {}) {
  const arch = item.architecture || {}
  const inferred = inferModalitiesFromName(item.id)
  const inputModalities = normalizeModalities(arch.input_modalities, inferred.inputModalities)
  let outputModalities = normalizeModalities(arch.output_modalities, inferred.outputModalities)

  const modality = String(arch.modality || '').toLowerCase()
  if (modality.includes('embed')) {
    outputModalities = uniq([...outputModalities, 'embeddings'])
  }
  if (modality.includes('image') || modality.includes('vision')) {
    inputModalities.push('image')
  }

  return normalizeModelDescriptor({
    id: item.id,
    inputModalities: uniq(inputModalities),
    outputModalities: uniq(outputModalities),
    source: arch.input_modalities || arch.output_modalities ? 'api' : 'name'
  })
}

const hasInput = (descriptor, modality) =>
  normalizeModalities(descriptor.inputModalities).includes(modality)

const hasOutput = (descriptor, modality) =>
  normalizeModalities(descriptor.outputModalities).includes(modality)

const isEmbedSpecialist = (descriptor) => {
  if (hasOutput(descriptor, 'embeddings') && !hasOutput(descriptor, 'text')) return true
  return EMBED_NAME_RE.test(descriptor.id)
}

const isVisionCapable = (descriptor) => {
  if (isEmbedSpecialist(descriptor)) return false
  const imageCapable = hasInput(descriptor, 'image') || VISION_NAME_RE.test(descriptor.id)
  return imageCapable && hasOutput(descriptor, 'text')
}

const isTextChatCapable = (descriptor) => {
  if (isEmbedSpecialist(descriptor)) return false
  if (isVisionCapable(descriptor)) return false
  return hasOutput(descriptor, 'text') || !EMBED_NAME_RE.test(descriptor.id)
}

const isEmbedCapable = (descriptor) =>
  hasOutput(descriptor, 'embeddings') || EMBED_NAME_RE.test(descriptor.id)

/**
 * @param {ModelDescriptor} descriptor
 * @param {ModelPurpose} purpose
 */
export function modelMatchesPurpose(descriptor, purpose) {
  const model = normalizeModelDescriptor(descriptor)
  if (!model.id) return false

  switch (purpose) {
    case MODEL_PURPOSE.VISION:
      return isVisionCapable(model)
    case MODEL_PURPOSE.EMBED:
      return isEmbedCapable(model)
    case MODEL_PURPOSE.TEXT:
    default:
      return isTextChatCapable(model)
  }
}

/**
 * @param {Array<string|ModelDescriptor>} models
 * @param {ModelPurpose} purpose
 * @returns {string[]}
 */
export function filterModelsByPurpose(models, purpose = MODEL_PURPOSE.TEXT) {
  const normalized = (models || []).map(normalizeModelDescriptor).filter((item) => item.id)
  const seen = new Set()
  const result = []

  for (const item of normalized) {
    if (!modelMatchesPurpose(item, purpose)) continue
    if (seen.has(item.id)) continue
    seen.add(item.id)
    result.push(item.id)
  }

  return result.sort((a, b) => a.localeCompare(b))
}

/**
 * @param {string} modelId
 * @param {ModelPurpose} purpose
 */
export function validateModelForPurpose(modelId, purpose) {
  const id = String(modelId || '').trim()
  if (!id) return false
  return modelMatchesPurpose(normalizeModelDescriptor(id), purpose)
}

export function purposeToConnectionType(purpose) {
  if (purpose === MODEL_PURPOSE.EMBED) return 'embed'
  if (purpose === MODEL_PURPOSE.VISION) return 'vision'
  return 'text'
}
