import fs from 'node:fs'
import path from 'node:path'
import { DEFAULT_AI_TIMEOUT_MS } from '../aiConstants.mjs'
import {
  mapOllamaCapabilities,
  mapOpenAiCompatibleModel,
  normalizeModelDescriptor
} from '../../../common/aiModelCatalog.js'
import {
  buildImageEmbedRequestBody,
  buildTextEmbedRequestBody,
  EMBED_INPUT_TYPE,
  extractEmbeddingVector,
  TEST_EMBED_IMAGE_B64,
  TEST_EMBED_IMAGE_MIME
} from '../EmbedRequestBuilder.mjs'

const withTimeout = async (promise, ms) => {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), ms)
  try {
    return await promise(ctrl.signal)
  } finally {
    clearTimeout(timer)
  }
}

/** 记录 HTTP 模型请求耗时（fn 内应仅为网络请求，不含读图、JSON 解析） */
const runWithModelLog = async (provider, op, model, fn) => {
  const startedAt = Date.now()
  const usedModel = model || provider.model || ''
  const tag = provider.logTag || 'ai'
  if (provider.logger) {
    provider.logger.info(`[HttpAi/${tag}] ${op} start model=${usedModel}`)
  }
  try {
    const result = await fn()
    if (provider.logger) {
      provider.logger.info(
        `[HttpAi/${tag}] ${op} done modelMs=${Date.now() - startedAt}ms model=${usedModel}`
      )
    }
    return result
  } catch (err) {
    if (provider.logger) {
      provider.logger.warn(
        `[HttpAi/${tag}] ${op} failed modelMs=${Date.now() - startedAt}ms model=${usedModel} error=${err?.message || err}`
      )
    }
    throw err
  }
}

const mimeFromPath = (filePath) => {
  const ext = path.extname(filePath || '').toLowerCase()
  if (ext === '.png') return 'image/png'
  if (ext === '.webp') return 'image/webp'
  if (ext === '.gif') return 'image/gif'
  return 'image/jpeg'
}

/** @param {string|{ filePath?: string, buffer?: Buffer, mime?: string }} input */
const readImageSource = (provider, input) => {
  const readStartedAt = Date.now()
  let buf
  let mime = 'image/jpeg'
  let label = ''

  if (typeof input === 'string') {
    input = { filePath: input }
  }

  if (input?.buffer) {
    buf = input.buffer
    mime = input.mime || 'image/jpeg'
    label = 'buffer'
  } else if (input?.filePath) {
    buf = fs.readFileSync(input.filePath)
    mime = mimeFromPath(input.filePath)
    label = input.filePath
  } else {
    throw new Error('vision input requires filePath or buffer')
  }

  const readMs = Date.now() - readStartedAt
  const tag = provider.logTag || 'ai'
  if (provider.logger) {
    const sizeMB = (buf.length / (1024 * 1024)).toFixed(2)
    provider.logger.info(
      `[HttpAi/${tag}] vision-read done readMs=${readMs}ms b64Size=${sizeMB}MB source=${label}`
    )
  }
  return { buf, b64: buf.toString('base64'), mime }
}

const l2Normalize = (vec) => {
  if (!Array.isArray(vec) || !vec.length) return []
  let norm = 0
  for (let i = 0; i < vec.length; i++) norm += vec[i] * vec[i]
  norm = Math.sqrt(norm) || 1
  return vec.map((v) => Number(v) / norm)
}

const visionTestImage = () => ({
  buffer: Buffer.from(TEST_EMBED_IMAGE_B64, 'base64'),
  mime: TEST_EMBED_IMAGE_MIME
})

const runVisionConnectionTest = async (provider, model) => {
  const sample = await provider.analyzeImage(
    visionTestImage(),
    'Reply with exactly: OK',
    model
  )
  return { success: true, sample: String(sample).slice(0, 32) }
}

const mapWithConcurrency = async (items, limit, worker) => {
  const results = new Array(items.length)
  let index = 0

  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (index < items.length) {
      const current = index++
      results[current] = await worker(items[current], current)
    }
  })

  await Promise.all(runners)
  return results
}

