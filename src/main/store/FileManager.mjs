import fs from 'fs'
import { t } from '../../i18n/server.js'

// 添加单例实例变量
let instance = null

export default class FileManager {
  constructor(logger, dbManager, settingManager, fileServer, wordsManager) {
    // 如果实例已存在且参数相同，直接返回该实例
    if (
      instance &&
      instance.dbManager === dbManager &&
      instance.settingManager === settingManager
    ) {
      return instance
    }

    this.logger = logger
    this.dbManager = dbManager
    this.db = dbManager.db
    this.settingManager = settingManager
    this.fileServer = fileServer
    this.wordsManager = wordsManager

    this.resetParams()

    // 预编译SQL语句
    if (this.db) {
      this.preparedStatements = {
        insertResource: this.db.prepare(
          `INSERT OR IGNORE INTO fbw_resources
            (resourceName, fileName, filePath, fileExt, fileSize, quality, width, height, isLandscape, atimeMs, mtimeMs, ctimeMs) VALUES
            (@resourceName, @fileName, @filePath, @fileExt, @fileSize, @quality, @width, @height, @isLandscape, @atimeMs, @mtimeMs, @ctimeMs)`
        ),
        updateResource: this.db.prepare(
          `UPDATE fbw_resources SET
            fileSize = @fileSize,
            quality = @quality,
            width = @width,
            height = @height,
            isLandscape = @isLandscape,
            atimeMs = @atimeMs,
            mtimeMs = @mtimeMs,
            ctimeMs = @ctimeMs
          WHERE resourceName = @resourceName AND filePath = @filePath`
        )
      }
    }

    // 保存实例
    instance = this
  }

  // 使用 settingManager 获取设置
  get settingData() {
    return this.settingManager.settingData
  }

  resetParams() {
    this.params = {
      handleQuality: {
        startPage: 1,
        pageSize: 20
      }
    }
  }

  /**
   * 刷新目录
   * @param {Object} locks - 锁对象
   * @param {boolean} isManual - 是否手动刷新
   */
  refreshDirectory(locks, isManual = false) {
    if (!this.fileServer) {
      this.logger.error('文件服务未初始化')
      return {
        success: false,
        msg: t('messages.fileServerNotInitialized')
      }
    }
    if (locks.refreshDirectory) {
      return {
        success: false,
        msg: t('messages.refreshDirectoryFail')
      }
    }

    const { localResourceFolders, allowedFileExt } = this.settingData
    // FIXME 只处理本地资源
    const resourceName = 'local'
    // 将目录处理成数组，去重，并过滤空路径，再按路径长度降序排列
    const folderPaths = (
      Array.isArray(localResourceFolders) ? [...new Set(localResourceFolders)] : []
    )
      .filter((folderPath) => !!folderPath && fs.existsSync(folderPath))
      .sort((a, b) => b.length - a.length)
    if (!folderPaths.length) {
      return {
        success: false,
        msg: t('messages.refreshDirectoryFailNotSettingFolder')
      }
    }
    if (!allowedFileExt.length) {
      return {
        success: false,
        msg: t('messages.refreshDirectoryFailNotSettingFileExt')
      }
    }

    locks.refreshDirectory = true

    // 获取数据库中已有的文件信息
    try {
      // 查询所有本地资源的文件路径和修改时间
      const query_stmt = this.db.prepare(
        `SELECT id, filePath, mtimeMs FROM fbw_resources WHERE resourceName = ?`
      )
      const existingFiles = query_stmt.all(resourceName)

      // 发送消息到文件服务子进程，包含现有文件信息
      this.fileServer?.postMessage({
        event: 'REFRESH_DIRECTORY',
        isManual,
        allowedFileExt,
        resourceName,
        folderPaths,
        existingFiles, // 传递现有文件信息
        refreshDirStartTime: Date.now()
      })
    } catch (err) {
      this.logger.error(`获取现有文件信息失败: ${err}`)
      locks.refreshDirectory = false
      return {
        success: false,
        msg: t('messages.refreshDirectoryFail')
      }
    }
  }

