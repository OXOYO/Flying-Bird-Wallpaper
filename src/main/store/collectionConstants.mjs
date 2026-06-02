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

/** 稳定后增量入集：新图画面向量与合集质心的最低余弦相似度 */
export const AUTO_COLLECTION_INCREMENTAL_MIN_SIMILARITY = 0.7

/** 聚类成员与簇质心的最低余弦相似度（剔除离群图，提升标题与内容一致） */
export const AUTO_COLLECTION_CLUSTER_MIN_SIMILARITY = 0.77

/** 命名后：单张图与合集标题的最低 n-gram 重叠（用于剔图，低于簇级标题校验） */
export const AUTO_COLLECTION_MEMBER_TITLE_MIN_OVERLAP = 0.35

/** 两组合集成员 Jaccard（或较小集被较大集包含比例）不低于此值则合并 */
export const AUTO_COLLECTION_PLAN_MERGE_MIN_JACCARD = 0.85

export function normalizeCollectionPlanName(name = '') {
  return String(name || '')
    .trim()
    .replace(/\s+/g, ' ')
}

export function computeResourceIdJaccard(idsA = [], idsB = []) {
  const a = new Set(idsA)
  const b = new Set(idsB)
  if (!a.size && !b.size) return 1
  if (!a.size || !b.size) return 0
  let inter = 0
  for (const id of a) {
    if (b.has(id)) inter++
  }
  const union = a.size + b.size - inter
  return union ? inter / union : 0
}

/** 成员高重叠：Jaccard 达标，或较小集合几乎被较大集合包含 */
export function shouldMergeCollectionMembers(
  idsA = [],
  idsB = [],
  minJaccard = AUTO_COLLECTION_PLAN_MERGE_MIN_JACCARD
) {
  if (computeResourceIdJaccard(idsA, idsB) >= minJaccard) return true
  const a = new Set(idsA)
  const b = new Set(idsB)
  const smaller = a.size <= b.size ? a : b
  const larger = a.size <= b.size ? b : a
  if (!smaller.size) return false
  let inter = 0
  for (const id of smaller) {
    if (larger.has(id)) inter++
  }
  return inter / smaller.size >= minJaccard
}

export function shouldMergeCollectionPlans(
  planA,
  planB,
  minJaccard = AUTO_COLLECTION_PLAN_MERGE_MIN_JACCARD
) {
  const nameA = normalizeCollectionPlanName(planA?.name)
  const nameB = normalizeCollectionPlanName(planB?.name)
  if (nameA && nameB && nameA === nameB) return true
  return shouldMergeCollectionMembers(planA?.resourceIds, planB?.resourceIds, minJaccard)
}

export function mergeTwoCollectionPlans(primary, secondary) {
  const seen = new Set(primary.resourceIds || [])
  const resourceIds = [...(primary.resourceIds || [])]
  for (const id of secondary.resourceIds || []) {
    if (!seen.has(id)) {
      seen.add(id)
      resourceIds.push(id)
    }
  }
  const tags = [...new Set([...(primary.tags || []), ...(secondary.tags || [])])].slice(0, 12)
  const mergeIds = [
    ...new Set([...(primary.mergeIds || []), ...(secondary.mergeIds || []), secondary.autoKey].filter(Boolean))
  ]
  const promptA = String(primary.prompt || '').trim()
  const promptB = String(secondary.prompt || '').trim()
  return {
    ...primary,
    resourceIds,
    tags,
    mergeIds,
    prompt: promptB.length > promptA.length ? promptB : promptA,
    semanticQuery: primary.semanticQuery || secondary.semanticQuery || primary.name
  }
}

/** 合并同名或成员高重叠的 plan（保留先出现的 autoKey） */
export function mergeCollectionPlans(plans = []) {
  const merged = []
  for (const plan of plans) {
    if (!plan?.resourceIds?.length) continue
    const idx = merged.findIndex((p) => shouldMergeCollectionPlans(p, plan))
    if (idx < 0) {
      merged.push({ ...plan, resourceIds: [...plan.resourceIds] })
      continue
    }
    merged[idx] = mergeTwoCollectionPlans(merged[idx], plan)
  }
  return merged
}

/** 系统合集标题：LLM 须在此长度内生成，超长则丢弃并降级，不做截断 */
export const AUTO_COLLECTION_NAME_MIN_LEN = 2
/** 硬上限防长句，不做截断 */
export const AUTO_COLLECTION_NAME_MAX_LEN = 40

