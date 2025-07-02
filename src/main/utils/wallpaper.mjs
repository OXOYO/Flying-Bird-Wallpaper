/**
 * 动态壁纸工具
 */
import { BrowserWindow, screen, app } from 'electron'
import { exec, execSync } from 'node:child_process'
import path from 'node:path'
import fs from 'node:fs'
import { isLinux, isMac, isWin } from './utils.mjs'

// 全局变量，用于跟踪壁纸窗口
let wallpaperWindow = null

/**
 * 设置动态壁纸
 * @param {string} videoPath - 要加载的视频文件路径
 * @returns {Promise<object>} - 返回结果对象
 */
export const setDynamicWallpaper = async (videoPath) => {
  try {
    // 如果已存在壁纸窗口，先关闭它
    if (wallpaperWindow && !wallpaperWindow.isDestroyed()) {
      wallpaperWindow.destroy()
      wallpaperWindow = null
    }

    // 获取主屏幕尺寸
    const { width, height } = screen.getPrimaryDisplay().workAreaSize

    // 创建HTML内容
    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Dynamic Wallpaper</title>
        <style>
          body, html {
            margin: 0;
            padding: 0;
            height: 100%;
            width: 100%;
            overflow: hidden;
            background-color: black;
          }
          video {
            width: 100%;
            height: 100%;
            object-fit: cover;
          }
        </style>
      </head>
      <body>
        <video autoplay loop muted>
          <source src="file://${videoPath}" type="video/mp4">
        </video>
        <script>
          const video = document.querySelector('video');
          video.play().catch(err => console.error('视频播放失败:', err));

          // 监听视频加载事件
          video.addEventListener('loadeddata', () => {
            console.log('视频加载成功');
          });

          // 监听视频错误事件
          video.addEventListener('error', (e) => {
            console.error('视频加载错误:', e);
          });
        </script>
      </body>
      </html>
    `

    // 创建临时HTML文件
    const tempDir = path.join(app.getPath('temp'), 'fbw-wallpaper')
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true })
    }
    const htmlPath = path.join(tempDir, 'wallpaper.html')
    fs.writeFileSync(htmlPath, htmlContent)

    // 窗口配置
    let options = {
      width,
      height,
      x: 0,
      y: 0,
      frame: false,
      titleBarStyle: 'hidden',
      show: false,
      backgroundColor: '#000000',
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        webSecurity: false
      }
    }

    if (isMac()) {
      // Mac系统特殊配置
      options = {
        ...options,
        transparent: true,
        hasShadow: false,
        roundedCorners: false,
        titleBarStyle: 'hidden',
        fullscreenable: true,
        alwaysOnTop: false,
        skipTaskbar: true,
        // 添加以下属性以减少窗口被系统手势控制的可能性
        focusable: false, // 窗口不可聚焦
        enableLargerThanScreen: true, // 允许窗口大于屏幕
        backgroundColor: '#000000'
      }
    } else if (isWin()) {
      // Windows系统特殊配置
      options = {
        ...options,
        transparent: true,
        fullscreen: true
      }
    }

    // 创建窗口
    wallpaperWindow = new BrowserWindow(options)

    // 监听窗口事件
    wallpaperWindow.on('ready-to-show', () => {
      console.log('壁纸窗口准备显示')
      wallpaperWindow.show()
    })

    wallpaperWindow.on('closed', () => {
      console.log('壁纸窗口已关闭')
      wallpaperWindow = null
    })

    // 加载HTML文件
    // 在加载HTML文件后添加
    await wallpaperWindow.loadFile(htmlPath)

    // 添加Mac系统特殊处理
    if (isMac()) {
      // 先显示窗口，然后再设置壁纸
      wallpaperWindow.show()
      // 延迟一段时间再设置壁纸，确保窗口已经完全显示
      await new Promise((resolve) => setTimeout(resolve, 500))
    }

    // 根据不同操作系统设置壁纸
    if (isMac()) {
      await setMacWallpaper(wallpaperWindow)
    } else if (isWin()) {
      await setWinWallpaper(wallpaperWindow)
    } else if (isLinux()) {
      await setLinuxWallpaper(wallpaperWindow)
    }

    // 在setDynamicWallpaper函数末尾，修改禁用鼠标事件的代码
    // 禁用鼠标事件，完全不接收任何鼠标事件
    wallpaperWindow.setIgnoreMouseEvents(true, { forward: false })

    return { success: true, message: '动态壁纸设置成功' }
  } catch (err) {
    global.logger.error(`创建动态壁纸失败: ${err}`)
    return { success: false, message: '动态壁纸设置失败', error: err.message }
  }
}

/**
 * 关闭动态壁纸
 * @returns {boolean} - 是否成功关闭
 */
export const closeDynamicWallpaper = () => {
  if (wallpaperWindow && !wallpaperWindow.isDestroyed()) {
    wallpaperWindow.destroy()
    wallpaperWindow = null
    return true
  }
  return false
}

/**
 * 设置macOS壁纸
 * @param {BrowserWindow} window - Electron窗口
 */
const setMacWallpaper = async (window) => {
  try {
    // 设置窗口属性
    window.setAlwaysOnTop(false)
    window.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })

    // 完全禁用所有鼠标事件，不允许任何交互
    window.setIgnoreMouseEvents(true, { forward: false })

    // 设置窗口不可聚焦，这有助于防止系统手势控制窗口
    window.setFocusable(false)

    // 先不设置全屏，等待窗口显示后再设置
    setTimeout(() => {
      if (!window.isDestroyed()) {
        window.setFullScreen(true)

        // 全屏后再次确保窗口不可聚焦和鼠标事件被禁用
        window.setFocusable(false)
        window.setIgnoreMouseEvents(true, { forward: false })
      }
    }, 500)

    // 使用更强大的AppleScript将窗口置于桌面层级并防止被控制
    const script = `
      tell application "Finder"
        activate
      end tell

      delay 0.5

      tell application "System Events"
        tell process "Electron"
          set visible to true
          -- 尝试将窗口设置为不可聚焦状态
          set attributes of window 1 to {subrole:"AXUnknown"}
        end tell
      end tell

      delay 0.5

      tell application "Finder"
        activate
      end tell
    `

    exec(`osascript -e '${script}'`, (err) => {
      if (err) {
        global.logger.error(`设置macOS壁纸失败: ${err}`)
      }
    })

    // 定期刷新窗口状态，确保窗口不被系统手势控制
    const intervalId = setInterval(() => {
      if (!window || window.isDestroyed()) {
        clearInterval(intervalId)
        return
      }

      // 确保窗口不在最上层
      window.setAlwaysOnTop(false)

      // 确保窗口不可聚焦
      window.setFocusable(false)

      // 重新禁用鼠标事件
      window.setIgnoreMouseEvents(true, { forward: false })

      // 如果窗口不是全屏，尝试重新设置全屏
      if (!window.isFullScreen()) {
        window.setFullScreen(true)
      }

      // 尝试使用AppleScript保持窗口在底层且不可聚焦
      try {
        const refreshScript = `
          tell application "System Events"
            tell process "Electron"
              set visible to true
              set attributes of window 1 to {subrole:"AXUnknown"}
            end tell
          end tell

          tell application "Finder" to activate
        `
        exec(`osascript -e '${refreshScript}'`)
      } catch (e) {
        // 忽略错误
      }
    }, 5000) // 每5秒刷新一次，频率更高以确保稳定性

    window.intervalId = intervalId

    // 监听窗口事件，确保窗口状态稳定
    window.on('blur', () => {
      // 窗口失去焦点时，确保它仍然不可聚焦
      window.setFocusable(false)
      window.setIgnoreMouseEvents(true, { forward: false })
    })

    window.on('focus', () => {
      // 窗口获得焦点时，立即让它失去焦点
      window.blur()
      window.setFocusable(false)
      window.setIgnoreMouseEvents(true, { forward: false })

      // 激活Finder以确保壁纸窗口在背景
      exec(`osascript -e 'tell application "Finder" to activate'`)
    })

    // 监听窗口全屏事件
    window.on('enter-full-screen', () => {
      console.log('壁纸窗口进入全屏模式')
      // 全屏后再次确保窗口不可聚焦和鼠标事件被禁用
      window.setFocusable(false)
      window.setIgnoreMouseEvents(true, { forward: false })
    })

    window.on('leave-full-screen', () => {
      console.log('壁纸窗口退出全屏模式')
      // 如果退出全屏，尝试重新进入全屏
      setTimeout(() => {
        if (!window.isDestroyed()) {
          window.setFullScreen(true)
          window.setFocusable(false)
          window.setIgnoreMouseEvents(true, { forward: false })
        }
      }, 500)
    })
  } catch (err) {
    global.logger.error(`设置macOS壁纸失败: ${err}`)
    throw err
  }
}

/**
 * 设置Windows壁纸
 * @param {BrowserWindow} window - Electron窗口
 */
const setWinWallpaper = async (window) => {
  try {
    // 使用koffi加载Windows API
    const koffi = require('koffi')

    // 定义Windows API
    const user32 = koffi.load('user32.dll')

    // 定义函数
    const FindWindowW = user32.func('FindWindowW', 'long', ['string', 'string'])
    const FindWindowExW = user32.func('FindWindowExW', 'long', ['long', 'long', 'string', 'string'])
    const SetParent = user32.func('SetParent', 'long', ['long', 'long'])
    const SetWindowPos = user32.func('SetWindowPos', 'bool', [
      'long',
      'long',
      'int',
      'int',
      'int',
      'int',
      'uint'
    ])

    // 获取桌面窗口句柄
    const progman = FindWindowW('Progman', null)

    // 发送特殊消息给桌面窗口
    execSync(
      `powershell -command "Add-Type -TypeDefinition 'using System;using System.Runtime.InteropServices;public class Win32 {[DllImport("user32.dll")]public static extern IntPtr SendMessageW(IntPtr hWnd, uint Msg, IntPtr wParam, IntPtr lParam);}' -Language CSharp; [Win32]::SendMessageW([IntPtr]${progman}, 0x052C, [IntPtr]0, [IntPtr]0)"`
    )

    // 查找WorkerW窗口
    let workerw = FindWindowExW(0, 0, 'WorkerW', null)
    while (workerw) {
      const shellview = FindWindowExW(workerw, 0, 'SHELLDLL_DefView', null)
      if (shellview) {
        // 找到了包含桌面图标的WorkerW
        const folderView = FindWindowExW(shellview, 0, 'SysListView32', null)
        if (folderView) {
          // 将Electron窗口设置为WorkerW的子窗口
          const hwnd = window.getNativeWindowHandle().readInt32LE(0)
          SetParent(hwnd, workerw)

          // 设置窗口位置和大小
          const HWND_BOTTOM = 1
          const SWP_NOSIZE = 0x0001
          const SWP_NOMOVE = 0x0002
          const SWP_NOACTIVATE = 0x0010

          SetWindowPos(hwnd, HWND_BOTTOM, 0, 0, 0, 0, SWP_NOSIZE | SWP_NOMOVE | SWP_NOACTIVATE)

          break
        }
      }
      workerw = FindWindowExW(0, workerw, 'WorkerW', null)
    }
  } catch (err) {
    global.logger.error(`设置Windows壁纸失败: ${err}`)
    throw err
  }
}

/**
 * 设置Linux壁纸
 * @param {BrowserWindow} window - Electron窗口
 */
const setLinuxWallpaper = async (window) => {
  try {
    // 检测桌面环境
    const desktopEnv = process.env.XDG_CURRENT_DESKTOP || ''

    if (desktopEnv.includes('GNOME')) {
      // GNOME桌面环境
      exec(
        `gdbus call --session --dest org.gnome.Shell --object-path /org/gnome/Shell --method org.gnome.Shell.Eval 'Main.layoutManager._backgroundGroup.insert_child_at_index(global.get_window_actors().find(a => a.meta_window.get_wm_class().includes("Electron")), 0)'`
      )
    } else if (desktopEnv.includes('KDE')) {
      // KDE桌面环境
      exec(
        `qdbus org.kde.KWin /KWin loweredClient ${window.getNativeWindowHandle().readInt32LE(0)}`
      )
    } else {
      // 其他桌面环境
      window.setAlwaysOnTop(false)
      window.setSkipTaskbar(true)
      window.setVisibleOnAllWorkspaces(true)
    }
  } catch (err) {
    global.logger.error(`设置Linux壁纸失败: ${err}`)
    throw err
  }
}

/**
 * 创建HTML壁纸
 * @param {string} url - 网页URL
 * @returns {Promise<string>} - 返回HTML文件路径
 */
export const createHtmlWallpaper = async (url) => {
  try {
    // 创建HTML文件
    const wallpaperHtml = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>Web Wallpaper</title>
      <style>
        body, html {
          margin: 0;
          padding: 0;
          height: 100%;
          overflow: hidden;
          background-color: transparent;
        }
        iframe {
          width: 100%;
          height: 100%;
          border: none;
        }
      </style>
    </head>
    <body>
      <iframe src="${url}" allowfullscreen></iframe>
    </body>
    </html>
    `

    const tempDir = path.join(app.getPath('temp'), 'fbw-wallpaper')
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true })
    }
    const htmlPath = path.join(tempDir, 'wallpaper.html')
    fs.writeFileSync(htmlPath, wallpaperHtml)

    return htmlPath
  } catch (err) {
    global.logger.error(`创建HTML壁纸失败: ${err}`)
    throw err
  }
}
