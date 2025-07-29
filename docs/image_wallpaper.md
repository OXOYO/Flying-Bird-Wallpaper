# 图片壁纸

图片壁纸功能是飞鸟壁纸的核心功能之一，支持本地图片、网络图片、纯色背景等多种壁纸类型，通过主进程与渲染进程的协作实现完整的壁纸管理功能。

---

## 架构设计

### 1. 核心组件

- **WallpaperManager**：主进程壁纸管理器，负责壁纸设置、切换、下载等核心功能
- **渲染进程界面**：提供用户交互界面，包括搜索、收藏、设置等页面
- **IPC 通信**：主进程与渲染进程之间的数据交换和指令传递
- **数据库管理**：壁纸资源、历史记录、收藏夹等数据持久化

### 2. 数据流

```
渲染进程 → IPC → 主进程 → WallpaperManager → 系统API → 桌面壁纸
```

---

## 主进程功能实现

### 1. WallpaperManager 核心功能

**单例模式管理：**

```js
export default class WallpaperManager {
  static _instance = null

  static getInstance(logger, dbManager, settingManager, fileManager, apiManager) {
    if (!WallpaperManager._instance) {
      WallpaperManager._instance = new WallpaperManager(
        logger,
        dbManager,
        settingManager,
        fileManager,
        apiManager
      )
    }
    return WallpaperManager._instance
  }
}
```

**壁纸设置功能：**

```js
async setAsWallpaper(item, isAddToHistory = false, isResetParams = false) {
  if (!item || !item.filePath || !fs.existsSync(item.filePath)) {
    return { success: false, message: t('messages.fileNotExist') }
  }

  try {
    let res
    // 检查文件类型，如果是视频则设置为动态壁纸
    if (item.fileType === 'video') {
      res = await this.setDynamicWallpaper(item.filePath)
    } else {
      // 关闭视频壁纸
      this.closeDynamicWallpaper()
      // 设置静态壁纸
      res = await this.setImageWallpaper(item.filePath)
    }

    // 记录到历史记录
    if (isAddToHistory) {
      const insert_stmt = this.db.prepare(`INSERT INTO fbw_history (resourceId) VALUES (?)`)
      insert_stmt.run(item.id)
    }

    return { success: true, message: t('messages.setWallpaperSuccess') }
  } catch (err) {
    return { success: false, message: t('messages.setWallpaperFail') }
  }
}
```

### 2. 图片壁纸设置

**使用 wallpaper 库设置壁纸：**

```js
async setImageWallpaper(imgPath) {
  if (!imgPath || !fs.existsSync(imgPath)) {
    return { success: false, message: t('messages.fileNotExist') }
  }

  try {
    await setWallpaper(imgPath, {
      screen: this.settingData.allScreen && isMac() ? 'all' : 'main',
      scale: this.settingData.scaleType
    })

    return { success: true, message: t('messages.setWallpaperSuccess') }
  } catch (err) {
    return { success: false, message: t('messages.setWallpaperFail') }
  }
}
```

### 3. 纯色壁纸设置

**创建纯色 BMP 图片：**

```js
async setColorWallpaper(color) {
  if (!color) {
    return { success: false, message: t('messages.paramsError') }
  }

  try {
    const buffer = createSolidColorBMP(color)
    const colorImagePath = path.join(process.env.FBW_TEMP_PATH, 'fbw-color-wallpaper.png')
    fs.writeFileSync(colorImagePath, buffer)
    return await this.setImageWallpaper(colorImagePath)
  } catch (err) {
    return { success: false, message: t('messages.setWallpaperFail') }
  }
}
```

**BMP 图片生成算法：**

```js
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

### 4. 网页壁纸设置

**网页截图功能：**

```js
async getWebImage(url) {
  let tempWindow = null
  try {
    const { width, height } = screen.getPrimaryDisplay().workAreaSize
    // 创建一个隐藏的窗口来加载网页
    tempWindow = new BrowserWindow({
      width, height,
      show: false,
      webPreferences: { offscreen: true }
    })

    await tempWindow.loadURL(url)
    await new Promise((resolve) => setTimeout(resolve, 2000))

    // 捕获页面截图
    const image = await tempWindow.webContents.capturePage()
    const pngData = image.toPNG()

    const downloadFilePath = path.join(process.env.FBW_DOWNLOAD_PATH, 'wallpaper.png')
    fs.writeFileSync(downloadFilePath, pngData)

    return downloadFilePath
  } catch (err) {
    return null
  } finally {
    if (tempWindow) {
      tempWindow.destroy()
    }
  }
}
```

---

## 渲染进程功能实现

### 1. 壁纸设置界面

**设置页面壁纸操作：**

```js
// 设置网页壁纸
const onSetWebWallpaper = async () => {
  flags.settingWebWallpaper = true
  const res = await window.FBW.setWebWallpaper()
  flags.settingWebWallpaper = false
  ElMessage({
    type: res.success ? 'success' : 'error',
    message: res.message
  })
}