export class OllamaProvider {
  constructor(config = {}) {
    this.baseUrl = (config.baseUrl || 'http://127.0.0.1:11434').replace(/\/$/, '')
    this.model = config.model || 'qwen2.5:7b'
    this.timeout = config.timeout || DEFAULT_AI_TIMEOUT_MS
    this.apiKey = config.apiKey || ''
    this.extraHeaders = config.extraHeaders || {}
    this.logger = config.logger || null
    this.logTag = config.logTag || 'ollama'
  }

  headers() {
    const h = { 'Content-Type': 'application/json', ...(this.extraHeaders || {}) }
    if (this.apiKey) h.Authorization = `Bearer ${this.apiKey}`
    return h
  }

  async chatRaw({ messages, model }) {
    const usedModel = model || this.model
    const url = `${this.baseUrl}/api/chat`
    const res = await withTimeout(
      (signal) =>
        fetch(url, {
          method: 'POST',
          headers: this.headers(),
          body: JSON.stringify({ model: usedModel, messages, stream: false }),
          signal
        }),
      this.timeout
    )
    if (!res.ok) {
      const body = await res.text().catch(() => '')
      throw new Error(`Ollama chat ${res.status}: ${body.slice(0, 200)}`)
    }
    const data = await res.json()
    return data.message?.content || ''
  }

  async chat({ messages, model }) {
    const usedModel = model || this.model
    return runWithModelLog(this, 'chat', usedModel, () => this.chatRaw({ messages, model: usedModel }))
  }

  async embed(text, model, options = {}) {
    const usedModel = model || this.model
    return runWithModelLog(this, 'embed', usedModel, async () => {
      const attempts = [
        {
          url: `${this.baseUrl}/api/embed`,
          body: { model: usedModel, input: text }
        },
        {
          url: `${this.baseUrl}/api/embeddings`,
          body: { model: usedModel, prompt: text }
        }
      ]
      let lastErr = null
      for (const attempt of attempts) {
        try {
          const res = await withTimeout(
            (signal) =>
              fetch(attempt.url, {
                method: 'POST',
                headers: this.headers(),
                body: JSON.stringify(attempt.body),
                signal
              }),
            this.timeout
          )
          if (!res.ok) {
            const errBody = await res.text().catch(() => '')
            lastErr = new Error(`Ollama embed ${res.status}: ${errBody.slice(0, 200)}`)
            continue
          }
          const data = await res.json()
          const raw = extractEmbeddingVector(data)
          if (raw.length) return raw
          lastErr = new Error('Ollama embed empty vector')
        } catch (err) {
          lastErr = err
        }
      }
      throw lastErr || new Error('Ollama embed failed')
    })
  }

  /**
   * 多模态图像 embedding（实验性：依赖 Ollama 对 embed+images 的支持）
   * @param {string|{ filePath?: string }} input
   */
  async embedImage(input, model, options = {}) {
    const usedModel = model || this.model
    const { b64 } = readImageSource(this, input)
    return runWithModelLog(this, 'embed-image', usedModel, async () => {
      const res = await withTimeout(
        (signal) =>
          fetch(`${this.baseUrl}/api/embed`, {
            method: 'POST',
            headers: this.headers(),
            body: JSON.stringify({ model: usedModel, input: 'image', images: [b64] }),
            signal
          }),
        this.timeout
      )
      if (!res.ok) {
        const body = await res.text().catch(() => '')
        throw new Error(`Ollama embed-image ${res.status}: ${body.slice(0, 200)}`)
      }
      const data = await res.json()
      const raw = extractEmbeddingVector(data)
      return l2Normalize(raw)
    })
  }

  async analyzeImage(input, prompt, visionModel) {
    const usedModel = visionModel || this.model
    const { b64 } = readImageSource(this, input)
    return runWithModelLog(this, 'vision-http', usedModel, () =>
      this.chatRaw({
        model: usedModel,
        messages: [{ role: 'user', content: prompt, images: [b64] }]
      })
    )
  }

  async testConnection(type, model, options = {}) {
    if (type === 'embed-image') {
      const testImg = options.testImage || visionTestImage()
      const vec = await this.embedImage(testImg, model, {
        inputType: EMBED_INPUT_TYPE.PASSAGE
      })
      return { success: true, dim: vec.length }
    }
    if (type === 'embed') {
      const vec = await this.embed('ping', model, {
        inputType: options.inputType || EMBED_INPUT_TYPE.QUERY
      })
      return { success: true, dim: vec.length }
    }
    if (type === 'vision') {
      return await runVisionConnectionTest(this, model)
    }
    const text = await this.chat({
      model,
      messages: [{ role: 'user', content: 'Reply OK only' }]
    })
    return { success: true, sample: String(text).slice(0, 32) }
  }

