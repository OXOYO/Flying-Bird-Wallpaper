import Database from 'better-sqlite3'
import { t } from '../../i18n/server.js'
import { defaultSettingData, defaultResourceMap } from '../../common/publicData.js'

// 删除指定表
const dropTables = []
// 创建表
const createTables = [
  // 数据表: fbw_sys 用于存储系统数据
  `CREATE TABLE IF NOT EXISTS fbw_sys (
   storeKey TEXT PRIMARY KEY, -- 存储Key
   storeData TEXT NOT NULL, -- 存储数据
   storeType TEXT NOT NULL DEFAULT 'string', -- 数据类型
   created_at DATETIME DEFAULT (datetime('now', 'localtime')), -- 记录创建时间
   updated_at DATETIME DEFAULT (datetime('now', 'localtime')), -- 记录修改时间
   UNIQUE (storeKey) -- 唯一键
 )`,
  // 数据表: fbw_favorites 用于存储收藏夹数据
  `CREATE TABLE IF NOT EXISTS fbw_favorites (
   id INTEGER PRIMARY KEY AUTOINCREMENT, -- 收藏记录自增ID
   resourceId INTEGER NOT NULL, -- 资源记录ID
   created_at DATETIME DEFAULT (datetime('now', 'localtime')), -- 记录创建时间
   updated_at DATETIME DEFAULT (datetime('now', 'localtime')), -- 记录修改时间
   UNIQUE (resourceId) -- 唯一键
 )`,
  // 数据表: fbw_history 用于存储已设置的壁纸记录数据
  `CREATE TABLE IF NOT EXISTS fbw_history (
   id INTEGER PRIMARY KEY AUTOINCREMENT, -- 壁纸记录自增ID
   resourceId INTEGER NOT NULL, -- 资源记录ID
   created_at DATETIME DEFAULT (datetime('now', 'localtime')), -- 记录创建时间
   updated_at DATETIME DEFAULT (datetime('now', 'localtime')), -- 记录修改时间
   UNIQUE (id) -- 唯一键
 )`,
  // 数据表: fbw_privacy_space 用于存储隐私空间数据
  `CREATE TABLE IF NOT EXISTS fbw_privacy_space (
   id INTEGER PRIMARY KEY AUTOINCREMENT, -- 隐私空间记录自增ID
   resourceId INTEGER NOT NULL, -- 资源记录ID
   created_at DATETIME DEFAULT (datetime('now', 'localtime')), -- 记录创建时间
   updated_at DATETIME DEFAULT (datetime('now', 'localtime')), -- 记录修改时间
   UNIQUE (resourceId) -- 唯一键
 )`,
  // 数据表: resources 用于存储图片资源数据
  `CREATE TABLE IF NOT EXISTS fbw_resources (
   id INTEGER PRIMARY KEY AUTOINCREMENT, -- 资源记录自增ID
   resourceName TEXT NOT NULL DEFAULT '', -- 资源名称
   fileName TEXT NOT NULL DEFAULT '', -- 文件名
   filePath TEXT NOT NULL DEFAULT '', -- 文件路径
   fileExt TEXT NOT NULL DEFAULT '', -- 文件扩展名
   fileSize INTEGER NOT NULL DEFAULT 0, -- 文件大小
   url TEXT NOT NULl DEFAULT '', -- 远程资源网址
   author TEXT NOT NULL DEFAULT '', -- 作者
   link TEXT NOT NULL DEFAULT '', -- 页面链接
   title TEXT NOT NULL DEFAULT '', -- 标题
   desc TEXT NOT NULL DEFAULT '', -- 描述
   quality TEXT NOT NULL DEFAULT '', -- 图片质量
   width INTEGER NOT NULL DEFAULT 0, -- 图片宽度
   height INTEGER NOT NULL DEFAULT 0, -- 图片高度
   isLandscape INTEGER NOT NULL DEFAULT -1, -- 是否为横屏
   isCut INTEGER NOT NULL DEFAULT 0, -- 是否计算过分词
   atimeMs INTEGER NOT NULL DEFAULT 0, -- 本地文件最后访问时间
   mtimeMs INTEGER NOT NULL DEFAULT 0, -- 本地文件最后修改时间
   ctimeMs INTEGER NOT NULL DEFAULT 0, -- 本地文件创建时间
   created_at DATETIME DEFAULT (datetime('now', 'localtime')), -- 记录创建时间
   updated_at DATETIME DEFAULT (datetime('now', 'localtime')), -- 记录修改时间
   UNIQUE (filePath) -- 唯一键
 )`,
  // 数据表：分词数据
  `CREATE TABLE IF NOT EXISTS fbw_words (
   id INTEGER PRIMARY KEY AUTOINCREMENT, -- 分词记录自增ID
   word TEXT NOT NULL DEFAULT '', -- 分词
   count INTEGER  NOT NULL DEFAULT 0, -- 计数
   type INTEGER  NOT NULL DEFAULT 0, -- 类型：中文、英文
   created_at DATETIME DEFAULT (datetime('now', 'localtime')), -- 记录创建时间
   updated_at DATETIME DEFAULT (datetime('now', 'localtime')), -- 记录修改时间
   UNIQUE (word) -- 唯一键
 )`
]

