import path from 'path'
import fs from 'fs'
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
import installExtension, { VUEJS3_DEVTOOLS } from 'electron-devtools-installer'
import localShortcut from 'electron-localshortcut'
import sharp from 'sharp'
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
  getIconPath,
  calculateImageOrientation,
  calculateImageQuality
} from './utils/utils.mjs'
import ApiBase from './ApiBase.js'
import setDynamicWallpaper from './utils/setDynamicWallpaper.mjs'
// import setMacDynamicWallpaper from './utils/setMacDynamicWallpaper.mjs'
import { t } from '../i18n/server.js'
import cache from './cache.mjs'
import { menuList, mimeTypes } from '../common/publicData'
import axios from 'axios'
import Updater from './updater.mjs'
import { appInfo } from '../common/config.js'

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

// 定义图标路径变量
const iconLogo = getIconPath('icon_512x512.png')
const iconTray = getIconPath('icon_32x32.png')

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
  // 初始化日志
  logger()
  global.logger.info(`isDev: ${isDev()} process.env.NODE_ENV: ${process.env.NODE_ENV}`)
  global.logger.info(`getIconPath FBW_RESOURCES_PATH: ${process.env.FBW_RESOURCES_PATH}`)
  global.logger.info(`getIconPath resourcesPath: ${process.resourcesPath}`)
  // 标识
  const flags = {
    isQuitting: false
  }

  // 捕获未处理的异常
  process.on('uncaughtException', (err) => {
    // 获取错误的名称、消息和堆栈信息
    const errorMessage = err.message // 错误消息
    const errorName = err.name // 错误名称
    const errorStack = err.stack // 堆栈信息
    console.log(
      `Uncaught Exception: Name => ${errorName}, Message => ${errorMessage}, Stack => ${errorStack}`
    )
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
      console.log(
        `Uncaught Rejection: Name => ${errorName}, Message => ${errorMessage}, Stack => ${errorStack}`
      )
      global.logger.warn(
        `Uncaught Rejection: Name => ${errorName}, Message => ${errorMessage}, Stack => ${errorStack}`
      )
    } else {
      console.log(`Unhandled Rejection: ${reason}`)
      // reason 不是 Error 对象时，直接打印 reason
      global.logger.warn(`Unhandled Rejection: ${reason}`)
    }
  })

  let loadingWindow
  let mainWindow
  let viewImageWindow
  let suspensionBall
  let dynamicWallpaperWindow = null
  let store
  let tray
  let updater

  // 加载动画页面地址
  const loadingURL = `${path.join(process.env.FBW_RESOURCES_PATH, '/loading.html')}`
  const getWindowURL = (name) => {
    let url = isDev()
      ? `${process.env['ELECTRON_RENDERER_URL']}/windows/${name}/index.html`
      : `${path.join(__dirname, `../renderer/windows/${name}/index.html`)}`
    return url
  }
  // 窗口根地址
  const MainWindowURL = getWindowURL('MainWindow')
  const ViewImageWindowURL = getWindowURL('ViewImageWindow')
  const SuspensionBallURL = getWindowURL('SuspensionBall')
  const DynamicWallpaperURL = getWindowURL('DynamicWallpaper')

  const showLoading = (callback) => {
    if (!isFunc(callback)) {
      return
    }

    // 确保之前的 loadingWindow 被清理
    if (loadingWindow) {
      loadingWindow.destroy()
      loadingWindow = null
    }

    loadingWindow = new BrowserWindow({
      width: 200,
      height: 200,
      minWidth: 200,
      minHeight: 200,
      show: false,
      frame: false,
      resizable: false,
      transparent: true
    })

    // 设置加载超时
    const timeout = setTimeout(() => {
      if (loadingWindow) {
        loadingWindow.destroy()
        loadingWindow = null
        callback() // 超时后仍然执行回调
      }
    }, 10000) // 10秒超时

    // 处理加载失败
    loadingWindow.webContents.on('did-fail-load', () => {
      clearTimeout(timeout)
      if (loadingWindow) {
        loadingWindow.destroy()
        loadingWindow = null
        callback() // 加载失败后仍然执行回调
      }
    })

    loadingWindow.once('show', () => {
      clearTimeout(timeout)
      callback()
    })

    loadingWindow.once('ready-to-show', () => {
      if (loadingWindow) {
        loadingWindow.show()
      }
    })

    // 加载动画页面
    loadingWindow.loadFile(loadingURL).catch((err) => {
      global.logger.error(`加载动画页面失败: ${err}`)
      clearTimeout(timeout)
      if (loadingWindow) {
        loadingWindow.destroy()
        loadingWindow = null
        callback() // 加载失败后仍然执行回调
      }
    })
  }

  // 窗口通用配置
  const commonWindowOptions = {
    width: 1020,
    height: 700,
    minWidth: 1020,
    minHeight: 700,
    show: false,
    frame: false,
    // FIXME 设置 transparent: true 后会导致窗口最大化按钮不可用
    // transparent: true,
    backgroundColor: '#efefef',
    autoHideMenuBar: true,
    titleBarStyle: 'hidden',
    // titleBarOverlay: {
    //   color: 'transparent',
    //   height: 35,
    //   symbolColor: 'rgb(96, 98, 102)'
    // },
    // ...(process.platform === 'linux' ? { icon: iconLogo } : {}),
    icon: iconLogo,
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.mjs'),
      sandbox: false,
      webSecurity: false,
      // devTools: isDev()
      devTools: true
    }
  }

  // 创建主窗口
  const createMainWindow = (callback) => {
    // 创建浏览器窗口
    mainWindow = new BrowserWindow({
      ...commonWindowOptions,
      width: 1020,
      height: 700,
      minWidth: 1020,
      minHeight: 700
    })

    store?.setMainWindow(mainWindow)

    if (process.platform === 'darwin') {
      app.dock.setIcon(iconLogo)
    }

    mainWindow.once('ready-to-show', () => {
      if (store?.settingData?.openMainWindowOnStartup) {
        if (loadingWindow) {
          loadingWindow.hide()
          loadingWindow.close()
        }
        mainWindow.show()
        mainWindow.focus()
      } else {
        // 在 macOS 上隐藏 Dock 图标
        if (isMac() && app.dock) {
          app.dock.hide()
        }
      }
      // 发送公共信息
      sendCommonData(mainWindow)
      isFunc(callback) && callback()
    })

    preventContextMenu(mainWindow)

    mainWindow.on('did-finish-load', () => {
      // 发送公共信息
      sendCommonData(mainWindow)
      isFunc(callback) && callback()
    })

    mainWindow.on('close', (event) => {
      // 非退出时，阻止窗口关闭并隐藏主窗口
      if (!flags.isQuitting) {
        // 阻止默认的窗口关闭行为
        event.preventDefault()
        // 在这里执行你想要的操作，比如隐藏窗口
        mainWindow && mainWindow.hide()

        // 在 macOS 上隐藏 Dock 图标
        if (isMac() && app.dock) {
          app.dock.hide()
        }
      }
    })

    mainWindow.on('closed', () => {
      mainWindow = null
      store?.setMainWindow(null)
    })

    mainWindow.webContents.setWindowOpenHandler((details) => {
      shell.openExternal(details.url)
      return { action: 'deny' }
    })

    // 加载应用的 index.html
    if (isDev()) {
      mainWindow.loadURL(MainWindowURL)
    } else {
      mainWindow.loadFile(MainWindowURL)
    }
  }

  // 重新打开主窗口
  const reopenMainWindow = (callback) => {
    // 可以在这里执行相应的操作，例如恢复窗口的显示等
    if (!mainWindow || !BrowserWindow.getAllWindows().length) {
      createMainWindow(callback)
    } else {
      // 在 macOS 上显示 Dock 图标
      if (isMac() && app.dock) {
        app.dock.show()
      }

      isFunc(callback) && callback()
      if (mainWindow.isMinimized()) {
        mainWindow.restore()
      }
      if (!mainWindow.isVisible()) {
        mainWindow.show()
      }
      mainWindow.focus()
    }
  }
  // 切换主窗口显示隐藏
  const toggleMainWindow = () => {
    if (!mainWindow || !BrowserWindow.getAllWindows().length) {
      createMainWindow()
    } else {
      if (mainWindow.isVisible()) {
        mainWindow.hide()

        // 在 macOS 上隐藏 Dock 图标
        if (isMac() && app.dock) {
          app.dock.hide()
        }
      } else {
        // 在 macOS 上显示 Dock 图标
        if (isMac() && app.dock) {
          app.dock.show()
        }

        mainWindow.show()
        mainWindow.focus()
      }
    }
  }

  // 阻止窗口右键菜单事件
  const preventContextMenu = (win) => {
    if (!win) {
      return
    }
    win.webContents.on('context-menu', (event) => {
      event.preventDefault() // 阻止默认右键菜单行为
    })
    if (isWin()) {
      // 监听 278 消息，关闭因为css: -webkit-app-region: drag 引起的默认右键菜单
      win.hookWindowMessage(278, () => {
        // 阻止默认的窗口关闭行为
        win.setEnabled(false)
        setTimeout(() => {
          win.setEnabled(true)
        }, 100)
        return true
      })
    }
  }

  // 获取窗口位置
  const getWindowPosition = (name) => {
    const win = { mainWindow, viewImageWindow, suspensionBall }[name]
    if (win) {
      const [x, y] = win.getPosition()
      return { x, y }
    }
    return null
  }

  // 设置窗口位置
  const setWindowPosition = (name, position) => {
    const win = { mainWindow, viewImageWindow, suspensionBall }[name]
    if (win) {
      win.setPosition(parseInt(position.x), parseInt(position.y), false)
      // 如果是悬浮球，确保大小不变
      if (name === 'suspensionBall') {
        win.setSize(60, 220, false)
      }
    }
  }

  // 创建预览图片窗口
  const createOrOpenViewImageWindow = (data) => {
    if (viewImageWindow) {
      if (data) {
        viewImageWindow.webContents.send('main:sendPostData', data)
      }
      viewImageWindow.show()
      return
    }

    viewImageWindow = new BrowserWindow({
      ...commonWindowOptions,
      width: 1200,
      height: 800
    })

    if (isDev()) {
      viewImageWindow.loadURL(ViewImageWindowURL)
    } else {
      viewImageWindow.loadFile(ViewImageWindowURL)
    }

    viewImageWindow.on('ready-to-show', () => {
      viewImageWindow.show()
      // 发送公共信息
      sendCommonData(viewImageWindow)
    })

    viewImageWindow.on('did-finish-load', () => {
      // 发送公共信息
      sendCommonData(viewImageWindow)
    })

    preventContextMenu(viewImageWindow)

    ipcMain.handle('main:getPostData', () => {
      return data
    })

    viewImageWindow.on('closed', () => {
      ipcMain.removeHandler('main:getPostData')
      viewImageWindow = null
    })
  }

  // 创建悬浮球口
  const createOrOpenSuspensionBall = () => {
    if (suspensionBall) {
      suspensionBall.show()
      return
    }
    // 处理窗口配置
    suspensionBall = new BrowserWindow({
      ...commonWindowOptions,
      width: 60,
      height: 220,
      minWidth: 60,
      minHeight: 220,
      maxWidth: 60, // 添加最大宽度限制
      maxHeight: 220, // 添加最大高度限制
      frame: false,
      resizable: false,
      show: false,
      transparent: true,
      backgroundColor: '#00000000',
      titleBarStyle: false,
      hasShadow: false,
      alwaysOnTop: true,
      acceptFirstMouse: true, // 添加此配置，使窗口能立即响应鼠标事件
      webPreferences: {
        ...commonWindowOptions.webPreferences,
        // 禁用原生拖放
        enableDragAndDrop: false
      }
    })

    // 通过获取用户屏幕的宽高来设置悬浮球的初始位置
    const { width } = screen.getPrimaryDisplay().workAreaSize
    const { left, top } = {
      left: width - 100,
      top: 200
    }
    suspensionBall.setPosition(left, top) //设置悬浮球位置
    suspensionBall.setVisibleOnAllWorkspaces(true) // 设置悬浮球可见于所有窗口
    if (isWin() || isMac()) {
      suspensionBall.setSkipTaskbar(true) // 设置悬浮球不显示在任务栏
    }

    store?.setSuspensionBall(suspensionBall)

    if (isDev()) {
      suspensionBall.loadURL(SuspensionBallURL)
    } else {
      suspensionBall.loadFile(SuspensionBallURL)
    }

    suspensionBall.on('ready-to-show', () => {
      suspensionBall.show()
    })

    preventContextMenu(suspensionBall)

    suspensionBall.on('closed', async () => {
      suspensionBall = null
      store?.setSuspensionBall(null)
      // 关闭时更新标识
      await store?.toggleSuspensionBallVisible(false)
    })
  }

  // 切换悬浮球显示隐藏
  const toggleSuspensionBall = async () => {
    await store?.toggleSuspensionBallVisible()
    if (!suspensionBall) {
      createOrOpenSuspensionBall()
    } else {
      if (suspensionBall.isVisible()) {
        suspensionBall.hide()
      } else {
        suspensionBall.show()
        suspensionBall.focus()
      }
    }
  }

  // 打开悬浮球
  const openSuspensionBall = async (flag = true) => {
    if (flag) {
      await store?.toggleSuspensionBallVisible(true)
    }
    if (!suspensionBall) {
      createOrOpenSuspensionBall()
    } else {
      suspensionBall.show()
      suspensionBall.focus()
    }
  }

  // 关闭悬浮球
  const closeSuspensionBall = async (flag = true) => {
    if (flag) {
      await store?.toggleSuspensionBallVisible(false)
    }
    if (suspensionBall) {
      suspensionBall.close()
    }
  }

  // 创建动态壁纸窗口
  const createDynamicWallpaperWindow = () => {
    if (dynamicWallpaperWindow) {
      dynamicWallpaperWindow.show()
      return dynamicWallpaperWindow
    }

    const { x, y, width, height } = screen.getPrimaryDisplay().bounds
    dynamicWallpaperWindow = new BrowserWindow({
      width: width,
      height: isMac() ? height + 40 : height,
      x,
      y,
      frame: false,
      show: false,
      transparent: true,
      skipTaskbar: true,
      type: isMac() ? 'desktop' : '',
      autoHideMenuBar: true,
      enableLargerThanScreen: true,
      hasShadow: false,
      webPreferences: {
        preload: path.join(__dirname, '../preload/index.mjs'),
        sandbox: false,
        webSecurity: false,
        contextIsolation: true,
        nodeIntegration: false,
        allowRunningInsecureContent: true
      }
    })

    if (isDev()) {
      dynamicWallpaperWindow.loadURL(DynamicWallpaperURL)
    } else {
      dynamicWallpaperWindow.loadFile(DynamicWallpaperURL)
    }

    preventContextMenu(dynamicWallpaperWindow)

    // Mac 上设置窗口为所有工作区可见
    if (isMac()) {
      dynamicWallpaperWindow.setHasShadow(false)
      dynamicWallpaperWindow.setVisibleOnAllWorkspaces(true)
      dynamicWallpaperWindow.setFullScreenable(false)
      // 隐藏 dock 图标
      app.dock.hide()
    }

    dynamicWallpaperWindow.once('ready-to-show', () => {
      // 设置为桌面级别
      if (isWin()) {
        setDynamicWallpaper(dynamicWallpaperWindow.getNativeWindowHandle().readInt32LE(0))
      }
      dynamicWallpaperWindow.show()
    })

    dynamicWallpaperWindow.on('closed', () => {
      dynamicWallpaperWindow = null
      // Mac 上恢复 dock 图标
      if (isMac()) {
        app.dock.show()
      }
    })

    return dynamicWallpaperWindow
  }

  // 关闭动态壁纸窗口
  const closeDynamicWallpaperWindow = () => {
    if (dynamicWallpaperWindow) {
      dynamicWallpaperWindow.close()
      dynamicWallpaperWindow = null
      return true
    }
    return false
  }

  const handleJumpToPage = (key) => {
    if (!key) {
      return
    }
    reopenMainWindow(() => {
      mainWindow.webContents.send('main:jumpToPage', key)
    })
  }

  const sendCommonData = (win) => {
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
      h5ServerUrl: store?.h5ServerUrl
    }
    win.webContents.send('main:commonData', data)
  }

  const sendMsg = (win, msgOption) => {
    if (!win) {
      return
    }
    win.webContents.send('main:sendMsg', msgOption)
  }

  // 创建托盘
  const createTray = () => {
    const trayIcon = nativeImage.createFromPath(iconTray).resize({ width: 20, height: 20 })
    trayIcon.setTemplateImage(true) // 设置为模板图标

    tray = new Tray(trayIcon)

    tray.setToolTip(t('appInfo.name'))

    // 监听托盘图标点击事件
    tray.on('click', () => {
      toggleMainWindow()
    })
    // 监听托盘图标点击事件右键点击事件
    tray.on('right-click', () => {
      // 托盘右键菜单
      const contextMenuList = [
        {
          label: store?.settingData?.autoSwitchWallpaper
            ? t('actions.autoSwitchWallpaper.stop')
            : t('actions.autoSwitchWallpaper.start'),
          click: () => {
            store?.toggleAutoSwitchWallpaper()
          }
        },
        {
          label: t('actions.nextWallpaper'),
          click: () => {
            store?.doManualSwitchWallpaper('next')
          }
        },
        {
          label: t('actions.prevWallpaper'),
          click: () => {
            store?.doManualSwitchWallpaper('prev')
          }
        },
        {
          label: store?.settingData?.suspensionBallVisible
            ? t('actions.closeSuspensionBall')
            : t('actions.openSuspensionBall'),
          click: () => {
            toggleSuspensionBall()
          }
        }
      ]
      contextMenuList.push({
        type: 'separator'
      })
      // 动态计算托盘菜单启用的菜单项
      // let enabledMenuList = menuList
      // if (
      //   Array.isArray(store?.settingData?.enabledMenus) &&
      //   store?.settingData?.enabledMenus.length
      // ) {
      //   enabledMenuList = menuList.filter((item) => {
      //     if (item.canBeEnabled) {
      //       return store?.settingData?.enabledMenus.includes(item.name)
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
            // “检查更新”功能
            updater.checkUpdate()
          }
        },
        {
          type: 'separator'
        },
        {
          label: t('actions.quit'),
          click: () => {
            flags.isQuitting = true
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

  const closeViewImageWindow = () => {
    if (viewImageWindow) {
      viewImageWindow.close()
    }
  }

  const resizeWindow = (windowName, action) => {
    let _window = null
    switch (windowName) {
      case 'mainWindow':
        _window = mainWindow
        break
      case 'viewImageWindow':
        _window = viewImageWindow
        break
    }
    if (_window) {
      switch (action) {
        case 'minimize':
          _window.minimize()
          break
        case 'maximize':
          if (_window.isMaximized()) {
            _window.unmaximize()
          } else {
            _window.maximize()
          }
          break
        case 'unmaximize':
          _window.unmaximize()
          break
        case 'restore':
          _window.restore()
          break
        case 'close':
          _window.close()
          break
      }
    }
  }

  // 处理自定义协议
  const handleProtocol = () => {
    protocol.handle('fbwtp', async (request) => {
      let T1, T2, T3, T4
      T1 = Date.now()

      // 使用不带query的url作为缓存的key
      const [cacheKey, queryStr] = request.url.split('?')
      let url = cacheKey.replace(/^fbwtp:\/\//, '') // 去除自定义协议前缀
      // 处理 Windows 上的绝对路径（例如 'E:/xx/yy'）
      if (process.platform === 'win32') {
        url = url.replace(/\//g, '\\') // 将所有斜杠替换为反斜杠
        // 修复丢失的冒号（:），假设路径是 e\xx\yy 应该是 e:\xx\yy
        url = url.replace(/^([a-zA-Z])\\/, '$1:\\') // 在盘符后面补上冒号
      } else {
        // macOS 和 Linux 确保是绝对路径
        if (!url.startsWith('/')) {
          url = '/' + url
        }
      }

      const filePath = decodeURIComponent(url)
      // 获取宽高参数，例如 "w=800&h=600"
      const query = new URLSearchParams(queryStr)
      const w = query.get('w')
      // 定义默认图片尺寸
      const width = w ? parseInt(w, 10) : null
      try {
        // 检查缓存
        if (cache.has(cacheKey)) {
          const cacheData = cache.get(cacheKey)
          // 返回文件内容和 MIME 类型
          return new Response(cacheData.data, {
            status: 200,
            headers: {
              ...cacheData.headers,
              'Server-Timing': `cache-hit;dur=${Date.now() - T1}`
            }
          })
        }
        T2 = Date.now()

        const stats = await fs.promises.stat(filePath) // 获取文件大小
        const originalFileSize = stats.size
        const extension = path.extname(filePath).toLowerCase()
        const mimeType = mimeTypes[extension] || 'application/octet-stream'
        T3 = Date.now()

        // 读取文件并处理
        let fileBuffer
        // 只对图片进行调整大小，视频文件直接读取
        // 文件大小超过指定大小才进行调整，单位bytes
        const limitSize = 5 * 1024 * 1024
        if (
          ['.png', '.jpg', '.jpeg', '.avif', '.webp', '.gif'].includes(extension) &&
          width &&
          originalFileSize > limitSize
        ) {
          fileBuffer = await sharp(filePath)
            .resize({
              width,
              fit: 'inside', // 保持宽高比
              withoutEnlargement: true, // 避免放大小图片
              kernel: 'lanczos3', // 使用最好的缩放算法
              fastShrinkOnLoad: true // 启用快速缩小
            })
            .toBuffer()
        } else {
          fileBuffer = await fs.promises.readFile(filePath)
        }
        const fileSize = fileBuffer.length.toString()
        T4 = Date.now()

        const headers = {
          'Accept-Ranges': 'bytes',
          'Content-Type': mimeType,
          'Original-Size': originalFileSize,
          'Content-Length': fileSize,
          'Compressed-Size': fileSize,
          'Cache-Control': 'max-age=3600',
          ETag: `"${stats.mtimeMs}-${originalFileSize}"`,
          'Last-Modified': stats.mtime.toUTCString(),
          'Server-Timing': `file-check;dur=${T2 - T1}, file-stat;dur=${T3 - T2}, resize;dur=${T4 - T3}, total;dur=${T4 - T1}`,
          'X-File-Check-Time': T2 - T1 + 'ms',
          'X-File-Stat-Time': T3 - T2 + 'ms',
          'X-Resize-Time': T4 - T3 + 'ms',
          'X-Total-Time': T4 - T1 + 'ms'
        }
        // 缓存文件内容
        cache.set(cacheKey, {
          data: fileBuffer,
          headers
        })
        // 返回文件内容
        return new Response(fileBuffer, {
          status: 200,
          headers
        })
      } catch (err) {
        global.logger.error(
          `File not found: url => ${url}, filePath => ${filePath}, error => ${err}`
        )
        return new Response('', { status: 404 })
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
      if (mainWindow) {
        if (mainWindow.isMinimized()) {
          mainWindow.restore()
        }
        if (!mainWindow.isVisible()) {
          mainWindow.show()
        }
        mainWindow.focus()
      }
    })

    app.on('browser-window-created', (_, window) => {
      optimizer.watchWindowShortcuts(window)
    })

    app.on('before-quit', async () => {
      mainWindow = null
      viewImageWindow = null
      store = null
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
        installExtension(VUEJS3_DEVTOOLS)
          .then((name) => console.log(`Added Extension:  ${name}`))
          .catch((err) => console.log('An error occurred: ', err))

        // 使用 webContents 捕获自定义协议，用于在devtools中调试
        webContents.getAllWebContents().forEach((wc) => {
          // 启用调试器
          try {
            wc.debugger.attach('1.3') // 指定 DevTools 调试协议版本
          } catch (err) {
            console.error('Debugger attach failed:', err)
          }

          // 监听调试器消息
          wc.debugger.on('message', (event, method, params) => {
            if (method === 'Network.requestWillBeSent') {
              console.log('Request URL:', params.request.url)
            }
            if (method === 'Network.responseReceived') {
              console.log('Response:', params.response)
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
          mainWindow.webContents.selectAll()
        })
        localShortcut.register('CommandOrControl+C', () => {
          mainWindow.webContents.copy()
        })
        localShortcut.register('CommandOrControl+V', () => {
          mainWindow.webContents.paste()
        })
      }

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

      ipcMain.handle('main:openViewImageWindow', (event, data) => {
        createOrOpenViewImageWindow(data)
      })

      ipcMain.handle('main:setWindowPosition', (event, name, position) => {
        setWindowPosition(name, position)
      })

      ipcMain.handle('main:getWindowPosition', (event, name) => {
        return getWindowPosition(name)
      })

      ipcMain.handle('main:toggleMainWindow', () => {
        toggleMainWindow()
      })

      ipcMain.handle('main:openSuspensionBall', (event, params) => {
        openSuspensionBall(params)
      })

      ipcMain.handle('main:closeSuspensionBall', (event, params) => {
        closeSuspensionBall(params)
      })

      ipcMain.handle('main:showItemInFolder', (event, filePath) => {
        showItemInFolder(filePath)
      })

      ipcMain.handle('main:closeViewImageWindow', () => {
        closeViewImageWindow()
      })

      ipcMain.handle('main:resizeWindow', (event, windowName, action) => {
        resizeWindow(windowName, action)
      })

      ipcMain.handle('main:clearCache', () => {
        cache.clear()
        sendMsg(mainWindow, {
          type: 'success',
          msg: t('messages.clearCacheSuccess')
        })
      })

      ipcMain.handle('main:selectVideoFile', async () => {
        const { canceled, filePaths } = await dialog.showOpenDialog({
          properties: ['openFile'],
          filters: [{ name: 'Videos', extensions: ['mp4', 'webm', 'ogg', 'mov'] }]
        })

        if (canceled || !filePaths.length) {
          return { success: false, msg: '未选择文件' }
        }

        return { success: true, data: filePaths[0] }
      })

      ipcMain.handle('main:setDynamicWallpaper', async (event, videoPath) => {
        try {
          // 创建动态壁纸窗口
          const win = createDynamicWallpaperWindow()

          // 等待窗口准备好
          if (win.isVisible()) {
            win.webContents.send('main:setVideoSource', videoPath)
          } else {
            win.once('ready-to-show', () => {
              win.webContents.send('main:setVideoSource', videoPath)
            })
          }

          return { success: true, msg: '设置动态壁纸成功' }
        } catch (err) {
          global.logger.error(`设置动态壁纸失败: ${err}`)
          return { success: false, msg: '设置动态壁纸失败' }
        }
      })

      ipcMain.handle('main:setDynamicWallpaperMute', (event, mute) => {
        if (!dynamicWallpaperWindow) {
          return { success: false, msg: '没有正在运行的动态壁纸' }
        }

        try {
          dynamicWallpaperWindow.webContents.send('main:setVideoMute', mute)
          return { success: true, msg: '设置静音状态成功' }
        } catch (err) {
          global.logger.error(`设置动态壁纸静音状态失败: ${err}`)
          return { success: false, msg: '设置静音状态失败' }
        }
      })

      ipcMain.handle('main:checkDynamicWallpaperStatus', () => {
        return {
          success: true,
          data: {
            isRunning: !!dynamicWallpaperWindow,
            videoPath: dynamicWallpaperWindow ? store.settingData?.dynamicLastVideoPath : null
          }
        }
      })

      ipcMain.handle('main:setDynamicWallpaperPerformance', (event, mode) => {
        if (!dynamicWallpaperWindow) {
          return { success: false, msg: '没有正在运行的动态壁纸' }
        }

        try {
          // 根据性能模式设置帧率限制
          let frameRate = 60 // 默认帧率

          switch (mode) {
            case 'high':
              frameRate = 60
              break
            case 'balanced':
              frameRate = 30
              break
            case 'powersave':
              frameRate = 15
              break
          }

          // 发送帧率设置到动态壁纸窗口
          dynamicWallpaperWindow.webContents.send('main:setVideoFrameRate', frameRate)

          return { success: true, msg: '设置性能模式成功' }
        } catch (err) {
          global.logger.error(`设置动态壁纸性能模式失败: ${err}`)
          return { success: false, msg: '设置性能模式失败' }
        }
      })

      ipcMain.handle('main:setDynamicWallpaperScaleMode', (event, mode) => {
        if (!dynamicWallpaperWindow) {
          return { success: false, msg: '没有正在运行的动态壁纸' }
        }

        try {
          // 发送缩放模式设置到动态壁纸窗口
          dynamicWallpaperWindow.webContents.send('main:setVideoScaleMode', mode)

          return { success: true, msg: '设置缩放模式成功' }
        } catch (err) {
          global.logger.error(`设置动态壁纸缩放模式失败: ${err}`)
          return { success: false, msg: '设置缩放模式失败' }
        }
      })

      ipcMain.handle('main:setDynamicWallpaperBrightness', (event, value) => {
        if (!dynamicWallpaperWindow) {
          return { success: false, msg: '没有正在运行的动态壁纸' }
        }

        try {
          // 发送亮度设置到动态壁纸窗口
          dynamicWallpaperWindow.webContents.send('main:setVideoBrightness', value)

          return { success: true, msg: '设置亮度成功' }
        } catch (err) {
          global.logger.error(`设置动态壁纸亮度失败: ${err}`)
          return { success: false, msg: '设置亮度失败' }
        }
      })

      ipcMain.handle('main:setDynamicWallpaperContrast', (event, value) => {
        if (!dynamicWallpaperWindow) {
          return { success: false, msg: '没有正在运行的动态壁纸' }
        }

        try {
          // 发送对比度设置到动态壁纸窗口
          dynamicWallpaperWindow.webContents.send('main:setVideoContrast', value)

          return { success: true, msg: '设置对比度成功' }
        } catch (err) {
          global.logger.error(`设置动态壁纸对比度失败: ${err}`)
          return { success: false, msg: '设置对比度失败' }
        }
      })

      ipcMain.handle('main:closeDynamicWallpaper', () => {
        const result = closeDynamicWallpaperWindow()
        return { success: result, msg: result ? '关闭动态壁纸成功' : '没有正在运行的动态壁纸' }
      })

      // 处理fbwtp://协议
      handleProtocol()
      // 初始化Store
      store = new Store({
        sendCommonData,
        sendMsg
      })
      // 等待 Store 初始化完成
      await store.waitForInitialization()

      // 如果设置了自动播放动态壁纸
      if (store.settingData?.dynamicAutoPlayOnStartup && store.settingData?.dynamicLastVideoPath) {
        // 创建动态壁纸窗口并设置上次的视频
        const win = createDynamicWallpaperWindow()
        win.once('ready-to-show', () => {
          win.webContents.send('main:setVideoSource', store.settingData.dynamicLastVideoPath)
        })
      }

      // 创建托盘
      createTray()
      // 启动时打开主窗口
      if (process.argv.includes('--autoStart')) {
        // 开机自启动时，根据设置决定是否显示窗口
        if (store?.settingData?.openMainWindowOnStartup) {
          showLoading(createMainWindow)
        } else {
          createMainWindow()
        }
      } else {
        createMainWindow()
      }
      // 启动时开启悬浮球
      if (store?.settingData?.suspensionBallVisible) {
        createOrOpenSuspensionBall()
      }

      app.on('activate', () => {
        if (!BrowserWindow.getAllWindows().length || !mainWindow) {
          createMainWindow()
        } else {
          mainWindow.show()
          mainWindow.focus()
        }
      })
    })
  }
})()
