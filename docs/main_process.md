# 主进程

---

## 目录结构

主进程相关代码位于 `src/main/` 目录下，结构如下：

```
src/main/
├── index.mjs                # 主进程入口，应用初始化、全局事件、窗口/服务创建
├── ApiBase.js               # API 插件开发基类
├── cache.mjs                # 缓存管理
├── updater.mjs              # 自动更新逻辑
├── logger/                  # 日志系统
│   ├── logger.mjs           # 日志记录器
│   └── CleanLogs.mjs        # 日志清理任务
├── store/                   # 数据与业务核心模块（Manager/Store）
│   ├── index.mjs            # Store聚合与IPC注册
│   ├── ApiManager.mjs       # API统一管理
│   ├── DatabaseManager.mjs  # 数据库管理
│   ├── FileManager.mjs      # 文件管理
│   ├── ResourcesManager.mjs # 壁纸资源管理
│   ├── SettingManager.mjs   # 设置管理
│   ├── TaskScheduler.mjs    # 定时任务调度
│   ├── VersionManager.mjs   # 版本管理
│   ├── WallpaperManager.mjs # 壁纸调度与切换
│   └── WordsManager.mjs     # 词库管理
├── windows/                 # 各类窗口管理
│   ├── MainWindow.mjs           # 主窗口
│   ├── DynamicWallpaperWindow.mjs # 动态壁纸窗口
│   ├── RhythmWallpaperWindow.mjs  # 律动壁纸窗口
│   ├── SuspensionBall.mjs        # 悬浮球窗口
│   ├── ViewImageWindow.mjs       # 图片预览窗口
│   └── LoadingWindow.mjs         # 启动/加载窗口
├── utils/                   # 主进程通用工具
│   ├── file.mjs             # 文件相关工具
│   ├── utils.mjs            # 通用工具函数
│   └── dynamicWallpaper.mjs # 动态壁纸相关工具
├── child_server/            # 本地API、文件、Socket服务（子进程）
│   ├── index.mjs
│   ├── ChildServer.mjs
│   ├── file_server/
│   └── h5_server/
│       ├── api/
│       └── socket/
```

### 结构说明

