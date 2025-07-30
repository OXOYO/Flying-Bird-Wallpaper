# 动态壁纸

动态壁纸功能允许用户将视频文件设置为桌面壁纸，通过创建特殊的透明窗口来播放视频，实现桌面背景的动态效果。该功能支持多种视频格式，提供丰富的控制选项，并在不同操作系统上采用不同的实现策略。

---

## 实现原理

### 1. 核心思路

动态壁纸的实现原理是通过创建一个全屏的透明窗口，在窗口内播放视频，并将该窗口设置为桌面级别，使其显示在桌面图标和壁纸之间。整个过程包括：

1. **窗口创建**：创建全屏透明窗口
2. **视频播放**：在窗口内播放视频文件
3. **窗口定位**：将窗口设置为桌面级别
4. **交互处理**：实现点击穿透，不影响桌面操作

### 2. 技术架构

```
用户选择视频 → 渲染进程 → IPC → 主进程 → DynamicWallpaperWindow → 创建透明窗口 → 视频播放 → 系统API → 桌面动态壁纸
```

### 3. 操作系统差异

**Windows 实现：**

- 使用 `koffi` 库调用 Windows API
- 通过 `user32.dll` 实现窗口嵌入桌面
- 支持透明度调节和点击穿透

**macOS 实现：**

- 使用 Electron 的 `desktop` 窗口类型
- 设置窗口为所有工作区可见
- 隐藏 dock 图标

**Linux 实现：**

- 使用标准的透明窗口
- 依赖窗口管理器的支持

---

## 核心功能实现

### 1. 动态壁纸窗口管理

**DynamicWallpaperWindow 单例模式：**

```js:src/main/windows/DynamicWallpaperWindow.mjs
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
  }
}
```

### 2. 窗口创建与配置

**create 方法实现：**

```js:src/main/windows/DynamicWallpaperWindow.mjs
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
    }
  })
}
```

### 3. 动态壁纸设置

**setDynamicWallpaper 方法：**

```js:src/main/windows/DynamicWallpaperWindow.mjs
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
    // 更新设置数据中"最后视频地址"
    await global.FBW.store?.updateSettingData({
      dynamicLastVideoPath: videoPath
    })

    return { success: true, message: t('messages.operationSuccess') }
  } catch (err) {
    global.logger.error(`设置动态壁纸失败: ${err}`)
    return { success: false, message: t('messages.operationFail') }
  }
}
```

### 4. WallpaperManager 集成

**WallpaperManager 中的动态壁纸设置：**

```js:src/main/store/WallpaperManager.mjs
// 设置动态壁纸
async setDynamicWallpaper(videoPath) {
  if (!videoPath || !fs.existsSync(videoPath)) {
    return {
      success: false,
      message: t('messages.fileNotExist')
    }
  }

  try {
    // 调用动态壁纸设置功能
    const res = await global.FBW.dynamicWallpaperWindow?.setDynamicWallpaper(videoPath)
    if (res?.success) {
      return {
        success: true,
        message: t('messages.setDynamicWallpaperSuccess')
      }
    } else {
      return {
        success: false,
        message: res?.message || t('messages.setDynamicWallpaperFail')
      }
    }
  } catch (err) {
    this.logger.error(`设置动态壁纸失败: error => ${err}`)
    return {
      success: false,
      message: t('messages.setDynamicWallpaperFail')
    }
  }
}

// 关闭视频壁纸
closeDynamicWallpaper() {
  try {
    global.FBW.dynamicWallpaperWindow?.closeDynamicWallpaper()
    // 清理"最后视频地址"
    global.FBW.store?.updateSettingData({
      dynamicLastVideoPath: ''
    })
    return {
      success: false,
      message: t('messages.operationSuccess')
    }
  } catch (err) {
    return {
      success: false,
      message: t('messages.operationFail')
    }
  }
}
```

---

## Windows 系统实现

### 1. Windows API 调用

**setWindowsDynamicWallpaper 函数：**

