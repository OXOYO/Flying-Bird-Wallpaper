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

/** 最低评分过滤默认值（AI 设置、系统自动合集） */
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

/** 合集选图/搜索：排除隐私空间（与探索页主库一致） */
export const COLLECTION_PRIVACY_EXCLUDE_SQL =
  'NOT EXISTS (SELECT 1 FROM fbw_privacy_space p WHERE p.resourceId = r.id)'

/** 与 calculateImageQuality、publicData.qualityList、探索筛选一致（库内为 8K/5K/4K/2K） */
export const RESOURCE_QUALITY_DB_VALUES = ['8K', '5K', '4K', '2K']

export const COLLECTION_ALLOWED_QUALITY = new Set(['4k', '2k', '8k', '5k'])

export function normalizeCollectionQuality(quality) {
  if (!Array.isArray(quality)) return []
  const out = []
  for (const raw of quality) {
    const v = String(raw || '')
      .trim()
      .toLowerCase()
    if (COLLECTION_ALLOWED_QUALITY.has(v)) {
      out.push(v === '4k' ? '4K' : v === '2k' ? '2K' : v === '8k' ? '8K' : v === '5k' ? '5K' : v)
    }
  }
  return [...new Set(out)]
}

/** 中文短词检索（规则兜底）：对半切 / 首尾二字，供 jieba 仅产出整词时使用 */
export function expandChineseKeywordTags(keyword) {
  const w = String(keyword || '').trim()
  if (!w) return []
  const set = new Set([w])
  if (w.length >= 4) {
    const mid = Math.floor(w.length / 2)
    set.add(w.slice(0, mid))
    set.add(w.slice(mid))
  } else if (w.length >= 3) {
    set.add(w.slice(0, 2))
    set.add(w.slice(-2))
  }
  return [...set].filter((t) => isValidAutoCollectionTag(t))
}

export function normalizeOrientationToIsLandscape(orientation) {
  if (!Array.isArray(orientation)) return []
  const out = []
  for (const raw of orientation) {
    const v = String(raw).trim().toLowerCase()
    if (v === '1' || v === 'landscape' || v === 'horizontal') out.push(1)
    else if (v === '0' || v === 'portrait' || v === 'vertical') out.push(0)
    else if (/^-?\d+$/.test(v)) {
      const n = Number(v)
      if (n === 0 || n === 1) out.push(n)
    }
  }
  return out.length ? [out[0]] : []
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
