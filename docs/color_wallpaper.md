# 颜色壁纸

颜色壁纸功能允许用户将纯色背景设置为桌面壁纸，通过程序化生成 BMP 格式的图片文件来实现。该功能支持自定义颜色选择，并提供预设的颜色列表供用户快速选择。

---

## 实现原理

### 1. 核心思路

颜色壁纸的实现原理是将十六进制颜色值转换为 BMP 格式的图片文件，然后通过系统 API 设置为桌面壁纸。整个过程包括：

1. **颜色解析**：将十六进制颜色值转换为 RGB 分量
2. **BMP 文件生成**：创建符合 BMP 格式规范的图片文件
3. **文件保存**：将生成的图片保存到临时目录
4. **壁纸设置**：调用系统 API 将图片设置为桌面壁纸

### 2. 技术架构

```
用户选择颜色 → 渲染进程 → IPC → 主进程 → WallpaperManager → createSolidColorBMP → 系统API → 桌面壁纸
```

---

## 核心功能实现

### 1. 颜色壁纸设置入口

**主进程 Store 中的设置方法：**

```js:src/main/store/index.mjs
// 设置颜色壁纸
async setColorWallpaper(color) {
  await this.toggleAutoSwitchWallpaper(false)
  // 关闭视频壁纸
  this.wallpaperManager.closeDynamicWallpaper()
  return await this.wallpaperManager.setColorWallpaper(
    color || this.settingData.colorWallpaperVal
  )
}
```

**WallpaperManager 中的核心实现：**

```js:src/main/store/WallpaperManager.mjs
// 设置颜色壁纸
async setColorWallpaper(color) {
  if (!color) {
    return {
      success: false,
      message: t('messages.paramsError')
    }
  }
  try {
    const buffer = createSolidColorBMP(color)
    const colorImagePath = path.join(process.env.FBW_TEMP_PATH, 'fbw-color-wallpaper.png')
    fs.writeFileSync(colorImagePath, buffer)
    return await this.setImageWallpaper(colorImagePath)
  } catch (err) {
    this.logger.error(`设置壁纸失败: error => ${err}`)
    return {
      success: false,
      message: t('messages.setWallpaperFail')
    }
  }
}
```

### 2. BMP 图片生成算法

**createSolidColorBMP 函数实现：**

```js:src/main/utils/utils.mjs
export const createSolidColorBMP = (color = '#000000', width = 100, height = 100) => {
  // 解析颜色
  const r = parseInt(color.slice(1, 3), 16)
  const g = parseInt(color.slice(3, 5), 16)
  const b = parseInt(color.slice(5, 7), 16)

  // BMP 文件头和信息头
  const fileHeaderSize = 14
  const infoHeaderSize = 40
  const rowSize = Math.ceil((24 * width) / 32) * 4
  const pixelArraySize = rowSize * height
  const fileSize = fileHeaderSize + infoHeaderSize + pixelArraySize

  const buffer = Buffer.alloc(fileSize)

  // BMP 文件头
  buffer.write('BM') // Signature
  buffer.writeUInt32LE(fileSize, 2) // File size
  buffer.writeUInt32LE(0, 6) // Reserved
  buffer.writeUInt32LE(fileHeaderSize + infoHeaderSize, 10) // Pixel data offset

  // BMP 信息头
  buffer.writeUInt32LE(infoHeaderSize, 14) // Info header size
  buffer.writeInt32LE(width, 18) // Width
  buffer.writeInt32LE(-height, 22) // Height (负数表示自上而下)
  buffer.writeUInt16LE(1, 26) // Planes
  buffer.writeUInt16LE(24, 28) // Bits per pixel
  buffer.writeUInt32LE(0, 30) // Compression
  buffer.writeUInt32LE(pixelArraySize, 34) // Image size
  buffer.writeInt32LE(0, 38) // X pixels per meter
  buffer.writeInt32LE(0, 42) // Y pixels per meter
  buffer.writeUInt32LE(0, 46) // Colors used
  buffer.writeUInt32LE(0, 50) // Important colors

  // 填充像素数据
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const pos = fileHeaderSize + infoHeaderSize + y * rowSize + x * 3
      buffer[pos] = b
      buffer[pos + 1] = g
      buffer[pos + 2] = r
    }
  }

  return buffer
}
```