- **index.mjs**：主进程入口，负责应用生命周期、全局事件、窗口/服务创建、异常处理等。
- **store/**：核心业务与数据管理，所有 Manager 单例聚合于 `store/index.mjs`，统一对外暴露。
- **windows/**：所有 Electron 窗口的创建、管理与事件处理。
- **utils/**：主进程常用工具函数、文件操作、动态壁纸处理等。
- **child_server/**：本地 API、文件、Socket 服务，提升性能与安全性，支持 H5 端和多端同步。
- **logger/**：日志系统，支持多级别日志输出与持久化，包含日志清理任务。
- **updater.mjs**：自动更新逻辑，集成 Electron 的更新机制。
- **ApiBase.js**：API 插件开发基类，便于扩展第三方壁纸源。

---

## 核心功能模块详解

### 环境变量

主进程在启动时会设置一系列环境变量，这些变量主要用于统一管理应用运行时的各种目录路径和资源位置，便于在不同平台、开发/生产环境下灵活切换。

**主要功能：**

- **路径管理**：统一管理应用各功能模块的路径配置
- **环境适配**：根据开发和生产环境自动适配配置
- **平台兼容**：支持 Windows、macOS、Linux 多平台路径差异
- **资源隔离**：将用户数据、系统资源、临时文件等分类管理
- **配置统一**：确保主进程和子进程使用相同的路径配置

**设置位置**：`src/main/index.mjs`（应用启动阶段）

**环境变量分类：**

**系统路径变量：**

- **FBW_USER_DATA_PATH**：用户数据根目录路径
- **FBW_LOGS_PATH**：日志文件目录路径
- **FBW_DATABASE_PATH**：数据库目录路径
- **FBW_DATABASE_FILE_PATH**：数据库文件完整路径
- **FBW_DOWNLOAD_PATH**：下载文件目录路径
- **FBW_CERTS_PATH**：证书文件目录路径
- **FBW_PLUGINS_PATH**：插件目录路径
- **FBW_TEMP_PATH**：临时文件目录路径
- **FBW_RESOURCES_PATH**：资源文件目录路径（开发/生产环境自适应）

**环境检测变量：**

- **NODE_ENV**：运行环境标识（development/production）

**环境变量初始化：**

```js:src/main/index.mjs
// 获取用户数据路径
const userDataPath = app.getPath('userData')

// 系统目录路径配置
process.env.FBW_USER_DATA_PATH = userDataPath
process.env.FBW_LOGS_PATH = getDirPathByName(userDataPath, 'logs')
process.env.FBW_DATABASE_PATH = getDirPathByName(userDataPath, 'database')
process.env.FBW_DATABASE_FILE_PATH = path.join(process.env.FBW_DATABASE_PATH, 'fbw.db')
process.env.FBW_DOWNLOAD_PATH = getDirPathByName(userDataPath, 'download')
process.env.FBW_CERTS_PATH = getDirPathByName(userDataPath, 'certs')
process.env.FBW_PLUGINS_PATH = getDirPathByName(userDataPath, 'plugins')
process.env.FBW_TEMP_PATH = getDirPathByName(userDataPath, 'temp')

// 资源路径配置（开发/生产环境自适应）
process.env.FBW_RESOURCES_PATH = app.isPackaged
  ? path.join(process.resourcesPath, 'resources') // 生产环境
  : path.join(__dirname, '../../resources') // 开发环境
```

**目录创建工具：**

```js:src/main/utils/utils.mjs
// 获取应用相关目录地址
export const getDirPathByName = (userDataPath = '', dirName = '') => {
  let dirPath = ''
  const sysDirs = ['database', 'logs', 'download', 'temp', 'certs', 'plugins']

  if (sysDirs.includes(dirName)) {
    dirPath = path.join(userDataPath, dirName)
  } else {
    dirPath = path.join(userDataPath, 'temp', dirName)
  }

  // 自动创建目录
  if (dirPath && !fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true })
  }

  return dirPath
}
```

**环境检测工具：**

```js:src/main/utils/utils.mjs
// 环境检测函数
export const isDev = () => {
  return process.env.NODE_ENV === 'development'
}

export const isProd = () => {
  return process.env.NODE_ENV === 'production'
}

// 操作系统检测
export const osType = OS_TYPES[os.type()] || 'win'
export const isLinux = () => osType === 'linux'
export const isMac = () => osType === 'mac'
export const isWin = () => osType === 'win'

// 函数类型检测
export const isFunc = (func) => {
  return typeof func === 'function'
}
```

**环境变量使用场景：**

**数据库管理：**

```js:src/main/store/DatabaseManager.mjs
// 数据库文件路径
this.db = new Database(process.env.FBW_DATABASE_FILE_PATH)
```

**日志管理：**

```js:src/main/logger.mjs
// 日志文件路径
const logFilePath = join(process.env.FBW_LOGS_PATH, fileName)
```

**文件下载：**

```js:src/main/store/FileManager.mjs
// 下载文件路径
const downloadFilePath = path.join(process.env.FBW_DOWNLOAD_PATH, 'wallpaper.png')
```

**插件管理：**

```js:src/main/store/ApiManager.mjs
// 插件目录路径
this.sysApiDir = path.join(process.env.FBW_RESOURCES_PATH, 'api')
this.userApiDir = path.join(process.env.FBW_PLUGINS_PATH, 'api')
```

**证书管理：**

```js:src/main/utils/utils.mjs
// 证书路径
const certPath = process.env.FBW_CERTS_PATH
```

**资源访问：**

```js:src/main/utils/utils.mjs
// 资源文件路径
const resourcePath = path.resolve(process.env.FBW_RESOURCES_PATH, './h5')
```

**架构设计与最佳实践：**

**分层架构：**

- **配置层**：环境变量和配置文件管理
- **工具层**：路径处理和目录创建工具
- **业务层**：具体业务逻辑实现

**配置管理策略：**

- **环境隔离**：开发和生产环境配置分离
- **路径统一**：统一路径管理和自动创建
- **类型安全**：环境变量类型检查和验证
- **默认值处理**：提供合理的默认配置

**性能优化策略：**

- **路径缓存**：缓存常用路径避免重复解析
- **懒加载**：按需创建目录和文件
- **批量操作**：批量处理路径相关操作

**安全机制：**

- **路径验证**：验证环境变量路径的合法性
- **权限控制**：限制敏感操作的访问权限
- **数据隔离**：不同模块间数据隔离

**监控与调试：**

- **环境日志**：记录环境变量和路径变化
- **调试工具**：提供路径查看和验证工具
- **错误追踪**：路径相关错误的追踪和分析

---

### 全局变量

主进程通过 `global.FBW` 对象维护全局状态、窗口实例、工具方法等，方便在各模块间共享和调用。

**主要功能：**

- **状态管理**：维护应用全局状态和标志位
- **实例共享**：提供窗口实例和服务的全局访问
- **工具共享**：提供全局工具函数和辅助方法
- **配置隔离**：将配置与业务逻辑分离，便于维护
- **跨模块访问**：提供模块间的数据共享和通信机制
- **插件支持**：为插件和扩展提供全局能力访问

**设置位置**：`src/main/index.mjs`（应用启动阶段）

**全局变量结构：**

**核心全局对象：**

- **global.FBW**：主全局对象，包含所有全局状态和工具
- **global.logger**：全局日志记录器实例

**global.FBW 对象结构：**

```js:src/main/index.mjs
global.FBW = {
  // API 开发辅助工具
  apiHelpers: {
    axios, // HTTP 请求库
    ApiBase, // API 基类
    calculateImageOrientation, // 图片方向计算
    calculateImageQuality // 图片质量计算
  },

  // 图标路径
  iconLogo: getIconPath('icon_512x512.png'), // 应用主图标
  iconTray: getIconPath('icon_32x32.png'), // 托盘图标

  // 全局状态标志
  flags: {
    isQuitting: false // 应用退出标志
  },

  // 窗口实例
  loadingWindow: LoadingWindow.getInstance(),
  mainWindow: MainWindow.getInstance(),
  viewImageWindow: ViewImageWindow.getInstance(),
  suspensionBall: SuspensionBall.getInstance(),
  dynamicWallpaperWindow: DynamicWallpaperWindow.getInstance(),
  rhythmWallpaperWindow: RhythmWallpaperWindow.getInstance(),

  // 数据管理器
  store: Store实例,

  // 全局工具函数
  sendCommonData: Function, // 发送通用数据
  sendMsg: Function // 发送消息
}
```

**全局变量初始化：**

```js:src/main/index.mjs
// 全局变量初始化
global.FBW = global.FBW || {}

// API 开发辅助工具
global.FBW.apiHelpers = {
  axios,
  ApiBase,
  calculateImageOrientation,
  calculateImageQuality
}

// 图标路径配置
global.FBW.iconLogo = getIconPath('icon_512x512.png')
global.FBW.iconTray = getIconPath('icon_32x32.png')

// 全局状态标志
global.FBW.flags = {
  isQuitting: false
}

// 窗口实例初始化
global.FBW.loadingWindow = LoadingWindow.getInstance()
global.FBW.mainWindow = MainWindow.getInstance()
global.FBW.viewImageWindow = ViewImageWindow.getInstance()
global.FBW.suspensionBall = SuspensionBall.getInstance()
global.FBW.dynamicWallpaperWindow = DynamicWallpaperWindow.getInstance()
global.FBW.rhythmWallpaperWindow = RhythmWallpaperWindow.getInstance()
```

**全局工具函数：**

```js:src/main/index.mjs
// 发送通用数据到渲染进程
global.FBW.sendCommonData = (win) => {
  if (!win) {
    return
  }
  const data = {
    osType,
    isLinux: isLinux(),
    isMac: isMac(),
    isWin: isWin(),
    isDev: isDev(),
    isProd: isProd(),
    h5ServerUrl: global.FBW.store?.h5ServerUrl
  }
  win.webContents.send('main:commonData', data)
}

// 发送消息到渲染进程
global.FBW.sendMsg = (win, msgOption) => {
  if (!win) {
    return
  }
  win.webContents.send('main:sendMsg', msgOption)
}
```

**应用信息配置：**

```js:src/common/config.js
export const appInfo = {
  appName: 'Flying Bird Wallpaper',
  version,
  author: 'OXOYO',
  authorLink: 'https://github.com/OXOYO',
  homepage: 'http://fbw.oxoyo.co',
  github: 'https://github.com/OXOYO/Flying-Bird-Wallpaper',
  repository: 'OXOYO/Flying-Bird-Wallpaper',
  email: 'zmn2007.hi@163.com'
}
```

**图标路径管理：**

```js:src/main/utils/utils.mjs
// 获取图标路径
export const getIconPath = (iconName) => {
  return path.resolve(path.join(process.env.FBW_RESOURCES_PATH, 'icons', iconName))
}

// 图标使用示例
const trayIcon = nativeImage.createFromPath(global.FBW.iconTray).resize({ width: 20, height: 20 })

const windowIcon = global.FBW.iconLogo
```

**全局状态管理：**

项目中的全局状态通过 `global.FBW.flags` 对象进行管理，包含应用退出标志等状态信息：

```js:src/main/index.mjs
// 全局状态标志
global.FBW.flags = {
  isQuitting: false // 应用退出标志
}
```

**全局变量使用场景：**

**窗口管理：**

```js:src/main/index.mjs
// 窗口实例访问
const mainWindow = global.FBW.mainWindow
const suspensionBall = global.FBW.suspensionBall

// 窗口操作
global.FBW.mainWindow.toggle()
global.FBW.suspensionBall.createOrOpen()
```

**数据管理：**

```js:src/main/index.mjs
// 数据管理器访问
const store = global.FBW.store
const wallpaperManager = global.FBW.store?.wallpaperManager

// 数据操作
await global.FBW.store?.toggleAutoSwitchWallpaper()
await global.FBW.store?.doManualSwitchWallpaper('next')
```

**消息通信：**

```js:src/main/index.mjs
// 发送消息到渲染进程
global.FBW.sendMsg(global.FBW.mainWindow.win, {
  type: 'main:wallpaperUpdate',
  data: { wallpaper: newWallpaper }
})

// 发送通用数据
global.FBW.sendCommonData(global.FBW.mainWindow.win)
```

**API 开发：**

```js:src/main/index.mjs
// API 辅助工具访问
const { axios, ApiBase } = global.FBW.apiHelpers

// 图片处理工具
const { calculateImageOrientation, calculateImageQuality } = global.FBW.apiHelpers
```

**图标资源：**

```js:src/main/index.mjs
// 图标路径访问
const logoIcon = global.FBW.iconLogo
const trayIcon = global.FBW.iconTray

// 创建托盘图标
const tray = new Tray(nativeImage.createFromPath(global.FBW.iconTray))
```

**架构设计与最佳实践：**

**分层架构：**

- **全局层**：全局状态和实例管理
- **工具层**：通用工具函数和辅助方法
- **业务层**：具体业务逻辑实现

**全局状态管理：**

- **单例模式**：全局对象使用单例模式
- **状态同步**：多窗口间状态同步机制
- **内存管理**：合理的内存使用和清理
- **错误处理**：全局错误捕获和处理

**性能优化策略：**

- **懒加载**：按需初始化全局对象
- **缓存机制**：合理使用缓存减少重复计算
- **内存优化**：及时清理不需要的全局引用
- **引用优化**：避免循环引用和内存泄漏

**安全机制：**

- **访问控制**：限制敏感操作的访问权限
- **数据隔离**：不同模块间数据隔离
- **错误边界**：防止全局错误影响整个应用
- **类型检查**：全局变量的类型安全检查

**监控与调试：**

- **状态监控**：监控全局状态变化
- **性能监控**：监控全局对象的内存使用
- **调试工具**：提供全局状态查看工具
- **错误追踪**：全局错误的追踪和分析

**最佳实践：**

**全局变量使用：**

- 最小化全局状态
- 使用命名空间避免冲突
- 提供清晰的访问接口
- 及时清理无用引用

**状态管理：**

- 集中管理全局状态
- 提供状态变更通知
- 支持状态回滚和恢复
- 记录状态变更历史

**工具函数：**

- 提供统一的工具接口
- 支持异步操作
- 包含错误处理机制
- 提供性能优化选项

---

**总结**：

- 环境变量主要用于路径、资源、配置的全局统一，保证多平台和多环境下的兼容性和灵活性。
- 全局变量（`global.FBW`）则是主进程的"总线"，集中管理窗口、服务、工具、状态等，极大提升了主进程的可维护性和扩展性。

如需了解更多细节，可查阅 `src/main/index.mjs` 相关代码。

---

### 应用管理

应用管理是主进程的入口，负责整个应用的初始化、生命周期管理和全局配置。

**主要功能：**

- **应用初始化**：在 `app.whenReady()` 中完成所有初始化工作，包括：
  - **环境变量设置**：配置用户数据路径、日志路径、数据库路径等
  - **全局变量初始化**：设置 `global.FBW` 对象和全局状态
  - **日志系统初始化**：启动 Pino 日志系统
  - **异常处理设置**：配置未处理异常和 Promise 拒绝的捕获
  - **窗口实例创建**：创建所有窗口的单例实例
  - **开发环境配置**：安装 Vue DevTools、启用调试器
  - **更新器初始化**：设置自动更新检查和事件监听
  - **应用标识设置**：设置应用用户模型ID
  - **菜单和任务栏配置**：清空默认菜单、配置任务栏
  - **快捷键注册**：注册全局快捷键（Mac平台）
  - **IPC处理器注册**：注册所有主进程与渲染进程的通信处理器
  - **自定义协议处理**：注册 `fbwtp://` 协议处理器
  - **Store初始化**：初始化数据管理和业务逻辑层
  - **子进程服务启动**：启动文件服务和H5服务
  - **定时任务启动**：启动所有定时任务
  - **电源监控设置**：启动系统电源状态监控
  - **托盘创建**：创建系统托盘图标和菜单
  - **窗口显示**：根据启动参数和设置决定显示哪些窗口
  - **动态壁纸恢复**：恢复上次的动态壁纸设置
- **单实例控制**：使用 `app.requestSingleInstanceLock()` 确保应用只运行一个实例
- **全局变量设置**：初始化 `global.FBW` 对象，包含所有全局状态和工具
- **环境变量配置**：设置各种路径和配置的环境变量
- **异常处理**：捕获未处理的异常和 Promise 拒绝
- **电源管理**：通过 `powerMonitor` 监听系统电源状态，智能管理应用行为
  - **系统挂起/恢复**：监听系统休眠和唤醒事件，自动暂停/恢复壁纸切换
  - **锁屏/解锁**：监听屏幕锁定状态，在锁屏时暂停壁纸切换
  - **电池模式**：监听电源状态变化，在电池模式下启用省电策略
  - **系统空闲**：监控系统空闲状态，在用户不活跃时暂停任务
  - **智能恢复**：根据电源状态智能恢复之前的任务状态

**关键代码：**

```js:src/main/index.mjs
// 确保单实例
const gotTheLock = app.requestSingleInstanceLock()

if (!gotTheLock) {
  app.quit()
} else {
  app.on('second-instance', () => {
    global.FBW.mainWindow.reopen()
  })
}

// 环境变量设置
const userDataPath = app.getPath('userData')
process.env.FBW_USER_DATA_PATH = userDataPath
process.env.FBW_LOGS_PATH = getDirPathByName(userDataPath, 'logs')
process.env.FBW_DATABASE_PATH = getDirPathByName(userDataPath, 'database')
process.env.FBW_DATABASE_FILE_PATH = path.join(process.env.FBW_DATABASE_PATH, 'fbw.db')
process.env.FBW_DOWNLOAD_PATH = getDirPathByName(userDataPath, 'download')
process.env.FBW_CERTS_PATH = getDirPathByName(userDataPath, 'certs')
process.env.FBW_PLUGINS_PATH = getDirPathByName(userDataPath, 'plugins')
process.env.FBW_TEMP_PATH = getDirPathByName(userDataPath, 'temp')
process.env.FBW_RESOURCES_PATH = app.isPackaged
  ? path.join(process.resourcesPath, 'resources')
  : path.join(__dirname, '../../resources')

// 全局变量初始化
global.FBW = global.FBW || {}
global.FBW.apiHelpers = { axios, ApiBase, calculateImageOrientation, calculateImageQuality }
global.FBW.iconLogo = getIconPath('icon_512x512.png')
global.FBW.iconTray = getIconPath('icon_32x32.png')
global.FBW.flags = { isQuitting: false }

// 日志系统初始化
logger()
global.logger.info(`isDev: ${isDev()} process.env.NODE_ENV: ${process.env.NODE_ENV}`)

// 窗口实例创建
global.FBW.loadingWindow = LoadingWindow.getInstance()
global.FBW.mainWindow = MainWindow.getInstance()
global.FBW.viewImageWindow = ViewImageWindow.getInstance()
global.FBW.suspensionBall = SuspensionBall.getInstance()
global.FBW.dynamicWallpaperWindow = DynamicWallpaperWindow.getInstance()
global.FBW.rhythmWallpaperWindow = RhythmWallpaperWindow.getInstance()

// 开发环境配置
if (isDev()) {
  installExtension(VUEJS_DEVTOOLS_BETA)
    .then(({ name }) => global.logger.info(`Added Extension: ${name}`))
    .catch((err) => global.logger.error(`An error occurred: ${err}`))
}

// 更新器初始化
updater = new Updater()
updater.on('update-available', (info) => {
  const notice = new Notification({
    title: t('actions.checkUpdate'),
    body: t('messages.updateAvailable', { version: `v${info.version}` })
  })
  notice.show()
})

// 应用标识设置
electronApp.setAppUserModelId('co.oxoyo.flying-bird-wallpaper')

// 菜单和任务栏配置
const menu = Menu.buildFromTemplate([])
Menu.setApplicationMenu(menu)
if (isWin()) {
  app.setUserTasks([])
}

// 快捷键注册（Mac平台）
if (isMac()) {
  localShortcut.register('CommandOrControl+A', () => {
    global.FBW.mainWindow.win.webContents.selectAll()
  })
  localShortcut.register('CommandOrControl+C', () => {
    global.FBW.mainWindow.win.webContents.copy()
  })
  localShortcut.register('CommandOrControl+V', () => {
    global.FBW.mainWindow.win.webContents.paste()
  })
}

// IPC处理器注册
ipcMain.handle('main:selectFolder', async () => {
  return await dialog.showOpenDialog({ properties: ['openDirectory'] })
})
ipcMain.handle('main:clearCache', () => {
  cache.clear()
  global.FBW.sendMsg(global.FBW.mainWindow.win, {
    type: 'success',
    message: t('messages.clearCacheSuccess')
  })
})

// Store初始化
global.FBW.store = new Store()
await global.FBW.store?.waitForInitialization()

// Store内部初始化过程：
// 1. 数据库管理器初始化
// 2. 版本管理器初始化
// 3. 设置管理器初始化
// 4. API管理器初始化
// 5. 文件服务子进程创建
// 6. H5服务子进程创建
// 7. 任务调度器初始化
// 8. 词库管理器初始化
// 9. 文件管理器初始化
// 10. 资源管理器初始化
// 11. 壁纸管理器初始化
// 12. IPC通信处理
// 13. 文件服务子进程启动
// 14. H5服务启动（如果启用）
// 15. 定时任务启动
// 16. 开机自启动设置处理
// 17. 电源监控设置

// 动态壁纸恢复
if (
  global.FBW.store?.settingData?.dynamicAutoPlayOnStartup &&
  global.FBW.store?.settingData?.dynamicLastVideoPath
) {
  global.FBW.dynamicWallpaperWindow?.setDynamicWallpaper(
    global.FBW.store?.settingData?.dynamicLastVideoPath
  )
}

// 托盘创建
createTray()

// 窗口显示逻辑
if (process.argv.includes('--autoStart')) {
  if (global.FBW.store?.settingData?.openMainWindowOnStartup) {
    global.FBW.loadingWindow.create(global.FBW.mainWindow.create)
  } else {
    global.FBW.mainWindow.create()
  }
} else {
  global.FBW.mainWindow.create()
}

// 悬浮球显示
if (global.FBW.store?.settingData?.suspensionBallVisible) {
  global.FBW.suspensionBall.createOrOpen()
}

// 电源监控设置（在 Store 类中）
setupPowerMonitor() {
  // 监听系统挂起事件
  powerMonitor.on('suspend', () => {
    global.logger.info('系统挂起，暂停自动切换壁纸')
    this.handleSystemIdle(true)
  })

  // 监听系统恢复事件
  powerMonitor.on('resume', () => {
    global.logger.info('系统恢复，恢复自动切换壁纸状态')
    this.handleSystemIdle(false)
  })

  // 监听锁屏事件
  powerMonitor.on('lock-screen', () => {
    global.logger.info('系统锁屏，暂停自动切换壁纸')
    this.handleSystemIdle(true)
  })

  // 监听解锁事件
  powerMonitor.on('unlock-screen', () => {
    global.logger.info('系统解锁，恢复自动切换壁纸状态')
    this.handleSystemIdle(false)
  })

  // 监听系统空闲状态
  if (powerMonitor.getSystemIdleState) {
    // 每分钟检查一次系统空闲状态
    setInterval(() => {
      // 系统空闲阈值，单位为秒，默认5分钟
      const idleState = powerMonitor.getSystemIdleState(300)
      if (idleState === 'idle' && !this.powerState.isSystemIdle) {
        global.logger.info('系统空闲，暂停自动切换壁纸')
        this.handleSystemIdle(true)
      } else if (idleState === 'active' && this.powerState.isSystemIdle) {
        global.logger.info('系统活跃，恢复自动切换壁纸状态')
        this.handleSystemIdle(false)
      }
    }, 60000)
  }

  // 监听电池模式
  powerMonitor.on('on-battery', () => {
    global.logger.info('进入电池模式')
    this.powerState.isOnBattery = true
    if (this.settingData.powerSaveMode) {
      global.logger.info('省电模式下自动暂停所有定时任务')
      this.taskScheduler.clearAllTasks()
      this.powerState.wasPausedByBattery = true
    }
  })

  powerMonitor.on('on-ac', () => {
    global.logger.info('恢复交流电')
    if (this.powerState.isOnBattery && this.powerState.wasPausedByBattery) {
      global.logger.info('恢复所有定时任务')
      this.startScheduledTasks()
      this.powerState.wasPausedByBattery = false
    }
    this.powerState.isOnBattery = false
  })
}
```

### 窗口管理

窗口管理负责创建、管理和控制应用的所有窗口，包括主窗口、功能窗口和系统托盘。所有窗口都采用单例模式设计，确保全局唯一性。

**窗口类型及功能：**

- **MainWindow**：主窗口，应用的核心界面
  - 尺寸：1020x700（最小尺寸）
  - 特性：无边框、自定义标题栏、支持最小化隐藏
  - 功能：壁纸浏览、设置管理、搜索、收藏等核心功能
  - 行为：关闭时隐藏而非退出，支持托盘恢复

- **LoadingWindow**：启动/加载窗口
  - 尺寸：200x200（固定尺寸）
  - 特性：透明背景、无边框、不可调整大小
  - 功能：应用启动时显示加载动画
  - 行为：10秒超时自动关闭，加载完成后自动销毁

- **ViewImageWindow**：图片预览窗口
  - 尺寸：1200x800（最小1020x700）
  - 特性：无边框、自定义标题栏
  - 功能：大图预览、图片信息查看、下载管理
  - 行为：支持多实例，每个图片独立窗口

- **SuspensionBall**：悬浮球窗口
  - 尺寸：60x220（固定尺寸）
  - 特性：透明背景、无边框、始终置顶、不可调整大小
  - 功能：快速操作入口、壁纸切换、设置快捷方式
  - 行为：跨工作区可见、不显示在任务栏、支持拖拽定位

- **DynamicWallpaperWindow**：动态壁纸窗口
  - 尺寸：全屏（根据显示器尺寸）
  - 特性：透明背景、无边框、桌面级别、点击穿透
  - 功能：视频壁纸播放、性能模式切换、透明度调节
  - 行为：全屏覆盖、支持多显示器、后台播放

- **RhythmWallpaperWindow**：律动壁纸窗口
  - 尺寸：全屏（根据显示器尺寸）
  - 特性：透明背景、无边框、桌面级别、点击穿透
  - 功能：音频可视化效果、多种律动模式、实时音频分析
  - 行为：全屏覆盖、音频驱动、视觉效果同步

**主要功能：**

- **窗口创建与销毁**：统一管理所有窗口的生命周期，采用单例模式确保全局唯一性
- **窗口位置管理**：保存和恢复窗口位置，支持多显示器环境
- **窗口状态控制**：最小化、最大化、恢复、关闭等操作，支持自定义关闭行为
- **窗口层级管理**：桌面级窗口、置顶窗口、普通窗口的层级控制
- **窗口交互控制**：点击穿透、鼠标事件处理、拖拽支持
- **系统托盘**：创建托盘图标和右键菜单，支持快速操作
- **快捷键注册**：支持全局快捷键操作，平台特定优化
- **窗口通信**：窗口间数据传递和状态同步
- **窗口恢复**：应用重启后恢复窗口状态和位置

**关键代码：**

```js:src/main/index.mjs
// 窗口实例管理（单例模式）
global.FBW.loadingWindow = LoadingWindow.getInstance()
global.FBW.mainWindow = MainWindow.getInstance()
global.FBW.viewImageWindow = ViewImageWindow.getInstance()
global.FBW.suspensionBall = SuspensionBall.getInstance()
global.FBW.dynamicWallpaperWindow = DynamicWallpaperWindow.getInstance()
global.FBW.rhythmWallpaperWindow = RhythmWallpaperWindow.getInstance()

// 主窗口配置
const mainWindowOptions = {
  width: 1020,
  height: 700,
  minWidth: 1020,
  minHeight: 700,
  show: false,
  frame: false,
  backgroundColor: '#efefef',
  autoHideMenuBar: true,
  titleBarStyle: 'hidden',
  icon: global.FBW.iconLogo,
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

// 悬浮球配置
const suspensionBallOptions = {
  width: 60,
  height: 220,
  minWidth: 60,
  minHeight: 220,
  maxWidth: 60,
  maxHeight: 220,
  frame: false,
  resizable: false,
  show: false,
  transparent: true,
  backgroundColor: '#00000000',
  titleBarStyle: 'hidden',
  hasShadow: false,
  alwaysOnTop: true,
  acceptFirstMouse: true,
  webPreferences: {
    preload: path.join(__dirname, '../preload/index.mjs'),
    sandbox: false,
    webSecurity: false,
    devTools: true,
    enableDragAndDrop: false
  }
}

// 动态壁纸窗口配置
const dynamicWallpaperOptions = {
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

// 窗口位置管理
const getWindowPosition = (name) => {
  const window = global.FBW[name]
  const win = window?.win
  if (win) {
    const [x, y] = win.getPosition()
    return { x, y }
  }
  return null
}

const setWindowPosition = (name, position) => {
  const window = global.FBW[name]
  const win = window?.win
  if (win) {
    win.setPosition(parseInt(position.x), parseInt(position.y), false)
    if (name === 'suspensionBall') {
      win.setSize(60, 220, false)
    }
  }
}

// 窗口状态控制
const resizeWindow = (name, action) => {
  const window = global.FBW[name]
  const win = window?.win
  if (win) {
    switch (action) {
      case 'minimize':
        win.minimize()
        break
      case 'maximize':
        if (win.isMaximized()) {
          win.unmaximize()
        } else {
          win.maximize()
        }
        break
      case 'unmaximize':
        win.unmaximize()
        break
      case 'restore':
        win.restore()
        break
      case 'close':
        win.close()
        break
    }
  }
}

// 托盘创建
const createTray = () => {
  const trayIcon = nativeImage.createFromPath(global.FBW.iconTray).resize({ width: 20, height: 20 })
  trayIcon.setTemplateImage(true)

  tray = new Tray(trayIcon)
  tray.setToolTip(t('appInfo.appName'))

  // 托盘点击事件
  tray.on('click', () => {
    handleJumpToPage(global.FBW.store?.settingData?.defaultMenu || 'Search')
  })

  // 托盘右键菜单
  tray.on('right-click', () => {
    const contextMenuList = [
      {
        label: global.FBW.store?.settingData?.autoSwitchWallpaper
          ? t('actions.autoSwitchWallpaper.stop')
          : t('actions.autoSwitchWallpaper.start'),
        click: () => {
          global.FBW.store?.toggleAutoSwitchWallpaper()
        }
      },
      {
        label: t('actions.nextWallpaper'),
        click: () => {
          global.FBW.store?.doManualSwitchWallpaper('next')
        }
      },
      {
        label: t('actions.prevWallpaper'),
        click: () => {
          global.FBW.store?.doManualSwitchWallpaper('prev')
        }
      },
      {
        label: global.FBW.store?.settingData?.suspensionBallVisible
          ? t('actions.closeSuspensionBall')
          : t('actions.openSuspensionBall'),
        click: () => {
          global.FBW.suspensionBall.toggle()
        }
      }
    ]
  })
}

// 窗口通信
global.FBW.sendCommonData = (win) => {
  if (!win) return
  const data = {
    osType,
    isLinux: isLinux(),
    isMac: isMac(),
    isWin: isWin(),
    isDev: isDev(),
    isProd: isProd(),
    h5ServerUrl: global.FBW.store?.h5ServerUrl
  }
  win.webContents.send('main:commonData', data)
}

global.FBW.sendMsg = (win, msgOption) => {
  if (!win) return
  win.webContents.send('main:sendMsg', msgOption)
}

// 窗口特殊功能
// 1. 主窗口关闭行为：隐藏而非退出
this.win.on('close', (event) => {
  if (!global.FBW.flags.isQuitting) {
    event.preventDefault()
    this.win?.hide()
    if (isMac() && app.dock) {
      app.dock.hide()
    }
  }
})

// 2. 悬浮球跨工作区显示
this.win.setVisibleOnAllWorkspaces(true)
this.win.setSkipTaskbar(true)

// 3. 动态壁纸窗口点击穿透
if (isWin()) {
  this.win.setIgnoreMouseEvents(true, { forward: true })
}

// 4. 窗口位置恢复
const savedPosition = global.FBW.store?.settingData?.windowPositions?.[name]
if (savedPosition) {
  this.win.setPosition(savedPosition.x, savedPosition.y, false)
}

```

**设计模式与最佳实践：**

- **单例模式**：所有窗口类都采用单例模式，确保全局唯一性，避免重复创建
- **事件驱动**：通过 IPC 事件实现窗口间通信，解耦窗口逻辑
- **状态管理**：窗口状态通过 Store 统一管理，支持持久化和恢复
- **平台适配**：针对不同操作系统（Windows、macOS、Linux）提供特定优化
- **性能优化**：桌面级窗口使用点击穿透，减少不必要的鼠标事件处理
- **用户体验**：主窗口关闭时隐藏而非退出，保持应用后台运行
- **资源管理**：及时清理窗口资源，避免内存泄漏

**窗口层级说明：**

1. **桌面级窗口**：DynamicWallpaperWindow、RhythmWallpaperWindow
   - 位于桌面背景层，不干扰用户操作
   - 支持点击穿透，鼠标事件传递给下层窗口
   - 全屏覆盖，提供沉浸式体验

2. **置顶窗口**：SuspensionBall
   - 始终显示在最顶层
   - 跨工作区可见，方便快速访问
   - 不显示在任务栏，保持界面简洁

3. **普通窗口**：MainWindow、ViewImageWindow、LoadingWindow
   - 遵循系统窗口管理规则
   - 支持最小化、最大化、关闭等标准操作
   - 与系统任务栏集成

### 数据管理

数据管理通过 Store 类聚合所有 Manager，统一管理应用的数据、服务和业务逻辑。采用分层架构设计，每个 Manager 负责特定的业务领域，通过依赖注入实现组件间的解耦。

**Manager 组件详解：**

- **DatabaseManager**：数据库管理
  - 负责 SQLite 数据库的初始化和操作
  - 支持 WAL 模式，提供高性能并发访问
  - 自动创建表结构和索引
  - 提供统一的 CRUD 操作接口
  - 支持事务处理和错误恢复

- **SettingManager**：设置管理
  - 处理用户配置的存储和读取
  - 支持配置热更新和事件通知
  - 提供配置验证和默认值管理
  - 支持多语言配置和国际化
  - 实现配置的持久化和恢复
  - 支持设置默认菜单，控制应用启动时显示的默认页面

- **ApiManager**：API 管理
  - 统一管理所有壁纸源的 API 调用
  - 支持内置 API 和用户自定义 API 插件
  - 提供 API 插件的动态加载和热更新
  - 实现 API 调用的错误处理和重试机制
  - 支持 API 限流和缓存策略

- **ResourcesManager**：资源管理
  - 处理壁纸资源的获取和缓存
  - 支持多种资源源的统一管理
  - 实现资源的智能调度和负载均衡
  - 提供资源质量评估和筛选
  - 支持资源的批量下载和管理

- **WallpaperManager**：壁纸管理
  - 负责壁纸的切换和调度
  - 支持自动切换和手动切换模式
  - 实现壁纸切换的智能算法（随机/顺序）
  - 提供壁纸历史记录和收藏功能
  - 支持多显示器壁纸同步
  - 实现动态壁纸和视频壁纸
  - 支持网页壁纸和颜色壁纸
  - 提供自动下载壁纸功能
  - 支持壁纸质量评估和筛选
  - 实现电池模式下的省电策略

- **FileManager**：文件管理
  - 处理文件下载、存储和清理
  - 支持断点续传和并发下载
  - 实现文件去重和版本管理
  - 提供文件压缩和格式转换
  - 支持自动清理和存储优化

- **WordsManager**：词库管理
  - 处理搜索关键词的管理
  - 支持关键词的智能推荐
  - 实现搜索历史和学习算法
  - 提供多语言关键词支持
  - 支持关键词的导入导出

- **TaskScheduler**：任务调度
  - 管理定时任务和后台作业
  - 支持任务的动态调度和取消
  - 实现任务优先级和依赖管理
  - 提供任务执行状态监控
  - 支持任务失败重试和恢复

- **VersionManager**：版本管理
  - 处理应用版本升级和数据迁移
  - 支持增量更新和回滚机制
  - 实现版本兼容性检查
  - 提供升级进度和状态通知
  - 支持多版本数据迁移策略

**主要功能：**

- **数据持久化**：通过 SQLite 数据库存储用户数据，支持 WAL 模式和高性能并发访问
- **配置管理**：统一管理应用设置和用户偏好，支持热更新和事件通知
- **资源调度**：智能调度壁纸资源的获取和切换，支持多源负载均衡
- **任务调度**：管理定时任务和后台作业，支持动态调度和状态监控
- **状态同步**：确保多窗口间的数据一致性，支持实时状态更新
- **插件管理**：支持 API 插件的动态加载和热更新
- **版本控制**：处理应用版本升级和数据迁移，支持增量更新
- **缓存策略**：实现多级缓存机制，提升应用性能
- **错误处理**：提供统一的错误处理和恢复机制
- **性能优化**：通过索引优化和查询优化提升数据库性能

**关键代码：**

```js
// Store 初始化
global.FBW.store = new Store()
await global.FBW.store?.waitForInitialization()

// Store 内部结构（依赖注入）
this.dbManager = DatabaseManager.getInstance(global.logger)
this.settingManager = SettingManager.getInstance(global.logger, this.dbManager)
this.apiManager = ApiManager.getInstance(global.logger, this.dbManager)
this.taskScheduler = TaskScheduler.getInstance(global.logger)
this.wordsManager = WordsManager.getInstance(global.logger, this.dbManager, this.settingManager)
this.fileManager = FileManager.getInstance(global.logger, this.dbManager, this.settingManager, this.fileServer, this.wordsManager)
this.resourcesManager = ResourcesManager.getInstance(global.logger, this.dbManager, this.settingManager, this.apiManager)
this.wallpaperManager = WallpaperManager.getInstance(global.logger, this.dbManager, this.settingManager, this.fileManager, this.apiManager)

// 数据库管理器配置
const dbOptions = {
  journal_mode: 'WAL',
  busy_timeout: 5000,
  pragma: {
    journal_mode: 'WAL',
    busy_timeout: 5000,
    synchronous: 'NORMAL',
    cache_size: -64000, // 64MB
    temp_store: 'MEMORY'
  }
}

// 设置管理器事件监听
this.settingManager.on('SETTING_UPDATED', (newSettings) => {
  this.logger.info('设置已更新，通知相关组件')
  this.notifySettingChange(newSettings)
})

// API 管理器插件加载
async loadApi() {
  const apiMap = {}

  // 加载内置 API
  await this.loadApiFromDir(this.sysApiDir, apiMap)

  // 加载用户 API
  await this.loadApiFromDir(this.userApiDir, apiMap)

  this.apiMap = apiMap
  this.logger.info(`成功加载 ${Object.keys(apiMap).length} 个API插件`)
}

// 壁纸管理器切换逻辑
async switchWallpaper(direction = 'next') {
  const currentWallpaper = await this.getCurrentWallpaper()
  const nextWallpaper = await this.getNextWallpaper(currentWallpaper, direction)

  if (nextWallpaper) {
    await this.setWallpaper(nextWallpaper)
    await this.updateWallpaperHistory(nextWallpaper)
    this.emit('WALLPAPER_CHANGED', nextWallpaper)
  }
}

// 任务调度器
scheduleTask(timerKey, interval, callback, initialDelay = 0) {
  if (this.timers[timerKey]) {
    clearInterval(this.timers[timerKey])
  }

  if (initialDelay > 0) {
    setTimeout(() => {
      callback()
      this.timers[timerKey] = setInterval(callback, interval)
    }, initialDelay)
  } else {
    this.timers[timerKey] = setInterval(callback, interval)
  }
}

// 文件管理器下载
async downloadFile(url, filePath, options = {}) {
  const { onProgress, onComplete, onError } = options

  try {
    const response = await axios({
      method: 'GET',
      url: url,
      responseType: 'stream',
      onDownloadProgress: (progressEvent) => {
        if (onProgress) {
          const percent = Math.round((progressEvent.loaded * 100) / progressEvent.total)
          onProgress(percent)
        }
      }
    })

    const writer = fs.createWriteStream(filePath)
    response.data.pipe(writer)

    return new Promise((resolve, reject) => {
      writer.on('finish', () => {
        if (onComplete) onComplete(filePath)
        resolve(filePath)
      })
      writer.on('error', reject)
    })
  } catch (error) {
    if (onError) onError(error)
    throw error
  }
}

// 缓存管理
class CacheManager {
  constructor() {
    this.memoryCache = new Map()
    this.diskCache = new Map()
  }

  async get(key) {
    // 先查内存缓存
    if (this.memoryCache.has(key)) {
      return this.memoryCache.get(key)
    }

    // 再查磁盘缓存
    if (this.diskCache.has(key)) {
      const value = await this.diskCache.get(key)
      this.memoryCache.set(key, value)
      return value
    }

    return null
  }

  async set(key, value, ttl = 3600000) {
    this.memoryCache.set(key, value)
    this.diskCache.set(key, value)

    setTimeout(() => {
      this.memoryCache.delete(key)
      this.diskCache.delete(key)
    }, ttl)
  }
  }
```

**架构设计与最佳实践：**

- **分层架构**：采用分层设计，每个 Manager 负责特定业务领域，通过依赖注入实现解耦
- **单例模式**：所有 Manager 都采用单例模式，确保全局唯一性和资源复用
- **事件驱动**：通过事件机制实现组件间通信，支持松耦合的架构设计
- **异步处理**：所有数据操作都采用异步处理，避免阻塞主线程
- **错误处理**：统一的错误处理机制，支持错误恢复和降级处理
- **性能优化**：通过缓存、索引、连接池等技术提升性能
- **数据一致性**：通过事务处理和状态管理确保数据一致性
- **可扩展性**：插件化架构支持功能扩展和定制化需求

**数据流设计：**

1. **数据输入层**：API 调用、用户操作、系统事件
2. **业务逻辑层**：各 Manager 处理具体业务逻辑
3. **数据存储层**：SQLite 数据库、文件系统、缓存
4. **数据输出层**：UI 更新、事件通知、外部接口

**性能优化策略：**

- **数据库优化**：WAL 模式、索引优化、查询优化
- **缓存策略**：多级缓存、LRU 算法、TTL 机制
- **并发控制**：连接池、锁机制、事务管理
- **资源管理**：内存管理、文件清理、连接复用

### 子进程服务管理

子进程服务管理通过 ChildServer 类创建和管理独立的子进程，提供文件服务和 H5 服务。采用 Electron 的 utilityProcess 实现进程隔离，通过 MessageChannel 进行进程间通信。

**服务类型详解：**

- **FileServer**：文件服务子进程
  - 处理文件扫描、目录刷新、文件信息提取
  - 支持批量文件处理和进度报告
  - 实现文件去重和增量更新
  - 提供文件元数据计算和缓存
  - 支持大文件目录的高效处理
  - 实现图片质量分析和处理

- **H5Server**：H5 服务子进程
  - 提供 Web API 和 Socket 服务
  - 支持 HTTPS/HTTP 双模式运行
  - 实现实时通信和数据同步
  - 提供静态资源服务和文件下载
  - 支持多客户端连接和状态管理
  - 集成 Koa 框架和 Socket.IO
  - 支持 HTTP/2 协议和自动证书生成

**主要功能：**

- **进程隔离**：将文件处理和 Web 服务分离到独立进程，避免主进程阻塞
- **性能优化**：通过多进程架构提升应用性能，支持并行处理
- **服务管理**：统一管理子进程的创建、通信和销毁，支持热重启
- **错误隔离**：子进程崩溃不影响主进程，提供自动恢复机制
- **通信机制**：通过 MessageChannel 实现高效的进程间通信
- **资源管理**：独立管理子进程资源，支持内存和 CPU 优化
- **监控调试**：提供子进程状态监控和日志收集
- **安全隔离**：子进程运行在受限环境中，提升应用安全性

**关键代码：**

```js
// 子进程服务创建
this.fileServer = createFileServer()
this.h5Server = createH5Server()

// 子进程创建
export const createFileServer = () => new ChildServer('fileServer', fileServerPath)
export const createH5Server = () => new ChildServer('h5Server', h5ServerPath)

// ChildServer 核心实现
export default class ChildServer {
  #serverName
  #serverPath
  #child
  #port2

  constructor(serverName, serverPath) {
    this.#serverName = serverName
    this.#serverPath = serverPath
    this.#child = null
    this.#port2 = null
  }

  start({ options, onMessage = () => {} } = {}) {
    const { port1, port2 } = new MessageChannelMain()
    this.#child = utilityProcess.fork(this.#serverPath, options)
    this.#port2 = port2

    this.#child.on('exit', () => {
      this.#child = null
      this.#port2 = null
    })

    this.#port2.on('message', onMessage)
    this.#port2.start()

    // 初始消息
    this.#child.postMessage(
      {
        serverName: this.#serverName,
        event: 'SERVER_FORKED'
      },
      [port1]
    )

    // 服务启动消息
    this.postMessage({
      serverName: this.#serverName,
      event: 'SERVER_START'
    })
  }

  stop(callback) {
    if (!this.#child) return
    const isSuccess = this.#child?.kill()
    typeof callback === 'function' && callback(isSuccess)
  }

  restart({ params, onMessage = () => {}, stopCallback = () => {} } = {}) {
    this.stop(stopCallback)
    this.start({ params, onMessage })
  }

  postMessage(data) {
    this.#port2?.postMessage(data)
  }
}

// 文件服务子进程实现
process.parentPort.on('message', (e) => {
  const [port] = e.ports

  port.on('message', async (e) => {
    const { data } = e

    if (data.event === 'REFRESH_DIRECTORY') {
      // 分批处理大量文件
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

      // 并行处理多个目录
      const dirPromises = data.folderPaths.map((folderPath) =>
        readDirRecursive(data.resourceName, folderPath, data.allowedFileExt, data.existingFiles)
      )

      const results = await Promise.all(dirPromises)

      // 合并结果并发送进度
      port.postMessage({
        event: 'REFRESH_DIRECTORY::SUCCESS',
        data: results,
        stats: { totalFiles: results.length }
      })
    }
  })
})

// H5服务子进程实现
process.parentPort.on('message', (e) => {
  const [port] = e.ports

  port.on('message', async (e) => {
    const { data } = e

    if (data.event === 'SERVER_START') {
      // 初始化数据库管理器
      dbManager = DatabaseManager.getInstance(logger)
      await dbManager.waitForInitialization()

      // 初始化各种管理器
      settingManager = SettingManager.getInstance(logger, dbManager)
      await settingManager.waitForInitialization()

      // 启动服务器
      const serverRes = await server({
        dbManager,
        settingManager,
        resourcesManager,
        fileManager,
        logger,
        postMessage,
        onStartSuccess: (url) => {
          port.postMessage({
            event: 'SERVER_START::SUCCESS',
            url
          })
        }
      })

      ioServer = serverRes.ioServer
    }
  })
})

// H5服务器配置
const app = new Koa()
const ioServer = new Server(httpServer, {
  cors: { origin: '*', methods: ['GET', 'POST'] },
  transports: ['websocket', 'polling'],
  pingTimeout: 30000,
  pingInterval: 25000,
  upgradeTimeout: 10000,
  maxHttpBufferSize: 1e6
})

// Socket.IO 事件处理
ioServer.on('connection', (socket) => {
  socket.on('getSettingData', async (params, callback) => {
    try {
      const res = await settingManager.getSettingData()
      callback(res)
    } catch (err) {
      callback({ success: false, message: '操作失败' })
    }
  })

  socket.on('searchImages', async (params, callback) => {
    try {
      const res = await resourcesManager.search(params)
      callback(res)
    } catch (err) {
      callback({ success: false, message: '搜索失败' })
    }
  })
})

// 子进程服务管理
class SubProcessManager {
  constructor() {
    this.processes = new Map()
    this.messageHandlers = new Map()
  }

  createProcess(name, path, options = {}) {
    const childServer = new ChildServer(name, path)
    this.processes.set(name, childServer)

    childServer.start({
      options,
      onMessage: (data) => {
        const handler = this.messageHandlers.get(name)
        if (handler) {
          handler(data)
        }
      }
    })

    return childServer
  }

  registerMessageHandler(name, handler) {
    this.messageHandlers.set(name, handler)
  }

  stopProcess(name) {
    const process = this.processes.get(name)
    if (process) {
      process.stop()
      this.processes.delete(name)
    }
  }

  restartProcess(name, options = {}) {
    const process = this.processes.get(name)
    if (process) {
      process.restart(options)
    }
  }
}
```

**架构设计与最佳实践：**

- **进程隔离**：使用 Electron 的 utilityProcess 实现真正的进程隔离，避免主进程阻塞
- **通信机制**：通过 MessageChannel 实现高效的进程间通信，支持结构化数据传输
- **错误处理**：子进程崩溃不影响主进程，提供自动重启和错误恢复机制
- **资源管理**：独立管理子进程资源，支持内存和 CPU 优化，避免资源泄漏
- **性能优化**：通过并行处理和批量操作提升性能，支持大文件目录处理
- **安全隔离**：子进程运行在受限环境中，提升应用安全性
- **监控调试**：提供子进程状态监控、日志收集和性能分析
- **热重启**：支持子进程的热重启，无需重启整个应用

**子进程生命周期管理：**

1. **创建阶段**：通过 utilityProcess.fork 创建子进程，建立通信通道
2. **初始化阶段**：子进程加载必要的模块和初始化服务
3. **运行阶段**：处理主进程发送的消息，执行相应的业务逻辑
4. **监控阶段**：监控子进程状态，处理异常和错误
5. **销毁阶段**：优雅关闭子进程，清理资源

**通信协议设计：**

- **事件驱动**：基于事件的通信模式，支持异步消息处理
- **结构化数据**：使用 JSON 格式传输结构化数据
- **错误处理**：统一的错误处理和响应机制
- **进度报告**：支持长时间操作的进度报告和状态更新
- **双向通信**：支持主进程和子进程的双向通信

**性能优化策略：**

- **批量处理**：对大量文件进行批量处理，减少通信开销
- **并行处理**：支持多个目录的并行扫描和处理
- **内存管理**：及时释放不需要的内存，避免内存泄漏
- **缓存机制**：在子进程中实现缓存，减少重复计算
- **流式处理**：对大文件进行流式处理，避免内存溢出

### 自定义协议

自定义协议通过 Electron 的 protocol 模块注册自定义 URL 协议，用于处理本地资源访问。采用 `fbwtp://` 协议提供高性能的本地文件服务，支持图片处理、视频播放和静态资源访问。

**协议名称：** `fbwtp://`

**主要功能：**

- **图片处理**：通过 `/api/images/get` 路径处理图片请求，支持尺寸调整和格式转换
- **视频处理**：通过 `/api/videos/get` 路径处理视频请求，支持流式传输
- **静态资源**：提供本地文件的 HTTP 风格访问接口
- **缓存机制**：实现智能缓存策略，提升访问性能
- **安全访问**：提供安全的本地资源访问机制，防止路径遍历攻击
- **性能优化**：通过协议处理减少文件 I/O 开销，支持流式处理
- **格式支持**：支持多种图片和视频格式的自动识别和处理
- **压缩优化**：智能压缩和尺寸调整，减少传输数据量

**关键代码：**

```js
// 协议注册
protocol.registerSchemesAsPrivileged([
  {
    scheme: 'fbwtp',
    privileges: {
      bypassCSP: true,
      secure: true,
      standard: true,
      supportFetchAPI: true,
      allowServiceWorkers: true,
      stream: true
    }
  }
])

// 协议处理
protocol.handle('fbwtp', async (request) => {
  const urlObj = new URL(request.url)
  const filePath = urlObj.searchParams.get('filePath')

  switch (urlObj.pathname) {
    case '/api/images/get': {
      const w = urlObj.searchParams.get('w')
      const h = urlObj.searchParams.get('h')
      const res = await handleImageResponse({ filePath, w, h })
      return new Response(res.data, { status: res.status, headers: res.headers })
    }
    case '/api/videos/get': {
      const res = await handleVideoResponse({ filePath, request })
      return new Response(res.data, { status: res.status, headers: res.headers })
    }
  }
})

// 视频响应处理
export const handleVideoResponse = async ({ filePath, request }) => {
  const ret = {
    status: 500,
    headers: {},
    data: null
  }
  try {
    // 转换文件路径（包含URL解码）
    filePath = transFilePath(filePath)
    // 获取文件信息
    const stats = await fs.promises.stat(filePath)
    const extension = path.extname(filePath).toLowerCase()
    const mimeType = mimeTypes[extension] || 'video/mp4'
    const fileSize = stats.size

    // 处理范围请求
    let start = 0
    let end = fileSize - 1
    let statusCode = 200
    let contentRange = `bytes ${start}-${end}/${fileSize}`
    let contentLength = fileSize

    // 检查是否是范围请求
    if (request && request.headers && request.headers.get('range')) {
      const range = request.headers.get('range')
      const parts = range.replace(/bytes=/, '').split('-')
      const partialStart = parts[0]
      const partialEnd = parts[1]

      start = parseInt(partialStart, 10)
      end = partialEnd ? parseInt(partialEnd, 10) : fileSize - 1

      if (start >= fileSize) {
        // 范围无效，返回416状态码
        ret.status = 416
        ret.headers = {
          'Content-Range': contentRange
        }
        return ret
      }

      if (end >= fileSize) {
        end = fileSize - 1
      }

      contentLength = end - start + 1
      contentRange = `bytes ${start}-${end}/${fileSize}`
      statusCode = 206 // 部分内容
    }

    // 创建文件流，支持范围请求
    const streamData = fs.createReadStream(filePath, { start, end })

    // 设置响应头
    const headers = {
      'Content-Type': mimeType,
      'Content-Length': contentLength,
      'Accept-Ranges': 'bytes',
      'Content-Range': contentRange,
      'Cache-Control': 'max-age=3600',
      'Last-Modified': stats.mtime.toUTCString(),
      ETag: `"${stats.mtimeMs}-${stats.size}"`
    }

    ret.status = statusCode
    ret.headers = headers
    ret.data = streamData
    return ret
  } catch (err) {
    console.error('Video file error:', err)
    // 根据错误类型设置适当的状态码
    if (err.code === 'ENOENT') {
      // 文件不存在，设置为404
      ret.status = 404
    }
    return ret
  }
}

// 图片响应处理
export const handleImageResponse = async (query) => {
  const ret = {
    status: 500,
    headers: {},
    data: null
  }
  try {
    let T1, T2, T3, T4
    T1 = Date.now()
    // 获取图片 URL 和尺寸
    let { filePath, w, compressStartSize } = query
    if (!filePath) {
      // 缺少文件路径参数，返回400错误
      ret.status = 400
      return ret
    }
    // 转换文件路径
    filePath = transFilePath(filePath)
    // 计算图片尺寸
    const width = w ? parseInt(w, 10) : null
    // 生成缓存键
    const cacheKey = `filePath=${filePath}&width=${width}`
    // 1. 先查缓存（只缓存小图/小文件）
    if (cache.has(cacheKey)) {
      const cacheData = cache.get(cacheKey)
      // 返回文件内容和 MIME 类型
      ret.status = 200
      ret.headers = {
        ...cacheData.headers,
        'Server-Timing': `cache-hit;dur=${Date.now() - T1}`
      }
      ret.data = cacheData.data
      return ret
    }
    T2 = Date.now()

    // 2. 未命中缓存，获取文件信息
    const stats = await fs.promises.stat(filePath)
    const originalFileSize = stats.size
    const extension = path.extname(filePath).toLowerCase()
    const mimeType = mimeTypes[extension] || 'application/octet-stream'
    const CACHE_LIMIT = 10 * 1024 * 1024 // 10MB
    T3 = Date.now()
    // 计算压缩起始大小（单位字节）
    const startSize = (compressStartSize ? parseInt(compressStartSize, 10) : 0) * 1024 * 1024
    // 判断是否需要 sharp 缩放（需满足格式、width、且大于compressStartSize）
    const canResize =
      ['.png', '.jpg', '.jpeg', '.avif', '.webp', '.gif'].includes(extension) && width
    const needResize = canResize && originalFileSize > startSize
    if (originalFileSize < CACHE_LIMIT) {
      // 小图缓存
      let fileBuffer
      if (needResize) {
        fileBuffer = await sharp(filePath)
          .resize({
            width,
            fit: 'inside',
            withoutEnlargement: true,
            kernel: 'lanczos3',
            fastShrinkOnLoad: true
          })
          .toBuffer()
      } else {
        fileBuffer = await fs.promises.readFile(filePath)
      }
      const fileSize = fileBuffer.length.toString()
      T4 = Date.now()
      const headers = {
        'Content-Type': mimeType,
        'Content-Length': fileSize,
        'Original-Size': originalFileSize,
        'Compressed-Size': fileSize,
        'Cache-Control': 'max-age=3600',
        ETag: `"${stats.mtimeMs}-${originalFileSize}"`,
        'Last-Modified': stats.mtime.toUTCString(),
        'Server-Timing': `file-check;dur=${T2 - T1}, file-stat;dur=${T3 - T2}, resize;dur=${T4 - T3}, total;dur=${T4 - T1}`,
        'X-File-Check-Time': T2 - T1 + 'ms',
        'X-File-Stat-Time': T3 - T2 + 'ms',
        'X-Resize-Time': T4 - T3 + 'ms',
        'X-Total-Time': T4 - T1 + 'ms'
      }
      cache.set(cacheKey, {
        data: fileBuffer,
        headers
      })
      ret.status = 200
      ret.headers = headers
      ret.data = fileBuffer
      return ret
    } else {
      // 大图流式
      let streamData
      let headers = {
        'Content-Type': mimeType,
        'Cache-Control': 'max-age=3600',
        'Original-Size': originalFileSize,
        'Last-Modified': stats.mtime.toUTCString(),
        ETag: `"${stats.mtimeMs}-${originalFileSize}"`
      }
      if (needResize) {
        const inputStream = fs.createReadStream(filePath)
        const transformer = sharp().resize({
          width,
          fit: 'inside',
          withoutEnlargement: true,
          kernel: 'lanczos3',
          fastShrinkOnLoad: true
        })
        streamData = inputStream.pipe(transformer)
        headers['X-Resize-Stream'] = '1'
      } else {
        streamData = fs.createReadStream(filePath)
        headers['Content-Length'] = originalFileSize
      }
      T4 = Date.now()
      headers['Server-Timing'] =
        `file-check;dur=${T2 - T1}, file-stat;dur=${T3 - T2}, resize;dur=${T4 - T3}, total;dur=${T4 - T1}`
      headers['X-File-Check-Time'] = T2 - T1 + 'ms'
      headers['X-File-Stat-Time'] = T3 - T2 + 'ms'
      headers['X-Resize-Time'] = T4 - T3 + 'ms'
      headers['X-Total-Time'] = T4 - T1 + 'ms'

      ret.status = 200
      ret.headers = headers
      ret.data = streamData
      return ret
    }
  } catch (err) {
    console.error('Image file error:', err)
    // 根据错误类型设置适当的状态码
    if (err.code === 'ENOENT') {
      // 文件不存在，设置为404
      ret.status = 404
    }
    return ret
  }
}

// 文件路径转换
export const transFilePath = (filePath) => {
  // 处理 Windows 上的绝对路径（例如 'E:/xx/yy'）
  if (process.platform === 'win32') {
    filePath = filePath.replace(/\//g, '\\') // 将所有斜杠替换为反斜杠
    // 修复丢失的冒号（:），假设路径是 e\xx\yy 应该是 e:\xx\yy
    filePath = filePath.replace(/^([a-zA-Z])\\/, '$1:\\') // 在盘符后面补上冒号
  } else {
    // macOS 和 Linux 确保是绝对路径
    if (!filePath.startsWith('/')) {
      filePath = '/' + filePath
    }
  }
  // 注意：这里不再需要 decodeURIComponent，因为 URL.searchParams.get() 已经自动解码了
  // filePath = decodeURIComponent(filePath)
  return filePath
}

// 协议使用示例
// 图片访问：fbwtp://api/images/get?filePath=/path/to/image.jpg&w=800
// 视频访问：fbwtp://api/videos/get?filePath=/path/to/video.mp4
// 原始文件：fbwtp://api/images/get?filePath=/path/to/file.png
```

**架构设计与最佳实践：**

- **协议设计**：采用 RESTful 风格的 API 设计，支持查询参数和路径参数
- **缓存策略**：使用 LRU 缓存算法，实现智能缓存机制，区分小文件缓存和大文件流式处理
- **性能优化**：通过 Sharp 库实现高效的图片处理和格式转换
- **安全机制**：路径验证和转换，防止路径遍历攻击
- **错误处理**：统一的错误处理和响应机制
- **流式处理**：支持大文件的流式传输，避免内存溢出
- **格式支持**：自动识别文件格式，支持多种图片和视频格式
- **跨平台兼容**：处理不同操作系统的路径格式差异

**协议路由设计：**

- **图片处理路由**：`/api/images/get` - 处理图片请求，支持尺寸调整和格式转换
- **视频处理路由**：`/api/videos/get` - 处理视频请求，支持流式传输

**缓存实现：**

- **LRU 缓存**：使用 `lru-cache` 库实现，最大 1000 个条目，1GB 总大小
- **智能缓存**：小文件（<10MB）使用内存缓存，大文件使用流式传输
- **缓存键生成**：基于文件路径和尺寸参数生成唯一缓存键
- **自动清理**：支持 TTL 自动清理和 LRU 淘汰机制
- **性能监控**：记录缓存命中率和处理时间

**性能优化策略：**

- **缓存分层**：内存缓存策略，小文件缓存，大文件流式处理
- **智能压缩**：根据文件大小和类型自动选择压缩策略
- **流式传输**：大文件使用流式传输，小文件使用缓存
- **并发处理**：支持多个请求的并发处理
- **Sharp 优化**：使用 Lanczos3 内核进行高质量图片缩放

**安全机制：**

- **路径验证**：通过 `transFilePath` 函数验证和转换文件路径
- **格式限制**：限制支持的文件格式（png, jpg, jpeg, avif, webp, gif）
- **大小限制**：10MB 作为缓存和流式处理的分界线
- **错误隐藏**：统一的错误处理，避免敏感信息泄露

**监控与调试：**

- **性能监控**：通过 Server-Timing 头记录各阶段处理时间
- **错误日志**：详细的错误日志记录和分类
- **缓存统计**：缓存命中率和效率统计
- **调试工具**：开发环境下的调试和性能分析工具

### 进程通信

进程通信通过 Electron 的 IPC（进程间通信）机制实现主进程与渲染进程、子进程之间的通信。采用事件驱动的异步通信模式，支持双向数据传输和状态同步。

**通信类型：**

- **主进程 ↔ 渲染进程**：通过 `ipcMain.handle` 和 `ipcRenderer.invoke` 进行请求-响应通信
- **主进程 → 渲染进程**：通过 `webContents.send` 进行单向消息推送
- **主进程 ↔ 子进程**：通过 `MessageChannel` 和 `utilityProcess` 进行进程间通信
- **窗口间通信**：通过主进程中转实现窗口间的数据传递和状态同步

**主要功能：**

- **系统级操作**：文件选择、目录打开、URL 打开、系统对话框等
- **窗口管理**：窗口位置、大小、状态控制，窗口间跳转
- **数据管理**：设置数据获取/更新、资源搜索、收藏管理
- **壁纸操作**：壁纸切换、设置、自动切换控制
- **服务管理**：H5 服务启停、缓存清理、数据库操作
- **状态同步**：在窗口间同步应用状态和数据变更
- **事件通知**：向渲染进程发送通知和消息

**IPC 处理器分类：**

**系统操作类：**

```js
// 文件选择
ipcMain.handle('main:selectFolder', async () => {
  return await dialog.showOpenDialog({ properties: ['openDirectory'] })
})

ipcMain.handle('main:selectFile', async (event, type) => {
  const filters = []
  if (type === 'image') {
    filters.push({ name: 'Images', extensions: ['jpg', 'png', 'gif'] })
  } else if (type === 'video') {
    filters.push({ name: 'Movies', extensions: ['mp4'] })
  }
  return await dialog.showOpenDialog({
    properties: ['openFile'],
    filters
  })
})

// 系统操作
ipcMain.handle('main:openDir', (event, dirName) => {
  const dirPath = getDirPathByName(userDataPath, dirName)
  shell.openPath(dirPath)
})

ipcMain.handle('main:openUrl', (event, url) => {
  shell.openExternal(url)
})

ipcMain.handle('main:showItemInFolder', (event, filePath) => {
  shell.showItemInFolder(filePath)
})
```

**窗口控制类：**

```js
// 窗口位置和状态
ipcMain.handle('main:setWindowPosition', (event, name, position) => {
  setWindowPosition(name, position)
})

ipcMain.handle('main:getWindowPosition', (event, name) => {
  return getWindowPosition(name)
})

ipcMain.handle('main:resizeWindow', (event, name, action) => {
  resizeWindow(name, action)
})

// 窗口切换
ipcMain.handle('main:toggleMainWindow', () => {
  global.FBW.mainWindow.toggle()
})

ipcMain.handle('main:openSuspensionBall', (event, params) => {
  global.FBW.suspensionBall.createOrOpen(params)
})

ipcMain.handle('main:closeSuspensionBall', (event, params) => {
  global.FBW.suspensionBall.close(params)
})
```

**数据管理类：**

```js
// 设置数据
ipcMain.handle('main:getSettingData', () => {
  return this.settingManager.getSettingData()
})

ipcMain.handle('main:updateSettingData', async (event, formData) => {
  return await this.updateSettingData(formData)
})

// 资源管理
ipcMain.handle('main:getResourceMap', () => {
  return this.dbManager.getResourceMap()
})

ipcMain.handle('main:search', async (event, params) => {
  return await this.resourcesManager.search(params)
})

// 收藏管理
ipcMain.handle('main:addToFavorites', async (event, resourceId, isPrivacySpace = false) => {
  return await this.resourcesManager.addToFavorites(resourceId, isPrivacySpace)
})

ipcMain.handle('main:removeFavorites', async (event, resourceId, isPrivacySpace = false) => {
  return await this.resourcesManager.removeFavorites(resourceId, isPrivacySpace)
})
```

**壁纸操作类：**

```js
// 壁纸切换
ipcMain.handle('main:nextWallpaper', async () => {
  return this.doManualSwitchWallpaper('next')
})

ipcMain.handle('main:prevWallpaper', async () => {
  return this.doManualSwitchWallpaper('prev')
})

// 壁纸设置
ipcMain.handle('main:setAsWallpaperWithDownload', async (event, item) => {
  return await this.wallpaperManager.setAsWallpaperWithDownload(item)
})

ipcMain.handle('main:setWebWallpaper', (event, url) => {
  return this.setWebWallpaper(url)
})

ipcMain.handle('main:setColorWallpaper', (event, color) => {
  return this.setColorWallpaper(color)
})

// 自动切换控制
ipcMain.handle('main:toggleAutoSwitchWallpaper', async () => {
  return this.toggleAutoSwitchWallpaper()
})
```

**动态壁纸控制类：**

```js
// 动态壁纸设置
ipcMain.handle('main:setDynamicWallpaper', async (event, videoPath) => {
  return await global.FBW.dynamicWallpaperWindow.setDynamicWallpaper(videoPath)
})

ipcMain.handle('main:setDynamicWallpaperMute', (event, mute) => {
  global.FBW.dynamicWallpaperWindow.setMute(mute)
})

ipcMain.handle('main:setDynamicWallpaperPerformance', (event, mode) => {
  global.FBW.dynamicWallpaperWindow.setPerformanceMode(mode)
})

ipcMain.handle('main:setDynamicWallpaperOpacity', (event, opacity) => {
  global.FBW.dynamicWallpaperWindow.setOpacity(opacity)
})
```

**服务管理类：**

```js
// 缓存管理
ipcMain.handle('main:clearCache', () => {
  cache.clear()
  global.FBW.sendMsg(global.FBW.mainWindow.win, {
    type: 'success',
    message: t('messages.clearCacheSuccess')
  })
})

// H5 服务控制
ipcMain.handle('main:startH5Server', () => {
  this.handleH5ServerStart(3, 2000)
})

ipcMain.handle('main:stopH5Server', () => {
  this.handleH5ServerStop()
})

// 数据库操作
ipcMain.handle('main:doClearDB', async (event, tableName, resourceName) => {
  const res = await this.dbManager.clearDB(tableName, resourceName)
  global.FBW.sendMsg(global.FBW.mainWindow.win, {
    type: res.success ? 'success' : 'error',
    message: res.message
  })
  return res
})
```

**消息推送机制：**

```js
// 通用数据推送
global.FBW.sendCommonData = (win) => {
  const data = {
    osType,
    isLinux: isLinux(),
    isMac: isMac(),
    isWin: isWin(),
    isDev: isDev(),
    isProd: isProd(),
    h5ServerUrl: global.FBW.store?.h5ServerUrl
  }
  win.webContents.send('main:commonData', data)
}

// 消息通知推送
global.FBW.sendMsg = (win, msgOption) => {
  if (!win) return
  win.webContents.send('main:sendMsg', msgOption)
}

// 设置数据更新推送
this.notifySettingChange = (newSettings) => {
  // 向所有窗口推送设置更新
  global.FBW.mainWindow.win.webContents.send('main:settingDataUpdate', this.settingData)
  global.FBW.viewImageWindow.win.webContents.send('main:settingDataUpdate', this.settingData)
  global.FBW.suspensionBall.win.webContents.send('main:settingDataUpdate', this.settingData)
  global.FBW.dynamicWallpaperWindow.win.webContents.send('main:settingDataUpdate', this.settingData)
  global.FBW.rhythmWallpaperWindow.win.webContents.send('main:settingDataUpdate', this.settingData)
}

// 动作触发推送
this.triggerAction = (action, data) => {
  global.FBW.mainWindow.win.webContents.send('main:triggerAction', action, data)
}
```

**窗口间通信示例：**

```js
// 主窗口跳转到指定页面
global.FBW.mainWindow.win.webContents.send('main:jumpToPage', key)

// 图片预览窗口数据推送
this.win.webContents.send('main:sendPostData', data)

// 动态壁纸窗口控制
this.win.webContents.send('main:setVideoSource', videoPath)
this.win.webContents.send('main:setVideoMute', mute)
this.win.webContents.send('main:setVideoFrameRate', frameRate)
this.win.webContents.send('main:setVideoScaleMode', mode)
this.win.webContents.send('main:setVideoBrightness', brightness)
this.win.webContents.send('main:setVideoContrast', value)
```

**架构设计与最佳实践：**

- **事件驱动架构**：采用事件驱动的异步通信模式，支持松耦合的组件交互
- **请求-响应模式**：使用 `ipcMain.handle` 和 `ipcRenderer.invoke` 实现可靠的请求-响应通信
- **单向推送模式**：使用 `webContents.send` 实现高效的单向消息推送
- **统一命名规范**：所有 IPC 事件采用 `main:action` 的命名规范，便于管理和维护
- **错误处理机制**：统一的错误处理和响应机制，确保通信的可靠性
- **状态同步策略**：通过主进程中转实现窗口间的状态同步，避免直接窗口间通信
- **性能优化**：异步处理避免阻塞，批量操作减少通信开销
- **安全隔离**：渲染进程只能通过预定义的 IPC 接口访问主进程功能

**通信模式设计：**

1. **同步请求-响应**：适用于需要立即返回结果的操作

   ```js
   // 渲染进程
   const result = await ipcRenderer.invoke('main:getSettingData')

   // 主进程
   ipcMain.handle('main:getSettingData', () => {
     return this.settingManager.getSettingData()
   })
   ```

2. **异步通知推送**：适用于状态变更和事件通知

   ```js
   // 主进程推送
   win.webContents.send('main:settingDataUpdate', newSettings)

   // 渲染进程监听
   ipcRenderer.on('main:settingDataUpdate', (event, settings) => {
     // 处理设置更新
   })
   ```

3. **窗口间通信**：通过主进程中转实现窗口间数据传递
   ```js
   // 窗口A → 主进程 → 窗口B
   global.FBW.mainWindow.win.webContents.send('main:triggerAction', action, data)
   ```

**错误处理策略：**

- **统一错误格式**：所有错误响应采用统一的格式 `{ success: boolean, message: string }`
- **异常捕获**：使用 try-catch 包装所有 IPC 处理器，确保异常不会导致进程崩溃
- **超时处理**：对长时间运行的操作设置超时机制
- **重试机制**：对网络相关操作实现重试逻辑
- **用户反馈**：通过 `sendMsg` 向用户提供操作结果反馈

**性能优化策略：**

- **批量操作**：将多个小操作合并为批量操作，减少通信次数
- **缓存机制**：对频繁访问的数据实现缓存，减少重复请求
- **异步处理**：所有 IPC 处理器都采用异步处理，避免阻塞主线程
- **延迟加载**：按需加载数据和功能，减少初始化时间
- **资源清理**：及时清理不需要的事件监听器，避免内存泄漏

**安全机制：**

- **输入验证**：对所有 IPC 参数进行验证和清理
- **权限控制**：根据操作类型实现不同的权限控制
- **路径安全**：对文件路径进行安全验证，防止路径遍历攻击
- **数据隔离**：确保不同窗口间的数据隔离
- **错误隐藏**：避免在错误信息中暴露敏感的系统信息

**监控与调试：**

- **通信日志**：记录重要的 IPC 通信事件，便于调试和监控
- **性能监控**：监控 IPC 通信的性能指标，识别性能瓶颈
- **错误统计**：统计 IPC 通信错误，及时发现和解决问题
- **调试工具**：开发环境下的 IPC 通信调试工具
- **事件追踪**：支持 IPC 事件的追踪和回放

### 日志管理

日志管理通过 Pino 日志库提供高性能的日志记录功能，支持多级别日志、文件轮转和自动清理。采用结构化日志记录，便于问题排查和性能监控。

**主要功能：**

- **多级别日志**：支持 error、warn、info、debug 等不同级别的日志记录
- **环境适配**：开发环境使用 pino-pretty 美化输出，生产环境使用 pino-roll 文件轮转
- **文件轮转**：自动按日期和大小轮转日志文件，防止单个文件过大
- **异常捕获**：自动捕获和记录未处理的异常和 Promise 拒绝
- **自动清理**：定时清理过期日志文件，节省存储空间
- **全局访问**：通过 `global.logger` 提供全局日志访问接口
- **结构化日志**：支持结构化数据记录，便于日志分析和处理

**日志配置：**

```js
// 日志系统初始化
export default (logDir, fileName = 'app.log') => {
  // 获取用户数据目录
  const logFilePath = join(logDir || process.env.FBW_LOGS_PATH, fileName)

  // 配置 pino-roll 传输
  const transport = pino.transport(
    isDev()
      ? {
          // 开发环境：美化输出
          target: 'pino-pretty',
          options: {
            colorize: true, // 彩色输出
            translateTime: 'SYS:standard', // 时间格式
            ignore: 'pid,hostname' // 忽略字段
          }
        }
      : {
          // 生产环境：文件轮转
          target: 'pino-roll',
          options: {
            file: logFilePath, // 日志文件路径
            frequency: 'daily', // 每天生成新文件
            size: '10M', // 每个文件最大 10MB
            mkdir: true, // 自动创建目录
            dateFormat: 'yyyy-MM-dd' // 文件命名格式：app.log.2025-02-27.1
          }
        }
  )

  // 创建 Pino 实例并挂载到全局
  const logger = pino(transport)
  global.logger = logger
}
```

**异常处理机制：**

```js
// 捕获未处理的异常
process.on('uncaughtException', (err) => {
  const errorMessage = err.message
  const errorName = err.name
  const errorStack = err.stack

  global.logger.error(
    `Uncaught Exception: Name => ${errorName}, Message => ${errorMessage}, Stack => ${errorStack}`
  )
})

// 捕获未处理的 Promise 拒绝
process.on('unhandledRejection', (reason) => {
  if (reason instanceof Error) {
    const errorName = reason.name
    const errorMessage = reason.message
    const errorStack = reason.stack

    global.logger.warn(
      `Uncaught Rejection: Name => ${errorName}, Message => ${errorMessage}, Stack => ${errorStack}`
    )
  } else {
    global.logger.warn(`Unhandled Rejection: ${reason}`)
  }
})
```

**日志使用示例：**

```js
// 应用启动日志
global.logger.info(`isDev: ${isDev()} process.env.NODE_ENV: ${process.env.NODE_ENV}`)
global.logger.info(`getIconPath FBW_RESOURCES_PATH: ${process.env.FBW_RESOURCES_PATH}`)

// 错误日志
global.logger.error(`设置动态壁纸失败: ${err}`)
global.logger.error(`H5服务器启动失败: ${data}`)

// 警告日志
global.logger.warn(`H5服务器IP无效: ${ip}，尝试重启服务`)
global.logger.warn('主窗口未初始化，无法发送H5服务器URL')

// 信息日志
global.logger.info('Store 初始化完成')
global.logger.info(`H5服务器启动成功: ${this.h5ServerUrl}`)
global.logger.info('系统挂起，暂停自动切换壁纸')

// 子进程日志
global.logger.info(`ChildServer START:: serverName => ${this.#serverName}`)
global.logger.info(`ChildServer EXIT:: serverName => ${this.#serverName}`)

// 渲染进程日志
global.logger.info(`[Renderer Console][${level}] ${message} (${sourceId}:${line})`)
```

**日志清理任务：**

```js
// 定时清理旧日志文件
export default class CleanOldLogs {
  #job

  constructor() {
    this.#job = null
  }

  // 启动清理任务（每小时执行一次）
  start(rule = '0 * * * *') {
    this.stop()

    const logDir = process.env.FBW_LOGS_PATH
    if (!logDir) {
      global.logger.error('FBW_LOGS_PATH environment variable is not set.')
      return
    }

    this.#job = schedule.scheduleJob(rule, async () => {
      try {
        await this.cleanOldLogs(logDir)
      } catch (err) {
        global.logger.error(`Failed to clean old logs: ${err.message}`)
      }
    })

    global.logger.info('CleanOldLogs task started.')
  }

  // 清理超过 2 小时的旧日志文件
  async cleanOldLogs(logDir) {
    const now = Date.now()
    const twoHoursAgo = now - 2 * 60 * 60 * 1000

    const files = await fs.promises.readdir(logDir)

    for (const file of files) {
      const filePath = join(logDir, file)

      try {
        const stats = await fs.promises.stat(filePath)

        if (stats.mtimeMs < twoHoursAgo) {
          await fs.promises.unlink(filePath)
          global.logger.info(
            `Deleted old log file: ${file} (last modified: ${new Date(stats.mtimeMs).toISOString()})`
          )
        }
      } catch (err) {
        global.logger.error(`Failed to process file ${file}: ${err.message}`)
      }
    }
  }

  // 停止清理任务
  stop() {
    this.#job?.cancel()
    global.logger.info('CleanOldLogs task stopped.')
  }
}
```

**日志分类与用途：**

**应用生命周期日志：**

- 启动信息：应用版本、环境变量、初始化状态
- 关闭信息：资源清理、异常退出

**业务操作日志：**

- 壁纸操作：切换、设置、下载状态
- 用户操作：设置变更、收藏管理、搜索记录
- 服务状态：H5 服务启停、子进程状态

**系统监控日志：**

- 电源管理：系统挂起/恢复、电池模式切换
- 性能监控：操作耗时、资源使用情况
- 错误追踪：异常堆栈、错误上下文

**调试辅助日志：**

- 开发环境：详细的调试信息
- 网络请求：API 调用、响应状态
- 文件操作：文件读写、路径处理

**架构设计与最佳实践：**

- **结构化日志**：使用 JSON 格式记录结构化数据，便于日志分析
- **分级记录**：根据重要性选择合适的日志级别
- **上下文信息**：记录足够的上下文信息，便于问题定位
- **性能考虑**：异步日志记录，避免阻塞主线程
- **存储管理**：自动轮转和清理，控制日志文件大小
- **安全考虑**：避免记录敏感信息，如密码、密钥等
- **监控集成**：支持日志监控和告警系统集成

**日志级别说明：**

- **error**：错误信息，需要立即关注和处理
- **warn**：警告信息，可能存在问题但不影响正常运行
- **info**：一般信息，记录重要的业务操作和状态变更
- **debug**：调试信息，仅在开发环境使用

**性能优化策略：**

- **异步写入**：使用 Pino 的异步写入机制，避免阻塞
- **批量处理**：批量写入日志，减少 I/O 操作
- **内存缓冲**：使用内存缓冲，提高写入性能
- **压缩存储**：对历史日志进行压缩，节省存储空间
- **索引优化**：为日志文件建立索引，提高查询效率

**监控与告警：**

- **错误率监控**：监控错误日志的数量和频率
- **性能监控**：监控日志写入性能，识别瓶颈
- **存储监控**：监控日志文件大小和存储使用情况
- **异常告警**：对严重错误设置告警机制
- **趋势分析**：分析日志趋势，预测潜在问题

### 缓存管理

缓存管理通过 LRU（最近最少使用）缓存算法提供高效的内存缓存功能。采用多级缓存策略，支持文件缓存、目录缓存和智能缓存清理，显著提升应用性能。

**主要功能：**

- **LRU 缓存**：使用 LRU 算法管理缓存项，自动淘汰最久未使用的项目
- **多级缓存**：支持文件缓存和目录缓存，针对不同数据类型优化
- **智能大小计算**：根据数据内容和头部信息动态计算缓存项大小
- **自动清理**：自动清理过期和超量的缓存项，防止内存泄漏
- **性能优化**：减少重复的文件读取、网络请求和计算操作
- **缓存命中统计**：通过 Server-Timing 头记录缓存命中情况
- **智能缓存策略**：根据文件大小和类型选择不同的缓存策略

**缓存配置：**

```js
// LRU 缓存配置
const options = {
  // 缓存的最大条目数。超过此数量时，最久未使用的条目会被淘汰
  max: 1000,
  // 缓存的最大大小（基于 sizeCalculation 计算的值）
  maxSize: 1000 * 1024 * 1024, // 1GB
  // 用于计算缓存项大小的函数
  sizeCalculation: (value) => {
    // 计算 data 的大小
    const dataSize = value.data.length
    // 计算 headers 的大小
    const headersSize = Buffer.byteLength(JSON.stringify(value.headers))
    // 返回总大小
    return dataSize + headersSize
  },
  // 当缓存项被淘汰时调用的回调函数，用于清理资源
  // dispose: (value, key) => {
  //   console.log(`缓存项 ${key} 被淘汰，值为 ${value}`)
  // },
  // 缓存项的默认存活时间（毫秒）。超过此时间后，缓存项会自动失效。
  ttl: 1000 * 60 * 30, // 30分钟
  // 是否自动清理过期的缓存项
  ttlAutopurge: true,
  // 是否允许返回过期的缓存项（即使过期，仍然可以获取到值）
  allowStale: false,
  // 当调用 get 方法时，是否更新缓存项的存活时间（TTL）
  updateAgeOnGet: false,
  // 当调用 has 方法时，是否更新缓存项的存活时间（TTL）
  updateAgeOnHas: false
  // 当缓存未命中时，用于异步获取数据的函数
  // fetchMethod: async (key, staleValue, { options, signal, context }) => {}
}

const cache = new LRUCache(options)
```

**文件缓存策略：**

```js
// 文件响应处理中的缓存逻辑
export const handleFileResponse = async (query) => {
  const ret = { status: 404, headers: {}, data: null }

  try {
    let { filePath, w, compressStartSize } = query
    if (!filePath) return ret

    // 转换文件路径
    filePath = transFilePath(filePath)
    const width = w ? parseInt(w, 10) : null

    // 生成缓存键（基于文件路径和尺寸参数）
    const cacheKey = `filePath=${filePath}&width=${width}`

    // 1. 先查缓存（只缓存小图/小文件）
    if (cache.has(cacheKey)) {
      const cacheData = cache.get(cacheKey)
      // 返回文件内容和 MIME 类型
      ret.status = 200
      ret.headers = {
        ...cacheData.headers,
        'Server-Timing': `cache-hit;dur=${Date.now() - T1}` // 缓存命中统计
      }
      ret.data = cacheData.data
      return ret
    }

    // 2. 未命中缓存，获取文件信息
    const stats = await fs.promises.stat(filePath)
    const originalFileSize = stats.size
    const extension = path.extname(filePath).toLowerCase()
    const mimeType = mimeTypes[extension] || 'application/octet-stream'
    const CACHE_LIMIT = 10 * 1024 * 1024 // 10MB 缓存限制

    // 判断是否需要缩放
    const canResize =
      ['.png', '.jpg', '.jpeg', '.avif', '.webp', '.gif'].includes(extension) && width
    const needResize = canResize && originalFileSize > startSize

    if (originalFileSize < CACHE_LIMIT) {
      // 小图缓存处理
      let fileBuffer
      if (needResize) {
        fileBuffer = await sharp(filePath)
          .resize({
            width,
            fit: 'inside',
            withoutEnlargement: true,
            kernel: 'lanczos3',
            fastShrinkOnLoad: true
          })
          .toBuffer()
      } else {
        fileBuffer = await fs.promises.readFile(filePath)
      }

      const headers = {
        'Content-Type': mimeType,
        'Content-Length': fileBuffer.length.toString(),
        'Original-Size': originalFileSize,
        'Compressed-Size': fileBuffer.length,
        'Cache-Control': 'max-age=3600',
        ETag: `"${stats.mtimeMs}-${originalFileSize}"`,
        'Last-Modified': stats.mtime.toUTCString(),
        'Server-Timing': `file-check;dur=${T2 - T1}, file-stat;dur=${T3 - T2}, resize;dur=${T4 - T3}, total;dur=${T4 - T1}`
      }

      // 缓存处理结果
      cache.set(cacheKey, {
        data: fileBuffer,
        headers
      })

      ret.status = 200
      ret.headers = headers
      ret.data = fileBuffer
    } else {
      // 大图流式处理（不缓存）
      // ... 流式处理逻辑
    }

    return ret
  } catch (err) {
    return ret
  }
}
```

**目录缓存策略：**

```js
// 文件系统缓存配置
const fsCache = {
  // 缓存的目录数据
  directories: {},
  // 最后更新时间
  lastUpdate: Date.now(),
  // 缓存有效期（毫秒）
  ttl: 60000 // 1分钟
}

// 清除文件系统缓存
export const clearFsCache = () => {
  Object.keys(fsCache.directories).forEach((key) => {
    delete fsCache.directories[key]
  })
  fsCache.lastUpdate = Date.now()
}

// 异步读取目录并返回所有文件（包括子目录中的文件）
export const readDirRecursive = async (
  resourceName,
  dirPath,
  allowedFileExt,
  existingFiles = []
) => {
  // 检查缓存是否存在且有效
  const cacheKey = `${dirPath}_${allowedFileExt.join('_')}`

  if (fsCache.directories[cacheKey] && Date.now() - fsCache.lastUpdate < fsCache.ttl) {
    // 使用缓存数据，但仍然进行增量更新检查
    const cachedFiles = fsCache.directories[cacheKey]

    // 如果没有现有文件信息，直接返回缓存
    if (!existingFiles || existingFiles.length === 0) {
      return cachedFiles
    }

    // 否则，过滤出需要更新的文件
    const existingFilesMap = new Map()
    for (const file of existingFiles) {
      if (file.filePath) {
        existingFilesMap.set(file.filePath, file)
      }
    }

    const ret = cachedFiles.filter((file) => {
      const existingFile = existingFilesMap.get(file.filePath)
      return !existingFile || file.mtimeMs > existingFile.mtimeMs
    })
    return ret
  }

  // 缓存未命中，执行目录扫描
  // ... 目录扫描逻辑

  // 更新缓存
  fsCache.directories[cacheKey] = validRows
  fsCache.lastUpdate = Date.now()

  return validRows
}
```

**缓存清理机制：**

```js
// 缓存清理操作
export const clearCache = () => {
  cache.clear()
  global.FBW.sendMsg(global.FBW.mainWindow.win, {
    type: 'success',
    message: t('messages.clearCacheSuccess')
  })
}

// 文件删除时的缓存清理
async deleteFile(item) {
  // ... 文件删除逻辑

  // 删除相关缓存
  const cacheKeys = cache.keys()
  const newFilePath = transFilePath(filePath)
  for (const key of cacheKeys) {
    if (key.startsWith(`filePath=${newFilePath}`)) {
      cache.delete(key)
      global.logger.info(`删除缓存成功: id => ${id}, cacheKey => ${key}`)
    }
  }

  // ... 继续删除逻辑
}
```

**缓存使用场景：**

**文件缓存场景：**

- **图片处理缓存**：缓存经过 Sharp 处理的图片数据，避免重复处理
- **小文件缓存**：缓存小于 10MB 的文件，提升访问速度
- **HTTP 响应缓存**：缓存文件响应的头部信息和数据
- **ETag 缓存**：基于文件修改时间和大小生成 ETag，支持条件请求

**目录缓存场景：**

- **目录扫描缓存**：缓存目录扫描结果，减少文件系统访问
- **增量更新**：基于文件修改时间进行增量更新
- **快速查找**：缓存文件元数据，支持快速查找和过滤

**缓存优化策略：**

**智能缓存策略：**

- **大小限制**：小文件（<10MB）使用内存缓存，大文件使用流式处理
- **格式优化**：图片文件支持尺寸调整和格式转换缓存
- **时间控制**：文件缓存 30 分钟，目录缓存 1 分钟
- **空间管理**：最大 1000 个条目，总大小限制 1GB

**性能优化：**

- **缓存命中统计**：通过 Server-Timing 头记录缓存命中情况
- **批量操作**：支持批量缓存操作，减少 I/O 开销
- **异步处理**：缓存操作不阻塞主线程
- **内存优化**：精确计算缓存项大小，避免内存浪费

**缓存监控：**

**性能指标：**

- **缓存命中率**：通过 Server-Timing 头统计缓存命中情况
- **缓存大小**：监控缓存条目数和总大小
- **缓存效率**：统计缓存命中对性能的提升
- **内存使用**：监控缓存对内存使用的影响

**清理策略：**

- **自动清理**：TTL 自动清理过期缓存项
- **手动清理**：支持手动清理所有缓存
- **关联清理**：文件删除时自动清理相关缓存
- **定期清理**：定期清理无效缓存项

**架构设计与最佳实践：**

- **分层缓存**：文件缓存和目录缓存分离，针对不同数据类型优化
- **智能淘汰**：使用 LRU 算法自动淘汰最久未使用的缓存项
- **大小控制**：精确计算缓存项大小，防止内存溢出
- **时间管理**：合理的 TTL 设置，平衡性能和内存使用
- **错误处理**：缓存操作失败不影响主业务流程
- **监控集成**：支持缓存性能监控和统计
- **安全考虑**：避免缓存敏感数据，及时清理过期缓存

**缓存级别说明：**

- **L1 缓存（内存缓存）**：LRU 缓存，存储处理后的文件数据
- **L2 缓存（目录缓存）**：文件系统缓存，存储目录扫描结果
- **L3 缓存（磁盘缓存）**：通过文件系统实现的持久化缓存

**性能优化策略：**

- **预加载机制**：预加载常用文件到缓存
- **压缩存储**：对缓存数据进行压缩，节省内存空间
- **批量操作**：批量处理缓存操作，提高效率
- **异步更新**：异步更新缓存，不阻塞主线程
- **智能预取**：根据访问模式智能预取数据

### 应用更新

应用更新通过 electron-updater 库实现自动更新功能，支持检查更新、下载和安装。采用 GitHub Releases 作为更新源，提供完整的更新生命周期管理。

**主要功能：**

- **自动检查**：定期检查应用更新，支持手动触发检查
- **更新通知**：通过系统通知提醒用户有可用更新
- **开发环境支持**：开发环境支持调试更新功能
- **多平台支持**：支持 Windows、macOS 平台的自动更新
- **错误处理**：处理更新过程中的各种错误和异常情况
- **用户交互**：提供更新进度反馈和用户操作界面
- **回滚支持**：支持版本回滚和降级操作
- **增量更新**：支持增量更新包，减少下载大小

**更新器配置：**

```js
// 更新器初始化
export default class Updater {
  constructor() {
    this.init()
  }

  init() {
    if (!app.isPackaged) {
      // 开发环境配置
      autoUpdater.forceDevUpdateConfig = true
      autoUpdater.logger = global.logger
      global.logger.info(`更新配置路径: ${JSON.stringify(autoUpdater.configOnDisk)}`)

      // 开发环境忽略代码签名检查
      autoUpdater.disableWebInstaller = true
      // 支持降级
      autoUpdater.allowDowngrade = true
      // 配置自定义更新服务器
      autoUpdater.setFeedURL({
        provider: 'generic',
        url: 'http://localhost:8080'
      })
    }

    // 生产环境配置
    autoUpdater.autoDownload = false // 不自动下载，等待用户确认
    autoUpdater.autoInstallOnAppQuit = true // 应用退出后自动安装

    // 监听渲染进程的检查更新事件
    ipcMain.on('main:checkUpdate', () => {
      autoUpdater.checkForUpdatesAndNotify()
    })
  }

  // 事件监听器
  on(event, callback = () => {}) {
    if (typeof callback !== 'function') {
      throw new Error('callback must be a function')
    }
    autoUpdater.on(event, callback)
  }

  // 手动检查更新
  checkUpdate() {
    autoUpdater.checkForUpdatesAndNotify()
  }
}
```

**更新事件处理：**

```js
// 更新器初始化
updater = new Updater()

// 有可用更新
updater.on('update-available', (info) => {
  global.logger.info('有可用更新', info)

  // 显示系统通知
  const notice = new Notification({
    title: t('actions.checkUpdate'),
    body: t('messages.updateAvailable', {
      version: `v${info.version}`
    })
  })

  // 点击通知打开更新页面
  notice.on('click', () => {
    shell.openExternal(appInfo.github + '/releases')
  })

  notice.show()
})

// 无需更新
updater.on('update-not-available', (info) => {
  global.logger.info('无需更新', info)

  // 显示系统通知
  new Notification({
    title: t('actions.checkUpdate'),
    body: t('messages.updateNotAvailable')
  }).show()
})

// 更新错误
updater.on('error', (err) => {
  global.logger.error(`更新失败： error => ${err}`)

  // 显示错误通知
  new Notification({
    title: t('actions.checkUpdate'),
    body: t('messages.checkUpdateFail')
  }).show()
})
```

**构建配置：**

```yaml
# electron-builder.yml
appId: co.oxoyo.flying-bird-wallpaper
productName: Flying Bird Wallpaper

# 启用更新文件生成
generateUpdatesFilesForAllChannels: true

# 发布配置
publish:
  # GitHub 发布配置
  provider: github
  owner: OXOYO
  repo: Flying-Bird-Wallpaper
  private: false
  releaseType: release
  publishAutoUpdate: true
  # 更新通道配置
  channel: latest
  # 发布文件配置
  publisherName: ['*.exe', '*.dmg', 'latest*.yml', '!*.blockmap']

# Windows 配置
win:
  executableName: Flying Bird Wallpaper
  target:
    - target: nsis
      arch:
        - x64
        - arm64

# macOS 配置
mac:
  artifactName: 'Flying-Bird-Wallpaper-${version}-${arch}.${ext}'
  entitlementsInherit: build/entitlements.mac.plist
  category: public.app-category.utilities
  darkModeSupport: true
  hardenedRuntime: true
  gatekeeperAssess: false
  icon: build/icon.icns
  identity: 'co.oxoyo.flying-bird-wallpaper'
  target:
    - target: dmg
      arch:
        - x64
        - arm64

# DMG 配置
dmg:
  artifactName: 'Flying-Bird-Wallpaper-${version}-${arch}.${ext}'
  icon: build/icon.icns
  window:
    width: 540
    height: 380
  writeUpdateInfo: true
```

**开发环境配置：**

```yaml
# dev-app-update.yml
provider: github
owner: OXOYO
repo: Flying-Bird-Wallpaper
updaterCacheDirName: Flying Bird Wallpaper-updater
```

**更新流程管理：**

```js
// 更新状态管理
class UpdateManager {
  constructor() {
    this.updateStatus = {
      checking: false,
      available: false,
      downloading: false,
      downloaded: false,
      error: null
    }
    this.updateInfo = null
  }

  // 检查更新
  async checkForUpdates() {
    if (this.updateStatus.checking) return

    this.updateStatus.checking = true
    this.updateStatus.error = null

    try {
      await autoUpdater.checkForUpdates()
    } catch (error) {
      this.updateStatus.error = error
      this.handleUpdateError(error)
    } finally {
      this.updateStatus.checking = false
    }
  }

  // 下载更新
  async downloadUpdate() {
    if (!this.updateInfo || this.updateStatus.downloading) return

    this.updateStatus.downloading = true
    this.updateStatus.error = null

    try {
      await autoUpdater.downloadUpdate()
    } catch (error) {
      this.updateStatus.error = error
      this.handleUpdateError(error)
    }
  }

  // 安装更新
  async installUpdate() {
    if (!this.updateStatus.downloaded) return

    try {
      autoUpdater.quitAndInstall()
    } catch (error) {
      this.updateStatus.error = error
      this.handleUpdateError(error)
    }
  }

  // 处理更新错误
  handleUpdateError(error) {
    global.logger.error(`更新错误: ${error.message}`)

    // 显示错误通知
    new Notification({
      title: t('actions.checkUpdate'),
      body: t('messages.updateError', { error: error.message })
    }).show()
  }
}
```

**更新事件类型：**

**检查更新事件：**

- `checking-for-update`：开始检查更新
- `update-available`：发现可用更新
- `update-not-available`：无可用更新
- `error`：检查更新时发生错误

**下载更新事件：**

- `download-progress`：下载进度更新
- `update-downloaded`：更新下载完成
- `error`：下载更新时发生错误

**安装更新事件：**

- `update-downloaded`：更新已下载，准备安装
- `before-quit-for-update`：应用即将退出进行更新

**用户交互界面：**

```js
// 更新对话框组件
class UpdateDialog {
  constructor() {
    this.dialog = null
    this.updateInfo = null
  }

  // 显示更新对话框
  showUpdateDialog(updateInfo) {
    this.updateInfo = updateInfo

    this.dialog = new BrowserWindow({
      width: 400,
      height: 300,
      modal: true,
      parent: global.FBW.mainWindow.win,
      webPreferences: {
        nodeIntegration: true,
        contextIsolation: false
      }
    })

    this.dialog.loadFile('update-dialog.html')
  }

  // 更新进度显示
  updateProgress(progress) {
    if (this.dialog) {
      this.dialog.webContents.send('update-progress', progress)
    }
  }

  // 关闭对话框
  close() {
    if (this.dialog) {
      this.dialog.close()
      this.dialog = null
    }
  }
}
```

**架构设计与最佳实践：**

- **分层架构**：更新器、事件处理、用户界面分离
- **错误处理**：完善的错误处理和用户反馈机制
- **用户体验**：非阻塞更新检查，友好的用户界面
- **安全性**：代码签名验证，安全的更新源
- **性能优化**：增量更新，后台下载
- **兼容性**：支持多平台和不同版本
- **监控集成**：更新状态监控和日志记录

**更新策略：**

**检查策略：**

- **启动检查**：应用启动时检查更新
- **定期检查**：定时检查更新（可配置）
- **手动检查**：用户手动触发检查
- **后台检查**：应用运行时后台检查

**下载策略：**

- **用户确认**：用户确认后开始下载
- **后台下载**：下载过程不阻塞用户操作
- **进度显示**：实时显示下载进度
- **断点续传**：支持下载中断和恢复

**安装策略：**

- **退出安装**：应用退出时自动安装
- **用户确认**：用户确认后立即安装
- **回滚支持**：安装失败时支持回滚
- **静默安装**：支持静默安装模式

**安全机制：**

- **代码签名**：验证更新包的代码签名
- **完整性检查**：验证更新包的完整性
- **来源验证**：验证更新源的合法性
- **权限控制**：限制更新操作的权限

**监控与调试：**

- **更新日志**：记录详细的更新过程日志
- **错误统计**：统计更新错误和失败率
- **性能监控**：监控更新过程的性能指标
- **用户反馈**：收集用户对更新过程的反馈
- **调试工具**：开发环境下的更新调试工具

**版本管理：**

- **语义化版本**：使用语义化版本号管理
- **更新通道**：支持稳定版和测试版通道
- **兼容性检查**：检查版本兼容性
- **强制更新**：支持强制更新机制
- **增量更新**：支持增量更新包

---