  async fetchShow(name) {
    const res = await withTimeout(
      (signal) =>
        fetch(`${this.baseUrl}/api/show`, {
          method: 'POST',
          headers: this.headers(),
          body: JSON.stringify({ name }),
          signal
        }),
      Math.min(this.timeout, 10000)
    )
    if (!res.ok) return null
    return res.json().catch(() => null)
  }

  async describeModel(item) {
    const id = item?.name || item?.model
    if (!id) return null

    const tagCaps = item?.capabilities
    if (Array.isArray(tagCaps) && tagCaps.length) {
      const mapped = mapOllamaCapabilities(tagCaps)
      return normalizeModelDescriptor({ id, ...mapped, source: 'ollama-tags' })
    }

    const show = await this.fetchShow(id)
    if (Array.isArray(show?.capabilities) && show.capabilities.length) {
      const mapped = mapOllamaCapabilities(show.capabilities)
      return normalizeModelDescriptor({ id, ...mapped, source: 'ollama-show' })
    }

    return normalizeModelDescriptor({ id, source: 'name' })
  }

  async listModelCatalog() {
    const res = await withTimeout(
      (signal) =>
        fetch(`${this.baseUrl}/api/tags`, {
          method: 'GET',
          headers: this.headers(),
          signal
        }),
      Math.min(this.timeout, 15000)
    )
    if (!res.ok) {
      const body = await res.text().catch(() => '')
      throw new Error(`Ollama tags ${res.status}: ${body.slice(0, 200)}`)
    }
    const data = await res.json()
    const models = data.models || []
    const descriptors = await mapWithConcurrency(models, 4, (item) => this.describeModel(item))
    return descriptors.filter(Boolean)
  }

  async listModels() {
    const catalog = await this.listModelCatalog()
    return catalog.map((item) => item.id)
  }
}

export class OpenAiCompatibleProvider {
  constructor(config = {}) {
    this.baseUrl = (config.baseUrl || '').replace(/\/$/, '')
    this.model = config.model || 'gpt-4o-mini'
    this.timeout = config.timeout || DEFAULT_AI_TIMEOUT_MS
    this.apiKey = config.apiKey || ''
    this.extraHeaders = config.extraHeaders || {}
    this.logger = config.logger || null
    this.logTag = config.logTag || 'openai'
  }

  headers() {
    const h = { 'Content-Type': 'application/json', ...(this.extraHeaders || {}) }
    if (this.apiKey) h.Authorization = `Bearer ${this.apiKey}`
    return h
  }

  api(path) {
    const base = this.baseUrl.endsWith('/v1') ? this.baseUrl : `${this.baseUrl}/v1`
    return `${base}${path}`
  }

  async chatRaw({ messages, model }) {
    const usedModel = model || this.model
    const res = await withTimeout(
      (signal) =>
        fetch(this.api('/chat/completions'), {
          method: 'POST',
          headers: this.headers(),
          body: JSON.stringify({ model: usedModel, messages, stream: false }),
          signal
        }),
      this.timeout
    )
    if (!res.ok) {
      const body = await res.text().catch(() => '')
      throw new Error(`OpenAI-compatible chat ${res.status}: ${body.slice(0, 200)}`)
    }
    const data = await res.json()
    return data.choices?.[0]?.message?.content || ''
  }

  async chat({ messages, model }) {
    const usedModel = model || this.model
    return runWithModelLog(this, 'chat', usedModel, () => this.chatRaw({ messages, model: usedModel }))
  }

  async embed(text, model, options = {}) {
    const usedModel = model || this.model
    return runWithModelLog(this, 'embed', usedModel, async () => {
      const { body, profile } = buildTextEmbedRequestBody(usedModel, text, {
        baseUrl: this.baseUrl,
        inputType: options.inputType || EMBED_INPUT_TYPE.QUERY
      })
      const res = await withTimeout(
        (signal) =>
          fetch(this.api('/embeddings'), {
            method: 'POST',
            headers: this.headers(),
            body: JSON.stringify(body),
            signal
          }),
        this.timeout
      )
      if (!res.ok) {
        const errBody = await res.text().catch(() => '')
        throw new Error(
          `OpenAI-compatible embed ${res.status} profile=${profile}: ${errBody.slice(0, 200)}`
        )
      }
      const data = await res.json()
      return extractEmbeddingVector(data)
    })
  }

