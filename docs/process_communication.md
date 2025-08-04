# 进程通信

---

## 概述

飞鸟壁纸采用多进程架构，包含主进程、渲染进程和子进程。不同进程之间通过不同的通信机制进行数据交换和功能协作。本文档详细介绍主进程与渲染进程、主进程与子进程之间的通信实现。

---

## 主进程与渲染进程通信

### 1. 通信架构

主进程与渲染进程之间的通信通过预加载脚本（Preload Script）实现，采用 `contextBridge` 和 `ipcRenderer` 技术。

**功能说明：**
预加载脚本是 Electron 安全架构的核心组件，它在渲染进程加载之前执行，可以访问 Node.js API 和 Electron API。通过 `contextBridge`，我们可以安全地将主进程的功能暴露给渲染进程，同时保持上下文隔离的安全性。这种方式避免了直接暴露 Node.js API 给渲染进程，提高了应用的安全性。

**实现原理：**

1. 预加载脚本在渲染进程的隔离上下文中运行
2. 通过 `contextBridge.exposeInMainWorld()` 将 API 暴露给渲染进程
3. 渲染进程通过 `window.FBW` 对象访问这些 API
4. 所有通信都是异步的，不会阻塞 UI 线程

```js:src/preload/index.mjs
import { contextBridge, ipcRenderer } from 'electron'

// 创建一个对象来存储已注册的回调引用
const listeners = {
  jumpToPage: null,
  commonData: null,
  sendPostData: null,
  settingDataUpdate: null,
  sendMsg: null,
  triggerAction: null,
  setVideoPath: null,
  setVideoSource: null,
  setVideoMute: null,
  setVideoFrameRate: null,
  setVideoScaleMode: null,
  setVideoBrightness: null,
  setVideoContrast: null
}

const api = {
  onSettingDataUpdate: (callback) => {
    listeners.settingDataUpdate = callback
    ipcRenderer.on('main:settingDataUpdate', callback)
  },
  offSettingDataUpdate: () => {
    if (listeners.settingDataUpdate) {
      ipcRenderer.off('main:settingDataUpdate', listeners.settingDataUpdate)
      listeners.settingDataUpdate = null
    }
  },

  // 方法调用
  search: (...args) => ipcRenderer.invoke('main:search', ...args),
  getSettingData: (...args) => ipcRenderer.invoke('main:getSettingData', ...args)
}

// 暴露给渲染进程
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('FBW', api)
  } catch (err) {
    console.error(err)
  }
} else {
  window.FBW = api
}
```

### 2. 通信方式

#### 2.1 渲染进程调用主进程方法

**功能说明：**
渲染进程通过预加载脚本暴露的 API 调用主进程的方法。这种方式实现了渲染进程与主进程之间的双向通信，渲染进程可以请求主进程执行各种操作，如文件操作、数据库查询、系统调用等。所有调用都是异步的，返回 Promise 对象，不会阻塞渲染进程的 UI 线程。

**使用场景：**

- 搜索图片和视频资源
- 获取应用设置数据
- 执行文件操作（选择文件、删除文件等）
- 控制窗口行为（打开、关闭、调整大小等）
- 设置壁纸和动态壁纸

```js:src/renderer/windows/MainWindow/components/ExploreCommon.vue
// 渲染进程中调用主进程方法
const res = await window.FBW.search({
  resourceType,
  resourceName,
  startPage,
  pageSize,
  isRandom,
  sortField,
  sortType,
  filterKeywords,
  filterType,
  quality: quality.toString(),
  orientation: orientation.toString()
})
```

#### 2.2 主进程向渲染进程发送事件

**功能说明：**
主进程可以向渲染进程发送事件，实现主进程到渲染进程的单向通信。这种方式通常用于通知渲染进程某些状态发生了变化，如设置更新、数据同步、系统事件等。主进程可以同时向多个窗口发送事件，确保所有窗口都能接收到最新的状态信息。

**使用场景：**