```js
export const setWindowsDynamicWallpaper = (handlers) => {
  if (!handlers || process.platform !== 'win32') return false
  const lib = koffi.load('user32.dll')

  const FindWindowW = lib.func('FindWindowW', 'int32', ['string', 'string'])
  const SendMessageTimeoutW = lib.func('SendMessageTimeoutW', 'int32', [
    'int32',
    'int32',
    'int32',
    'int32',
    'int32',
    'int32',
    'int32'
  ])
  const FindWindowExW = lib.func('FindWindowExW', 'int32', ['int32', 'int32', 'string', 'int32'])
  const SetParent = lib.func('SetParent', 'int32', ['int32', 'int32'])
  const IsWindowVisible = lib.func('IsWindowVisible', 'bool', ['int32'])
  const ShowWindow = lib.func('ShowWindow', 'bool', ['int32', 'int32'])
  const SetWindowPos = lib.func('SetWindowPos', 'bool', [
    'int32',
    'int32',
    'int32',
    'int32',
    'int32',
    'int32',
    'uint32'
  ])
  const SetLayeredWindowAttributes = lib.func('SetLayeredWindowAttributes', 'bool', [
    'int32',
    'uint32',
    'uint8',
    'uint32'
  ])
  const HWND_BOTTOM = 1
  const SWP_NOSIZE = 0x0001
  const SWP_NOMOVE = 0x0002
  const SWP_NOACTIVATE = 0x0010
  const SetWindowLongPtrW = lib.func('SetWindowLongPtrW', 'int32', ['int32', 'int32', 'int32'])
  const GWL_STYLE = -16
  const WS_CHILD = 0x40000000
  const GWL_EXSTYLE = -20
  const WS_EX_LAYERED = 0x00080000
  const WS_EX_TRANSPARENT = 0x00000020
  const GetWindowLongPtrW = lib.func('GetWindowLongPtrW', 'int32', ['int32', 'int32'])

  // 要触发在桌面图标和墙纸之间创建WorkerW窗口，我们必须向程序管理器发送一条消息
  const progman = FindWindowW(TEXT('Progman'), null)

  // 该消息是未记录的消息，因此没有专用的Windows API名称，除了0x052C
  SendMessageTimeoutW(
    progman,
    0x052c, // 在程序管理器上生成墙纸工作程序的未记录消息
    0,
    0,
    0x0000,
    1000,
    0
  )

  const callback = (tophandle) => {
    // 找到一个具有SHELLDLL_DefView的Windows
    const SHELLDLL_DefView = FindWindowExW(tophandle, 0, TEXT('SHELLDLL_DefView'), 0)
    if (SHELLDLL_DefView !== 0) {
      // 这里的 tophandle 就是正确的 WorkerW
      SetParent(handlers, tophandle)
    }
    return true
  }

  // 注册一个回调函数指针
  const callbackProto2 = koffi.proto('__stdcall', 'callbackProto2', 'bool', ['int32', 'int32'])
  const EnumWindows = lib.func('EnumWindows', 'bool', [koffi.pointer(callbackProto2), 'int32'])
  EnumWindows(callback, 0)

  // 设置为子窗口样式
  SetWindowLongPtrW(handlers, GWL_STYLE, WS_CHILD)

  // 设置窗口扩展样式为 WS_EX_LAYERED | WS_EX_TRANSPARENT，实现点击穿透
  let exStyle = GetWindowLongPtrW(handlers, GWL_EXSTYLE)
  exStyle = exStyle | WS_EX_LAYERED | WS_EX_TRANSPARENT
  SetWindowLongPtrW(handlers, GWL_EXSTYLE, exStyle)

  // 设置窗口为半透明（50% 透明度）
  SetLayeredWindowAttributes(handlers, 0, 128, LWA_ALPHA)

  // 调整 Z 顺序
  SetWindowPos(handlers, HWND_BOTTOM, 0, 0, 0, 0, SWP_NOSIZE | SWP_NOMOVE | SWP_NOACTIVATE)

  return true
}
```

### 2. Windows 透明度控制

**setWindowsDynamicWallpaperOpacity 函数：**

