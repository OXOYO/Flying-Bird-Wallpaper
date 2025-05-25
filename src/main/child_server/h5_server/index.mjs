/**
 * h5服务子进程
 * */
import DatabaseManager from '../../store/DatabaseManager.mjs'
import SettingManager from '../../store/SettingManager.mjs'
import WallpaperManager from '../../store/WallpaperManager.mjs'
import FileManager from '../../store/FileManager.mjs'
import server from './server.mjs'

process.parentPort.on('message', (e) => {
  const [port] = e.ports

  const handleLogger = (type = 'info') => {
    return (data) => {
      if (!data) {
        return
      }
      const postData = {
        event: 'SERVER_LOG',
        level: type,
        msg: ''
      }
      if (typeof data === 'string') {
        postData.msg = data
      } else if (typeof data === 'object') {
        postData.msg = JSON.stringify(data)
      }
      port.postMessage(postData)
    }
  }
  const logger = {
    info: handleLogger('info'),
    warn: handleLogger('warn'),
    error: handleLogger('error')
  }
  const postMessage = (data) => {
    if (!data) {
      return
    }
    port.postMessage(data)
  }
  let dbManager
  let settingManager
  let wallpaperManager
  let fileManager
  let ioServer
  // 监听消息
  port.on('message', async (e) => {
    try {
      const { data } = e
      // 启动h5服务
      if (data.event === 'SERVER_START') {
        // 初始化数据库管理器
        dbManager = DatabaseManager.getInstance(logger)
        await dbManager.waitForInitialization()

        // 初始化各种管理器并等待它们初始化完成
        settingManager = SettingManager.getInstance(logger, dbManager)
        await settingManager.waitForInitialization()

        fileManager = FileManager.getInstance(logger, dbManager, settingManager)
        wallpaperManager = WallpaperManager.getInstance(
          logger,
          dbManager,
          settingManager,
          fileManager
        )
        const serverRes = await server({
          dbManager,
          settingManager,
          wallpaperManager,
          fileManager,
          logger,
          postMessage,
          onStartSuccess: (url) => {
            port.postMessage({
              event: 'SERVER_START::SUCCESS',
              url
            })
          },
          onStartFail: (data) => {
            port.postMessage({
              event: 'SERVER_START::FAIL',
              ...data
            })
          }
        })
        ioServer = serverRes.ioServer
      } else if (data.event === 'APP_SETTING_UPDATED') {
        await settingManager.getSettingData()
        // 广播设置更新给所有客户端
        ioServer?.emit('settingUpdated', {
          success: true,
          data: settingManager.settingData
        })
      }
    } catch (err) {
      logger.error(`[H5Server] ERROR => ${err}`)
    }
  })

  port.start()
})