// 创建索引
const createIndexes = [
  // 基础单列索引 - 按使用频率排序
  'CREATE INDEX IF NOT EXISTS idx_resources_resourcename ON fbw_resources(resourceName)',
  'CREATE INDEX IF NOT EXISTS idx_resources_created_at ON fbw_resources(created_at)',
  'CREATE INDEX IF NOT EXISTS idx_resources_landscape ON fbw_resources(isLandscape)',
  'CREATE INDEX IF NOT EXISTS idx_resources_quality ON fbw_resources(quality)',

  // 收藏、历史和隐私空间的基础索引
  'CREATE INDEX IF NOT EXISTS idx_favorites_resourceid ON fbw_favorites(resourceId)',
  'CREATE INDEX IF NOT EXISTS idx_favorites_created_at ON fbw_favorites(created_at)',
  'CREATE INDEX IF NOT EXISTS idx_history_resourceid ON fbw_history(resourceId)',
  'CREATE INDEX IF NOT EXISTS idx_history_created_at ON fbw_history(created_at)',
  'CREATE INDEX IF NOT EXISTS idx_privacy_space_resourceid ON fbw_privacy_space(resourceId)',
  'CREATE INDEX IF NOT EXISTS idx_privacy_space_created_at ON fbw_privacy_space(created_at)',

  // 分词表索引
  'CREATE INDEX IF NOT EXISTS idx_words_type_count ON fbw_words(type, count)',

  // 复合索引
  'CREATE INDEX IF NOT EXISTS idx_resources_name_created ON fbw_resources(resourceName, created_at)'
]

// 单例实例
let instance = null

export default class DatabaseManager {
  constructor(logger) {
    // 如果已经存在实例，则直接返回该实例
    if (instance) {
      return instance
    }

    this.logger = logger
    this.db = null
    this._initialized = false
    this._initPromise = this._init()

    // 保存实例
    instance = this
  }

  async _init() {
    try {
      this.db = new Database(process.env.FBW_DATABASE_FILE_PATH)
      this.db.exec('PRAGMA journal_mode = WAL')
      this.db.exec('PRAGMA busy_timeout = 5000')

      // 删除指定表
      if (Array.isArray(dropTables) && dropTables.length) {
        dropTables.forEach((tableName) => {
          try {
            this.db.exec(`DROP TABLE IF EXISTS ${tableName}`)
            this.logger.info(`表 ${tableName} 已删除`)
          } catch (err) {
            this.logger.error(`删除表 ${tableName} 失败: ${err}`)
          }
        })
      }

      // 创建表
      if (Array.isArray(createTables) && createTables.length) {
        createTables.forEach((createTableSql) => {
          try {
            this.db.exec(createTableSql)
          } catch (err) {
            this.logger.error(`创建表失败: ${err}`)
          }
        })
      }

      if (Array.isArray(createIndexes) && createIndexes.length) {
        createIndexes.forEach((indexSql) => {
          try {
            this.db.exec(indexSql)
          } catch (err) {
            this.logger.error(`创建索引失败: ${err}`)
          }
        })
      }

      // 初始化设置数据
      const res = await this.getSysRecord('settingData')
      if (res.success && res.data?.storeData) {
        const settingData = Object.assign({}, defaultSettingData, res.data.storeData)
        this.setSysRecord('settingData', settingData, 'object')
      } else {
        this.setSysRecord('settingData', defaultSettingData, 'object')
      }
      this._initialized = true
      this.logger.info('数据库初始化完成')
      return true
    } catch (err) {
      console.error(`创建数据库失败: ${err}`)
      this.logger.error(`创建数据库失败: ${err}`)
      throw err
    }
  }

  // 等待初始化完成的方法
  async waitForInitialization() {
    if (this._initialized) {
      return true
    }
    return this._initPromise
  }

