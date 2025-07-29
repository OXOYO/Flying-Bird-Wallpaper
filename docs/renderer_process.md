# 渲染进程

渲染进程负责用户界面展示和交互，采用 Vue 3 + Element Plus 技术栈，包含多个独立窗口，每个窗口都有特定的功能和用途。

---

## 主窗口 (MainWindow)

主窗口是应用的核心界面，采用侧边栏 + 主内容区的布局设计，支持多页面切换和功能模块管理。

### 1. 窗口布局

- **侧边栏**：可折叠的菜单导航，支持展开/收起切换
- **主内容区**：动态加载不同功能页面，支持页面切换动画
- **自定义标题栏**：支持窗口拖拽、最小化、最大化、关闭等操作

**关键代码片段：**

```vue
<el-container class="window-container">
  <el-aside class="window-side-wrapper" :width="settingData.expandSideMenu ? '70px' : '0'">
    <SideMenu v-if="settingData.expandSideMenu" />
    <div class="side-expand-btn" @click="toggleExpandSideMenu">
      <IconifyIcon :icon="settingData.expandSideMenu ? 'ep:caret-left' : 'ep:caret-right'" />
    </div>
  </el-aside>
  <el-main class="window-main-wrapper">
    <MainContainer />
  </el-main>
</el-container>
```

### 2. 功能页面

- **Explore**：探索页面，浏览和发现壁纸
- **Search**：搜索页面，关键词搜索壁纸
- **Favorites**：收藏页面，管理收藏的壁纸
- **History**：历史页面，查看浏览历史
- **Words**：词库页面，管理搜索关键词
- **Setting**：设置页面，应用配置管理
- **Utils**：工具页面，实用功能集合
- **About**：关于页面，应用信息展示

**关键代码片段：**

```js
const componentDict = {
  Explore,
  Search,
  Favorites,
  History,
  Words,
  Setting,
  Utils,
  About
}
```

### 3. 菜单管理

- 支持菜单启用/禁用配置
- 动态过滤显示启用的菜单项
- 支持主进程页面跳转事件监听
- 集成二维码生成功能（H5 服务地址）

**关键代码片段：**

```js
const enabledMenus = computed(() => {
  const list = menuList.value.filter((item) => item.placement.includes('sideMenu'))
  if (!settingData.value?.enabledMenus?.length) {
    return list
  }
  return list.filter((item) => {
    if (item.canBeEnabled) {
      return settingData.value.enabledMenus.includes(item.name)
    }
    return true
  })
})
```

---

## 悬浮球 (SuspensionBall)

悬浮球提供快捷操作功能，支持拖拽移动和点击操作，是壁纸切换的快速入口。

### 1. 拖拽功能

- 支持鼠标拖拽移动窗口位置
- 拖拽阈值检测，区分点击和拖拽操作
- 实时更新窗口位置到主进程

**关键代码片段：**

```js
const onMouseMove = (e) => {
  if (!startPos.value || !windowStartPos.value) return

  const deltaX = e.screenX - startPos.value.x
  const deltaY = e.screenY - startPos.value.y
  const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY)

  if (distance > moveThreshold || isDragging.value) {
    isDragging.value = true
    const newX = windowStartPos.value.x + deltaX
    const newY = windowStartPos.value.y + deltaY
    window.FBW.setWindowPosition('suspensionBall', { x: newX, y: newY })
  }
}
```

### 2. 快捷操作

- **切换主窗口**：点击悬浮球切换主窗口显示/隐藏
- **自动切换壁纸**：启动/停止自动壁纸切换功能
- **设置同步**：监听主进程设置数据更新

**关键代码片段：**

```js
const onMouseUp = () => {
  if (!isDragging.value) {
    // 如果没有拖拽，则认为是点击事件
    window.FBW.toggleMainWindow()
  }
}

const onToolClick = async (funcName) => {
  if (typeof window.FBW[funcName] === 'function') {
    await window.FBW[funcName]()
  }
}
```

---

## 预览图片窗口 (ViewImageWindow)

预览图片窗口提供独立的图片查看功能，支持图片列表浏览和单张图片查看。

### 1. 窗口功能

- 独立窗口显示，支持窗口大小调整
- 自定义标题栏，支持窗口操作
- 图片查看组件集成

**关键代码片段：**

```vue
<template>
  <div class="window-container">
    <custom-title-bar :resize-window="true" window-name="viewImageWindow" />
    <div class="window-container-inner">
      <view-image ref="viewImageRef" :options="viewImageOptions" />
    </div>
  </div>
</template>
```

### 2. 数据通信

- 监听主进程发送的图片数据
- 支持图片列表和当前索引传递
- 实时更新显示内容

**关键代码片段：**

```js
const doView = (activeIndex = -1, list = []) => {
  viewImageRef.value.view(activeIndex, list)
}

const onSendPostDataCallback = (event, data) => {
  doView(data.activeIndex, data.list)
}

onBeforeMount(() => {
  window.FBW.onSendPostData(onSendPostDataCallback)
})
```

---

## 动态壁纸窗口 (DynamicWallpaperWindow)

动态壁纸窗口用于播放视频作为桌面壁纸，支持多种视频控制功能。

### 1. 视频播放

- 支持本地视频文件播放
- 自动转换为 `fbwtp://` 协议 URL
- 支持 HTTP 和 HTTPS 视频源

**关键代码片段：**