// 设置颜色壁纸
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

### 2. 探索页面壁纸设置

**图片卡片壁纸设置：**

```js
// 设置为壁纸
const setAsWallpaperWithDownload = async (item, index) => {
  const res = await window.FBW.setAsWallpaperWithDownload(toRaw(item))
  let options = {}
  if (res && res.success) {
    options.type = 'success'
    options.message = res.message
    setCardItemStatus(index, 'success')
  } else {
    options.type = 'error'
    options.message = res.message
    setCardItemStatus(index, 'error')
  }
  ElMessage(options)
}
```

### 3. 工具页面功能

**动态壁纸设置：**

```js
const onSetDynamicWallpaper = async () => {
  const selectFileRes = await window.FBW.selectFile('video')
  const videoPath = selectFileRes && !selectFileRes.canceled ? selectFileRes.filePaths[0] : null
  if (!videoPath) {
    ElMessage({ type: 'error', message: t('messages.operationFail') })
    return
  }
  const setRes = await window.FBW.setDynamicWallpaper(videoPath)
  ElMessage({
    type: setRes.success ? 'success' : 'error',
    message: setRes.message
  })
}
```

---

## 进程间通信 (IPC)

### 1. 主进程 IPC 处理器

**壁纸相关 IPC 处理：**

```js
// 设置为壁纸
ipcMain.handle('main:setAsWallpaperWithDownload', async (event, item) => {
  return await this.wallpaperManager.setAsWallpaperWithDownload(item)
})

// 切换壁纸
ipcMain.handle('main:nextWallpaper', async () => {
  return this.doManualSwitchWallpaper('next')
})

// 切换至上一个壁纸
ipcMain.handle('main:prevWallpaper', async () => {
  return this.doManualSwitchWallpaper('prev')
})

// 设置网页壁纸
ipcMain.handle('main:setWebWallpaper', (event, url) => {
  return this.setWebWallpaper(url)
})

// 设置颜色壁纸
ipcMain.handle('main:setColorWallpaper', (event, color) => {
  return this.setColorWallpaper(color)
})

// 启停定时切换壁纸
ipcMain.handle('main:toggleAutoSwitchWallpaper', async () => {
  return this.toggleAutoSwitchWallpaper()
})
```

### 2. 渲染进程 IPC 调用

**预加载脚本 API：**

```js
const api = {
  // 壁纸操作
  search: (...args) => ipcRenderer.invoke('main:search', ...args),
  toggleAutoSwitchWallpaper: (...args) =>
    ipcRenderer.invoke('main:toggleAutoSwitchWallpaper', ...args),
  setAsWallpaperWithDownload: (...args) =>
    ipcRenderer.invoke('main:setAsWallpaperWithDownload', ...args),
  nextWallpaper: (...args) => ipcRenderer.invoke('main:nextWallpaper', ...args),
  prevWallpaper: (...args) => ipcRenderer.invoke('main:prevWallpaper', ...args),
  setWebWallpaper: (...args) => ipcRenderer.invoke('main:setWebWallpaper', ...args),
  setColorWallpaper: (...args) => ipcRenderer.invoke('main:setColorWallpaper', ...args),

  // 动态壁纸相关API
  selectVideoFile: () => ipcRenderer.invoke('main:selectVideoFile'),
  setDynamicWallpaper: (...args) => ipcRenderer.invoke('main:setDynamicWallpaper', ...args)
}
```

---

## 壁纸切换算法

### 1. 智能切换策略

**随机切换逻辑：**

```js
// 如果有最近使用记录，尝试排除这些记录
if (recentIds.length > 0) {
  // 先检查排除最近记录后是否还有壁纸可用
  const check_stmt = this.db.prepare(
    `SELECT COUNT(*) AS count FROM fbw_resources 
     ${query_where_str ? query_where_str + ' AND' : 'WHERE'}
     id NOT IN (${recentIds.map(() => '?').join(',')})`
  )
  const check_result = check_stmt.get(...check_params)

  if (check_result && check_result.count > 0) {
    // 从未使用的壁纸中随机选择
    query_sql = `
      SELECT * FROM fbw_resources
      ${query_where_str ? query_where_str + ' AND' : 'WHERE'}
      id NOT IN (${recentIds.map(() => '?').join(',')})
      ORDER BY RANDOM() LIMIT 1
    `
  } else {
    // 从所有符合条件的壁纸中随机选择
    query_sql = `SELECT * FROM fbw_resources ${query_where_str} ORDER BY RANDOM() LIMIT 1`
  }
}
```

