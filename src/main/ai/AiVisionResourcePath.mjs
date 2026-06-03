import path from 'node:path'

const VISION_IMAGE_EXTS = ['.jpg', '.jpeg', '.png', '.webp', '.bmp', '.gif']

export function isVisionImageExt(filePath) {
  const ext = path.extname(filePath || '').toLowerCase()
  return VISION_IMAGE_EXTS.includes(ext)
}

/**
 * 解析用于视觉分析 / 画面向量的本地图片路径。
 * 图片用 filePath；视频用 posterPath（方案 A：封面单帧）。
 * @returns {string|null}
 */
export function resolveVisionImagePath(row) {
  if (!row) return null
  if (row.fileType === 'image') {
    const p = row.filePath
    return p && isVisionImageExt(p) ? p : null
  }
  if (row.fileType === 'video') {
    const p = row.posterPath
    return p && isVisionImageExt(p) ? p : null
  }
  return null
}

/** 可进入 AI 分析队列的资源类型条件（SQL WHERE 片段） */
export function buildAnalyzableResourceWhere(alias = 'r') {
  const a = alias
  return `(
    (${a}.fileType = 'image' AND ${a}.filePath IS NOT NULL AND ${a}.filePath != '')
    OR
    (${a}.fileType = 'video' AND ${a}.posterPath IS NOT NULL AND ${a}.posterPath != '')
  )`
}

/** 清空 / 统计 AI 数据时的资源范围 */
export const AI_ANALYZABLE_FILE_TYPES_WHERE = `fileType IN ('image', 'video')`
