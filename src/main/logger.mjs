import { join } from 'node:path'
import pino from 'pino'
import { isDev } from './utils/utils.mjs'

export default (logDir, fileName = 'app.log') => {
  // 获取用户数据目录
  const logFilePath = join(logDir || process.env.FBW_LOGS_PATH, fileName)

  // 配置 pino-roll 传输
  const transport = pino.transport(
    isDev()
      ? {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'SYS:standard',
            ignore: 'pid,hostname'
          }
        }
      : {
          target: 'pino-roll',
          options: {
            file: logFilePath, // 日志文件路径
            frequency: 'daily', // 每天生成一个新的日志文件
            size: '10M', // 每个日志文件的最大大小
            mkdir: true, // 自动创建目录
            dateFormat: 'yyyy-MM-dd' // 自定义日志文件名称，eg: app.log.2025-02-27.1
          }
        }
  )

  // 创建 Pino 实例
  const logger = pino(transport)

  // 初始化日志 挂载全局变量
  global.logger = logger
}
