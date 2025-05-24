import { contextBridge, ipcRenderer } from 'electron'

// 创建一个对象来存储已注册的回调引用
const listeners = {
  jumpToPage: null,
  commonData: null,
  sendPostData: null,
  settingDataUpdate: null,
  sendMsg: null,
  triggerAction: null,
  setVideoPath: null,
  setVideoSource: null,
  setVideoMute: null,
  setVideoFrameRate: null,
  setVideoScaleMode: null,
  setVideoBrightness: null,
  setVideoContrast: null
}

const api = {
  onJumpToPage: (callback) => {
    listeners.jumpToPage = callback
    ipcRenderer.on('main:jumpToPage', callback)
  },
  offJumpToPage: () => {
    if (listeners.jumpToPage) {
      ipcRenderer.off('main:jumpToPage', listeners.jumpToPage)
      listeners.jumpToPage = null // 清除引用
    }
  },

  onCommonData: (callback) => {
    listeners.commonData = callback
    ipcRenderer.on('main:commonData', callback)
  },
  offCommonData: () => {
    if (listeners.commonData) {
      ipcRenderer.off('main:commonData', listeners.commonData)
      listeners.commonData = null
    }
  },

  onSendPostData: (callback) => {
    listeners.sendPostData = callback
    ipcRenderer.on('main:sendPostData', callback)
  },
  offSendPostData: () => {
    if (listeners.sendPostData) {
      ipcRenderer.off('main:sendPostData', listeners.sendPostData)
      listeners.sendPostData = null
    }
  },

  onSettingDataUpdate: (callback) => {
    listeners.settingDataUpdate = callback
    ipcRenderer.on('main:settingDataUpdate', callback)
  },
  offSettingDataUpdate: () => {
    if (listeners.settingDataUpdate) {
      ipcRenderer.off('main:settingDataUpdate', listeners.settingDataUpdate)
      listeners.settingDataUpdate = null
    }
  },

  onSendMsg: (callback) => {
    listeners.sendMsg = callback
    ipcRenderer.on('main:sendMsg', callback)
  },
  offSendMsg: () => {
    if (listeners.sendMsg) {
      ipcRenderer.off('main:sendMsg', listeners.sendMsg)
      listeners.sendMsg = null
    }
  },

  onTriggerAction: (callback) => {
    listeners.triggerAction = callback
    ipcRenderer.on('main:triggerAction', callback)
  },
  offTriggerAction: () => {
    if (listeners.triggerAction) {
      ipcRenderer.off('main:triggerAction', listeners.triggerAction)
      listeners.triggerAction = null
    }
  },
  onSetVideoPath: (callback) => {
    listeners.setVideoPath = callback
    ipcRenderer.on('main:setVideoPath', callback)
  },
  offSetVideoPath: () => {
    if (listeners.setVideoPath) {
      ipcRenderer.off('main:setVideoPath', listeners.setVideoPath)
      listeners.setVideoPath = null
    }
  },
  onSetVideoSource: (callback) => {
    listeners.setVideoSource = callback
    ipcRenderer.on('main:setVideoSource', callback)
  },
  offSetVideoSource: () => {
    if (listeners.setVideoSource) {
      ipcRenderer.off('main:setVideoSource', listeners.setVideoSource)
      listeners.setVideoSource = null
    }
  },
  onSetVideoMute: (callback) => {
    listeners.setVideoMute = callback
    ipcRenderer.on('main:setVideoMute', callback)
  },
  offSetVideoMute: () => {
    if (listeners.setVideoMute) {
      ipcRenderer.off('main:setVideoMute', listeners.setVideoMute)
      listeners.setVideoMute = null
    }
  },
  onSetVideoFrameRate: (callback) => {
    listeners.setVideoFrameRate = callback
    ipcRenderer.on('main:setVideoFrameRate', callback)
  },
  offSetVideoFrameRate: () => {
    if (listeners.setVideoFrameRate) {
      ipcRenderer.off('main:setVideoFrameRate', listeners.setVideoFrameRate)
      listeners.setVideoFrameRate = null
    }
  },
  onSetVideoScaleMode: (callback) => {
    listeners.setVideoScaleMode = callback
    ipcRenderer.on('main:setVideoScaleMode', callback)
  },
  offSetVideoScaleMode: () => {
    if (listeners.setVideoScaleMode) {
      ipcRenderer.off('main:setVideoScaleMode', listeners.setVideoScaleMode)
      listeners.setVideoScaleMode = null
    }
  },
  onSetVideoBrightness: (callback) => {
    listeners.setVideoBrightness = callback
    ipcRenderer.on('main:setVideoBrightness', callback)
  },
  offSetVideoBrightness: () => {
    if (listeners.setVideoBrightness) {
      ipcRenderer.off('main:setVideoBrightness', listeners.setVideoBrightness)
      listeners.setVideoBrightness = null
    }
  },
  onSetVideoContrast: (callback) => {
    listeners.setVideoContrast = callback
    ipcRenderer.on('main:setVideoContrast', callback)
  },
  offSetVideoContrast: () => {
    if (listeners.setVideoContrast) {
      ipcRenderer.off('main:setVideoContrast', listeners.setVideoContrast)
      listeners.setVideoContrast = null
    }
  },
  // 双向通信
  selectFolder: (...args) => ipcRenderer.invoke('main:selectFolder', ...args),
  selectFile: (...args) => ipcRenderer.invoke('main:selectFile', ...args),
  showItemInFolder: (...args) => ipcRenderer.invoke('main:showItemInFolder', ...args),
  openDir: (...args) => ipcRenderer.invoke('main:openDir', ...args),
  openUrl: (...args) => ipcRenderer.invoke('main:openUrl', ...args),
  openViewImageWindow: (...args) => ipcRenderer.invoke('main:openViewImageWindow', ...args),
  getWindowPosition: (name) => ipcRenderer.invoke('main:getWindowPosition', name),
  setWindowPosition: (...args) => ipcRenderer.invoke('main:setWindowPosition', ...args),
  toggleMainWindow: (...args) => ipcRenderer.invoke('main:toggleMainWindow', ...args),
  getSettingData: (...args) => ipcRenderer.invoke('main:getSettingData', ...args),
  updateSettingData: (...args) => ipcRenderer.invoke('main:updateSettingData', ...args),
  getResourceMap: (...args) => ipcRenderer.invoke('main:getResourceMap', ...args),
  checkPrivacyPassword: (...args) => ipcRenderer.invoke('main:checkPrivacyPassword', ...args),
  hasPrivacyPassword: (...args) => ipcRenderer.invoke('main:hasPrivacyPassword', ...args),
  updatePrivacyPassword: (...args) => ipcRenderer.invoke('main:updatePrivacyPassword', ...args),
  searchImages: (...args) => ipcRenderer.invoke('main:searchImages', ...args),
  setAsWallpaperWithDownload: (...args) =>
    ipcRenderer.invoke('main:setAsWallpaperWithDownload', ...args),
  nextWallpaper: (...args) => ipcRenderer.invoke('main:nextWallpaper', ...args),
  prevWallpaper: (...args) => ipcRenderer.invoke('main:prevWallpaper', ...args),
  setWebWallpaper: (...args) => ipcRenderer.invoke('main:setWebWallpaper', ...args),
  // 动态壁纸相关API
  selectVideoFile: () => ipcRenderer.invoke('main:selectVideoFile'),
  setDynamicWallpaper: (...args) => ipcRenderer.invoke('main:setDynamicWallpaper', ...args),
  // 设置动态壁纸静音状态
  setDynamicWallpaperMute: (...args) => ipcRenderer.invoke('main:setDynamicWallpaperMute', ...args),
  // 检查动态壁纸状态
  checkDynamicWallpaperStatus: () => ipcRenderer.invoke('main:checkDynamicWallpaperStatus'),
  // 设置动态壁纸性能模式
  setDynamicWallpaperPerformance: (mode) =>
    ipcRenderer.invoke('main:setDynamicWallpaperPerformance', mode),
  // 设置动态壁纸缩放模式
  setDynamicWallpaperScaleMode: (mode) =>
    ipcRenderer.invoke('main:setDynamicWallpaperScaleMode', mode),
  // 设置动态壁纸亮度
  setDynamicWallpaperBrightness: (value) =>
    ipcRenderer.invoke('main:setDynamicWallpaperBrightness', value),

  // 设置动态壁纸对比度
  setDynamicWallpaperContrast: (value) =>
    ipcRenderer.invoke('main:setDynamicWallpaperContrast', value),
  closeDynamicWallpaper: (...args) => ipcRenderer.invoke('main:closeDynamicWallpaper', ...args),
  getPostData: (...args) => ipcRenderer.invoke('main:getPostData', ...args),
  addToFavorites: (...args) => ipcRenderer.invoke('main:addToFavorites', ...args),
  removeFavorites: (...args) => ipcRenderer.invoke('main:removeFavorites', ...args),
  deleteFile: (...args) => ipcRenderer.invoke('main:deleteFile', ...args),
  toggleAutoSwitchWallpaper: (...args) =>
    ipcRenderer.invoke('main:toggleAutoSwitchWallpaper', ...args),
  doClearDB: (...args) => ipcRenderer.invoke('main:doClearDB', ...args),
  refreshDirectory: (...args) => ipcRenderer.invoke('main:refreshDirectory', ...args),
  openSuspensionBall: (...args) => ipcRenderer.invoke('main:openSuspensionBall', ...args),
  closeSuspensionBall: (...args) => ipcRenderer.invoke('main:closeSuspensionBall', ...args),
  getWords: (...args) => ipcRenderer.invoke('main:getWords', ...args),
  closeViewImageWindow: (...args) => ipcRenderer.invoke('main:closeViewImageWindow', ...args),
  resizeWindow: (...args) => ipcRenderer.invoke('main:resizeWindow', ...args),
  clearCache: (...args) => ipcRenderer.invoke('main:clearCache', ...args),
  clearDownloadedAll: (...args) => ipcRenderer.invoke('main:clearDownloadedAll', ...args),
  clearDownloadedExpired: (...args) => ipcRenderer.invoke('main:clearDownloadedExpired', ...args),
  startH5Server: (...args) => ipcRenderer.invoke('main:startH5Server', ...args),
  stopH5Server: (...args) => ipcRenderer.invoke('main:stopH5Server', ...args),
  // 检查更新
  checkUpdate: (...args) => ipcRenderer.invoke('main:checkUpdate', ...args)
}

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('FBW', api)
  } catch (err) {
    console.error(err)
  }
} else {
  window.FBW = api
}
