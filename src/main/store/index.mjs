import { app, ipcMain, BrowserWindow, screen, powerMonitor } from 'electron'
import path from 'path'
import fs from 'fs'
import { createFileServer, createH5Server } from '../child_server/index.mjs'
import { t } from '../../i18n/server.js'
import DatabaseManager from './DatabaseManager.mjs'
import ResourcesManager from './ResourcesManager.mjs'
import WallpaperManager from './WallpaperManager.mjs'
import TaskScheduler from './TaskScheduler.mjs'
import FileManager from './FileManager.mjs'
import WordsManager from './WordsManager.mjs'
import SettingManager from './SettingManager.mjs'
import VersionManager from './VersionManager.mjs'
// 导入动态壁纸工具
// import { setDynamicWallpaper, closeDynamicWallpaper } from '../utils/wallpaper.mjs'
import { handleTimeByUnit } from '../utils/utils.mjs'

export default class Store {
  constructor({ sendCommonData, sendMsg } = {}) {
    // 初始化完成标志
    this._initialized = false
    this.sendCommonData = sendCommonData
    this.sendMsg = sendMsg
    this.mainWindow = null
    this.suspensionBall = null

    // 锁
    this.locks = {
      refreshDirectory: false,
      handleQuality: false,
      handleWords: false
    }

    // 添加电源状态标志
    this.powerState = {
      isSystemIdle: false,
      wasAutoSwitchEnabled: false
    }

    // 初始化时等待设置加载完成
    this._initPromise = this._init()
  }

  // 初始化方法
  async _init() {
    try {
      // 初始化数据库管理器
      this.dbManager = DatabaseManager.getInstance(global.logger)
      // 等待数据库管理器初始化完成
      await this.dbManager.waitForInitialization()
      this.db = this.dbManager.db

      // 初始化版本管理器
      this.versionManager = VersionManager.getInstance(global.logger, this.dbManager)
      await this.versionManager.waitForInitialization()

      // 初始化设置管理器
      this.settingManager = SettingManager.getInstance(global.logger, this.dbManager)
      // 等待设置管理器初始化完成
      await this.settingManager.waitForInitialization()
      // 初始化资源管理器
      this.resourcesManager = ResourcesManager.getInstance(global.logger, this.dbManager)
      // 等待资源管理器初始化完成
      await this.resourcesManager.waitForInitialization()

      // 文件服务子进程
      this.fileServer = createFileServer()

      // h5服务子进程
      this.h5Server = createH5Server()
      this.h5ServerUrl = null

      // 初始化其他管理器
      this.taskScheduler = TaskScheduler.getInstance(global.logger)
      this.wordsManager = WordsManager.getInstance(
        global.logger,
        this.dbManager,
        this.settingManager
      )
      this.fileManager = FileManager.getInstance(
        global.logger,
        this.dbManager,
        this.settingManager,
        this.fileServer,
        this.wordsManager
      )
      this.wallpaperManager = WallpaperManager.getInstance(
        global.logger,
        this.dbManager,
        this.settingManager,
        this.fileManager,
        this.resourcesManager
      )

      // 处理IPC通信
      this.handleIpc()

      // 处理文件服务子进程启动
      this.handleFileServerStart()

      // 如果设置了自动启动H5服务，在初始化完成后启动
      if (this.settingData.startH5ServerOnStartup) {
        try {
          global.logger.info('初始化完成后启动H5服务...')
          // 添加延迟，给网络接口更多时间初始化
          setTimeout(() => {
            this.handleH5ServerStart(3, 2000)
          }, 5000) // 延迟5秒启动
        } catch (err) {
          global.logger.error(`初始化完成后启动H5服务失败: ${err.message}`)
        }
      }

      // 开启定时任务
      this.startScheduledTasks()

      // 处理开机自启动设置
      this.handleStartup()

      // 监听系统电源状态
      this.setupPowerMonitor()

      this._initialized = true
      global.logger.info('Store 初始化完成')
      return true
    } catch (err) {
      global.logger.error(`Store 初始化失败: ${err.message}`)
      return false
    }
  }

  // 等待初始化完成的方法
  async waitForInitialization() {
    if (this._initialized) {
      return true
    }
    return this._initPromise
  }

  get settingData() {
    return this.settingManager.settingData
  }

  // 设置主窗口
  setMainWindow(mainWindow) {
    this.mainWindow = mainWindow
  }