- 设置数据更新通知
- 系统状态变化通知
- 错误和警告消息
- 进度更新通知
- 实时数据同步

```js:src/main/store/index.mjs
// 主进程中向渲染进程发送事件
sendSettingDataUpdate() {
  if (global.FBW.mainWindow.win) {
    global.FBW.mainWindow.win.webContents.send('main:settingDataUpdate', this.settingData)
  }
  if (global.FBW.viewImageWindow.win) {
    global.FBW.viewImageWindow.win.webContents.send('main:settingDataUpdate', this.settingData)
  }
  if (global.FBW.suspensionBall.win) {
    global.FBW.suspensionBall.win.webContents.send('main:settingDataUpdate', this.settingData)
  }
  if (global.FBW.dynamicWallpaperWindow.win) {
    global.FBW.dynamicWallpaperWindow.win.webContents.send('main:settingDataUpdate', this.settingData)
  }
  if (global.FBW.rhythmWallpaperWindow.win) {
    global.FBW.rhythmWallpaperWindow.win.webContents.send('main:settingDataUpdate', this.settingData)
  }
}
```

**代码说明：**

- 使用 `webContents.send()` 向特定窗口发送事件
- 分别检查每个窗口是否存在，避免向未创建的窗口发送消息
- 这种方式比 `BrowserWindow.getAllWindows().forEach()` 更精确，可以针对不同窗口发送不同的数据
- 确保设置数据在所有窗口间保持同步

#### 2.3 渲染进程监听主进程事件

**功能说明：**
渲染进程可以监听主进程发送的事件，实现事件驱动的响应机制。通过注册事件监听器，渲染进程可以实时响应主进程的状态变化和通知。这种机制确保了渲染进程能够及时更新界面状态，提供良好的用户体验。

**生命周期管理：**

- 在组件挂载前注册事件监听器
- 在组件卸载前解绑事件监听器，防止内存泄漏
- 使用统一的回调函数处理不同类型的事件

**事件类型：**

- 设置数据更新事件
- 通用数据同步事件
- 消息通知事件
- 系统状态变化事件

```js:src/renderer/components/CommonApp.vue
// 渲染进程中监听主进程事件
onBeforeMount(async () => {
  // 监听设置数据更新事件
  window.FBW.onSettingDataUpdate(onSettingDataUpdateCallback)
  // 监听主进程通用数据
  window.FBW.onCommonData(onCommonDataCallback)
  // 监听主进程消息
  window.FBW.onSendMsg(onSendMsgCallback)

  await init()
})

onBeforeUnmount(() => {
  // 取消监听设置数据更新事件
  window.FBW.offSettingDataUpdate(onSettingDataUpdateCallback)
  // 取消监听主进程通用数据
  window.FBW.offCommonData(onCommonDataCallback)
  // 取消监听主进程消息
  window.FBW.offSendMsg(onSendMsgCallback)
})
```

### 3. 安全机制

**功能说明：**
Electron 应用的安全机制通过窗口配置选项实现，确保应用在提供丰富功能的同时保持安全性。通过启用上下文隔离、禁用 Node.js 集成、使用预加载脚本等方式，可以有效防止恶意代码的执行和资源访问。

**安全特性：**

- **上下文隔离**：渲染进程与主进程完全隔离，无法直接访问 Node.js API
- **预加载脚本**：通过受控的 API 暴露功能，而不是直接暴露所有 API
- **沙箱模式**：在需要文件系统访问时禁用沙箱，但通过其他方式保证安全
- **CSP 策略**：通过内容安全策略限制资源加载

```js:src/main/windows/MainWindow.mjs
// 主进程窗口配置
const options = {
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
```

---

## 主进程与子进程通信

### 1. 子进程类型

飞鸟壁纸中的子进程主要包括：

- **H5 服务子进程**：提供本地 HTTP/HTTPS 服务，支持 Socket.IO 实时通信
- **文件服务子进程**：处理文件扫描、图片质量计算等操作

### 2. 通信架构

#### 2.1 子进程创建

