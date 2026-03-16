# MJS格式插件管理实施方案

## 1. 方案概述

针对现有插件都是.mjs格式的情况，设计一个直接处理.mjs文件的插件管理方案。通过GitHub API直接下载和管理.mjs格式的插件文件，保持与现有插件结构的完全兼容，同时实现集中式管理和用户友好的安装流程。

## 2. 架构设计

### 2.1 系统架构

```
┌─────────────────────┐
│   应用内插件管理界面  │
└──────────┬──────────┘
           │
┌──────────▼──────────┐     ┌─────────────────────┐     ┌─────────────────────┐
│  插件管理服务       │◄────┤  GitHub API         │◄────┤  集中式插件仓库     │
└──────────┬──────────┘     └─────────────────────┘     └─────────────────────┘
           │                       ▲
           │                       │
┌──────────▼──────────┐     ┌─────────────────────┐
│  插件加载器         │────►│  插件存储目录       │
└──────────┬──────────┘     └─────────────────────┘
           │
┌──────────▼──────────┐
│  API插件运行时      │
└─────────────────────┘
```

### 2.2 集中式仓库目录结构

```
Flying-Bird-Wallpaper-Plugins/
├── README.md           # 项目说明
├── package.json        # 项目配置和依赖
├── plugins.json        # 插件列表文件（用于CDN获取）
└── plugins/            # API插件目录
    ├── unsplash/       # Unsplash API插件
    │   ├── manifest.json  # 插件配置文件
    │   └── main.mjs        # 插件主代码
    ├── pexels/         # Pexels API插件
    │   ├── manifest.json
    │   └── main.mjs
    └── ...             # 其他API插件
```

### 2.3 应用目录结构

```
resources/
├── api/           # 内置API插件
```

## 3. 插件格式设计

### 3.1 插件目录结构

每个API插件是一个独立的目录，包含以下文件：

```
plugin/
├── manifest.json   # 插件配置文件
└── main.mjs        # 插件主代码
```

### 3.2 ApiBase基类实现

ApiBase类负责提供公共的manifest加载方法，所有API插件都继承自这个基类：

```javascript
// src/main/api/ApiBase.js
const fs = require('fs')
const path = require('path')

export default class ApiBase {
  constructor(resourceName) {
    this.resourceName = resourceName
    // 加载manifest.json文件
    this._loadManifest()
  }

  // 加载manifest.json文件
  _loadManifest() {
    try {
      // 获取插件目录路径
      let pluginDir
      if (typeof __filename !== 'undefined') {
        // CommonJS模块
        pluginDir = path.dirname(__filename)
      } else {
        // ES模块
        const { fileURLToPath } = require('url')
        pluginDir = path.dirname(fileURLToPath(import.meta.url))
      }
      const manifestPath = path.join(pluginDir, 'manifest.json')

      if (fs.existsSync(manifestPath)) {
        const manifest = fs.readFileSync(manifestPath, 'utf8')
        const config = JSON.parse(manifest)

        this.info = {
          // 插件名称
          label: config.displayName || this.resourceName,
          // 插件唯一标识
          value: this.resourceName,
          // 插件版本
          version: config.version,
          // 插件描述
          description: config.description,
          // 插件作者
          author: config.author,
          // 插件i18n key
          locale: config.locale || '',
          // 插件网站
          site: config.site || config.homepage || '',
          // 是否启用
          enabled: config.enabled !== undefined ? config.enabled : true,
          // 是否远程，插件都是远程的
          remote: config.remote !== undefined ? config.remote : true,
          // 是否需要密钥
          requireSecretKey: config.requireSecretKey || false,
          // 密钥
          secretKey: '',
          // 是否支持搜索
          supportSearch: config.supportSearch || false,
          // 支持的搜索类型
          supportSearchTypes: config.supportSearchTypes || ['images'],
          // 搜索必要条件
          searchRequired: config.searchRequired || {
            keywords: true,
            orientation: false
          },
          // 是否支持下载
          supportDownload: config.supportDownload !== undefined ? config.supportDownload : true,
          // 下载必要条件
          downloadRequired: config.downloadRequired || {
            keywords: true,
            orientation: false
          },
          // 应用版本支持
          appVersion: config.appVersion || {
            min: '1.0.0',
            max: '*'
          }
        }
      } else {
        // 如果manifest.json不存在，使用默认值
        this._setDefaultInfo()
      }
    } catch (error) {
      this.logger?.error('加载manifest.json失败:', error)
      //  fallback到默认值
      this._setDefaultInfo()
    }
  }

  // 设置默认info属性
  _setDefaultInfo() {
    this.info = {
      label: this.resourceName,
      value: this.resourceName,
      version: '1.0.0',
      description: '',
      author: 'OXOYO',
      locale: '',
      site: '',
      enabled: true,
      remote: true,
      requireSecretKey: false,
      secretKey: '',
      supportSearch: false,
      supportSearchTypes: ['images'],
      searchRequired: {
        keywords: true,
        orientation: false
      },
      supportDownload: true,
      downloadRequired: {
        keywords: true,
        orientation: false
      },
      // 应用版本支持
      appVersion: {
        min: '1.0.0',
        max: '*'
      }
    }
  }

  // 搜索方法（子类必须实现）
  async search(query) {
    throw new Error('子类必须实现search方法')
  }

  // 获取热门标签方法（子类必须实现）
  async getHotTags(query) {
    throw new Error('子类必须实现getHotTags方法')
  }
}
```

