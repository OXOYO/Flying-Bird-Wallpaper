import fs from 'node:fs'
import path from 'node:path'
import https from 'node:https'
import { app } from 'electron'

export default class PluginManager {
  static _instance = null

  static getInstance(logger, dbManager) {
    if (!PluginManager._instance) {
      PluginManager._instance = new PluginManager(logger, dbManager)
    }
    return PluginManager._instance
  }

  constructor(logger, dbManager) {
    if (PluginManager._instance) {
      return PluginManager._instance
    }

    this.logger = logger
    this.dbManager = dbManager
    this.pluginDir = process.env.FBW_PLUGINS_PATH
    this.apiPluginsDir = path.join(this.pluginDir, 'api')
    this.ensureDirectories()
    this.centralRepo = 'OXOYO/Flying-Bird-Wallpaper-Plugins'
    this.appVersion = app.getVersion() || '1.0.0'
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

    PluginManager._instance = this
  }

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

  isVersionCompatible(pluginVersionRange) {
    const { min, max } = pluginVersionRange

    if (min && min !== '*') {
      if (this.compareVersions(this.appVersion, min) < 0) {
        return false
      }
    }

    if (max && max !== '*') {
      if (this.compareVersions(this.appVersion, max) > 0) {
        return false
      }
    }

    return true
  }

  getCurrentCdn() {
    return this.cdnProviders[this.currentCdnIndex]
  }

  switchToNextCdn() {
    this.currentCdnIndex = (this.currentCdnIndex + 1) % this.cdnProviders.length
  }

  ensureDirectories() {
    if (!fs.existsSync(this.pluginDir)) {
      fs.mkdirSync(this.pluginDir, { recursive: true })
    }
    if (!fs.existsSync(this.apiPluginsDir)) {
      fs.mkdirSync(this.apiPluginsDir, { recursive: true })
    }
  }

  async getAvailablePlugins() {
    try {
      try {
        const pluginNames = await this.getPluginsListFromCdn()
        if (pluginNames && pluginNames.length > 0) {
          const plugins = []
          for (const pluginName of pluginNames) {
            try {
              const manifest = await this.getPluginManifest(pluginName)
              const compatible = this.isVersionCompatible(
                manifest.appVersion || { min: '1.0.0', max: '*' }
              )
              const visible = manifest.visible === true
              if (compatible && visible) {
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
              }
            } catch (error) {
              this.logger.error(`获取插件 ${pluginName} 信息失败:`, error)
            }
          }
          return plugins
        }
      } catch (cdnError) {
        this.logger.error('CDN 获取插件列表失败，尝试使用GitHub API:', cdnError)
      }

      try {
        const treeUrl = `https://api.github.com/repos/${this.centralRepo}/git/trees/main?recursive=1`
        const response = await this.fetchUrl(treeUrl)

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

        for (const pluginName of pluginDirs) {
          try {
            const manifest = await this.getPluginManifest(pluginName)
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
            this.logger.error(`获取插件 ${pluginName} 信息失败:`, error)
          }
        }

        return plugins
      } catch (apiError) {
        this.logger.error('GitHub API 失败，使用缓存的插件列表:', apiError)
      }

      return this.getCachedPluginsList()
    } catch (error) {
      this.logger.error('获取可用插件列表失败:', error)
      return this.getCachedPluginsList()
    }
  }

  async getPluginsListFromCdn() {
    let retries = 0
    const maxRetries = this.cdnProviders.length

    while (retries < maxRetries) {
      const cdn = this.getCurrentCdn()
      try {
        let pluginsUrl
        if (cdn.name === 'github') {
          pluginsUrl = `${cdn.baseUrl}/${this.centralRepo}/main/plugins.json`
        } else {
          pluginsUrl = `${cdn.baseUrl}/${this.centralRepo}@main/plugins.json`
        }

        const pluginsData = await this.fetchUrl(pluginsUrl)

        const compatiblePlugins = pluginsData.map((plugin) => {
          const compatible = this.isVersionCompatible(
            plugin.appVersion || { min: '1.0.0', max: '*' }
          )
          return {
            ...plugin,
            compatible: compatible
          }
        })

        return compatiblePlugins
      } catch (error) {
        this.logger.error(`CDN ${cdn.name} 获取插件列表失败:`, error)
        this.switchToNextCdn()
        retries++
      }
    }

    throw new Error('所有CDN源获取插件列表都失败')
  }

  async getPluginManifest(pluginName, version = 'main') {
    let retries = 0
    const maxRetries = this.cdnProviders.length

    while (retries < maxRetries) {
      const cdn = this.getCurrentCdn()
      try {
        let manifestUrl
        if (cdn.name === 'github') {
          manifestUrl = `${cdn.baseUrl}/${this.centralRepo}/${version}/plugins/${pluginName}/manifest.json`
        } else {
          manifestUrl = `${cdn.baseUrl}/${this.centralRepo}@${version}/plugins/${pluginName}/manifest.json`
        }

        const manifest = await this.fetchUrl(manifestUrl)
        return manifest
      } catch (error) {
        this.logger.error(`CDN ${cdn.name} 失败:`, error)
        this.switchToNextCdn()
        retries++
      }
    }

    throw new Error('所有CDN源都失败')
  }

