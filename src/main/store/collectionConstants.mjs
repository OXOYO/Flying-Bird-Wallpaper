/** 智能合集：刷新策略 + 自动策展参数 */

export const COLLECTION_SOURCE = {
  USER: 'user',
  AUTO: 'auto'
}

export const COLLECTION_REFRESH_MODES = ['manual', '1h', '6h', '12h', '24h', 'on_analysis']

export const COLLECTION_REFRESH_MS = {
  manual: 0,
  '1h': 60 * 60 * 1000,
  '6h': 6 * 60 * 60 * 1000,
  '12h': 12 * 60 * 60 * 1000,
  '24h': 24 * 60 * 60 * 1000,
  on_analysis: 0
}

/** 至少多少张已分析图才开始生成系统合集 */
export const AUTO_COLLECTION_MIN_ANALYZED = 8

/** 单个标签至少关联多少张已分析图才建合集 */
export const AUTO_COLLECTION_MIN_TAG_RESOURCES = 3

/** 每个系统合集至少包含多少张图 */
export const AUTO_COLLECTION_MIN_ITEMS = 3

/** 每个系统合集最多快照数量 */
export const AUTO_COLLECTION_ITEM_LIMIT = 40

/** 系统合集数量下限（库足够大时） */
export const AUTO_COLLECTION_COUNT_MIN = 3

/** 向量聚类至少需要的 embedding 数量 */
export const AUTO_COLLECTION_MIN_EMBEDDINGS = 8

/** 系统合集数量上限 */
export const AUTO_COLLECTION_COUNT_MAX = 12

/**
 * 根据已分析图片数量建议系统合集个数
 * 例：20 张 → 5 个，50 张 → 8 个，100+ 张 → 12 个（封顶）
 */
export function computeAutoCollectionCount(analyzedCount) {
  if (analyzedCount < AUTO_COLLECTION_MIN_ANALYZED) return 0
  const n = Math.round(Math.sqrt(analyzedCount) * 1.2)
  return Math.min(
    AUTO_COLLECTION_COUNT_MAX,
    Math.max(AUTO_COLLECTION_COUNT_MIN, n)
  )
}

export function isCollectionRefreshDue(collection, now = Date.now()) {
  if (collection?.refreshMode === 'on_analysis') return false
  const ms = COLLECTION_REFRESH_MS[collection?.refreshMode]
  if (!ms) return false
  if (!collection.lastGeneratedAt) return true
  const last = new Date(collection.lastGeneratedAt).getTime()
  if (Number.isNaN(last)) return true
  return now - last >= ms
}

export function isValidAutoCollectionTag(tag) {
  if (!tag || typeof tag !== 'string') return false
  const word = tag.trim()
  if (word.length < 2 || word.length > 24) return false
  if (/^official:/i.test(word)) return false
  if (/unsplash/i.test(word)) return false
  if (/^[\d_,.\-:;]+$/.test(word)) return false
  return true
}
