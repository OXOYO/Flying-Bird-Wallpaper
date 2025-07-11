export default async function setupSocketIO(
  ioServer,
  { t, dbManager, settingManager, resourcesManager, fileManager, logger, postMessage }
) {
  // 添加一个安全调用回调的辅助函数
  const safeCallback = (callback, response) => {
    if (typeof callback === 'function') {
      try {
        callback(response)
      } catch (err) {
        logger.error('[H5Server] ERROR => 回调函数执行错误:', err)
      }
    } else {
      logger.error('[H5Server] ERROR => 回调函数不是一个函数')
    }
  }

  ioServer.on('connection', (socket) => {
    // 获取设置
    socket.on('getSettingData', async (params, callback) => {
      try {
        const res = await settingManager.getSettingData()
        safeCallback(callback, res)
      } catch (err) {
        logger.error(`[H5Server] ERROR => 获取设置错误: ${err}`)
        safeCallback(callback, {
          success: false,
          data: null,
          message: t('messages.operationFail')
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
          ioServer.emit('settingUpdated', res)

          safeCallback(callback, {
            success: true,
            data: res.data,
            message: t('messages.operationSuccess')
          })
        } else {
          safeCallback(callback, {
            success: false,
            data: null,
            message: t('messages.operationFail')
          })
        }
      } catch (err) {
        logger.error(`[H5Server] ERROR => 更新设置错误: ${err}`)
        safeCallback(callback, {
          success: false,
          data: null,
          message: t('messages.operationFail')
        })
      }
    })

    // 获取资源数据
    socket.on('getResourceMap', async (params, callback) => {
      try {
        const res = await dbManager.getResourceMap()
        safeCallback(callback, res)
      } catch (err) {
        logger.error(`[H5Server] ERROR => 获取资源数据错误: ${err}`)
        safeCallback(callback, {
          success: false,
          data: null,
          message: t('messages.operationFail')
        })
      }
    })

    // 搜索图片
    socket.on('searchImages', async (params, callback) => {
      try {
        const res = await resourcesManager.search(params)
        safeCallback(callback, res)
      } catch (err) {
        logger.error(`[H5Server] ERROR => 搜索图片错误: ${err}`)
        safeCallback(callback, {
          success: false,
          data: null,
          message: t('messages.operationFail')
        })
      }
    })

    // 切换收藏状态
    socket.on('toggleFavorite', async (id, callback) => {
      try {
        if (!id) {
          safeCallback(callback, {
            success: false,
            message: t('messages.operationFail')
          })
          return
        }

        // 检查是否已经收藏
        const isFavorite = await resourcesManager.checkFavorite(id)

        if (isFavorite) {
          // 如果已经收藏，则取消收藏
          const res = await resourcesManager.removeFavorites(id)
          safeCallback(callback, {
            success: res.success,
            message: res.success ? t('messages.operationSuccess') : t('messages.operationFail')
          })
        } else {
          // 如果没有收藏，则添加收藏
          const res = await resourcesManager.addToFavorites(id)
          safeCallback(callback, {
            success: res.success,
            message: res.success ? t('messages.operationSuccess') : t('messages.operationFail')
          })
        }
      } catch (err) {
        logger.error(`[H5Server] ERROR => 切换收藏状态错误: ${err}`)
        safeCallback(callback, {
          success: false,
          message: t('messages.operationFail')
        })
      }
    })

    // 加入收藏
    socket.on('addToFavorites', async (id, callback) => {
      try {
        if (!id) {
          safeCallback(callback, {
            success: false,
            message: t('messages.operationFail')
          })
          return
        }
        const res = await resourcesManager.addToFavorites(id)
        safeCallback(callback, {
          success: res.success,
          message: res.success ? t('messages.operationSuccess') : t('messages.operationFail')
        })
      } catch (err) {
        logger.error(`[H5Server] ERROR => 加入收藏错误: ${err}`)
        safeCallback(callback, {
          success: false,
          message: t('messages.operationFail')
        })
      }
    })
    // 更新收藏数量
    socket.on('updateFavoriteCount', async ({ id, count }, callback) => {
      try {
        if (!id) {
          safeCallback(callback, {
            success: false,
            message: t('messages.operationFail')
          })
          return
        }
        const res = await resourcesManager.updateStatistics({ resourceId: id, favorites: count })
        safeCallback(callback, {
          success: res.success,
          message: res.success ? t('messages.operationSuccess') : t('messages.operationFail')
        })
      } catch (err) {
        logger.error(`[H5Server] ERROR => 更新收藏数量错误: ${err}`)
        safeCallback(callback, {
          success: false,
          message: t('messages.operationFail')
        })
      }
    })
    // 取消收藏
    socket.on('removeFavorites', async (id, callback) => {
      try {
        if (!id) {
          safeCallback(callback, {
            success: false,
            message: t('messages.operationFail')
          })
          return
        }
        const res = await resourcesManager.removeFavorites(id)
        safeCallback(callback, {
          success: res.success,
          message: res.success ? t('messages.operationSuccess') : t('messages.operationFail')
        })
      } catch (err) {
        logger.error(`[H5Server] ERROR => 取消收藏错误: ${err}`)
        safeCallback(callback, {
          success: false,
          message: t('messages.operationFail')
        })
      }
    })
    // 删除图片
    socket.on('deleteImage', async (item, callback) => {
      try {
        if (!item) {
          safeCallback(callback, {
            success: false,
            message: t('messages.operationFail')
          })
          return
        }
        const res = await fileManager.deleteFile(item)
        safeCallback(callback, {
          success: res.success,
          message: res.success ? t('messages.operationSuccess') : t('messages.operationFail')
        })
      } catch (err) {
        logger.error(`[H5Server] ERROR => 删除图片错误: ${err}`)
        safeCallback(callback, {
          success: false,
          message: t('messages.operationFail')
        })
      }
    })

    // 更新下载数量
    socket.on('updateDownloadCount', async ({ id, count }, callback) => {
      try {
        if (!id) {
          safeCallback(callback, {
            success: false,
            message: t('messages.operationFail')
          })
          return
        }
        const res = await resourcesManager.updateStatistics({ resourceId: id, downloads: count })
        safeCallback(callback, {
          success: res.success,
          message: res.success ? t('messages.operationSuccess') : t('messages.operationFail')
        })
      } catch (err) {
        logger.error(`[H5Server] ERROR => 更新下载数量错误: ${err}`)
        safeCallback(callback, {
          success: false,
          message: t('messages.operationFail')
        })
      }
    })

    // 断开连接
    socket.on('disconnect', () => {
      logger.info(`[H5Server] INFO => 客户端断开连接: ${socket.id}`)
    })
  })

  logger.info('[H5Server] INFO => Socket.IO 管理器初始化完成')
}
