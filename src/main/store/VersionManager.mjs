import { appInfo } from '../../common/config.js'
import semver from 'semver'
import fs from 'fs'
import path from 'path'

export default class VersionManager {
  // 单例实例
  static _instance = null

  // 获取单例实例
  static getInstance(logger, dbManager) {
    if (!VersionManager._instance) {
      VersionManager._instance = new VersionManager(logger, dbManager)
    }
    return VersionManager._instance
  }

  constructor(logger, dbManager) {
    // 防止直接实例化
    if (VersionManager._instance) {
      return VersionManager._instance
    }

    this.logger = logger
    this.dbManager = dbManager
    this.db = dbManager.db
    this.migrations = []
    // 初始化
    this._initialized = false
    this._initPromise = this._init()

    VersionManager._instance = this
  }

  async _init() {
    try {
      // 自动加载迁移脚本
      await this.autoLoadMigrations()

      // 执行版本迁移
      const migrationResult = await this.doMigrate()
      if (!migrationResult.success) {
        this.logger.error(`版本迁移失败: ${migrationResult.message}`)
      } else {
        this.logger.info(`版本迁移结果: ${migrationResult.message}`)
      }
      this._initialized = true
      return true
    } catch (error) {
      this.logger.error(`初始化版本管理失败: ${error}`)
    }
  }

  // 等待初始化完成的方法
  async waitForInitialization() {
    if (this._initialized) {
      return true
    }
    return this._initPromise
  }

  // 初始化版本表
  initVersionTable() {
    try {
      // 检查是否有版本记录
      const versionRecord = this.db
        .prepare('SELECT version FROM fbw_version ORDER BY updated_at DESC LIMIT 1')
        .get()

      if (!versionRecord) {
        // 首次安装，插入当前版本
        this.db.prepare('INSERT INTO fbw_version (version) VALUES (?)').run(appInfo.version)
        this.logger.info(`初始化版本记录: ${appInfo.version}`)
        return null
      }

      return versionRecord.version
    } catch (error) {
      this.logger.error(`初始化版本表失败: ${error}`)
      return null
    }
  }

  // 注册迁移脚本
  registerMigration(fromVersion, toVersion, migrationFn) {
    this.migrations.push({
      fromVersion,
      toVersion,
      migrationFn
    })
  }

  // 自动加载迁移脚本
  async autoLoadMigrations() {
    try {
      // 自动加载迁移脚本
      const migrationsDir = path.join(process.env.FBW_RESOURCES_PATH, 'migrations')
      if (!fs.existsSync(migrationsDir)) {
        this.logger.warn(`迁移脚本目录不存在: ${migrationsDir}`)
        return
      }

      const files = fs.readdirSync(migrationsDir)

      // 按文件名排序，确保按版本顺序加载
      files.sort()

      for (const file of files) {
        if (file.endsWith('.mjs') || file.endsWith('.js')) {
          try {
            // 从文件名中提取版本信息
            const versionMatch = file.match(/(\d+\.\d+\.\d+)_to_(\d+\.\d+\.\d+)/)
            if (!versionMatch) {
              this.logger.warn(`无法从文件名解析版本信息: ${file}`)
              continue
            }

            const fromVersion = versionMatch[1]
            const toVersion = versionMatch[2]

            // 动态导入迁移脚本
            const modulePath = path.join(migrationsDir, file)
            const module = await import(/* @vite-ignore */ `file://${modulePath}`)

            // 获取迁移函数
            const migrationFn = module.default || module.migrate

            if (typeof migrationFn !== 'function') {
              this.logger.warn(`迁移脚本 ${file} 未导出有效的迁移函数`)
              continue
            }

            // 注册迁移脚本
            this.registerMigration(fromVersion, toVersion, migrationFn)
            this.logger.info(`成功加载迁移脚本: ${fromVersion} -> ${toVersion}`)
          } catch (err) {
            this.logger.error(`加载迁移脚本 ${file} 失败: ${err}`)
          }
        }
      }
    } catch (err) {
      this.logger.error(`自动加载迁移脚本失败: ${err}`)
    }
  }

  // 执行版本迁移
  async doMigrate() {
    const prevVersion = this.initVersionTable()
    const currentVersion = appInfo.version

    // 如果是首次安装或版本相同，不需要迁移
    if (!prevVersion || prevVersion === currentVersion) {
      return { success: true, message: '无需迁移' }
    }

    this.logger.info(`检测到版本升级: ${prevVersion} -> ${currentVersion}`)

    try {
      // 按版本号排序迁移脚本
      const applicableMigrations = this.migrations
        .filter(
          (m) => semver.gt(m.toVersion, prevVersion) && semver.lte(m.toVersion, currentVersion)
        )
        .sort((a, b) => semver.compare(a.toVersion, b.toVersion))

      if (applicableMigrations.length === 0) {
        this.logger.info(`没有找到适用的迁移脚本`)
        // 更新版本记录
        this.db.prepare('INSERT INTO fbw_version (version) VALUES (?)').run(currentVersion)
        return { success: true, message: '无需迁移脚本' }
      }

      // 执行迁移脚本
      for (const migration of applicableMigrations) {
        this.logger.info(`执行迁移脚本: ${migration.fromVersion} -> ${migration.toVersion}`)
        await migration.migrationFn(this.dbManager, this.logger)
      }

      // 更新版本记录
      this.db.prepare('INSERT INTO fbw_version (version) VALUES (?)').run(currentVersion)

      return { success: true, message: `成功从 ${prevVersion} 迁移到 ${currentVersion}` }
    } catch (error) {
      this.logger.error(`版本迁移失败: ${error}`)
      return { success: false, message: `迁移失败: ${error.message}` }
    }
  }
}
