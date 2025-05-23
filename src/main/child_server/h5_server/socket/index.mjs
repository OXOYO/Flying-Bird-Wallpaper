import DatabaseManager from '../../../store/DatabaseManager.mjs'
import SettingManager from '../../../store/SettingManager.mjs'
import WallpaperManager from '../../../store/WallpaperManager.mjs'
import FileManager from '../../../store/FileManager.mjs'

// 添加一个安全调用回调的辅助函数
const safeCallback = (callback, response) => {
  if (typeof callback === 'function') {
    try {
      callback(response)
    } catch (err) {
      console.error('回调函数执行错误:', err)
    }
  } else {
    console.error('回调函数不是一个函数')
  }
}

export default async function setupSocketIO(io, { t, logger, postMessage }) {
  // 初始化数据库管理器
  const dbManager = DatabaseManager.getInstance(logger)
  await dbManager.waitForInitialization()

  // 初始化各种管理器并等待它们初始化完成
  const settingManager = SettingManager.getInstance(logger, dbManager)
  await settingManager.waitForInitialization()

  const fileManager = FileManager.getInstance(logger, dbManager, settingManager)
  const wallpaperManager = WallpaperManager.getInstance(
    logger,
    dbManager,
    settingManager,
    fileManager
  )

  logger.info('Socket.IO 管理器初始化完成')

  io.on('connection', (socket) => {
    // console.log('客户端连接成功:', socket.id)

    // 获取设置
    socket.on('getSettingData', async (params, callback) => {
      try {
        const res = await settingManager.getSettingData()
        safeCallback(callback, res)
      } catch (err) {
        logger.error(`获取设置错误: ${err}`)
        safeCallback(callback, {
          success: false,
          data: null,
          msg: t('messages.operationFail')
        })
      }
    })

    // 更新设置
    socket.on('h5UpdateSettingData', async (data, callback) => {
      try {
        const res = await settingManager.updateSettingData(data)

        if (res.success && res.data) {
          // 向主进程发送设置更新消息
          postMessage({
            event: 'H5_SETTING_UPDATED',
            data: res.data
          })

          // 广播设置更新给所有客户端
          io.emit('settingUpdated', res)

          safeCallback(callback, {
            success: true,
            data: res.data,
            msg: t('messages.operationSuccess')
          })
        } else {
          safeCallback(callback, {
            success: false,
            data: null,
            msg: t('messages.operationFail')
          })
        }
      } catch (err) {
        logger.error(`更新设置错误: ${err}`)
        safeCallback(callback, {
          success: false,
          data: null,
          msg: t('messages.operationFail')
        })
      }
    })

    // 获取资源数据
    socket.on('getResourceMap', async (params, callback) => {
      try {
        const res = await dbManager.getResourceMap()
        safeCallback(callback, res)
      } catch (err) {
        logger.error(`获取资源数据错误: ${err}`)
        safeCallback(callback, {
          success: false,
          data: null,
          msg: t('messages.operationFail')
        })
      }
    })

    // 搜索图片
    socket.on('searchImages', async (params, callback) => {
      try {
        const res = await wallpaperManager.searchImages(params)
        safeCallback(callback, res)
      } catch (err) {
        logger.error(`搜索图片错误: ${err}`)
        safeCallback(callback, {
          success: false,
          data: null,
          msg: t('messages.operationFail')
        })
      }
    })

    // 获取下一页图片
    socket.on('getNextList', async (params, callback) => {
      try {
        const res = await wallpaperManager.getNextList(params)
        safeCallback(callback, res)
      } catch (err) {
        logger.error(`获取下一页图片错误: ${err}`)
        safeCallback(callback, {
          success: false,
          data: null,
          msg: t('messages.operationFail')
        })
      }
    })

    // 切换收藏状态
    socket.on('toggleFavorite', async (id, callback) => {
      try {
        if (!id) {
          safeCallback(callback, {
            success: false,
            msg: t('messages.operationFail')
          })
          return
        }

        // 检查是否已经收藏
        const isFavorite = await wallpaperManager.checkFavorite(id)

        if (isFavorite) {
          // 如果已经收藏，则取消收藏
          const res = await wallpaperManager.removeFavorites(id)
          safeCallback(callback, {
            success: res.success,
            msg: res.success ? t('messages.operationSuccess') : t('messages.operationFail')
          })
        } else {
          // 如果没有收藏，则添加收藏
          const res = await wallpaperManager.addToFavorites(id)
          safeCallback(callback, {
            success: res.success,
            msg: res.success ? t('messages.operationSuccess') : t('messages.operationFail')
          })
        }
      } catch (err) {
        logger.error(`切换收藏状态错误: ${err}`)
        safeCallback(callback, {
          success: false,
          msg: t('messages.operationFail')
        })
      }
    })

    // 加入收藏
    socket.on('addToFavorites', async (id, callback) => {
      try {
        if (!id) {
          safeCallback(callback, {
            success: false,
            msg: t('messages.operationFail')
          })
          return
        }
        const res = await wallpaperManager.addToFavorites(id)
        safeCallback(callback, {
          success: res.success,
          msg: res.success ? t('messages.operationSuccess') : t('messages.operationFail')
        })
      } catch (err) {
        logger.error(`加入收藏错误: ${err}`)
        safeCallback(callback, {
          success: false,
          msg: t('messages.operationFail')
        })
      }
    })
    // 取消收藏
    socket.on('removeFavorites', async (id, callback) => {
      try {
        if (!id) {
          safeCallback(callback, {
            success: false,
            msg: t('messages.operationFail')
          })
          return
        }
        const res = await wallpaperManager.removeFavorites(id)
        safeCallback(callback, {
          success: res.success,
          msg: res.success ? t('messages.operationSuccess') : t('messages.operationFail')
        })
      } catch (err) {
        logger.error(`取消收藏错误: ${err}`)
        safeCallback(callback, {
          success: false,
          msg: t('messages.operationFail')
        })
      }
    })
    // 删除图片
    socket.on('deleteImage', async (item, callback) => {
      try {
        if (!item) {
          safeCallback(callback, {
            success: false,
            msg: t('messages.operationFail')
          })
          return
        }
        const res = await fileManager.deleteFile(item)
        safeCallback(callback, {
          success: res.success,
          msg: res.success ? t('messages.operationSuccess') : t('messages.operationFail')
        })
      } catch (err) {
        logger.error(`删除图片错误: ${err}`)
        safeCallback(callback, {
          success: false,
          msg: t('messages.operationFail')
        })
      }
    })

    // 断开连接
    socket.on('disconnect', () => {
      logger.info(`客户端断开连接: ${socket.id}`)
      // console.log('客户端断开连接:', socket.id)
    })
  })
}