```js
export const setWindowsDynamicWallpaperOpacity = (hwnd, alpha) => {
  const lib = koffi.load('user32.dll')
  const SetLayeredWindowAttributes = lib.func('SetLayeredWindowAttributes', 'bool', [
    'int32',
    'uint32',
    'uint8',
    'uint32'
  ])
  SetLayeredWindowAttributes(hwnd, 0, alpha, LWA_ALPHA)
}
```

### 3. Windows 实现原理

**WorkerW 窗口嵌入：**

1. **查找 Progman 窗口**：使用 `FindWindowW` 查找程序管理器窗口
2. **发送特殊消息**：向 Progman 发送 `0x052C` 消息，触发创建 WorkerW 窗口
3. **枚举窗口**：使用 `EnumWindows` 枚举所有窗口，找到包含 `SHELLDLL_DefView` 的 WorkerW 窗口
4. **设置父窗口**：使用 `SetParent` 将动态壁纸窗口设置为 WorkerW 的子窗口
5. **设置窗口样式**：设置 `WS_CHILD` 样式和 `WS_EX_LAYERED | WS_EX_TRANSPARENT` 扩展样式
6. **调整 Z 顺序**：将窗口置于最底层，确保不影响桌面操作

---

## macOS 系统实现

### 1. 窗口类型设置

**macOS 特殊配置：**

```js
this.options = {
  frame: false,
  show: false,
  transparent: true,
  skipTaskbar: true,
  type: isMac() ? 'desktop' : '', // macOS 使用 desktop 类型
  autoHideMenuBar: true,
  enableLargerThanScreen: true,
  hasShadow: false
  // ... 其他配置
}
```

### 2. 工作区可见性

**设置窗口为所有工作区可见：**

```js
if (isMac()) {
  this.win.setHasShadow(false)
  this.win.setVisibleOnAllWorkspaces(true) // 所有工作区可见
  this.win.setFullScreenable(false)
  // 隐藏 dock 图标
  app.dock.hide()
}
```

### 3. Dock 图标管理

**隐藏和恢复 Dock 图标：**

```js
// 窗口创建时隐藏 dock 图标
if (isMac()) {
  app.dock.hide()
}

// 窗口关闭时恢复 dock 图标
this.win.on('closed', () => {
  this.win = null
  // Mac 上恢复 dock 图标
  if (isMac()) {
    app.dock.show()
  }
})
```

---

## 渲染进程实现

### 1. 视频播放组件

**DynamicWallpaperWindow.vue 核心实现：**

```vue
<script setup>
const videoSrc = ref('')
const videoRef = ref(null)
const isMuted = ref(true) // 默认静音
const frameRate = ref(30) // 默认帧率
const scaleMode = ref('cover') // 默认缩放模式
const brightness = ref(100) // 默认亮度
const contrast = ref(100) // 默认对比度
let rafId = null // requestAnimationFrame ID
let lastFrameTime = 0 // 上一帧时间

// 接收视频源
const handleSetVideoSource = (event, source) => {
  if (source) {
    // 将本地文件路径转换为 fbwtp 协议 URL
    if (!source.startsWith('fbwtp://') && !source.startsWith('http')) {
      // 替换反斜杠为正斜杠，并确保路径格式正确
      const formattedPath = source.replace(/\\/g, '/')
      videoSrc.value = `fbwtp://fbw/api/videos/get?filePath=${formattedPath}`
    } else {
      videoSrc.value = source
    }
  }
}

// 处理静音控制
const handleSetVideoMute = (event, mute) => {
  isMuted.value = mute
  if (videoRef.value) {
    videoRef.value.muted = mute
  }
}

// 处理帧率控制
const handleSetVideoFrameRate = (event, rate) => {
  frameRate.value = rate
}

// 控制视频播放帧率
const controlFrameRate = (timestamp) => {
  if (!videoRef.value) {
    rafId = requestAnimationFrame(controlFrameRate)
    return
  }

  try {
    const video = videoRef.value
    const frameInterval = 1000 / frameRate.value

    if (timestamp - lastFrameTime >= frameInterval) {
      // 如果视频暂停，则播放
      if (video.paused) {
        video.play()
      }

      lastFrameTime = timestamp
    } else {
      // 如果帧率需要限制，则暂停视频
      if (!video.paused) {
        video.pause()
      }
    }

    rafId = requestAnimationFrame(controlFrameRate)
  } catch (err) {
    console.error(err)
  }
}

