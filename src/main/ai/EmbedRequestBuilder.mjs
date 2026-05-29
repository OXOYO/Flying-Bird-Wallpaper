/** 非对称 embedding：query（检索） / passage（入库） */
export const EMBED_INPUT_TYPE = {
  QUERY: 'query',
  PASSAGE: 'passage'
}

/** @typedef {'openai_standard'|'asymmetric_text'|'nvidia_nim_text'|'nvidia_nim_vl'|'vllm_messages'|'openrouter_multimodal'|'jina_task'} EmbedRequestProfile */

const ASYMMETRIC_EMBED_MODEL_RE =
  /nemotron.*embed|llama-nemotron-embed|embed-qa|nv-embedqa|nv-embed(?!.*clip)/i

const MULTIMODAL_EMBED_MODEL_RE =
  /embed.*vl|vl.*embed|nemotron-embed-vl|qwen3-vl-embed|colpali|jina-clip|llava.*embed|clip.*embed|siglip.*embed|vdr-.*multi/i

const JINA_TASK_EMBED_MODEL_RE = /jina-embeddings-v[234]/i

export function usesNvidiaEmbeddingsApi(baseUrl = '') {
  return /integrate\.api\.nvidia\.com/i.test(String(baseUrl || ''))
}

export function usesOpenRouterApi(baseUrl = '') {
  return /openrouter\.ai/i.test(String(baseUrl || ''))
}

export function isAsymmetricEmbedModel(modelId = '') {
  return ASYMMETRIC_EMBED_MODEL_RE.test(String(modelId || ''))
}

export function isMultimodalEmbedModel(modelId = '') {
  return MULTIMODAL_EMBED_MODEL_RE.test(String(modelId || ''))
}

export function isJinaTaskEmbedModel(modelId = '') {
  return JINA_TASK_EMBED_MODEL_RE.test(String(modelId || ''))
}

/** NVIDIA NIM 多模态 VL 模型才支持 modality 字段 */
export function nvidiaEmbedUsesModality(modelId = '') {
  return /embed.*vl|vl.*embed|nemotron-embed-vl/i.test(String(modelId || ''))
}

/** 非对称模型是否允许图像走 query（NVIDIA / Nemotron VL 仅文本 query） */
export function supportsImageAsQuery(modelId = '', baseUrl = '') {
  if (usesNvidiaEmbeddingsApi(baseUrl)) return false
  const id = String(modelId || '')
  if (/embed.*vl|vl.*embed|nemotron-embed-vl/i.test(id)) return false
  return isAsymmetricEmbedModel(id) || isMultimodalEmbedModel(id)
}

export function resolveImageEmbedInputType(
  modelId = '',
  baseUrl = '',
  preferred = EMBED_INPUT_TYPE.PASSAGE
) {
  if (preferred === EMBED_INPUT_TYPE.QUERY && !supportsImageAsQuery(modelId, baseUrl)) {
    return EMBED_INPUT_TYPE.PASSAGE
  }
  return preferred
}

/**
 * 根据服务商地址 + 模型 + 媒介解析 embedding 请求方言
 * @param {'text'|'image'} media
 * @returns {EmbedRequestProfile}
 */
export function resolveEmbedRequestProfile(baseUrl = '', modelId = '', media = 'text') {
  const url = String(baseUrl || '')
  const model = String(modelId || '')

  if (isJinaTaskEmbedModel(model)) {
    return 'jina_task'
  }

  if (usesNvidiaEmbeddingsApi(url)) {
    if (nvidiaEmbedUsesModality(model)) return 'nvidia_nim_vl'
    if (isAsymmetricEmbedModel(model)) return 'nvidia_nim_text'
    return 'openai_standard'
  }

  if (media === 'image') {
    if (usesOpenRouterApi(url) && isMultimodalEmbedModel(model)) {
      return 'openrouter_multimodal'
    }
    if (isAsymmetricEmbedModel(model) || isMultimodalEmbedModel(model)) {
      return 'vllm_messages'
    }
    return 'openai_standard'
  }

  if (isAsymmetricEmbedModel(model)) {
    return 'asymmetric_text'
  }

  return 'openai_standard'
}

const jinaTaskForInputType = (inputType) =>
  inputType === EMBED_INPUT_TYPE.PASSAGE ? 'retrieval.passage' : 'retrieval.query'

/**
 * 构建文本 embedding 请求体（仅包含该方言允许的字段）
 */
export function buildTextEmbedRequestBody(modelId, text, options = {}) {
  const baseUrl = options.baseUrl || ''
  const inputType = options.inputType || EMBED_INPUT_TYPE.QUERY
  const profile = resolveEmbedRequestProfile(baseUrl, modelId, 'text')
  const body = { model: modelId, input: text }

  switch (profile) {
    case 'jina_task':
      body.task = jinaTaskForInputType(inputType)
      break
    case 'nvidia_nim_vl':
      body.input_type = inputType
      body.modality = ['text']
      body.encoding_format = 'float'
      body.truncate = 'NONE'
      break
    case 'nvidia_nim_text':
      body.input_type = inputType
      body.encoding_format = 'float'
      body.truncate = 'NONE'
      break
    case 'asymmetric_text':
      body.input_type = inputType
      break
    default:
      break
  }

  return { body, profile }
}

/**
 * 构建图像 embedding 请求体
 */
export function buildImageEmbedRequestBody(modelId, dataUri, options = {}) {
  const baseUrl = options.baseUrl || ''
  const inputType = resolveImageEmbedInputType(
    modelId,
    baseUrl,
    options.inputType || EMBED_INPUT_TYPE.PASSAGE
  )
  const profile = resolveEmbedRequestProfile(baseUrl, modelId, 'image')

  switch (profile) {
    case 'nvidia_nim_vl':
      return {
        profile,
        body: {
          model: modelId,
          // NVIDIA NIM 图像：input 为 data URI 字符串（非数组）；文本 query 才用 input 数组
          input: dataUri,
          modality: ['image'],
          input_type: inputType,
          encoding_format: 'float',
          truncate: 'NONE'
        }
      }
    case 'openrouter_multimodal':
      return {
        profile,
        body: {
          model: modelId,
          input: [
            {
              content: [{ type: 'image_url', image_url: { url: dataUri } }]
            }
          ],
          encoding_format: 'float'
        }
      }
    case 'vllm_messages': {
      const role = inputType === EMBED_INPUT_TYPE.QUERY ? 'query' : 'document'
      return {
        profile,
        body: {
          model: modelId,
          messages: [
            {
              role,
              content: [{ type: 'image_url', image_url: { url: dataUri } }]
            }
          ]
        }
      }
    }
    default:
      return {
        profile,
        body: {
          model: modelId,
          input: [
            {
              type: 'image_url',
              image_url: { url: dataUri }
            }
          ]
        }
      }
  }
}

/** 从 OpenAI 兼容响应中提取 embedding 向量 */
export function extractEmbeddingVector(data) {
  if (!data || typeof data !== 'object') return []
  if (Array.isArray(data.data?.[0]?.embedding)) return data.data[0].embedding
  if (Array.isArray(data.embedding)) return data.embedding
  if (Array.isArray(data.data?.embedding)) return data.data.embedding
  if (Array.isArray(data.embeddings?.[0])) return data.embeddings[0]
  return []
}

/** 1x1 PNG，用于连接测试 */
export const TEST_EMBED_IMAGE_B64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='
export const TEST_EMBED_IMAGE_MIME = 'image/png'
