/**
 * h5服务子进程
 * */
import DatabaseManager from '../../store/DatabaseManager.mjs'
import SettingManager from '../../store/SettingManager.mjs'
import ResourcesManager from '../../store/ResourcesManager.mjs'
import FileManager from '../../store/FileManager.mjs'
import ApiManager from '../../store/ApiManager.mjs'
import ApiBase from '../../ApiBase.js'
import axios from 'axios'
import { calculateImageOrientation, calculateImageQuality } from '../../utils/utils.mjs'
import { changeLanguage } from '../../../i18n/server.js'
import server from './server.mjs'

const syncH5ServerLocale = async (settingManager) => {
  const locale = settingManager?.settingData?.h5Locale || settingManager?.settingData?.locale
  if (locale) {
    await changeLanguage(locale)
  }
}

const bindPluginApiHelpers = (logger) => {
  global.FBW = global.FBW || {}
  global.logger = logger
  global.FBW.apiHelpers = {
    axios,
    ApiBase,
    calculateImageOrientation,
    calculateImageQuality,
    logger
  }
}

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
        message: ''
      }
      if (typeof data === 'string') {
        postData.message = data
      } else if (typeof data === 'object') {
        postData.message = JSON.stringify(data)
      }
      port.postMessage(postData)
    }
  }
  const logger = {
    info: handleLogger('info'),
    warn: handleLogger('warn'),
    error: handleLogger('error')
  }
  bindPluginApiHelpers(logger)
  const postMessage = (data) => {
    if (!data) {
      return
    }
    port.postMessage(data)
  }
  let dbManager
  let settingManager
  let resourcesManager
  let fileManager
  let apiManager
  let broadcastSettingUpdated
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
        await syncH5ServerLocale(settingManager)

        fileManager = FileManager.getInstance(logger, dbManager, settingManager)
        apiManager = ApiManager.getInstance(logger, dbManager)
        await apiManager.waitForInitialization()
        resourcesManager = ResourcesManager.getInstance(
          logger,
          dbManager,
          settingManager,
          apiManager
        )
        const serverRes = await server({
          dbManager,
          settingManager,
          resourcesManager,
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
        broadcastSettingUpdated = serverRes.broadcastSettingUpdated
      } else if (data.event === 'APP_SETTING_UPDATED') {
        await settingManager.getSettingData()
        await syncH5ServerLocale(settingManager)
        // 通过 SSE 广播设置更新给所有客户端
        broadcastSettingUpdated?.({
          success: true,
          data: settingManager.settingData
        })
      } else if (data.event === 'API_PLUGINS_RELOAD') {
        bindPluginApiHelpers(logger)
        if (apiManager) {
          await apiManager.loadApi()
          logger.info('[H5Server] API 插件已重新加载')
        }
      }
    } catch (err) {
      logger.error(`[H5Server] ERROR => ${err}`)
    }
  })

  port.start()
})
