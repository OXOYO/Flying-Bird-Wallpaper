import { io } from 'socket.io-client'

// 创建 Socket.IO 客户端实例
const socket = io(window.location.origin)

// 包装 Socket.IO 事件为 Promise
const emitAsync = (event, data) => {
  return new Promise((resolve) => {
    socket.emit(event, data, (response) => {
      resolve(response)
    })
  })
}

// 图片接口
export const searchImages = async (data) => {
  return await emitAsync('searchImages', data)
}

export const getNextList = async (params) => {
  return await emitAsync('getNextList', params)
}

export const toggleFavorite = async (id) => {
  return await emitAsync('toggleFavorite', id)
}

export const addToFavorites = async (id) => {
  return await emitAsync('addToFavorites', id)
}

export const removeFavorites = async (id) => {
  return await emitAsync('removeFavorites', id)
}

export const deleteImage = async (item) => {
  return await emitAsync('deleteImage', item)
}

// 设置接口
export const getSettingData = async () => {
  return await emitAsync('getSettingData')
}

export const h5UpdateSettingData = async (data) => {
  return await emitAsync('h5UpdateSettingData', data)
}

export const getResourceMap = async () => {
  return await emitAsync('getResourceMap')
}

// 导出 socket 实例，以便在其他地方使用
export const socketInstance = socket