### 3.2 插件配置文件 (manifest.json)

### 3.2.1 插件列表文件 (plugins.json)

为了支持通过CDN获取插件列表，需要在仓库根目录创建一个`plugins.json`文件，包含仓库信息和插件名称列表：

```json
{
  "name": "OXOYO/Flying-Bird-Wallpaper-Plugins",
  "repo": "https://github.com/OXOYO/Flying-Bird-Wallpaper-Plugins",
  "plugins": ["unsplash", "pexels", "pixabay"]
}
```

每个插件都有一个独立的`manifest.json`文件，包含插件的详细信息和配置。

```json
{
  "name": "unsplash",
  "displayName": "Unsplash",
  "version": "1.0.0",
  "description": "高质量免费图片API",
  "author": "OXOYO",
  "site": "https://unsplash.com/",
  "locale": "",
  "enabled": true,
  "remote": true,
  "requireSecretKey": true,
  "supportSearch": true,
  "supportSearchTypes": ["images"],
  "supportDownload": true,
  "searchRequired": {
    "keywords": true,
    "orientation": false
  },
  "downloadRequired": {
    "keywords": true,
    "orientation": false
  },
  "appVersion": {
    "min": "1.0.0",
    "max": "2.0.0"
  }
}
```

### 3.3 插件主文件 (main.mjs)

```javascript
const { axios, ApiBase, calculateImageOrientation, calculateImageQuality } = global.FBW.apiHelpers
const RESOURCE_NAME = 'unsplash'

export default class ResourceUnsplash extends ApiBase {
  constructor() {
    super(RESOURCE_NAME)
    // 加载manifest.json文件（ApiBase中已实现）
  }

  // info属性由ApiBase提供，基于manifest.json文件
  // 可以通过覆盖get info()方法来自定义info属性

  // 搜索方法
  async search(query) {
    // 实现搜索逻辑
  }

  // 获取热门标签
  async getHotTags(query) {
    // 实现获取热门标签逻辑
  }
}
```

## 4. 插件管理系统

### 4.1 核心功能

1. **插件发现**：从集中式仓库获取可用插件列表
2. **插件安装**：下载单个.mjs文件到插件目录
3. **插件卸载**：删除插件文件
4. **插件更新**：检查和更新插件到最新版本
5. **插件配置**：管理插件的设置和API密钥
6. **插件启用/禁用**：控制插件的运行状态

### 4.2 实现方案

#### 4.2.1 插件管理服务

创建 `src/main/services/PluginManager.js`：