飞鸟壁纸使用 Electron 的 `utilityProcess` 来创建子进程，这是 Electron 推荐的安全方式。

**功能说明：**
子进程创建是主进程与子进程通信的基础。通过 `utilityProcess` 创建的子进程具有更好的安全性和性能，比传统的 `child_process` 更适合 Electron 应用。子进程可以独立运行，即使崩溃也不会影响主进程的稳定性。

**技术优势：**

- **安全性**：`utilityProcess` 提供了更好的安全隔离
- **性能**：比传统的 `child_process` 更高效
- **稳定性**：子进程崩溃不会影响主进程
- **资源管理**：更好的内存和 CPU 资源管理

**通信机制：**

- 使用 `MessageChannelMain` 创建消息通道
- 通过端口进行双向通信
- 支持传递可转移对象（如端口本身）

```js:src/main/child_server/ChildServer.mjs
import { utilityProcess, MessageChannelMain } from 'electron'

export default class ChildServer {
  #serverName
  #serverPath
  #child
  #port2

  constructor(serverName, serverPath) {
    global.logger.info(
      `ChildServer INIT:: serverName => ${serverName}, serverPath => ${serverPath}`
    )
    this.#serverName = serverName
    this.#serverPath = serverPath
    this.#child = null
    this.#port2 = null
  }

  start({ options, onMessage = () => {} } = {}) {
    const { port1, port2 } = new MessageChannelMain()
    this.#child = utilityProcess.fork(this.#serverPath, options)
    global.logger.info(`ChildServer START:: serverName => ${this.#serverName}`)
    this.#port2 = port2

    this.#child.on('exit', () => {
      global.logger.info(`ChildServer EXIT:: serverName => ${this.#serverName}`)
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
    global.logger.info(`ChildServer STOP:: serverName => ${this.#serverName}`)
    if (!this.#child) {
      global.logger.info(
        `ChildServer STOP FAILED:: SERVER NOT START, serverName => ${this.#serverName}`
      )
      return
    }
    const isSuccess = this.#child?.kill()
    typeof callback === 'function' && callback(isSuccess)
  }

  postMessage(data) {
    this.#port2?.postMessage(data)
  }
}
```

#### 2.2 主进程向子进程发送消息

**功能说明：**
主进程可以向子进程发送消息，控制子进程的行为和获取子进程的执行结果。通过消息传递机制，主进程可以启动子进程服务、发送配置参数、请求数据处理等。这种通信方式支持异步操作，不会阻塞主进程的执行。

**消息类型：**

- **服务启动消息**：启动 H5 服务、文件服务等
- **配置更新消息**：发送设置变更、参数调整等
- **任务请求消息**：请求文件扫描、图片处理等
- **控制消息**：停止服务、重启服务等

**错误处理：**

- 支持重试机制，提高服务启动的可靠性
- 完善的错误日志记录
- 优雅的失败处理

```js:src/main/store/index.mjs
// 主进程中启动 H5 服务
handleH5ServerStart(maxRetries = 3, retryInterval = 2000) {
  let retryCount = 0

  const attemptStart = () => {
    try {
      this.h5Server?.start({
        options: {
          env: process.env
        },
        onMessage: async ({ data }) => {
          switch (data.event) {
            case 'SERVER_START::SUCCESS': {
              this.h5ServerUrl = data.url
              global.logger.info(`H5服务器启动成功: ${this.h5ServerUrl}`)

              // 发送消息到主窗口
              if (global.FBW.mainWindow.win) {
                global.FBW.sendCommonData(global.FBW.mainWindow.win)
                global.FBW.sendMsg(global.FBW.mainWindow.win, {
                  type: 'success',
                  message: t('messages.h5ServerStartSuccess')
                })
              }
              break
            }
            case 'SERVER_START::FAIL': {
              global.logger.error(`H5服务器启动失败: ${data}`)
              break
            }
            case 'SERVER_LOG': {
              const type = data.level
              if (type && typeof global.logger[type] === 'function') {
                global.logger[type](data.message)
              } else {
                global.logger.info(`[H5Server] INFO => ${data.message}`)
              }
              break
            }
          }
        }
      })
    } catch (err) {
      global.logger.error(`启动H5服务器失败: ${err}`)
      // 重试逻辑...
    }
  }

  // 开始第一次尝试
  attemptStart()
}

