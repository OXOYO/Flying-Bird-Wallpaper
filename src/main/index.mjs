import path from 'node:path'
import {
  app,
  Tray,
  Menu,
  shell,
  BrowserWindow,
  ipcMain,
  dialog,
  protocol,
  screen,
  webContents,
  nativeImage,
  Notification
} from 'electron'
import { electronApp, optimizer } from '@electron-toolkit/utils'
import installExtension, { VUEJS_DEVTOOLS_BETA } from 'electron-devtools-installer'
import localShortcut from 'electron-localshortcut'
import logger from './logger.mjs'
import Store from './store/index.mjs'
import {
  osType,
  isLinux,
  isMac,
  isWin,
  isProd,
  isDev,
  isFunc,
  getDirPathByName,
  calculateImageOrientation,
  calculateImageQuality,
  getIconPath
} from './utils/utils.mjs'
import { handleFileResponse } from './utils/file.mjs'
import ApiBase from './ApiBase.js'
// import setMacDynamicWallpaper from './utils/setMacDynamicWallpaper.mjs'
import { t } from '../i18n/server.js'
import cache from './cache.mjs'
import { menuList } from '../common/publicData.js'
import axios from 'axios'
import Updater from './updater.mjs'
import { appInfo } from '../common/config.js'
import LoadingWindow from './windows/LoadingWindow.mjs'
import MainWindow from './windows/MainWindow.mjs'
import ViewImageWindow from './windows/ViewImageWindow.mjs'
import SuspensionBall from './windows/SuspensionBall.mjs'
import DynamicWallpaperWindow from './windows/DynamicWallpaperWindow.mjs'
import RhythmWallpaperWindow from './windows/RhythmWallpaperWindow.mjs'

const userDataPath = app.getPath('userData')
// 目录
process.env.FBW_USER_DATA_PATH = userDataPath
process.env.FBW_LOGS_PATH = getDirPathByName(userDataPath, 'logs')
process.env.FBW_DATABASE_PATH = getDirPathByName(userDataPath, 'database')
process.env.FBW_DATABASE_FILE_PATH = path.join(process.env.FBW_DATABASE_PATH, 'fbw.db')
process.env.FBW_DOWNLOAD_PATH = getDirPathByName(userDataPath, 'download')
process.env.FBW_CERTS_PATH = getDirPathByName(userDataPath, 'certs')
process.env.FBW_PLUGINS_PATH = getDirPathByName(userDataPath, 'plugins')
process.env.FBW_TEMP_PATH = getDirPathByName(userDataPath, 'temp')
// 获取资源路径，开发环境下使用项目根目录下的资源，生产环境下使用 resources 目录下的资源
process.env.FBW_RESOURCES_PATH = app.isPackaged
  ? path.join(process.resourcesPath, 'resources')
  : path.join(__dirname, '../../resources')

// 在 app.whenReady() 之前
protocol.registerSchemesAsPrivileged([
  {
    scheme: 'fbwtp',
    privileges: {
      bypassCSP: true,
      secure: true,
      standard: true,
      supportFetchAPI: true,
      allowServiceWorkers: true,
      stream: true
    }
  }
])