  // 设置悬浮球
  setSuspensionBall(suspensionBall) {
    this.suspensionBall = suspensionBall
  }

  // 更新开机自启动设置
  handleStartup() {
    if (app.isPackaged) {
      const exePath = process.execPath
      app.setLoginItemSettings({
        openAtLogin: this.settingData.startup,
        openAsHidden: !this.settingData.openMainWindowOnStartup,
        path: exePath,
        args: ['--autoStart']
      })
    }
  }

  // 开启定时任务
  startScheduledTasks() {
    this.startMonitorMemoryTask()
    this.startHandleQualityTask()
    this.startHandleWordsTask()

    // 处理定时任务
    this.intervalSwitchWallpaper()
    this.intervalRefreshDirectory()
    this.intervalDownload()
    this.intervalClearDownloaded()
  }

  // 启动内存监控任务
  startMonitorMemoryTask() {
    const key = 'monitorMemory'
    // 清理任务
    this.taskScheduler.clearTask(key)
    // 开启内存监控任务
    this.taskScheduler.scheduleTask('monitorMemory', 5 * 60 * 1000, () => {
      const memoryUsage = process.memoryUsage()
      const heapUsedMB = Math.round((memoryUsage.heapUsed / 1024 / 1024) * 100) / 100
      const heapTotalMB = Math.round((memoryUsage.heapTotal / 1024 / 1024) * 100) / 100

      global.logger.info(`内存使用情况: ${heapUsedMB}MB / ${heapTotalMB}MB`)

      // 如果堆内存使用超过80%，触发垃圾回收
      if (heapUsedMB / heapTotalMB > 0.8) {
        global.logger.info('内存使用率较高，触发垃圾回收')
        if (global.gc) {
          global.gc()
        }
      }
    })
  }

  // 启动图片质量处理任务
  startHandleQualityTask() {
    const key = 'handleQuality'
    // 清理任务
    this.taskScheduler.clearTask(key)
    // 开启定时计算图片质量
    this.taskScheduler.scheduleTask(
      key,
      7 * 60 * 1000,
      () => {
        this.fileManager.intervalHandleQuality(this.locks)
      },
      10 * 60 * 1000
    )
  }

  // 启动处理分词任务
  startHandleWordsTask() {
    const key = 'handleWords'
    // 清理任务
    this.taskScheduler.clearTask(key)
    // 检查是否启用词库处理任务
    if (this.settingData.enableSegmentationTask) {
      // 开启定时处理词库
      this.taskScheduler.scheduleTask(
        key,
        11 * 60 * 1000,
        () => {
          this.wordsManager.intervalHandleWords(this.locks)
        },
        12 * 60 * 1000
      )
    }
  }

  // 设置电源监控
  setupPowerMonitor() {
    // 监听系统挂起事件
    powerMonitor.on('suspend', () => {
      global.logger.info('系统挂起，暂停自动切换壁纸')
      this.handleSystemIdle(true)
    })

    // 监听系统恢复事件
    powerMonitor.on('resume', () => {
      global.logger.info('系统恢复，恢复自动切换壁纸状态')
      this.handleSystemIdle(false)
    })

    // 监听锁屏事件
    powerMonitor.on('lock-screen', () => {
      global.logger.info('系统锁屏，暂停自动切换壁纸')
      this.handleSystemIdle(true)
    })

    // 监听解锁事件
    powerMonitor.on('unlock-screen', () => {
      global.logger.info('系统解锁，恢复自动切换壁纸状态')
      this.handleSystemIdle(false)
    })

    // 监听系统空闲状态
    if (powerMonitor.getSystemIdleState) {
      // 每分钟检查一次系统空闲状态
      setInterval(() => {
        // 系统空闲阈值，单位为秒，默认5分钟
        const idleState = powerMonitor.getSystemIdleState(300)
        if (idleState === 'idle' && !this.powerState.isSystemIdle) {
          global.logger.info('系统空闲，暂停自动切换壁纸')
          this.handleSystemIdle(true)
        } else if (idleState === 'active' && this.powerState.isSystemIdle) {
          global.logger.info('系统活跃，恢复自动切换壁纸状态')
          this.handleSystemIdle(false)
        }
      }, 60000)
    }
  }

