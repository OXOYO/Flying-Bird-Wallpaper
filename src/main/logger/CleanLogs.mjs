import fs from 'node:fs'
import { join } from 'node:path'

export default class CleanLogs {
  #job

  constructor() {
    this.#job = null
  }

  /**
   * 启动清理任务
   * @param {number} interval - 清理间隔（毫秒），默认为 1 小时
   */
  start(interval = 60 * 60 * 1000) {
    // 默认 1 小时
    this.stop()

    // 检查日志目录是否存在
    const logDir = process.env.FBW_LOGS_PATH
    if (!logDir) {
      global.logger.error('FBW_LOGS_PATH environment variable is not set.')
      return
    }

    // 每隔指定时间执行一次清理任务
    this.#job = setInterval(async () => {
      try {
        await this.clean(logDir)
      } catch (err) {
        global.logger.error(`Failed to clean old logs: ${err.message}`)
      }
    }, interval)

    global.logger.info('CleanLogs task started.')
  }

  /**
   * 停止清理任务
   */
  stop() {
    if (this.#job) {
      clearInterval(this.#job)
      this.#job = null
    }
    global.logger.info('CleanLogs task stopped.')
  }

  /**
   * 清理旧日志文件
   * @param {string} logDir - 日志目录路径
   */
  async clean(logDir) {
    const now = Date.now()
    const threshold = now - 24 * 60 * 60 * 1000 // 清理阈值时间戳

    // 读取日志目录
    const files = await fs.promises.readdir(logDir)

    for (const file of files) {
      const filePath = join(logDir, file)

      try {
        const stats = await fs.promises.stat(filePath)

        // 如果文件最后修改时间超过清理阈值，则删除
        if (stats.mtimeMs < threshold) {
          await fs.promises.unlink(filePath)
          global.logger.info(
            `Deleted old log file: ${file} (last modified: ${new Date(stats.mtimeMs).toISOString().slice(0, 19).replace('T', ' ')})`
          )
        }
      } catch (err) {
        global.logger.error(`Failed to process file ${file}: ${err.message}`)
      }
    }
  }
}
