import { t } from '../../i18n/server.js'

export default class RecommendManager {
  static _instance = null

  static getInstance(logger, dbManager) {
    if (!RecommendManager._instance) {
      RecommendManager._instance = new RecommendManager(logger, dbManager)
    }
    return RecommendManager._instance
  }

  constructor(logger, dbManager) {
    if (RecommendManager._instance) return RecommendManager._instance
    this.logger = logger
    this.db = dbManager.db
    RecommendManager._instance = this
  }

  /**
   * 轻量推荐：最近设壁纸/收藏的资源 tags + score 加权
   */
  recommend(params = {}) {
    const limit = Math.min(Math.max(Number(params.limit) || 20, 1), 100)
    const resourceName = params.resourceName || 'resources'

    const prefTags = this.db
      .prepare(
        `SELECT w.word, COUNT(*) as cnt
         FROM fbw_words w
         JOIN fbw_resource_words rw ON rw.wordId = w.id
         JOIN fbw_statistics s ON s.resourceId = rw.resourceId
         WHERE s.wallpapers > 0 OR s.favorites > 0
         GROUP BY w.id
         ORDER BY cnt DESC
         LIMIT 15`
      )
      .all()
    const tagList = prefTags.map((x) => x.word)

    let query = `
      SELECT r.*, COALESCE(s.views,0) as views, COALESCE(s.wallpapers,0) as wallpapers
      FROM fbw_resources r
      LEFT JOIN fbw_statistics s ON s.resourceId = r.id
      WHERE r.resourceName = ?
        AND r.fileType = 'image'
    `
    const qParams = [resourceName]

    if (tagList.length) {
      const placeholders = tagList.map(() => '?').join(',')
      query += ` AND r.id IN (
        SELECT rw.resourceId FROM fbw_resource_words rw
        JOIN fbw_words w ON w.id = rw.wordId
        WHERE w.word IN (${placeholders})
      )`
      qParams.push(...tagList)
    }

    query += ` ORDER BY r.score DESC, s.wallpapers DESC, r.updated_at DESC LIMIT ?`
    qParams.push(limit)

    const list = this.db.prepare(query).all(...qParams)
    return {
      success: true,
      message: t(list.length ? 'messages.querySuccess' : 'messages.queryEmpty'),
      data: { list, prefTags: tagList }
    }
  }
}
