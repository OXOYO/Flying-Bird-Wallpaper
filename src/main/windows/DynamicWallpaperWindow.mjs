import path from 'node:path'
import { screen, app, BrowserWindow, ipcMain } from 'electron'
import { getWindowURL, preventContextMenu, isDev, isMac, isWin } from '../utils/utils.mjs'
import {
  setWindowsDynamicWallpaper,
  setWindowsDynamicWallpaperOpacity
} from '../utils/dynamicWallpaper.mjs'
import { t } from '../../i18n/server'

export default class DynamicWallpaperWindow {
  // 单例实例
  static _instance = null

  // 获取单例实例
  static getInstance() {
    if (!DynamicWallpaperWindow._instance) {
      DynamicWallpaperWindow._instance = new DynamicWallpaperWindow()
    }
    return DynamicWallpaperWindow._instance
  }

  constructor() {
    if (DynamicWallpaperWindow._instance) {
      return DynamicWallpaperWindow._instance
    }

    this.url = getWindowURL('DynamicWallpaperWindow')
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

    ipcMain.handle('main:setDynamicWallpaper', async (event, videoPath) => {
      return await this.setDynamicWallpaper(videoPath)
    })

    ipcMain.handle('main:setDynamicWallpaperMute', (event, mute) => {
      return this.setDynamicWallpaperMute(mute)
    })

    ipcMain.handle('main:checkDynamicWallpaperStatus', () => {
      return this.checkDynamicWallpaperStatus()
    })

    ipcMain.handle('main:setDynamicWallpaperPerformance', (event, mode) => {
      return this.setDynamicWallpaperPerformance(mode)
    })

    ipcMain.handle('main:setDynamicWallpaperScaleMode', (event, mode) => {
      return this.setDynamicWallpaperScaleMode(mode)
    })

    ipcMain.handle('main:setDynamicWallpaperOpacity', (event, opacity) => {
      return this.setDynamicWallpaperOpacity(opacity)
    })

    ipcMain.handle('main:setDynamicWallpaperBrightness', (event, brightness) => {
      return this.setDynamicWallpaperBrightness(brightness)
    })

    ipcMain.handle('main:setDynamicWallpaperContrast', (event, value) => {
      return this.setDynamicWallpaperContrast(value)
    })

    ipcMain.handle('main:setDynamicWallpaperBackgroundColor', async (event, color) => {
      return this.setDynamicWallpaperBackgroundColor(color)
    })

    ipcMain.handle('main:closeDynamicWallpaper', () => {
      return this.closeDynamicWallpaper()
    })

    // 保存实例
    DynamicWallpaperWindow._instance = this
  }

