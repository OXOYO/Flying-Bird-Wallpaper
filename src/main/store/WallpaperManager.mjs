import fs from 'node:fs'
import path from 'node:path'
import { setWallpaper } from 'wallpaper'
import axios from 'axios'
import { t } from '../../i18n/server.js'
import { isMac, handleTimeByUnit, createSolidColorBMP } from '../utils/utils.mjs'

export default class WallpaperManager {
  // 单例实例
  static _instance = null

  // 获取单例实例
  static getInstance(logger, dbManager, settingManager, fileManager, apiManager) {
    if (!WallpaperManager._instance) {
      WallpaperManager._instance = new WallpaperManager(
        logger,
        dbManager,
        settingManager,
        fileManager,
        apiManager
      )
    }
    return WallpaperManager._instance
  }

  constructor(logger, dbManager, settingManager, fileManager, apiManager) {
    // 防止直接实例化
    if (WallpaperManager._instance) {
      return WallpaperManager._instance
    }

    this.logger = logger
    this.dbManager = dbManager
    this.db = dbManager.db
    this.settingManager = settingManager
    this.fileManager = fileManager
    this.apiManager = apiManager

    // 重置参数
    this.resetSwitchParams()
    this.resetDownloadParams()

    WallpaperManager._instance = this
  }

  // 使用 settingManager 获取设置
  get settingData() {
    return this.settingManager.settingData
  }

  resetSwitchParams() {
    this.switchParams = {
      // 切换上一个壁纸时，默认索引为0
      index: 0,
      count: 0
    }
  }

  async resetDownloadParams() {
    const settingData = this.settingData
    const downloadParams = {
      downloadSources: settingData.downloadSources,
      downloadKeywords: settingData.downloadKeywords,
      downloadOrientation: settingData.downloadOrientation,
      // 记录下载的页数，用于顺序下载时查找索引
      startPage: 1,
      pageSize: 10,
      // 添加当前下载源索引
      currentSourceIndex: 0,
      // 任务是否已完成
      isTaskCompleted: false
    }
    try {
      const storeData = await this.getDownloadParams()
      // 判断存储的下载参数中的下载源、关键词、方向是否与当前设置一致，一致则使用存储的参数实现接续下载
      if (
        storeData &&
        storeData.downloadSources.toString() === settingData.downloadSources.toString() &&
        storeData.downloadKeywords === settingData.downloadKeywords &&
        storeData.downloadOrientation.toString() === settingData.downloadOrientation.toString()
      ) {
        downloadParams.startPage = storeData.startPage
        downloadParams.pageSize = storeData.pageSize
        downloadParams.currentSourceIndex = storeData.currentSourceIndex
        downloadParams.isTaskCompleted = storeData.isTaskCompleted
      }
    } catch (err) {
      this.logger.error(`加载下载参数失败: ${err}`)
    }

    this.downloadParams = downloadParams
  }

  async getDownloadParams() {
    try {
      const res = await this.dbManager.getSysRecord('downloadParams')
      if (res.success && res.data?.storeData) {
        return res.data.storeData
      }
      return null
    } catch (err) {
      this.logger.error(`加载下载参数失败: ${err}`)
      return null
    }
  }
  // 保存下载参数到数据库
  async saveDownloadParams() {
    try {
      if (this.downloadParams) {
        await this.dbManager.setSysRecord('downloadParams', this.downloadParams, 'object')
        return true
      }
      return false
    } catch (err) {
      this.logger.error(`保存下载参数失败: ${err}`)
      return false
    }
  }

