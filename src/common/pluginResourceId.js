/** 插件本地资源复合 ID：源名_插件名（源名 1–8 字，仅字母与数字） */

export const SOURCE_NAME_MIN_LEN = 1
export const SOURCE_NAME_MAX_LEN = 8

/** 各语言字母 + 数字，不含符号与空格 */
export const SOURCE_NAME_REGEXP = /^[\p{L}\p{N}]+$/u

export const RESERVED_RESOURCE_NAMES = new Set([
  'resources',
  'local',
  'favorites',
  'history',
  'privacy_space'
])

export const DOWNLOAD_PARAM_KEY_PREFIX = 'download_params|'

export function normalizeSourceName(name) {
  return String(name || '').trim()
}

export function getSourceNameLength(name) {
  return Array.from(normalizeSourceName(name)).length
}

export function validateSourceName(name) {
  const normalized = normalizeSourceName(name)
  const len = getSourceNameLength(normalized)
  if (len < SOURCE_NAME_MIN_LEN || len > SOURCE_NAME_MAX_LEN) {
    return { valid: false, reason: 'length' }
  }
  if (!SOURCE_NAME_REGEXP.test(normalized)) {
    return { valid: false, reason: 'pattern' }
  }
  return { valid: true, normalized }
}

export function buildCompositeId(sourceName, pluginName) {
  const src = normalizeSourceName(sourceName)
  const plugin = String(pluginName || '').trim()
  if (!src || !plugin) return ''
  return `${src}_${plugin}`
}

/** @deprecated 使用 buildCompositeId */
export function createPluginKey(sourceName, pluginName) {
  return buildCompositeId(sourceName, pluginName)
}

export function isReservedResourceName(name) {
  return RESERVED_RESOURCE_NAMES.has(String(name || '').trim())
}

export function isCompositeResourceId(name) {
  const key = String(name || '').trim()
  if (!key || isReservedResourceName(key)) return false
  if (key.includes(':')) return false
  const idx = key.indexOf('_')
  return idx > 0 && idx < key.length - 1
}

export function replaceSourcePrefix(compositeId, oldSource, newSource) {
  const id = String(compositeId || '')
  const prefix = `${normalizeSourceName(oldSource)}_`
  const nextPrefix = `${normalizeSourceName(newSource)}_`
  if (!id.startsWith(prefix)) return id
  return nextPrefix + id.slice(prefix.length)
}

export function buildDownloadParamStoreKey(source, keyword) {
  return `${DOWNLOAD_PARAM_KEY_PREFIX}${source}|${encodeURIComponent(String(keyword ?? ''))}`
}

export function parseDownloadParamStoreKey(key) {
  const raw = String(key || '')
  if (!raw.startsWith(DOWNLOAD_PARAM_KEY_PREFIX)) return null
  const rest = raw.slice(DOWNLOAD_PARAM_KEY_PREFIX.length)
  const sep = rest.indexOf('|')
  if (sep < 0) return null
  try {
    return {
      source: rest.slice(0, sep),
      keyword: decodeURIComponent(rest.slice(sep + 1))
    }
  } catch {
    return null
  }
}

/** 解析旧版 download_params_{source}_{keyword}（仅迁移用） */
export function parseLegacyDownloadParamStoreKey(key) {
  const raw = String(key || '')
  if (!raw.startsWith('download_params_') || raw.startsWith(DOWNLOAD_PARAM_KEY_PREFIX)) {
    return null
  }
  const rest = raw.slice('download_params_'.length)
  const sep = rest.indexOf('_')
  if (sep <= 0) return null
  return {
    source: rest.slice(0, sep),
    keyword: rest.slice(sep + 1)
  }
}
