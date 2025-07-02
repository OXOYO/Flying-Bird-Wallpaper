import fs from 'node:fs'
import path from 'node:path'
import ApiBase from '../ApiBase.js'

export default class ApiManager {
  // 单例实例
  static _instance = null

  // 获取单例实例
  static getInstance(logger, dbManager) {
    if (!ApiManager._instance) {
      ApiManager._instance = new ApiManager(logger, dbManager)
    }
    return ApiManager._instance
  }

  constructor(logger, dbManager) {
    // 防止直接实例化
    if (ApiManager._instance) {
      return ApiManager._instance
    }

    this.logger = logger
    this.dbManager = dbManager
    // API插件列表
    this.apiMap = {}

    // API目录 - 内置API
    this.sysApiDir = path.join(process.env.FBW_RESOURCES_PATH, 'api')
    // API目录 - 用户API
    this.userApiDir = path.join(process.env.FBW_PLUGINS_PATH, 'api')
    // 确保用户API目录存在
    if (!fs.existsSync(this.userApiDir)) {
      fs.mkdirSync(this.userApiDir, { recursive: true })
    }

    this._initialized = false
    this._initPromise = this._init()

    ApiManager._instance = this
  }

  async _init() {
    try {
      await this.loadApi()
      this._initialized = true
      return true
    } catch (err) {
      this.logger.error(`初始化API插件失败: ${err}`)
      return false
    }
  }

  // 等待初始化完成的方法
  async waitForInitialization() {
    if (this._initialized) {
      return true
    }
    return this._initPromise
  }

  // 加载API
  async loadApi() {
    const apiMap = {}

    // 加载内置API
    await this.loadApiFromDir(this.sysApiDir, apiMap)

    // 加载用户API
    await this.loadApiFromDir(this.userApiDir, apiMap)

    this.apiMap = apiMap

    const count = Object.keys(apiMap).length
    if (count === 0) {
      this.logger.error(`未加载任何API插件`)
      return
    } else {
      this.logger.info(`成功加载 ${count} 个API插件`)
    }
    // 处理API信息，写入数据库
    const remoteResourceMap = {}
    for (const [resourceName, api] of Object.entries(apiMap)) {
      const apiInfo = api.info()
      remoteResourceMap[resourceName] = apiInfo
    }

    // 写入数据库
    const res = await this.dbManager.setSysRecord('remoteResourceMap', remoteResourceMap, 'object')
    if (res.success) {
      this.logger.info('写入remoteResourceMap信息成功')
    } else {
      this.logger.error(`写入remoteResourceMap信息失败: ${res.message}`)
    }
  }

  // 从指定目录加载插件
  async loadApiFromDir(dir, plugins) {
    this.logger.info(`开始加载API插件，目录: ${dir}`)
    if (!fs.existsSync(dir)) return

    const files = fs.readdirSync(dir)

    // 使用Promise.all等待所有插件加载完成
    await Promise.all(
      files.map(async (file) => {
        if (file.endsWith('.js') || file.endsWith('.mjs')) {
          try {
            const pluginPath = path.join(dir, file)

            // 使用await直接等待插件加载
            const module = await import(/* @vite-ignore */ `file://${pluginPath}`)
            const PluginClass = module.default

            // 检查是否是有效的插件类
            if (PluginClass && PluginClass.prototype instanceof ApiBase) {
              const pluginInstance = new PluginClass()
              const resourceName = pluginInstance.resourceName

              if (resourceName) {
                // 如果已存在同名插件，用户插件优先
                if (plugins[resourceName]) {
                  this.logger.warn(`发现重复的API插件: ${resourceName}，将使用新加载的版本`)
                }

                plugins[resourceName] = pluginInstance
                this.logger.info(`成功加载API插件: ${resourceName}`)
              } else {
                this.logger.warn(`插件 ${file} 未提供resourceName，已跳过`)
              }
            } else {
              this.logger.warn(`${file} 不是有效的API插件类，已跳过`)
            }
          } catch (err) {
            this.logger.error(`加载插件 ${file} 失败: ${err}`)
          }
        }
      })
    )
  }

  // 获取API列表
  async getApiList() {
    let ret = {
      success: false,
      message: '',
      data: []
    }
    const res = await this.dbManager.getSysRecord('api')
    if (res.success && res.data?.storeData) {
      ret.success = true
      ret.data = res.data.storeData
    } else {
      ret.message = res.message
    }
    return ret
  }

  // 调用API
  async call(resourceName, funcName, params) {
    const api = this.apiMap[resourceName]
    if (!api) {
      throw new Error(`未找到API插件: ${resourceName}`)
    }
    if (!api[funcName] || typeof api[funcName] !== 'function') {
      throw new Error(`API插件 ${resourceName} 未提供函数: ${funcName}`)
    }
    return await api[funcName](params)
  }
}
