import { v4 as uuidv4 } from 'uuid'
import { t } from '../../i18n/server.js'

export default class ResourcesManager {
  // 单例实例
  static _instance = null

  // 获取单例实例
  static getInstance(logger, dbManager, settingManager, apiManager) {
    if (!ResourcesManager._instance) {
      ResourcesManager._instance = new ResourcesManager(
        logger,
        dbManager,
        settingManager,
        apiManager
      )
    }
    return ResourcesManager._instance
  }

  constructor(logger, dbManager, settingManager, apiManager) {
    // 防止直接实例化
    if (ResourcesManager._instance) {
      return ResourcesManager._instance
    }

    this.logger = logger
    this.dbManager = dbManager
    this.db = dbManager.db
    this.settingManager = settingManager
    this.apiManager = apiManager

    ResourcesManager._instance = this
  }

  // 使用 settingManager 获取设置
  get settingData() {
    return this.settingManager.settingData
  }

  // 搜索
  async searchImages(params = {}) {
    const {
      resourceType = 'localResource',
      resourceName = 'resources',
      filterKeywords,
      quality: qualityStr,
      orientation: orientationStr,
      startPage,
      pageSize,
      isRandom = false,
      sortField = 'created_at',
      sortType = -1
    } = params

    let ret = {
      success: false,
      message: t('messages.operationFail'),
      data: {
        list: [],
        total: 0,
        startPage,
        pageSize
      }
    }

    try {
      const { remoteResourceSecretKeys } = this.settingData

      const sortOrder = sortType > 0 ? 'ASC' : 'DESC'
      const orientation = orientationStr ? orientationStr.split(',') : []

      if (resourceType === 'localResource') {
        const isResources = resourceName === 'resources'
        const isFavorites = resourceName === 'favorites'
        const isPrivacySpace = resourceName === 'privacy_space'
        const isHistory = resourceName === 'history'

        const keywords = `%${filterKeywords}%`
        const quality = qualityStr ? qualityStr.split(',') : []

        let query_where_str = ''
        const query_where = []
        const query_params = []
        let query_sql
        let count_sql

        // 非历史记录、非隐私空间需排除隐私表中的数据
        if (!(isHistory || isPrivacySpace)) {
          // 添加 NOT EXISTS 条件排除隐私表中的数据
          query_where.push(
            'NOT EXISTS (SELECT 1 FROM fbw_privacy_space p WHERE p.resourceId = r.id)'
          )
        }

        // 筛选资源类型
        if (!isResources && !isFavorites && !isHistory && !isPrivacySpace) {
          query_where.push(`r.resourceName = ?`)
          query_params.push(resourceName)
        }

        if (filterKeywords) {
          query_where.push(`(r.filePath LIKE ? OR r.title LIKE ? OR r.desc LIKE ?)`)
          query_params.push(keywords, keywords, keywords)
        }

        if (orientation.length === 1) {
          query_where.push(`r.isLandscape = ?`)
          query_params.push(orientation[0])
        }

        if (quality.length) {
          const placeholders = quality.map(() => '?').join(',')
          query_where.push(`r.quality IN (${placeholders})`)
          query_params.push(...quality)
        }

        if (query_where.length) {
          query_where_str = `WHERE ${query_where.join(' AND ')}`
        }

        if (isFavorites || isHistory || isPrivacySpace) {
          // FIXME 按顺序查询时排序字段固定
          const order_by_str = isRandom ? 'ORDER BY RANDOM()' : `ORDER BY s.created_at ${sortOrder}`

          query_sql = `
            SELECT
            r.*,
              (SELECT COUNT(*) FROM fbw_favorites f WHERE f.resourceId = r.id) AS isFavorite
            FROM fbw_${resourceName} s
            JOIN fbw_resources r ON s.resourceId = r.id
            ${query_where_str}
            ${order_by_str}
            LIMIT ? OFFSET ?
          `
          count_sql = `SELECT COUNT(*) AS total FROM fbw_${resourceName} s JOIN fbw_resources r ON s.resourceId = r.id ${query_where_str}`
        } else {
          const order_by_str = isRandom
            ? 'ORDER BY RANDOM()'
            : `ORDER BY r.${sortField} ${sortOrder}`

          query_sql = `
            SELECT
            r.*,
            (SELECT COUNT(*) FROM fbw_favorites f WHERE f.resourceId = r.id) AS isFavorite
            FROM fbw_resources r
            ${query_where_str}
            ${order_by_str}
            LIMIT ? OFFSET ?
          `
          count_sql = `SELECT COUNT(*) AS total FROM fbw_resources r ${query_where_str}`
        }

        const query_stmt = this.db.prepare(query_sql)
        const query_result = query_stmt.all(...query_params, pageSize, (startPage - 1) * pageSize)
        if (Array.isArray(query_result) && query_result.length) {
          ret.data.list = query_result.map((item) => {
            return {
              ...item,
              srcType: 'file',
              uniqueKey: uuidv4()
            }
          })
          if (count_sql) {
            const count_stmt = this.db.prepare(count_sql)
            const count_result = count_stmt.get(...query_params)
            if (count_result && count_result.total) {
              ret.data.total = count_result.total
            }
          }
        }
        ret.success = true
        ret.message = t(ret.data.list.length ? 'messages.querySuccess' : 'messages.queryEmpty')
      } else {
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
        if (resourceInfo.searchRequired.keywords && !filterKeywords) {
          ret.message = t('messages.enterKeywords')
          return ret
        }
        const res = await this.apiManager.call(resourceName, 'search', {
          keywords: filterKeywords,
          orientation,
          startPage: startPage,
          pageSize,
          secretKey: resourceMap.remoteResourceKeyNames.includes(resourceName)
            ? remoteResourceSecretKeys[resourceName]
            : ''
        })
        if (res) {
          if (Array.isArray(res.list) && res.list.length) {
            ret.data.total = res.total
            ret.data.list = res.list.map((item) => {
              return {
                ...item,
                srcType: 'url',
                uniqueKey: uuidv4()
              }
            })
          }
          ret.success = true
          ret.message = t(ret.data.list.length ? 'messages.querySuccess' : 'messages.queryEmpty')
        }
      }
    } catch (err) {
      this.logger.error(`搜索失败: error => ${err}`)
    }

    return ret
  }

