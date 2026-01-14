# 子进程

---

## H5 Server

H5 Server 负责启动本地 HTTP/HTTPS Web 服务，运行 H5 前端页面、图片本地访问接口、Socket 实时通信等，支持多端数据交互和本地资源访问。

### 1. HTTP/HTTPS 服务

- 自动检测本地证书（private.key/certificate.crt），优先启用 HTTPS，未检测到则自动生成自签名证书。
- 支持 HTTP2（https）和 HTTP1。
- 端口可配置，默认 8888，自动查找可用端口。
- 支持主进程通过参数控制服务启停、端口、host、是否启用 HTTPS。
- 端口被占用时自动递增查找。

**关键代码片段：**

```js:src/main/child_server/h5_server/server.mjs
if (useHttps && sslOptions) {
  httpServer = http2.createSecureServer({
    ...sslOptions,
    allowHTTP1: true // 允许HTTP/1.1连接，支持WebSocket
  })
  logger.info('[H5Server] INFO => 已创建支持HTTP/1.1和HTTP/2的HTTPS服务器')
} else {
  httpServer = http2.createServer({ allowHTTP1: true })
}

// 将 Koa 应用挂载到 HTTP/2 服务器
httpServer.on('request', app.callback())

httpServer.listen(port, host, () => {
  const protocol = useHttps ? 'https' : 'http'
  const serverUrl = `${protocol}://${host}:${port}`
  typeof onStartSuccess === 'function' && onStartSuccess(serverUrl)
})
```

---

### 2. 前端静态资源服务

- 静态资源目录为 `process.env.FBW_RESOURCES_PATH + '/h5'`（生产）或 `../h5`（开发）。
- 使用 `koa-static` 提供静态资源服务，支持 gzip、brotli 压缩，缓存一天。
- 所有静态资源响应头自动加 `Access-Control-Allow-Origin: *` 和 `Cache-Control`。

**关键代码片段：**

```js:src/main/child_server/h5_server/server.mjs
app.use(
  staticServe(staticPath, {
    maxage: 86400000,
    gzip: true,
    br: true,
    setHeaders: (res) => {
      res.setHeader('Access-Control-Allow-Origin', '*')
      res.setHeader('Cache-Control', 'public, max-age=86400')
    }
  })
)
```

---

### 3. 接口路由（API）

- 只注册 `/api/images/get` 路由，GET 方法，参数为 filePath、w、h、compressStartSize。
- 由 `handleImageResponse` 处理图片本地读取、缩放、压缩、缓存等。
- 通过 `useApi(router)` 注册所有 API 路由。

**关键代码片段：**

```js:src/main/child_server/h5_server/api/index.mjs
// api/index.mjs
router.get('/api/images/get', getImage)