---

## BMP 文件格式详解

### 1. BMP 文件结构

BMP（Bitmap）文件由以下几个部分组成：

```
┌─────────────────┐
│   BMP 文件头    │ 14 字节
├─────────────────┤
│   BMP 信息头    │ 40 字节
├─────────────────┤
│   像素数据      │ 可变长度
└─────────────────┘
```

### 2. 文件头（14 字节）

| 偏移量 | 大小 | 字段名          | 说明                  |
| ------ | ---- | --------------- | --------------------- |
| 0x00   | 2    | Signature       | 文件标识，固定为 'BM' |
| 0x02   | 4    | FileSize        | 文件总大小（字节）    |
| 0x06   | 4    | Reserved        | 保留字段，必须为 0    |
| 0x0A   | 4    | PixelDataOffset | 像素数据偏移量        |

**代码实现：**

```js:src/main/utils/utils.mjs
// BMP 文件头
buffer.write('BM') // Signature
buffer.writeUInt32LE(fileSize, 2) // File size
buffer.writeUInt32LE(0, 6) // Reserved
buffer.writeUInt32LE(fileHeaderSize + infoHeaderSize, 10) // Pixel data offset
```

### 3. 信息头（40 字节）

| 偏移量 | 大小 | 字段名          | 说明                               |
| ------ | ---- | --------------- | ---------------------------------- |
| 0x0E   | 4    | InfoHeaderSize  | 信息头大小，固定为 40              |
| 0x12   | 4    | Width           | 图片宽度（像素）                   |
| 0x16   | 4    | Height          | 图片高度（像素），负数表示自上而下 |
| 0x1A   | 2    | Planes          | 颜色平面数，固定为 1               |
| 0x1C   | 2    | BitsPerPixel    | 每像素位数，24 表示真彩色          |
| 0x1E   | 4    | Compression     | 压缩方式，0 表示无压缩             |
| 0x22   | 4    | ImageSize       | 像素数据大小                       |
| 0x26   | 4    | XPixelsPerMeter | 水平分辨率                         |
| 0x2A   | 4    | YPixelsPerMeter | 垂直分辨率                         |
| 0x2E   | 4    | ColorsUsed      | 使用的颜色数，0 表示所有颜色       |
| 0x32   | 4    | ImportantColors | 重要颜色数，0 表示所有颜色         |

**代码实现：**

```js:src/main/utils/utils.mjs
// BMP 信息头
buffer.writeUInt32LE(infoHeaderSize, 14) // Info header size
buffer.writeInt32LE(width, 18) // Width
buffer.writeInt32LE(-height, 22) // Height (负数表示自上而下)
buffer.writeUInt16LE(1, 26) // Planes
buffer.writeUInt16LE(24, 28) // Bits per pixel
buffer.writeUInt32LE(0, 30) // Compression
buffer.writeUInt32LE(pixelArraySize, 34) // Image size
buffer.writeInt32LE(0, 38) // X pixels per meter
buffer.writeInt32LE(0, 42) // Y pixels per meter
buffer.writeUInt32LE(0, 46) // Colors used
buffer.writeUInt32LE(0, 50) // Important colors
```

### 4. 像素数据

**行对齐计算：**

```js:src/main/utils/utils.mjs
const rowSize = Math.ceil((24 * width) / 32) * 4
```

BMP 格式要求每行的字节数必须是 4 的倍数。对于 24 位真彩色图片：

- 每个像素占用 3 字节（RGB）
- 每行实际需要的字节数：`width * 3`
- 每行对齐后的字节数：`Math.ceil((width * 3) / 4) * 4`

**像素数据填充：**

```js:src/main/utils/utils.mjs
// 填充像素数据
for (let y = 0; y < height; y++) {
  for (let x = 0; x < width; x++) {
    const pos = fileHeaderSize + infoHeaderSize + y * rowSize + x * 3
    buffer[pos] = b // 蓝色分量
    buffer[pos + 1] = g // 绿色分量
    buffer[pos + 2] = r // 红色分量
  }
}
```

