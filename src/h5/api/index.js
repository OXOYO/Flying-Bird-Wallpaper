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
    return await response.json()
  } catch (err) {
    return {
      success: false,
      message: err?.message || 'network error'
    }
  }
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

export const addToFavorites = async (id) => {
  return await request('/api/favorites/add', {
    method: 'POST',
    body: { id }
  })
}

export const updateFavoriteCount = async (id, count) => {
  return await request('/api/statistics/favorite', {
    method: 'POST',
    body: { id, count }
  })
}

export const removeFavorites = async (id) => {
  return await request('/api/favorites/remove', {
    method: 'POST',
    body: { id }
  })
}

export const deleteImage = async (item) => {
  return await request('/api/images/delete', {
    method: 'POST',
    body: item
  })
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

export const getHotTags = async (resourceName) => {
  const query = resourceName ? `?resourceName=${encodeURIComponent(resourceName)}` : ''
  return await request(`/api/hot-tags${query}`)
}
