import path from 'node:path'
import { BrowserWindow } from 'electron'
import { isFunc } from '../utils/utils.mjs'

export default class LoadingWindow {
  // 单例实例
  static _instance = null

  // 获取单例实例
  static getInstance() {
    if (!LoadingWindow._instance) {
      LoadingWindow._instance = new LoadingWindow()
    }
    return LoadingWindow._instance
  }

  constructor() {
    if (LoadingWindow._instance) {
      return LoadingWindow._instance
    }

    this.url = path.join(process.env.FBW_RESOURCES_PATH, '/loading.html')
    this.win = null
    this.options = {
      width: 200,
      height: 200,
      minWidth: 200,
      minHeight: 200,
      show: false,
      frame: false,
      resizable: false,
      transparent: true
    }

    // 保存实例
    LoadingWindow._instance = this
  }

  create(callback) {
    if (!isFunc(callback)) {
      return
    }

    // 确保之前的窗口被清理
    this.destroy()
    // 创建新的窗口
    this.win = new BrowserWindow(this.options)

    // 设置加载超时
    const timeoutID = setTimeout(() => {
      this.destroy(callback)
    }, 10000) // 10秒超时

    if (this.win) {
      // 处理加载失败
      this.win.webContents.on('did-fail-load', () => {
        clearTimeout(timeoutID)
        this.destroy(callback)
      })

      this.win.once('show', () => {
        clearTimeout(timeoutID)
        callback()
      })

      this.win.once('ready-to-show', () => {
        this.win?.show()
      })

      // 加载动画页面
      this.win.loadFile(this.url).catch((err) => {
        global.logger.error(`加载动画页面失败: ${err}`)
        clearTimeout(timeoutID)
        this.destroy(callback)
      })
    }
  }

  close() {
    this.win?.hide()
    this.win?.close()
  }

  destroy(callback) {
    // 确保之前的窗口被清理
    if (this.win) {
      this.win.destroy()
      this.win = null
    }
    isFunc(callback) && callback()
  }
}
