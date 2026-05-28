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

/** 系统合集数量下限（库足够大时） */
export const AUTO_COLLECTION_COUNT_MIN = 3

/** 向量聚类至少需要的 embedding 数量 */
export const AUTO_COLLECTION_MIN_EMBEDDINGS = 8

/** 系统合集数量上限默认值（可在 AI 设置中修改） */
export const AUTO_COLLECTION_COUNT_DEFAULT = 20

/** 系统合集数量上限允许的最大值（防止误填过大） */
export const AUTO_COLLECTION_COUNT_ABSOLUTE_MAX = 50

/** 合集 items 分页默认每页条数（前端未传 pageSize 时） */
export const COLLECTION_ITEMS_DEFAULT_PAGE_SIZE = 50

/** 最低评分过滤默认值（AI 设置、搜索、系统合集） */
export const SCORE_MIN_FILTER_DEFAULT = 70

/**
 * 系统自动合集最低分：使用 AI 设置中的 scoreMinFilter，无效时回退默认值
 */
export function resolveAutoCollectionScoreMin(ai = {}) {
  const v = ai.scoreMinFilter
  if (v == null || v === '') return SCORE_MIN_FILTER_DEFAULT
  const n = Number(v)
  if (!Number.isFinite(n)) return SCORE_MIN_FILTER_DEFAULT
  return Math.min(100, Math.max(0, Math.round(n)))
}

/**
 * 读取 AI 设置中的系统合集数量上限
 */
export function resolveAutoCollectionCountMax(ai = {}) {
  const v = ai.autoCollectionsMaxCount
  const n =
    v == null || v === '' ? AUTO_COLLECTION_COUNT_DEFAULT : Number(v)
  if (!Number.isFinite(n)) return AUTO_COLLECTION_COUNT_DEFAULT
  return Math.min(
    AUTO_COLLECTION_COUNT_ABSOLUTE_MAX,
    Math.max(AUTO_COLLECTION_COUNT_MIN, Math.round(n))
  )
}

/**
 * 根据已分析图片数量建议系统合集个数（受 AI 设置 autoCollectionsMaxCount 封顶）
 */
export function computeAutoCollectionCount(analyzedCount, ai = {}) {
  if (analyzedCount < AUTO_COLLECTION_MIN_ANALYZED) return 0
  const cap = resolveAutoCollectionCountMax(ai)
  const n = Math.round(Math.sqrt(analyzedCount) * 1.2)
  return Math.min(cap, Math.max(AUTO_COLLECTION_COUNT_MIN, n))
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
