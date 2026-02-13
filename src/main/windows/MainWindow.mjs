import path from 'node:path'
import { app, BrowserWindow, ipcMain, shell } from 'electron'
import { getWindowURL, preventContextMenu, isDev, isMac, isFunc } from '../utils/utils.mjs'

export default class MainWindow {
  // 单例实例
  static _instance = null

  // 获取单例实例
  static getInstance() {
    if (!MainWindow._instance) {
      MainWindow._instance = new MainWindow()
    }
    return MainWindow._instance
  }

  constructor() {
    if (MainWindow._instance) {
      return MainWindow._instance
    }

    this.url = getWindowURL('MainWindow')
    this.win = null
    this.options = {
      width: 1020,
      height: 700,
      minWidth: 1020,
      minHeight: 700,
      show: false,
      frame: false,
      backgroundColor: '#efefef',
      autoHideMenuBar: true,
      titleBarStyle: 'hidden',
      icon: global.FBW.iconLogo,
      webPreferences: {
        preload: path.join(__dirname, '../preload/index.mjs'),
        sandbox: false,
        webSecurity: false,
        contextIsolation: true,
        nodeIntegration: false,
        allowRunningInsecureContent: true,
        devTools: true
      }
    }

    ipcMain.handle('main:toggleMainWindow', () => {
      this.toggle()
    })

    // 保存实例
    MainWindow._instance = this
  }

  create(callback) {
    this.win = new BrowserWindow(this.options)

    // 注册窗口级快捷键
    global.FBW.store.shortcutManager.registerLocalShortcuts('mainWindow', true)

    if (process.platform === 'darwin') {
      app.dock.setIcon(global.FBW.iconLogo)
    }

    this.win.once('ready-to-show', () => {
      if (global.FBW.store?.settingData?.openMainWindowOnStartup) {
        global.FBW.loadingWindow.close()
        this.win.show()
        this.win.focus()
      } else {
        // 在 macOS 上隐藏 Dock 图标
        if (isMac() && app.dock) {
          app.dock.hide()
        }
      }
      // 发送公共信息
      global.FBW.sendCommonData(this.win)
      isFunc(callback) && callback()
    })

    preventContextMenu(this.win)

    this.win.on('did-finish-load', () => {
      // 发送公共信息
      global.FBW.sendCommonData(this.win)
      isFunc(callback) && callback()
    })

    this.win.on('close', (event) => {
      // 非退出时，阻止窗口关闭并隐藏主窗口
      if (!global.FBW.flags.isQuitting) {
        // 阻止默认的窗口关闭行为
        event.preventDefault()
        // 在这里执行你想要的操作，比如隐藏窗口
        this.win?.hide()

        // 在 macOS 上隐藏 Dock 图标
        if (isMac() && app.dock) {
          app.dock.hide()
        }
      }
    })

    this.win.on('closed', () => {
      this.win = null
    })

    this.win.webContents.setWindowOpenHandler((details) => {
      shell.openExternal(details.url)
      return { action: 'deny' }
    })

    // 加载应用的 index.html
    if (isDev()) {
      this.win.loadURL(this.url)
    } else {
      this.win.loadFile(this.url)
    }
  }

  destroy() {
    this.win?.destroy()
    // 注销窗口级快捷键
    global.FBW.store.shortcutManager.unregisterLocalShortcuts('mainWindow')
  }

  reopen(callback) {
    // 可以在这里执行相应的操作，例如恢复窗口的显示等
    if (!this.win || !BrowserWindow.getAllWindows().length) {
      this.create(callback)
    } else {
      // 在 macOS 上显示 Dock 图标
      if (isMac() && app.dock) {
        app.dock.show()
      }

      if (this.win.isMinimized()) {
        this.win.restore()
      }
      if (!this.win.isVisible()) {
        this.win.show()
      }
      this.win.focus()

      isFunc(callback) && callback()
    }
  }

  toggle() {
    if (!this.win || !BrowserWindow.getAllWindows().length) {
      this.create()
    } else {
      if (this.win.isVisible()) {
        this.win.hide()

        // 在 macOS 上隐藏 Dock 图标
        if (isMac() && app.dock) {
          app.dock.hide()
        }
      } else {
        // 在 macOS 上显示 Dock 图标
        if (isMac() && app.dock) {
          app.dock.show()
        }

        this.win.show()
        this.win.focus()
      }
    }
  }
}