// 向 H5 子进程发送设置更新
async updateSettingData(data) {
  // 更新设置
  const res = await this.settingManager.updateSettingData(data)
  if (res.success) {
    // 向H5子进程发送设置更新
    this.h5Server?.postMessage({
      event: 'APP_SETTING_UPDATED',
      data: this.settingData
    })
    // 发送更新消息
    this.sendSettingDataUpdate()
  }
  return res
}
```

#### 2.3 子进程接收主进程消息

**功能说明：**
子进程通过消息通道接收来自主进程的消息，并根据消息类型执行相应的操作。子进程可以访问主进程的模块和资源，实现复杂的数据处理和服务提供功能。通过事件驱动的方式处理消息，确保子进程能够及时响应主进程的请求。

**服务类型：**

- **H5 服务**：提供本地 HTTP/HTTPS 服务，支持 Socket.IO 实时通信
- **文件服务**：处理文件扫描、图片质量计算等耗时操作
- **数据处理服务**：执行复杂的数据分析和处理任务

**消息处理：**

- 使用事件驱动架构处理不同类型的消息
- 支持异步操作，不会阻塞消息接收
- 完善的错误处理和日志记录

```js:src/main/child_server/h5_server/index.mjs
/**
 * h5服务子进程
 * */
import DatabaseManager from '../../store/DatabaseManager.mjs'
import SettingManager from '../../store/SettingManager.mjs'
import ResourcesManager from '../../store/ResourcesManager.mjs'
import FileManager from '../../store/FileManager.mjs'
import server from './server.mjs'

process.parentPort.on('message', (e) => {
  const [port] = e.ports

  const handleLogger = (type = 'info') => {
    return (data) => {
      if (!data) {
        return
      }
      const postData = {
        event: 'SERVER_LOG',
        level: type,
        message: ''
      }
      if (typeof data === 'string') {
        postData.message = data
      } else if (typeof data === 'object') {
        postData.message = JSON.stringify(data)
      }
      port.postMessage(postData)
    }
  }
  const logger = {
    info: handleLogger('info'),
    warn: handleLogger('warn'),
    error: handleLogger('error')
  }

  // 监听消息
  port.on('message', async (e) => {
    try {
      const { data } = e
      // 启动h5服务
      if (data.event === 'SERVER_START') {
        // 初始化数据库管理器
        dbManager = DatabaseManager.getInstance(logger)
        await dbManager.waitForInitialization()

        // 初始化各种管理器并等待它们初始化完成
        settingManager = SettingManager.getInstance(logger, dbManager)
        await settingManager.waitForInitialization()

        fileManager = FileManager.getInstance(logger, dbManager, settingManager)
        resourcesManager = ResourcesManager.getInstance(
          logger,
          dbManager,
          settingManager,
          fileManager
        )
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
          },
          onStartFail: (data) => {
            port.postMessage({
              event: 'SERVER_START::FAIL',
              ...data
            })
          }
        })
        ioServer = serverRes.ioServer
      } else if (data.event === 'APP_SETTING_UPDATED') {
        await settingManager.getSettingData()
        // 广播设置更新给所有客户端
        ioServer?.emit('settingUpdated', {
          success: true,
          data: settingManager.settingData
        })
      }
    } catch (err) {
      logger.error(`[H5Server] ERROR => ${err}`)
    }
  })

  port.start()
})
```

#### 2.4 文件服务子进程示例

**功能说明：**
文件服务子进程专门处理文件系统相关的操作，包括目录扫描、文件信息提取、图片质量计算等。这些操作通常比较耗时，放在子进程中执行可以避免阻塞主进程，提高应用的响应性。子进程支持批量处理和进度报告，能够高效处理大量文件。

**主要功能：**

- **目录扫描**：递归扫描指定目录下的所有文件
- **文件信息提取**：获取文件大小、创建时间、修改时间等
- **图片质量计算**：分析图片尺寸、格式、压缩率等
- **批量处理**：支持大量文件的批量处理，避免内存溢出
- **进度报告**：实时向主进程报告处理进度

**性能优化：**

- 使用并行处理提高扫描效率
- 分批处理避免内存溢出
- 让出事件循环保持响应性

```js:src/main/child_server/file_server/index.mjs
/**
 * 文件服务子进程
 * */