  async create() {
    return await new Promise((resolve) => {
      // 关闭律动壁纸
      global.FBW.rhythmWallpaperWindow.close()
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
            const dynamicBackgroundColor = global.FBW.store?.settingData?.dynamicBackgroundColor
            if (dynamicBackgroundColor) {
              await global.FBW.store?.wallpaperManager.setColorWallpaper(dynamicBackgroundColor)
            }
            setWindowsDynamicWallpaper(this.win.getNativeWindowHandle().readInt32LE(0))
          }
          this.win.show()
          // 发送公共信息
          global.FBW.sendCommonData(this.win)
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

  async setDynamicWallpaper(videoPath) {
    try {
      // 创建动态壁纸窗口
      await this.create()

      // 等待窗口准备好
      if (this.win.isVisible()) {
        this.win.webContents.send('main:setVideoSource', videoPath)
      } else {
        this.win.once('ready-to-show', () => {
          this.win.webContents.send('main:setVideoSource', videoPath)
        })
      }

      // 停止自动切换壁纸
      await global.FBW.store?.toggleAutoSwitchWallpaper(false)
      // 关闭定时刷新网页壁纸任务
      await global.FBW.store?.toggleRefreshWebWallpaperTask(false)
      // 更新设置数据中“最后视频地址”
      await global.FBW.store?.updateSettingData({
        dynamicLastVideoPath: videoPath
      })

      return { success: true, message: t('messages.operationSuccess') }
    } catch (err) {
      global.logger.error(`设置动态壁纸失败: ${err}`)
      return { success: false, message: t('messages.operationFail') }
    }
  }

  setDynamicWallpaperMute(mute) {
    if (!this.win) {
      return { success: false, message: t('messages.noDynamicWallpaperSet') }
    }

    try {
      this.win.webContents.send('main:setVideoMute', mute)
      return { success: true, message: t('messages.operationSuccess') }
    } catch (err) {
      global.logger.error(`设置动态壁纸静音状态失败: ${err}`)
      return { success: false, message: t('messages.operationFail') }
    }
  }

  checkDynamicWallpaperStatus() {
    return {
      success: true,
      data: {
        isRunning: !!this.win,
        videoPath: this.win ? global.FBW.store?.settingData?.dynamicLastVideoPath : null
      }
    }
  }

  setDynamicWallpaperPerformance(mode) {
    if (!this.win) {
      return { success: false, message: t('messages.noDynamicWallpaperSet') }
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
      this.win.webContents.send('main:setVideoFrameRate', frameRate)

      return { success: true, message: t('messages.operationSuccess') }
    } catch (err) {
      global.logger.error(`设置动态壁纸性能模式失败: ${err}`)
      return { success: false, message: t('messages.operationFail') }
    }
  }

  setDynamicWallpaperScaleMode(mode) {
    if (!this.win) {
      return { success: false, message: t('messages.noDynamicWallpaperSet') }
    }

    try {
      // 发送缩放模式设置到动态壁纸窗口
      this.win.webContents.send('main:setVideoScaleMode', mode)

      return { success: true, message: t('messages.operationSuccess') }
    } catch (err) {
      global.logger.error(`设置动态壁纸缩放模式失败: ${err}`)
      return { success: false, message: t('messages.operationFail') }
    }
  }

  setDynamicWallpaperOpacity(opacity) {
    if (!this.win) {
      return { success: false, message: t('messages.noDynamicWallpaperSet') }
    }
    try {
      // 0~100 转为 0~255
      const alpha = Math.round((opacity / 100) * 255)
      setWindowsDynamicWallpaperOpacity(this.win.getNativeWindowHandle().readInt32LE(0), alpha)
      return { success: true, message: t('messages.operationSuccess') }
    } catch (err) {
      return { success: false, message: err.message }
    }
  }

  setDynamicWallpaperBrightness(brightness) {
    if (!this.win) {
      return { success: false, message: t('messages.noDynamicWallpaperSet') }
    }

    try {
      // 发送亮度设置到动态壁纸窗口
      this.win.webContents.send('main:setVideoBrightness', brightness)

      return { success: true, message: t('messages.operationSuccess') }
    } catch (err) {
      global.logger.error(`设置动态壁纸亮度失败: ${err}`)
      return { success: false, message: t('messages.operationFail') }
    }
  }

  setDynamicWallpaperContrast(value) {
    if (!this.win) {
      return { success: false, message: t('messages.noDynamicWallpaperSet') }
    }

    try {
      // 发送对比度设置到动态壁纸窗口
      this.win.webContents.send('main:setVideoContrast', value)

      return { success: true, message: t('messages.operationSuccess') }
    } catch (err) {
      global.logger.error(`设置动态壁纸对比度失败: ${err}`)
      return { success: false, message: t('messages.operationFail') }
    }
  }

  async setDynamicWallpaperBackgroundColor(color) {
    if (!this.win) {
      return { success: false, message: t('messages.noDynamicWallpaperSet') }
    }
    try {
      return await global.FBW.store?.wallpaperManager.setColorWallpaper(color)
    } catch (err) {
      global.logger.error(`设置动态壁纸背景色失败: ${err}`)
      return { success: false, message: err.message }
    }
  }

  closeDynamicWallpaper() {
    this.close()
    return {
      success: true,
      message: t('messages.operationSuccess')
    }
  }
}