  // 执行切换壁纸
  async doSwitchToNextWallpaper() {
    const {
      wallpaperResource = 'resources',
      filterKeywords,
      orientation,
      quality,
      switchType,
      sortField = 'created_at',
      sortType = -1
    } = this.settingData
    const isResources = wallpaperResource === 'resources'
    const isFavorites = wallpaperResource === 'favorites'

    // 获取最近使用的壁纸ID列表
    const recent_stmt = this.db.prepare(
      `SELECT resourceId FROM fbw_history ORDER BY created_at DESC LIMIT 10`
    )
    const recent_results = recent_stmt.all()
    const recentIds = recent_results.map((item) => item.resourceId)
    const prevSourceId = recentIds[0]

    const query_where = []
    let query_where_str = ''
    let query_params = []
    let query_sql = ''
    let query_stmt

    if (!isFavorites && !isResources) {
      query_where.push(`resourceName = ?`)
      query_params.push(wallpaperResource)
    }

    if (orientation.length === 1) {
      query_where.push(`isLandscape = ?`)
      query_params.push(orientation[0])
    }

    if (filterKeywords) {
      const keywords = `%${filterKeywords}%`
      query_where.push(`(filePath LIKE ? OR title LIKE ? OR desc LIKE ?)`)
      query_params.push(keywords, keywords, keywords)
    }
    if (quality.length) {
      const placeholders = quality.map(() => '?').join(',')
      query_where.push(`quality IN (${placeholders})`)
      query_params.push(...quality)
    }

    if (query_where.length) {
      query_where_str = `WHERE ${query_where.join(' AND ')}`
    }

    // 随机切换
    if (switchType === 1) {
      // 处理收藏夹查询
      if (isFavorites) {
        // 如果有最近使用记录，尝试排除这些记录
        if (recentIds.length > 0) {
          // 先检查排除最近记录后是否还有壁纸可用
          const check_stmt = this.db.prepare(
            `SELECT COUNT(*) AS count
            FROM fbw_resources r
            JOIN fbw_favorites f ON r.id = f.resourceId
            ${query_where_str ? query_where_str + ' AND' : 'WHERE'}
            NOT EXISTS (SELECT 1 FROM fbw_privacy_space p WHERE p.resourceId = r.id) AND
            r.id NOT IN (${recentIds.map(() => '?').join(',')})`
          )
          const check_params = [...query_params, ...recentIds]
          const check_result = check_stmt.get(...check_params)

          // 如果排除后还有壁纸，则从未使用的壁纸中随机选择
          if (check_result && check_result.count > 0) {
            query_sql = `
              SELECT r.*
              FROM fbw_resources r
              JOIN fbw_favorites f ON r.id = f.resourceId
              ${query_where_str ? query_where_str + ' AND' : 'WHERE'}
              NOT EXISTS (SELECT 1 FROM fbw_privacy_space p WHERE p.resourceId = r.id) AND
              r.id NOT IN (${recentIds.map(() => '?').join(',')})
              ORDER BY RANDOM() LIMIT 1
            `
            query_params.push(...recentIds)
          } else {
            // 如果排除后没有壁纸了，则从所有符合条件的壁纸中随机选择
            query_sql = `
              SELECT r.*
              FROM fbw_resources r
              JOIN fbw_favorites f ON r.id = f.resourceId
              ${query_where_str ? query_where_str + ' AND' : 'WHERE'}
              NOT EXISTS (SELECT 1 FROM fbw_privacy_space p WHERE p.resourceId = r.id)
              ORDER BY RANDOM() LIMIT 1
            `
          }
        } else {
          // 没有历史记录，直接随机选择
          query_sql = `
            SELECT r.*
            FROM fbw_resources r
            JOIN fbw_favorites f ON r.id = f.resourceId
            ${query_where_str ? query_where_str + ' AND' : 'WHERE'}
            NOT EXISTS (SELECT 1 FROM fbw_privacy_space p WHERE p.resourceId = r.id)
            ORDER BY RANDOM() LIMIT 1
          `
        }
      } else {
        // 如果有最近使用记录，尝试排除这些记录
        if (recentIds.length > 0) {
          // 先检查排除最近记录后是否还有壁纸可用
          const check_stmt = this.db.prepare(
            `SELECT COUNT(*) AS count
            FROM fbw_resources
            ${query_where_str ? query_where_str + ' AND' : 'WHERE'}
            id NOT IN (${recentIds.map(() => '?').join(',')})`
          )
          const check_params = [...query_params, ...recentIds]
          const check_result = check_stmt.get(...check_params)

          // 如果排除后还有壁纸，则从未使用的壁纸中随机选择
          if (check_result && check_result.count > 0) {
            query_sql = `
              SELECT * FROM fbw_resources
              ${query_where_str ? query_where_str + ' AND' : 'WHERE'}
              id NOT IN (${recentIds.map(() => '?').join(',')})
              ORDER BY RANDOM() LIMIT 1
            `
            query_params.push(...recentIds)
          } else {
            // 如果排除后没有壁纸了，则从所有符合条件的壁纸中随机选择
            query_sql = `SELECT * FROM fbw_resources ${query_where_str} ORDER BY RANDOM() LIMIT 1`
          }
        } else {
          // 没有历史记录，直接随机选择
          query_sql = `SELECT * FROM fbw_resources ${query_where_str} ORDER BY RANDOM() LIMIT 1`
        }
      }
      // 顺序切换
    } else {
      // 处理收藏夹查询
      if (isFavorites) {
        // 如果有上一次切换的ID，则从该ID之后开始查询
        if (prevSourceId) {
          // 修改为使用收藏表的created_at字段作为排序依据
          const favSortField = 'created_at' // 使用收藏表的创建时间
          // 直接查询上一个壁纸在收藏表中的创建时间
          const index_stmt = this.db.prepare(
            `SELECT f.${favSortField}
              FROM fbw_favorites f
              WHERE f.resourceId = ?`
          )
          const index_result = index_stmt.get(prevSourceId)

          if (index_result && index_result[favSortField] !== undefined) {
            // 检查是否有符合条件的下一个壁纸
            const check_stmt = this.db.prepare(
              `SELECT COUNT(*) AS count
                FROM fbw_resources r
                JOIN fbw_favorites f ON r.id = f.resourceId
                ${query_where_str ? query_where_str + ' AND' : 'WHERE'}
                NOT EXISTS (SELECT 1 FROM fbw_privacy_space p WHERE p.resourceId = r.id) AND
                f.${favSortField} ${sortType === -1 ? '<=' : '>='} ?`
            )
            const check_params = [...query_params, index_result[favSortField]]
            const check_result = check_stmt.get(...check_params)

            // 如果有符合条件的下一个壁纸，则查询下一个壁纸
            if (check_result && check_result.count > 0) {
              // 查询下一个壁纸，按照收藏时间排序
              query_sql = `
                  SELECT r.*
                  FROM fbw_resources r
                  JOIN fbw_favorites f ON r.id = f.resourceId
                  ${query_where_str ? query_where_str + ' AND' : 'WHERE'}
                  NOT EXISTS (SELECT 1 FROM fbw_privacy_space p WHERE p.resourceId = r.id) AND
                  f.${favSortField} ${sortType === -1 ? '<=' : '>='} ?
                  ORDER BY f.${favSortField} ${sortType === -1 ? 'DESC' : 'ASC'}
                  LIMIT 1
                `
              // 与检查语句的参数相同
              query_params = [...check_params]
            } else {
              // 如果没有下一个壁纸，则从头开始
              query_sql = `
                  SELECT r.*
                  FROM fbw_resources r
                  JOIN fbw_favorites f ON r.id = f.resourceId
                  ${query_where_str ? query_where_str + ' AND' : 'WHERE'}
                  NOT EXISTS (SELECT 1 FROM fbw_privacy_space p WHERE p.resourceId = r.id)
                  ORDER BY f.${favSortField} ${sortType === -1 ? 'DESC' : 'ASC'}
                  LIMIT 1
                `
            }
          } else {
            // 如果获取不到上一个壁纸的排序字段值，则从头开始
            query_sql = `
                SELECT r.*
                FROM fbw_resources r
                JOIN fbw_favorites f ON r.id = f.resourceId
                ${query_where_str ? query_where_str + ' AND' : 'WHERE'}
                NOT EXISTS (SELECT 1 FROM fbw_privacy_space p WHERE p.resourceId = r.id)
                ORDER BY f.created_at ${sortType === -1 ? 'DESC' : 'ASC'}
                LIMIT 1
              `
          }
        } else {
          // 没有上一次切换的ID，从头开始，按收藏时间排序
          query_sql = `
            SELECT r.*
            FROM fbw_resources r
            JOIN fbw_favorites f ON r.id = f.resourceId
            ${query_where_str ? query_where_str + ' AND' : 'WHERE'}
            NOT EXISTS (SELECT 1 FROM fbw_privacy_space p WHERE p.resourceId = r.id)
            ORDER BY f.created_at ${sortType === -1 ? 'DESC' : 'ASC'}
            LIMIT 1
          `
        }
      } else {
        // 顺序切换时也排除最近10条历史记录，排序加id，循环切换
        if (prevSourceId) {
          // 获取上一个壁纸的排序字段值
          const index_stmt = this.db.prepare(`SELECT ${sortField} FROM fbw_resources WHERE id = ?`)
          const index_result = index_stmt.get(prevSourceId)
          const sortFieldVal = index_result[sortField]
          if (index_result && sortFieldVal !== undefined) {
            // 排除最近10条历史记录
            const excludeIds =
              recentIds.length > 0 ? `id NOT IN (${recentIds.map(() => '?').join(',')})` : ''
            const excludeParams = recentIds
            // 查找下一个
            const check_stmt = this.db.prepare(
              `SELECT COUNT(*) AS count
              FROM fbw_resources
              ${query_where_str ? query_where_str + ' AND' : 'WHERE'}
              ${excludeIds ? excludeIds + ' AND' : ''}
              (${sortField} ${sortType === -1 ? '<' : '>'} ? OR (${sortField} = ? AND id > ?))`
            )
            const check_params = [
              ...query_params,
              ...excludeParams,
              sortFieldVal,
              sortFieldVal,
              prevSourceId
            ]
            const check_result = check_stmt.get(...check_params)
            if (check_result && check_result.count > 0) {
              // 查找下一个
              query_sql = `
                SELECT *
                FROM fbw_resources
                ${query_where_str ? query_where_str + ' AND' : 'WHERE'}
                ${excludeIds ? excludeIds + ' AND' : ''}
                (${sortField} ${sortType === -1 ? '<' : '>'} ? OR (${sortField} = ? AND id > ?))
                ORDER BY ${sortField} ${sortType === -1 ? 'DESC' : 'ASC'}, id
                LIMIT 1
              `
              query_params = [
                ...query_params,
                ...excludeParams,
                sortFieldVal,
                sortFieldVal,
                prevSourceId
              ]
            } else {
              // 循环到头部，排除最近10条
              query_sql = `
                SELECT *
                FROM fbw_resources
                ${query_where_str ? query_where_str + ' AND' : 'WHERE'}
                ${excludeIds}
                ORDER BY ${sortField} ${sortType === -1 ? 'DESC' : 'ASC'}, id
                LIMIT 1
              `
              query_params = [...query_params, ...excludeParams]
            }
          } else {
            // 如果获取不到上一个壁纸的排序字段值，则从头开始
            query_sql = `
                SELECT *
                FROM fbw_resources
                ${query_where_str ? query_where_str + ' AND' : 'WHERE'}
                ORDER BY ${sortField} ${sortType === -1 ? 'DESC' : 'ASC'}, id
                LIMIT 1
              `
          }
        } else {
          // 没有上一次切换的ID，从头开始
          query_sql = `
            SELECT *
            FROM fbw_resources
            ${query_where_str}
            ORDER BY ${sortField} ${sortType === -1 ? 'DESC' : 'ASC'}, id
            LIMIT 1
          `
        }
      }
    }

    // 执行查询
    if (query_sql) {
      query_stmt = this.db.prepare(query_sql)
      const query_result = query_stmt.get(...query_params)
      if (query_result && query_result.id !== prevSourceId) {
        return await this.setAsWallpaper(query_result, true, true)
      }
    }

    return {
      success: false,
      message: t('messages.operationFail')
    }
  }

