---
name: 'api-integration'
description: '指导开发者如何集成新的壁纸API到Flying Bird Wallpaper项目。当用户需要添加新的壁纸源或修改现有API时调用。'
---

# API 集成

## 功能说明

本技能指导开发者如何为飞鸟壁纸项目集成新的壁纸API，包括API插件的开发、配置和测试。

## 目录结构

API 插件文件位于 `resources/api/` 目录下，每个 API 插件是一个独立的文件：

```
resources/
└── api/
    ├── bing.mjs
    ├── birdpaper.mjs
    ├── nasa.mjs
    ├── openverse.mjs
    ├── pexels.mjs
    ├── pixabay.mjs
    ├── smms.mjs
    ├── unsplash.mjs
    └── wallhaven.mjs
```

## API 插件开发

### 1. 插件模板

项目提供了 API 插件模板，位于 `resources/plugin-templates/api-plugin-template.mjs`。你可以基于此模板创建新的 API 插件。

### 2. 插件结构

一个完整的 API 插件应包含以下结构：

```javascript
const { axios, ApiBase, calculateImageOrientation, calculateImageQuality } = global.FBW.apiHelpers
const RESOURCE_NAME = 'unique-api-id'

export default class ApiPlugin extends ApiBase {
  constructor() {
    super(RESOURCE_NAME)
  }

  // 插件信息
  info() {
    return {
      // 插件名称
      label: 'API 名称',
      // 插件唯一标识
      value: RESOURCE_NAME,
      // 插件版本
      version: '1.0.0',
      // 插件描述
      description: 'API 描述',
      // 插件作者
      author: '作者',
      // 插件i18n key
      locale: '',
      // 插件网站
      site: 'https://api.example.com',
      // 是否启用
      enabled: true,
      // 是否远程，插件都是远程的
      remote: true,
      // 是否需要密钥
      requireSecretKey: false,
      // 密钥
      secretKey: '',
      // 是否支持搜索
      supportSearch: true,
      // 支持的搜索类型
      supportSearchTypes: ['images', 'videos'], // 支持的资源类型：图片和视频
      // 搜索必要条件
      searchRequired: {
        keywords: true,
        orientation: false
      },
      // 是否支持下载
      supportDownload: true,
      // 下载必要条件
      downloadRequired: {
        keywords: true,
        orientation: false
      }
    }
  }

  // 搜索方法
  async search(query) {
    let ret = {
      startPage: query.startPage,
      pageSize: query.pageSize,
      list: [],
      total: 0
    }
    // 示例参数结构，实际使用时需根据具体 API 文档调整
    const params = {
      q: query.keywords, // 搜索关键词参数（示例）
      per_page: query.pageSize, // 每页数量参数（示例）
      page: query.startPage // 页码参数（示例）
    }

    // 处理资源类型 images || videos
    const filterType = query.filterType || 'images'
    const isImages = filterType === 'images'
    const isVideos = filterType === 'videos'

    // 根据资源类型构建API路径
    const apiPath = isVideos
      ? 'https://api.example.com/videos/search'
      : 'https://api.example.com/search/photos'

    try {
      const res = await axios.get(apiPath, {
        params,
        headers: { Authorization: `Bearer ${query.secretKey}` }
      })

      if (res.status === 200 && res.data) {
        const resData = res.data
        ret.total = resData.total || resData.total_results

        if (isImages && Array.isArray(resData.results)) {
          ret.list = resData.results.map((item) => {
            const imageUrl = item.urls.raw
            const quality = calculateImageQuality(item.width, item.height)
            const isLandscape = calculateImageOrientation(item.width, item.height)
            return {
              resourceName: this.resourceName,
              fileName: [this.resourceName, item.id].join('_'),
              fileExt: 'jpg',
              fileType: 'image',
              link: item.links.html,
              author: item.user.username,
              title: '',
              desc: item.description,
              imageUrl,
              quality,
              width: item.width,
              height: item.height,
              isLandscape
            }
          })
        } else if (isVideos && Array.isArray(resData.videos)) {
          ret.list = resData.videos.map((item) => {
            const imageUrl = item.image // 视频封面图
            const videoItem = item.video_files[0] // 选择第一个视频文件
            const fileExt = videoItem.file_type.split('/')[1]
            const quality = calculateImageQuality(videoItem.width, videoItem.height)
            const isLandscape = calculateImageOrientation(videoItem.width, videoItem.height)
            return {
              resourceName: this.resourceName,
              fileName: [this.resourceName, item.id].join('_'),
              fileExt,
              fileType: 'video',
              link: item.url,
              author: item.user.name,
              title: '',
              desc: '',
              imageUrl,
              videoUrl: videoItem.link, // 视频URL
              quality,
              width: videoItem.width,
              height: videoItem.height,
              isLandscape
            }
          })
        }
      }
    } catch (error) {
      console.error('API 搜索错误:', error)
    }

    return ret
  }

  // 获取热门标签
  async getHotTags(query) {
    const tags = []
    try {
      const res = await axios.get('https://api.example.com/topics', {
        params: { per_page: 20 },
        headers: { Authorization: `Bearer ${query.secretKey}` }
      })

      if (res.status === 200 && res.data && Array.isArray(res.data)) {
        tags.push(...res.data.map((topic) => topic.title))
      }
    } catch (error) {
      console.error('获取热门标签失败:', error)
    }
    return tags
  }
}
```