  // 清空指定DB
  async clearDB(tableName, resourceName) {
    let ret = {
      success: false,
      msg: t('messages.operationFail')
    }
    tableName = tableName.startsWith('fbw_') ? tableName : `fbw_${tableName}`

    try {
      // 开始事务
      this.db.exec('BEGIN TRANSACTION')

      let delete_res
      // 检查是否为有效的表名
      if (tableName === 'fbw_resources') {
        if (resourceName) {
          // 清空资源表下指定资源
          const delete_stmt = this.db.prepare(`DELETE FROM ${tableName} WHERE resourceName = ?`)
          delete_res = delete_stmt.run(resourceName, resourceName)
        } else {
          // 清空资源表下所有资源
          const delete_stmt = this.db.prepare(`DELETE FROM ${tableName}`)
          delete_res = delete_stmt.run()
        }
      } else if (
        ['fbw_words', 'fbw_favorites', 'fbw_history', 'fbw_privacy_space'].includes(tableName)
      ) {
        // 清空指定表下所有记录
        const delete_stmt = this.db.prepare(`DELETE FROM ${tableName}`)
        delete_res = delete_stmt.run()
      }

      if (delete_res && delete_res.changes > 0) {
        // 更新sqlite_sequence
        const update_sequence_stmt = this.db.prepare(
          `UPDATE sqlite_sequence SET seq = 0 WHERE name = ?`
        )
        const update_sequence_res = update_sequence_stmt.run(tableName)

        // 提交事务
        this.db.exec('COMMIT')

        if (update_sequence_res.changes > 0) {
          ret = {
            success: true,
            msg: t('messages.clearTableSuccess')
          }
        } else {
          ret = {
            success: false,
            msg: t('messages.clearTableAutoincrementFail')
          }
        }
      } else {
        ret = {
          success: false,
          msg: t('messages.clearTableFail')
        }
        this.logger.error(
          `CLEAR DB FAIL:: tableName => ${tableName} resourceName => ${resourceName}`
        )
      }
    } catch (err) {
      // 发生错误时回滚事务
      try {
        this.db.exec('ROLLBACK')
      } catch (rollbackErr) {
        this.logger.error(`回滚事务失败: ${rollbackErr}`)
      }

      this.logger.error(
        `CLEAR DB FAIL:: tableName => ${tableName} resourceName => ${resourceName}, error: ${err}`
      )
    }
    return ret
  }

  // 获取sys表数据
  async getSysRecord(storeKey) {
    let ret = {
      success: false,
      msg: t('messages.operationFail'),
      data: null
    }
    if (!storeKey) {
      return ret
    }
    try {
      const query_stmt = this.db.prepare(`SELECT * FROM fbw_sys WHERE storeKey = ?`)
      const query_res = query_stmt.get(storeKey)
      if (query_res) {
        let storeData
        let storeType = query_res.storeType
        if (['array', 'object'].includes(storeType)) {
          storeData = JSON.parse(query_res.storeData)
        } else {
          storeData = query_res.storeData
        }
        ret.success = true
        ret.msg = t('messages.operationSuccess')
        ret.data = {
          storeKey,
          storeData,
          storeType
        }
      }
    } catch (err) {
      this.logger.error(`获取设置数据失败: ${err.message}`)
    }
    return ret
  }
  // 获取隐私密码
  async getPrivacyPassword() {
    let ret = {
      success: false,
      msg: t('messages.operationFail'),
      data: null
    }
    try {
      const query_stmt = this.db.prepare(`SELECT * FROM fbw_sys WHERE storeKey = ?`)
      const query_res = query_stmt.get('privacyPassword')
      ret.success = true
      ret.msg = t('messages.operationSuccess')
      ret.data =
        typeof query_res?.storeData === 'string'
          ? JSON.parse(query_res?.storeData)
          : query_res?.storeData
    } catch (err) {
      this.logger.error(`获取隐私密码失败: ${err}`)
    }
    return ret
  }

  // 获取resourceMap数据
  async getResourceMap() {
    let ret = {
      success: false,
      msg: t('messages.operationFail'),
      // FIXME 此次专门设置默认值
      data: JSON.parse(JSON.stringify(defaultResourceMap))
    }
    try {
      const res = await this.getSysRecord('resourceMap')
      if (res.success) {
        ret.success = true
        ret.msg = t('messages.operationSuccess')
        ret.data = res.data.storeData || JSON.parse(JSON.stringify(defaultResourceMap))
      }
    } catch (err) {
      this.logger.error(`获取resourceMap信息失败: ${err}`)
    }
    return ret
  }

  // 设置sys表数据
  async setSysRecord(storeKey, storeData, storeType = 'string') {
    let ret = {
      success: false,
      msg: t('messages.operationFail'),
      data: null
    }
    if (!storeKey || !storeData) {
      return ret
    }
    let storeDataStr
    if (['array', 'object'].includes(storeType)) {
      storeDataStr = JSON.stringify(storeData)
    } else {
      storeDataStr = storeData.toString()
    }

    // 更新或插入数据到sys表
    const update_stmt = this.db.prepare(
      `INSERT OR REPLACE INTO fbw_sys (storeKey, storeData, storeType) VALUES (@storeKey, @storeData, @storeType)`
    )
    const update_result = update_stmt.run({
      storeKey,
      storeData: storeDataStr,
      storeType
    })
    if (update_result.changes > 0) {
      ret = {
        success: true,
        msg: t('messages.operationSuccess'),
        data: {
          storeKey,
          storeData,
          storeType
        }
      }
    } else {
      this.logger.error(`更新失败: tableName => fbw_sys, storeKey => ${storeKey}`)
    }

    return ret
  }
}
