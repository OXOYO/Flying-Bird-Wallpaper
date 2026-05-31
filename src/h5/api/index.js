import { API_ERROR_CODE, isTransientSearchFailure } from '@common/utils.js'

const request = async (path, options = {}) => {
  try {
    const response = await fetch(path, {
      method: options.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {})
      },
      body: options.body ? JSON.stringify(options.body) : undefined
    })
    const text = await response.text()
    if (!text) {
      return response.ok
        ? { success: false, errorCode: API_ERROR_CODE.EMPTY_RESPONSE, message: '' }
        : {
            success: false,
            errorCode: API_ERROR_CODE.HTTP_ERROR,
            httpStatus: response.status,
            message: ''
          }
    }
    let data
    try {
      data = JSON.parse(text)
    } catch {
      return response.ok
        ? { success: false, errorCode: API_ERROR_CODE.INVALID_JSON, message: '' }
        : {
            success: false,
            errorCode: API_ERROR_CODE.HTTP_ERROR,
            httpStatus: response.status,
            message: ''
          }
    }
    if (!response.ok) {
      if (data && typeof data === 'object') {
        const serverMsg = data.message != null ? String(data.message) : ''
        return {
          ...data,
          success: false,
          message: serverMsg,
          errorCode: data.errorCode || API_ERROR_CODE.HTTP_ERROR,
          httpStatus: response.status
        }
      }
      return {
        success: false,
        errorCode: API_ERROR_CODE.HTTP_ERROR,
        httpStatus: response.status,
        message: ''
      }
    }
    return data
  } catch (err) {
    return {
      success: false,
      errorCode: API_ERROR_CODE.FETCH_FAILED,
      message: '',
      rawMessage: err?.message || ''
    }
  }
}

/** POST 失败后对瞬时网络错误重试（删除等不宜被并发搜索拖垮连接） */
const requestPostWithRetry = async (path, body, { retries = 2, baseDelayMs = 320 } = {}) => {
  let last = null
  for (let attempt = 0; attempt <= retries; attempt++) {
    last = await request(path, { method: 'POST', body })
    if (last?.success !== false) return last
    const retryable = isTransientSearchFailure(last)
    if (!retryable || attempt === retries) break
    await new Promise((r) => setTimeout(r, baseDelayMs * (attempt + 1)))
  }
  return last
}

let eventSource = null
const listeners = new Map()

const notify = (eventName, payload) => {
  const fns = listeners.get(eventName) || []
  fns.forEach((fn) => {
    try {
      fn(payload)
    } catch (err) {
      // noop
    }
  })
}

export const initEventStream = () => {
  if (eventSource) return
  eventSource = new EventSource('/api/events')
  eventSource.addEventListener('settingUpdated', (event) => {
    try {
      notify('settingUpdated', JSON.parse(event.data))
    } catch (err) {
      notify('settingUpdated', { success: false, data: null })
    }
  })
}

export const closeEventStream = () => {
  if (!eventSource) return
  eventSource.close()
  eventSource = null
}

export const on = (eventName, callback) => {
  if (!listeners.has(eventName)) {
    listeners.set(eventName, [])
  }
  listeners.get(eventName).push(callback)
}

// 图片接口
export const searchImages = async (data) => {
  return await request('/api/search/images', {
    method: 'POST',
    body: data
  })
}

export const toggleFavorite = async (id) => {
  return await request('/api/favorites/toggle', {
    method: 'POST',
    body: { id }
  })
}

export const addToFavorites = async (id, isPrivacySpace = false) => {
  return await request('/api/favorites/add', {
    method: 'POST',
    body: { id, isPrivacySpace: !!isPrivacySpace }
  })
}

export const updateFavoriteCount = async (id, count) => {
  return await request('/api/statistics/favorite', {
    method: 'POST',
    body: { id, count }
  })
}

export const removeFavorites = async (id, isPrivacySpace = false) => {
  return await request('/api/favorites/remove', {
    method: 'POST',
    body: { id, isPrivacySpace: !!isPrivacySpace }
  })
}

export const hasPrivacyPassword = async () => {
  return await request('/api/privacy/has-password')
}

export const getPrivacyPasswordHint = async () => {
  return await request('/api/privacy/password-hint')
}

export const checkPrivacyPassword = async (password) => {
  return await request('/api/privacy/check-password', {
    method: 'POST',
    body: { password }
  })
}

export const deleteImage = async (item) => {
  const raw = item && typeof item === 'object' ? item : {}
  const body = {
    id: raw.id,
    filePath: raw.filePath,
    fileName: raw.fileName,
    title: raw.title,
    desc: raw.desc
  }
  return await requestPostWithRetry('/api/images/delete', body)
}

export const updateDownloadCount = async (id, count) => {
  return await request('/api/statistics/download', {
    method: 'POST',
    body: { id, count }
  })
}

// 设置接口
export const getSettingData = async () => {
  return await request('/api/setting/get')
}

export const h5UpdateSettingData = async (data) => {
  return await request('/api/setting/update', {
    method: 'POST',
    body: data
  })
}

export const getResourceMap = async () => {
  return await request('/api/resources/map')
}

export const getResourceTags = async (resourceId) => {
  const id = Number(resourceId)
  if (!Number.isFinite(id) || id <= 0) return { success: false, data: [] }
  return request(`/api/resources/tags?resourceId=${id}`)
}

export const getHotTags = async (resourceName) => {
  const query = resourceName ? `?resourceName=${encodeURIComponent(resourceName)}` : ''
  return await request(`/api/hot-tags${query}`)
}

export const collectionsList = async () => {
  return await request('/api/collections/list')
}

export const collectionsGet = async ({ id, startPage = 1, pageSize = 20 } = {}) => {
  const query = new URLSearchParams({
    id: String(id),
    startPage: String(startPage),
    pageSize: String(pageSize)
  })
  return await request(`/api/collections/get?${query}`)
}

export const collectionsCreate = async (body) => {
  return await request('/api/collections/create', { method: 'POST', body })
}

export const collectionsUpdate = async (body) => {
  return await request('/api/collections/update', { method: 'POST', body })
}

export const collectionsGenerate = async (id) => {
  return await request('/api/collections/generate', { method: 'POST', body: { id } })
}

export const collectionsDelete = async (id) => {
  return await request('/api/collections/delete', { method: 'POST', body: { id } })
}

export const collectionsAddAllToFavorites = async (id) => {
  return await request('/api/collections/add-all-favorites', { method: 'POST', body: { id } })
}

export const collectionsCurate = async () => {
  return await request('/api/collections/curate', { method: 'POST', body: {} })
}

export const collectionsCuratorStats = async () => {
  return await request('/api/collections/curator-stats')
}
