import fs from 'node:fs'
import { DEFAULT_AI_TIMEOUT_MS } from '../aiConstants.mjs'
import {
  mapOllamaCapabilities,
  mapOpenAiCompatibleModel,
  normalizeModelDescriptor
} from '../../../common/aiModelCatalog.js'

const withTimeout = async (promise, ms) => {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), ms)
  try {
    return await promise(ctrl.signal)
  } finally {
    clearTimeout(timer)
  }
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
  }

  headers() {
    const h = { 'Content-Type': 'application/json', ...(this.extraHeaders || {}) }
    if (this.apiKey) h.Authorization = `Bearer ${this.apiKey}`
    return h
  }

  async chat({ messages, model }) {
    const url = `${this.baseUrl}/api/chat`
    const res = await withTimeout(
      (signal) =>
        fetch(url, {
          method: 'POST',
          headers: this.headers(),
          body: JSON.stringify({ model: model || this.model, messages, stream: false }),
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

  async embed(text, model) {
    const url = `${this.baseUrl}/api/embeddings`
    const res = await withTimeout(
      (signal) =>
        fetch(url, {
          method: 'POST',
          headers: this.headers(),
          body: JSON.stringify({ model: model || this.model, prompt: text }),
          signal
        }),
      this.timeout
    )
    if (!res.ok) {
      const body = await res.text().catch(() => '')
      throw new Error(`Ollama embed ${res.status}: ${body.slice(0, 200)}`)
    }
    const data = await res.json()
    return data.embedding || []
  }

  async analyzeImage(filePath, prompt, visionModel) {
    const buf = fs.readFileSync(filePath)
    const b64 = buf.toString('base64')
    const content = await this.chat({
      model: visionModel || this.model,
      messages: [{ role: 'user', content: prompt, images: [b64] }]
    })
    return content
  }

  async testConnection(type, model) {
    if (type === 'embed') {
      const vec = await this.embed('ping', model)
      return { success: true, dim: vec.length }
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

  async chat({ messages, model }) {
    const res = await withTimeout(
      (signal) =>
        fetch(this.api('/chat/completions'), {
          method: 'POST',
          headers: this.headers(),
          body: JSON.stringify({ model: model || this.model, messages, stream: false }),
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

  async embed(text, model) {
    const res = await withTimeout(
      (signal) =>
        fetch(this.api('/embeddings'), {
          method: 'POST',
          headers: this.headers(),
          body: JSON.stringify({ model: model || this.model, input: text }),
          signal
        }),
      this.timeout
    )
    if (!res.ok) {
      const body = await res.text().catch(() => '')
      throw new Error(`OpenAI-compatible embed ${res.status}: ${body.slice(0, 200)}`)
    }
    const data = await res.json()
    return data.data?.[0]?.embedding || []
  }

  async analyzeImage(filePath, prompt, visionModel) {
    const buf = fs.readFileSync(filePath)
    const b64 = buf.toString('base64')
    const ext = filePath.split('.').pop()?.toLowerCase() || 'jpeg'
    const mime = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg'
    const content = await this.chat({
      model: visionModel || this.model,
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
    return content
  }

  async testConnection(type, model) {
    if (type === 'embed') {
      const vec = await this.embed('ping', model)
      return { success: true, dim: vec.length }
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