```javascript
const fs = require('fs')
const path = require('path')
const https = require('https')

class PluginManager {
  constructor(logger, dbManager, settingManager) {
    this.pluginDir = path.join(app.getPath('userData'), 'plugins')
    this.apiPluginsDir = path.join(this.pluginDir, 'api')
    this.ensureDirectories()
    // 保存服务引用
    this.logger = logger
    this.dbManager = dbManager
    this.settingManager = settingManager

    // 从settingData中获取插件源配置
    this.loadPluginSources()
    // 获取应用版本
    this.appVersion = app.getVersion() || '1.0.0'
    // CDN配置
    this.cdnProviders = [
      {
        name: 'jsdelivr',
        baseUrl: 'https://cdn.jsdelivr.net/gh',
        enabled: true
      },
      {
        name: 'github',
        baseUrl: 'https://raw.githubusercontent.com',
        enabled: true
      }
    ]
    this.currentCdnIndex = 0
  }

  // 加载插件源配置
  loadPluginSources() {
    // 从settingData中获取官方插件源和用户自定义插件源
    const settingData = this.settingManager?.getAll() || {}

    // 官方插件源
    const officialSource = settingData.officialPluginSource || {
      id: 'official',
      name: 'OXOYO/Flying-Bird-Wallpaper-Plugins',
      repo: 'https://github.com/OXOYO/Flying-Bird-Wallpaper-Plugins',
      isOfficial: true,
      enabled: true
    }

    // 确保官方源的isOfficial为true
    officialSource.isOfficial = true

    // 用户自定义插件源
    const customSources = settingData.customPluginSources || []

    // 确保自定义源的isOfficial为false
    const processedCustomSources = customSources.map((source) => ({
      ...source,
      isOfficial: false
    }))

    // 合并官方源和自定义源
    this.pluginSources = [officialSource, ...processedCustomSources]
  }

  // 版本比较函数
  compareVersions(version1, version2) {
    const v1 = version1.split('.').map(Number)
    const v2 = version2.split('.').map(Number)

    for (let i = 0; i < Math.max(v1.length, v2.length); i++) {
      const num1 = v1[i] || 0
      const num2 = v2[i] || 0

      if (num1 > num2) return 1
      if (num1 < num2) return -1
    }

    return 0
  }

  // 验证插件是否支持当前应用版本
  isVersionCompatible(pluginVersionRange) {
    const { min, max } = pluginVersionRange

    // 检查最小版本
    if (min && min !== '*') {
      if (this.compareVersions(this.appVersion, min) < 0) {
        return false
      }
    }

    // 检查最大版本
    if (max && max !== '*') {
      if (this.compareVersions(this.appVersion, max) > 0) {
        return false
      }
    }

    return true
  }

  // 获取当前CDN配置
  getCurrentCdn() {
    return this.cdnProviders[this.currentCdnIndex]
  }

  // 切换到下一个CDN
  switchToNextCdn() {
    this.currentCdnIndex = (this.currentCdnIndex + 1) % this.cdnProviders.length
    console.log(`切换到CDN: ${this.getCurrentCdn().name}`)
  }

  // 确保插件目录存在
  ensureDirectories() {
    if (!fs.existsSync(this.pluginDir)) {
      fs.mkdirSync(this.pluginDir, { recursive: true })
    }
    if (!fs.existsSync(this.apiPluginsDir)) {
      fs.mkdirSync(this.apiPluginsDir, { recursive: true })
    }
  }

  // 获取可用插件列表
  async getAvailablePlugins() {
    try {
      // 尝试从CDN获取插件列表
      try {
        const pluginsList = await this.getPluginsListFromCdn()
        if (pluginsList && pluginsList.length > 0) {
          return pluginsList
        }
      } catch (cdnError) {
        this.logger?.error('CDN 获取插件列表失败，尝试使用GitHub API:', cdnError)
      }

      // 尝试从GitHub API获取插件列表
      try {
        const treeUrl = `https://api.github.com/repos/${this.centralRepo}/git/trees/main?recursive=1`
        const response = await this.fetchUrl(treeUrl)

        // 提取插件目录
        const plugins = []
        const pluginDirs = new Set()

        response.tree.forEach((item) => {
          if (item.path.startsWith('plugins/') && item.type === 'tree') {
            const pluginName = item.path.split('/')[1]
            if (pluginName && !pluginDirs.has(pluginName)) {
              pluginDirs.add(pluginName)
            }
          }
        })

        // 获取每个插件的manifest.json
        for (const pluginName of pluginDirs) {
          try {
            const manifest = await this.getPluginManifest(pluginName)
            // 验证版本兼容性
            const compatible = this.isVersionCompatible(
              manifest.appVersion || { min: '1.0.0', max: '*' }
            )
            plugins.push({
              name: manifest.name,
              version: manifest.version,
              displayName: manifest.displayName,
              description: manifest.description,
              author: manifest.author,
              site: manifest.site,
              compatible: compatible,
              appVersion: manifest.appVersion || { min: '1.0.0', max: '*' }
            })
          } catch (error) {
            this.logger?.error(`获取插件 ${pluginName} 信息失败:`, error)
          }
        }

        return plugins
      } catch (apiError) {
        this.logger?.error('GitHub API 失败，使用缓存的插件列表:', apiError)
      }

      // 返回缓存的插件列表
      return this.getCachedPluginsList()
    } catch (error) {
      this.logger?.error('获取可用插件列表失败:', error)
      // 返回缓存的插件列表
      return this.getCachedPluginsList()
    }
  }

  // 从CDN获取插件列表
  async getPluginsListFromCdn() {
    const allPlugins = []

    // 遍历所有启用的插件源
    for (const source of this.pluginSources.filter((s) => s.enabled)) {
      let retries = 0
      const maxRetries = this.cdnProviders.length

      while (retries < maxRetries) {
        const cdn = this.getCurrentCdn()
        try {
          // 尝试从CDN获取插件列表
          // 假设在仓库根目录有一个plugins.json文件，包含所有插件的信息
          let pluginsUrl
          if (cdn.name === 'github') {
            pluginsUrl = `${cdn.baseUrl}/${source.name}/main/plugins.json`
          } else {
            pluginsUrl = `${cdn.baseUrl}/${source.name}@main/plugins.json`
          }

          const pluginsData = await this.fetchUrl(pluginsUrl)

          // 从plugins数组中获取插件名称并逐个获取manifest.json
          for (const pluginName of pluginsData.plugins) {
            try {
              const manifest = await this.getPluginManifest(pluginName, 'main', source.name)
              // 验证版本兼容性
              const compatible = this.isVersionCompatible(
                manifest.appVersion || { min: '1.0.0', max: '*' }
              )
              allPlugins.push({
                name: manifest.name,
                version: manifest.version,
                displayName: manifest.displayName,
                description: manifest.description,
                author: manifest.author,
                site: manifest.site,
                compatible: compatible,
                appVersion: manifest.appVersion || { min: '1.0.0', max: '*' },
                source: source.id
              })
            } catch (error) {
              this.logger?.error(`获取插件 ${pluginName} 信息失败:`, error)
            }
          }

          // 成功获取当前插件源的插件列表，停止重试
          break
        } catch (error) {
          this.logger?.error(`CDN ${cdn.name} 获取插件列表失败:`, error)
          this.switchToNextCdn()
          retries++
        }
      }
    }

    if (allPlugins.length === 0) {
      throw new Error('所有CDN源获取插件列表都失败')
    }

    return allPlugins
  }

  // 获取插件manifest.json
  async getPluginManifest(
    pluginName,
    version = 'main',
    sourceName = 'OXOYO/Flying-Bird-Wallpaper-Plugins'
  ) {
    let retries = 0
    const maxRetries = this.cdnProviders.length

    while (retries < maxRetries) {
      const cdn = this.getCurrentCdn()
      try {
        let manifestUrl
        if (cdn.name === 'github') {
          manifestUrl = `${cdn.baseUrl}/${sourceName}/${version}/plugins/${pluginName}/manifest.json`
        } else {
          manifestUrl = `${cdn.baseUrl}/${sourceName}@${version}/plugins/${pluginName}/manifest.json`
        }

        const manifest = await this.fetchUrl(manifestUrl)
        return manifest
      } catch (error) {
        this.logger?.error(`CDN ${cdn.name} 失败:`, error)
        this.switchToNextCdn()
        retries++
      }
    }

    throw new Error('所有CDN源都失败')
  }

  // 安装插件
  async installPlugin(
    pluginName,
    version = 'main',
    sourceName = 'OXOYO/Flying-Bird-Wallpaper-Plugins'
  ) {
    try {
      const pluginDir = path.join(this.apiPluginsDir, pluginName)
      if (!fs.existsSync(pluginDir)) {
        fs.mkdirSync(pluginDir, { recursive: true })
      }

      // 下载manifest.json
      const manifest = await this.getPluginManifest(pluginName, version, sourceName)

      // 验证版本兼容性
      if (!this.isVersionCompatible(manifest.appVersion || { min: '1.0.0', max: '*' })) {
        this.logger?.error(`插件 ${pluginName} 与当前应用版本 ${this.appVersion} 不兼容`)
        return false
      }

      fs.writeFileSync(path.join(pluginDir, 'manifest.json'), JSON.stringify(manifest, null, 2))

      // 下载main.mjs
      const mainContent = await this.downloadPluginFile(pluginName, 'main.mjs', version, sourceName)
      fs.writeFileSync(path.join(pluginDir, 'main.mjs'), mainContent)

      return true
    } catch (error) {
      this.logger?.error('安装插件失败:', error)
      return false
    }
  }

  // 下载插件文件
  async downloadPluginFile(
    pluginName,
    fileName,
    version = 'main',
    sourceName = 'OXOYO/Flying-Bird-Wallpaper-Plugins'
  ) {
    let retries = 0
    const maxRetries = this.cdnProviders.length

    while (retries < maxRetries) {
      const cdn = this.getCurrentCdn()
      try {
        let fileUrl
        if (cdn.name === 'github') {
          fileUrl = `${cdn.baseUrl}/${sourceName}/${version}/plugins/${pluginName}/${fileName}`
        } else {
          fileUrl = `${cdn.baseUrl}/${sourceName}@${version}/plugins/${pluginName}/${fileName}`
        }

        const content = await this.fetchUrl(fileUrl, false)
        return content
      } catch (error) {
        this.logger?.error(`CDN ${cdn.name} 失败:`, error)
        this.switchToNextCdn()
        retries++
      }
    }

    throw new Error('所有CDN源都失败')
  }

  // 卸载插件
  async uninstallPlugin(pluginName) {
    try {
      const pluginDir = path.join(this.apiPluginsDir, pluginName)
      if (fs.existsSync(pluginDir)) {
        fs.rmSync(pluginDir, { recursive: true, force: true })
        return true
      }
      return false
    } catch (error) {
      this.logger?.error('卸载插件失败:', error)
      return false
    }
  }

  // 更新插件
  async updatePlugin(pluginName) {
    try {
      // 先卸载旧版本
      await this.uninstallPlugin(pluginName)
      // 再安装新版本
      return await this.installPlugin(pluginName)
    } catch (error) {
      this.logger?.error('更新插件失败:', error)
      return false
    }
  }

  // 插件源管理方法

  // 保存插件源配置到settingData
  savePluginSources() {
    const settingData = this.settingManager?.getAll() || {}

    // 分离官方源和自定义源
    const officialSource = this.pluginSources.find((s) => s.isOfficial)
    const customSources = this.pluginSources.filter((s) => !s.isOfficial)

    // 更新settingData
    settingData.officialPluginSource = officialSource
    settingData.customPluginSources = customSources

    // 保存到settingManager
    this.settingManager?.setAll(settingData)
  }

  // 添加插件源
  addPluginSource(name, repo) {
    // 检查是否已存在
    if (this.pluginSources.some((s) => s.name === name)) {
      return false
    }

    const newSource = {
      id: `source_${Date.now()}`,
      name: name,
      repo: repo,
      isOfficial: false,
      enabled: true
    }

    this.pluginSources.push(newSource)
    this.savePluginSources()
    return true
  }

  // 删除插件源
  removePluginSource(sourceId) {
    const source = this.pluginSources.find((s) => s.id === sourceId)
    if (!source) {
      return false
    }

    // 官方源不可删除
    if (source.isOfficial) {
      return false
    }

    const index = this.pluginSources.findIndex((s) => s.id === sourceId)
    this.pluginSources.splice(index, 1)
    this.savePluginSources()
    return true
  }

  // 启用插件源
  enablePluginSource(sourceId) {
    const source = this.pluginSources.find((s) => s.id === sourceId)
    if (source) {
      source.enabled = true
      this.savePluginSources()
      return true
    }
    return false
  }

  // 禁用插件源
  disablePluginSource(sourceId) {
    const source = this.pluginSources.find((s) => s.id === sourceId)
    if (source && !source.isOfficial) {
      source.enabled = false
      this.savePluginSources()
      return true
    }
    return false
  }

  // 获取插件源列表
  getPluginSources() {
    return this.pluginSources
  }

  // 获取已安装插件列表
  getInstalledPlugins() {
    const plugins = []

    if (fs.existsSync(this.apiPluginsDir)) {
      const dirs = fs.readdirSync(this.apiPluginsDir)
      dirs.forEach((dir) => {
        const pluginDir = path.join(this.apiPluginsDir, dir)
        const manifestPath = path.join(pluginDir, 'manifest.json')

        if (fs.existsSync(manifestPath)) {
          try {
            const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'))
            plugins.push({
              name: manifest.name,
              version: manifest.version,
              displayName: manifest.displayName,
              description: manifest.description,
              author: manifest.author,
              site: manifest.site,
              api: manifest.api
            })
          } catch (error) {
            this.logger?.error('读取插件配置失败:', error)
          }
        }
      })
    }

    return plugins
  }

  // 加载插件
  loadPlugin(pluginName) {
    try {
      const pluginDir = path.join(this.apiPluginsDir, pluginName)
      const mainPath = path.join(pluginDir, 'main.mjs')
      if (fs.existsSync(mainPath)) {
        const PluginClass = require(mainPath).default
        return new PluginClass()
      }
    } catch (error) {
      this.logger?.error('加载插件失败:', error)
    }
    return null
  }

  // 通用URL获取方法
  fetchUrl(url, parseJson = true) {
    return new Promise((resolve, reject) => {
      https
        .get(url, (res) => {
          let data = ''
          res.on('data', (chunk) => {
            data += chunk
          })
          res.on('end', () => {
            try {
              if (parseJson) {
                resolve(JSON.parse(data))
              } else {
                resolve(data)
              }
            } catch (error) {
              reject(error)
            }
          })
        })
        .on('error', (error) => {
          reject(error)
        })
    })
  }
}
```

#### 4.2.2 插件加载器

创建 `src/main/loaders/PluginLoader.js`：

```javascript
class PluginLoader {
  constructor() {
    this.plugins = new Map()
  }