  async installPlugin(pluginName, version = 'main') {
    try {
      const pluginDir = path.join(this.apiPluginsDir, pluginName)
      if (!fs.existsSync(pluginDir)) {
        fs.mkdirSync(pluginDir, { recursive: true })
      }

      const manifest = await this.getPluginManifest(pluginName, version)

      if (!this.isVersionCompatible(manifest.appVersion || { min: '1.0.0', max: '*' })) {
        this.logger.error(`插件 ${pluginName} 与当前应用版本 ${this.appVersion} 不兼容`)
        return { success: false, message: '插件版本不兼容' }
      }

      fs.writeFileSync(path.join(pluginDir, 'manifest.json'), JSON.stringify(manifest, null, 2))

      const mainContent = await this.downloadPluginFile(pluginName, 'main.mjs', version)
      fs.writeFileSync(path.join(pluginDir, 'main.mjs'), mainContent)

      const pluginsRecord = await this.dbManager.getSysRecord('plugins')
      const plugins =
        pluginsRecord && pluginsRecord.success && pluginsRecord.data ? pluginsRecord.data : {}

      plugins[pluginName] = {
        name: manifest.name,
        version: manifest.version,
        displayName: manifest.displayName,
        description: manifest.description,
        author: manifest.author,
        site: manifest.site,
        enabled: manifest.enabled !== undefined ? manifest.enabled : true,
        requireSecretKey: manifest.requireSecretKey || false,
        installedAt: new Date().toISOString()
      }

      const res = await this.dbManager.setSysRecord('plugins', plugins, 'object')
      if (res.success) {
        this.logger.info(`插件 ${pluginName} 安装信息已写入数据库`)
      } else {
        this.logger.error(`插件 ${pluginName} 安装信息写入数据库失败: ${res.message}`)
      }

      return { success: true, message: '插件安装成功' }
    } catch (error) {
      this.logger.error('安装插件失败:', error)
      return { success: false, message: '插件安装失败: ' + error.message }
    }
  }

  async downloadPluginFile(pluginName, fileName, version = 'main') {
    let retries = 0
    const maxRetries = this.cdnProviders.length

    while (retries < maxRetries) {
      const cdn = this.getCurrentCdn()
      try {
        let fileUrl
        if (cdn.name === 'github') {
          fileUrl = `${cdn.baseUrl}/${this.centralRepo}/${version}/plugins/${pluginName}/${fileName}`
        } else {
          fileUrl = `${cdn.baseUrl}/${this.centralRepo}@${version}/plugins/${pluginName}/${fileName}`
        }

        const content = await this.fetchUrl(fileUrl, false)
        return content
      } catch (error) {
        this.logger.error(`CDN ${cdn.name} 失败:`, error)
        this.switchToNextCdn()
        retries++
      }
    }

    throw new Error('所有CDN源都失败')
  }

  async uninstallPlugin(pluginName) {
    try {
      const pluginDir = path.join(this.apiPluginsDir, pluginName)
      if (!fs.existsSync(pluginDir)) {
        return { success: false, message: '插件不存在' }
      }

      const manifestPath = path.join(pluginDir, 'manifest.json')
      const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'))

      if (manifest.type === 'system') {
        this.logger.error(`系统插件 ${pluginName} 不允许卸载`)
        return { success: false, message: '系统插件不允许卸载' }
      }

      fs.rmSync(pluginDir, { recursive: true, force: true })

      const res = await this.dbManager.getSysRecord('plugins')
      const plugins = res && res.success && res.data ? res.data : {}

      if (plugins[pluginName]) {
        delete plugins[pluginName]
        const res = await this.dbManager.setSysRecord('plugins', plugins, 'object')
        if (res.success) {
          this.logger.info(`插件 ${pluginName} 信息已从数据库移除`)
        } else {
          this.logger.error(`插件 ${pluginName} 信息从数据库移除失败: ${res.message}`)
        }
      }

      return { success: true, message: '插件卸载成功' }
    } catch (error) {
      this.logger.error('卸载插件失败:', error)
      return { success: false, message: '插件卸载失败: ' + error.message }
    }
  }

  async updatePlugin(pluginName) {
    try {
      await this.uninstallPlugin(pluginName)
      return await this.installPlugin(pluginName)
    } catch (error) {
      this.logger.error('更新插件失败:', error)
      return { success: false, message: '插件更新失败: ' + error.message }
    }
  }

  async getInstalledPlugins() {
    try {
      const res = await this.dbManager.getSysRecord('plugins')

      if (!res || !res.success) {
        const errorMessage = res && res.message ? res.message : '未知错误'
        this.logger.warn(`获取已安装插件记录失败: ${errorMessage}`)
        return plugins
      }

      const plugins = res.data

      if (!plugins || Object.keys(plugins).length === 0) {
        this.logger.warn('已安装插件列表为空')
        return plugins
      }

      for (const pluginName of Object.keys(plugins)) {
        const pluginDir = path.join(this.apiPluginsDir, pluginName)
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
              enabled: manifest.enabled !== undefined ? manifest.enabled : true,
              requireSecretKey: manifest.requireSecretKey || false
            })
          } catch (error) {
            this.logger.error(`读取插件 ${pluginName} 配置失败:`, error)
          }
        } else {
          this.logger.warn(`插件 ${pluginName} 目录存在但缺少 manifest.json`)
        }
      }

      return plugins
    } catch (error) {
      const errorMessage = error.message || error.toString() || '未知错误'
      this.logger.error('获取已安装插件列表失败:', errorMessage)
      return []
    }
  }

  getCachedPluginsList() {
    const cachePath = path.join(this.pluginDir, 'plugins-cache.json')
    if (fs.existsSync(cachePath)) {
      try {
        const cacheData = fs.readFileSync(cachePath, 'utf8')
        return JSON.parse(cacheData)
      } catch (error) {
        this.logger.error('读取插件缓存失败:', error)
      }
    }
    return []
  }

  cachePluginsList(plugins) {
    const cachePath = path.join(this.pluginDir, 'plugins-cache.json')
    try {
      fs.writeFileSync(cachePath, JSON.stringify(plugins, null, 2))
    } catch (error) {
      this.logger.error('缓存插件列表失败:', error)
    }
  }

  async fetchUrl(url, parseJson = true) {
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