// api/images.mjs
export const getImage = async (ctx) => {
  const { filePath, w, h, compressStartSize } = ctx.request.query
  const res = await handleImageResponse({ filePath, w, h, compressStartSize })
  ctx.set(res.headers)
  ctx.status = res.status
  ctx.body = res.data
}
```

---

### 4. Socket 实时通信

- 使用 Socket.IO，支持 websocket 和 polling。
- 事件包括：getSettingData、h5UpdateSettingData、getResourceMap、searchImages、toggleFavorite、addToFavorites、removeFavorites、deleteImage、updateFavoriteCount、updateDownloadCount 等。
- 所有事件均为“请求-回调”模式，参数和返回值结构与主进程/数据库一致。
- 断开连接时记录日志。
- 配置了性能优化参数：pingTimeout、pingInterval、upgradeTimeout、maxHttpBufferSize 等。

**关键代码片段：**

```js:src/main/child_server/h5_server/server.mjs
// 创建 Socket.IO 实例
ioServer = new Server(httpServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  },
  // 添加性能优化配置
  transports: ['websocket', 'polling'], // 优先使用websocket
  pingTimeout: 30000,
  pingInterval: 25000,
  upgradeTimeout: 10000,
  maxHttpBufferSize: 1e6 // 1MB
})
```

```js:src/main/child_server/h5_server/socket/index.mjs
// Socket.IO 事件处理
ioServer.on('connection', (socket) => {
  socket.on('getSettingData', async (params, callback) => { ... })
  socket.on('h5UpdateSettingData', async (data, callback) => { ... })
  socket.on('searchImages', async (params, callback) => { ... })
  // ... 其他事件
  socket.on('disconnect', () => {
    logger.info(`[H5Server] INFO => 客户端断开连接: ${socket.id}`)
  })
})
```

---

### 5. 数据管理

- 通过主进程传入的 dbManager、settingManager、resourcesManager、fileManager 实例进行数据操作。
- 所有数据操作（如设置、资源、文件、收藏等）都通过这些 manager 实例完成。
- 通过 postMessage 向主进程同步设置变更等事件。

**关键代码片段：**

```js:src/main/child_server/h5_server/socket/index.mjs
// 以设置为例
socket.on('h5UpdateSettingData', async (data, callback) => {
  const res = await settingManager.updateSettingData(data)
  if (res.success && res.data) {
    postMessage({ event: 'H5_SETTING_UPDATED', data: res.data })
    ioServer.emit('settingUpdated', res)
  }
  // ...
})
```

---

## File Server

File Server 负责文件扫描、目录递归、批量处理和图片质量计算，通过独立子进程隔离文件操作，提升大目录/大文件量场景下的性能。

### 1. 子进程架构

- 使用 `utilityProcess.fork()` 启动独立子进程，通过 `MessageChannelMain` 进行通信。
- 支持服务启动、停止、重启等生命周期管理。
- 通过 `process.parentPort.on('message')` 监听主进程消息。

**关键代码片段：**

```js:src/main/child_server/ChildServer.mjs
// ChildServer.mjs
const { port1, port2 } = new MessageChannelMain()
this.#child = utilityProcess.fork(this.#serverPath, options)
this.#child.postMessage({ serverName: this.#serverName, event: 'SERVER_FORKED' }, [port1])

// file_server/index.mjs
process.parentPort.on('message', (e) => {
  const [port] = e.ports
  port.on('message', async (e) => {
    const { data } = e
    // 处理各种事件
  })
})
```

---

### 2. 目录刷新功能

- 支持多目录并行处理，使用 `Promise.all()` 同时扫描多个文件夹。
- 使用 `fast-glob` 快速获取匹配文件，支持 `**/*.ext` 模式匹配。
- 实现增量更新：只处理新增或修改的文件，避免重复扫描。
- 支持批量处理：超过 5000 个文件时自动分批处理，每批 1000 个。

**关键代码片段：**

```js:src/main/child_server/file_server/index.mjs
// 并行处理多个目录
const dirPromises = data.folderPaths.map((folderPath) =>
  readDirRecursive(data.resourceName, folderPath, data.allowedFileExt, existingFiles)
)
const results = await Promise.all(dirPromises)

// 分批处理大量文件
const processBatch = async (files, batchSize = 1000) => {
  const results = []
  for (let i = 0; i < files.length; i += batchSize) {
    const batch = files.slice(i, i + batchSize)
    results.push(...batch)
    await new Promise((resolve) => setTimeout(resolve, 0))
  }
  return results
}
```

---

### 3. 文件系统缓存

- 实现基于内存的文件系统缓存，缓存有效期 1 分钟。
- 缓存键为 `dirPath_allowedFileExt.join('_')`，支持不同目录和文件类型的独立缓存。
- 增量更新时只处理缓存中不存在或已修改的文件。

**关键代码片段：**

```js:src/main/child_server/file_server/index.mjs
const fsCache = {
  directories: {},
  lastUpdate: Date.now(),
  ttl: 60000 // 1分钟
}

const cacheKey = `${dirPath}_${allowedFileExt.join('_')}`
if (fsCache.directories[cacheKey] && Date.now() - fsCache.lastUpdate < fsCache.ttl) {
  // 使用缓存数据
  return cachedFiles
}
```

---

### 4. 文件元数据处理

- 批量获取文件状态信息（大小、修改时间、访问时间等）。
- 自动识别文件类型：图片（image）或视频（video）。
- 支持的文件扩展名通过 `allowedImageExtList` 和 `allowedVideoExtList` 配置。

**关键代码片段：**

```js:src/main/child_server/file_server/index.mjs
const patterns = allowedFileExt.map((ext) => `**/*${ext}`)
const entries = await fg(patterns, {
  cwd: dirPath,
  absolute: true,
  onlyFiles: true,
  stats: false,
  followSymbolicLinks: false
})

// 批量获取文件状态
const fileStats = await Promise.all(
  entries.map(async (filePath) => {
    const stats = await fs.promises.stat(filePath)
    return {
      filePath,
      stats,
      fileName: path.basename(filePath),
      fileExt: path.extname(filePath).toLowerCase()
    }
  })
)
```

