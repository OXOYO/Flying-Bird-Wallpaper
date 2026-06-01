/**
 * 找相似候选范围（与桌面 ExploreCommon.buildSimilarScope / ResourcesManager.getSimilarScopeCandidateIds 对齐）
 * @param {{ resourceType?: string, resourceName?: string }} form
 */
export function buildH5SearchSimilarScope(form = {}) {
  return {
    type: 'search',
    resourceType: form.resourceType || 'localResource',
    resourceName: form.resourceName || 'resources'
  }
}

/**
 * @param {{
 *   browseType: 'favorites' | 'history' | 'collection',
 *   inPrivacySpace?: boolean,
 *   collectionId?: number | string | null
 * }} ctx
 */
export function buildH5BrowseSimilarScope({ browseType, inPrivacySpace = false, collectionId = null }) {
  if (browseType === 'collection') {
    const id = Number(collectionId)
    return Number.isFinite(id) && id > 0 ? { type: 'collection', collectionId: id } : null
  }
  if (browseType === 'history') return { type: 'history' }
  if (browseType === 'favorites') {
    return inPrivacySpace ? { type: 'privacy' } : { type: 'favorites' }
  }
  return { type: 'favorites' }
}