  // 切换到上一个壁纸
  async doSwitchToPrevWallpaper() {
    const { index } = this.switchParams
    // 查询历史记录总数
    const count_stmt = this.db.prepare(`SELECT COUNT(*) AS total FROM fbw_history`)
    const count_result = count_stmt.get()
    this.switchParams.count = count_result && count_result.total ? count_result.total : 0

    // 支持循环切换
    if (this.switchParams.count) {
      const nextIndex = index + 1 < this.switchParams.count ? index + 1 : 0
      // 查询历史记录
      const query_stmt = this.db.prepare(
        `SELECT h.id as hid, r.* FROM fbw_history h LEFT JOIN fbw_resources r ON h.resourceId = r.id ORDER BY h.id DESC LIMIT ? OFFSET ?`
      )
      const query_result = query_stmt.get(1, nextIndex)

      if (query_result) {
        // 更新索引
        this.switchParams.index = nextIndex

        return await this.setAsWallpaper(query_result, false, false)
      }
    }
    return {
      success: false,
      message: t('messages.operationFail')
    }
  }

  // 设置为壁纸
  async setAsWallpaper(item, isAddToHistory = false, isResetParams = false) {
    if (!item || !item.filePath || !fs.existsSync(item.filePath)) {
      return {
        success: false,
        message: t('messages.fileNotExist')
      }
    }

    try {
      let res
      // 检查文件类型，如果是视频则设置为动态壁纸
      if (item.fileType === 'video') {
        res = await this.setDynamicWallpaper(item.filePath)
      } else {
        // 关闭视频壁纸
        this.closeDynamicWallpaper()
        // 设置静态壁纸
        res = await this.setImageWallpaper(item.filePath)
      }
      if (!res?.success) {
        return {
          success: false,
          messages: res?.message || t('messages.setWallpaperFail')
        }
      }

      // 记录到历史记录
      if (isAddToHistory) {
        const insert_stmt = this.db.prepare(`INSERT INTO fbw_history (resourceId) VALUES (?)`)
        insert_stmt.run(item.id)
      }

      // 重置参数
      if (isResetParams) {
        this.resetSwitchParams()
      }

      return {
        success: true,
        message: t('messages.setWallpaperSuccess')
      }
    } catch (err) {
      this.logger.error(`设置壁纸失败: error => ${err}`)
      return {
        success: false,
        message: t('messages.setWallpaperFail')
      }
    }
  }