```js
const handleSetVideoSource = (event, source) => {
  if (source) {
    if (!source.startsWith('fbwtp://') && !source.startsWith('http')) {
      const formattedPath = source.replace(/\\/g, '/')
      videoSrc.value = `fbwtp://fbw/api/videos/get?filePath=${formattedPath}`
    } else {
      videoSrc.value = source
    }
  }
}
```

### 2. 视频控制

- **静音控制**：支持视频静音/取消静音
- **帧率控制**：限制视频播放帧率，优化性能
- **缩放模式**：支持 cover、contain 等缩放模式
- **亮度/对比度**：实时调整视频显示效果

**关键代码片段：**

```js
const controlFrameRate = (timestamp) => {
  if (!videoRef.value) return

  const frameInterval = 1000 / frameRate.value

  if (timestamp - lastFrameTime >= frameInterval) {
    if (videoRef.value.paused) {
      videoRef.value.play()
    }
    lastFrameTime = timestamp
  } else {
    if (!videoRef.value.paused) {
      videoRef.value.pause()
    }
  }

  rafId = requestAnimationFrame(controlFrameRate)
}
```

### 3. 视觉效果

- 支持亮度、对比度滤镜调整
- 实时计算和应用 CSS 滤镜效果
- 响应式布局适配

**关键代码片段：**

```js
const filterStyle = computed(() => {
  return `brightness(${brightness.value / 100}) contrast(${contrast.value / 100})`
})
```

---

## 律动壁纸窗口 (RhythmWallpaperWindow)

律动壁纸窗口基于音频频谱数据渲染动态视觉效果，支持多种律动效果。

### 1. 音频采集

- 使用 Web Audio API 采集音频数据
- 自动检测虚拟声卡设备（VB-Audio、BlackHole、立体声混音）
- 支持音频频谱分析和数据提取

**关键代码片段：**

```js
const init = async () => {
  audioContext = new (window.AudioContext || window.webkitAudioContext)()
  const devices = await navigator.mediaDevices.enumerateDevices()
  const audioInputs = devices.filter((d) => d.kind === 'audioinput')

  const virtualDevice = audioInputs.find(
    (d) =>
      d.label.includes('VB-Audio') ||
      d.label.includes('BlackHole') ||
      d.label.includes('立体声混音') ||
      d.label.toLowerCase().includes('stereo mix')
  )

  if (virtualDevice) {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: { deviceId: virtualDevice.deviceId }
    })
    source = audioContext.createMediaStreamSource(stream)
    analyser = audioContext.createAnalyser()
    analyser.fftSize = 1024
    dataArray = new Uint8Array(analyser.frequencyBinCount)
    source.connect(analyser)
    runEffect()
  }
}
```

### 2. 律动效果

支持 20 种不同的律动效果：

- **基础效果**：BarEffect、WaveEffect、BallEffect
- **频谱效果**：SpectrumRingEffect、SpectrumFlowerEffect、Bars3DEffect
- **粒子效果**：ParticleFountainEffect、FireworkEffect、MusicNoteRainEffect
- **动画效果**：DiscoEffect、RainbowEffect、WindmillEffect、TaijiEffect
- **流体效果**：LiquidRippleEffect、FlowingLinesEffect
- **特殊效果**：BreathingHaloEffect、DynamicGridEffect、RotatingStarburstEffect、MuyuEffect

**关键代码片段：**

```js
function runEffect() {
  if (!leafer) return

  if (effectInstance) {
    effectInstance.destroy()
  }

  const effectName =
    config.value.effect.charAt(0).toUpperCase() + config.value.effect.slice(1) + 'Effect'
  const EffectClass = Effects[effectName]

  if (EffectClass) {
    effectInstance = new EffectClass(leafer, toRaw(config.value))
    draw()
  }
}
```

### 3. 渲染引擎

- 使用 Leafer UI 作为渲染引擎
- 支持实时音频数据渲染
- 可配置的效果参数：尺寸比例、颜色、动画、密度、位置、采样范围

**关键代码片段：**

```js
function draw() {
  if (!analyser || !effectInstance) return

  analyser.getByteFrequencyData(dataArray)
  const [start, end] = config.value.sampleRange
  const startIndex = Math.floor((start * dataArray.length) / 100)
  const endIndex = Math.floor((end * dataArray.length) / 100)

  effectInstance.render(dataArray.slice(startIndex, endIndex))
  animationId = requestAnimationFrame(draw)
}
```

### 4. 效果基类

所有律动效果都继承自 `BaseEffect` 基类，提供：

- **位置计算**：支持 9 个位置（top-left、top、top-right、right、bottom-right、bottom、bottom-left、left、center）
- **尺寸管理**：基于窗口尺寸和比例计算效果区域
- **数据降维**：支持 max、min、average 三种数据聚合方式
- **颜色映射**：支持线性渐变和径向渐变填充
- **调试功能**：可选的调试边框显示

**关键代码片段：**

```js
export class BaseEffect {
  constructor(leafer, config) {
    this.leafer = leafer
    this.config = config
    this.debugRect = null
    this.bodySize = this.getBodySize()
    this.renderDebug()
  }

  getPosition(width, height, bodyWidth, bodyHeight, margin = 0) {
    switch (this.config.position) {
      case 'top-left':
        return { x: margin + bodyWidth / 2, y: margin + bodyHeight / 2 }
      case 'center':
      default:
        return { x: width / 2, y: height / 2 }
      // ... 其他位置
    }
  }
}
```

---

## 技术特点

### 1. 状态管理

- 使用 Pinia 进行状态管理
- 支持多窗口间的数据同步
- 与主进程 IPC 通信保持数据一致性

### 2. 组件化设计

- 高度模块化的组件结构
- 可复用的自定义组件（如 CustomTitleBar、ViewImage）
- 统一的组件注册和导入机制

### 3. 响应式布局

- 基于 Element Plus 的响应式布局
- 支持窗口大小调整和内容自适应
- 流畅的过渡动画效果

### 4. 国际化支持

- 集成 i18n 国际化框架
- 支持多语言界面切换
- 统一的文本管理机制