  /**
   * 检查资源是否已收藏
   * @param {number|string} resourceId - 资源ID
   * @param {boolean} isPrivacySpace - 是否为隐私空间
   * @returns {boolean} - 是否已收藏
   */
  async checkFavorite(resourceId, isPrivacySpace = false) {
    try {
      const tableName = isPrivacySpace ? 'fbw_privacy_space' : 'fbw_favorites'
      const query_stmt = this.db.prepare(`SELECT * FROM ${tableName} WHERE resourceId = ?`)
      const result = query_stmt.get(resourceId)
      return !!result
    } catch (err) {
      this.logger.error(`检查收藏状态失败: ${err}`)
      return false
    }
  }

  // 加入收藏夹
  async addToFavorites(resourceId, isPrivacySpace = false) {
    let ret = {
      success: false,
      message: t('messages.operationFail')
    }

    try {
      if (isPrivacySpace) {
        const insert_stmt = this.db.prepare(
          `INSERT OR IGNORE INTO fbw_privacy_space (resourceId) VALUES (?)`
        )
        const insert_result = insert_stmt.run(resourceId)

        if (insert_result.changes > 0) {
          ret = {
            success: true,
            message: t('messages.operationSuccess')
          }
        }
      } else {
        // 检查资源是否已收藏，如果已收藏则num+1, 未收藏则插入
        const check_stmt = this.db.prepare(`SELECT * FROM fbw_favorites WHERE resourceId =?`)
        const check_result = check_stmt.get(resourceId)
        if (check_result) {
          // 更新收藏数量
          const update_stmt = this.db.prepare(
            `UPDATE fbw_favorites SET num = num + 1 WHERE resourceId =?`
          )
          const update_result = update_stmt.run(resourceId)
          if (update_result.changes > 0) {
            ret = {
              success: true,
              message: t('messages.operationSuccess')
            }
          }
        } else {
          const insert_stmt = this.db.prepare(
            `INSERT INTO fbw_favorites (resourceId, num) VALUES (?, 1)`
          )
          const insert_result = insert_stmt.run(resourceId)
          if (insert_result.changes > 0) {
            ret = {
              success: true,
              message: t('messages.operationSuccess')
            }
          }
        }
      }
    } catch (err) {
      this.logger.error(`加入收藏夹失败: ${err}`)
    }

    return ret
  }

  // 更新收藏数量
  async updateFavoriteCount(resourceId, count) {
    let ret = {
      success: false,
      message: t('messages.operationFail')
    }
    try {
      if (!resourceId || count === undefined || count <= 0) {
        ret.message = t('messages.paramsError')
        return ret
      }
      // 当没有资源时插入，当有资源时num加count
      const check_stmt = this.db.prepare(`SELECT * FROM fbw_favorites WHERE resourceId =?`)
      const check_result = check_stmt.get(resourceId)
      if (!check_result) {
        const insert_stmt = this.db.prepare(
          `INSERT INTO fbw_favorites (resourceId, num) VALUES (?, ?)`
        )
        const insert_result = insert_stmt.run(resourceId, count)
        if (insert_result.changes > 0) {
          ret = {
            success: true,
            message: t('messages.operationSuccess')
          }
          return ret
        }
      } else {
        count += check_result.num
        if (count <= 0) {
          return ret
        }
        // 更新收藏数量
        const update_stmt = this.db.prepare(`UPDATE fbw_favorites SET num =? WHERE resourceId =?`)
        const update_result = update_stmt.run(count, resourceId)
        if (update_result.changes > 0) {
          ret = {
            success: true,
            message: t('messages.operationSuccess')
          }
        }
      }
    } catch (err) {
      this.logger.error(`更新收藏数量失败: ${err}`)
    }
    return ret
  }

  // 移出收藏夹
  async removeFavorites(resourceId, isPrivacySpace = false) {
    let ret = {
      success: false,
      message: t('messages.operationFail')
    }

    try {
      const tableName = isPrivacySpace ? 'fbw_privacy_space' : 'fbw_favorites'
      const delete_stmt = this.db.prepare(`DELETE FROM ${tableName} WHERE resourceId = ?`)
      const delete_result = delete_stmt.run(resourceId)

      if (delete_result.changes > 0) {
        ret = {
          success: true,
          message: t('messages.operationSuccess')
        }
      }
    } catch (err) {
      this.logger.error(`移出收藏夹失败: ${err}`)
    }

    return ret
  }
}