  // 处理系统空闲状态
  handleSystemIdle(isIdle) {
    if (isIdle && !this.powerState.isSystemIdle) {
      // 系统进入空闲状态，记录当前自动切换状态并暂停
      this.powerState.isSystemIdle = true
      this.powerState.wasAutoSwitchEnabled = this.settingData.autoSwitchWallpaper

      if (this.powerState.wasAutoSwitchEnabled) {
        // 暂停自动切换壁纸，但不更新设置
        this.taskScheduler.clearTask('autoSwitchWallpaper')
      }
    } else if (!isIdle && this.powerState.isSystemIdle) {
      // 系统恢复活跃状态，恢复之前的自动切换状态
      this.powerState.isSystemIdle = false

      if (this.powerState.wasAutoSwitchEnabled) {
        // 恢复自动切换壁纸
        this.intervalSwitchWallpaper()
      }
    }
  }

  // 处理文件服务子进程启动
  handleFileServerStart() {
    try {
      // 启动子进程
      this.fileServer?.start({
        onMessage: ({ data }) => {
          switch (data.event) {
            case 'REFRESH_DIRECTORY::SUCCESS':
              // 添加接收时间戳
              data.receiveMsgTime = Date.now()
              this.onRefreshDirectorySuccess(data)
              break
            case 'REFRESH_DIRECTORY::FAIL':
              // 添加接收时间戳
              data.receiveMsgTime = Date.now()
              this.onRefreshDirectoryFail(data)
              break
            case 'HANDLE_IMAGE_QUALITY::SUCCESS':
              this.fileManager.onHandleImageQualitySuccess(data, this.locks)
              break
          }
        }
      })
    } catch (err) {
      global.logger.error(err)
    }
  }

  // 文件服务子进程-遍历目录完成
  onRefreshDirectorySuccess(data) {
    // 获取开始时间和接收时间，使用当前时间作为默认值而不是0
    const startTime = data.refreshDirStartTime
    // 父进程向子进程发送消息耗时
    const parentToChildCoast = data.readDirTime.start - startTime
    // 子进程向父进程发送消息耗时
    const childToParentCoast = data.receiveMsgTime - data.readDirTime.end
    // 遍历目录耗时
    const readDirCoast = data.readDirTime.end - data.readDirTime.start
    // 记录开始处理数据库的时间
    const processDataStartTime = Date.now()
    const res = this.fileManager.processDirectoryData(data)

    // 记录结束时间
    const endTime = Date.now()

    // 计算各阶段耗时
    const totalCoast = endTime - startTime
    const processDataCost = endTime - processDataStartTime

    // 转换成YYYY-MM-DD HH:mm:ss格式
    const timeNow = new Date().toLocaleString()
    // 打印耗时信息
    console.log(
      `刷新目录完成 - 时间: ${timeNow}  总耗时: ${totalCoast}ms, 父=>子: ${parentToChildCoast}, 遍历目录耗时: ${readDirCoast}ms, 子=>父: ${childToParentCoast}ms, 插入数据库耗时: ${processDataCost}ms`
    )

    // 清除锁
    this.locks.refreshDirectory = false
    // 手动刷新完成后发送消息
    if (data.isManual) {
      this.sendMsg(this.mainWindow, {
        type: res.success ? (res.data.insertedCount > 0 ? 'success' : 'info') : 'error',
        msg: res.msg
      })
      if (res.success && res.data.insertedCount > 0) {
        // 触发刷新动作
        this.triggerAction('refreshSearchList')
      }
    }
  }

  // 文件服务子进程-遍历目录失败
  onRefreshDirectoryFail(data) {
    // 清除锁
    this.locks.refreshDirectory = false
    // 手动刷新完成后发送消息
    if (data.isManual) {
      this.sendMsg(this.mainWindow, {
        type: 'error',
        msg: t('messages.refreshDirectoryFail')
      })
    }
  }

