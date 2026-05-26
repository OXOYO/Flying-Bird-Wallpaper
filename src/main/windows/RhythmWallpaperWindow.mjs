import path from 'node:path'
import { screen, app, BrowserWindow, ipcMain } from 'electron'
import { getWindowURL, preventContextMenu, isDev, isMac, isWin } from '../utils/utils.mjs'
import { setWindowsDynamicWallpaper } from '../utils/dynamicWallpaper.mjs'
import { t } from '../../i18n/server'
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
      transparent: false,
      backgroundColor: '#000000',
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

    ipcMain.handle('main:setRhythmWallpaper', async (event) => {
      return await this.setRhythmWallpaper()
    })

    ipcMain.handle('main:closeRhythmWallpaper', (event) => {
      return this.closeRhythmWallpaper()
    })

    // 保存实例
    RhythmWallpaperWindow._instance = this
  }

  _syncWindowBounds() {
    if (!this.win) return
    const { x, y, width, height } = screen.getPrimaryDisplay().bounds
    this.win.setBounds({ x, y, width, height })
  }

  _attachToDesktopLayer() {
    if (!isWin() || !this.win) return false
    try {
      this._syncWindowBounds()
      const hwnd = this.win.getNativeWindowHandle().readInt32LE(0)
      const ok = setWindowsDynamicWallpaper(hwnd, {
        alpha: 255,
        clickThrough: true
      })
      if (!ok) {
        global.logger?.warn?.('律动壁纸: 挂到桌面层失败')
      } else {
        this._syncWindowBounds()
        if (!this.win.isVisible()) this.win.show()
      }
      return ok
    } catch (err) {
      global.logger?.error?.(`律动壁纸: 挂到桌面层异常 ${err}`)
      return false
    }
  }

  async create() {
    return await new Promise((resolve) => {
      // 关闭动态壁纸
      global.FBW.dynamicWallpaperWindow.close()
      if (this.win) {
        this.win.show()
        this._attachToDesktopLayer()
        setTimeout(() => this._attachToDesktopLayer(), 120)
        this._openDevToolsIfDev()
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
          this._attachToDesktopLayer()
          this.win.show()
          setTimeout(() => this._attachToDesktopLayer(), 120)
          setTimeout(() => this._attachToDesktopLayer(), 600)
          global.FBW.sendCommonData(this.win)
          resolve()
        })

        if (isWin()) {
          this.win.on('show', () => {
            this._attachToDesktopLayer()
          })
        }

        this.win.on('closed', () => {
          this.win = null
          // Mac 上恢复 dock 图标
          if (isMac()) {
            app.dock.show()
          }
        })
        if (isDev()) {
          this.win.loadURL(this.url)
          this.win.webContents.once('did-finish-load', () => this._openDevToolsIfDev())
        } else {
          this.win.loadFile(this.url)
        }
      }
    })
  }

  _openDevToolsIfDev() {
    if (!isDev() || !this.win?.webContents) return
    if (this.win.webContents.isDevToolsOpened()) return
    this.win.webContents.openDevTools({ mode: 'detach' })
  }

  close() {
    this.win?.close()
    this.win = null
  }

  destroy() {
    this.win?.destroy()
  }

  async setRhythmWallpaper() {
    try {
      await this.create()
      await global.FBW.store?.updateSettingData({ wallpaperType: 'rhythm' })
      return { success: true, message: t('messages.operationSuccess') }
    } catch (err) {
      global.logger.error(`打开律动壁纸窗口失败: ${err}`)
      return { success: false, message: t('messages.operationFail') }
    }
  }

  closeRhythmWallpaper() {
    this.close()
    // 更新设置数据中“壁纸类型”
    global.FBW.store?.updateSettingData({ wallpaperType: 'image' })

    return {
      success: true,
      message: t('messages.operationSuccess')
    }
  }
}