### 2. 顺序切换逻辑

**收藏夹顺序切换：**

```js
// 如果有上一次切换的ID，则从该ID之后开始查询
if (prevSourceId) {
  const favSortField = 'created_at'
  const index_stmt = this.db.prepare(
    `SELECT f.${favSortField} FROM fbw_favorites f WHERE f.resourceId = ?`
  )
  const index_result = index_stmt.get(prevSourceId)

  if (index_result && index_result[favSortField] !== undefined) {
    query_sql = `
      SELECT r.* FROM fbw_resources r
      JOIN fbw_favorites f ON r.id = f.resourceId
      ${query_where_str ? query_where_str + ' AND' : 'WHERE'}
      f.${favSortField} ${sortType === -1 ? '<=' : '>='} ?
      ORDER BY f.${favSortField} ${sortType === -1 ? 'DESC' : 'ASC'}
      LIMIT 1
    `
  }
}
```

---

## 操作系统差异处理

### 1. macOS 特殊处理

**多屏幕支持：**

```js
await setWallpaper(imgPath, {
  screen: this.settingData.allScreen && isMac() ? 'all' : 'main',
  scale: this.settingData.scaleType
})
```

**动态壁纸窗口设置：**

```js
if (isMac()) {
  this.win.setHasShadow(false)
  this.win.setVisibleOnAllWorkspaces(true)
  this.win.setFullScreenable(false)
  // 隐藏 dock 图标
  app.dock.hide()
}
```

### 2. Windows 特殊处理

**动态壁纸窗口设置：**

```js
if (isWin()) {
  // 设置点击穿透
  this.win.setIgnoreMouseEvents(true, { forward: true })

  // 同时设置纯色背景壁纸图片，提高视角体验
  const dynamicBackgroundColor = global.FBW.store?.settingData?.dynamicBackgroundColor || '#FFFFFF'
  await global.FBW.store?.wallpaperManager.setColorWallpaper(dynamicBackgroundColor)
  setWindowsDynamicWallpaper(this.win.getNativeWindowHandle().readInt32LE(0))
}
```

**Windows 动态壁纸底层实现：**

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

  // 要触发在桌面图标和墙纸之间创建WorkerW窗口
  const progman = FindWindowW(TEXT('Progman'), null)

  // 发送未记录的消息 0x052C
  SendMessageTimeoutW(progman, 0x052c, 0, 0, 0x0000, 1000, 0)

  // 查找 WorkerW 窗口并设置父窗口
  const workerW = FindWindowExW(null, null, 'WorkerW', null)
  SetParent(handlers, workerW)
}
```

### 3. Linux 支持

**基础壁纸设置：**

```js
// Linux 使用标准的 wallpaper 库支持
await setWallpaper(imgPath, {
  screen: 'main',
  scale: this.settingData.scaleType
})
```

---

## 数据管理

### 1. 数据库表结构

**资源表 (fbw_resources)：**

```sql
CREATE TABLE fbw_resources (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  resourceName TEXT,
  fileName TEXT,
  filePath TEXT UNIQUE,
  fileExt TEXT,
  fileType TEXT,
  fileSize INTEGER,
  imageUrl TEXT,
  videoUrl TEXT,
  author TEXT,
  link TEXT,
  title TEXT,
  desc TEXT,
  quality TEXT,
  width INTEGER,
  height INTEGER,
  isLandscape INTEGER,
  atimeMs INTEGER,
  mtimeMs INTEGER,
  ctimeMs INTEGER
)
```

**历史记录表 (fbw_history)：**

```sql
CREATE TABLE fbw_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  resourceId INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
)
```

### 2. 下载管理

**网络图片下载：**

```js
async setAsWallpaperWithDownload(item) {
  if (item.srcType === 'url' && (item.imageUrl || item.videoUrl)) {
    const { downloadFolder } = this.settingData
    const downloadUrl = isVideo ? item.videoUrl : item.imageUrl

    // 生成文件名
    const fileName = `${item.fileName}.${item.fileExt}`
    const filePath = path.join(downloadFolder, fileName)

    // 下载文件
    const response = await axios({
      method: 'GET',
      url: downloadUrl,
      responseType: 'stream'
    })

    const writer = fs.createWriteStream(filePath)
    response.data.pipe(writer)

    await new Promise((resolve, reject) => {
      writer.on('finish', resolve)
      writer.on('error', reject)
    })

    // 插入到数据库并设置为壁纸
    const insert_result = insert_stmt.run({...})
    if (insert_result.changes > 0) {
      const query_result = query_stmt.get(insert_result.lastInsertRowid)
      return await this.setAsWallpaper(query_result, true, true)
    }
  }
}
```

---

## 性能优化

### 1. 缓存机制

**文件系统缓存：**

```js
const fsCache = {
  directories: {},
  lastUpdate: Date.now(),
  ttl: 60000 // 1分钟缓存
}

