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

export const applyFavoriteResourceToItem = (item, res) => {
  const patch = res?.data?.resource
  if (!item || !patch) return
  Object.assign(item, patch)
  if (patch.isFavorite != null) {
    item.isFavorite = patch.isFavorite ? 1 : 0
  } else if (res?.success) {
    item.isFavorite = 1
  }
}
