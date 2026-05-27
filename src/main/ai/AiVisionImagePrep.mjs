import fs from 'node:fs'
import path from 'node:path'
import sharp from 'sharp'
import {
  AI_VISION_JPEG_QUALITY_DEFAULT,
  AI_VISION_JPEG_QUALITY_MAX,
  AI_VISION_JPEG_QUALITY_MIN,
  AI_VISION_LONG_EDGE_DEFAULT,
  AI_VISION_LONG_EDGE_MAX,
  AI_VISION_LONG_EDGE_MIN,
  AI_VISION_PREPROCESS_MIN_MB_DEFAULT
} from './aiConstants.mjs'

const RESIZABLE_EXT = new Set(['.jpg', '.jpeg', '.png', '.webp', '.bmp', '.gif'])

const clamp = (value, min, max) => Math.min(max, Math.max(min, value))

const resolveAiVisionPrepOptions = (ai = {}) => ({
  enabled: ai.visionPreprocess !== false,
  maxLongEdge: clamp(
    Number(ai.visionMaxLongEdge) || AI_VISION_LONG_EDGE_DEFAULT,
    AI_VISION_LONG_EDGE_MIN,
    AI_VISION_LONG_EDGE_MAX
  ),
  minSizeMB: Math.max(0, Number(ai.visionPreprocessMinSizeMB) ?? AI_VISION_PREPROCESS_MIN_MB_DEFAULT),
  jpegQuality: clamp(
    Number(ai.visionJpegQuality) || AI_VISION_JPEG_QUALITY_DEFAULT,
    AI_VISION_JPEG_QUALITY_MIN,
    AI_VISION_JPEG_QUALITY_MAX
  )
})

/**
 * 分析前缩图：返回原图路径或 JPEG buffer，供视觉模型使用。
 * @returns {Promise<{ source: 'original'|'resized', filePath: string, buffer: Buffer|null, meta: object }>}
 */
export async function prepareVisionImageForAnalysis(filePath, ai = {}, logger = null) {
  const startedAt = Date.now()
  const opts = resolveAiVisionPrepOptions(ai)
  let originalBytes = 0
  let originalW = 0
  let originalH = 0

  try {
    const stat = fs.statSync(filePath)
    originalBytes = stat.size
  } catch (err) {
    if (logger) {
      logger.warn(`[AiVisionPrep] stat failed file=${filePath} error=${err?.message || err}`)
    }
    return {
      source: 'original',
      filePath,
      buffer: null,
      meta: { prepMs: Date.now() - startedAt, reason: 'stat_failed' }
    }
  }

  const ext = path.extname(filePath).toLowerCase()
  if (!opts.enabled || !RESIZABLE_EXT.has(ext)) {
    const reason = !opts.enabled ? 'disabled' : 'unsupported_ext'
    logPrep(logger, 'skipped', filePath, { reason, originalBytes, prepMs: Date.now() - startedAt })
    return {
      source: 'original',
      filePath,
      buffer: null,
      meta: { reason, originalBytes, originalW, originalH, prepMs: Date.now() - startedAt }
    }
  }

  try {
    const meta = await sharp(filePath).metadata()
    originalW = meta.width || 0
    originalH = meta.height || 0
    const longEdge = Math.max(originalW, originalH)
    const fileMB = originalBytes / (1024 * 1024)

    if (fileMB <= opts.minSizeMB && longEdge <= opts.maxLongEdge) {
      logPrep(logger, 'skipped', filePath, {
        reason: 'below_threshold',
        originalBytes,
        originalW,
        originalH,
        fileMB: fileMB.toFixed(2),
        longEdge,
        prepMs: Date.now() - startedAt
      })
      return {
        source: 'original',
        filePath,
        buffer: null,
        meta: {
          reason: 'below_threshold',
          originalBytes,
          originalW,
          originalH,
          fileMB,
          longEdge,
          prepMs: Date.now() - startedAt
        }
      }
    }

    const buffer = await sharp(filePath)
      .rotate()
      .resize({
        width: opts.maxLongEdge,
        height: opts.maxLongEdge,
        fit: 'inside',
        withoutEnlargement: true,
        kernel: 'lanczos3',
        fastShrinkOnLoad: true
      })
      .jpeg({ quality: opts.jpegQuality, mozjpeg: true })
      .toBuffer()

    const outMeta = await sharp(buffer).metadata()
    const prepMs = Date.now() - startedAt
    logPrep(logger, 'resized', filePath, {
      originalBytes,
      originalW,
      originalH,
      outputBytes: buffer.length,
      outputW: outMeta.width,
      outputH: outMeta.height,
      maxLongEdge: opts.maxLongEdge,
      prepMs
    })

    return {
      source: 'resized',
      filePath,
      buffer,
      meta: {
        reason: 'resized',
        originalBytes,
        originalW,
        originalH,
        outputBytes: buffer.length,
        outputW: outMeta.width,
        outputH: outMeta.height,
        prepMs
      }
    }
  } catch (err) {
    if (logger) {
      logger.warn(
        `[AiVisionPrep] resize failed, fallback original file=${filePath} error=${err?.message || err}`
      )
    }
    return {
      source: 'original',
      filePath,
      buffer: null,
      meta: {
        reason: 'resize_failed',
        originalBytes,
        originalW,
        originalH,
        prepMs: Date.now() - startedAt
      }
    }
  }
}

const logPrep = (logger, action, filePath, fields) => {
  if (!logger) return
  const parts = Object.entries(fields)
    .map(([k, v]) => `${k}=${v}`)
    .join(' ')
  logger.info(`[AiVisionPrep] ${action} file=${filePath} ${parts}`)
}

export function formatVisionPrepLog(meta = {}) {
  if (!meta || meta.reason === 'disabled') return 'preprocess=off'
  if (meta.reason === 'below_threshold' || meta.reason === 'unsupported_ext') {
    return `preprocess=original reason=${meta.reason}`
  }
  if (meta.reason === 'resized') {
    const oW = meta.originalW || '?'
    const oH = meta.originalH || '?'
    const outW = meta.outputW || '?'
    const outH = meta.outputH || '?'
    const oMb = meta.originalBytes ? (meta.originalBytes / (1024 * 1024)).toFixed(2) : '?'
    const outMb = meta.outputBytes ? (meta.outputBytes / (1024 * 1024)).toFixed(2) : '?'
    return `preprocess=resized orig=${oW}x${oH}/${oMb}MB out=${outW}x${outH}/${outMb}MB prepMs=${meta.prepMs || 0}`
  }
  return `preprocess=original reason=${meta.reason || 'unknown'}`
}
