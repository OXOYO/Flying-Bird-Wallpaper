import { contextBridge, ipcRenderer } from 'electron'
import { invokeWithObject } from './ipcSerialize.mjs'

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
  // 文件操作
  selectFolder: (...args) => ipcRenderer.invoke('main:selectFolder', ...args),
  selectFile: (...args) => ipcRenderer.invoke('main:selectFile', ...args),
  showItemInFolder: (...args) => ipcRenderer.invoke('main:showItemInFolder', ...args),
  deleteFile: (item) => invokeWithObject('main:deleteFile', ipcRenderer, item),
  downloadFile: (item) => invokeWithObject('main:downloadFile', ipcRenderer, item),
  openDir: (...args) => ipcRenderer.invoke('main:openDir', ...args),
  openUrl: (...args) => ipcRenderer.invoke('main:openUrl', ...args),
  openPath: (...args) => ipcRenderer.invoke('main:openPath', ...args),
  refreshDirectory: (...args) => ipcRenderer.invoke('main:refreshDirectory', ...args),

  // 数据操作
  getSettingData: (...args) => ipcRenderer.invoke('main:getSettingData', ...args),
  updateSettingData: (patch) => invokeWithObject('main:updateSettingData', ipcRenderer, patch),
  getResourceMap: (...args) => ipcRenderer.invoke('main:getResourceMap', ...args),
  getPostData: (...args) => ipcRenderer.invoke('main:getPostData', ...args),
  checkPrivacyPassword: (...args) => ipcRenderer.invoke('main:checkPrivacyPassword', ...args),
  hasPrivacyPassword: (...args) => ipcRenderer.invoke('main:hasPrivacyPassword', ...args),
  getPrivacyPasswordHint: (...args) => ipcRenderer.invoke('main:getPrivacyPasswordHint', ...args),
  updatePrivacyPassword: (...args) => ipcRenderer.invoke('main:updatePrivacyPassword', ...args),
  addToFavorites: (...args) => ipcRenderer.invoke('main:addToFavorites', ...args),
  removeFavorites: (...args) => ipcRenderer.invoke('main:removeFavorites', ...args),
  getWords: (...args) => ipcRenderer.invoke('main:getWords', ...args),
  getResourceTags: (resourceId) => ipcRenderer.invoke('main:getResourceTags', resourceId),

  // 窗口操作
  resizeWindow: (...args) => ipcRenderer.invoke('main:resizeWindow', ...args),
  getWindowPosition: (name) => ipcRenderer.invoke('main:getWindowPosition', name),
  setWindowPosition: (...args) => ipcRenderer.invoke('main:setWindowPosition', ...args),
  toggleMainWindow: (...args) => ipcRenderer.invoke('main:toggleMainWindow', ...args),
  openViewImageWindow: (data) => invokeWithObject('main:openViewImageWindow', ipcRenderer, data),
  closeViewImageWindow: (...args) => ipcRenderer.invoke('main:closeViewImageWindow', ...args),
  openSuspensionBall: (...args) => ipcRenderer.invoke('main:openSuspensionBall', ...args),
  closeSuspensionBall: (...args) => ipcRenderer.invoke('main:closeSuspensionBall', ...args),
  setSuspensionBallMode: (mode) => ipcRenderer.invoke('main:setSuspensionBallMode', mode),
  peekSuspensionBallExpandDirection: () =>
    ipcRenderer.invoke('main:peekSuspensionBallExpandDirection'),
  suspensionBallDragPrepare: () => ipcRenderer.invoke('main:suspensionBallDragPrepare'),
  suspensionBallDragActivate: () => ipcRenderer.invoke('main:suspensionBallDragActivate'),
  suspensionBallDragEnd: () => ipcRenderer.invoke('main:suspensionBallDragEnd'),

  // 壁纸操作
  search: (payload) => invokeWithObject('main:search', ipcRenderer, payload),
  // 获取热门标签
  getHotTags: (...args) => ipcRenderer.invoke('main:getHotTags', ...args),
  toggleAutoSwitchWallpaper: (...args) =>
    ipcRenderer.invoke('main:toggleAutoSwitchWallpaper', ...args),
  setAsWallpaperWithDownload: (item) =>
    invokeWithObject('main:setAsWallpaperWithDownload', ipcRenderer, item),
  nextWallpaper: (...args) => ipcRenderer.invoke('main:nextWallpaper', ...args),
  prevWallpaper: (...args) => ipcRenderer.invoke('main:prevWallpaper', ...args),
  setWebWallpaper: (...args) => ipcRenderer.invoke('main:setWebWallpaper', ...args),
  toggleRefreshWebWallpaperTask: (...args) =>
    ipcRenderer.invoke('main:toggleRefreshWebWallpaperTask', ...args),
  setColorWallpaper: (...args) => ipcRenderer.invoke('main:setColorWallpaper', ...args),
  // 动态壁纸相关API
  selectVideoFile: () => ipcRenderer.invoke('main:selectVideoFile'),
  setDynamicWallpaper: (...args) => ipcRenderer.invoke('main:setDynamicWallpaper', ...args),
  closeDynamicWallpaper: (...args) => ipcRenderer.invoke('main:closeDynamicWallpaper', ...args),
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
  // 设置动态壁纸背景色
  setDynamicWallpaperBackgroundColor: (value) =>
    ipcRenderer.invoke('main:setDynamicWallpaperBackgroundColor', value),
  // 设置动态壁纸透明度
  setDynamicWallpaperOpacity: (value) =>
    ipcRenderer.invoke('main:setDynamicWallpaperOpacity', value),
  // 设置动态壁纸亮度
  setDynamicWallpaperBrightness: (value) =>
    ipcRenderer.invoke('main:setDynamicWallpaperBrightness', value),
  // 设置动态壁纸对比度
  setDynamicWallpaperContrast: (value) =>
    ipcRenderer.invoke('main:setDynamicWallpaperContrast', value),
  // 律动壁纸相关API
  setRhythmWallpaper: (...args) => ipcRenderer.invoke('main:setRhythmWallpaper', ...args),
  closeRhythmWallpaper: (...args) => ipcRenderer.invoke('main:closeRhythmWallpaper', ...args),

  // 数据库操作
  clearDB: (...args) => ipcRenderer.invoke('main:clearDB', ...args),
  clearCache: (...args) => ipcRenderer.invoke('main:clearCache', ...args),
  clearDownloadedAll: (...args) => ipcRenderer.invoke('main:clearDownloadedAll', ...args),
  clearDownloadedExpired: (...args) => ipcRenderer.invoke('main:clearDownloadedExpired', ...args),

  // 服务操作
  startH5Server: (...args) => ipcRenderer.invoke('main:startH5Server', ...args),
  stopH5Server: (...args) => ipcRenderer.invoke('main:stopH5Server', ...args),

  // 检查更新
  checkUpdate: (...args) => ipcRenderer.invoke('main:checkUpdate', ...args),

  // 发送系统通知
  sendNotification: (...args) => ipcRenderer.invoke('main:sendNotification', ...args),

  // 快捷键相关
  getShortcuts: (...args) => ipcRenderer.invoke('main:getShortcuts', ...args),
  getShortcutConflicts: (...args) => ipcRenderer.invoke('main:getShortcutConflicts', ...args),
  updateShortcut: (...args) => ipcRenderer.invoke('main:updateShortcut', ...args),
  resetShortcut: (...args) => ipcRenderer.invoke('main:resetShortcut', ...args),
  checkShortcutConflict: (...args) => ipcRenderer.invoke('main:checkShortcutConflict', ...args),
  disableShortcuts: (...args) => ipcRenderer.invoke('main:disableShortcuts', ...args),
  enableShortcuts: (...args) => ipcRenderer.invoke('main:enableShortcuts', ...args),

  // 插件管理相关
  getAvailablePlugins: (...args) => ipcRenderer.invoke('main:getAvailablePlugins', ...args),
  getInstalledPlugins: (...args) => ipcRenderer.invoke('main:getInstalledPlugins', ...args),
  getPluginSources: (...args) => ipcRenderer.invoke('main:getPluginSources', ...args),
  addPluginSource: (...args) => ipcRenderer.invoke('main:addPluginSource', ...args),
  updatePluginSource: (...args) => ipcRenderer.invoke('main:updatePluginSource', ...args),
  removePluginSource: (...args) => ipcRenderer.invoke('main:removePluginSource', ...args),
  installPlugin: (...args) => ipcRenderer.invoke('main:installPlugin', ...args),
  uninstallPlugin: (...args) => ipcRenderer.invoke('main:uninstallPlugin', ...args),
  updatePlugin: (...args) => ipcRenderer.invoke('main:updatePlugin', ...args),

  analyzeResource: (...args) => ipcRenderer.invoke('main:analyzeResource', ...args),
  testAiConnection: (...args) => ipcRenderer.invoke('main:testAiConnection', ...args),
  listAiModels: (...args) => ipcRenderer.invoke('main:listAiModels', ...args),
  getAiAnalysisStats: (...args) => ipcRenderer.invoke('main:getAiAnalysisStats', ...args),
  parseSearchQuery: (...args) => ipcRenderer.invoke('main:parseSearchQuery', ...args),
  findSimilar: (payload) => invokeWithObject('main:findSimilar', ipcRenderer, payload),
  semanticSearch: (payload) => invokeWithObject('main:semanticSearch', ipcRenderer, payload),
  recommend: (...args) => ipcRenderer.invoke('main:recommend', ...args),
  collectionsList: (...args) => ipcRenderer.invoke('main:collections:list', ...args),
  collectionsGet: (...args) => ipcRenderer.invoke('main:collections:get', ...args),
  collectionsCreate: (...args) => ipcRenderer.invoke('main:collections:create', ...args),
  collectionsUpdate: (...args) => ipcRenderer.invoke('main:collections:update', ...args),
  collectionsDelete: (...args) => ipcRenderer.invoke('main:collections:delete', ...args),
  collectionsGenerate: (...args) => ipcRenderer.invoke('main:collections:generate', ...args),
  collectionsAddAllToFavorites: (...args) =>
    ipcRenderer.invoke('main:collections:addAllToFavorites', ...args),
  collectionsCurate: (...args) => ipcRenderer.invoke('main:collections:curate', ...args),
  collectionsCuratorStats: (...args) =>
    ipcRenderer.invoke('main:collections:curatorStats', ...args)
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
