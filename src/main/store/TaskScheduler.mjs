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
    this.timers = {}
    /** @type {Record<string, ReturnType<typeof setTimeout>|null>} */
    this.initialTimeouts = {}

    // 保存实例
    TaskScheduler._instance = this
  }

  // 调度任务
  scheduleTask(timerKey, interval, callback, initialDelay = 0) {
    this.clearTask(timerKey)

    // 如果有初始延迟
    if (initialDelay > 0) {
      this.initialTimeouts[timerKey] = setTimeout(() => {
        this.initialTimeouts[timerKey] = null
        callback()
        this.timers[timerKey] = setInterval(callback, interval)
      }, initialDelay)
    } else {
      this.timers[timerKey] = setInterval(callback, interval)
    }
  }

  hasActiveTask(timerKey) {
    return !!(this.timers[timerKey] || this.initialTimeouts[timerKey])
  }

  // 清除定时器
  clearTask(timerKey) {
    if (this.initialTimeouts[timerKey]) {
      clearTimeout(this.initialTimeouts[timerKey])
      this.initialTimeouts[timerKey] = null
    }
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
