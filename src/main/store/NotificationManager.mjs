import { Notification } from 'electron'

export default class NotificationManager {
  // 单例实例
  static _instance = null

  // 获取单例实例
  static getInstance(logger, settingManager) {
    if (!NotificationManager._instance) {
      NotificationManager._instance = new NotificationManager(logger, settingManager)
    }
    return NotificationManager._instance
  }

  constructor(logger, settingManager) {
    // 防止直接实例化
    if (NotificationManager._instance) {
      return NotificationManager._instance
    }

    this.logger = logger
    this.settingManager = settingManager
    this._initialized = true

    NotificationManager._instance = this
  }

  // 等待初始化完成的方法
  async waitForInitialization() {
    return true
  }

  // 使用 settingManager 获取设置
  get settingData() {
    return this.settingManager.settingData
  }

  // 发送系统通知
  send(options, name) {
    try {
      const notifications = this.settingData.notifications || []
      if ((!name || (name && notifications.includes(name))) && Notification.isSupported()) {
        return new Notification(options)
      }
    } catch (err) {
      this.logger.error(`发送系统通知失败：${err.message}`)
    }
  }
}