  // 加载所有API插件
  async loadAllApiPlugins() {
    // 加载内置API插件
    this.loadBuiltinApiPlugins()
    // 加载用户安装的API插件
    this.loadUserApiPlugins()
  }

  // 加载内置API插件
  loadBuiltinApiPlugins() {
    // 扫描resources/api目录
    // 加载所有API插件
  }

  // 加载用户安装的API插件
  loadUserApiPlugins() {
    const pluginManager = new PluginManager()
    const installedPlugins = pluginManager.getInstalledPlugins()

    installedPlugins.forEach((plugin) => {
      const pluginInstance = pluginManager.loadPlugin(plugin.name)
      if (pluginInstance) {
        this.plugins.set(plugin.name, pluginInstance)
      }
    })
  }

  // 获取插件实例
  getPlugin(pluginName) {
    return this.plugins.get(pluginName)
  }

  // 获取所有插件
  getAllPlugins() {
    return Array.from(this.plugins.values())
  }
}
```

## 5. 集中式仓库管理

### 5.1 仓库结构

```
Flying-Bird-Wallpaper-Plugins/
├── README.md           # 项目说明
├── package.json        # 项目配置和依赖
├── shared/             # 共享代码和工具
└── plugins/            # API插件目录
    ├── unsplash/       # Unsplash API插件
    │   ├── manifest.json  # 插件配置文件
    │   └── main.mjs        # 插件主代码
    ├── pexels/         # Pexels API插件
    │   ├── manifest.json
    │   └── main.mjs
    ├── pixabay/        # Pixabay API插件
    │   ├── manifest.json
    │   └── main.mjs
    └── ...             # 其他API插件
