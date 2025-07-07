import path from 'node:path'
import { BrowserWindow, ipcMain, screen } from 'electron'
import { getWindowURL, preventContextMenu, isDev, isWin, isMac } from '../utils/utils.mjs'

export default class SuspensionBall {
  // 单例实例
  static _instance = null

  // 获取单例实例
  static getInstance() {
    if (!SuspensionBall._instance) {
      SuspensionBall._instance = new SuspensionBall()
    }
    return SuspensionBall._instance
  }

  constructor() {
    if (SuspensionBall._instance) {
      return SuspensionBall._instance
    }

    this.url = getWindowURL('SuspensionBall')
    this.win = null
    this.options = {
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
        preload: path.join(__dirname, '../preload/index.mjs'),
        sandbox: false,
        webSecurity: false,
        devTools: true,
        // 禁用原生拖放
        enableDragAndDrop: false
      }
    }

    ipcMain.handle('main:openSuspensionBall', (event, params) => {
      this.open(params)
    })

    ipcMain.handle('main:closeSuspensionBall', (event, params) => {
      this.close(params)
    })

    // 保存实例
    SuspensionBall._instance = this
  }

  create() {
    this.win = new BrowserWindow(this.options)

    if (isDev()) {
      this.win.loadURL(this.url)
    } else {
      this.win.loadFile(this.url)
    }
  }

  async close(flag = true) {
    if (flag) {
      await global.FBW.store?.toggleSuspensionBallVisible(false)
    }
    this.win?.close()
  }

  destroy() {
    this.win?.destroy()
  }

  createOrOpen() {
    if (this.win) {
      this.win.show()
      return
    }

    this.create()

    // 通过获取用户屏幕的宽高来设置悬浮球的初始位置
    const { width } = screen.getPrimaryDisplay().workAreaSize
    const { left, top } = {
      left: width - 100,
      top: 200
    }
    this.win.setPosition(left, top) //设置悬浮球位置
    this.win.setVisibleOnAllWorkspaces(true) // 设置悬浮球可见于所有窗口
    if (isWin() || isMac()) {
      this.win.setSkipTaskbar(true) // 设置悬浮球不显示在任务栏
    }

    this.win.once('ready-to-show', () => {
      this.win.show()
    })

    preventContextMenu(this.win)

    this.win.on('closed', async () => {
      this.win = null
      // 关闭时更新标识
      await global.FBW.store?.toggleSuspensionBallVisible(false)
    })
  }

  async toggle() {
    await global.FBW.store?.toggleSuspensionBallVisible()
    if (!this.win) {
      this.createOrOpen()
    } else {
      if (this.win.isVisible()) {
        this.win.hide()
      } else {
        this.win.show()
        this.win.focus()
      }
    }
  }

  async open(flag = true) {
    if (flag) {
      await global.FBW.store?.toggleSuspensionBallVisible(true)
    }
    if (!this.win) {
      this.createOrOpen()
    } else {
      this.win.show()
      this.win.focus()
    }
  }
}
