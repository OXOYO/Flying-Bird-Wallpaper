/**
 * 图片美学评分
 */

import path from 'node:path'
import * as ort from 'onnxruntime-node'
import sharp from 'sharp'

class ImageScorer {
  constructor(modelPath) {
    this.modelPath =
      modelPath || path.join(process.env.FBW_RESOURCES_PATH, './models/picture_score_fp16.onnx')
    this.model = null
  }

  // 单例模式，确保模型只加载一次
  static getInstance(modelPath) {
    if (!ImageScorer.instance) {
      ImageScorer.instance = new ImageScorer(modelPath)
    }
    return ImageScorer.instance
  }

  async loadModel() {
    if (!this.model) {
      // 启用优化选项
      const options = {
        executionProviders: ['cpu'],
        graphOptimizationLevel: 'all'
      }
      this.model = await ort.InferenceSession.create(this.modelPath, options)
    }
  }

  _float16ToFloat32(binary) {
    if (binary === 0) return 0

    const sign = (binary & 0x8000) !== 0 ? -1 : 1
    let exponent = (binary & 0x7c00) >> 10
    const fraction = binary & 0x03ff

    if (exponent === 0) {
      return sign * Math.pow(2, -14) * (fraction / 0x400)
    } else if (exponent === 31) {
      return fraction ? NaN : sign * Infinity
    }

    exponent = exponent - 15
    return sign * Math.pow(2, exponent) * (1 + fraction / 0x400)
  }

  _float32ToFloat16(float32) {
    const buffer = new ArrayBuffer(4)
    const view = new DataView(buffer)
    view.setFloat32(0, float32)

    const bits = view.getUint32(0)
    const sign = (bits >> 31) & 0x1
    let exponent = (bits >> 23) & 0xff
    let fraction = bits & 0x7fffff

    // 调整指数
    exponent = exponent - 127 + 15

    // 处理特殊情况
    if (exponent <= 0) {
      // 下溢出，转为0
      return (sign << 15) | 0
    } else if (exponent > 31) {
      // 上溢出，转为无穷大
      return (sign << 15) | 0x7c00
    }

    // 正常情况
    exponent = exponent << 10
    fraction = fraction >> 13

    return (sign << 15) | exponent | fraction
  }

  async _preprocessImage(imagePath) {
    try {
      // 使用 sharp 读取和处理图像
      const image = sharp(imagePath)

      // 调整大小为224x224并转换为RGB格式
      const resizedImage = await image
        .resize(224, 224)
        .removeAlpha() // 移除alpha通道确保只有RGB三个通道
        .raw()
        .toBuffer()

      // 转换为float32数组并归一化到[0,1]
      const float32Data = new Float32Array(224 * 224 * 3)
      for (let i = 0; i < resizedImage.length; i++) {
        float32Data[i] = resizedImage[i] / 255.0
      }

      // 转换为CHW格式
      const transposed = new Float32Array(3 * 224 * 224)
      for (let c = 0; c < 3; c++) {
        for (let h = 0; h < 224; h++) {
          for (let w = 0; w < 224; w++) {
            const srcIdx = (h * 224 + w) * 3 + c
            const dstIdx = c * 224 * 224 + h * 224 + w
            transposed[dstIdx] = float32Data[srcIdx]
          }
        }
      }

      // 转换为float16
      const float16DataOutput = new Uint16Array(transposed.length)
      for (let i = 0; i < transposed.length; i++) {
        // 使用正确的float32到float16转换
        float16DataOutput[i] = this._float32ToFloat16(transposed[i])
      }

      return new ort.Tensor('float16', float16DataOutput, [1, 3, 224, 224])
    } catch (err) {
      throw err
    }
  }

  // 添加计算综合评分的方法
  _calculateOverallScore(visual, composition, quality) {
    // 使用加权平均计算综合评分
    // 这里给质量更高权重，因为质量差的图片整体体验会很差
    const weights = {
      visual: 0.25,
      composition: 0.35,
      quality: 0.4
    }

    const overall =
      visual * weights.visual + composition * weights.composition + quality * weights.quality

    return Math.round(overall)
  }

  async predict(imagePath) {
    if (!this.model) {
      await this.loadModel()
    }

    try {
      const tensor = await this._preprocessImage(imagePath)
      const feeds = { input: tensor }
      const results = await this.model.run(feeds)

      const output = results.output.data

      // 将float16转换为float32
      const decodedValues = Array.from(output).map((val) => this._float16ToFloat32(val))

      // 应用校正（基于Web版本的校准）
      const correctedValues = decodedValues.map((val) => {
        // 应用通用缩放校正
        return val * 0.95
      })

      // 计算最终分数（1-100分制）
      const scores = correctedValues.map((val) =>
        Math.round(Math.max(0, Math.min(1, val)) * 1.1 * 99 + 1)
      )

      // 计算综合评分
      return this._calculateOverallScore(scores[0], scores[1], scores[2])
    } catch (err) {
      return 0
    }
  }
}

export default ImageScorer