**颜色顺序说明：**
BMP 格式使用 BGR（蓝-绿-红）颜色顺序，而不是常见的 RGB 顺序。

---

## 颜色系统

### 1. 预设颜色列表

**colorList 定义：**

```js:src/renderer/windows/MainWindow/pages/Setting.vue
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

### 2. 颜色解析算法

**十六进制颜色解析：**

```js
// 解析颜色
const r = parseInt(color.slice(1, 3), 16) // 红色分量
const g = parseInt(color.slice(3, 5), 16) // 绿色分量
const b = parseInt(color.slice(5, 7), 16) // 蓝色分量
```

**解析过程：**

1. `color.slice(1, 3)`：提取红色分量（第 2-3 位）
2. `parseInt(..., 16)`：将十六进制字符串转换为十进制数值
3. 重复上述过程获取绿色和蓝色分量

**示例：**

- 输入：`#FF7F50`
- 红色：`parseInt('FF', 16) = 255`
- 绿色：`parseInt('7F', 16) = 127`
- 蓝色：`parseInt('50', 16) = 80`

---

## 渲染进程界面

### 1. 设置页面颜色选择器

**颜色壁纸设置界面：**

```vue
<el-form-item
  :label="t('pages.Setting.settingDataForm.colorWallpaperVal.label')"
  prop="colorWallpaperVal"
>
  <el-color-picker
    v-model="settingDataForm.colorWallpaperVal"
    :disabled="flags.settingColorWallpaper"
    :predefine="colorList"
    @change="onSettingDataFormChange"
  />
  <el-button
    :disabled="!settingDataForm.colorWallpaperVal"
    :loading="flags.settingColorWallpaper"
    @click="onSetColorWallpaper"
    style="margin-left: 10px"
  >
    <IconifyIcon icon="ep:check" />
  </el-button>
</el-form-item>
```

### 2. 颜色壁纸设置函数

**设置页面中的处理函数：**

```js
const onSetColorWallpaper = async () => {
  flags.settingColorWallpaper = true
  const res = await window.FBW.setColorWallpaper()
  flags.settingColorWallpaper = false
  ElMessage({
    type: res.success ? 'success' : 'error',
    message: res.message
  })
}
```

### 3. 工具页面功能

**工具页面中的颜色壁纸设置：**

```js
{
  name: 'setColorWallpaper',
  text: '设置颜色壁纸',
  locale: 'pages.Utils.setColorWallpaper',
  confirm: true
}
```

---

## 进程间通信

### 1. IPC 处理器

**主进程 IPC 处理：**

```js
// 设置颜色壁纸
ipcMain.handle('main:setColorWallpaper', (event, color) => {
  return this.setColorWallpaper(color)
})
```

### 2. 预加载脚本 API

**渲染进程 API 接口：**

```js
const api = {
  // 设置颜色壁纸
  setColorWallpaper: (...args) => ipcRenderer.invoke('main:setColorWallpaper', ...args)
}
```

---

## 应用场景

### 1. 动态壁纸背景

**Windows 动态壁纸背景设置：**

```js
if (isWin()) {
  // 同时设置纯色背景壁纸图片，提高视角体验
  const dynamicBackgroundColor = global.FBW.store?.settingData?.dynamicBackgroundColor || '#FFFFFF'
  await global.FBW.store?.wallpaperManager.setColorWallpaper(dynamicBackgroundColor)
  setWindowsDynamicWallpaper(this.win.getNativeWindowHandle().readInt32LE(0))
}
```

### 2. 律动壁纸背景

**律动壁纸窗口背景设置：**

```js
if (isWin()) {
  // 同时设置纯色背景壁纸图片，提高视角体验
  const dynamicBackgroundColor = global.FBW.store?.settingData?.dynamicBackgroundColor || '#FFFFFF'
  await global.FBW.store?.wallpaperManager.setColorWallpaper(dynamicBackgroundColor)
  setWindowsDynamicWallpaper(this.win.getNativeWindowHandle().readInt32LE(0))
}
```

### 3. 动态壁纸背景色控制

