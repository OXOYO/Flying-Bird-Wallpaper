/**
 * 任务调度器
 * 负责管理所有定时任务
 */
// 添加单例实例变量
let instance = null

export default class TaskScheduler {
  constructor(logger) {
    // 如果实例已存在，直接返回该实例
    if (instance) {
      return instance
    }

    this.logger = logger
    // 初始化任务列表
    this.tasks = {}

    // 添加定时器管理
    this.timers = {
      autoSwitchWallpaper: null,
      autoRefreshDirectory: null,
      autoDownload: null,
      autoClearDownloaded: null,
      handleQuality: null,
      checkPrivacyPassword: null,
      handleWords: null,
      monitorMemory: null
    }

    // 保存实例
    instance = this
  }

  // 调度任务
  scheduleTask(timerKey, interval, callback, initialDelay = 0) {
    // 清除已存在的定时器
    if (this.timers[timerKey]) {
      clearInterval(this.timers[timerKey])
    }

    // 如果有初始延迟
    if (initialDelay > 0) {
      setTimeout(() => {
        callback()
        this.timers[timerKey] = setInterval(callback, interval)
      }, initialDelay)
    } else {
      this.timers[timerKey] = setInterval(callback, interval)
    }
  }

  // 清除定时器
  clearTask(timerKey) {
    if (this.timers[timerKey]) {
      clearInterval(this.timers[timerKey])
      this.timers[timerKey] = null
    }
  }

  // 清除所有定时器
  clearAllTasks() {
    Object.keys(this.timers).forEach((key) => {
      this.clearTask(key)
    })
  }
}
