const LOCAL_IMAGE_API_PREFIX = '/api/images/get'

export function isH5LocalImageApiUrl(url) {
  return typeof url === 'string' && url.startsWith(LOCAL_IMAGE_API_PREFIX)
}

export function buildH5LocalImageUrl(filePath) {
  return `${LOCAL_IMAGE_API_PREFIX}?filePath=${encodeURIComponent(filePath)}`
}

/**
 * 为本地 /api/images/get 附加 w、compressStartSize
 * @param {boolean} [options.enabled] 为 true 时才附加参数
 */
export function applyH5ImageCompress(url, { width, settingData, enabled = false } = {}) {
  if (!url || !isH5LocalImageApiUrl(url)) return url
  if (!enabled) return url
  const w = Math.max(1, Math.round(Number(width) || 0))
  if (!w) return url
  const compressStartSize = settingData?.h5ImageCompressStartSize ?? 2
  const sep = url.includes('?') ? '&' : '?'
  return `${url}${sep}w=${w}&compressStartSize=${compressStartSize}`
}

/** 卡片等场景：始终使用压缩参数 */
export function applyH5CardImageCompress(url, { width, settingData } = {}) {
  return applyH5ImageCompress(url, { width, settingData, enabled: true })
}