// 检查缓存是否存在且有效
if (fsCache.directories[cacheKey] && Date.now() - fsCache.lastUpdate < fsCache.ttl) {
  return cachedFiles
}
```

### 2. 批量处理

**大量文件处理：**

```js
const processBatch = async (files, batchSize = 1000) => {
  const results = []
  for (let i = 0; i < files.length; i += batchSize) {
    const batch = files.slice(i, i + batchSize)
    results.push(...batch)
    // 允许事件循环处理其他任务
    await new Promise((resolve) => setTimeout(resolve, 0))
  }
  return results
}
```

### 3. 增量更新

**只处理变更文件：**

```js
const filesToProcess = validFiles.filter((file) => {
  const existingFile = existingFilesMap.get(file.filePath)
  return !existingFile || file.stats.mtimeMs > existingFile.mtimeMs
})
```

---

## 错误处理

### 1. 文件验证

**文件存在性检查：**

```js
if (!item || !item.filePath || !fs.existsSync(item.filePath)) {
  return {
    success: false,
    message: t('messages.fileNotExist')
  }
}
```

### 2. 异常捕获

**统一错误处理：**

```js
try {
  // 壁纸设置逻辑
  return { success: true, message: t('messages.setWallpaperSuccess') }
} catch (err) {
  this.logger.error(`设置壁纸失败: error => ${err}`)
  return {
    success: false,
    message: t('messages.setWallpaperFail')
  }
}
```

### 3. 数据库事务

**数据一致性保证：**

```js
try {
  const insert_result = insert_stmt.run({...})
  if (insert_result.changes > 0) {
    // 查询插入的记录并设置为壁纸
  }
} catch (err) {
  // 处理唯一键冲突
  if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
    // 查询已存在的记录
    const query_result = query_stmt.get(filePath)
    if (query_result) {
      return await this.setAsWallpaper(query_result, true, true)
    }
  }
}
```

---

## 国际化支持

### 1. 多语言消息

**使用 i18n 框架：**

```js
import { t } from '../../i18n/server.js'

return {
  success: false,
  message: t('messages.fileNotExist')
}
```

### 2. 错误消息本地化

**统一消息管理：**

```js
// 成功消息
message: t('messages.setWallpaperSuccess')

// 错误消息
message: t('messages.setWallpaperFail')
message: t('messages.paramsError')
message: t('messages.downloadFolderNotExistOrNotSet')
```

---

## 扩展功能

### 1. 自动切换

**定时切换壁纸：**

```js
// 启停定时切换壁纸
ipcMain.handle('main:toggleAutoSwitchWallpaper', async () => {
  return this.toggleAutoSwitchWallpaper()
})
```

### 2. 收藏管理

**收藏夹操作：**

```js
// 加入收藏夹
ipcMain.handle('main:addToFavorites', async (event, resourceId, isPrivacySpace = false) => {
  return await this.resourcesManager.addToFavorites(resourceId, isPrivacySpace)
})

// 移出收藏夹
ipcMain.handle('main:removeFavorites', async (event, resourceId, isPrivacySpace = false) => {
  return await this.resourcesManager.removeFavorites(resourceId, isPrivacySpace)
})
```

### 3. 隐私空间

**隐私保护功能：**

```js
// 验证隐私空间密码
ipcMain.handle('main:checkPrivacyPassword', async (event, password) => {
  return await this.settingManager.checkPrivacyPassword(password)
})

// 检查是否设置了隐私密码
ipcMain.handle('main:hasPrivacyPassword', async () => {
  return await this.settingManager.hasPrivacyPassword()
})
```

---

## 技术特点

### 1. 跨平台兼容

- 支持 Windows、macOS、Linux 三大操作系统
- 针对不同平台提供优化的壁纸设置方案
- 统一的 API 接口，简化跨平台开发

### 2. 高性能设计

- 文件系统缓存减少重复 I/O
- 批量处理和增量更新优化性能
- 异步操作避免阻塞主线程

### 3. 数据安全

- SQLite 数据库保证数据一致性
- 事务处理防止数据损坏
- 隐私空间保护敏感数据

### 4. 用户体验

- 智能切换算法避免重复壁纸
- 实时反馈和错误提示
- 多语言界面支持