```

### 5.2 开发流程

1. **克隆仓库**：

   ```bash
   git clone https://github.com/OXOYO/Flying-Bird-Wallpaper-Plugins.git
   cd Flying-Bird-Wallpaper-Plugins
   ```

2. **创建新插件**：

   ```bash
   # 创建插件目录
   mkdir -p plugins/new-api
   # 创建manifest.json文件
   touch plugins/new-api/manifest.json
   # 创建main.mjs文件
   touch plugins/new-api/main.mjs
   ```

3. **编写插件配置**：
   - 在 `plugins/new-api/manifest.json` 文件中添加插件配置
   - 示例配置：

   ```json
   {
     "name": "new-api",
     "displayName": "New API",
     "version": "1.0.0",
     "description": "New API plugin for Flying Bird Wallpaper",
     "author": "OXOYO",
     "site": "https://example.com/",
     "locale": "",
     "enabled": true,
     "remote": true,
     "requireSecretKey": false,
     "supportSearch": true,
     "supportSearchTypes": ["images"],
     "supportDownload": true,
     "searchRequired": {
       "keywords": true,
       "orientation": false
     },
     "downloadRequired": {
       "keywords": true,
       "orientation": false
     }
   }
   ```

4. **编写插件代码**：
   - 在 `plugins/new-api/main.mjs` 文件中实现插件逻辑
   - 确保包含 `info()`, `search()`, `getHotTags()` 方法

5. **测试插件**：
   - 将插件目录复制到应用的 `resources/plugins/api/` 目录
   - 启动应用测试插件功能

6. **提交代码**：

   ```bash
   git add plugins/new-api/
   git commit -m "Add new API plugin: new-api"
   git push origin main
   ```

7. **创建发布版本**：
   - 在GitHub上创建发布版本
   - 标记版本号

## 6. 应用内插件管理界面

### 6.1 界面设计

1. **插件市场**：显示集中式仓库中的可用插件
2. **已安装插件**：管理已安装的插件
3. **插件详情**：查看插件信息和版本
4. **插件设置**：配置插件参数和API密钥

### 6.2 实现方案

创建 `src/renderer/components/PluginManager.vue`：

```vue
<template>
  <div class="plugin-manager">
    <div class="tabs">
      <div
        class="tab"
        :class="{ active: activeTab === 'marketplace' }"
        @click="activeTab = 'marketplace'"
      >
        插件市场
      </div>
      <div
        class="tab"
        :class="{ active: activeTab === 'installed' }"
        @click="activeTab = 'installed'"
      >
        已安装插件
      </div>
    </div>

    <div v-if="activeTab === 'marketplace'" class="marketplace">
      <div class="search-box">
        <input
          type="text"
          v-model="searchQuery"
          placeholder="搜索插件..."
          @keyup.enter="filterPlugins"
        />
        <button @click="filterPlugins">搜索</button>
      </div>
      <div class="plugin-list">
        <div v-for="plugin in filteredPlugins" :key="plugin.name" class="plugin-item">
          <div class="plugin-info">
            <h3>{{ plugin.displayName || plugin.name }}</h3>
            <p>{{ plugin.description }}</p>
            <p class="author">作者: {{ plugin.author }}</p>
            <p class="version">版本: {{ plugin.version }}</p>
          </div>
          <div class="plugin-actions">
            <button @click="installPlugin(plugin.name)">安装</button>
          </div>
        </div>
      </div>
    </div>

    <div v-if="activeTab === 'installed'" class="installed">
      <div class="plugin-list">
        <div v-for="plugin in installedPlugins" :key="plugin.name" class="plugin-item">
          <div class="plugin-info">
            <h3>{{ plugin.displayName || plugin.name }}</h3>
            <p>{{ plugin.description }}</p>
            <p class="author">作者: {{ plugin.author }}</p>
            <p class="version">版本: {{ plugin.version }}</p>
          </div>
          <div class="plugin-actions">
            <button @click="updatePlugin(plugin.name)">更新</button>
            <button @click="uninstallPlugin(plugin.name)">卸载</button>
            <button @click="configurePlugin(plugin)">配置</button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'