/** 校验 LLM/降级标题：拒绝明显长句，不做语言相关 NLP */
export function looksLikeDescriptiveSentence(text) {
  const s = String(text || '').trim()
  if (!s) return true
  if (s.length > AUTO_COLLECTION_NAME_MAX_LEN) return true
  if (/[。！？!?]/.test(s)) return true
  const cjk = (s.match(/[\u4e00-\u9fff]/g) || []).length
  if (cjk >= 12) return true
  const words = s.split(/\s+/).filter(Boolean)
  if (words.length > 8) return true
  return false
}

/** 内部簇 id / 空串等占位，非语言相关 */
export function isPlaceholderCollectionTitle(name, clusterId = '') {
  const s = String(name || '').trim()
  if (!s) return true
  if (clusterId && s.toLowerCase() === String(clusterId).toLowerCase()) return true
  if (/^vec:\d+$/i.test(s)) return true
  return false
}

export function normalizeAutoCollectionTitle(raw, fallback = '', clusterId = '') {
  const name = String(raw || '')
    .trim()
    .replace(/\s+/g, ' ')
  if (name.length < AUTO_COLLECTION_NAME_MIN_LEN) return fallback
  if (name.length > AUTO_COLLECTION_NAME_MAX_LEN) return fallback
  if (looksLikeDescriptiveSentence(name)) return fallback
  if (isPlaceholderCollectionTitle(name, clusterId)) return fallback
  return name
}

export function countScriptChars(text = '') {
  const s = String(text || '')
  const letters = s.replace(/\s/g, '')
  return {
    han: (s.match(/[\u4e00-\u9fff]/g) || []).length,
    kana: (s.match(/[\u3040-\u30ff\u31f0-\u31ff]/g) || []).length,
    hangul: (s.match(/[\uac00-\ud7af\u1100-\u11ff]/g) || []).length,
    latin: (s.match(/[a-zA-Z]/g) || []).length,
    cyrillic: (s.match(/[\u0400-\u04ff]/g) || []).length,
    arabic: (s.match(/[\u0600-\u06ff]/g) || []).length,
    total: letters.length
  }
}

/** 标题语言是否与当前应用 locale 一致（粗粒度 script 检测） */
export function titleMatchesAppLocale(text, locale = 'enUS') {
  const s = String(text || '').trim()
  if (!s) return false
  const c = countScriptChars(s)
  if (!c.total) return false
  const loc = String(locale || 'enUS')

  if (loc.startsWith('zh')) {
    return c.han >= 1 && c.han / c.total >= 0.4
  }
  if (loc === 'jaJP') {
    return (c.han + c.kana) / c.total >= 0.35
  }
  if (loc === 'koKR') {
    return (c.hangul + c.han) / c.total >= 0.35
  }
  if (loc === 'ruRU') {
    return c.cyrillic / c.total >= 0.4
  }
  if (loc === 'arSA') {
    return c.arabic / c.total >= 0.4
  }
  return c.latin / c.total >= 0.5 && c.han / c.total < 0.25
}

function filterTagsByAppLocale(tags = [], locale = 'enUS') {
  const list = (tags || []).filter(Boolean)
  const matched = list.filter((t) => titleMatchesAppLocale(t, locale))
  if (matched.length) return matched
  const loc = String(locale || 'enUS')
  if (!loc.startsWith('zh') && !['jaJP', 'koKR', 'ruRU', 'arSA'].includes(loc)) {
    return list.filter((t) => /[a-zA-Z]/.test(String(t)))
  }
  return matched
}

export function normalizeAutoCollectionTitleForLocale(raw, locale, fallback = '', clusterId = '') {
  const name = normalizeAutoCollectionTitle(raw, '', clusterId)
  if (!name) return fallback
  if (!titleMatchesAppLocale(name, locale)) return fallback
  return name
}

/** 降级：2 个 tag 用可读分隔符连接 */
export function joinFallbackTags(tags = [], max = 2) {
  return tags
    .filter(Boolean)
    .slice(0, max)
    .map((t) => String(t).trim())
    .filter(Boolean)
    .join(' · ')
}

/**
 * 规则降级：优先与 UI 同语言的 aiTitle，其次同语言 tags
 */
export function resolveAtmosphereFallbackName(hints = {}, locale = 'enUS') {
  const clusterId = hints.clusterId || ''
  const titleSamples = (hints.titleSamples || []).filter((t) =>
    titleMatchesAppLocale(t, locale)
  )
  for (const title of titleSamples) {
    const name = normalizeAutoCollectionTitle(title, '', clusterId)
    if (name) return name
  }
  const tags = filterTagsByAppLocale(hints.tags || [], locale)
  if (tags.length >= 2) {
    const name = normalizeAutoCollectionTitle(joinFallbackTags(tags, 2), '', clusterId)
    if (name) return name
  }
  if (tags.length === 1) {
    const name = normalizeAutoCollectionTitle(tags[0], '', clusterId)
    if (name) return name
  }
  return ''
}

