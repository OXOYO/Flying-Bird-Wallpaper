export const formatFileSize = (bytes = 0) => {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

export const handleInfoVal = (info, key) => {
  const val = info[key]
  if (key === 'fileSize') {
    return formatFileSize(val || 0)
  } else if (key === 'dimensions') {
    const width = info.width
    const height = info.height
    return width && height ? `${width} x ${height}` : '-'
  } else if (['ctimeMs', 'mtimeMs', 'created_at', 'updated_at'].includes(key)) {
    const val = info[key]
    return val ? new Date(val).toLocaleString() : '-'
  }
  return val || '-'
}

// 防抖
export const debounce = (fn, delay) => {
  let timer = null
  return function (...args) {
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => {
      fn.apply(this, args)
      timer = null
    }, delay)
  }
}

// 节流
export const throttle = (fn, delay) => {
  let lastCall = 0
  return function (...args) {
    const now = Date.now()
    if (now - lastCall >= delay) {
      lastCall = now
      fn.apply(this, args)
    }
  }
}

/** H5 request 层使用的错误码（勿与用户可见文案耦合） */
export const API_ERROR_CODE = {
  FETCH_FAILED: 'FETCH_FAILED',
  EMPTY_RESPONSE: 'EMPTY_RESPONSE',
  INVALID_JSON: 'INVALID_JSON',
  HTTP_ERROR: 'HTTP_ERROR'
}

function normalizeApiErrorInput(input) {
  if (input != null && typeof input === 'object' && !Array.isArray(input)) {
    return input
  }
  return { message: input }
}

/**
 * API / fetch 错误映射为 i18n 文案。
 * @param {string|object|null|undefined} input - 兼容旧用法：仅传 message 字符串；推荐传入完整响应对象（含 errorCode、httpStatus、message）。
 * @param {function} t - i18next 的 t
 */
export const resolveApiUserMessage = (input, t) => {
  const res = normalizeApiErrorInput(input)
  const code = res.errorCode
  const raw = String(res.message ?? '').trim()

  if (code === API_ERROR_CODE.FETCH_FAILED) {
    return t('messages.networkRequestFailed')
  }
  if (code === API_ERROR_CODE.EMPTY_RESPONSE || code === API_ERROR_CODE.INVALID_JSON) {
    return t('messages.invalidServerResponse')
  }
  if (code === API_ERROR_CODE.HTTP_ERROR) {
    if (raw) return raw
    return t('messages.invalidServerResponse')
  }

  if (!raw) return t('messages.getDataFail')
  if (
    raw === '__FETCH_FAILED__' ||
    raw === '__NETWORK_ERROR__' ||
    /^failed to fetch$/i.test(raw) ||
    /networkerror/i.test(raw) ||
    /^network error$/i.test(raw) ||
    /load failed/i.test(raw) ||
    /fetch failed/i.test(raw) ||
    /network request failed/i.test(raw)
  ) {
    return t('messages.networkRequestFailed')
  }
  if (raw === '__INVALID_JSON__' || raw === '__EMPTY_RESPONSE__' || /^HTTP_\d{3}$/.test(raw)) {
    return t('messages.invalidServerResponse')
  }
  return raw
}

/**
 * 搜索分页等：是否为可自动重试的瞬时失败（不应立即标记列表已结束）。
 * @param {string|object|null|undefined} input - 推荐传入完整响应对象；兼容仅 message 字符串。
 */
export const isTransientSearchFailure = (input) => {
  const res = normalizeApiErrorInput(input)
  if (res.errorCode === API_ERROR_CODE.FETCH_FAILED) return true
  const st = res.httpStatus
  if (typeof st === 'number' && (st === 502 || st === 503 || st === 504)) return true

  const raw = String(res.message ?? '').trim()
  if (!raw) return false
  return (
    raw === '__FETCH_FAILED__' ||
    /^failed to fetch$/i.test(raw) ||
    /^typeerror:\s*failed to fetch$/i.test(raw) ||
    /^HTTP_(502|503|504)$/.test(raw)
  )
}