const activeTab = ref('marketplace')
const searchQuery = ref('')
const availablePlugins = ref([])
const installedPlugins = ref([])

const filteredPlugins = computed(() => {
  if (!searchQuery.value) {
    return availablePlugins.value
  }
  return availablePlugins.value.filter((plugin) => {
    const name = plugin.name.toLowerCase()
    const displayName = (plugin.displayName || '').toLowerCase()
    const description = (plugin.description || '').toLowerCase()
    const query = searchQuery.value.toLowerCase()
    return name.includes(query) || displayName.includes(query) || description.includes(query)
  })
})

async function loadAvailablePlugins() {
  // 从集中式仓库获取可用插件
  const result = await window.electron.ipcRenderer.invoke('get-available-plugins')
  availablePlugins.value = result
}

async function loadInstalledPlugins() {
  // 加载已安装插件
  const result = await window.electron.ipcRenderer.invoke('get-installed-plugins')
  installedPlugins.value = result
}

async function installPlugin(pluginName) {
  // 安装插件
  const success = await window.electron.ipcRenderer.invoke('install-plugin', pluginName)
  if (success) {
    loadInstalledPlugins()
  }
}

async function uninstallPlugin(pluginName) {
  // 卸载插件
  const success = await window.electron.ipcRenderer.invoke('uninstall-plugin', pluginName)
  if (success) {
    loadInstalledPlugins()
  }
}

