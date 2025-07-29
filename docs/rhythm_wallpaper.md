# 律动壁纸

律动壁纸功能通过 Web Audio API 捕获系统音频，结合 Leafer UI 渲染引擎创建音频响应的视觉效果，实现桌面背景的律动动画。该功能支持多种视觉效果，提供丰富的配置选项，并在不同操作系统上采用不同的实现策略。

---

## 实现原理

### 1. 核心思路

律动壁纸的实现原理是通过 Web Audio API 捕获系统音频数据，将音频频谱数据转换为视觉元素，使用 Leafer UI 渲染引擎创建动态的视觉效果。整个过程包括：

1. **音频捕获**：使用 Web Audio API 捕获系统音频
2. **频谱分析**：通过 AnalyserNode 获取音频频谱数据
3. **数据映射**：将音频数据映射为视觉参数
4. **效果渲染**：使用 Leafer UI 渲染动态视觉效果

### 2. 技术架构

```
系统音频 → Web Audio API → AnalyserNode → 频谱数据 → 数据映射 → Leafer UI → 视觉效果 → 桌面律动壁纸
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

### 1. 律动壁纸窗口管理

**RhythmWallpaperWindow 单例模式：**

```js
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
  }
}
```

### 2. 窗口创建与配置

**create 方法实现：**

```js
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

---

## 音频捕获与处理

### 1. Web Audio API 初始化

**音频上下文创建：**

```js
const init = async () => {
  leafer = new Leafer({ view: leaferRef.value, autoRender: true })
  audioContext = new (window.AudioContext || window.webkitAudioContext)()

  // 获取所有音频输入设备
  const devices = await navigator.mediaDevices.enumerateDevices()
  const audioInputs = devices.filter((d) => d.kind === 'audioinput')

  // 查找虚拟声卡设备
  const virtualDevice = audioInputs.find(
    (d) =>
      d.label.includes('VB-Audio') ||
      d.label.includes('BlackHole') ||
      d.label.includes('立体声混音') || // 新增
      d.label.toLowerCase().includes('stereo mix') // 英文系统
  )

  // 用虚拟声卡 deviceId 采集音频
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
  } else {
    console.log('请先安装并切换系统音频输出到虚拟声卡（如 VB-Audio/BlackHole）')
  }
}
```

### 2. 频谱数据获取

**实时频谱分析：**

```js
function draw() {
  if (!analyser || !effectInstance) {
    return
  }
  analyser.getByteFrequencyData(dataArray)
  // 采样范围
  const [start, end] = config.value.sampleRange
  const startIndex = Math.floor((start * dataArray.length) / 100)
  const endIndex = Math.floor((end * dataArray.length) / 100)
  effectInstance.render(dataArray.slice(startIndex, endIndex))
  animationId = requestAnimationFrame(draw)
}
```

---

## Leafer UI 渲染引擎

### 1. Leafer UI 初始化

**渲染引擎创建：**

```js
const init = async () => {
  leafer = new Leafer({ view: leaferRef.value, autoRender: true })
  // ... 其他初始化代码
}
```

### 2. 配置管理

**动态配置计算：**

```js
const config = computed(() => {
  return {
    effect: settingData.value.rhythmEffect,
    widthRatio: settingData.value.rhythmWidthRatio / 100,
    heightRatio: settingData.value.rhythmHeightRatio / 100,
    colors: toRaw(settingData.value.rhythmColors),
    animation: settingData.value.rhythmAnimation,
    density: settingData.value.rhythmDensity,
    position: settingData.value.rhythmPosition,
    sampleRange: settingData.value.rhythmSampleRange,
    shadow: true,
    debug: false
  }
})
```

---

## 效果系统架构

### 1. BaseEffect 基类

**基础效果类实现：**

```js
export class BaseEffect {
  constructor(leafer, config) {
    this.leafer = leafer
    this.config = config
    this.debugRect = null
    this.bodySize = this.getBodySize()
    this.renderDebug()
  }

  getBodySize() {
    const { width, height } = this.leafer
    const { widthRatio, heightRatio } = this.config
    const bodyWidth = width * widthRatio
    const bodyHeight = height * heightRatio
    const { x, y } = this.getPosition(width, height, bodyWidth, bodyHeight)
    return {
      width: bodyWidth,
      height: bodyHeight,
      x,
      y
    }
  }

  getPosition(width, height, bodyWidth, bodyHeight, margin = 0) {
    switch (this.config.position) {
      case 'top-left':
        return { x: margin + bodyWidth / 2, y: margin + bodyHeight / 2 }
      case 'top':
        return { x: width / 2, y: margin + bodyHeight / 2 }
      case 'top-right':
        return { x: width - margin - bodyWidth / 2, y: margin + bodyHeight / 2 }
      case 'right':
        return { x: width - margin - bodyWidth / 2, y: height / 2 }
      case 'bottom-right':
        return { x: width - margin - bodyWidth / 2, y: height - margin - bodyHeight / 2 }
      case 'bottom':
        return { x: width / 2, y: height - margin - bodyHeight / 2 }
      case 'bottom-left':
        return { x: margin + bodyWidth / 2, y: height - margin - bodyHeight / 2 }
      case 'left':
        return { x: margin + bodyWidth / 2, y: height / 2 }
      case 'center':
      default:
        return { x: width / 2, y: height / 2 }
    }
  }
}
```