import { readDirRecursive, calculateImageByPath } from '../../utils/utils.mjs'

process.parentPort.on('message', (e) => {
  const [port] = e.ports

  const handleLogger = (type = 'info') => {
    return (data) => {
      if (!data) {
        return
      }
      const postData = {
        event: 'SERVER_LOG',
        level: type,
        message: ''
      }
      if (typeof data === 'string') {
        postData.message = data
      } else if (typeof data === 'object') {
        postData.message = JSON.stringify(data)
      }
      port.postMessage(postData)
    }
  }
  const logger = {
    info: handleLogger('info'),
    warn: handleLogger('warn'),
    error: handleLogger('error')
  }

  // 监听消息
  port.on('message', async (e) => {
    const { data } = e

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

    if (data.event === 'SERVER_START') {
      port.postMessage({
        event: 'SERVER_START::SUCCESS'
      })
    } else if (data.event === 'REFRESH_DIRECTORY') {
      const readDirTime = {
        start: Date.now(),
        end: Date.now()
      }
      try {
        // 获取现有文件列表（如果有）
        const existingFiles = data.existingFiles || []

        const fileMap = new Map()

        // 并行处理多个目录
        const dirPromises = data.folderPaths.map((folderPath) =>
          readDirRecursive(data.resourceName, folderPath, data.allowedFileExt, existingFiles)
        )
        // 等待所有目录处理完成
        const results = await Promise.all(dirPromises)

        // 合并结果
        for (const fileList of results) {
          if (fileList && fileList.length) {
            for (const item of fileList) {
              fileMap.set(item.filePath, item)
            }
          }
        }

        readDirTime.end = Date.now()

        // 添加统计信息
        const stats = {
          newFiles: fileMap.size,
          modifiedFiles: 0,
          totalProcessed: fileMap.size
        }

        // 对于大量文件，使用批量处理
        if (fileMap.size > 5000) {
          // 先发送一个处理中的消息
          port.postMessage({
            event: 'REFRESH_DIRECTORY::PROCESSING',
            isManual: data.isManual,
            resourceName: data.resourceName,
            totalFiles: fileMap.size,
            refreshDirStartTime: data.refreshDirStartTime,
            readDirTime
          })

          // 分批处理文件
          const batchedList = await processBatch([...fileMap.values()], 1000)

          // 发送最终结果
          port.postMessage({
            event: 'REFRESH_DIRECTORY::SUCCESS',
            isManual: data.isManual,
            resourceName: data.resourceName,
            list: batchedList,
            stats,
            refreshDirStartTime: data.refreshDirStartTime,
            readDirTime
          })
        } else {
          // 对于少量文件，直接发送
          port.postMessage({
            event: 'REFRESH_DIRECTORY::SUCCESS',
            isManual: data.isManual,
            resourceName: data.resourceName,
            list: [...fileMap.values()],
            stats,
            refreshDirStartTime: data.refreshDirStartTime,
            readDirTime
          })
        }
      } catch (err) {
        logger.error(`[FileServer] ERROR => 刷新资源目录失败: ${err}`)
        readDirTime.end = Date.now()
        port.postMessage({
          event: 'REFRESH_DIRECTORY::FAIL',
          isManual: data.isManual,
          resourceName: data.resourceName,
          list: [],
          refreshDirStartTime: data.refreshDirStartTime,
          readDirTime
        })
      }
    } else if (data.event === 'HANDLE_IMAGE_QUALITY') {
      try {
        const { list } = data
        const ret = []
        for (let i = 0; i < list.length; i++) {
          const imgData = await calculateImageByPath(list[i].filePath)
          ret.push({
            id: list[i].id,
            ...imgData
          })
        }
        port.postMessage({
          event: 'HANDLE_IMAGE_QUALITY::SUCCESS',
          resourceName: data.resourceName,
          list: ret
        })
      } catch (err) {
        logger.error(`[FileServer] ERROR => 处理图片质量失败: ${err}`)
        port.postMessage({
          event: 'HANDLE_IMAGE_QUALITY::FAIL',
          resourceName: data.resourceName,
          list: []
        })
      }
    }
  })

  port.start()
})
```

#### 2.5 主进程处理子进程消息

**功能说明：**
主进程接收和处理来自子进程的消息，包括处理结果、状态更新、错误信息等。通过消息处理机制，主进程可以获取子进程的执行结果，更新应用状态，并向用户界面发送相应的通知。这种机制确保了主进程能够及时响应用户操作和系统事件。

**消息类型：**

- **成功消息**：处理完成，包含结果数据
- **失败消息**：处理失败，包含错误信息
- **进度消息**：处理进度更新
- **日志消息**：子进程的日志信息

**处理流程：**

- 根据消息类型执行不同的处理逻辑
- 更新内存中的资源映射
- 向用户界面发送通知
- 记录处理时间和性能指标

```js:src/main/store/index.mjs
// 处理文件服务子进程启动
handleFileServerStart() {
  try {
    // 启动子进程
    this.fileServer?.start({
      onMessage: ({ data }) => {
        switch (data.event) {
          case 'REFRESH_DIRECTORY::SUCCESS':
            // 添加接收时间戳
            data.receiveMsgTime = Date.now()
            this.onRefreshDirectorySuccess(data)
            break
          case 'REFRESH_DIRECTORY::FAIL':
            // 添加接收时间戳
            data.receiveMsgTime = Date.now()
            this.onRefreshDirectoryFail(data)
            break
          case 'SERVER_LOG': {
            const type = data.level
            if (type && typeof global.logger[type] === 'function') {
              global.logger[type](data.message)
            } else {
              global.logger.info(`[FileServer] INFO => ${data.message}`)
            }
            break
          }
          case 'HANDLE_IMAGE_QUALITY::SUCCESS':
            this.fileManager.onHandleImageQualitySuccess(data, this.locks)
            break
          case 'HANDLE_IMAGE_QUALITY::FAIL':
            this.fileManager.onHandleImageQualityFail(this.locks)
            break
        }
      }
    })
  } catch (err) {
    global.logger.error(err)
  }
}