### 3. 继承 ApiBase 类

所有 API 插件都应该继承自 `src/main/ApiBase.js` 基类，以获得统一的方法和错误处理：

```javascript
const { axios, ApiBase, calculateImageOrientation, calculateImageQuality } = global.FBW.apiHelpers
const RESOURCE_NAME = 'unique-api-id'

export default class ApiPlugin extends ApiBase {
  constructor() {
    super(RESOURCE_NAME)
  }

  // 实现必要的方法
  info() {
    // 返回插件信息
  }

  async search(query) {
    // 实现搜索逻辑
  }

  async getHotTags(query) {
    // 实现获取热门标签逻辑
  }
}
```

## 核心方法

### 1. info 方法

`info` 方法返回插件的基本信息，包括插件名称、版本、描述等：

```javascript
info() {
  return {
    // 插件名称
    label: '插件名称',
    // 插件唯一标识
    value: '插件标识',
    // 插件版本
    version: '1.0.0',
    // 插件描述
    description: '插件描述',
    // 插件作者
    author: '作者',
    // 插件i18n key
    locale: '',
    // 插件网站
    site: 'https://example.com',
    // 是否启用
    enabled: true,
    // 是否远程，插件都是远程的
    remote: true,
    // 是否需要密钥
    requireSecretKey: false,
    // 密钥
    secretKey: '',
    // 是否支持搜索
    supportSearch: true,
    // 支持的搜索类型
    supportSearchTypes: ['images', 'videos'], // 支持的资源类型：图片和视频
    // 搜索必要条件
    searchRequired: {
      keywords: true,
      orientation: false
    },
    // 是否支持下载
    supportDownload: true,
    // 下载必要条件
    downloadRequired: {
      keywords: true,
      orientation: false
    }
  }
}
```

### 2. search 方法

`search` 方法用于搜索壁纸，接收以下参数：

- `query.keywords`：搜索关键词
- `query.startPage`：起始页码
- `query.pageSize`：每页数量
- `query.orientation`：图片方向（可选）
- `query.secretKey`：API密钥（如果需要）
- `query.filterType`：资源类型，可选值：'images'、'videos'（默认：'images'）

返回格式：

```javascript
{
  startPage: Number, // 起始页码
  pageSize: Number, // 每页数量
  list: [ // 壁纸列表
    {
      resourceName: String, // 资源名称
      fileName: String, // 文件名
      fileExt: String, // 文件扩展名
      fileType: String, // 文件类型：'image' 或 'video'
      link: String, // 原始链接
      author: String, // 作者
      title: String, // 标题
      desc: String, // 描述
      imageUrl: String, // 图片URL（视频资源时为封面图）
      videoUrl: String, // 视频URL（仅视频资源）
      quality: Number, // 资源质量
      width: Number, // 宽度
      height: Number, // 高度
      isLandscape: Boolean // 是否横屏
    }
  ],
  total: Number // 总数量
}
```

### 3. getHotTags 方法

`getHotTags` 方法用于获取热门标签，接收以下参数：

- `query.secretKey`：API密钥（如果需要）

返回格式：

```javascript
// 返回标签数组
;['tag1', 'tag2', 'tag3']
```

## API 密钥管理

