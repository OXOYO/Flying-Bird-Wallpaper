/** 收藏成功后把本地库 id / 行字段写回列表项（H5、桌面共用） */
export const applyFavoriteResourceToItem = (item, res) => {
  if (!item || !res?.success) return
  const patch = res?.data?.resource
  if (patch) {
    Object.assign(item, patch)
  }
  const resourceId = res?.data?.resourceId ?? patch?.id
  if (resourceId != null && resourceId !== '') {
    item.id = resourceId
  }
  if (patch?.isFavorite != null) {
    item.isFavorite = patch.isFavorite ? 1 : 0
  } else {
    item.isFavorite = 1
  }
}

/** 下载 / 设壁纸成功后把本地行写回列表项 */
export const applyResourceRowToItem = (item, resOrRow) => {
  if (!item) return
  const row = resOrRow?.data ?? resOrRow
  if (!row || typeof row !== 'object') return
  Object.assign(item, row)
  if (row.id != null && row.id !== '') {
    item.id = row.id
  }
  if (row.filePath) {
    item.filePath = row.filePath
    item.srcType = 'file'
    if (row.fileType === 'video' && !item.videoSrc) {
      item.videoSrc = `fbwtp://fbw/api/videos/get?filePath=${encodeURIComponent(row.filePath)}`
    }
  }
}

/** 与 H5 normalizeBrowseItem 一致的 srcType 推断 */
export const resolveResourceSrcType = (item) => {
  if (item?.srcType) return item.srcType
  if (item?.filePath) return 'file'
  if (item?.link || item?.videoUrl || item?.imageUrl) return 'url'
  return 'file'
}

/** 远程插件 id 不可靠时跳过下载统计 */
export const shouldRecordDownloadStat = (item) => {
  if (!item?.id) return false
  if (item.filePath) return true
  if (item.srcType === 'file') return true
  return false
}

/** 与下载统计相同：仅本地已入库资源记 preview 浏览 */
export const shouldRecordViewStat = shouldRecordDownloadStat

/** 将 statistics 快照写回列表项 */
export const applyStatisticsToItem = (item, stats = {}) => {
  if (!item || !stats) return
  for (const key of ['views', 'downloads', 'favorites', 'wallpapers']) {
    if (stats[key] != null) item[key] = stats[key]
  }
}

/** 取消收藏后同步 statistics（含 favorites 置 0） */
export const applyUnfavoriteToItem = (item, res) => {
  if (!item) return
  item.isFavorite = 0
  if (res?.data?.statistics) {
    applyStatisticsToItem(item, res.data.statistics)
  } else {
    item.favorites = 0
  }
}

/** preview 打开时记录 views（失败静默） */
export async function fireRecordPreviewView(recordFn, item) {
  if (!shouldRecordViewStat(item)) return null
  try {
    const res = await recordFn(item)
    if (res?.success && res.data) applyStatisticsToItem(item, res.data)
    return res
  } catch {
    return null
  }
}

/** 解析结果中的 resource / resourceId 写回列表项 */
export const applyResolvedResourceFromResult = (item, res) => {
  if (!item || !res?.success || !res.data) return
  if (res.data.resource) {
    applyResourceRowToItem(item, res.data.resource)
  } else if (res.data.resourceId != null && res.data.resourceId !== '') {
    item.id = res.data.resourceId
  }
}

/** H5 / IPC：本地传 id，远程未入库传完整 item */
export const buildResourceActionBody = (idOrItem, extra = {}) => {
  if (idOrItem && typeof idOrItem === 'object') {
    return {
      id: idOrItem.id,
      item: idOrItem,
      ...extra
    }
  }
  return {
    id: idOrItem,
    ...extra
  }
}
