import fs from 'node:fs'
import { join } from 'node:path'
import schedule from 'node-schedule'

export default class CleanOldLogs {
  #job

  constructor() {
    this.#job = null
  }

  /**
   * 启动清理任务
   * @param {string} rule - 定时任务规则，默认为每小时的第 0 分钟执行
   */
  start(rule = '0 * * * *') {
    this.stop()

    // 检查日志目录是否存在
    const logDir = process.env.FBW_LOGS_PATH
    if (!logDir) {
      global.logger.error('FBW_LOGS_PATH environment variable is not set.')
      return
    }

    // 每小时执行一次清理任务
    this.#job = schedule.scheduleJob(rule, async () => {
      try {
        await this.cleanOldLogs(logDir)
      } catch (err) {
        global.logger.error(`Failed to clean old logs: ${err.message}`)
      }
    })

    global.logger.info('CleanOldLogs task started.')
  }

  /**
   * 停止清理任务
   */
  stop() {
    this.#job?.cancel()
    global.logger.info('CleanOldLogs task stopped.')
  }

  /**
   * 清理旧日志文件
   * @param {string} logDir - 日志目录路径
   */
  async cleanOldLogs(logDir) {
    const now = Date.now()
    const twoHoursAgo = now - 2 * 60 * 60 * 1000 // 2 小时前的时间戳

    // 读取日志目录
    const files = await fs.promises.readdir(logDir)

    for (const file of files) {
      const filePath = join(logDir, file)

      try {
        const stats = await fs.promises.stat(filePath)

        // 如果文件最后修改时间超过 2 小时，则删除
        if (stats.mtimeMs < twoHoursAgo) {
          await fs.promises.unlink(filePath)
          global.logger.info(
            `Deleted old log file: ${file} (last modified: ${new Date(stats.mtimeMs).toISOString()})`
          )
        }
      } catch (err) {
        global.logger.error(`Failed to process file ${file}: ${err.message}`)
      }
    }
  }
}