如果 API 需要密钥，你可以在插件的info方法中设置requireSecretKey为true：

```javascript
export default class ApiPlugin extends ApiBase {
  constructor() {
    super('api-id')
  }

  info() {
    return {
      // 其他信息
      requireSecretKey: true // 标记需要 API 密钥
      // 其他信息
    }
  }

  // 使用 API 密钥
  async search(query) {
    const headers = {
      Authorization: `Bearer ${query.secretKey}`
    }
    // 发送请求
  }
}
```

## 错误处理

在 API 调用过程中，应该实现完善的错误处理：

```javascript
async search(query) {
  try {
    const response = await this.axios.get(`${this.baseUrl}/search`, {
      params: {
        q: query.keywords,
        page: query.startPage,
        per_page: query.pageSize
      },
      headers: {
        Authorization: `Bearer ${query.secretKey}`
      }
    });

    // 处理响应数据
    return {
      startPage: query.startPage,
      pageSize: query.pageSize,
      list: response.data.results.map(item => ({
        resourceName: this.resourceName,
        fileName: [this.resourceName, item.id].join('_'),
        fileExt: 'jpg',
        fileType: 'image',
        link: item.links.html,
        author: item.user.username,
        title: '',
        desc: item.description,
        imageUrl: item.urls.raw,
        quality: 100,
        width: item.width,
        height: item.height,
        isLandscape: item.width > item.height
      })),
      total: response.data.total
    };
  } catch (error) {
    console.error(`API 搜索错误: ${error.message}`);
    return {
      startPage: query.startPage,
      pageSize: query.pageSize,
      list: [],
      total: 0
    };
  }
}
```

## 数据转换

不同 API 返回的数据格式可能不同，需要在 search 方法中直接实现数据转换。以下是处理不同平台、不同 API 数据结构差异的指南：

### 1. 处理请求参数差异

不同 API 可能对参数名称有不同的要求：

```javascript
async search(query) {
  let ret = {
    startPage: query.startPage,
    pageSize: query.pageSize,
    list: [],
    total: 0
  }

  // 根据不同 API 构建不同的参数结构
  const params = {
    // 示例：Unsplash API 参数
    // query: query.keywords,

    // 示例：Pexels API 参数
    // query: query.keywords,

    // 示例：其他 API 可能使用不同的参数名
    // search: query.keywords,
    // keyword: query.keywords,

    // 示例参数结构，实际使用时需根据具体 API 文档调整
    q: query.keywords, // 搜索关键词参数（示例）
    per_page: query.pageSize, // 每页数量参数（示例）
    page: query.startPage // 页码参数（示例）
  }

  // 处理图片方向参数
  if (query.orientation && Array.isArray(query.orientation) && query.orientation.length === 1) {
    // 不同 API 可能有不同的方向值格式
    params.orientation = query.orientation[0] === '1' ? 'landscape' : 'portrait'
  }

  // 其他特定 API 的参数处理
  // ...
}
```

### 2. 处理返回数据结构差异

不同 API 返回的数据结构可能不同，需要根据实际情况进行适配。以下是一个通用的处理模式：