  // 带重试机制的H5服务启动方法
  handleH5ServerStart(maxRetries = 3, retryInterval = 2000) {
    let retryCount = 0

    const attemptStart = () => {
      try {
        this.h5Server?.start({
          options: {
            env: process.env
          },
          onMessage: ({ data }) => {
            // console.log('H5服务器收到消息:', data)
            if (data.event === 'SERVER_START::SUCCESS') {
              this.h5ServerUrl = data.url

              // 检查IP是否有效
              const urlObj = new URL(data.url)
              const ip = urlObj.hostname

              if (ip === '0.0.0.0' || ip === '127.0.0.1') {
                global.logger.warn(`H5服务器IP无效: ${ip}，尝试重启服务`)

                // 停止当前服务
                this.h5Server?.stop(() => {
                  if (retryCount < maxRetries) {
                    retryCount++
                    global.logger.info(`重试启动H5服务 (${retryCount}/${maxRetries})...`)
                    setTimeout(attemptStart, retryInterval)
                  } else {
                    global.logger.error(`H5服务器无法获取有效IP，已达到最大重试次数`)
                  }
                })
                return
              }

              global.logger.info(`H5服务器启动成功: ${this.h5ServerUrl}`)

              // 发送消息到主窗口
              if (this.mainWindow) {
                this.sendCommonData(this.mainWindow)
                this.sendMsg(this.mainWindow, {
                  type: 'success',
                  msg: t('messages.h5ServerStartSuccess')
                })
              } else {
                global.logger.warn('主窗口未初始化，无法发送H5服务器URL')
              }
            } else if (data.event === 'H5_SETTING_UPDATED') {
              // 处理从子进程收到的设置更新
              // 发送更新消息
              this.sendSettingDataUpdate()
            } else if (data.event === 'SERVER_START::FAIL') {
              global.logger.error(`H5服务器启动失败: ${data}`)
            } else if (data.event === 'SERVER_LOG') {
              const type = data.level
              if (type && typeof global.logger[type] === 'function') {
                global.logger[type](data.msg)
              } else {
                global.logger.info(`H5服务器日志: ${data.msg}`)
              }
            }
          }
        })
      } catch (err) {
        global.logger.error(`启动H5服务器失败: ${err}`)

        if (retryCount < maxRetries) {
          retryCount++
          global.logger.info(`重试启动H5服务 (${retryCount}/${maxRetries})...`)
          setTimeout(attemptStart, retryInterval)
        } else {
          // 发送错误消息
          if (this.mainWindow) {
            this.sendMsg(this.mainWindow, {
              type: 'error',
              msg: t('messages.h5ServerStartFail')
            })
          }
        }
      }
    }

    // 开始第一次尝试
    attemptStart()
  }

  // 处理H5服务子进程停止
  handleH5ServerStop() {
    try {
      this.h5Server?.stop((isSuccess) => {
        if (isSuccess) {
          this.h5ServerUrl = null
          this.sendCommonData(this.mainWindow)
          this.sendMsg(this.mainWindow, {
            type: 'success',
            msg: t('messages.h5ServerStopSuccess')
          })
        } else {
          // 发送错误消息
          this.sendMsg(this.mainWindow, {
            type: 'error',
            msg: t('messages.h5ServerStopFail')
          })
        }
      })
    } catch (err) {
      global.logger.error(err)
    }
  }

  // 触发动作
  triggerAction(action, data) {
    this.mainWindow.webContents.send('main:triggerAction', action, data)
  }

  // 发送设置数据更新
  sendSettingDataUpdate() {
    if (this.mainWindow) {
      this.mainWindow.webContents.send('main:settingDataUpdate', this.settingData)
    }
    if (this.suspensionBall) {
      this.suspensionBall.webContents.send('main:settingDataUpdate', this.settingData)
    }
  }

