/** 找相似空结果原因 → i18n key */
export const FIND_SIMILAR_EMPTY_REASON_KEYS = {
  no_scope_candidates: 'exploreCommon.findSimilarEmptyNoScope',
  scope_no_embeddings: 'exploreCommon.findSimilarEmptyNoEmbeddings',
  no_vectors: 'exploreCommon.findSimilarEmptyNoVectors',
  no_matches: 'exploreCommon.findSimilarEmpty'
}

export const resolveFindSimilarEmptyMessage = (t, emptyReason) => {
  const key =
    FIND_SIMILAR_EMPTY_REASON_KEYS[emptyReason] || FIND_SIMILAR_EMPTY_REASON_KEYS.no_matches
  return t(key)
}