// 处理缩放模式控制
const handleSetVideoScaleMode = (event, mode) => {
  scaleMode.value = mode
}

// 处理亮度控制
const handleSetVideoBrightness = (event, value) => {
  brightness.value = value
}

// 处理对比度控制
const handleSetVideoContrast = (event, value) => {
  contrast.value = value
}

// 计算滤镜样式
const filterStyle = computed(() => {
  return `brightness(${brightness.value / 100}) contrast(${contrast.value / 100})`
})

// 监听视频源变化
watch(videoSrc, (newSrc) => {
  if (newSrc) {
    // 重置帧率控制
    if (rafId) {
      cancelAnimationFrame(rafId)
    }
    lastFrameTime = 0
    rafId = requestAnimationFrame(controlFrameRate)
  }
})

// 监听事件注册和移除需要保持一致
onMounted(() => {
  // 监听设置视频源事件
  window.FBW.onSetVideoSource(handleSetVideoSource)
  window.FBW.onSetVideoMute(handleSetVideoMute)
  window.FBW.onSetVideoFrameRate(handleSetVideoFrameRate)
  window.FBW.onSetVideoScaleMode(handleSetVideoScaleMode)
  window.FBW.onSetVideoBrightness(handleSetVideoBrightness)
  window.FBW.onSetVideoContrast(handleSetVideoContrast)

  // 启动帧率控制
  rafId = requestAnimationFrame(controlFrameRate)
})

onBeforeUnmount(() => {
  // 移除监听，确保与注册方式一致
  window.FBW.offSetVideoSource(handleSetVideoSource)
  window.FBW.offSetVideoMute(handleSetVideoMute)
  window.FBW.offSetVideoFrameRate(handleSetVideoFrameRate)
  window.FBW.offSetVideoScaleMode(handleSetVideoScaleMode)
  window.FBW.offSetVideoBrightness(handleSetVideoBrightness)
  window.FBW.offSetVideoContrast(handleSetVideoContrast)

  // 取消帧率控制
  if (rafId) {
    cancelAnimationFrame(rafId)
  }
})
</script>

<template>
  <div class="window-container">
    <video
      v-if="videoSrc"
      ref="videoRef"
      :src="videoSrc"
      autoplay
      loop
      :muted="isMuted"
      class="video-player"
      :style="{
        objectFit: scaleMode === 'stretch' ? 'fill' : scaleMode,
        filter: filterStyle
      }"
    ></video>
  </div>
</template>

<style scoped>
.window-container {
  width: 100vw;
  height: 100vh;
  overflow: hidden;
  margin: 0;
  padding: 0;
  background-color: transparent;
}

