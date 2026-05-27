const clamp = (n, min, max) => Math.min(max, Math.max(min, n))

export const extractJsonObject = (text) => {
  if (!text || typeof text !== 'string') return null
  const trimmed = text.trim()
  try {
    return JSON.parse(trimmed)
  } catch {
    const match = trimmed.match(/\{[\s\S]*\}/)
    if (!match) return null
    try {
      return JSON.parse(match[0])
    } catch {
      return null
    }
  }
}

export const normalizeAnalysisResult = (raw) => {
  const obj = typeof raw === 'object' && raw ? raw : {}
  const tags = Array.isArray(obj.tags)
    ? obj.tags.map((t) => String(t).trim()).filter(Boolean).slice(0, 12)
    : []
  return {
    score: clamp(Math.round(Number(obj.score) || 0), 0, 100),
    tags,
    title: String(obj.title || '').trim().slice(0, 120),
    desc: String(obj.desc || '').trim().slice(0, 500),
    summary: String(obj.summary || '').trim().slice(0, 200),
    nsfwLevel: clamp(Math.round(Number(obj.nsfwLevel) || 0), 0, 3),
    safeForWork: obj.safeForWork !== false
  }
}

export const normalizeSearchParams = (raw) => {
  const obj = typeof raw === 'object' && raw ? raw : {}
  return {
    filterKeywords: String(obj.filterKeywords || '').trim(),
    tags: Array.isArray(obj.tags) ? obj.tags.map(String) : [],
    orientation: Array.isArray(obj.orientation) ? obj.orientation.map(String) : [],
    quality: Array.isArray(obj.quality) ? obj.quality.map(String) : [],
    scoreMin: obj.scoreMin != null ? clamp(Number(obj.scoreMin), 0, 100) : null,
    scoreMax: obj.scoreMax != null ? clamp(Number(obj.scoreMax), 0, 100) : null,
    fileType: obj.fileType === 'video' ? 'video' : obj.fileType === 'image' ? 'image' : ''
  }
}

export const normalizeCollectionQueryJson = (raw) => {
  const obj = typeof raw === 'object' && raw ? raw : {}
  const limit = clamp(Math.round(Number(obj.limitCount) || 20), 5, 50)
  return {
    filterKeywords: String(obj.filterKeywords || '').trim(),
    tags: Array.isArray(obj.tags) ? obj.tags.map(String) : [],
    tagsMode: obj.tagsMode === 'all' ? 'all' : 'any',
    orientation: Array.isArray(obj.orientation) ? obj.orientation.map(String) : [],
    quality: Array.isArray(obj.quality) ? obj.quality.map(String) : [],
    scoreMin: obj.scoreMin != null ? clamp(Number(obj.scoreMin), 0, 100) : null,
    scoreMax: obj.scoreMax != null ? clamp(Number(obj.scoreMax), 0, 100) : null,
    resourceName: ['resources', 'favorites', 'local', 'history'].includes(obj.resourceName)
      ? obj.resourceName
      : 'resources',
    isRandom: !!obj.isRandom,
    sortField: String(obj.sortField || 'score'),
    sortType: Number(obj.sortType) > 0 ? 1 : -1,
    semanticQuery: String(obj.semanticQuery || obj.filterKeywords || '').trim(),
    useSemantic: !!obj.useSemantic,
    limitCount: limit
  }
}

export const normalizeCollectionMergePlan = (raw, candidates, targetCount, minItems = 3) => {
  const candidateMap = new Map(candidates.map((c) => [c.id, c]))
  const list = Array.isArray(raw?.collections) ? raw.collections : []
  const plans = []

  for (const item of list) {
    if (plans.length >= targetCount) break
    const mergeIds = Array.isArray(item.mergeIds)
      ? item.mergeIds.map(String).filter((id) => candidateMap.has(id))
      : []
    if (!mergeIds.length) continue

    const resourceIdSet = new Set()
    const tagSet = new Set()
    for (const mid of mergeIds) {
      const candidate = candidateMap.get(mid)
      candidate.resourceIds.forEach((id) => resourceIdSet.add(id))
      candidate.hints?.tags?.forEach((tag) => tagSet.add(tag))
    }
    if (resourceIdSet.size < minItems) continue

    const autoKey = `merged:${mergeIds.slice().sort().join('+')}`
    plans.push({
      autoKey,
      name: String(item.name || '').trim().slice(0, 40) || '推荐合集',
      prompt: String(item.prompt || item.name || '').trim().slice(0, 200),
      semanticQuery: String(item.semanticQuery || item.prompt || item.name || '').trim(),
      tags: Array.from(tagSet).slice(0, 10),
      mergeIds,
      resourceIds: Array.from(resourceIdSet)
    })
  }

  return plans
}