export function buildCollectionTitleCorpus(hints = {}) {
  return [
    ...(hints.titleSamples || []),
    ...(hints.namingSamples || hints.samples || []),
    ...(hints.tags || []),
    hints.themeHint || ''
  ]
    .join(' ')
    .toLowerCase()
}

export function computeTitleNgramOverlap(title, corpus) {
  const titleNgrams = extractTitleNgrams(title)
  if (!titleNgrams.size) return 0
  const corpusNgrams = extractTitleNgrams(corpus)
  let hit = 0
  for (const ng of titleNgrams) {
    if (corpusNgrams.has(ng)) hit++
  }
  return hit / titleNgrams.size
}

/** 单张资源是否被合集标题语义覆盖（命名后剔图） */
export function resourceMatchesCollectionTitle(
  collectionTitle,
  resourceHints = {},
  minOverlap = AUTO_COLLECTION_MEMBER_TITLE_MIN_OVERLAP
) {
  const title = String(collectionTitle || '').trim()
  if (!title) return false

  const titleLower = title.toLowerCase()
  const aiTitle = String(resourceHints.aiTitle || resourceHints.title || '')
    .trim()
    .toLowerCase()
  if (aiTitle && (titleLower.includes(aiTitle) || aiTitle.includes(titleLower))) {
    return true
  }

  for (const tag of resourceHints.tags || []) {
    const tg = String(tag || '').trim().toLowerCase()
    if (tg.length >= 2 && titleLower.includes(tg)) return true
  }

  const corpus = [
    resourceHints.aiTitle,
    resourceHints.title,
    resourceHints.summary,
    ...(resourceHints.tags || [])
  ]
    .filter(Boolean)
    .join(' ')

  if (!corpus) return false
  return computeTitleNgramOverlap(title, corpus) >= minOverlap
}

/** 从文本提取 n-gram（CJK 2-gram、假名/韩文/西里尔连续段、英文词） */
function extractTitleNgrams(text) {
  const set = new Set()
  const pattern =
    /[\u4e00-\u9fff]+|[\u3040-\u30ff\u31f0-\u31ff]+|[\uac00-\ud7af\u1100-\u11ff]+|[a-z\u0400-\u04ff]+/gi
  for (const run of String(text || '').toLowerCase().match(pattern) || []) {
    if (/^[a-z\u0400-\u04ff]+$/i.test(run)) {
      if (run.length >= 2) set.add(run)
      continue
    }
    if (/^[\u3040-\u30ff\u31f0-\u31ff\uac00-\ud7af\u1100-\u11ff]+$/i.test(run)) {
      if (run.length <= 2) {
        set.add(run)
      } else {
        for (let i = 0; i < run.length - 1; i++) {
          set.add(run.slice(i, i + 2))
        }
      }
      continue
    }
    if (run.length <= 2) {
      set.add(run)
      continue
    }
    for (let i = 0; i < run.length - 1; i++) {
      set.add(run.slice(i, i + 2))
    }
  }
  return set
}

/**
 * LLM 标题是否被该簇语料支撑：比较标题与 titleSamples/samples/tags 重叠
 */
export function validateCollectionTitleAgainstHints(name, hints = {}) {
  const title = String(name || '').trim()
  if (!title) return false

  const corpus = buildCollectionTitleCorpus(hints)
  if (!corpus) return false

  const titleLower = title.toLowerCase()
  if (corpus.includes(titleLower)) return true

  for (const tag of hints.tags || []) {
    const tg = String(tag || '').trim().toLowerCase()
    if (tg.length >= 2 && titleLower.includes(tg)) return true
  }

  return computeTitleNgramOverlap(title, corpus) >= 0.6
}

/** @deprecated 使用 resolveAtmosphereFallbackName */
export function resolveAutoCollectionFallbackName(hints = {}, locale = 'enUS') {
  return resolveAtmosphereFallbackName(hints, locale)
}

/** 系统合集数量上限默认值（可在 AI 设置中修改） */
export const AUTO_COLLECTION_COUNT_DEFAULT = 20

/** 系统合集数量上限允许的最大值（防止误填过大） */
export const AUTO_COLLECTION_COUNT_ABSOLUTE_MAX = 100

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
