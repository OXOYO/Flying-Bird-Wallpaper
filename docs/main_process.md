# 主进程

---

## 目录结构

主进程相关代码位于 `src/main/` 目录下，结构如下：

```
src/main/
├── index.mjs                # 主进程入口，应用初始化、全局事件、窗口/服务创建
├── ApiBase.js               # API 插件开发基类
├── cache.mjs                # 缓存管理
├── logger.mjs               # 日志系统
├── updater.mjs              # 自动更新逻辑
├── jobs/                    # 定时任务相关模块
│   └── CleanOldLogs.mjs     # 日志清理任务
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
- **jobs/**：定时任务相关模块，如日志清理等。
- **logger.mjs**：日志系统，支持多级别日志输出与持久化。
- **updater.mjs**：自动更新逻辑，集成 Electron 的更新机制。
- **ApiBase.js**：API 插件开发基类，便于扩展第三方壁纸源。

---

## 环境变量

主进程在启动时会设置一系列环境变量，这些变量主要用于统一管理应用运行时的各种目录路径和资源位置，便于在不同平台、开发/生产环境下灵活切换。

**设置位置**：`src/main/index.mjs`（应用启动阶段）

**主要环境变量说明：**

```js
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
```

- `FBW_USER_DATA_PATH`：用户数据目录（如配置、数据库、缓存等）。
- `FBW_LOGS_PATH`：日志文件目录。
- `FBW_DATABASE_PATH` / `FBW_DATABASE_FILE_PATH`：数据库文件目录和路径。
- `FBW_DOWNLOAD_PATH`：壁纸下载目录。
- `FBW_CERTS_PATH`：证书存放目录。
- `FBW_PLUGINS_PATH`：插件目录。
- `FBW_TEMP_PATH`：临时文件目录。
- `FBW_RESOURCES_PATH`：资源目录（开发环境为源码目录，生产环境为打包资源目录）。

**作用**：

- 保证所有主进程和子进程访问的路径一致，便于多平台兼容。
- 支持用户数据、日志、插件、下载等的独立管理和持久化。

---

## 全局变量

主进程通过 `global.FBW` 对象维护全局状态、窗口实例、工具方法等，方便在各模块间共享和调用。

**设置位置**：`src/main/index.mjs`（应用启动阶段）

**主要全局变量说明：**

```js
global.FBW = global.FBW || {}
global.FBW.apiHelpers = {
  axios,
  ApiBase,
  calculateImageOrientation,
  calculateImageQuality
}
global.FBW.iconLogo = getIconPath('icon_512x512.png')
global.FBW.iconTray = getIconPath('icon_32x32.png')
global.FBW.flags = { isQuitting: false }
global.FBW.loadingWindow = LoadingWindow.getInstance()
global.FBW.mainWindow = MainWindow.getInstance()
global.FBW.viewImageWindow = ViewImageWindow.getInstance()
global.FBW.suspensionBall = SuspensionBall.getInstance()
global.FBW.dynamicWallpaperWindow = DynamicWallpaperWindow.getInstance()
global.FBW.rhythmWallpaperWindow = RhythmWallpaperWindow.getInstance()
```

- `global.FBW.apiHelpers`：API 插件开发辅助工具（如 axios、ApiBase、图片处理等）。
- `global.FBW.iconLogo` / `global.FBW.iconTray`：应用主图标和托盘图标路径。
- `global.FBW.flags`：全局状态标志（如是否正在退出）。
- `global.FBW.loadingWindow` / `mainWindow` / `viewImageWindow` / `suspensionBall` / `dynamicWallpaperWindow` / `rhythmWallpaperWindow`：所有主窗口和功能窗口的单例实例，便于全局调度和管理。
- `global.FBW.store`：Store 实例，聚合所有 Manager，统一管理数据、服务、定时任务、IPC 等。

**作用**：

- 方便在主进程各模块间共享窗口、服务、工具、状态等，无需重复实例化。
- 支持主进程与渲染进程、子进程的高效通信和资源调度。
- 便于插件、API 扩展时获取全局能力。

---

**总结**：

- 环境变量主要用于路径、资源、配置的全局统一，保证多平台和多环境下的兼容性和灵活性。
- 全局变量（`global.FBW`）则是主进程的“总线”，集中管理窗口、服务、工具、状态等，极大提升了主进程的可维护性和扩展性。

如需了解更多细节，可查阅 `src/main/index.mjs` 相关代码。

---