**动态壁纸背景色设置：**

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

## 技术特点

### 1. 跨平台兼容性

**操作系统差异处理：**

```js
await setWallpaper(imgPath, {
  screen: this.settingData.allScreen && isMac() ? 'all' : 'main',
  scale: this.settingData.scaleType
})
```

- **Windows**：支持多屏幕设置，使用 `wallpaper` 库
- **macOS**：支持所有屏幕或主屏幕设置
- **Linux**：使用标准的 `wallpaper` 库支持

### 2. 性能优化

**临时文件管理：**

```js
const colorImagePath = path.join(process.env.FBW_TEMP_PATH, 'fbw-color-wallpaper.png')
```

- 使用临时目录存储生成的图片文件
- 固定文件名，避免重复生成
- 文件大小小，生成速度快

### 3. 错误处理

**完整的错误处理机制：**

```js
try {
  const buffer = createSolidColorBMP(color)
  const colorImagePath = path.join(process.env.FBW_TEMP_PATH, 'fbw-color-wallpaper.png')
  fs.writeFileSync(colorImagePath, buffer)
  return await this.setImageWallpaper(colorImagePath)
} catch (err) {
  this.logger.error(`设置壁纸失败: error => ${err}`)
  return {
    success: false,
    message: t('messages.setWallpaperFail')
  }
}
```

### 4. 国际化支持

**多语言错误消息：**

```js
import { t } from '../../i18n/server.js'

return {
  success: false,
  message: t('messages.paramsError')
}
```

---

## 实现细节

### 1. 图片尺寸

**默认尺寸设置：**

```js
export const createSolidColorBMP = (color = '#000000', width = 100, height = 100) => {
```

当前实现使用 100x100 像素的默认尺寸，这个尺寸足够作为桌面壁纸使用，同时保持文件大小最小。

### 2. 文件格式选择

**为什么选择 BMP 格式：**

1. **简单性**：BMP 格式结构简单，易于程序化生成
2. **兼容性**：所有操作系统都支持 BMP 格式作为壁纸
3. **无压缩**：不需要复杂的压缩算法，生成速度快
4. **标准化**：BMP 格式规范明确，实现可靠

### 3. 内存管理

**Buffer 分配：**

```js
const buffer = Buffer.alloc(fileSize)
```

使用 Node.js 的 Buffer 类进行内存管理，确保内存使用高效且安全。

### 4. 文件系统操作

**同步写入：**

```js
fs.writeFileSync(colorImagePath, buffer)
```

使用同步写入确保文件完全写入后再进行后续操作，避免异步操作可能导致的时序问题。

---

## 扩展功能

### 1. 颜色提取

**从图片提取主色调：**

```js
export const extractDominantColor = async (filePath) => {
  try {
    // 将图片缩小到 1x1 像素以获取平均颜色
    const { data } = await sharp(filePath)
      .resize(1, 1, { fit: 'cover' })
      .raw()
      .toBuffer({ resolveWithObject: true })

    // 根据图片通道数获取颜色值
    const r = data[0]
    const g = data[1]
    const b = data[2]

    // 返回十六进制颜色值
    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`
  } catch (err) {
    global.logger.error(`提取图片主色调失败: ${filePath} error => ${err}`)
    // 默认透明色
    return '#00000000'
  }
}
```

### 2. 渐变效果支持

**律动壁纸中的颜色渐变：**

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
  }
}
```

---

## 总结

颜色壁纸功能通过程序化生成 BMP 格式的纯色图片文件，实现了将任意颜色设置为桌面壁纸的功能。该功能具有以下特点：

1. **技术实现简单可靠**：使用标准的 BMP 文件格式，兼容性好
2. **性能高效**：生成速度快，文件大小小
3. **用户体验良好**：提供预设颜色列表，支持自定义颜色
4. **跨平台兼容**：支持 Windows、macOS、Linux 三大操作系统
5. **扩展性强**：可以轻松集成到其他功能中，如动态壁纸背景

该功能为飞鸟壁纸提供了基础的纯色壁纸支持，同时为其他高级功能（如动态壁纸、律动壁纸）提供了背景色设置的基础。
