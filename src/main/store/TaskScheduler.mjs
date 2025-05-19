/**
 * 任务调度器
 * 负责管理所有定时任务
 */
export default class TaskScheduler {
  // 单例实例
  static _instance = null

  // 获取单例实例
  static getInstance(logger) {
    if (!TaskScheduler._instance) {
      TaskScheduler._instance = new TaskScheduler(logger)
    }
    return TaskScheduler._instance
  }

  constructor(logger) {
    // 防止直接实例化
    if (TaskScheduler._instance) {
      return TaskScheduler._instance
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
    TaskScheduler._instance = this
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