---

### 5. 图片质量计算

- 支持批量计算图片质量、尺寸、横竖屏、主色调等信息。
- 使用 `sharp` 库进行图片元数据提取和主色调计算。
- 质量等级：8K、5K、4K、2K（基于分辨率判断）。

**关键代码片段：**

```js:src/main/utils/utils.mjs
export const calculateImageByPath = async (filePath) => {
  const { width, height } = await sharp(filePath).metadata()
  const quality = calculateImageQuality(width, height)
  const isLandscape = calculateImageOrientation(width, height)
  const dominantColor = await extractDominantColor(filePath)
  return { quality, isLandscape, width, height, dominantColor }
}
```

---

### 6. 事件通信机制

- 支持的事件：`SERVER_START`、`REFRESH_DIRECTORY`、`HANDLE_IMAGE_QUALITY`。
- 每个事件都有对应的成功/失败响应：`SUCCESS`、`FAIL`、`PROCESSING`。
- 支持统计信息：新增文件数、修改文件数、总处理数、处理时间等。

**关键代码片段：**

```js:src/main/child_server/file_server/index.mjs
if (data.event === 'REFRESH_DIRECTORY') {
  // 处理目录刷新
  port.postMessage({
    event: 'REFRESH_DIRECTORY::SUCCESS',
    isManual: data.isManual,
    resourceName: data.resourceName,
    list: [...fileMap.values()],
    stats: { newFiles: fileMap.size, modifiedFiles: 0, totalProcessed: fileMap.size },
    refreshDirStartTime: data.refreshDirStartTime,
    readDirTime
  })
} else if (data.event === 'HANDLE_IMAGE_QUALITY') {
  // 处理图片质量计算
  port.postMessage({
    event: 'HANDLE_IMAGE_QUALITY::SUCCESS',
    resourceName: data.resourceName,
    list: ret
  })
}
```

---

### 7. 日志管理

- 通过 `MessageChannelMain` 将子进程日志发送到主进程。
- 支持 `info`、`warn`、`error` 三个日志级别。
- 日志格式：`[FileServer] LEVEL => message`。

**关键代码片段：**

```js:src/main/child_server/file_server/index.mjs
const handleLogger = (type = 'info') => {
  return (data) => {
    const postData = {
      event: 'SERVER_LOG',
      level: type,
      message: typeof data === 'string' ? data : JSON.stringify(data)
    }
    port.postMessage(postData)
  }
}
```

---

### 8. 性能优化

- 使用 `fast-glob` 替代原生 `fs.readdir`，提升大目录扫描性能。
- 批量处理文件状态，减少系统调用次数。
- 增量更新机制，避免重复处理未变更文件。
- 分批处理大量文件，防止阻塞事件循环。
- 并行处理多个目录，充分利用多核性能。