async function updatePlugin(pluginName) {
  // 更新插件
  const success = await window.electron.ipcRenderer.invoke('update-plugin', pluginName)
  if (success) {
    loadInstalledPlugins()
  }
}

async function configurePlugin(plugin) {
  // 配置插件
  await window.electron.ipcRenderer.invoke('configure-plugin', plugin)
}

function filterPlugins() {
  // 过滤插件（已在computed中实现）
}

onMounted(() => {
  loadAvailablePlugins()
  loadInstalledPlugins()
})
</script>
```

## 7. 安全考虑

1. **插件验证**：
   - 检查插件的仓库来源
   - 验证插件的文件格式和结构
   - 检查插件的代码安全性

2. **权限控制**：
   - 限制插件的文件系统访问
   - 限制插件的网络访问
   - 限制插件的系统调用

3. **沙箱运行**：
   - 在隔离的环境中运行插件
   - 监控插件的行为
   - 防止恶意插件的攻击

4. **用户提示**：
   - 显示插件的权限请求
   - 提示用户插件的来源
   - 提供插件的安全评级

## 8. 部署方案

### 8.1 集中式仓库部署

1. **GitHub仓库**：创建 `github.com/OXOYO/Flying-Bird-Wallpaper-Plugins` 仓库
2. **分支管理**：使用 `main` 分支作为稳定版本，`develop` 分支作为开发版本
3. **发布流程**：
   - 提交代码到 `develop` 分支
   - 测试通过后合并到 `main` 分支
   - 创建发布版本

### 8.2 应用更新

1. **自动更新**：使用Electron的自动更新机制
2. **版本兼容性**：在插件的info()方法中指定兼容的应用版本
3. **回滚机制**：支持插件版本回滚

## 9. 实施步骤

1. **阶段一**：创建集中式仓库和目录结构
2. **阶段二**：开发插件管理系统和应用内界面
3. **阶段三**：迁移现有API插件到集中式仓库
4. **阶段四**：测试和优化
5. **阶段五**：发布和推广

## 10. 预期效果

1. **完全兼容**：与现有.mjs格式插件完全兼容
2. **集中管理**：所有API插件统一管理，便于维护和更新
3. **简化安装**：用户可以通过应用内界面一键安装插件
4. **易于贡献**：开发者可以通过Pull Request方式贡献新插件
5. **版本控制**：统一的版本控制和发布流程

## 11. 技术栈

- **前端**：Vue 3, Element Plus
- **后端**：Node.js, Electron
- **代码托管**：GitHub
- **构建工具**：Vite, Webpack

## 12. 注意事项

1. **兼容性**：确保插件与应用版本兼容
2. **性能**：优化插件加载和运行性能
3. **安全**：加强插件的安全验证和隔离
4. **文档**：提供详细的插件开发文档
5. **支持**：建立插件开发者支持渠道
6. **版本管理**：使用语义化版本控制
7. **错误处理**：提供友好的错误提示
8. **网络依赖**：处理网络连接问题

## 13. 示例插件

### 13.1 创建示例插件

```bash
# 进入集中式仓库
cd Flying-Bird-Wallpaper-Plugins

