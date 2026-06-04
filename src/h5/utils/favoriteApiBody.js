import {
  applyFavoriteResourceToItem,
  shouldRecordDownloadStat,
  buildResourceActionBody,
  applyResolvedResourceFromResult
} from '../../common/favoriteResourceUtils.js'

export {
  applyFavoriteResourceToItem,
  shouldRecordDownloadStat,
  buildResourceActionBody,
  applyResolvedResourceFromResult
}

/** H5 收藏 API：本地传 id，远程未入库传完整 item（主进程隐式下载） */
export const buildFavoriteRequestBody = (idOrItem, isPrivacySpace = false) => {
  if (idOrItem && typeof idOrItem === 'object') {
    return {
      id: idOrItem.id,
      item: idOrItem,
      isPrivacySpace: !!isPrivacySpace
    }
  }
  return {
    id: idOrItem,
    isPrivacySpace: !!isPrivacySpace
  }
}
