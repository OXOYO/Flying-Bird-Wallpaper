import { resolveApiUserMessage } from '@common/utils.js'
import { applyFavoriteResourceToItem } from '@h5/utils/favoriteApiBody.js'
import { applyStatisticsToItem } from '@common/favoriteResourceUtils.js'

/** 长按批量收藏：先确保入库并加入收藏表，再更新 statistics.favorites */
export async function runLongPressFavoriteBatch({ api, item, count, t, showNotify }) {
  if (!item || count <= 0) return false

  if (!item.isFavorite) {
    const addRes = await api.addToFavorites(item)
    if (!addRes?.success) {
      showNotify?.({
        type: 'danger',
        message: resolveApiUserMessage(addRes, t) || t('messages.operationFail')
      })
      return false
    }
    applyFavoriteResourceToItem(item, addRes)
  }

  if (!item.id) {
    showNotify?.({
      type: 'danger',
      message: t('messages.operationFail')
    })
    return false
  }

  const statRes = await api.updateFavoriteCount(item.id, count)
  if (!statRes?.success) {
    showNotify?.({
      type: 'danger',
      message: resolveApiUserMessage(statRes, t) || t('messages.operationFail')
    })
    return false
  }

  if (statRes.data) {
    applyStatisticsToItem(item, statRes.data)
  }
  item.isFavorite = 1
  return true
}
