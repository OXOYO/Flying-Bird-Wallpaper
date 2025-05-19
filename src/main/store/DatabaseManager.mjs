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
    atimeMs INTEGER NOT NULL DEFAULT 0, -- 本地文件最后访问时间
    mtimeMs INTEGER NOT NULL DEFAULT 0, -- 本地文件最后修改时间
    ctimeMs INTEGER NOT NULL DEFAULT 0, -- 本地文件创建时间
    created_at DATETIME DEFAULT (datetime('now', 'localtime')), -- 记录创建时间
    updated_at DATETIME DEFAULT (datetime('now', 'localtime')), -- 记录修改时间
    UNIQUE (filePath) -- 唯一键
  )`,
  // 数据表：资源分词关联表
  `CREATE TABLE IF NOT EXISTS fbw_resource_words (
    id INTEGER PRIMARY KEY AUTOINCREMENT, -- 记录自增ID
    resourceId INTEGER NOT NULL, -- 资源ID
    wordId INTEGER NOT NULL, -- 分词ID
    created_at DATETIME DEFAULT (datetime('now', 'localtime')), -- 记录创建时间
    UNIQUE (resourceId, wordId) -- 确保资源和分词的组合唯一
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
  )`,
  // 系统表：版本管理
  `CREATE TABLE IF NOT EXISTS fbw_version (
    id INTEGER PRIMARY KEY AUTOINCREMENT, -- 记录自增ID
    version TEXT NOT NULL, -- 版本号
    created_at DATETIME DEFAULT (datetime('now', 'localtime')), -- 记录创建时间
    updated_at DATETIME DEFAULT (datetime('now', 'localtime')), -- 记录修改时间
    UNIQUE (version) -- 唯一键
  )`
]

// 创建索引
const createIndexes = [
  // 基础单列索引 - 按使用频率排序
  'CREATE INDEX IF NOT EXISTS idx_resources_resourcename ON fbw_resources(resourceName)',
  'CREATE INDEX IF NOT EXISTS idx_resources_created_at ON fbw_resources(created_at)',
  'CREATE INDEX IF NOT EXISTS idx_resources_landscape ON fbw_resources(isLandscape)',
  'CREATE INDEX IF NOT EXISTS idx_resources_quality ON fbw_resources(quality)',
  'CREATE INDEX IF NOT EXISTS idx_resources_filePath ON fbw_resources(filePath)',
  'CREATE INDEX IF NOT EXISTS idx_resources_fileExt ON fbw_resources(fileExt)',

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
  'CREATE INDEX IF NOT EXISTS idx_resources_name_created ON fbw_resources(resourceName, created_at)',
  // 分词相关索引
  'CREATE INDEX IF NOT EXISTS idx_resource_words_resourceid ON fbw_resource_words(resourceId)',
  'CREATE INDEX IF NOT EXISTS idx_resource_words_wordid ON fbw_resource_words(wordId)'
]

export default class DatabaseManager {
  // 单例实例
  static _instance = null

  // 获取单例实例
  static getInstance(logger) {
    if (!DatabaseManager._instance) {
      DatabaseManager._instance = new DatabaseManager(logger)
    }
    return DatabaseManager._instance
  }

  constructor(logger) {
    // 防止直接实例化
    if (DatabaseManager._instance) {
      return DatabaseManager._instance
    }

    this.logger = logger
    this.db = null
    this._initialized = false
    this._initPromise = this._init()

    // 保存实例
    DatabaseManager._instance = this
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
          // 获取要删除的资源ID
          const get_ids_stmt = this.db.prepare(`SELECT id FROM ${tableName} WHERE resourceName = ?`)
          const resources = get_ids_stmt.all(resourceName)

          if (resources && resources.length > 0) {
            const resourceIds = resources.map((r) => r.id)

            // 清除关联表中的数据
            for (const id of resourceIds) {
              // 清除收藏表中的关联数据
              const delete_favorites_stmt = this.db.prepare(
                `DELETE FROM fbw_favorites WHERE resourceId = ?`
              )
              delete_favorites_stmt.run(id)

              // 清除历史表中的关联数据
              const delete_history_stmt = this.db.prepare(
                `DELETE FROM fbw_history WHERE resourceId = ?`
              )
              delete_history_stmt.run(id)

              // 清除隐私空间表中的关联数据
              const delete_privacy_stmt = this.db.prepare(
                `DELETE FROM fbw_privacy_space WHERE resourceId = ?`
              )
              delete_privacy_stmt.run(id)

              // 清除资源分词关联表中的数据
              const delete_resource_words_stmt = this.db.prepare(
                `DELETE FROM fbw_resource_words WHERE resourceId = ?`
              )
              delete_resource_words_stmt.run(id)
            }

            // 更新词库中的计数
            // 获取要删除的资源关联的词条ID
            const get_word_ids_stmt = this.db.prepare(`
              SELECT DISTINCT wordId FROM fbw_resource_words
              WHERE resourceId IN (${resourceIds.map(() => '?').join(',')})
            `)
            const wordIds = get_word_ids_stmt.all(...resourceIds).map((w) => w.wordId)

            if (wordIds.length > 0) {
              // 更新词条计数
              const update_word_count_stmt = this.db.prepare(`
                UPDATE fbw_words SET count = count - 1
                WHERE id IN (${wordIds.map(() => '?').join(',')})
              `)
              update_word_count_stmt.run(...wordIds)

              // 删除计数为0或小于0的词条
              this.db.prepare(`DELETE FROM fbw_words WHERE count <= 0`).run()
            }
          }

          // 清空资源表下指定资源
          const delete_stmt = this.db.prepare(`DELETE FROM ${tableName} WHERE resourceName = ?`)
          delete_res = delete_stmt.run(resourceName)
        } else {
          // 清空所有关联表
          this.db.prepare(`DELETE FROM fbw_favorites`).run()
          this.db.prepare(`DELETE FROM fbw_history`).run()
          this.db.prepare(`DELETE FROM fbw_privacy_space`).run()
          this.db.prepare(`DELETE FROM fbw_resource_words`).run()
          this.db.prepare(`DELETE FROM fbw_words`).run()

          // 清空资源表下所有资源
          const delete_stmt = this.db.prepare(`DELETE FROM ${tableName}`)
          delete_res = delete_stmt.run()
        }
      } else if (tableName === 'fbw_words') {
        // 清空资源分词关联表
        this.db.prepare(`DELETE FROM fbw_resource_words`).run()

        // 清空分词表
        const delete_stmt = this.db.prepare(`DELETE FROM ${tableName}`)
        delete_res = delete_stmt.run()
      } else if (
        ['fbw_favorites', 'fbw_history', 'fbw_privacy_space', 'fbw_resource_words'].includes(
          tableName
        )
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

        // 如果清除了fbw_resources或fbw_words，也需要重置关联表的自增ID
        if (tableName === 'fbw_resources' && !resourceName) {
          // 只有在清空整个资源表时才重置关联表的自增ID
          this.db.prepare(`UPDATE sqlite_sequence SET seq = 0 WHERE name = 'fbw_favorites'`).run()
          this.db.prepare(`UPDATE sqlite_sequence SET seq = 0 WHERE name = 'fbw_history'`).run()
          this.db
            .prepare(`UPDATE sqlite_sequence SET seq = 0 WHERE name = 'fbw_privacy_space'`)
            .run()
          this.db
            .prepare(`UPDATE sqlite_sequence SET seq = 0 WHERE name = 'fbw_resource_words'`)
            .run()
        } else if (tableName === 'fbw_words') {
          this.db
            .prepare(`UPDATE sqlite_sequence SET seq = 0 WHERE name = 'fbw_resource_words'`)
            .run()
        }

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