  // 设置图片壁纸
  async setImageWallpaper(imgPath) {
    if (!imgPath || !fs.existsSync(imgPath)) {
      return {
        success: false,
        message: t('messages.fileNotExist')
      }
    }
    try {
      // 设置壁纸
      await setWallpaper(imgPath, {
        screen: this.settingData.allScreen && isMac() ? 'all' : 'main',
        scale: this.settingData.scaleType
      })

      return {
        success: true,
        message: t('messages.setWallpaperSuccess')
      }
    } catch (err) {
      this.logger.error(`设置壁纸失败: error => ${err}`)
      return {
        success: false,
        message: t('messages.setWallpaperFail')
      }
    }
  }

  // 设置颜色壁纸
  async setColorWallpaper(color) {
    if (!color) {
      return {
        success: false,
        message: t('messages.paramsError')
      }
    }
    try {
      const buffer = createSolidColorBMP(color)
      const colorImagePath = path.join(process.env.FBW_TEMP_PATH, 'fbw-color-wallpaper.png')
      fs.writeFileSync(colorImagePath, buffer)
      return await this.setImageWallpaper(colorImagePath)
    } catch (err) {
      this.logger.error(`设置壁纸失败: error => ${err}`)
      return {
        success: false,
        message: t('messages.setWallpaperFail')
      }
    }
  }