  // 处理IPC通信
  handleIpc() {
    // 获取设置数据
    ipcMain.handle('main:getSettingData', () => {
      return this.settingManager.getSettingData()
    })

    // 合并更新设置数据
    ipcMain.handle('main:updateSettingData', async (event, formData) => {
      return await this.updateSettingData(formData)
    })

    // 获取资源数据
    ipcMain.handle('main:getResourceMap', () => {
      return this.dbManager.getResourceMap()
    })

    // 验证隐私空间密码
    ipcMain.handle('main:checkPrivacyPassword', async (event, password) => {
      return await this.settingManager.checkPrivacyPassword(password)
    })

    // 检查是否设置了隐私密码
    ipcMain.handle('main:hasPrivacyPassword', async () => {
      return await this.settingManager.hasPrivacyPassword()
    })

    ipcMain.handle('main:updatePrivacyPassword', async (event, formData) => {
      return await this.settingManager.updatePrivacyPassword(formData)
    })

    // 加入收藏夹
    ipcMain.handle('main:addToFavorites', async (event, resourceId, isPrivacySpace = false) => {
      return await this.wallpaperManager.addToFavorites(resourceId, isPrivacySpace)
    })

    // 移出收藏夹
    ipcMain.handle('main:removeFavorites', async (event, resourceId, isPrivacySpace = false) => {
      return await this.wallpaperManager.removeFavorites(resourceId, isPrivacySpace)
    })

    // 删除文件
    ipcMain.handle('main:deleteFile', async (event, item) => {
      return await this.fileManager.deleteFile(item)
    })

    // 搜索资源数据
    ipcMain.handle('main:searchImages', async (event, params) => {
      return await this.wallpaperManager.searchImages(params)
    })

    // 查询图库数据
    ipcMain.handle('main:getNextList', async (event, params) => {
      return await this.wallpaperManager.getNextList(params)
    })

    // 设置为壁纸
    ipcMain.handle('main:setAsWallpaperWithDownload', async (event, item) => {
      return await this.wallpaperManager.setAsWallpaperWithDownload(item)
    })

    // 切换壁纸
    ipcMain.handle('main:nextWallpaper', async () => {
      return this.doManualSwitchWallpaper('next')
    })

    // 切换至上一个壁纸
    ipcMain.handle('main:prevWallpaper', async () => {
      return this.doManualSwitchWallpaper('prev')
    })

    // 设置网页壁纸
    ipcMain.handle('main:setWebWallpaper', (event, url) => {
      return this.setWebWallpaper(url)
    })

    // 添加动态壁纸相关的IPC处理程序
    // ipcMain.handle('main:setDynamicWallpaper', async (event, videoPath) => {
    //   return await setDynamicWallpaper(videoPath)
    // })

    // ipcMain.handle('main:closeDynamicWallpaper', () => {
    //   return closeDynamicWallpaper()
    // })

    // 启停定时切换壁纸
    ipcMain.handle('main:toggleAutoSwitchWallpaper', async () => {
      return this.toggleAutoSwitchWallpaper()
    })

    // 清空当前资源DB
    ipcMain.handle('main:doClearDB', async (event, tableName, resourceName) => {
      const res = await this.dbManager.clearDB(tableName, resourceName)
      this.sendMsg(this.mainWindow, {
        type: res.success ? 'success' : 'error',
        msg: res.msg
      })
      return res
    })

    // 刷新当前资源目录
    ipcMain.handle('main:refreshDirectory', async () => {
      const res = this.fileManager.refreshDirectory(this.locks, true)
      if (res && !res.success) {
        this.sendMsg(this.mainWindow, {
          type: 'error',
          msg: res.msg
        })
      }
    })

    // 查找词库
    ipcMain.handle('main:getWords', async (event, params) => {
      return this.wordsManager.getWords(params)
    })

    // H5服务相关
    ipcMain.handle('main:startH5Server', () => {
      this.handleH5ServerStart(3, 2000)
    })

    ipcMain.handle('main:stopH5Server', () => {
      this.handleH5ServerStop()
    })

    ipcMain.handle('main:clearDownloadedAll', async () => {
      const res = await this.wallpaperManager.clearDownloadedAll()
      if (res) {
        this.sendMsg(this.mainWindow, {
          type: res.success ? 'success' : 'error',
          msg: res.msg
        })
      }
    })

    ipcMain.handle('main:clearDownloadedExpired', async () => {
      const res = await this.wallpaperManager.clearDownloadedExpired()
      if (res) {
        this.sendMsg(this.mainWindow, {
          type: res.success ? 'success' : 'error',
          msg: res.msg
        })
      }
    })
  }

  // 更新设置数据并触发变更
  async updateSettingData(data) {
    const oldData = JSON.parse(JSON.stringify(this.settingData))
    // 更新设置
    const res = await this.settingManager.updateSettingData(data)
    if (res.success) {
      const newData = JSON.parse(JSON.stringify(this.settingData))
      // 发送更新消息
      this.sendSettingDataUpdate()

      // 处理定时任务，仅当设置项发生变化时触发
      if (
        oldData.autoSwitchWallpaper !== newData.autoSwitchWallpaper ||
        oldData.switchIntervalUnit !== newData.switchIntervalUnit ||
        oldData.switchIntervalTime !== newData.switchIntervalTime
      ) {
        this.intervalSwitchWallpaper()
      }
      if (
        oldData.autoRefreshDirectory !== newData.autoRefreshDirectory ||
        oldData.refreshDirectoryIntervalUnit !== newData.refreshDirectoryIntervalUnit ||
        oldData.refreshDirectoryIntervalTime !== newData.refreshDirectoryIntervalTime
      ) {
        this.intervalRefreshDirectory()
      }
      if (
        oldData.autoDownload !== newData.autoDownload ||
        oldData.downloadIntervalUnit !== newData.downloadIntervalUnit ||
        oldData.downloadIntervalTime !== newData.downloadIntervalTime
      ) {
        this.intervalDownload()
      }
      if (oldData.autoClearDownloaded !== newData.autoClearDownloaded) {
        this.intervalClearDownloaded()
      }

      // 处理分词任务
      this.startHandleWordsTask()
      // 处理应用打包后开机自启
      this.handleStartup()
    }
    return res
  }