```javascript
async search(query) {
  // 其他代码

  try {
    const res = await axios.get(apiPath, {
      params,
      headers: { Authorization: `Bearer ${query.secretKey}` }
    })

    if (res.status === 200 && res.data) {
      const resData = res.data

      // 处理不同 API 的总数量字段
      ret.total = resData.total || resData.total_results || 0

      // 处理图片资源
      if (isImages) {
        // 不同 API 可能有不同的图片列表字段
        const items = resData.results || resData.photos || resData.images || []
        if (Array.isArray(items)) {
          ret.list = items.map((item) => {
            // 处理不同 API 的数据结构差异
            const imageUrl = item.urls?.raw || item.src?.original || item.image || ''
            const author = item.user?.username || item.photographer || item.author || ''
            const link = item.links?.html || item.url || item.link || ''
            const desc = item.description || item.alt || item.title || ''

            const quality = calculateImageQuality(item.width, item.height)
            const isLandscape = calculateImageOrientation(item.width, item.height)

            return {
              resourceName: this.resourceName,
              fileName: [this.resourceName, item.id].join('_'),
              fileExt: 'jpg',
              fileType: 'image',
              link,
              author,
              title: '',
              desc,
              imageUrl,
              quality,
              width: item.width,
              height: item.height,
              isLandscape
            }
          })
        }
      }

      // 处理视频资源
      else if (isVideos) {
        // 不同 API 可能有不同的视频列表字段
        const items = resData.videos || resData.video || []
        if (Array.isArray(items)) {
          ret.list = items.map((item) => {
            // 处理不同 API 的数据结构差异
            const imageUrl = item.image || item.thumbnail || ''
            const videoItem = item.video_files?.[0] || item.files?.[0] || item.video || {}
            const fileExt = videoItem.file_type?.split('/')[1] || videoItem.extension || 'mp4'
            const videoUrl = videoItem.link || videoItem.url || item.url || ''
            const author = item.user?.name || item.photographer || item.author || ''
            const link = item.url || item.link || ''

            const quality = calculateImageQuality(videoItem.width || 0, videoItem.height || 0)
            const isLandscape = calculateImageOrientation(videoItem.width || 0, videoItem.height || 0)

            return {
              resourceName: this.resourceName,
              fileName: [this.resourceName, item.id].join('_'),
              fileExt,
              fileType: 'video',
              link,
              author,
              title: '',
              desc: '',
              imageUrl,
              videoUrl,
              quality,
              width: videoItem.width || 0,
              height: videoItem.height || 0,
              isLandscape
            }
          })
        }
      }
    }
  } catch (error) {
    console.error('API 搜索错误:', error)
  }

  return ret
}
```

**说明**：

- 使用可选链操作符 (`?.`) 安全访问嵌套属性
- 使用逻辑或 (`||`) 提供默认值，处理字段不存在的情况
- 根据具体 API 的返回结构，调整字段映射关系
- 无论 API 返回什么格式，最终都转换为标准的返回格式

### 3. 处理不同 API 的错误响应

不同 API 可能有不同的错误响应格式，需要统一处理：

```javascript
async search(query) {
  try {
    const res = await axios.get(apiPath, {
      params,
      headers: { Authorization: `Bearer ${query.secretKey}` }
    })

    // 处理响应
    // ...
  } catch (error) {
    console.error('API 搜索错误:', error)

    // 处理不同 API 的错误格式
    if (error.response) {
      // 服务器返回错误状态码
      console.error('API 错误状态:', error.response.status)
      console.error('API 错误数据:', error.response.data)
    } else if (error.request) {
      // 请求已发送但没有收到响应
      console.error('API 请求失败:', error.request)
    } else {
      // 请求配置出错
      console.error('API 请求配置错误:', error.message)
    }

    // 返回空结果
    return {
      startPage: query.startPage,
      pageSize: query.pageSize,
      list: [],
      total: 0
    }
  }
}
```

## 测试与调试

### 1. 本地测试

在开发 API 插件时，可以通过以下步骤进行测试：

1. 将插件文件放在 `resources/api/` 目录下
2. 启动应用开发模式：`npm run dev`
3. 在应用中测试 API 功能

### 2. 调试技巧

- 利用应用的日志系统：`global.logger.info('调试信息')`

## 发布与分享

### 1. 打包插件

开发完成后，可以将插件文件打包分享给其他用户：

1. 确保插件文件符合项目规范
2. 提供插件的使用说明和 API 密钥获取方法
3. 可以通过 GitHub Issues 或其他渠道分享插件

### 2. 提交到项目

如果你的插件质量良好，可以考虑提交到项目：

1. Fork 项目仓库
2. 添加你的 API 插件
3. 提交 Pull Request
4. 等待项目维护者审核

## 最佳实践

1. **遵循 API 速率限制**：了解并遵守 API 提供商的速率限制
2. **实现错误重试**：在网络错误时实现自动重试机制
3. **优化性能**：使用缓存减少 API 调用
4. **提供清晰的错误信息**：向用户提供友好的错误提示
5. **保持代码简洁**：遵循项目的代码规范
6. **添加文档**：为插件添加详细的注释和文档
7. **使用可选链操作符**：`item?.user?.username` 可以安全处理嵌套属性不存在的情况
8. **提供默认值**：`item.width || 0` 可以处理字段不存在的情况
9. **统一数据结构**：无论 API 返回什么格式，最终都转换为标准格式
10. **错误处理**：捕获并处理所有可能的错误情况
11. **日志记录**：记录关键操作和错误信息，便于调试