  // 设置动态壁纸
  async setDynamicWallpaper(videoPath) {
    if (!videoPath || !fs.existsSync(videoPath)) {
      return {
        success: false,
        message: t('messages.fileNotExist')
      }
    }

    try {
      // 调用动态壁纸设置功能
      const res = await global.FBW.dynamicWallpaperWindow?.setDynamicWallpaper(videoPath)
      if (res?.success) {
        return {
          success: true,
          message: t('messages.setDynamicWallpaperSuccess')
        }
      } else {
        return {
          success: false,
          message: res?.message || t('messages.setDynamicWallpaperFail')
        }
      }
    } catch (err) {
      this.logger.error(`设置动态壁纸失败: error => ${err}`)
      return {
        success: false,
        message: t('messages.setDynamicWallpaperFail')
      }
    }
  }

  // 关闭视频壁纸
  closeDynamicWallpaper() {
    try {
      global.FBW.dynamicWallpaperWindow?.closeDynamicWallpaper()
      // 清理“最后视频地址”
      global.FBW.store?.updateSettingData({
        dynamicLastVideoPath: ''
      })
      return {
        success: true,
        message: t('messages.operationSuccess')
      }
    } catch (err) {
      return {
        success: false,
        message: t('messages.operationFail')
      }
    }
  }

