import { ref, toRaw } from 'vue'
import { cloneForIpc } from '@renderer/utils/cloneForIpc.js'

/** IPC 入参须为可结构化克隆的纯对象（避免 ref/reactive 导致 clone 失败） */
function buildFindSimilarIpcPayload({ resourceId, limit, scope, excludeIds }) {
  const payload = {
    resourceId: Number(resourceId),
    limit: Number(limit) || 20,
    excludeIds: (excludeIds || [])
      .map((id) => Number(id))
      .filter((id) => Number.isFinite(id))
  }
  if (scope && typeof scope === 'object') {
    payload.scope = cloneForIpc(toRaw(scope))
  }
  return payload
}

/**
 * 相似结果分页（与探索页搜索一致：动态 pageSize + loaded < total）
 * @param {{
 *   normalizeRows: (rows: unknown[]) => unknown[],
 *   getPageSize?: () => number
 * }} options
 */
export function useSimilarResultsLoadMore({ normalizeRows, getPageSize = () => 50 }) {
  const similarMode = ref(false)
  const similarSourceItem = ref(null)
  /** @type {import('vue').Ref<{ resourceId: number, scope?: object, pageSize?: number } | null>} */
  const similarQuery = ref(null)
  const similarTotal = ref(0)
  const similarHasMore = ref(false)

  const resolvePageSize = () => Math.max(1, Number(getPageSize()) || 50)

  const syncHasMore = (loadedCount) => {
    const total = Number(similarTotal.value) || 0
    similarHasMore.value = total > 0 ? loadedCount < total : false
  }

  const resetSimilar = () => {
    similarMode.value = false
    similarSourceItem.value = null
    similarQuery.value = null
    similarTotal.value = 0
    similarHasMore.value = false
  }

  const startSimilar = ({ resourceId, scope, sourceItem, firstRows, pageSize, total }) => {
    const rows = firstRows || []
    const plainScope =
      scope && typeof scope === 'object' ? cloneForIpc(toRaw(scope)) : undefined
    similarQuery.value = {
      resourceId: Number(resourceId),
      scope: plainScope,
      pageSize: pageSize ?? resolvePageSize()
    }
    similarSourceItem.value = sourceItem || null
    similarMode.value = true
    if (total != null) {
      similarTotal.value = Number(total) || 0
    }
    syncHasMore(rows.length)
    return rows
  }

  const fetchSimilarMore = async (excludeIds = []) => {
    const q = similarQuery.value
    if (!q?.resourceId) {
      return { rows: [], total: similarTotal.value, failed: false }
    }

    const limit = resolvePageSize()
    q.pageSize = limit

    const res = await window.FBW.findSimilar(
      buildFindSimilarIpcPayload({
        resourceId: q.resourceId,
        limit,
        scope: q.scope,
        excludeIds
      })
    )

    if (!res?.success || !Array.isArray(res.data?.list)) {
      return { rows: [], total: similarTotal.value, failed: true, error: res }
    }
    if (res.data?.total != null) {
      similarTotal.value = Number(res.data.total) || 0
    }
    return {
      rows: normalizeRows(res.data.list),
      total: similarTotal.value,
      failed: false
    }
  }

  /**
   * @param {() => Array} getCurrentList
   * @param {(list: Array) => void} setList
   * @returns {Promise<{ hasMore: boolean, failed?: boolean, error?: object }>}
   */
  const appendSimilarPage = async (getCurrentList, setList) => {
    if (!similarMode.value || !similarQuery.value || !similarHasMore.value) {
      return { hasMore: false, failed: false }
    }

    const current = getCurrentList() || []
    const excludeIds = current.map((row) => row.id).filter((id) => id != null)
    const { rows, failed, error } = await fetchSimilarMore(excludeIds)
    if (failed) {
      similarHasMore.value = false
      return { hasMore: false, failed: true, error }
    }
    if (!rows.length) {
      similarHasMore.value = false
      return { hasMore: false, failed: false }
    }
    const keys = new Set(current.map((row) => row.uniqueKey))
    const merged = [
      ...current,
      ...rows.filter((row) => row.uniqueKey && !keys.has(row.uniqueKey))
    ]
    setList(merged)
    syncHasMore(merged.length)
    return { hasMore: similarHasMore.value, failed: false }
  }

  return {
    similarMode,
    similarSourceItem,
    similarQuery,
    similarTotal,
    similarHasMore,
    resetSimilar,
    startSimilar,
    fetchSimilarMore,
    appendSimilarPage,
    resolvePageSize
  }
}