  // 手动切换壁纸
  async doManualSwitchWallpaper(direction) {
    // 先关闭自动切换
    await this.toggleAutoSwitchWallpaper(false)
    let ret = {
      success: false,
      msg: t('messages.operationFail')
    }
    if (direction === 'next') {
      ret = await this.wallpaperManager.doSwitchToNextWallpaper()
    } else if (direction === 'prev') {
      ret = await this.wallpaperManager.doSwitchToPrevWallpaper()
    }
    // 触发动作
    this.triggerAction('setWallpaper', ret)
    return ret
  }

  // 定时切换壁纸
  intervalSwitchWallpaper() {
    const key = 'autoSwitchWallpaper'
    // 取消之前的定时任务
    this.taskScheduler.clearTask(key)
    // 重置切换壁纸参数
    this.wallpaperManager.resetParams(key)
    // 如果开启了自动切换壁纸
    if (this.settingData[key] && !this.powerState.isSystemIdle) {
      // 设置定时切换壁纸
      this.taskScheduler.scheduleTask(key, this.handleInterval(key), async () => {
        const res = await this.wallpaperManager.doSwitchToNextWallpaper()
        // 触发动作
        this.triggerAction('setWallpaper', res)
      })
    }
  }

  // 创建网页图片
  async getWebImage(url) {
    let tempWindow = null
    try {
      const { width, height } = screen.getPrimaryDisplay().workAreaSize
      // 创建一个隐藏的窗口来加载网页
      tempWindow = new BrowserWindow({
        width,
        height,
        show: false,
        webPreferences: {
          offscreen: true // 使用离屏渲染
        }
      })

      // 加载URL
      await tempWindow.loadURL(url)

      // 等待页面完全加载
      await new Promise((resolve) => setTimeout(resolve, 2000))

      // 捕获页面截图
      const image = await tempWindow.webContents.capturePage()
      const pngData = image.toPNG()

      // 保存截图到下载文件
      const downloadFilePath = path.join(process.env.FBW_DOWNLOAD_PATH, 'wallpaper.png')
      // console.log('downloadFilePath', downloadFilePath)
      fs.writeFileSync(downloadFilePath, pngData)

      return downloadFilePath
    } catch (err) {
      global.logger.error(`获取网页图片失败: error => ${err}`)
      return null
    } finally {
      // 确保在任何情况下都销毁临时窗口
      if (tempWindow) {
        tempWindow.destroy()
        tempWindow = null
      }
    }
  }

  // 设置网页壁纸
  async setWebWallpaper(url) {
    try {
      // 先关闭自动切换
      await this.toggleAutoSwitchWallpaper(false)
      url = url || this.settingData.webWallpaperUrl
      if (!url) {
        return {
          success: false,
          msg: t('messages.urlEmpty')
        }
      }
      try {
        const urlObj = new URL(url)
        if (!['http:', 'https:'].includes(urlObj.protocol)) {
          return {
            success: false,
            msg: t('messages.invalidUrl')
          }
        }
      } catch (err) {
        return {
          success: false,
          msg: t('messages.invalidUrl')
        }
      }
      const imgPath = await this.getWebImage(url)
      if (imgPath) {
        return await this.wallpaperManager.setStaticWallpaper(imgPath)
      } else {
        return {
          success: false,
          msg: t('messages.operationFail')
        }
      }
    } catch (err) {
      global.logger.error(err)
      return {
        success: false,
        msg: t('messages.operationFail')
      }
    }
  }

  // 启停定时切换壁纸
  async toggleAutoSwitchWallpaper(val) {
    const newValue = val === undefined ? !this.settingData.autoSwitchWallpaper : val
    await this.updateSettingData({
      autoSwitchWallpaper: newValue
    })
    // 更新当前电源状态记录
    if (!this.powerState.isSystemIdle) {
      this.powerState.wasAutoSwitchEnabled = newValue
    }
  }

