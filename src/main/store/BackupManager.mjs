import fs from 'fs'
import path from 'path'
import { app } from 'electron'
import { v4 as uuidv4 } from 'uuid'
import { appInfo } from '../../common/config.js'

export default class BackupManager {
  // 单例实例
  static _instance = null

  // 获取单例实例
  static getInstance(logger, dbManager) {
    if (!BackupManager._instance) {
      BackupManager._instance = new BackupManager(logger, dbManager)
    }
    return BackupManager._instance
  }

  constructor(logger, dbManager) {
    // 防止直接实例化
    if (BackupManager._instance) {
      return BackupManager._instance
    }

    this.logger = logger
    this.dbManager = dbManager
    this.backupDir = path.join(app.getPath('userData'), 'backups')

    // 确保备份目录存在
    if (!fs.existsSync(this.backupDir)) {
      fs.mkdirSync(this.backupDir, { recursive: true })
    }

    BackupManager._instance = this
  }

  // 创建数据库备份
  async createBackup(reason = 'version_upgrade') {
    try {
      const dbPath = process.env.FBW_DATABASE_FILE_PATH
      const backupFileName = `fbw_backup_${appInfo.version}_${Date.now()}_${uuidv4().substring(0, 8)}.db`
      const backupPath = path.join(this.backupDir, backupFileName)

      // 关闭数据库连接
      this.dbManager.db.close()

      // 复制数据库文件
      fs.copyFileSync(dbPath, backupPath)

      // 重新打开数据库连接
      this.dbManager.initDatabase()

      // 记录备份信息
      this.dbManager.db
        .prepare(
          `
        CREATE TABLE IF NOT EXISTS fbw_backups (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          backup_path TEXT NOT NULL,
          version TEXT NOT NULL,
          reason TEXT NOT NULL,
          created_at INTEGER NOT NULL
        )
      `
        )
        .run()

      this.dbManager.db
        .prepare(
          `
        INSERT INTO fbw_backups (backup_path, version, reason, created_at)
        VALUES (?, ?, ?, ?)
      `
        )
        .run(backupPath, appInfo.version, reason, Date.now())

      this.logger.info(`数据库备份成功: ${backupPath}`)
      return { success: true, backupPath }
    } catch (error) {
      this.logger.error(`数据库备份失败: ${error}`)
      return { success: false, error: error.message }
    }
  }

  // 从备份恢复
  async restoreFromBackup(backupPath) {
    try {
      const dbPath = process.env.FBW_DATABASE_FILE_PATH

      // 关闭数据库连接
      this.dbManager.db.close()

      // 复制备份文件到数据库位置
      fs.copyFileSync(backupPath, dbPath)

      // 重新打开数据库连接
      this.dbManager.initDatabase()

      this.logger.info(`数据库恢复成功: ${backupPath}`)
      return { success: true }
    } catch (error) {
      this.logger.error(`数据库恢复失败: ${error}`)
      return { success: false, error: error.message }
    }
  }

  // 获取备份列表
  getBackupList() {
    try {
      this.dbManager.db
        .prepare(
          `
        CREATE TABLE IF NOT EXISTS fbw_backups (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          backup_path TEXT NOT NULL,
          version TEXT NOT NULL,
          reason TEXT NOT NULL,
          created_at INTEGER NOT NULL
        )
      `
        )
        .run()

      const backups = this.dbManager.db
        .prepare(
          `
        SELECT * FROM fbw_backups ORDER BY created_at DESC
      `
        )
        .all()

      return { success: true, backups }
    } catch (error) {
      this.logger.error(`获取备份列表失败: ${error}`)
      return { success: false, error: error.message }
    }
  }
}
