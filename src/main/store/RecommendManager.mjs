import ResourcesManager from './ResourcesManager.mjs'
import { t } from '../../i18n/server.js'

const RECOMMEND_MAX_PAGE_SIZE = 100
const RECOMMEND_ADD_FAVORITES_MAX = 500

export default class RecommendManager {
  static _instance = null

  static getInstance(logger, dbManager, settingManager) {
    if (!RecommendManager._instance) {
      RecommendManager._instance = new RecommendManager(logger, dbManager, settingManager)
    }
    return RecommendManager._instance
  }

  constructor(logger, dbManager, settingManager) {
    if (RecommendManager._instance) return RecommendManager._instance
    this.logger = logger
    this.dbManager = dbManager
    this.db = dbManager.db
    this.settingManager = settingManager
    RecommendManager._instance = this
  }

  _resolveResourcesManager() {
    return ResourcesManager.getInstance(this.logger, this.dbManager, this.settingManager, null)
  }

  _resolveScoreMin(params = {}) {
    if (params.scoreMin != null && params.scoreMin !== '') {
      const v = Number(params.scoreMin)
      return Number.isFinite(v) ? Math.max(0, Math.min(100, v)) : 0
    }
    const ai = this.settingManager?.settingData?.ai || {}
    const v = Number(ai.scoreMinFilter)
    return Number.isFinite(v) ? Math.max(0, Math.min(100, v)) : 0
  }

  _buildScopeFilter(resourceName) {
    const isResources = resourceName === 'resources'
    const isFavorites = resourceName === 'favorites'
    const isHistory = resourceName === 'history'
    const isPrivacySpace = resourceName === 'privacy_space'

    let sql = ''
    const params = []

    if (isPrivacySpace) {
      sql += ` AND EXISTS (SELECT 1 FROM fbw_privacy_space p WHERE p.resourceId = r.id)`
    } else {
      sql += ` AND NOT EXISTS (SELECT 1 FROM fbw_privacy_space p WHERE p.resourceId = r.id)`
      if (isFavorites) {
        sql += ` AND EXISTS (SELECT 1 FROM fbw_favorites f WHERE f.resourceId = r.id)`
      } else if (isHistory) {
        sql += ` AND EXISTS (SELECT 1 FROM fbw_history h WHERE h.resourceId = r.id)`
      } else if (isResources) {
        sql += ` AND NOT EXISTS (SELECT 1 FROM fbw_favorites f WHERE f.resourceId = r.id)`
      } else {
        sql += ` AND r.resourceName = ?`
        params.push(resourceName)
      }
    }

    return { sql, params, isPrivacySpace }
  }

  _prefTagScopeSql(resourceName, isPrivacySpace) {
    if (isPrivacySpace) {
      return ` AND EXISTS (SELECT 1 FROM fbw_privacy_space p WHERE p.resourceId = r.id)`
    }
    if (
      resourceName === 'resources' ||
      resourceName === 'favorites' ||
      resourceName === 'history' ||
      resourceName === 'privacy_space'
    ) {
      return ` AND NOT EXISTS (SELECT 1 FROM fbw_privacy_space p WHERE p.resourceId = r.id)`
    }
    return ` AND NOT EXISTS (SELECT 1 FROM fbw_privacy_space p WHERE p.resourceId = r.id) AND r.resourceName = ?`
  }

  _prefTagScopeParams(resourceName) {
    if (
      resourceName === 'resources' ||
      resourceName === 'favorites' ||
      resourceName === 'history' ||
      resourceName === 'privacy_space'
    ) {
      return []
    }
    return [resourceName]
  }

  _loadPrefTags(resourceName, scope) {
    const prefTagScopeSql = this._prefTagScopeSql(resourceName, scope.isPrivacySpace)
    const prefTagParams = this._prefTagScopeParams(resourceName)
    const prefTags = this.db
      .prepare(
        `SELECT w.word, COUNT(*) as cnt
         FROM fbw_words w
         JOIN fbw_resource_words rw ON rw.wordId = w.id
         JOIN fbw_statistics s ON s.resourceId = rw.resourceId
         JOIN fbw_resources r ON r.id = rw.resourceId
         WHERE (s.wallpapers > 0 OR s.favorites > 0)${prefTagScopeSql}
         GROUP BY w.id
         ORDER BY cnt DESC
         LIMIT 15`
      )
      .all(...prefTagParams)
    return prefTags.map((x) => x.word)
  }

  _buildRecommendContext(params = {}) {
    const resourceName = params.resourceName || 'resources'
    const scope = this._buildScopeFilter(resourceName)
    const tagList = this._loadPrefTags(resourceName, scope)
    const scoreMin = this._resolveScoreMin(params)
    return {
      resourceName,
      scope,
      tagList,
      scoreMin,
      degraded: tagList.length === 0
    }
  }

