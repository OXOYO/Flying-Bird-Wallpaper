/** 探索/合集列表缩略图长边宽度，与 ExploreCommon 一致 */
export const EXPLORE_LIST_IMAGE_WIDTH = 1080

/**
 * @param {'localResource'|'remoteResource'} resourceType
 * @param {number} gridHWRatio
 */
export function getExploreImageUrlQuery(resourceType = 'localResource', gridHWRatio = 0.618) {
  const w = EXPLORE_LIST_IMAGE_WIDTH
  const h = Math.floor(w * gridHWRatio)
  if (resourceType === 'localResource') {
    return { w: String(w) }
  }
  return { w: String(w), h: String(h) }
}

export function appendUrlQueryParams(url, query = {}) {
  if (!url) return ''
  const entries = Object.entries(query).filter(([, v]) => v != null && v !== '')
  if (!entries.length) return url
  try {
    const urlObj = new URL(url)
    for (const [key, value] of entries) {
      urlObj.searchParams.set(key, String(value))
    }
    return urlObj.toString()
  } catch {
    return url
  }
}

export function buildResourceRawImageUrl(item) {
  if (!item) return ''
  const isVideo = item.fileType === 'video'
  const srcType = item.srcType || (item.filePath ? 'file' : item.link ? 'url' : 'file')
  if (srcType === 'file') {
    if (isVideo) return item.imageUrl || ''
    if (item.filePath) {
      return `fbwtp://fbw/api/images/get?filePath=${encodeURIComponent(item.filePath)}`
    }
  } else if (srcType === 'url') {
    return item.imageUrl || ''
  }
  return item.imageUrl || ''
}

/**
 * 为列表卡片生成带缩略参数的 imageSrc（本地仅 w，远程 w+h）
 */
export function applyExploreImageSrc(item, options = {}) {
  const resourceType =
    options.resourceType ?? (item?.filePath || item?.srcType === 'file' ? 'localResource' : 'remoteResource')
  const gridHWRatio = options.gridHWRatio ?? 0.618
  const raw = buildResourceRawImageUrl(item)
  if (!raw) return { rawImageUrl: '', imageSrc: '' }
  const query = getExploreImageUrlQuery(resourceType, gridHWRatio)
  return {
    rawImageUrl: raw,
    imageSrc: appendUrlQueryParams(raw, query)
  }
}