// 文件服务子进程-遍历目录完成
onRefreshDirectorySuccess(data) {
  // 获取开始时间和接收时间，使用当前时间作为默认值而不是0
  const startTime = data.refreshDirStartTime || Date.now()
  const receiveTime = data.receiveMsgTime || Date.now()
  const processTime = receiveTime - startTime

  global.logger.info(
    `[FileServer] SUCCESS => 刷新资源目录完成: ${data.resourceName}, 文件数量: ${data.list.length}, 处理时间: ${processTime}ms`
  )

  // 更新资源映射
  this.resourcesManager.updateResourceMap(data.resourceName, data.list)

  // 发送消息到主窗口
  if (global.FBW.mainWindow.win) {
    global.FBW.sendCommonData(global.FBW.mainWindow.win)
    global.FBW.sendMsg(global.FBW.mainWindow.win, {
      type: 'success',
      message: t('messages.refreshDirectorySuccess', {
        resourceName: data.resourceName,
        count: data.list.length
      })
    })
  }
}
```

### 3. 通信特点

#### 3.1 使用 Electron Utility Process

飞鸟壁纸使用 Electron 的 `utilityProcess` 来创建子进程，这是 Electron 推荐的安全方式。

**技术优势：**

- **安全性**：`utilityProcess` 提供了更好的安全隔离
- **性能**：比传统的 `child_process` 更高效
- **稳定性**：更好的错误处理和资源管理

**使用场景：**

- 需要执行耗时操作的场景
- 需要隔离运行的服务
- 需要高安全性的数据处理
- 需要独立资源管理的任务

#### 3.2 消息通道通信

使用 `MessageChannelMain` 进行进程间通信。

**功能说明：**
消息通道是主进程与子进程之间通信的核心机制。通过创建消息通道，主进程和子进程可以建立双向通信链路，实现高效的数据传输和事件传递。消息通道支持传递各种类型的数据，包括对象、数组、甚至可转移对象。

**通信特点：**

- **双向通信**：主进程和子进程都可以发送和接收消息
- **异步处理**：消息处理是异步的，不会阻塞进程执行
- **类型安全**：支持传递复杂的数据结构
- **可转移对象**：支持传递端口等可转移对象

```js
const { port1, port2 } = new MessageChannelMain()
this.#child = utilityProcess.fork(this.#serverPath, options)
this.#port2 = port2

