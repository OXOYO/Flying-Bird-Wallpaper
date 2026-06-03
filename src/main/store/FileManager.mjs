import fs from 'node:fs'
import path from 'node:path'
import axios from 'axios'
import cache from '../cache.mjs'
import { t } from '../../i18n/server.js'
import { transFilePath } from '../utils/file.mjs'
import { purgeResourceRecords, pruneOrphanCollectionItems } from './resourceDeleteCleanup.mjs'

export default class FileManager {
  // 单例实例
  static _instance = null

  // 获取单例实例
  static getInstance(logger, dbManager, settingManager, fileServer, wordsManager) {
    if (!FileManager._instance) {
      FileManager._instance = new FileManager(
        logger,
        dbManager,
        settingManager,
        fileServer,
        wordsManager
      )
    }
    return FileManager._instance
  }

  constructor(logger, dbManager, settingManager, fileServer, wordsManager) {
    // 防止直接实例化
    if (FileManager._instance) {
      return FileManager._instance
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
            (resourceName, fileName, filePath, fileExt, fileType, fileSize, atimeMs, mtimeMs, ctimeMs) VALUES
            (@resourceName, @fileName, @filePath, @fileExt, @fileType, @fileSize, @atimeMs, @mtimeMs, @ctimeMs)`
        )
      }
    }

    FileManager._instance = this
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
        message: t('messages.fileServerNotInitialized')
      }
    }
    if (locks.refreshDirectory) {
      return {
        success: false,
        message: t('messages.refreshDirectoryFail')
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
        message: t('messages.refreshDirectoryFailNotSettingFolder')
      }
    }
    if (!allowedFileExt.length) {
      return {
        success: false,
        message: t('messages.refreshDirectoryFailNotSettingFileExt')
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
      return {
        success: true,
        message: t('messages.operationSuccess')
      }
    } catch (err) {
      this.logger.error(`获取现有文件信息失败: ${err}`)
      locks.refreshDirectory = false
      return {
        success: false,
        message: t('messages.refreshDirectoryFail')
      }
    }
  }

  /**
   * 处理目录数据
   * @param {Object} data - 目录数据
   * @returns {Object} 处理结果
   */
  processDirectoryData(data) {
    const { list, scannedFilePaths, resourceName, scanComplete } = data

    const ret = {
      success: true,
      message: t('messages.refreshDirectorySuccess', {
        insertedCount: 0,
        total: 0
      }),
      data: {
        insertedCount: 0,
        total: 0,
        prunedCount: 0,
        updatedCount: 0
      }
    }

    let prunedCount = 0
    if (Array.isArray(scannedFilePaths) && resourceName && scanComplete !== false) {
      try {
        const scanned = new Set(scannedFilePaths)
        const rows = this.db
          .prepare(`SELECT id, filePath FROM fbw_resources WHERE resourceName = ?`)
          .all(resourceName)
        const removeIds = rows
          .filter((row) => !row.filePath || !scanned.has(row.filePath))
          .map((row) => row.id)
        if (removeIds.length) {
          prunedCount = purgeResourceRecords(this.db, removeIds)
          this.logger.info(
            `刷新目录 prune：移除 ${prunedCount} 条已不在磁盘上的本地资源记录`
          )
        }
      } catch (err) {
        this.logger.error(`刷新目录 prune 失败: ${err}`)
      }
    }
    ret.data.prunedCount = prunedCount
    try {
      pruneOrphanCollectionItems(this.db)
    } catch (err) {
      this.logger.warn(`刷新目录后清理孤儿合集成员失败: ${err}`)
    }

    if (Array.isArray(list) && list.length) {
      try {
        // 使用预编译语句
        const upsert_stmt =
          this.preparedStatements?.upsertResource ||
          this.db.prepare(
            `INSERT INTO fbw_resources
              (resourceName, fileName, filePath, fileExt, fileType, fileSize, atimeMs, mtimeMs, ctimeMs) VALUES
              (@resourceName, @fileName, @filePath, @fileExt, @fileType, @fileSize, @atimeMs, @mtimeMs, @ctimeMs)
             ON CONFLICT(filePath) DO UPDATE SET
              fileName=excluded.fileName,
              fileExt=excluded.fileExt,
              fileType=excluded.fileType,
              fileSize=excluded.fileSize,
              atimeMs=excluded.atimeMs,
              mtimeMs=excluded.mtimeMs,
              ctimeMs=excluded.ctimeMs,
              updated_at=datetime('now', 'localtime')
             WHERE excluded.mtimeMs > fbw_resources.mtimeMs
                OR fbw_resources.fileSize != excluded.fileSize
                OR fbw_resources.fileType != excluded.fileType`
          )

        let insertedCount = 0
        let updatedCount = 0

        const transaction = this.db.transaction((list) => {
          for (let i = 0; i < list.length; i++) {
            const row = list[i]
            const existed = this.db
              .prepare(`SELECT id FROM fbw_resources WHERE filePath = ?`)
              .get(row.filePath)
            const result = upsert_stmt.run(row)
            if (!existed && result.changes > 0) {
              insertedCount += 1
            } else if (existed && result.changes > 0) {
              updatedCount += 1
            }
          }
        })

        // 尝试执行事务，批量插入资源
        transaction(
          list.map((item) => {
            return {
              resourceName: item.resourceName,
              fileName: item.fileName,
              filePath: item.filePath,
              fileExt: item.fileExt,
              fileType: item.fileType || 'image',
              fileSize: item.fileSize,
              atimeMs: item.atimeMs,
              mtimeMs: item.mtimeMs,
              ctimeMs: item.ctimeMs
            }
          })
        )
        this.logger.info(
          `读取目录文件，批量插入资源事务执行成功: tableName => fbw_resources, list.length => ${list.length}`
        )
        ret.success = true
        ret.message = t('messages.refreshDirectorySuccess', {
          insertedCount,
          total: list.length
        })
        ret.data = {
          insertedCount,
          updatedCount,
          total: list.length,
          prunedCount
        }
      } catch (err) {
        this.logger.error(
          `读取目录文件，批量插入资源事务执行失败: tableName => fbw_resources, error => ${err}`
        )
        ret.success = false
        ret.message = t('messages.refreshDirectoryFail')
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
      `SELECT id, filePath FROM fbw_resources WHERE quality = '' LIMIT ? OFFSET ?`
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
        `UPDATE fbw_resources SET quality = @quality, width = @width, height = @height, isLandscape = @isLandscape, qualityScore = @score, dominantColor = @dominantColor, updated_at = datetime('now', 'localtime') WHERE id = @id`
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
   * 处理图片质量失败
   * @param {Object} locks - 锁对象
   */
  onHandleImageQualityFail(locks) {
    locks.handleQuality = false
    this.logger.error(`处理图片质量失败`)
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
      message: t('messages.operationFail')
    }
    if (!item) {
      return ret
    }

    const id = item.id != null ? Number(item.id) : null
    let resourceId = Number.isFinite(id) && id > 0 ? id : null
    let filePath = item.filePath
    let posterPath = item.posterPath || ''

    let retryCount = 0
    const maxRetries = 3

    while (retryCount < maxRetries) {
      try {
        if (resourceId) {
          const query_stmt = this.db.prepare(
            `SELECT filePath, posterPath FROM fbw_resources WHERE id = ?`
          )
          const query_result = query_stmt.get(resourceId)
          if (!query_result) {
            ret.message = t('messages.resourceNotExist')
            return ret
          }
          filePath = filePath || query_result.filePath
          posterPath = posterPath || query_result.posterPath || ''
        } else if (filePath) {
          const query_result = this.db
            .prepare(`SELECT id, filePath, posterPath FROM fbw_resources WHERE filePath = ?`)
            .get(filePath)
          if (query_result) {
            resourceId = query_result.id
            filePath = filePath || query_result.filePath
            posterPath = posterPath || query_result.posterPath || ''
          }
        } else {
          ret.message = t('messages.resourceNotExist')
          return ret
        }
        // 删除主文件
        if (filePath && fs.existsSync(filePath)) {
          fs.unlinkSync(filePath)
          const cacheKeys = cache.keys()
          const newFilePath = transFilePath(filePath)
          for (const key of cacheKeys) {
            if (key.startsWith(`filePath=${newFilePath}`)) {
              cache.delete(key)
              global.logger.info(`删除缓存成功: id => ${resourceId}, cacheKey => ${key}`)
            }
          }
        }
        // 删除视频封面
        if (posterPath && fs.existsSync(posterPath)) {
          fs.unlinkSync(posterPath)
          const cacheKeys = cache.keys()
          const newPosterPath = transFilePath(posterPath)
          for (const key of cacheKeys) {
            if (key.startsWith(`filePath=${newPosterPath}`)) {
              cache.delete(key)
              global.logger.info(`删除封面缓存成功: id => ${resourceId}, cacheKey => ${key}`)
            }
          }
        }

        if (resourceId) {
          this.db.exec('BEGIN TRANSACTION')
          purgeResourceRecords(this.db, [resourceId])
          pruneOrphanCollectionItems(this.db)
          this.db.exec('COMMIT')
        }

        ret = {
          success: true,
          message: t('messages.operationSuccess')
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

  async _downloadUrlToFile(url, destPath) {
    const response = await axios({
      method: 'GET',
      url,
      responseType: 'stream'
    })
    const writer = fs.createWriteStream(destPath)
    response.data.pipe(writer)
    await new Promise((resolve, reject) => {
      writer.on('finish', resolve)
      writer.on('error', reject)
    })
  }

  async _patchResourcePosterIfNeeded(existingRow, item, downloadFolder) {
    if (!existingRow || existingRow.fileType !== 'video') {
      return existingRow
    }
    if (existingRow.posterPath && fs.existsSync(existingRow.posterPath)) {
      return existingRow
    }

    const posterUrl = item?.imageUrl || existingRow.imageUrl
    if (!posterUrl || !/^https?:\/\//i.test(posterUrl)) {
      return existingRow
    }

    const posterPath = path.join(downloadFolder, `${existingRow.fileName}.poster.jpg`)
    if (!fs.existsSync(posterPath)) {
      try {
        await this._downloadUrlToFile(posterUrl, posterPath)
      } catch (err) {
        this.logger.warn(`补下载视频封面失败: ${posterUrl} => ${err}`)
        return existingRow
      }
    }

    this.db
      .prepare(
        `UPDATE fbw_resources SET posterPath = ?, updated_at = datetime('now', 'localtime') WHERE id = ?`
      )
      .run(posterPath, existingRow.id)

    return { ...existingRow, posterPath }
  }

  _getResourceByFilePath(filePath) {
    if (!filePath) return null
    return this.db.prepare(`SELECT * FROM fbw_resources WHERE filePath = ?`).get(filePath)
  }

  // 下载文件
  async downloadFile(item) {
    if (!item) {
      return {
        success: false,
        message: t('messages.paramsError')
      }
    }
    if (item.srcType === 'url' && (item.imageUrl || item.videoUrl)) {
      // 下载壁纸或视频
      const { downloadFolder } = this.settingData
      if (!downloadFolder || !fs.existsSync(downloadFolder)) {
        return {
          success: false,
          message: t('messages.downloadFolderNotExistOrNotSet')
        }
      }

      // 判断是图片还是视频
      const isVideo = item.fileType === 'video'
      const downloadUrl = isVideo ? item.videoUrl : item.imageUrl
      const posterUrl = item.imageUrl // 视频的封面图片

      // 生成文件名
      const fileName = `${item.fileName}.${item.fileExt}`
      const filePath = path.join(downloadFolder, fileName)
      let posterPath = ''

      if (fs.existsSync(filePath)) {
        this.logger.warn(`文件 ${filePath} 已存在，跳过写入`)
        const existingRow = this._getResourceByFilePath(filePath)
        if (existingRow) {
          const patched = await this._patchResourcePosterIfNeeded(existingRow, item, downloadFolder)
          return {
            success: true,
            message: t('messages.downloadFileExist'),
            data: patched
          }
        }
      } else {
        await this._downloadUrlToFile(downloadUrl, filePath)
      }

      if (isVideo && posterUrl && /^https?:\/\//i.test(posterUrl)) {
        posterPath = path.join(downloadFolder, `${item.fileName}.poster.jpg`)
        if (fs.existsSync(posterPath)) {
          this.logger.warn(`封面 ${posterPath} 已存在，跳过写入`)
        } else {
          try {
            await this._downloadUrlToFile(posterUrl, posterPath)
          } catch (err) {
            this.logger.warn(`下载视频封面失败: ${posterUrl} => ${err}`)
            posterPath = ''
          }
        }
      }

      // 获取文件信息
      const stats = fs.statSync(filePath)

      // 插入到数据库
      try {
        const insert_stmt = this.db.prepare(
          `INSERT INTO fbw_resources
                (resourceName, fileName, filePath, fileExt, fileType, fileSize, imageUrl, videoUrl, posterPath, author, link, title, desc, quality, width, height, isLandscape, atimeMs, mtimeMs, ctimeMs) VALUES
                (@resourceName, @fileName, @filePath, @fileExt, @fileType, @fileSize, @imageUrl, @videoUrl, @posterPath, @author, @link, @title, @desc, @quality, @width, @height, @isLandscape, @atimeMs, @mtimeMs, @ctimeMs)`
        )
        const insert_result = insert_stmt.run({
          resourceName: item.resourceName,
          fileName: item.fileName,
          filePath: filePath,
          fileExt: item.fileExt,
          fileType: item.fileType || 'image',
          fileSize: stats.size,
          imageUrl: posterUrl || '',
          videoUrl: isVideo ? downloadUrl : '',
          posterPath,
          author: item.author || '',
          link: item.link || '',
          title: item.title || '',
          desc: item.desc || '',
          quality: item.quality || '',
          width: item.width || 0,
          height: item.height || 0,
          isLandscape: item.isLandscape,
          atimeMs: stats.atimeMs,
          mtimeMs: stats.mtimeMs,
          ctimeMs: stats.ctimeMs
        })

        if (insert_result.changes > 0) {
          // 查询插入的记录
          const query_stmt = this.db.prepare(`SELECT * FROM fbw_resources WHERE id = ?`)
          const query_result = query_stmt.get(insert_result.lastInsertRowid)

          if (query_result) {
            return {
              success: true,
              message: t('messages.downloadFileSuccess'),
              data: query_result
            }
          }
        }
      } catch (err) {
        // 处理唯一键冲突
        if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
          this.logger.info(`文件路径已存在，尝试查询现有记录: ${filePath}`)
          // 查询已存在的记录
          const query_stmt = this.db.prepare(`SELECT * FROM fbw_resources WHERE filePath = ?`)
          const query_result = query_stmt.get(filePath)

          if (query_result) {
            const patched = await this._patchResourcePosterIfNeeded(
              query_result,
              item,
              downloadFolder
            )
            return {
              success: true,
              message: t('messages.downloadFileExist'),
              data: patched
            }
          }
        } else {
          // 非唯一键约束的错误
          this.logger.error(`下载文件失败: error => ${err}`)
          return {
            success: false,
            message: t('messages.downloadFileFail')
          }
        }
      }
    }

    return {
      success: false,
      message: t('messages.downloadFileFail')
    }
  }
}
