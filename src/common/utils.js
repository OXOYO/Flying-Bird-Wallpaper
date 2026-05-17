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

/** API / 主进程业务错误码（与用户可见文案解耦，由 resolveApiUserMessage 映射 i18n） */
export const API_ERROR_CODE = {
  FETCH_FAILED: 'FETCH_FAILED',
  EMPTY_RESPONSE: 'EMPTY_RESPONSE',
  INVALID_JSON: 'INVALID_JSON',
  HTTP_ERROR: 'HTTP_ERROR',
  API_PLUGIN_NOT_FOUND: 'API_PLUGIN_NOT_FOUND',
  API_PLUGIN_METHOD_MISSING: 'API_PLUGIN_METHOD_MISSING',
  OPEN_DIR_INVALID_PATH: 'OPEN_DIR_INVALID_PATH',
  OPEN_DIR_NOT_FOUND: 'OPEN_DIR_NOT_FOUND'
}

/** 构造带 errorCode 的 Error，供主进程抛出、Store 捕获后写入响应 */
export function createCodedError(code, params = {}) {
  const err = new Error(code)
  err.errorCode = code
  err.errorParams = params
  return err
}

/** 将捕获的 coded error 写入 API 响应对象 */
export function applyCodedErrorToResult(ret, err, fallbackMessage = '') {
  if (err?.errorCode) {
    ret.success = false
    ret.errorCode = err.errorCode
    ret.errorParams = err.errorParams || {}
    ret.message = ''
    return ret
  }
  if (err) {
    ret.success = false
    ret.message = err.message || fallbackMessage
  }
  return ret
}

function normalizeApiErrorInput(input) {
  if (input != null && typeof input === 'object' && !Array.isArray(input)) {
    return {
      errorCode: input.errorCode,
      errorParams: input.errorParams,
      httpStatus: input.httpStatus,
      message: input.message
    }
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
  const params = res.errorParams || {}
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
  if (code === API_ERROR_CODE.API_PLUGIN_NOT_FOUND) {
    return t('messages.apiPluginNotFound', { resourceName: params.resourceName ?? '' })
  }
  if (code === API_ERROR_CODE.API_PLUGIN_METHOD_MISSING) {
    return t('messages.apiPluginMethodMissing', {
      resourceName: params.resourceName ?? '',
      funcName: params.funcName ?? ''
    })
  }
  if (code === API_ERROR_CODE.OPEN_DIR_INVALID_PATH) {
    return t('messages.openDirInvalidPath')
  }
  if (code === API_ERROR_CODE.OPEN_DIR_NOT_FOUND) {
    return t('messages.openDirNotFound', { path: params.path ?? '' })
  }

  if (!raw) return t('messages.getDataFail')
  if (/^未找到API插件:\s*/.test(raw)) {
    return t('messages.apiPluginNotFound', {
      resourceName: raw.replace(/^未找到API插件:\s*/, '').trim()
    })
  }
  if (/^API插件 .+ 未提供函数:/.test(raw)) {
    const m = raw.match(/^API插件 (.+) 未提供函数:\s*(.+)$/)
    return t('messages.apiPluginMethodMissing', {
      resourceName: m?.[1]?.trim() ?? '',
      funcName: m?.[2]?.trim() ?? ''
    })
  }
  if (raw === 'path not found' || raw === 'invalid path') {
    return raw === 'path not found'
      ? t('messages.openDirNotFound', { path: '' })
      : t('messages.openDirInvalidPath')
  }
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
/**
 * 解析远程资源密钥（兼容 official:unsplash 与历史短名 unsplash 等键名）
 * @param {string} resourceName
 * @param {Record<string, string>} secretKeys
 */
export const resolveRemoteSecretKey = (resourceName, secretKeys = {}) => {
  if (!secretKeys || typeof secretKeys !== 'object') return ''
  const key = String(resourceName || '').trim()
  if (!key) return ''

  const shortName = key.includes(':') ? key.split(':').pop() : key
  const matchedRaw = []

  const pushRaw = (raw) => {
    if (raw) matchedRaw.push(String(raw))
  }

  pushRaw(secretKeys[key])
  if (shortName) pushRaw(secretKeys[shortName])

  for (const [storedKey, raw] of Object.entries(secretKeys)) {
    if (!raw) continue
    if (storedKey === key || storedKey === shortName || storedKey.endsWith(`:${shortName}`)) {
      pushRaw(raw)
    }
  }

  const normalized = matchedRaw
    .map((raw) => normalizeRemoteSecretKey(key, raw))
    .filter(Boolean)

  if (!normalized.length) return ''
  // 同一密钥可能同时存在 official:unsplash 与 unsplash，取最短有效值（避免重复拼接的脏数据）
  return normalized.reduce((shortest, current) =>
    !shortest || current.length < shortest.length ? current : shortest
  )
}

/** 修复密钥被重复拼接两次（迁移或历史数据可能导致） */
const dedupeRepeatedSecretValue = (value) => {
  if (!value || value.length < 2 || value.length % 2 !== 0) return value
  const half = value.length / 2
  const first = value.slice(0, half)
  const second = value.slice(half)
  return first === second ? first : value
}

/** 去掉用户可能误填的 Authorization 前缀，并规范化重复内容 */
export const normalizeRemoteSecretKey = (resourceName, raw) => {
  let value = String(raw || '').trim()
  if (!value) return ''
  value = value.replace(/^Bearer\s+/i, '').replace(/^Client-ID\s+/i, '').trim()
  return dedupeRepeatedSecretValue(value)
}

export const hasRemoteSecretKey = (resourceName, secretKeys = {}) =>
  Boolean(resolveRemoteSecretKey(resourceName, secretKeys))

/**
 * 将旧版短名密钥（unsplash）迁移到新版插件源名（official:unsplash）
 * @param {Record<string, string>} secretKeys
 * @param {string[]} resourceNames 当前已加载插件的 resourceName 列表
 */
export const migrateRemoteResourceSecretKeys = (secretKeys, resourceNames = []) => {
  if (!secretKeys || typeof secretKeys !== 'object') return secretKeys
  const next = { ...secretKeys }
  let changed = false

  for (const [storedKey, raw] of Object.entries(next)) {
    const normalized = normalizeRemoteSecretKey(storedKey, raw)
    if (normalized !== raw) {
      next[storedKey] = normalized
      changed = true
    }
  }

  for (const resourceName of resourceNames) {
    const fullName = String(resourceName || '').trim()
    if (!fullName.includes(':')) continue

    const shortName = fullName.split(':').pop()
    const legacy = shortName ? next[shortName] : ''
    const existing = next[fullName]
    const bestLegacy = legacy
      ? normalizeRemoteSecretKey(fullName, legacy)
      : ''
    const bestExisting = existing ? normalizeRemoteSecretKey(fullName, existing) : ''

    if (bestLegacy && (!bestExisting || bestLegacy.length < bestExisting.length)) {
      next[fullName] = bestLegacy
      changed = true
    } else if (bestExisting && bestExisting !== existing) {
      next[fullName] = bestExisting
      changed = true
    }
  }

  return changed ? next : secretKeys
}

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