### 2. 数据映射算法

**数据降维处理：**

```js
getReducedValues(list, count = 8, type = 'max') {
  const ret = []
  for (let i = 0; i < count; i++) {
    const start = Math.floor((i * list.length) / count)
    const end = Math.floor(((i + 1) * list.length) / count)
    if (type === 'average') {
      let sum = 0
      for (let j = start; j < end; j++) {
        sum += list[j]
      }
      ret[i] = sum / (end - start)
    } else if (type === 'max') {
      ret[i] = Math.max(...list.slice(start, end))
    } else if (type === 'min') {
      ret[i] = Math.min(...list.slice(start, end))
    }
  }
  return ret
}
```

**数据归一化处理：**

```js
getMappedValue(value) {
  const animation = this.config?.animation || 'linear'
  switch (animation) {
    case 'linear':
      return value / 255
    case 'log':
      return Math.log2(1 + value) / Math.log2(256)
    case 'parabola':
      return Math.pow(value / 255, 2)
    case 'sqrt':
      return Math.sqrt(value / 255)
    case 'exp':
      return Math.pow(value / 255, 1.5)
    case 'sin':
      return Math.sin(((value / 255) * Math.PI) / 2)
    case 'bounce': {
      const x = value / 255
      let y
      if (x < 1 / 2.75) {
        y = 7.5625 * x * x
      } else if (x < 2 / 2.75) {
        y = 7.5625 * (x - 1.5 / 2.75) * (x - 1.5 / 2.75) + 0.75
      } else if (x < 2.5 / 2.75) {
        y = 7.5625 * (x - 2.25 / 2.75) * (x - 2.25 / 2.75) + 0.9375
      } else {
        y = 7.5625 * (x - 2.625 / 2.75) * (x - 2.625 / 2.75) + 0.984375
      }
      y = Math.min(1, Math.max(0, y))
      return Math.pow(y, 0.7)
    }
    case 'step': {
      const n = 5
      return Math.floor((value / 255) * n) / n
    }
    default:
      return value / 255
  }
}
```

### 3. 颜色填充系统

**多种填充类型：**

```js
getFill(type = 'linear', index = 0) {
  const colors = this.config.colors || colorList
  if (type === 'linear') {
    return {
      type: 'linear',
      stops: colors.map((color, idx) => ({
        color,
        offset: idx / (colors.length - 1)
      })),
      from: 'top',
      to: 'bottom'
    }
  } else if (type === 'radial') {
    return {
      type: 'radial',
      stops: colors.map((color, idx) => ({
        color,
        offset: idx / (colors.length - 1)
      })),
      from: 'center'
    }
  } else if (type === 'random') {
    return colors[Math.floor(Math.random() * colors.length)]
  } else if (type === 'loop') {
    return colors[index % colors.length]
  } else if (type === 'single') {
    return colors[index]
  } else {
    return colors[index]
  }
}
```

---

## 效果类型详解

### 1. 柱状效果 (BarEffect)

**柱状效果实现：**

```js
export class BarEffect extends BaseEffect {
  constructor(leafer, config) {
    super(leafer, config)
    this.bars = []
    this.densityOptions = {
      sparse: 32,
      normal: 64,
      dense: 128
    }
    this.barCount = this.densityOptions[this.config.density] || this.densityOptions.normal
    this.init()
  }

  init() {
    for (let i = 0; i < this.barCount; i++) {
      const rect = new Rect({
        width: 10,
        height: 10,
        x: 0,
        y: 0,
        fill: this.getFill('linear'),
        shadow: this.config.shadow ? { color: '#000', blur: 10, x: 0, y: 2 } : undefined
      })
      this.leafer.add(rect)
      this.bars.push(rect)
    }
  }

  render(dataArray) {
    const barWidth = this.bodySize.width / this.barCount
    const offsetX = this.bodySize.x - this.bodySize.width / 2
    const offsetY = this.bodySize.y - this.bodySize.height / 2
    const mappedValues = this.getMappedValues(this.getReducedValues(dataArray, this.barCount))

    for (let i = 0; i < this.barCount; i++) {
      const value = mappedValues[i]
      const rect = this.bars[i]
      rect.width = barWidth * 0.8
      rect.height = value * this.bodySize.height
      rect.x = offsetX + i * barWidth
      rect.y = offsetY + (this.bodySize.height - rect.height)
      rect.fill = this.getFill('linear')
      rect.shadow = this.config.shadow ? { color: '#000', blur: 10, x: 0, y: 2 } : undefined
    }
  }
}
```

