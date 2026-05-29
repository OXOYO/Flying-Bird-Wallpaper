/**
 * MobileCLIP2-S0 视觉向量（ONNX，仅图像编码器）
 * 模型：resources/models/mobileclip2_s0_vision.onnx
 */

import fs from 'node:fs'
import path from 'node:path'
import * as ort from 'onnxruntime-node'
import sharp from 'sharp'
import { VISUAL_EMBED_DIM, VISUAL_EMBED_IMAGE_SIZE, VISUAL_EMBED_MODEL_ID } from './aiConstants.mjs'

const VISION_ONNX = 'mobileclip2_s0_vision.onnx'

export default class ImageVisualEmbedder {
  static _instance = null

  static getInstance(logger, modelDir) {
    if (!ImageVisualEmbedder._instance) {
      ImageVisualEmbedder._instance = new ImageVisualEmbedder(logger, modelDir)
    }
    return ImageVisualEmbedder._instance
  }

  constructor(logger, modelDir) {
    if (ImageVisualEmbedder._instance) return ImageVisualEmbedder._instance
    this.logger = logger
    this.modelDir =
      modelDir || path.join(process.env.FBW_RESOURCES_PATH || '', './models')
    this.modelPath = path.join(this.modelDir, VISION_ONNX)
    this.session = null
    this._loadPromise = null
    ImageVisualEmbedder._instance = this
  }

  isModelPresent() {
    try {
      return fs.existsSync(this.modelPath)
    } catch {
      return false
    }
  }

  async loadModel() {
    if (this.session) return this.session
    if (this._loadPromise) return this._loadPromise
    this._loadPromise = (async () => {
      if (!this.isModelPresent()) {
        throw new Error(`视觉向量模型不存在: ${this.modelPath}`)
      }
      this.session = await ort.InferenceSession.create(this.modelPath, {
        executionProviders: ['cpu'],
        graphOptimizationLevel: 'all'
      })
      this.logger.info(`[ImageVisualEmbedder] 已加载 ${VISUAL_EMBED_MODEL_ID} (${this.modelPath})`)
      return this.session
    })()
    try {
      return await this._loadPromise
    } catch (err) {
      this._loadPromise = null
      throw err
    }
  }

  /**
   * @param {string} imagePath
   * @returns {Promise<number[]>} L2 归一化后的 512 维向量
   */
  async embedImageFile(imagePath) {
    await this.loadModel()
    const tensor = await this._preprocess(imagePath)
    const out = await this.session.run({ pixel_values: tensor })
    const raw = out.image_embeds?.data
    if (!raw?.length) throw new Error('empty image_embeds')
    const dim = Math.min(VISUAL_EMBED_DIM, raw.length)
    const vec = new Array(dim)
    let norm = 0
    for (let i = 0; i < dim; i++) {
      const v = Number(raw[i]) || 0
      vec[i] = v
      norm += v * v
    }
    norm = Math.sqrt(norm) || 1
    for (let i = 0; i < dim; i++) vec[i] /= norm
    return vec
  }

  async _preprocess(imagePath) {
    const size = VISUAL_EMBED_IMAGE_SIZE
    const raw = await sharp(imagePath)
      .resize(size, size, { fit: 'cover', position: 'centre' })
      .removeAlpha()
      .raw()
      .toBuffer()

    const plane = size * size
    const chw = new Float32Array(3 * plane)
    for (let i = 0; i < plane; i++) {
      const base = i * 3
      const r = raw[base] / 255
      const g = raw[base + 1] / 255
      const b = raw[base + 2] / 255
      chw[i] = r
      chw[plane + i] = g
      chw[2 * plane + i] = b
    }
    return new ort.Tensor('float32', chw, [1, 3, size, size])
  }
}
