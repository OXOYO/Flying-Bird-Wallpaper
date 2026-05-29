import { v4 as uuidv4 } from 'uuid'
import { t } from '../../i18n/server.js'
import {
  API_ERROR_CODE,
  resolveRemoteSecretKey,
  applyCodedErrorToResult
} from '../../common/utils.js'

/** 列表去重/分页用稳定键（勿每次请求生成 uuid） */
const buildStableResourceUniqueKey = (item) => {
  if (item?.id != null && item.id !== '') return String(item.id)
  if (item?.fileName) return String(item.fileName)
  if (item?.filePath) return String(item.filePath)
  const url = item?.imageUrl || item?.videoUrl || ''
  if (url) return url
  return uuidv4()
}

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
  async search(params = {}) {
    const {
      resourceType = 'localResource',
      resourceName = 'resources',
      filterKeywords,
      filterType,
      quality: qualityStr,
      orientation: orientationStr,
      startPage,
      pageSize,
      isRandom = false,
      sortField = 'created_at',
      sortType = -1,
      scoreMin,
      scoreMax,
      tags,
      tagsMode = 'any',
      hideUnsafe = false,
      resourceIds
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
        const fileType = filterType === 'videos' ? 'video' : 'image'
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

        if (quality.length) {
          const placeholders = quality.map(() => '?').join(',')
          query_where.push(`r.quality IN (${placeholders})`)
          query_params.push(...quality)
        }

        if (scoreMin != null && scoreMin !== '') {
          query_where.push(`r.score >= ?`)
          query_params.push(Number(scoreMin))
        }
        if (scoreMax != null && scoreMax !== '') {
          query_where.push(`r.score <= ?`)
          query_params.push(Number(scoreMax))
        }
        if (hideUnsafe) {
          query_where.push(`(r.nsfwLevel IS NULL OR r.nsfwLevel <= 1)`)
        }
        if (Array.isArray(resourceIds) && resourceIds.length) {
          const ph = resourceIds.map(() => '?').join(',')
          query_where.push(`r.id IN (${ph})`)
          query_params.push(...resourceIds)
        }
        if (Array.isArray(tags) && tags.length) {
          const ph = tags.map(() => '?').join(',')
          if (tagsMode === 'all') {
            tags.forEach((tag) => {
              query_where.push(`EXISTS (
                SELECT 1 FROM fbw_resource_words rw
                JOIN fbw_words w ON w.id = rw.wordId
                WHERE rw.resourceId = r.id AND w.word = ?
              )`)
              query_params.push(tag)
            })
          } else {
            query_where.push(`EXISTS (
              SELECT 1 FROM fbw_resource_words rw
              JOIN fbw_words w ON w.id = rw.wordId
              WHERE rw.resourceId = r.id AND w.word IN (${ph})
            )`)
            query_params.push(...tags)
          }
        }

        if (filterKeywords) {
          query_where.push(
            `(r.filePath LIKE ? OR r.title LIKE ? OR r.desc LIKE ? OR r.summary LIKE ? OR EXISTS (
              SELECT 1 FROM fbw_resource_words rw
              JOIN fbw_words w ON w.id = rw.wordId
              WHERE rw.resourceId = r.id AND w.word LIKE ?
            ))`
          )
          query_params.push(keywords, keywords, keywords, keywords, keywords)
        }

        if (orientation.length === 1) {
          query_where.push(`r.isLandscape = ?`)
          query_params.push(orientation[0])
        }

        if (fileType) {
          query_where.push(`r.fileType = ?`)
          query_params.push(fileType)
        }

        if (query_where.length) {
          query_where_str = `WHERE ${query_where.join(' AND ')}`
        }

        if (isFavorites || isHistory || isPrivacySpace) {
          // 统计字段走 stats；资源字段（score、title 等）走 r；s 仅为关联表，无 score 等列
          const statsFields = ['views', 'downloads', 'favorites', 'wallpapers']
          const sortFieldForOrder = statsFields.includes(sortField)
            ? `stats.${sortField}`
            : `r.${sortField}`
          const order_by_str = isRandom
            ? `ORDER BY RANDOM(), ${sortFieldForOrder} ${sortOrder}`
            : `ORDER BY ${sortFieldForOrder} ${sortOrder}`

          query_sql = `
            SELECT
            r.*,
            stats.views,
            stats.downloads,
            stats.favorites,
            stats.wallpapers,
              (SELECT COUNT(*) FROM fbw_favorites f WHERE f.resourceId = r.id) AS isFavorite
            FROM fbw_${resourceName} s
            JOIN fbw_resources r ON s.resourceId = r.id
            LEFT JOIN fbw_statistics stats ON r.id = stats.resourceId
            ${query_where_str}
            ${order_by_str}
            LIMIT ? OFFSET ?
          `
          count_sql = `SELECT COUNT(*) AS total FROM fbw_${resourceName} s JOIN fbw_resources r ON s.resourceId = r.id ${query_where_str}`
        } else {
          // 处理排序字段，统计字段需要从stats表中获取
          const statsFields = ['views', 'downloads', 'favorites', 'wallpapers']
          const sortFieldForOrder = statsFields.includes(sortField)
            ? `stats.${sortField}`
            : `r.${sortField}`
          const order_by_str = isRandom
            ? `ORDER BY RANDOM(), ${sortFieldForOrder} ${sortOrder}`
            : `ORDER BY ${sortFieldForOrder} ${sortOrder}`

          query_sql = `
            SELECT
            r.*,
            stats.views,
            stats.downloads,
            stats.favorites,
            stats.wallpapers,
            (SELECT COUNT(*) FROM fbw_favorites f WHERE f.resourceId = r.id) AS isFavorite
            FROM fbw_resources r
            LEFT JOIN fbw_statistics stats ON r.id = stats.resourceId
            ${query_where_str}
            ${order_by_str}
            LIMIT ? OFFSET ?
          `
          count_sql = `SELECT COUNT(*) AS total FROM fbw_resources r ${query_where_str}`
        }

        const page = Math.max(1, Number.parseInt(startPage, 10) || Number(startPage) || 1)
        const size = Math.max(1, Number.parseInt(pageSize, 10) || Number(pageSize) || 50)
        ret.data.startPage = page
        ret.data.pageSize = size

        const query_stmt = this.db.prepare(query_sql)
        const query_result = query_stmt.all(...query_params, size, (page - 1) * size)
        ret.data.list = []
        if (Array.isArray(query_result) && query_result.length) {
          ret.data.list = query_result.map((item) => {
            return {
              ...item,
              srcType: 'file',
              uniqueKey: buildStableResourceUniqueKey(item)
            }
          })
          // 浏览量+1（批量）
          const updateParams = ret.data.list.map((item) => {
            return {
              resourceId: item.id,
              views: 1
            }
          })
          await this.batchUpdateStatistics(updateParams)
        }
        // 无论当前页是否有数据都要统计总数，否则分页后续页 total 为 0 会导致前端误判「已结束」或错乱
        if (count_sql) {
          const count_stmt = this.db.prepare(count_sql)
          const count_result = count_stmt.get(...query_params)
          if (count_result && typeof count_result.total === 'number') {
            ret.data.total = count_result.total
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
        const secretKey = resolveRemoteSecretKey(resourceName, remoteResourceSecretKeys)
        if (resourceInfo.requireSecretKey && !secretKey) {
          ret.message = t('messages.resourceSecretKeyUnset')
          return ret
        }
        if (resourceInfo.searchRequired?.keywords && !filterKeywords) {
          ret.success = false
          ret.errorCode = API_ERROR_CODE.ENTER_KEYWORDS
          ret.message = ''
          return ret
        }
        const res = await this.apiManager.call(resourceName, 'search', {
          keywords: filterKeywords,
          filterType,
          orientation,
          startPage: startPage,
          pageSize,
          secretKey: resourceInfo.requireSecretKey ? secretKey : ''
        })
        if (res) {
          if (typeof res.total === 'number' && res.total >= 0) {
            ret.data.total = res.total
          }
          ret.data.list = []
          if (Array.isArray(res.list) && res.list.length) {
            ret.data.list = res.list.map((item) => {
              return {
                ...item,
                srcType: 'url',
                uniqueKey: buildStableResourceUniqueKey(item)
              }
            })
          }
          ret.success = true
          ret.message = t(ret.data.list.length ? 'messages.querySuccess' : 'messages.queryEmpty')
        }
      }
    } catch (err) {
      this.logger.error(`搜索失败: error => ${err}`)
      applyCodedErrorToResult(ret, err, t('messages.operationFail'))
    }

    return ret
  }

  // 获取热门标签
  async getHotTags(params) {
    const { resourceName } = params
    const { remoteResourceSecretKeys } = this.settingData

    let ret = {
      success: false,
      message: t('messages.operationFail'),
      data: {
        tags: []
      }
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

    const secretKey = resolveRemoteSecretKey(resourceName, remoteResourceSecretKeys)
    if (resourceInfo.requireSecretKey && !secretKey) {
      ret.message = t('messages.resourceSecretKeyUnset')
      return ret
    }

    try {
      const tags = await this.apiManager.call(resourceName, 'getHotTags', {
        secretKey: resourceInfo.requireSecretKey ? secretKey : ''
      })
      this.logger.info(`获取热门标签成功: ${JSON.stringify(tags)}`)
      ret.data.tags = Array.isArray(tags) ? tags : []
      ret.success = true
      ret.message = t(ret.data.tags.length ? 'messages.querySuccess' : 'messages.queryEmpty')
      return ret
    } catch (err) {
      this.logger.error(`获取热门标签失败: error => ${err}`)
      applyCodedErrorToResult(ret, err, t('messages.operationFail'))
      return ret
    }
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
        const insert_stmt = this.db.prepare(
          `INSERT OR IGNORE INTO fbw_favorites (resourceId) VALUES (?)`
        )
        insert_stmt.run(resourceId)
        // 更新统计表
        await this.updateStatistics({ resourceId, favorites: 1 })
        ret = {
          success: true,
          message: t('messages.operationSuccess')
        }
      }
    } catch (err) {
      this.logger.error(`加入收藏夹失败: ${err}`)
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
        if (!isPrivacySpace) {
          // 更新统计表
          await this.updateStatistics({ resourceId, favorites: 0 })
        }
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

  // 更新统计数据
  async updateStatistics(params = {}) {
    let ret = {
      success: false,
      message: t('messages.operationFail')
    }
    if (!params || typeof params !== 'object' || !params.resourceId) {
      ret.message = t('messages.paramsError')
      return ret
    }
    const resourceId = params.resourceId
    const allowedFields = ['views', 'downloads', 'favorites', 'wallpapers']
    const updateFields = Object.keys(params).filter((key) => allowedFields.includes(key))
    if (updateFields.length === 0) {
      ret.message = t('messages.paramsError')
      return ret
    }
    try {
      // 检查是否存在
      const check_stmt = this.db.prepare('SELECT * FROM fbw_statistics WHERE resourceId = ?')
      const check_result = check_stmt.get(resourceId)
      if (check_result) {
        const gtZeroFields = updateFields.filter((f) => params[f] > 0)
        const leZeroFields = updateFields.filter((f) => params[f] <= 0)

        let setStrArr = []
        let updateValues = []

        // 大于0的字段
        gtZeroFields.forEach((f) => {
          setStrArr.push(`${f} = MAX(${f} + ?, 0)`)
          updateValues.push(params[f])
        })
        // 小于等于0的字段
        leZeroFields.forEach((f) => {
          setStrArr.push(`${f} = 0`)
          // 不需要push参数
        })

        setStrArr.push(`updated_at = datetime('now', 'localtime')`)
        updateValues.push(resourceId)

        const setStr = setStrArr.join(', ')
        const update_stmt = this.db.prepare(
          `UPDATE fbw_statistics SET ${setStr} WHERE resourceId = ?`
        )
        const update_result = update_stmt.run(...updateValues)
        if (update_result.changes > 0) {
          ret = {
            success: true,
            message: t('messages.operationSuccess')
          }
        }
      } else {
        // 插入新记录，未提供的字段用默认值
        const insertFields = ['resourceId', ...allowedFields]
        const insertValues = [resourceId]
        for (const f of allowedFields) {
          insertValues.push(params[f] || 0)
        }
        const insert_stmt = this.db.prepare(
          `INSERT INTO fbw_statistics (${insertFields.join(',')}) VALUES (${insertFields.map(() => '?').join(',')})`
        )
        const insert_result = insert_stmt.run(...insertValues)
        if (insert_result.changes > 0) {
          ret = {
            success: true,
            message: t('messages.operationSuccess')
          }
        }
      }
    } catch (err) {
      this.logger.error(`更新统计数据失败: ${err}`)
    }
    return ret
  }

  // 批量更新统计字段
  async batchUpdateStatistics(updateParams = []) {
    let ret = {
      success: false,
      message: t('messages.operationFail')
    }
    if (!Array.isArray(updateParams) || !updateParams.length) {
      return ret
    }
    const allowedFields = ['views', 'downloads', 'favorites', 'wallpapers']
    const BATCH_SIZE = 500
    try {
      for (let i = 0; i < updateParams.length; i += BATCH_SIZE) {
        const batch = updateParams.slice(i, i + BATCH_SIZE)
        this.db.transaction(() => {
          // 1. 查找已存在的 resourceId
          const batchIds = batch.map((item) => item.resourceId)
          const placeholders = batchIds.map(() => '?').join(',')
          const existRows = this.db
            .prepare(`SELECT resourceId FROM fbw_statistics WHERE resourceId IN (${placeholders})`)
            .all(...batchIds)
          const existIds = existRows.map((row) => row.resourceId)
          const notExistIds = batchIds.filter((id) => !existIds.includes(id))
          // 2. 批量插入不存在的记录
          if (notExistIds.length) {
            const insertFields = ['resourceId', ...allowedFields]
            const insertPlaceholders = insertFields.map(() => '?').join(',')
            const insert_stmt = this.db.prepare(
              `INSERT INTO fbw_statistics (${insertFields.join(',')}) VALUES (${insertPlaceholders})`
            )
            for (const id of notExistIds) {
              const values = [id]
              for (const f of allowedFields) {
                // 查找该id在batch中的参数
                const param = batch.find((item) => item.resourceId === id)
                values.push(param && param[f] ? param[f] : 0)
              }
              insert_stmt.run(...values)
            }
          }
          // 3. 只对已存在的 resourceId 执行 update
          for (const param of batch) {
            if (!existIds.includes(param.resourceId)) continue
            const { resourceId, ...fields } = param
            const updateFields = Object.keys(fields).filter((key) => allowedFields.includes(key))
            if (!updateFields.length) continue
            const setStr = updateFields.map((f) => `${f} = MAX(${f} + ?, 0)`).join(', ')
            const update_sql = `UPDATE fbw_statistics SET ${setStr}, updated_at = datetime('now', 'localtime') WHERE resourceId = ?`
            const updateParamsArr = updateFields.map((f) => fields[f]).concat([resourceId])
            this.db.prepare(update_sql).run(...updateParamsArr)
          }
        })()
      }
      ret.success = true
      ret.message = t('messages.operationSuccess')
    } catch (err) {
      this.logger.error(`批量更新统计数据失败: ${err}`)
    }
    return ret
  }

  async searchWithFilters(params = {}) {
    return this.search(params)
  }

  /**
   * 找相似候选范围（与当前页上下文一致）
   * @param {{ type: 'search'|'collection'|'privacy'|'favorites'|'history', resourceType?: string, resourceName?: string, collectionId?: number }} scope
   * @returns {number[]|null} null 表示不限制（全库）
   */
  getSimilarScopeCandidateIds(scope = {}) {
    const type = scope?.type
    if (!type) return null

    if (type === 'collection') {
      if (!scope.collectionId) return []
      return this.db
        .prepare(`SELECT resourceId AS id FROM fbw_collection_items WHERE collectionId = ?`)
        .all(scope.collectionId)
        .map((r) => r.id)
    }

    if (type === 'privacy') {
      return this.db
        .prepare(`SELECT resourceId AS id FROM fbw_privacy_space`)
        .all()
        .map((r) => r.id)
    }

    if (type === 'favorites') {
      return this.db
        .prepare(`SELECT resourceId AS id FROM fbw_favorites`)
        .all()
        .map((r) => r.id)
    }

    if (type === 'history') {
      return this.db
        .prepare(`SELECT resourceId AS id FROM fbw_history`)
        .all()
        .map((r) => r.id)
    }

    if (type === 'search') {
      const resourceType = scope.resourceType || 'localResource'
      const resourceName = scope.resourceName || 'resources'

      if (resourceType === 'remoteResource') {
        return this.db
          .prepare(
            `SELECT id FROM fbw_resources WHERE fileType = 'image' AND resourceName = ?`
          )
          .all(resourceName)
          .map((r) => r.id)
      }

      if (resourceName === 'favorites') {
        return this.db
          .prepare(`SELECT resourceId AS id FROM fbw_favorites`)
          .all()
          .map((r) => r.id)
      }
      if (resourceName === 'history') {
        return this.db
          .prepare(`SELECT resourceId AS id FROM fbw_history`)
          .all()
          .map((r) => r.id)
      }
      if (resourceName === 'privacy_space') {
        return this.db
          .prepare(`SELECT resourceId AS id FROM fbw_privacy_space`)
          .all()
          .map((r) => r.id)
      }
      if (resourceName === 'resources') {
        return this.db
          .prepare(
            `SELECT r.id FROM fbw_resources r
             WHERE r.fileType = 'image'
               AND NOT EXISTS (SELECT 1 FROM fbw_privacy_space p WHERE p.resourceId = r.id)`
          )
          .all()
          .map((r) => r.id)
      }

      return this.db
        .prepare(
          `SELECT r.id FROM fbw_resources r
           WHERE r.fileType = 'image' AND r.resourceName = ?
             AND NOT EXISTS (SELECT 1 FROM fbw_privacy_space p WHERE p.resourceId = r.id)`
        )
        .all(resourceName)
        .map((r) => r.id)
    }

    return null
  }

  /**
   * 找相似：范围内已有向量的候选数量（不含源图）
   * @param {number[]} candidateIds
   * @param {number|null} excludeResourceId
   */
  countSimilarEmbeddableCandidates(candidateIds = [], excludeResourceId = null) {
    if (!Array.isArray(candidateIds) || !candidateIds.length) return 0
    const ids = [...new Set(candidateIds.map((id) => Number(id)).filter((id) => id > 0))]
    if (!ids.length) return 0
    const excludeId =
      excludeResourceId != null && excludeResourceId !== ''
        ? Number(excludeResourceId)
        : null

    const ai = this.settingManager?.settingData?.ai || {}
    const useVisual =
      ai.visualEmbedEnabled !== false && String(ai.findSimilarMode || 'visual') !== 'text'
    const table = useVisual ? 'fbw_resource_image_vec_blob' : 'fbw_resource_vec_blob'

    let total = 0
    const chunkSize = 400
    for (let i = 0; i < ids.length; i += chunkSize) {
      const chunk = ids.slice(i, i + chunkSize)
      const ph = chunk.map(() => '?').join(',')
      const params = [...chunk]
      let sql = `SELECT COUNT(*) AS c FROM ${table} WHERE resourceId IN (${ph})`
      if (excludeId != null) {
        sql += ' AND resourceId != ?'
        params.push(excludeId)
      }
      total += this.db.prepare(sql).get(...params)?.c || 0
    }
    return total
  }

  /**
   * 按 ids 顺序返回资源（保持 KNN / 语义检索的相似度排序；SQL IN 本身无序）
   */
  getResourcesByIds(ids = []) {
    if (!ids.length) return []
    const orderedIds = ids
      .map((id) => Number(id))
      .filter((id) => Number.isFinite(id) && id > 0)
    if (!orderedIds.length) return []
    const ph = orderedIds.map(() => '?').join(',')
    const rows = this.db
      .prepare(`SELECT r.* FROM fbw_resources r WHERE r.id IN (${ph})`)
      .all(...orderedIds)
    const byId = new Map(rows.map((row) => [Number(row.id), row]))
    return orderedIds.map((id) => byId.get(id)).filter(Boolean)
  }

  async semanticSearch(params = {}) {
    const { embeddingManager, ...rest } = params
    const query = String(params.query ?? params.filterKeywords ?? '').trim()
    const pageSize = Number(params.pageSize) > 0 ? Number(params.pageSize) : 30
    const knnLimit = Math.min(Math.max(pageSize, 30), 200)

    if (!embeddingManager || !query) {
      return this.search({ ...rest, filterKeywords: query })
    }
    try {
      const ids = await embeddingManager.semanticSearch(query, knnLimit)
      if (!ids.length) {
        return this.search({ ...rest, filterKeywords: query })
      }
      // 向量命中后按 id 拉取，并保留方向/类型等筛选；不再重复 LIKE 关键词
      return this.search({
        ...rest,
        resourceIds: ids,
        filterKeywords: '',
        startPage: 1,
        pageSize
      })
    } catch (err) {
      this.logger.error(`semanticSearch: ${err}`)
      return this.search({ ...rest, filterKeywords: query })
    }
  }
}