  /**
   * 处理目录数据
   * @param {Object} data - 目录数据
   * @returns {Object} 处理结果
   */
  processDirectoryData(data) {
    const { list } = data

    const ret = {
      success: true,
      msg: t('messages.refreshDirectorySuccess', {
        insertedCount: 0,
        total: 0
      }),
      data: {
        insertedCount: 0,
        total: 0
      }
    }
    if (Array.isArray(list) && list.length) {
      try {
        // 使用预编译语句
        const insert_stmt =
          this.preparedStatements?.insertResource ||
          this.db.prepare(
            `INSERT OR IGNORE INTO fbw_resources
              (resourceName, fileName, filePath, fileExt, fileSize, quality, width, height, isLandscape, atimeMs, mtimeMs, ctimeMs) VALUES
              (@resourceName, @fileName, @filePath, @fileExt, @fileSize, @quality, @width, @height, @isLandscape, @atimeMs, @mtimeMs, @ctimeMs)`
          )

        // 记录插入成功的数量
        let insertedCount = 0

        const transaction = this.db.transaction((list) => {
          for (let i = 0; i < list.length; i++) {
            const insert_result = insert_stmt.run(list[i])
            if (insert_result.changes) {
              // 记录本次插入成功的数量
              insertedCount += insert_result.changes
            }
          }
        })

        // 尝试执行事务，批量插入资源
        transaction(
          list.map((item) => ({
            resourceName: item.resourceName,
            fileName: item.fileName,
            filePath: item.filePath,
            fileExt: item.fileExt,
            fileSize: item.fileSize,
            quality: item.quality,
            width: item.width,
            height: item.height,
            isLandscape: item.isLandscape,
            atimeMs: item.atimeMs,
            mtimeMs: item.mtimeMs,
            ctimeMs: item.ctimeMs
          }))
        )
        this.logger.info(
          `读取目录文件，批量插入资源事务执行成功: tableName => fbw_resources, list.length => ${list.length}`
        )
        ret.success = true
        ret.msg = t('messages.refreshDirectorySuccess', {
          insertedCount,
          total: list.length
        })
        ret.data = {
          insertedCount,
          total: list.length
        }
      } catch (err) {
        this.logger.error(
          `读取目录文件，批量插入资源事务执行失败: tableName => fbw_resources, error => ${err}`
        )
        ret.success = false
        ret.msg = t('messages.refreshDirectoryFail')
      }
    }
    return ret
  }

  /**
   * 定时处理图片质量
   * @param {Object} locks - 锁对象
   */
  // 优化图片质量处理，使用批处理
  intervalHandleQuality(locks) {
    if (locks.handleQuality) {
      return
    }

    locks.handleQuality = true

    const { startPage, pageSize } = this.params.handleQuality

    // 数据库查询批量大小，设置为 pageSize 的整数倍，提高效率
    const batchSize = pageSize * 2.5

    // 查询未处理质量的图片
    const query_stmt = this.db.prepare(
      `SELECT id, filePath FROM fbw_resources WHERE quality = 'unset' LIMIT ? OFFSET ?`
    )
    const query_result = query_stmt.all(batchSize, (startPage - 1) * pageSize)

    if (Array.isArray(query_result) && query_result.length) {
      // 如果没有更多数据，重置处理质量逻辑参数
      if (query_result.length < batchSize) {
        this.resetParams()
      } else {
        this.params.handleQuality.startPage += 1
      }

      // 将大批量数据分成多个小批次处理，避免子进程负担过重
      const chunks = []
      for (let i = 0; i < query_result.length; i += pageSize) {
        chunks.push(query_result.slice(i, i + pageSize))
      }

      // 逐个处理小批次
      chunks.forEach((chunk, index) => {
        // 延迟发送，避免同时处理太多任务
        setTimeout(() => {
          this.fileServer?.postMessage({
            event: 'HANDLE_IMAGE_QUALITY',
            list: chunk
          })
        }, index * 500) // 每批次间隔500ms
      })
    } else {
      locks.handleQuality = false
      this.resetParams()
    }
  }