.video-player {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
</style>
```

### 2. 视频协议处理

**本地文件路径转换：**

```js
// 将本地文件路径转换为 fbwtp 协议 URL
if (!source.startsWith('fbwtp://') && !source.startsWith('http')) {
  // 替换反斜杠为正斜杠，并确保路径格式正确
  const formattedPath = source.replace(/\\/g, '/')
  videoSrc.value = `fbwtp://fbw/api/videos/get?filePath=${formattedPath}`
} else {
  videoSrc.value = source
}
```

### 3. 帧率控制算法

**requestAnimationFrame 帧率控制：**

```js
const controlFrameRate = (timestamp) => {
  if (!videoRef.value) {
    rafId = requestAnimationFrame(controlFrameRate)
    return
  }

  try {
    const video = videoRef.value
    const frameInterval = 1000 / frameRate.value

    if (timestamp - lastFrameTime >= frameInterval) {
      // 如果视频暂停，则播放
      if (video.paused) {
        video.play()
      }

      lastFrameTime = timestamp
    } else {
      // 如果帧率需要限制，则暂停视频
      if (!video.paused) {
        video.pause()
      }
    }

    rafId = requestAnimationFrame(controlFrameRate)
  } catch (err) {
    console.error(err)
  }
}
```

---

## 控制功能实现

### 1. 性能模式设置

**setDynamicWallpaperPerformance 方法：**

```js
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
```

### 2. 缩放模式控制

**setDynamicWallpaperScaleMode 方法：**

```js
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
    return { success: false, message: t('messages.operationSuccess') }
  }
}
```

### 3. 透明度控制

**setDynamicWallpaperOpacity 方法：**

```js
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
```

### 4. 亮度和对比度控制

**setDynamicWallpaperBrightness 方法：**

```js
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
```

### 5. 背景色控制

**setDynamicWallpaperBackgroundColor 方法：**

```js
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
```

---

## 进程间通信

### 1. IPC 处理器注册

**DynamicWallpaperWindow 构造函数中的 IPC 处理：**

```js
constructor() {
  // ... 其他代码

  ipcMain.handle('main:setDynamicWallpaper', async (event, videoPath) => {
    return this.setDynamicWallpaper(videoPath)
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
}
```

### 2. 预加载脚本 API

**preload/index.mjs 中的动态壁纸 API：**

```js
const api = {
  // 动态壁纸相关API
  selectVideoFile: () => ipcRenderer.invoke('main:selectVideoFile'),
  setDynamicWallpaper: (...args) => ipcRenderer.invoke('main:setDynamicWallpaper', ...args),
  closeDynamicWallpaper: (...args) => ipcRenderer.invoke('main:closeDynamicWallpaper', ...args),
  // 设置动态壁纸静音状态
  setDynamicWallpaperMute: (...args) => ipcRenderer.invoke('main:setDynamicWallpaperMute', ...args),
  // 检查动态壁纸状态
  checkDynamicWallpaperStatus: () => ipcRenderer.invoke('main:checkDynamicWallpaperStatus'),
  // 设置动态壁纸性能模式
  setDynamicWallpaperPerformance: (mode) =>
    ipcRenderer.invoke('main:setDynamicWallpaperPerformance', mode),
  // 设置动态壁纸缩放模式
  setDynamicWallpaperScaleMode: (mode) =>
    ipcRenderer.invoke('main:setDynamicWallpaperScaleMode', mode),
  // 设置动态壁纸背景色
  setDynamicWallpaperBackgroundColor: (value) =>
    ipcRenderer.invoke('main:setDynamicWallpaperBackgroundColor', value),
  // 设置动态壁纸透明度
  setDynamicWallpaperOpacity: (value) =>
    ipcRenderer.invoke('main:setDynamicWallpaperOpacity', value),
  // 设置动态壁纸亮度
  setDynamicWallpaperBrightness: (value) =>
    ipcRenderer.invoke('main:setDynamicWallpaperBrightness', value),
  // 设置动态壁纸对比度
  setDynamicWallpaperContrast: (value) =>
    ipcRenderer.invoke('main:setDynamicWallpaperContrast', value)
}
```

---

## 用户界面集成

### 1. 工具页面集成

**Utils.vue 中的动态壁纸设置：**

```js
const onSetDynamicWallpaper = async () => {
  const selectFileRes = await window.FBW.selectFile('video')
  const videoPath = selectFileRes && !selectFileRes.canceled ? selectFileRes.filePaths[0] : null
  if (!videoPath) {
    ElMessage({
      type: 'error',
      message: t('messages.operationFail')
    })
    return
  }
  const setRes = await window.FBW.setDynamicWallpaper(videoPath)
  ElMessage({
    type: setRes.success ? 'success' : 'error',
    message: setRes.message
  })
}

const utilList = ref([
  // ... 其他工具
  {
    name: 'setDynamicWallpaper',
    text: '设置动态壁纸',
    locale: 'pages.Utils.setDynamicWallpaper',
    handle: onSetDynamicWallpaper
  },
  {
    name: 'closeDynamicWallpaper',
    text: '关闭动态壁纸',
    locale: 'pages.Utils.closeDynamicWallpaper',
    confirm: true
  }
])
```

### 2. 设置页面集成

**设置页面中的动态壁纸配置：**

```vue
<el-form-item
  :label="t('pages.Setting.settingDataForm.dynamicAutoPlayOnStartup')"
  prop="dynamicAutoPlayOnStartup"
>
  <el-checkbox
    v-model="settingDataForm.dynamicAutoPlayOnStartup"
    @change="onSettingDataFormChange"
  />
</el-form-item>
<el-form-item :label="t('pages.Setting.settingDataForm.dynamicMuteAudio')" prop="dynamicMuteAudio">
  <el-checkbox
    v-model="settingDataForm.dynamicMuteAudio"
    @change="onSettingDataFormChange"
  />
</el-form-item>
<el-form-item
  :label="t('pages.Setting.settingDataForm.dynamicBackgroundColor')"
  prop="dynamicBackgroundColor"
>
  <el-color-picker
    v-model="settingDataForm.dynamicBackgroundColor"
    :predefine="colorList"
    @change="onSettingDataFormChange"
  />
</el-form-item>
```

---

## 启动时自动播放

### 1. 应用启动检查

**main/index.mjs 中的启动检查：**

```js
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
```

### 2. 设置数据持久化

**动态壁纸相关设置：**

- `dynamicAutoPlayOnStartup`：启动时自动播放动态壁纸
- `dynamicMuteAudio`：动态壁纸静音
- `dynamicBackgroundColor`：动态壁纸背景色
- `dynamicLastVideoPath`：上次播放的视频路径

---

## 操作系统差异总结

### 1. Windows 系统特点

**优势：**

- 使用原生 Windows API，性能最佳
- 支持透明度调节和点击穿透
- 窗口嵌入桌面层级，视觉效果最佳

**实现方式：**

- 使用 `koffi` 库调用 `user32.dll`
- 通过 `WorkerW` 窗口嵌入桌面
- 设置 `WS_EX_LAYERED | WS_EX_TRANSPARENT` 样式

### 2. macOS 系统特点

**优势：**

- 使用 Electron 的 `desktop` 窗口类型
- 支持多工作区显示
- 系统集成度高

**实现方式：**

- 设置 `type: 'desktop'` 窗口类型
- 使用 `setVisibleOnAllWorkspaces(true)`
- 隐藏 dock 图标

### 3. Linux 系统特点

**优势：**

- 使用标准透明窗口
- 兼容性好

**限制：**

- 依赖窗口管理器支持
- 功能相对简单

**实现方式：**

- 使用标准透明窗口
- 依赖窗口管理器的桌面支持

---

## 技术特点

### 1. 跨平台兼容性

- **Windows**：使用原生 API，性能最佳
- **macOS**：使用 Electron 桌面窗口类型
- **Linux**：使用标准透明窗口

### 2. 性能优化

- **帧率控制**：支持 15/30/60fps 性能模式
- **内存管理**：单例模式避免重复创建窗口
- **资源管理**：自动清理和状态管理

### 3. 用户体验

- **点击穿透**：不影响桌面操作
- **透明度调节**：支持 0-100% 透明度
- **视觉效果**：支持亮度、对比度调节
- **背景色设置**：提供纯色背景支持

### 4. 稳定性保障

- **错误处理**：完整的异常捕获和处理
- **状态管理**：窗口状态和设置数据同步
- **资源清理**：窗口关闭时自动清理资源

---

## 总结

动态壁纸功能通过创建特殊的透明窗口来播放视频，实现了桌面背景的动态效果。该功能具有以下特点：

1. **技术实现先进**：使用原生 API 和 Electron 技术，性能优异
2. **跨平台兼容**：针对不同操作系统采用不同的实现策略
3. **功能丰富**：支持帧率控制、透明度调节、视觉效果优化
4. **用户体验良好**：点击穿透、自动播放、设置持久化
5. **稳定性可靠**：完整的错误处理和资源管理

该功能为飞鸟壁纸提供了高级的动态壁纸支持，让用户能够享受更加生动和个性化的桌面体验。