  /**
   * 多模态图像 embedding（OpenAI 兼容；NVIDIA / vLLM 非对称模型需 input_type）
   * @param {object} [options] - { inputType?: 'query'|'passage', imageName?: string }
   */
  async embedImage(input, model, options = {}) {
    const usedModel = model || this.model
    const { b64, mime } = readImageSource(this, input)
    const dataUri = `data:${mime};base64,${b64}`

    return runWithModelLog(this, 'embed-image', usedModel, async () => {
      const { body, profile } = buildImageEmbedRequestBody(usedModel, dataUri, {
        baseUrl: this.baseUrl,
        inputType: options.inputType || EMBED_INPUT_TYPE.PASSAGE
      })

      const res = await withTimeout(
        (signal) =>
          fetch(this.api('/embeddings'), {
            method: 'POST',
            headers: this.headers(),
            body: JSON.stringify(body),
            signal
          }),
        this.timeout
      )
      if (!res.ok) {
        const errBody = await res.text().catch(() => '')
        throw new Error(
          `OpenAI-compatible embed-image ${res.status} profile=${profile}: ${errBody.slice(0, 200)}`
        )
      }
      const data = await res.json()
      const raw = extractEmbeddingVector(data)
      return l2Normalize(raw)
    })
  }

  async analyzeImage(input, prompt, visionModel) {
    const usedModel = visionModel || this.model
    const { b64, mime } = readImageSource(this, input)
    return runWithModelLog(this, 'vision-http', usedModel, () =>
      this.chatRaw({
        model: usedModel,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: prompt },
              { type: 'image_url', image_url: { url: `data:${mime};base64,${b64}` } }
            ]
          }
        ]
      })
    )
  }

  async testConnection(type, model, options = {}) {
    if (type === 'embed-image') {
      const testImg = options.testImage || visionTestImage()
      const vec = await this.embedImage(testImg, model, {
        inputType: EMBED_INPUT_TYPE.PASSAGE
      })
      return { success: true, dim: vec.length }
    }
    if (type === 'embed') {
      const vec = await this.embed('ping', model, {
        inputType: options.inputType || EMBED_INPUT_TYPE.QUERY
      })
      return { success: true, dim: vec.length }
    }
    if (type === 'vision') {
      return await runVisionConnectionTest(this, model)
    }
    const text = await this.chat({
      model,
      messages: [{ role: 'user', content: 'Reply OK only' }]
    })
    return { success: true, sample: String(text).slice(0, 32) }
  }

  async fetchJson(url, signal) {
    const res = await fetch(url, {
      method: 'GET',
      headers: this.headers(),
      signal
    })
    if (!res.ok) {
      const body = await res.text().catch(() => '')
      throw new Error(`OpenAI-compatible models ${res.status}: ${body.slice(0, 200)}`)
    }
    return res.json()
  }

  async listChatModelCatalog() {
    const data = await withTimeout(
      (signal) => this.fetchJson(this.api('/models'), signal),
      Math.min(this.timeout, 15000)
    )
    return (data.data || []).map((item) => mapOpenAiCompatibleModel(item)).filter((item) => item.id)
  }

  async listEmbeddingModelCatalog() {
    try {
      const data = await withTimeout(
        (signal) => this.fetchJson(this.api('/embeddings/models'), signal),
        Math.min(this.timeout, 15000)
      )
      const list = data.data || data.models || []
      if (Array.isArray(list) && list.length) {
        return list.map((item) => mapOpenAiCompatibleModel(item)).filter((item) => item.id)
      }
    } catch {
      // 部分服务商无独立 embedding 列表，回退 chat models 元数据
    }

    const chatCatalog = await this.listChatModelCatalog()
    return chatCatalog.filter((item) =>
      (item.outputModalities || []).includes('embeddings')
    )
  }

  async listModelCatalog(purpose = 'text') {
    if (purpose === 'embed') {
      return this.listEmbeddingModelCatalog()
    }
    return this.listChatModelCatalog()
  }

  async listModels(purpose = 'text') {
    const catalog = await this.listModelCatalog(purpose)
    return catalog.map((item) => item.id)
  }
}
