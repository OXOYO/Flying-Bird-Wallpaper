import path from 'node:path'
import { BrowserWindow, ipcMain } from 'electron'
import { getWindowURL, preventContextMenu, isDev } from '../utils/utils.mjs'

export default class ViewImageWindow {
  // 单例实例
  static _instance = null

  // 获取单例实例
  static getInstance() {
    if (!ViewImageWindow._instance) {
      ViewImageWindow._instance = new ViewImageWindow()
    }
    return ViewImageWindow._instance
  }

  constructor() {
    if (ViewImageWindow._instance) {
      return ViewImageWindow._instance
    }

    this.url = getWindowURL('ViewImageWindow')
    this.win = null
    this.postData = null
    this.options = {
      width: 1200,
      height: 800,
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

    ipcMain.handle('main:openViewImageWindow', (event, data) => {
      this.createOrOpen(data)
    })

    ipcMain.handle('main:closeViewImageWindow', () => {
      this.close()
    })

    // 保存实例
    ViewImageWindow._instance = this
  }

  create(data) {
    this.win = new BrowserWindow(this.options)
    // 注册窗口级快捷键
    global.FBW.store.shortcutManager.registerLocalShortcuts('viewImageWindow', true)

    this.postData = data

    this.win.once('ready-to-show', () => {
      this.win.show()
      // 发送公共信息
      global.FBW.sendCommonData(this.win)
    })

    this.win.on('did-finish-load', () => {
      // 发送公共信息
      global.FBW.sendCommonData(this.win)
    })

    preventContextMenu(this.win)

    ipcMain.handle('main:getPostData', () => {
      return this.postData
    })

    this.win.on('closed', () => {
      ipcMain.removeHandler('main:getPostData')
      this.win = null
    })

    if (isDev()) {
      this.win.loadURL(this.url)
    } else {
      this.win.loadFile(this.url)
    }
  }

  close() {
    this.win?.close()
  }

  destroy() {
    // 注销窗口级快捷键
    global.FBW.store.shortcutManager.unregisterLocalShortcuts('viewImageWindow')

    this.win?.destroy()
  }

  createOrOpen(data) {
    if (this.win) {
      if (data) {
        this.postData = data
        this.win.webContents.send('main:sendPostData', data)
      }
      this.win.show()
      return
    }

    this.create(data)
  }
}
