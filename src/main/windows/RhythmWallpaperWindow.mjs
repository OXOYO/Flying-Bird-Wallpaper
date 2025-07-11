import path from 'node:path'
import { screen, app, BrowserWindow, ipcMain } from 'electron'
import { getWindowURL, preventContextMenu, isDev, isMac, isWin } from '../utils/utils.mjs'
import { setWindowsDynamicWallpaper } from '../utils/dynamicWallpaper.mjs'

export default class RhythmWallpaperWindow {
  // 单例实例
  static _instance = null

  // 获取单例实例
  static getInstance() {
    if (!RhythmWallpaperWindow._instance) {
      RhythmWallpaperWindow._instance = new RhythmWallpaperWindow()
    }
    return RhythmWallpaperWindow._instance
  }

  constructor() {
    if (RhythmWallpaperWindow._instance) {
      return RhythmWallpaperWindow._instance
    }

    this.url = getWindowURL('RhythmWallpaperWindow')
    this.win = null
    this.options = {
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
        allowRunningInsecureContent: true,
        devTools: true
      }
    }

    ipcMain.handle('main:openRhythmWallpaperWindow', (event) => {
      this.create()
    })

    ipcMain.handle('main:closeRhythmWallpaperWindow', (event) => {
      this.close()
    })

    // 保存实例
    RhythmWallpaperWindow._instance = this
  }

  async create() {
    return await new Promise((resolve) => {
      if (this.win) {
        this.win.show()
        resolve()
      } else {
        const { x, y, width, height } = screen.getPrimaryDisplay().bounds
        // 创建新的窗口
        this.win = new BrowserWindow({
          ...this.options,
          width: width,
          height: isMac() ? height + 40 : height,
          x,
          y
        })

        preventContextMenu(this.win)

        if (isWin()) {
          // 设置点击穿透
          this.win.setIgnoreMouseEvents(true, { forward: true })
        }

        // Mac 上设置窗口为所有工作区可见
        if (isMac()) {
          this.win.setHasShadow(false)
          this.win.setVisibleOnAllWorkspaces(true)
          this.win.setFullScreenable(false)
          // 隐藏 dock 图标
          app.dock.hide()
        }

        // 监听渲染进程console消息
        this.win.webContents.on('console-message', (event, level, message, line, sourceId) => {
          global.logger.info(`[Renderer Console][${level}] ${message} (${sourceId}:${line})`)
        })

        this.win.once('ready-to-show', async () => {
          // 设置为桌面级别
          if (isWin()) {
            // 同时设置纯色背景壁纸图片，提高视角体验
            const dynamicBackgroundColor =
              global.FBW.store?.settingData?.dynamicBackgroundColor || '#FFFFFF'
            await global.FBW.store?.wallpaperManager.setColorWallpaper(dynamicBackgroundColor)
            setWindowsDynamicWallpaper(this.win.getNativeWindowHandle().readInt32LE(0))
          }
          this.win.show()
          resolve()
        })

        this.win.on('closed', () => {
          this.win = null
          // Mac 上恢复 dock 图标
          if (isMac()) {
            app.dock.show()
          }
        })
        if (isDev()) {
          this.win.webContents.openDevTools()
          this.win.loadURL(this.url)
        } else {
          this.win.loadFile(this.url)
        }
      }
    })
  }

  close() {
    this.win?.close()
    this.win = null
  }

  destroy() {
    this.win?.destroy()
  }
}
