const LOCAL_IMAGE_API_PREFIX = '/api/images/get'

export function isH5LocalImageApiUrl(url) {
  return typeof url === 'string' && url.startsWith(LOCAL_IMAGE_API_PREFIX)
}

export function buildH5LocalImageUrl(filePath) {
  return `${LOCAL_IMAGE_API_PREFIX}?filePath=${encodeURIComponent(filePath)}`
}

/** 为本地 /api/images/get 链接附加压缩参数（与首页逻辑一致） */
export function applyH5ImageCompress(url, { width, settingData } = {}) {
  if (!url || !isH5LocalImageApiUrl(url)) return url
  if (!settingData?.h5ImageCompress) return url
  const w = Math.max(1, Math.round(Number(width) || 0))
  if (!w) return url
  const compressStartSize = settingData.h5ImageCompressStartSize ?? 2
  const sep = url.includes('?') ? '&' : '?'
  return `${url}${sep}w=${w}&compressStartSize=${compressStartSize}`
}