  // 下载并设置为壁纸
  async setAsWallpaperWithDownload(item) {
    if (!item) {
      return {
        success: false,
        message: t('messages.paramsError')
      }
    }

    try {
      // 处理不同的 srcType
      if (item.srcType === 'file' && item.filePath) {
        // 处理本地文件
        const filePath = item.filePath
        const query_stmt = this.db.prepare(`SELECT * FROM fbw_resources WHERE filePath = ?`)
        const query_result = query_stmt.get(filePath)

        if (query_result) {
          return await this.setAsWallpaper(query_result, true, true)
        } else {
          return {
            success: false,
            message: t('messages.fileNotExist')
          }
        }
      } else if (item.srcType === 'url' && (item.imageUrl || item.videoUrl)) {
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

        if (fs.existsSync(filePath)) {
          // 文件已存在，取消写入
          this.logger.warn(`文件 ${filePath} 已存在，跳过写入`)
        } else {
          // 下载文件
          const response = await axios({
            method: 'GET',
            url: downloadUrl,
            responseType: 'stream'
          })

          const writer = fs.createWriteStream(filePath)
          response.data.pipe(writer)

          await new Promise((resolve, reject) => {
            writer.on('finish', resolve)
            writer.on('error', reject)
          })
        }

        // 获取文件信息
        const stats = fs.statSync(filePath)

        // 插入到数据库
        try {
          const insert_stmt = this.db.prepare(
            `INSERT INTO fbw_resources
              (resourceName, fileName, filePath, fileExt, fileType, fileSize, imageUrl, videoUrl, author, link, title, desc, quality, width, height, isLandscape, atimeMs, mtimeMs, ctimeMs) VALUES
              (@resourceName, @fileName, @filePath, @fileExt, @fileType, @fileSize, @imageUrl, @videoUrl, @author, @link, @title, @desc, @quality, @width, @height, @isLandscape, @atimeMs, @mtimeMs, @ctimeMs)`
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
              return await this.setAsWallpaper(query_result, true, true)
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
              return await this.setAsWallpaper(query_result, true, true)
            }
          } else {
            throw err // 重新抛出非唯一键约束的错误
          }
        }
      }
      return {
        success: false,
        message: t('messages.setWallpaperFail')
      }
    } catch (err) {
      this.logger.error(`下载壁纸失败: error => ${err}`)
      return {
        success: false,
        message: t('messages.setWallpaperFail')
      }
    }
  }

  // 搜索并下载壁纸
  async searchWallpaperWithDownload(params) {
    const { resourceName, keywords, orientation, startPage, pageSize } = params
    const { downloadFolder, remoteResourceSecretKeys } = this.settingData

    let ret = {
      success: false,
      message: t('messages.operationFail')
    }

    if (!downloadFolder || !fs.existsSync(downloadFolder)) {
      ret.message = t('messages.downloadFolderNotExistOrNotSet')
      return ret
    }

    // 先获取资源数据
    const resourceMapRes = await this.dbManager.getResourceMap()
    if (!resourceMapRes.success) {
      ret.message = resourceMapRes.message
      return ret
    }
    const resourceMap = resourceMapRes.data

    const resourceInfo = resourceMap.remoteResourceMap[resourceName]
    if (!resourceInfo) {
      ret.message = t('messages.resourceNotFound')
      return ret
    }
    if (resourceInfo.requireSecretKey && !remoteResourceSecretKeys[resourceName]) {
      ret.message = t('messages.resourceSecretKeyUnset')
      return ret
    }
    if (resourceInfo.downloadRequired.keywords && !keywords) {
      ret.message = t('messages.enterKeywords')
      return ret
    }

    try {
      const res = await this.apiManager.call(resourceName, 'search', {
        keywords,
        orientation,
        startPage,
        pageSize,
        secretKey: resourceMap.remoteResourceKeyNames.includes(resourceName)
          ? remoteResourceSecretKeys[resourceName]
          : ''
      })
      if (res) {
        if (res.list.length) {
          const docs = []
          const inserted_ids = []
          const duplicate_filePaths = []
          // 存储到本地
          for (let i = 0; i < res.list.length; i++) {
            const item = res.list[i]
            const filePath = `${downloadFolder}/${item.fileName}.${item.fileExt}`
            try {
              if (fs.existsSync(filePath)) {
                // 文件已存在，取消写入
                this.logger.warn(`文件 ${filePath} 已存在，跳过写入`)
              } else {
                // 方式一：同步写入
                const fileRes = await axios.get(item.imageUrl, { responseType: 'arraybuffer' })
                fs.writeFileSync(filePath, fileRes.data)
              }
              const stats = fs.statSync(filePath)
              docs.push({
                ...item,
                filePath,
                fileSize: stats.size,
                atimeMs: stats.atimeMs,
                mtimeMs: stats.mtimeMs,
                ctimeMs: stats.ctimeMs
              })
            } catch (err) {
              this.logger.error(`searchWallpaperWithDownload writeFileSync ERROR:: ${err}`)
            }
          }
          if (docs.length) {
            try {
              const insert_stmt = this.db.prepare(
                `INSERT OR IGNORE INTO fbw_resources
                 (resourceName, fileName, filePath, fileExt, fileSize, imageUrl, author, link, title, desc, quality, width, height, isLandscape, atimeMs, mtimeMs, ctimeMs) VALUES
                 (@resourceName, @fileName, @filePath, @fileExt, @fileSize, @imageUrl, @author, @link, @title, @desc, @quality, @width, @height, @isLandscape, @atimeMs, @mtimeMs, @ctimeMs)`
              )
              const transaction = this.db.transaction((docs) => {
                for (let i = 0; i < docs.length; i++) {
                  const item = docs[i]
                  try {
                    const insert_result = insert_stmt.run({
                      resourceName: item.resourceName,
                      fileName: item.fileName,
                      filePath: item.filePath,
                      fileExt: item.fileExt,
                      fileSize: item.fileSize,
                      imageUrl: item.imageUrl,
                      author: item.author,
                      link: item.link,
                      title: item.title,
                      desc: item.desc,
                      quality: item.quality,
                      width: item.width,
                      height: item.height,
                      isLandscape: item.isLandscape,
                      atimeMs: item.atimeMs,
                      mtimeMs: item.mtimeMs,
                      ctimeMs: item.ctimeMs
                    })
                    const lastInsertedId = insert_result.lastInsertRowid
                    if (lastInsertedId) {
                      inserted_ids.push(lastInsertedId)
                    }
                  } catch (err) {
                    if (err.message.includes('UNIQUE constraint failed')) {
                      // 处理唯一约束失败错误
                      this.logger.warn(`跳过重复数据: ${item.filePath}`)
                      duplicate_filePaths.push(item.filePath)
                    } else {
                      throw err // 抛出其他类型的错误
                    }
                  }
                }
              })
              transaction(docs)
            } catch (err) {
              this.logger.error(`searchWallpaperWithDownload insert ERROR:: ${err}`)
            }
          }
        }
        ret.success = true
        ret.message = t(res.list.length ? 'messages.querySuccess' : 'messages.queryEmpty')
      }
      return ret
    } catch (err) {
      this.logger.error(`搜索并下载壁纸失败: error => ${err}`)
      return ret
    }
  }

  // 下载壁纸
  async downloadWallpaper(stopDownloadTask) {
    // 每次下载前重置参数
    await this.resetDownloadParams()
    const { downloadFolder, autoDownload } = this.settingData
    const {
      downloadSources,
      downloadKeywords,
      downloadOrientation,
      startPage,
      pageSize,
      currentSourceIndex,
      isTaskCompleted
    } = this.downloadParams

    const isOutSource = currentSourceIndex > downloadSources.length - 1

    if (
      !autoDownload ||
      !downloadSources ||
      !downloadSources.length ||
      !downloadKeywords ||
      !downloadFolder ||
      isTaskCompleted ||
      isOutSource
    ) {
      if (isOutSource) {
        this.logger.info('下载任务已完成')
        this.downloadParams.isTaskCompleted = true
        await this.saveDownloadParams()
      }
      // 条件不满足，停止下载任务
      if (typeof stopDownloadTask === 'function') {
        stopDownloadTask()
      }
      return false
    }

    try {
      // 确保下载目录存在
      if (!fs.existsSync(downloadFolder)) {
        fs.mkdirSync(downloadFolder, { recursive: true })
      }

      // 获取当前要使用的下载源
      // 如果是数组，则按顺序轮流使用每个下载源
      const sourceIndex = (currentSourceIndex || 0) % downloadSources.length
      const currentSource = downloadSources[sourceIndex]

      const res = await this.searchWallpaperWithDownload({
        resourceName: currentSource,
        keywords: downloadKeywords,
        orientation: downloadOrientation,
        startPage,
        pageSize
      })

      // 查询有结果时向下翻页，否则切换到下一个下载源
      if (res.success) {
        this.downloadParams.startPage = startPage + 1
        // 保存参数
        await this.saveDownloadParams()
        return true
      } else {
        // 切换到下一个下载源，并重置页码
        this.downloadParams.currentSourceIndex = (currentSourceIndex + 1) % downloadSources.length
        this.downloadParams.startPage = 1
        // 保存参数
        await this.saveDownloadParams()
        return false
      }
    } catch (err) {
      this.logger.error(`下载壁纸失败: error => ${err}`)
      return false
    }
  }

  // 清理所有下载的壁纸
  async clearDownloadedAll() {
    let ret = {
      success: false,
      message: t('messages.operationFail')
    }
    try {
      // 直接从数据库中查询所有非local的资源
      const query_stmt = this.db.prepare(
        `SELECT * FROM fbw_resources WHERE resourceName != 'local'`
      )
      const query_result = query_stmt.all()

      let allCount = 0
      let successCount = 0
      let failCount = 0

      if (Array.isArray(query_result) && query_result.length) {
        allCount = query_result.length

        for (let i = 0; i < query_result.length; i++) {
          try {
            const item = query_result[i]
            const res = await this.fileManager.deleteFile(item)
            if (res.success) {
              successCount++
            } else {
              failCount++
            }
          } catch (err) {
            this.logger.error(`处理文件时出错: ${err}`)
            failCount++
          }
        }
      }

      this.logger.info(`清理文件完成，共 ${allCount}，成功 ${successCount}，失败 ${failCount}！`)
      ret.success = true
      ret.message = t('messages.clearDownloadedDone', {
        allCount,
        successCount,
        failCount
      })
    } catch (err) {
      this.logger.error(`清理文件失败: ${err}`)
    }
    return ret
  }

  // 清理过期下载的壁纸
  async clearDownloadedExpired() {
    let ret = {
      success: false,
      message: t('messages.operationFail')
    }
    try {
      // 获取过期时间
      const { clearDownloadedExpiredTime, clearDownloadedExpiredUnit } = this.settingData
      const expiredTimeMs = handleTimeByUnit(clearDownloadedExpiredTime, clearDownloadedExpiredUnit)
      const expiredTimestamp = Date.now() - expiredTimeMs
      // 将时间戳转换为 SQLite 日期时间格式
      const expiredDate = new Date(expiredTimestamp).toISOString()

      // 直接从数据库中查询过期的非local资源
      const query_stmt = this.db.prepare(
        `SELECT * FROM fbw_resources WHERE resourceName != 'local' AND created_at < ?`
      )
      const query_result = query_stmt.all(expiredDate)

      let allCount = 0
      let successCount = 0
      let failCount = 0

      if (Array.isArray(query_result) && query_result.length) {
        allCount = query_result.length

        for (let i = 0; i < query_result.length; i++) {
          try {
            const item = query_result[i]
            const res = await this.fileManager.deleteFile(item)
            if (res.success) {
              successCount++
            } else {
              failCount++
            }
          } catch (err) {
            this.logger.error(`处理文件时出错: ${err}`)
            failCount++
          }
        }
      }

      this.logger.info(
        `清理过期文件完成，共 ${allCount}，成功 ${successCount}，失败 ${failCount}！`
      )
      ret.success = true
      ret.message = t('messages.clearDownloadedDone', {
        allCount,
        successCount,
        failCount
      })
    } catch (err) {
      this.logger.error(`清理过期文件失败: ${err}`)
    }
    return ret
  }
}