// 启用 GPU 渲染，减少 CPU 解码压力
app.commandLine.appendSwitch('enable-gpu-rasterization')
app.commandLine.appendSwitch('enable-oop-rasterization')
;(async () => {
  // 全局变量
  global.FBW = global.FBW || {}
  // 导出API开发所需的工具和基类
  global.FBW.apiHelpers = {
    axios,
    ApiBase,
    calculateImageOrientation,
    calculateImageQuality
  }

  // 定义图标路径变量
  global.FBW.iconLogo = getIconPath('icon_512x512.png')
  global.FBW.iconTray = getIconPath('icon_32x32.png')

  // 初始化日志
  logger()
  global.logger.info(`isDev: ${isDev()} process.env.NODE_ENV: ${process.env.NODE_ENV}`)
  global.logger.info(`getIconPath FBW_RESOURCES_PATH: ${process.env.FBW_RESOURCES_PATH}`)
  global.logger.info(`getIconPath resourcesPath: ${process.resourcesPath}`)
  // 标识
  global.FBW.flags = {
    isQuitting: false
  }

  // 捕获未处理的异常
  process.on('uncaughtException', (err) => {
    // 获取错误的名称、消息和堆栈信息
    const errorMessage = err.message // 错误消息
    const errorName = err.name // 错误名称
    const errorStack = err.stack // 堆栈信息
    // 打印详细错误信息
    global.logger.error(
      `Uncaught Exception: Name => ${errorName}, Message => ${errorMessage}, Stack => ${errorStack}`
    )
  })

  // 捕获未处理的 Promise 拒绝
  process.on('unhandledRejection', (reason) => {
    if (reason instanceof Error) {
      // reason 是 Error 对象时，打印详细错误信息
      const errorName = reason.name
      const errorMessage = reason.message
      const errorStack = reason.stack
      global.logger.warn(
        `Uncaught Rejection: Name => ${errorName}, Message => ${errorMessage}, Stack => ${errorStack}`
      )
    } else {
      // reason 不是 Error 对象时，直接打印 reason
      global.logger.warn(`Unhandled Rejection: ${reason}`)
    }
  })

  global.FBW.loadingWindow = LoadingWindow.getInstance()
  global.FBW.mainWindow = MainWindow.getInstance()
  global.FBW.viewImageWindow = ViewImageWindow.getInstance()
  global.FBW.suspensionBall = SuspensionBall.getInstance()
  global.FBW.dynamicWallpaperWindow = DynamicWallpaperWindow.getInstance()
  global.FBW.rhythmWallpaperWindow = RhythmWallpaperWindow.getInstance()
  let tray
  let updater

  // 获取窗口位置
  const getWindowPosition = (name) => {
    const window = global.FBW[name]
    const win = window?.win
    if (win) {
      const [x, y] = win.getPosition()
      return { x, y }
    }
    return null
  }

  // 设置窗口位置
  const setWindowPosition = (name, position) => {
    const window = global.FBW[name]
    const win = window?.win
    if (win) {
      win.setPosition(parseInt(position.x), parseInt(position.y), false)
      // 如果是悬浮球，确保大小不变
      if (name === 'suspensionBall') {
        win.setSize(60, 220, false)
      }
    }
  }

  const resizeWindow = (name, action) => {
    const window = global.FBW[name]
    const win = window?.win
    if (win) {
      switch (action) {
        case 'minimize':
          win.minimize()
          break
        case 'maximize':
          if (win.isMaximized()) {
            win.unmaximize()
          } else {
            win.maximize()
          }
          break
        case 'unmaximize':
          win.unmaximize()
          break
        case 'restore':
          win.restore()
          break
        case 'close':
          win.close()
          break
      }
    }
  }

  const handleJumpToPage = (key) => {
    if (!key) {
      return
    }
    global.FBW.mainWindow.reopen(() => {
      global.FBW.mainWindow.win.webContents.send('main:jumpToPage', key)
    })
  }

  global.FBW.sendCommonData = (win) => {
    if (!win) {
      return
    }
    const data = {
      osType,
      isLinux: isLinux(),
      isMac: isMac(),
      isWin: isWin(),
      isDev: isDev(),
      isProd: isProd(),
      h5ServerUrl: global.FBW.store?.h5ServerUrl
    }
    win.webContents.send('main:commonData', data)
  }

  global.FBW.sendMsg = (win, msgOption) => {
    if (!win) {
      return
    }
    win.webContents.send('main:sendMsg', msgOption)
  }

  // 创建托盘
  const createTray = () => {
    const trayIcon = nativeImage
      .createFromPath(global.FBW.iconTray)
      .resize({ width: 20, height: 20 })
    trayIcon.setTemplateImage(true) // 设置为模板图标

    tray = new Tray(trayIcon)

    tray.setToolTip(t('appInfo.name'))

    // 监听托盘图标点击事件
    tray.on('click', () => {
      global.FBW.mainWindow.toggle()
    })
    // 监听托盘图标点击事件右键点击事件
    tray.on('right-click', () => {
      // 托盘右键菜单
      const contextMenuList = [
        {
          label: global.FBW.store?.settingData?.autoSwitchWallpaper
            ? t('actions.autoSwitchWallpaper.stop')
            : t('actions.autoSwitchWallpaper.start'),
          click: () => {
            global.FBW.store?.toggleAutoSwitchWallpaper()
          }
        },
        {
          label: t('actions.nextWallpaper'),
          click: () => {
            global.FBW.store?.doManualSwitchWallpaper('next')
          }
        },
        {
          label: t('actions.prevWallpaper'),
          click: () => {
            global.FBW.store?.doManualSwitchWallpaper('prev')
          }
        },
        {
          label: global.FBW.store?.settingData?.suspensionBallVisible
            ? t('actions.closeSuspensionBall')
            : t('actions.openSuspensionBall'),
          click: () => {
            global.FBW.suspensionBall.toggle()
          }
        }
      ]
      contextMenuList.push({
        type: 'separator'
      })
      // 动态计算托盘菜单启用的菜单项
      // let enabledMenuList = menuList
      // if (
      //   Array.isArray(global.FBW.store?.settingData?.enabledMenus) &&
      //   global.FBW.store?.settingData?.enabledMenus.length
      // ) {
      //   enabledMenuList = menuList.filter((item) => {
      //     if (item.canBeEnabled) {
      //       return global.FBW.store?.settingData?.enabledMenus.includes(item.name)
      //     }
      //     return true
      //   })
      // }
      // 菜单子项
      const enabledMenuChildren = []
      // 功能菜单
      const trayFuncMenuList = []
      menuList.forEach((item) => {
        if (item.placement.includes('trayMenuChildren')) {
          enabledMenuChildren.push({
            // FIXME 拼接空格，防止菜单项宽度过短
            label: t(item.locale).padEnd(20, ' '),
            click: () => handleJumpToPage(item.name)
          })
        } else if (item.placement.includes('trayFuncMenu')) {
          trayFuncMenuList.push({
            label: t(item.locale),
            click: () => handleJumpToPage(item.name)
          })
        }
      })
      if (enabledMenuChildren.length) {
        contextMenuList.push({
          label: t('actions.menu'),
          submenu: enabledMenuChildren
        })
        contextMenuList.push({
          type: 'separator'
        })
      }
      if (trayFuncMenuList.length) {
        contextMenuList.push(...trayFuncMenuList, {
          type: 'separator'
        })
      }
      // 其他菜单项
      contextMenuList.push(
        {
          label: `Version: ${app.getVersion()}`,
          // 禁用该项
          enabled: false
        },
        {
          label: t('actions.checkUpdate'),
          click: () => {
            // "检查更新"功能
            updater.checkUpdate()
          }
        },
        {
          type: 'separator'
        },
        {
          label: t('actions.quit'),
          click: () => {
            global.FBW.flags.isQuitting = true
            app.quit()
          }
        }
      )
      const contextMenu = Menu.buildFromTemplate(contextMenuList)
      tray.popUpContextMenu(contextMenu)
    })
  }

  const showItemInFolder = (filePath) => {
    shell.showItemInFolder(filePath)
  }

  // 处理自定义协议
  const handleProtocol = () => {
    protocol.handle('fbwtp', async (request) => {
      const urlObj = new URL(request.url)
      const filePath = urlObj.searchParams.get('filePath')
      switch (urlObj.pathname) {
        // 处理图片请求
        case '/api/images/get': {
          const w = urlObj.searchParams.get('w')
          const h = urlObj.searchParams.get('h')

          const res = await handleFileResponse({ filePath, w, h })
          return new Response(res.data, {
            status: res.status,
            headers: res.headers
          })
        }
        case '/api/videos/get': {
          const res = await handleFileResponse({ filePath })
          console.log('api/videos/get', filePath, res.status)
          return new Response(res.data, {
            status: res.status,
            headers: res.headers
          })
        }
      }
    })
  }

  // 确保单实例
  const gotTheLock = app.requestSingleInstanceLock()

  if (!gotTheLock) {
    // 如果没拿到锁，直接退出当前实例
    app.quit()
  } else {
    app.on('second-instance', () => {
      // 当运行第二个实例时，这里将会被调用
      global.FBW.mainWindow.reopen()
    })

    app.on('browser-window-created', (_, window) => {
      optimizer.watchWindowShortcuts(window)
    })

    app.on('before-quit', async () => {
      global.logger.info('APP BEFORE QUIT!')
    })

    app.on('window-all-closed', () => {
      if (process.platform !== 'darwin') {
        app.quit()
      }
    })

    // 初始化
    app.whenReady().then(async () => {
      if (isDev()) {
        // 安装vue-devtools
        installExtension(VUEJS_DEVTOOLS_BETA)
          .then(({ name }) => global.logger.info(`Added Extension:  ${name}`))
          .catch((err) => global.logger.error(`An error occurred: ${err}`))

        // 使用 webContents 捕获自定义协议，用于在devtools中调试
        webContents.getAllWebContents().forEach((wc) => {
          // 启用调试器
          try {
            wc.debugger.attach('1.3') // 指定 DevTools 调试协议版本
          } catch (err) {
            global.logger.error(`Debugger attach failed: ${err}`)
          }

          // 监听调试器消息
          wc.debugger.on('message', (event, method, params) => {
            if (method === 'Network.requestWillBeSent') {
              global.logger.info(`Request URL: ${params.request.url}`)
            }
            if (method === 'Network.responseReceived') {
              global.logger.info(`Response: ${params.response}`)
            }
          })

          // 启用网络事件捕获
          wc.debugger.sendCommand('Network.enable')
        })
      }

      // 检查更新
      updater = new Updater()
      // 绑定事件
      updater.on('update-available', (info) => {
        global.logger.info('有可用更新', info)
        // 显示系统通知
        const notice = new Notification({
          title: t('actions.checkUpdate'),
          body: t('messages.updateAvailable', {
            version: `v${info.version}`
          })
        })
        notice.on('click', () => {
          // 打开更新页面
          shell.openExternal(appInfo.github + '/releases')
        })
        notice.show()
      })
      updater.on('update-not-available', (info) => {
        global.logger.info('无需更新', info)
        // 显示系统通知
        new Notification({
          title: t('actions.checkUpdate'),
          body: t('messages.updateNotAvailable')
        }).show()
      })
      updater.on('error', (err) => {
        global.logger.error(`更新失败： error => ${err}`)
        // 显示系统通知
        new Notification({
          title: t('actions.checkUpdate'),
          body: t('messages.checkUpdateFail')
        }).show()
      })

      electronApp.setAppUserModelId('co.oxoyo.flying-bird-wallpaper')

      // FIXME 清空菜单
      const menu = Menu.buildFromTemplate([])
      Menu.setApplicationMenu(menu)

      // 清空任务栏
      if (isWin()) {
        app.setUserTasks([])
      }

      // 注册快捷键
      if (isMac()) {
        localShortcut.register('CommandOrControl+A', () => {
          global.FBW.mainWindow.win.webContents.selectAll()
        })
        localShortcut.register('CommandOrControl+C', () => {
          global.FBW.mainWindow.win.webContents.copy()
        })
        localShortcut.register('CommandOrControl+V', () => {
          global.FBW.mainWindow.win.webContents.paste()
        })
      }

      ipcMain.handle('main:sendNotification', async (event, options) => {
        const notice = new Notification({
          title: options.title || t('appInfo.name'),
          body: options.body || '',
          icon: global.FBW.iconLogo,
          silent: options.silent || false
        })

        if (options.onClick) {
          notice.on('click', options.onClick)
        }

        notice.show()
        return { success: true }
      })

      ipcMain.handle('main:selectFolder', async () => {
        return await dialog.showOpenDialog({
          properties: ['openDirectory']
        })
      })

      ipcMain.handle('main:selectFile', async (event, type) => {
        const filters = []
        if (type === 'image') {
          filters.push({ name: 'Images', extensions: ['jpg', 'png', 'gif'] })
        } else if (type === 'video') {
          filters.push({ name: 'Movies', extensions: ['mp4'] })
        }
        return await dialog.showOpenDialog({
          properties: ['openFile'],
          filters
        })
      })

      ipcMain.handle('main:openDir', (event, dirName) => {
        const dirPath = getDirPathByName(userDataPath, dirName)
        shell.openPath(dirPath)
      })

      ipcMain.handle('main:openUrl', (event, url) => {
        shell.openExternal(url)
      })

      ipcMain.handle('main:setWindowPosition', (event, name, position) => {
        setWindowPosition(name, position)
      })

      ipcMain.handle('main:getWindowPosition', (event, name) => {
        return getWindowPosition(name)
      })

      ipcMain.handle('main:resizeWindow', (event, name, action) => {
        resizeWindow(name, action)
      })

      ipcMain.handle('main:showItemInFolder', (event, filePath) => {
        showItemInFolder(filePath)
      })

      ipcMain.handle('main:clearCache', () => {
        cache.clear()
        global.FBW.sendMsg(global.FBW.mainWindow.win, {
          type: 'success',
          message: t('messages.clearCacheSuccess')
        })
      })

      ipcMain.handle('main:selectVideoFile', async () => {
        const { canceled, filePaths } = await dialog.showOpenDialog({
          properties: ['openFile'],
          filters: [{ name: 'Videos', extensions: ['mp4', 'webm', 'ogg', 'mov'] }]
        })

        if (canceled || !filePaths.length) {
          return { success: false, message: t('messages.noFileSelected') }
        }

        return { success: true, data: filePaths[0] }
      })

      // 处理自定义协议
      handleProtocol()
      // 初始化Store
      global.FBW.store = new Store()
      // 等待 Store 初始化完成
      await global.FBW.store?.waitForInitialization()

      // 如果设置了自动播放动态壁纸
      if (
        global.FBW.store?.settingData?.dynamicAutoPlayOnStartup &&
        global.FBW.store?.settingData?.dynamicLastVideoPath
      ) {
        // 创建动态壁纸窗口并设置上次的视频
        global.FBW.dynamicWallpaperWindow?.setDynamicWallpaper(
          global.FBW.store?.settingData?.dynamicLastVideoPath
        )
      }

      // 创建托盘
      createTray()
      // 启动时打开主窗口
      if (process.argv.includes('--autoStart')) {
        // 开机自启动时，根据设置决定是否显示窗口
        if (global.FBW.store?.settingData?.openMainWindowOnStartup) {
          global.FBW.loadingWindow.create(global.FBW.mainWindow.create)
        } else {
          global.FBW.mainWindow.create()
        }
      } else {
        global.FBW.mainWindow.create()
      }
      // 启动时开启悬浮球
      if (global.FBW.store?.settingData?.suspensionBallVisible) {
        global.FBW.suspensionBall.createOrOpen()
      }

      app.on('activate', () => {
        global.FBW.mainWindow.reopen()
      })
    })
  }
})()