this.#port2.on('message', onMessage)
this.#port2.start()
```

#### 3.3 事件驱动架构

子进程通过事件驱动的方式处理消息。

**功能说明：**
事件驱动架构是子进程处理消息的核心模式。通过监听消息事件，子进程可以根据消息类型执行相应的处理逻辑。这种架构具有良好的扩展性，可以轻松添加新的消息类型和处理逻辑，同时保持代码的清晰和可维护性。

**设计优势：**

- **解耦合**：消息发送和处理逻辑分离
- **可扩展**：易于添加新的消息类型
- **可维护**：代码结构清晰，易于理解和维护
- **异步处理**：支持异步操作，不会阻塞消息接收

```js
port.on('message', async (e) => {
  const { data } = e

  switch (data.event) {
    case 'SERVER_START':
      // 处理服务启动
      break
    case 'REFRESH_DIRECTORY':
      // 处理目录刷新
      break
    case 'HANDLE_IMAGE_QUALITY':
      // 处理图片质量计算
      break
  }
})
```

---

## 通信模式总结

### 1. 主进程 ↔ 渲染进程

- **通信方式**：IPC (Inter-Process Communication)
- **技术实现**：`contextBridge` + `ipcRenderer` + `ipcMain`
- **特点**：
  - 安全性高：通过预加载脚本控制 API 暴露
  - 性能好：异步通信，不阻塞 UI
  - 易用性强：提供统一的 API 接口

### 2. 主进程 ↔ 子进程

- **通信方式**：Electron Utility Process IPC
- **技术实现**：`utilityProcess.fork` + `MessageChannelMain`
- **特点**：
  - 安全性高：使用 Electron 推荐的 Utility Process
  - 隔离性好：子进程独立运行，崩溃不影响主进程
  - 性能优：比传统 child_process 更高效

### 3. 使用场景

#### 3.1 主进程 ↔ 渲染进程

- 用户界面交互
- 设置数据同步
- 文件操作
- 窗口控制

#### 3.2 主进程 ↔ 子进程

- **H5 服务**：提供本地 HTTP/HTTPS 服务，支持 Socket.IO 实时通信
- **文件服务**：处理大量文件扫描、图片质量计算等耗时操作
- **数据处理**：避免阻塞主进程的复杂计算任务

---

## 总结

飞鸟壁纸的进程通信架构通过不同的通信机制实现了主进程、渲染进程和子进程之间的高效协作：

1. **主进程与渲染进程**：通过预加载脚本实现安全的 IPC 通信，使用 `contextBridge` 和 `ipcRenderer`
2. **主进程与子进程**：通过 Electron Utility Process 实现服务隔离，使用 `utilityProcess.fork` 和 `MessageChannelMain`

这种设计确保了应用的安全性、稳定性和可扩展性，为不同场景下的进程间通信提供了合适的解决方案。特别是使用 Electron 推荐的 Utility Process 技术，提供了更好的安全性和性能。
