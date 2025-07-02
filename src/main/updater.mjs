import { app, ipcMain } from 'electron'
import electronUpdater from 'electron-updater'

const { autoUpdater } = electronUpdater

export default class Updater {
  constructor() {
    this.init()
  }
  init() {
    if (!app.isPackaged) {
      // 开启开发环境调试
      autoUpdater.forceDevUpdateConfig = true
      autoUpdater.logger = global.logger
      global.logger.info(`更新配置路径: ${JSON.stringify(autoUpdater.configOnDisk)}`)
      // 开发环境忽略代码签名检查
      autoUpdater.disableWebInstaller = true
      // 支持降级
      autoUpdater.allowDowngrade = true
      // 配置自定义更新服务器
      autoUpdater.setFeedURL({
        provider: 'generic',
        url: 'http://localhost:8080'
      })
    }
    // 配置自动更新
    autoUpdater.autoDownload = false // 自动下载
    autoUpdater.autoInstallOnAppQuit = true // 应用退出后自动安装

    // 监听渲染进程的检查更新事件，触发检查更新
    ipcMain.on('main:checkUpdate', () => {
      autoUpdater.checkForUpdatesAndNotify()
    })
  }

  on(event, callback = () => {}) {
    if (typeof callback !== 'function') {
      throw new Error('callback must be a function')
    }
    autoUpdater.on(event, callback)
  }

  checkUpdate() {
    // 检测是否有更新包并通知
    autoUpdater.checkForUpdatesAndNotify()
  }
}