  /**
   * 处理图片质量完成
   * @param {Object} data - 处理结果
   * @param {Object} locks - 锁对象
   */
  onHandleImageQualitySuccess(data, locks) {
    const { list } = data

    if (!Array.isArray(list) || !list.length) {
      locks.handleQuality = false
      return
    }

    try {
      // 更新图片质量
      const update_stmt = this.db.prepare(
        `UPDATE fbw_resources SET quality = @quality, width = @width, height = @height, isLandscape = @isLandscape WHERE id = @id`
      )

      const transaction = this.db.transaction(() => {
        for (const item of list) {
          update_stmt.run(item)
        }
      })

      // 执行事务
      transaction()
      this.logger.info(`处理图片质量成功: count => ${list.length}`)
    } catch (err) {
      this.logger.error(`处理图片质量失败: error => ${err}`)
    } finally {
      // 清除锁
      locks.handleQuality = false
    }
  }

  /**
   * 删除文件
   * @param {Object} item - 资源项
   * @returns {Object} 删除结果
   */
  // 优化错误处理，添加重试机制
  async deleteFile(item) {
    let ret = {
      success: false,
      msg: t('messages.operationFail')
    }
    if (!item) {
      return ret
    }

    const id = item.id
    let filePath = item.filePath

    let retryCount = 0
    const maxRetries = 3

    while (retryCount < maxRetries) {
      try {
        if (!filePath) {
          // 查询文件信息
          const query_stmt = this.db.prepare(`SELECT * FROM fbw_resources WHERE id =?`)
          const query_result = query_stmt.get(id)
          if (!query_result) {
            ret.msg = t('messages.resourceNotExist')
            return ret
          }
          filePath = query_result.filePath
        }
        // 删除文件
        if (filePath && fs.existsSync(filePath)) {
          fs.unlinkSync(filePath)
        } else {
          ret.msg = t('messages.fileNotExist')
          return ret
        }

        // 使用事务删除数据库记录
        this.db.exec('BEGIN TRANSACTION')

        // 删除数据库记录
        const delete_stmt = this.db.prepare(`DELETE FROM fbw_resources WHERE id = ?`)
        delete_stmt.run(id)

        // 删除关联记录
        const delete_favorites_stmt = this.db.prepare(
          `DELETE FROM fbw_favorites WHERE resourceId = ?`
        )
        delete_favorites_stmt.run(id)

        const delete_history_stmt = this.db.prepare(`DELETE FROM fbw_history WHERE resourceId = ?`)
        delete_history_stmt.run(id)

        const delete_privacy_stmt = this.db.prepare(
          `DELETE FROM fbw_privacy_space WHERE resourceId = ?`
        )
        delete_privacy_stmt.run(id)

        // 提交事务
        this.db.exec('COMMIT')

        // 处理删除资源的分词
        this.wordsManager?.handleDeletedResource(item)

        ret = {
          success: true,
          msg: t('messages.operationSuccess')
        }
        return ret
      } catch (err) {
        // 回滚事务
        try {
          this.db.exec('ROLLBACK')
        } catch (rollbackErr) {
          // 忽略回滚错误
          this.logger.error(`删除文件失败，回滚事务失败: ${rollbackErr}`)
        }

        retryCount++
        if (retryCount >= maxRetries) {
          this.logger.error(`删除文件失败: ${err}`)
          return ret
        }
        // 等待一段时间后重试
        await new Promise((resolve) => setTimeout(resolve, 100))
      }
    }
    return ret
  }
}