### 2. 波形效果 (WaveEffect)

**波形效果实现：**

```js
export class WaveEffect extends BaseEffect {
  constructor(leafer, config) {
    super(leafer, {
      amplitude: 1,
      ...config
    })
    this.densityOptions = {
      sparse: 64,
      normal: 128,
      dense: 256
    }
    this.pointCount = this.densityOptions[this.config.density] || this.densityOptions.normal
    this.path = new Path({
      fill: this.getFill('linear'),
      stroke: (this.config.colors && this.config.colors[0]) || '#00ffcc',
      strokeWidth: 3,
      shadow: this.config.shadow ? { color: '#000', blur: 8, x: 0, y: 2 } : undefined
    })
    this.leafer.add(this.path)
  }

  render(dataArray) {
    const { x, y, width, height } = this.bodySize
    const mappedValues = this.getMappedValues(this.getReducedValues(dataArray, this.pointCount))
    const points = []

    for (let i = 0; i < this.pointCount; i++) {
      const px = x - width / 2 + (width / (this.pointCount - 1)) * i
      const mapped = mappedValues[i]
      const py = y + mapped * height * this.config.amplitude
      points.push([px, py])
    }

    this.path.path = this.catmullRom2bezier(points)
    this.path.fill = this.getFill('linear')
  }
}
```

### 3. 小球效果 (BallEffect)

**小球效果实现：**

```js
export class BallEffect extends BaseEffect {
  constructor(leafer, config) {
    super(leafer, config)
    this.balls = []
    this.densityOptions = {
      sparse: 8,
      normal: 16,
      dense: 32
    }
    this.ballCount = this.densityOptions[this.config.density] || this.densityOptions.normal
    this.init()
  }

  init() {
    for (let i = 0; i < this.ballCount; i++) {
      const circle = new Ellipse({
        width: 20,
        height: 20,
        x: 0,
        y: 0,
        fill: this.getFill('random'),
        shadow: this.config.shadow ? { color: '#000', blur: 10, x: 0, y: 2 } : undefined
      })
      this.leafer.add(circle)
      this.balls.push(circle)
    }
  }

  render(dataArray) {
    const mappedValues = this.getMappedValues(this.getReducedValues(dataArray, this.ballCount))
    const ballSpacing = this.bodySize.width / (this.ballCount + 1)
    const minRadius = Math.max(4, (ballSpacing * 0.3) / 2)
    const maxRadius = Math.max(8, (ballSpacing * 0.9) / 2)

    for (let i = 0; i < this.ballCount; i++) {
      const value = mappedValues[i]
      const radius = minRadius + value * (maxRadius - minRadius)
      const y = this.bodySize.y + this.bodySize.height / 2 - radius - value * this.bodySize.height

      const circle = this.balls[i]
      circle.width = radius * 2
      circle.height = radius * 2
      circle.x = this.bodySize.x - this.bodySize.width / 2 + (i + 1) * ballSpacing
      circle.y = y
      circle.fill = this.getFill('random')
      circle.shadow = this.config.shadow ? { color: '#000', blur: 10, x: 0, y: 2 } : undefined
    }
  }
}
```

### 4. 迪斯科效果 (DiscoEffect)

**迪斯科效果实现：**