# 创建插件目录
mkdir -p plugins/example

# 创建manifest.json文件
cat > plugins/example/manifest.json << 'EOF'
{
  "name": "example",
  "displayName": "Example API",
  "version": "1.0.0",
  "description": "Example API plugin for Flying Bird Wallpaper",
  "author": "OXOYO",
  "site": "https://example.com/",
  "locale": "",
  "enabled": true,
  "remote": true,
  "requireSecretKey": false,
  "supportSearch": true,
  "supportSearchTypes": ["images"],
  "supportDownload": true,
  "searchRequired": {
    "keywords": true,
    "orientation": false
  },
  "downloadRequired": {
    "keywords": true,
    "orientation": false
  },
  "appVersion": {
    "min": "1.0.0",
    "max": "*"
  }
}
EOF

# 创建main.mjs文件
cat > plugins/example/main.mjs << 'EOF'
const { axios, ApiBase, calculateImageOrientation, calculateImageQuality } = global.FBW.apiHelpers
const RESOURCE_NAME = 'example'

export default class ResourceExample extends ApiBase {
  constructor() {
    super(RESOURCE_NAME)
    // 加载manifest.json文件（ApiBase中已实现）
  }

  // info属性由ApiBase提供，基于manifest.json文件
  // 可以通过覆盖get info()方法来自定义info属性

  async search(query) {
    let ret = {
      startPage: query.startPage,
      pageSize: query.pageSize,
      list: [],
      total: 0
    }

    // 模拟API调用
    ret.total = 100
    ret.list = Array.from({ length: query.pageSize }, (_, i) => {
      const id = (query.startPage - 1) * query.pageSize + i + 1
      return {
        resourceName: this.resourceName,
        fileName: `${this.resourceName}_${id}`,
        fileExt: 'jpg',
        fileType: 'image',
        link: `https://example.com/image/${id}`,
        author: 'Example Author',
        title: '',
        desc: 'Example image',
        imageUrl: `https://picsum.photos/800/600?random=${id}`,
        quality: 100,
        width: 1920,
        height: 1080,
        isLandscape: true
      }
    })

    return ret
  }

  async getHotTags(query) {
    return ['nature', 'city', 'technology', 'art', 'travel']
  }
}
EOF

# 提交代码
git add plugins/example/
git commit -m "Add example API plugin"
git push origin main
```

## 14. 总结

通过采用基于目录结构的插件格式，结合manifest.json配置文件和main.mjs主代码文件，Flying Bird Wallpaper实现了更加安全和灵活的插件管理系统。这种方案不仅与现有.mjs格式插件保持兼容，还通过以下改进提升了系统安全性和可维护性：

1. **安全性提升**：使用manifest.json代替eval解析插件信息，消除了潜在的安全风险
2. **结构清晰**：每个插件作为独立目录，包含配置和代码文件，便于管理和维护
3. **集中管理**：所有API插件统一存储在GitHub集中式仓库，便于版本控制和更新
4. **用户友好**：通过应用内插件管理界面，用户可以一键安装、更新和管理插件
5. **易于贡献**：开发者可以通过标准的GitHub工作流贡献新插件
6. **代码复用**：在ApiBase基类中实现公共的manifest加载方法，减少代码重复
7. **统一接口**：通过ApiBase基类定义统一的插件接口，确保所有插件都实现必要的方法

这种方案为Flying Bird Wallpaper提供了一个安全、可扩展的插件生态系统，用户可以轻松获取和使用各种壁纸API，开发者可以便捷地贡献新的插件，从而不断丰富应用的壁纸资源，提升用户体验。

通过将manifest加载逻辑移到ApiBase基类中，插件开发者可以专注于实现具体的API集成逻辑，而不需要关心配置文件的加载和解析，大大简化了插件开发流程。同时，将info从方法改为属性，提高了性能，避免了每次调用info时都加载配置文件的开销。
