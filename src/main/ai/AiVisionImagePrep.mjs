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
  AI_VISION_PREPROCESS_MIN_MB_DEFAULT,
  EMBED_IMAGE_INPUT_CHARS_MARGIN,
  EMBED_IMAGE_MAX_INPUT_CHARS
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
  if (meta.reason === 'resized' || meta.reason === 'embed_shrunk') {
    const oW = meta.originalW || '?'
    const oH = meta.originalH || '?'
    const outW = meta.outputW || meta.embedLongEdge || '?'
    const outH = meta.outputH || meta.embedLongEdge || '?'
    const oMb = meta.originalBytes ? (meta.originalBytes / (1024 * 1024)).toFixed(2) : '?'
    const outMb = meta.outputBytes ? (meta.outputBytes / (1024 * 1024)).toFixed(2) : '?'
    const embedNote =
      meta.reason === 'embed_shrunk' ? ' embedLimit=ok' : ''
    return `preprocess=${meta.reason} orig=${oW}x${oH}/${oMb}MB out=${outW}x${outH}/${outMb}MB prepMs=${meta.prepMs || 0}${embedNote}`
  }
  return `preprocess=original reason=${meta.reason || 'unknown'}`
}

/** base64 编码后字符数（不含 data URI 前缀） */
export function estimateBase64Chars(byteLength) {
  if (!byteLength || byteLength <= 0) return 0
  return Math.ceil(byteLength / 3) * 4
}

/** 是否可能超过远程 embed-image input 上限 */
export function exceedsEmbedInputLimit(byteLength) {
  return (
    estimateBase64Chars(byteLength) + 64 >
    EMBED_IMAGE_MAX_INPUT_CHARS - EMBED_IMAGE_INPUT_CHARS_MARGIN
  )
}

async function shrinkImageBuffer(buffer, longEdge, quality) {
  return sharp(buffer)
    .rotate()
    .resize({
      width: longEdge,
      height: longEdge,
      fit: 'inside',
      withoutEnlargement: true,
      kernel: 'lanczos3',
      fastShrinkOnLoad: true
    })
    .jpeg({ quality, mozjpeg: true })
    .toBuffer()
}

export async function shrinkBufferToEmbedLimit(buffer, ai, logger, filePath, meta = {}) {
  const opts = resolveAiVisionPrepOptions(ai)
  let longEdge = opts.maxLongEdge
  let quality = opts.jpegQuality
  let current = buffer

  while (exceedsEmbedInputLimit(current.length) && longEdge >= AI_VISION_LONG_EDGE_MIN) {
    longEdge = Math.max(AI_VISION_LONG_EDGE_MIN, Math.floor(longEdge * 0.72))
    quality = Math.max(AI_VISION_JPEG_QUALITY_MIN, quality - 5)
    current = await shrinkImageBuffer(current, longEdge, quality)
    if (logger) {
      const b64Mb = (estimateBase64Chars(current.length) / (1024 * 1024)).toFixed(2)
      logger.info(
        `[AiVisionPrep] embed-shrink file=${filePath} longEdge=${longEdge} quality=${quality} rawMB=${(current.length / (1024 * 1024)).toFixed(2)} estB64MB=${b64Mb}`
      )
    }
  }

  return {
    buffer: current,
    meta: {
      ...meta,
      reason: 'embed_shrunk',
      outputBytes: current.length,
      embedLongEdge: longEdge,
      embedQuality: quality,
      withinEmbedLimit: !exceedsEmbedInputLimit(current.length)
    }
  }
}

/**
 * 远程 embed-image 前缩图：复用视觉分析预处理，并确保 base64 不超过常见 API 上限。
 */
export async function prepareVisionImageForEmbed(filePath, ai = {}, logger = null) {
  const startedAt = Date.now()
  const embedAi = { ...ai, visionPreprocessMinSizeMB: 0 }
  const prepared = await prepareVisionImageForAnalysis(filePath, embedAi, logger)

  let buffer = prepared.buffer
  if (!buffer) {
    try {
      buffer = fs.readFileSync(filePath)
    } catch (err) {
      if (logger) {
        logger.warn(`[AiVisionPrep] embed read failed file=${filePath} error=${err?.message || err}`)
      }
      return {
        ...prepared,
        meta: { ...prepared.meta, prepMs: Date.now() - startedAt, reason: 'read_failed' }
      }
    }
  }

  if (!exceedsEmbedInputLimit(buffer.length)) {
    return {
      source: prepared.buffer ? prepared.source : 'original',
      filePath,
      buffer: prepared.buffer ? buffer : null,
      meta: {
        ...prepared.meta,
        embedChecked: true,
        withinEmbedLimit: true,
        prepMs: Date.now() - startedAt
      }
    }
  }

  const ext = path.extname(filePath).toLowerCase()
  if (!RESIZABLE_EXT.has(ext)) {
    if (logger) {
      logger.warn(
        `[AiVisionPrep] embed payload too large and ext not resizable file=${filePath} rawMB=${(buffer.length / (1024 * 1024)).toFixed(2)}`
      )
    }
    return {
      source: 'original',
      filePath,
      buffer: null,
      meta: {
        ...prepared.meta,
        reason: 'embed_too_large_unsupported_ext',
        withinEmbedLimit: false,
        prepMs: Date.now() - startedAt
      }
    }
  }

  const shrunk = await shrinkBufferToEmbedLimit(buffer, ai, logger, filePath, prepared.meta)
  if (!shrunk.meta.withinEmbedLimit && logger) {
    logger.warn(
      `[AiVisionPrep] embed still over limit after shrink file=${filePath} rawMB=${(shrunk.buffer.length / (1024 * 1024)).toFixed(2)}`
    )
  }

  return {
    source: 'resized',
    filePath,
    buffer: shrunk.buffer,
    meta: {
      ...shrunk.meta,
      prepMs: Date.now() - startedAt
    }
  }
}