```js
export class DiscoEffect extends BaseEffect {
  constructor(leafer, config) {
    super(leafer, config)
    this.densityOptions = {
      sparse: 8,
      normal: 16,
      dense: 32
    }
    this.lightCount = this.densityOptions[this.config.density] || this.densityOptions.normal
    this.lights = []
    this.angle = 0
    this.init()
  }

  init() {
    for (let i = 0; i < this.lightCount; i++) {
      const path = new Path({
        fill: this.getFill('loop', i),
        opacity: 0.7,
        shadow: this.config.shadow ? { color: '#fff', blur: 20, x: 0, y: 0 } : undefined
      })
      this.leafer.add(path)
      this.lights.push(path)
    }
  }

  render(dataArray) {
    const { x, y, width, height } = this.bodySize
    const centerX = x
    const centerY = y
    const radius = Math.min(width, height) * 0.3
    this.angle += 0.01
    const mappedValues = this.getMappedValues(this.getReducedValues(dataArray, this.lightCount))

    for (let i = 0; i < this.lightCount; i++) {
      const mapped = mappedValues[i]
      const angle = this.angle + (i * (2 * Math.PI)) / this.lightCount
      const lightLength = radius + mapped * radius * 0.7
      // 扇形光束
      const angleWidth = Math.PI / this.lightCount
      const x1 = centerX + Math.cos(angle - angleWidth) * radius
      const y1 = centerY + Math.sin(angle - angleWidth) * radius
      const x2 = centerX + Math.cos(angle + angleWidth) * radius
      const y2 = centerY + Math.sin(angle + angleWidth) * radius
      const x3 = centerX + Math.cos(angle) * lightLength
      const y3 = centerY + Math.sin(angle) * lightLength
      const d = `M${centerX},${centerY} L${x1},${y1} L${x3},${y3} L${x2},${y2} Z`
      const path = this.lights[i]
      path.path = d
      path.fill = this.getFill('loop', i)
      path.opacity = 0.5 + mapped * 0.5
      path.shadow = this.config.shadow ? { color: '#fff', blur: 20, x: 0, y: 0 } : undefined
    }
  }
}
```

### 5. 烟花效果 (FireworkEffect)

**烟花效果实现：**

```js
export class FireworkEffect extends BaseEffect {
  constructor(leafer, config) {
    super(leafer, config)
    this.densityOptions = {
      sparse: 8,
      normal: 16,
      dense: 32
    }
    this.fireworkCount = this.densityOptions[this.config.density] || this.densityOptions.normal
    this.fireworks = []
    this.particles = []
    this.trailParticles = []
  }

  render(dataArray) {
    const { x, y, width, height } = this.bodySize
    const mappedValues = this.getMappedValues(dataArray)
    const energy = mappedValues.reduce((a, b) => a + b, 0) / mappedValues.length

    // 持续生成新烟花
    if (energy) {
      while (this.fireworks.length < this.fireworkCount) {
        this.launchFirework(x, y, width, height, energy)
      }
    }
    this.updateFireworks()
    this.updateParticles()
    this.updateTrailParticles()
  }

  launchFirework(x, y, width, height, energy) {
    const startX = x - width / 2 + Math.random() * width
    const startY = y + height / 2
    const minHeight = height * 0.2
    const maxHeight = height * 0.95
    const fireworkHeight = minHeight + (maxHeight - minHeight) * energy
    const endY = startY - fireworkHeight
    const color = this.getFill('random')

    const minVx = -3.5,
      maxVx = 3.5
    const minVy = 2.5,
      maxVy = 8
    const vx = Math.random() * (maxVx - minVx) + minVx
    const vy = -(Math.random() * (maxVy - minVy) + minVy)

    const allSameColor = Math.random() < 0.5
    const types = ['straight', 'parabola', 'curve']
    const trajectoryType = types[Math.floor(Math.random() * types.length)]

    const shape = new Ellipse({
      width: 8,
      height: 8,
      x: startX,
      y: startY,
      fill: color,
      opacity: 1
    })
    this.leafer.add(shape)
    this.fireworks.push({
      shape,
      x: startX,
      y: startY,
      vx,
      vy,
      endY,
      color,
      exploded: false,
      energy,
      allSameColor,
      trajectoryType,
      t: 0,
      life: 0
    })
  }
}
```

---

## 效果类型列表

### 1. 基础效果

- **柱状 (BarEffect)**：音频频谱柱状图显示
- **波形 (WaveEffect)**：音频波形曲线显示
- **小球 (BallEffect)**：音频响应的跳动小球

### 2. 动态效果

- **迪斯科 (DiscoEffect)**：旋转的彩色光束
- **频谱环 (SpectrumRingEffect)**：环形频谱显示
- **粒子喷泉 (ParticleFountainEffect)**：粒子喷射效果
- **呼吸光圈 (BreathingHaloEffect)**：呼吸式光环效果

### 3. 艺术效果

- **流动线条 (FlowingLinesEffect)**：流动的曲线效果
- **音符雨 (MusicNoteRainEffect)**：音符下落效果
- **旋转星芒 (RotatingStarburstEffect)**：旋转的星芒效果
- **3D柱状 (Bars3DEffect)**：3D立体柱状效果