  // 切换悬浮球可见性
  async toggleSuspensionBallVisible(val) {
    this.updateSettingData({
      suspensionBallVisible: val == undefined ? !this.settingData.suspensionBallVisible : val
    })
  }

  // 定时刷新目录
  intervalRefreshDirectory() {
    const key = 'autoRefreshDirectory'
    // 取消之前的定时任务
    this.taskScheduler.clearTask(key)

    // 如果开启了自动刷新目录
    if (this.settingData[key]) {
      // 设置定时刷新目录
      this.taskScheduler.scheduleTask(key, this.handleInterval(key), () => {
        this.fileManager.refreshDirectory(this.locks)
      })
    }
  }

  // 定时下载壁纸
  intervalDownload() {
    const key = 'autoDownload'
    // 取消之前的定时任务
    this.taskScheduler.clearTask(key)
    // 重置下载壁纸参数
    this.wallpaperManager.resetParams(key)
    // 如果开启了自动下载壁纸
    if (this.settingData[key]) {
      // 设置定时下载壁纸
      this.taskScheduler.scheduleTask(key, this.handleInterval(key), async () => {
        await this.wallpaperManager.downloadWallpaper()
      })
    }
  }

  // 定时清理下载资源
  intervalClearDownloaded() {
    const key = 'autoClearDownloaded'
    // 取消之前的定时任务
    this.taskScheduler.clearTask(key)

    // 如果开启了自动清理下载资源
    if (this.settingData[key]) {
      // 设置定时清理过期的下载的壁纸，每小时执行一次
      this.taskScheduler.scheduleTask(key, 60 * 60 * 1000, async () => {
        await this.wallpaperManager.clearDownloadedExpired()
      })
    }
  }

  // 处理延时时间，单位毫秒
  handleInterval(key, defaultMsVal = 15 * 60 * 1000) {
    const {
      switchIntervalUnit,
      switchIntervalTime,
      refreshDirectoryIntervalUnit,
      refreshDirectoryIntervalTime,
      downloadIntervalUnit,
      downloadIntervalTime,
      clearDownloadedExpiredTime,
      clearDownloadedExpiredUnit
    } = this.settingData

    const data = {
      autoSwitchWallpaper: {
        unit: switchIntervalUnit,
        intervalTime: switchIntervalTime
      },
      autoRefreshDirectory: {
        unit: refreshDirectoryIntervalUnit,
        intervalTime: refreshDirectoryIntervalTime
      },
      autoDownload: {
        unit: downloadIntervalUnit,
        intervalTime: downloadIntervalTime
      },
      autoClearDownloaded: {
        unit: clearDownloadedExpiredUnit,
        intervalTime: clearDownloadedExpiredTime
      }
    }

    const { unit, intervalTime } = data[key] || {}

    return handleTimeByUnit(intervalTime, unit) || defaultMsVal
  }

  // 关闭应用前清理
  cleanup() {
    try {
      // 取消所有定时任务
      this.taskScheduler?.clearAllTasks()

      // 停止文件服务子进程
      if (this.fileServer) {
        try {
          this.fileServer.stop()
          this.fileServer = null
        } catch (err) {
          global.logger.error(`停止文件服务子进程失败: ${err}`)
        }
      }

      // 停止H5服务子进程
      if (this.h5Server) {
        try {
          this.h5Server.stop()
          this.h5Server = null
          this.h5ServerUrl = null
        } catch (err) {
          global.logger.error(`停止H5服务子进程失败: ${err}`)
        }
      }

      // 关闭数据库连接
      if (this.db) {
        try {
          this.db.close()
          this.db = null
        } catch (err) {
          global.logger.error(`关闭数据库连接失败: ${err}`)
        }
      }

      // 清理其他资源
      this.mainWindow = null
      this.suspensionBall = null

      // 移除电源监听器
      if (powerMonitor.removeAllListeners) {
        powerMonitor.removeAllListeners('suspend')
        powerMonitor.removeAllListeners('resume')
        powerMonitor.removeAllListeners('lock-screen')
        powerMonitor.removeAllListeners('unlock-screen')
      }

      global.logger.info('应用资源已清理完毕')
    } catch (err) {
      global.logger.error(`清理资源失败: ${err}`)
    } finally {
      // 确保这些引用被清空
      this.mainWindow = null
      this.suspensionBall = null
      this.db = null
    }
  }
}
