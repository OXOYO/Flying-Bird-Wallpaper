import { ref } from 'vue'
import * as api from '@h5/api/index.js'

/**
 * H5 找相似分页（与桌面 useSimilarResultsLoadMore 一致，走 HTTP API）
 * @param {{
 *   normalizeRows: (rows: unknown[]) => unknown[],
 *   getPageSize?: () => number,
 *   getDedupKey?: (row: unknown) => string
 * }} options
 */
export function useH5SimilarResults({
  normalizeRows,
  getPageSize = () => 50,
  getDedupKey = (row) => String(row?.id ?? row?.uniqueKey ?? '')
}) {
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
    similarQuery.value = {
      resourceId: Number(resourceId),
      scope: scope && typeof scope === 'object' ? { ...scope } : undefined,
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
    if (!q?.resourceId) return { rows: [], total: similarTotal.value }

    const limit = resolvePageSize()
    q.pageSize = limit

    const res = await api.findSimilar({
      resourceId: q.resourceId,
      limit,
      scope: q.scope,
      excludeIds: (excludeIds || [])
        .map((id) => Number(id))
        .filter((id) => Number.isFinite(id))
    })

    if (!res?.success || !Array.isArray(res.data?.list)) {
      return { rows: [], total: similarTotal.value }
    }
    if (res.data?.total != null) {
      similarTotal.value = Number(res.data.total) || 0
    }
    return {
      rows: normalizeRows(res.data.list),
      total: similarTotal.value
    }
  }

  /**
   * @param {() => Array} getCurrentList
   * @param {(list: Array) => void} setList
   * @returns {Promise<boolean>} 是否还有更多
   */
  const appendSimilarPage = async (getCurrentList, setList) => {
    if (!similarMode.value || !similarQuery.value || !similarHasMore.value) {
      return false
    }

    const current = getCurrentList() || []
    const excludeIds = current.map((row) => row.id).filter((id) => id != null)
    const { rows } = await fetchSimilarMore(excludeIds)
    if (!rows.length) {
      similarHasMore.value = false
      return false
    }
    const keys = new Set(current.map(getDedupKey).filter(Boolean))
    const merged = [
      ...current,
      ...rows.filter((row) => {
        const key = getDedupKey(row)
        return key && !keys.has(key)
      })
    ]
    setList(merged)
    syncHasMore(merged.length)
    return similarHasMore.value
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