### 4. 特殊效果

- **液体波纹 (LiquidRippleEffect)**：液体波纹扩散效果
- **频谱花朵 (SpectrumFlowerEffect)**：花朵形状的频谱
- **彩虹 (RainbowEffect)**：彩虹色彩效果
- **风车 (WindmillEffect)**：旋转风车效果
- **太极 (TaijiEffect)**：太极图案旋转效果
- **木鱼 (MuyuEffect)**：木鱼敲击效果
- **烟花 (FireworkEffect)**：烟花爆炸效果

---

## 配置选项

### 1. 效果配置

- **effect**：选择效果类型
- **widthRatio**：效果宽度比例 (0-100%)
- **heightRatio**：效果高度比例 (0-100%)
- **colors**：颜色配置数组
- **animation**：动画类型 (linear/log/parabola/sqrt/exp/sin/bounce/step)
- **density**：密度设置 (sparse/normal/dense)
- **position**：位置设置 (center/top/bottom/left/right/top-left/top-right/bottom-left/bottom-right)
- **sampleRange**：采样范围 [start, end] (0-100%)

### 2. 预设颜色列表

```js
export const colorList = [
  '#71956C', // 深绿色
  '#E6A23C', // 橙黄色
  '#F56C6C', // 红色
  '#909399', // 灰色
  '#67C23A', // 浅绿色
  '#409EFF', // 蓝色
  '#FF7F50', // 珊瑚橙
  '#FFD700', // 金色
  '#8A2BE2', // 紫罗兰
  '#00CED1', // 深青
  '#FF69B4', // 热粉色
  '#DC143C', // 猩红
  '#2E8B57', // 海绿色
  '#4682B4', // 钢蓝色
  '#7B68EE', // 中等紫罗兰
  '#B22222', // 耐火砖红
  '#40E0D0', // 绿松石
  '#6A5ACD', // 板岩蓝
  '#FF4500', // 橙红色
  '#2F4F4F' // 深灰青色
]
```

---

## 操作系统差异

### 1. Windows 系统特点

- **优势**：使用原生 Windows API，性能最佳
- **实现**：通过 `WorkerW` 窗口嵌入桌面
- **功能**：支持透明度调节和点击穿透

### 2. macOS 系统特点

- **优势**：使用 Electron 的 `desktop` 窗口类型
- **实现**：设置窗口为所有工作区可见
- **功能**：隐藏 dock 图标，系统集成度高

### 3. Linux 系统特点

- **优势**：使用标准透明窗口
- **限制**：依赖窗口管理器支持
- **功能**：基础透明窗口功能

---

## Leafer UI 技术特点

### 1. 渲染性能

- **硬件加速**：支持 GPU 加速渲染
- **高效更新**：只更新变化的元素
- **内存管理**：自动清理不可见元素

### 2. 图形能力

- **矢量图形**：支持 Path、Rect、Ellipse 等
- **渐变填充**：支持线性渐变和径向渐变
- **阴影效果**：支持多种阴影配置
- **透明度**：支持元素透明度调节

### 3. 动画系统

- **实时渲染**：基于 requestAnimationFrame
- **流畅动画**：60fps 流畅动画
- **性能优化**：智能渲染优化

---

## 技术特点

### 1. 音频处理

- **实时捕获**：Web Audio API 实时音频捕获
- **频谱分析**：FFT 频谱分析
- **虚拟声卡**：支持 VB-Audio、BlackHole 等虚拟声卡

### 2. 视觉效果

- **20种效果**：丰富的视觉效果类型
- **可配置性**：高度可配置的效果参数
- **实时响应**：音频实时响应

### 3. 性能优化

- **数据降维**：智能数据降维处理
- **渲染优化**：Leafer UI 渲染优化
- **内存管理**：自动内存清理

### 4. 用户体验

- **点击穿透**：不影响桌面操作
- **跨平台**：支持 Windows、macOS、Linux
- **配置持久化**：设置数据持久化保存

---

## 总结

律动壁纸功能通过 Web Audio API 和 Leafer UI 实现了音频响应的桌面视觉效果。该功能具有以下特点：

1. **技术先进**：使用 Web Audio API 和 Leafer UI 技术
2. **效果丰富**：提供 20 种不同的视觉效果
3. **高度可配置**：支持多种配置选项和参数调节
4. **跨平台兼容**：支持三大操作系统
5. **性能优异**：硬件加速渲染和智能优化

该功能为飞鸟壁纸提供了独特的音频可视化体验，让用户能够享受音乐与视觉的完美结合。