  _buildWhereClause(ctx) {
    let sql = ` WHERE 1=1${ctx.scope.sql}`
    const qParams = [...ctx.scope.params]
    if (ctx.scoreMin > 0) {
      sql += ` AND COALESCE(ai.aiScore, 0) >= ?`
      qParams.push(ctx.scoreMin)
    }
    if (ctx.tagList.length) {
      const placeholders = ctx.tagList.map(() => '?').join(',')
      sql += ` AND r.id IN (
        SELECT rw.resourceId FROM fbw_resource_words rw
        JOIN fbw_words w ON w.id = rw.wordId
        WHERE w.word IN (${placeholders})
      )`
      qParams.push(...ctx.tagList)
    }
    return { sql, qParams }
  }

  _countRecommendIds(ctx) {
    const { sql, qParams } = this._buildWhereClause(ctx)
    const row = this.db
      .prepare(
        `SELECT COUNT(*) AS c
         FROM fbw_resources r
         LEFT JOIN fbw_resource_ai ai ON ai.resourceId = r.id
         ${sql}`
      )
      .get(...qParams)
    return row?.c || 0
  }

  _fetchRecommendIds(ctx, { limit, offset }) {
    const { sql, qParams } = this._buildWhereClause(ctx)
    const rows = this.db
      .prepare(
        `SELECT r.id
         FROM fbw_resources r
         LEFT JOIN fbw_statistics s ON s.resourceId = r.id
         LEFT JOIN fbw_resource_ai ai ON ai.resourceId = r.id
         ${sql}
         ORDER BY COALESCE(ai.aiScore, 0) DESC, COALESCE(s.wallpapers, 0) DESC, r.updated_at DESC
         LIMIT ? OFFSET ?`
      )
      .all(...qParams, limit, offset)
    return rows.map((row) => row.id)
  }

  _fetchFallbackIds(ctx, { limit, offset }) {
    const { sql, qParams } = this._buildWhereClause({ ...ctx, tagList: [] })
    const rows = this.db
      .prepare(
        `SELECT r.id
         FROM fbw_resources r
         LEFT JOIN fbw_statistics s ON s.resourceId = r.id
         LEFT JOIN fbw_resource_ai ai ON ai.resourceId = r.id
         ${sql}
         ORDER BY COALESCE(ai.aiScore, 0) DESC, COALESCE(s.wallpapers, 0) DESC, r.updated_at DESC
         LIMIT ? OFFSET ?`
      )
      .all(...qParams, limit, offset)
    return rows.map((row) => row.id)
  }

  /**
   * 轻量推荐：最近设壁纸/收藏的资源 tags + score 加权
   */
  recommend(params = {}) {
    const startPage = Math.max(1, Number(params.startPage) || 1)
    const pageSize = Math.min(
      RECOMMEND_MAX_PAGE_SIZE,
      Math.max(1, Number(params.pageSize) || Number(params.limit) || 20)
    )
    const ctx = this._buildRecommendContext(params)
    let total = this._countRecommendIds(ctx)
    let degraded = ctx.degraded

    if (!total && ctx.tagList.length) {
      total = this._countRecommendIds({ ...ctx, tagList: [] })
      degraded = true
    }

    const offset = (startPage - 1) * pageSize
    let ids =
      total > 0 && ctx.tagList.length
        ? this._fetchRecommendIds(ctx, { limit: pageSize, offset })
        : []

    if (!ids.length && ctx.tagList.length) {
      ids = this._fetchFallbackIds(ctx, { limit: pageSize, offset })
      if (!total) {
        total = this._countRecommendIds({ ...ctx, tagList: [] })
      }
      degraded = true
    } else if (!ids.length && !ctx.tagList.length) {
      ids = this._fetchFallbackIds(ctx, { limit: pageSize, offset })
      if (!total) {
        total = this._countRecommendIds(ctx)
      }
    }

    const rm = this._resolveResourcesManager()
    const list = rm ? rm.getResourcesByIds(ids) : []

    return {
      success: true,
      message: t(list.length ? 'messages.querySuccess' : 'messages.queryEmpty'),
      data: {
        list,
        total,
        startPage,
        pageSize,
        prefTags: ctx.tagList,
        degraded
      }
    }
  }

  addAllToFavorites(params = {}) {
    const ctx = this._buildRecommendContext(params)
    let ids = []
    if (ctx.tagList.length) {
      ids = this._fetchRecommendIds(ctx, { limit: RECOMMEND_ADD_FAVORITES_MAX, offset: 0 })
    }
    if (!ids.length) {
      ids = this._fetchFallbackIds(ctx, { limit: RECOMMEND_ADD_FAVORITES_MAX, offset: 0 })
    }
    let ok = 0
    const stmt = this.db.prepare(`INSERT OR IGNORE INTO fbw_favorites (resourceId) VALUES (?)`)
    const tx = this.db.transaction(() => {
      ids.forEach((id) => {
        const r = stmt.run(id)
        if (r.changes) ok += 1
      })
    })
    tx()
    return { success: true, data: { added: ok }, message: t('messages.operationSuccess') }
  }
}
