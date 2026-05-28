import { t } from '../../i18n/server.js'
import TextQueryParser from '../ai/TextQueryParser.mjs'
import {
  COLLECTION_ITEMS_DEFAULT_PAGE_SIZE,
  isCollectionRefreshDue
} from './collectionConstants.mjs'

export default class CollectionsManager {
  static _instance = null

  static getInstance(logger, dbManager, settingManager, resourcesManager, textQueryParser) {
    if (!CollectionsManager._instance) {
      CollectionsManager._instance = new CollectionsManager(
        logger,
        dbManager,
        settingManager,
        resourcesManager,
        textQueryParser
      )
    }
    return CollectionsManager._instance
  }

  constructor(logger, dbManager, settingManager, resourcesManager, textQueryParser) {
    if (CollectionsManager._instance) return CollectionsManager._instance
    this.logger = logger
    this.db = dbManager.db
    this.settingManager = settingManager
    this.resourcesManager = resourcesManager
    this.textQueryParser = textQueryParser
    CollectionsManager._instance = this
  }

  /** @returns {Record<number, number>} */
  _itemCountMap() {
    const countRows = this.db
      .prepare(
        `SELECT collectionId, COUNT(*) AS itemCount
         FROM fbw_collection_items
         GROUP BY collectionId`
      )
      .all()
    const map = {}
    for (const row of countRows) {
      map[row.collectionId] = Number(row.itemCount) || 0
    }
    return map
  }

  list() {
    const rows = this.db
      .prepare(
        `SELECT c.*
         FROM fbw_collections c
         ORDER BY CASE c.source WHEN 'auto' THEN 0 ELSE 1 END, c.isPinned DESC, c.updated_at DESC`
      )
      .all()
    const countMap = this._itemCountMap()
    const data = rows.map((row) => ({
      ...row,
      itemCount: countMap[row.id] ?? 0
    }))
    return { success: true, data, message: t('messages.querySuccess') }
  }

  get(id, options = {}) {
    const collection = this.db.prepare(`SELECT * FROM fbw_collections WHERE id = ?`).get(id)
    if (!collection) return { success: false, message: t('messages.operationFail') }

    const startPage = Math.max(1, Number(options.startPage) || 1)
    const pageSize = Math.min(
      200,
      Math.max(1, Number(options.pageSize) || COLLECTION_ITEMS_DEFAULT_PAGE_SIZE)
    )
    const total =
      this.db
        .prepare(`SELECT COUNT(*) AS c FROM fbw_collection_items WHERE collectionId = ?`)
        .get(id)?.c || 0
    const offset = (startPage - 1) * pageSize
    const items = this.db
      .prepare(
        `SELECT ci.*, r.* FROM fbw_collection_items ci
         JOIN fbw_resources r ON r.id = ci.resourceId
         WHERE ci.collectionId = ?
         ORDER BY ci.rank ASC
         LIMIT ? OFFSET ?`
      )
      .all(id, pageSize, offset)

    return {
      success: true,
      data: {
        collection,
        items,
        total,
        startPage,
        pageSize
      }
    }
  }

  create(params = {}) {
    const { name = '', prompt = '', queryJson = null, source = 'user' } = params
    const qj = queryJson ? JSON.stringify(queryJson) : '{}'
    const res = this.db
      .prepare(
        `INSERT INTO fbw_collections (name, prompt, queryJson, source) VALUES (?, ?, ?, ?)`
      )
      .run(name || prompt.slice(0, 40) || t('messages.querySuccess'), prompt, qj, source)
    return { success: true, data: { id: res.lastInsertRowid }, message: t('messages.operationSuccess') }
  }

  update(id, params = {}) {
    const fields = []
    const values = []
    ;['name', 'prompt', 'queryJson', 'resourceScope', 'limitCount', 'sortField', 'sortType', 'isPinned', 'refreshMode'].forEach(
      (key) => {
        if (params[key] !== undefined) {
          fields.push(`${key} = ?`)
          values.push(key === 'queryJson' && typeof params[key] === 'object' ? JSON.stringify(params[key]) : params[key])
        }
      }
    )
    if (!fields.length) return { success: false, message: t('messages.operationFail') }
    fields.push(`updated_at = datetime('now', 'localtime')`)
    values.push(id)
    this.db.prepare(`UPDATE fbw_collections SET ${fields.join(', ')} WHERE id = ?`).run(...values)
    return { success: true, message: t('messages.operationSuccess') }
  }

  delete(id) {
    this.db.prepare(`DELETE FROM fbw_collection_items WHERE collectionId = ?`).run(id)
    this.db.prepare(`DELETE FROM fbw_collections WHERE id = ?`).run(id)
    return { success: true, message: t('messages.operationSuccess') }
  }

  async createFromPrompt(prompt) {
    const parsed = await this.textQueryParser.parseCollectionPrompt(prompt)
    if (!parsed.success) return parsed
    const queryJson = parsed.data
    const created = this.create({ name: prompt.slice(0, 40), prompt, queryJson })
    if (!created.success) return created
    const gen = await this.generate(created.data.id, queryJson)
    return { success: gen.success, data: { id: created.data.id, ...gen.data }, message: gen.message }
  }

  async generate(collectionId, queryJsonOverride = null, options = {}) {
    const { regenPrompt = queryJsonOverride == null } = options
    const collection = this.db.prepare(`SELECT * FROM fbw_collections WHERE id = ?`).get(collectionId)
    if (!collection) return { success: false, message: t('messages.operationFail') }

    let queryJson = queryJsonOverride
    if (!queryJson) {
      try {
        queryJson = JSON.parse(collection.queryJson || '{}')
      } catch {
        queryJson = {}
      }
    }
    if (regenPrompt && collection.prompt && !queryJsonOverride) {
      const parsed = await this.textQueryParser.parseCollectionPrompt(collection.prompt)
      if (parsed.success) queryJson = { ...queryJson, ...parsed.data }
    }

    const searchParams = {
      resourceType: 'localResource',
      resourceName: queryJson.resourceName || collection.resourceScope || 'resources',
      filterKeywords: queryJson.filterKeywords || '',
      filterType: queryJson.fileType === 'video' ? 'videos' : 'images',
      quality: Array.isArray(queryJson.quality) ? queryJson.quality.join(',') : '',
      orientation: Array.isArray(queryJson.orientation) ? queryJson.orientation.join(',') : '',
      startPage: 1,
      pageSize: queryJson.limitCount || collection.limitCount || 20,
      isRandom: !!queryJson.isRandom,
      sortField: queryJson.sortField || collection.sortField || 'score',
      sortType: queryJson.sortType ?? collection.sortType ?? -1,
      scoreMin: queryJson.scoreMin,
      scoreMax: queryJson.scoreMax,
      tags: queryJson.tags,
      tagsMode: queryJson.tagsMode,
      hideUnsafe: this.settingManager.settingData?.ai?.enableNsfwCheck
    }

    const searchRet = await this.resourcesManager.searchWithFilters(searchParams)
    const list = searchRet.data?.list || []

    this.db.prepare(`DELETE FROM fbw_collection_items WHERE collectionId = ?`).run(collectionId)
    const insert = this.db.prepare(
      `INSERT INTO fbw_collection_items (collectionId, resourceId, rank) VALUES (?, ?, ?)`
    )
    const tx = this.db.transaction(() => {
      list.forEach((item, index) => {
        if (item.id) insert.run(collectionId, item.id, index + 1)
      })
    })
    tx()

    this.db
      .prepare(
        `UPDATE fbw_collections SET queryJson = ?, lastGeneratedAt = datetime('now', 'localtime'), updated_at = datetime('now', 'localtime') WHERE id = ?`
      )
      .run(JSON.stringify(queryJson), collectionId)

    return {
      success: true,
      message: t('messages.operationSuccess'),
      data: { count: list.length, list }
    }
  }

  addAllToFavorites(collectionId) {
    const items = this.db
      .prepare(`SELECT resourceId FROM fbw_collection_items WHERE collectionId = ?`)
      .all(collectionId)
    let ok = 0
    const stmt = this.db.prepare(`INSERT OR IGNORE INTO fbw_favorites (resourceId) VALUES (?)`)
    const tx = this.db.transaction(() => {
      items.forEach((it) => {
        const r = stmt.run(it.resourceId)
        if (r.changes) ok++
      })
    })
    tx()
    return { success: true, data: { added: ok }, message: t('messages.operationSuccess') }
  }

  listAutoRefreshCollections() {
    return this.db
      .prepare(`SELECT * FROM fbw_collections WHERE refreshMode != 'manual' ORDER BY isPinned DESC, id ASC`)
      .all()
  }

  isRefreshDue(collection, now = Date.now()) {
    return isCollectionRefreshDue(collection, now)
  }

  async intervalRefresh(locks) {
    if (locks.collectionsRefresh) return
    const due = this.listAutoRefreshCollections().filter((row) => this.isRefreshDue(row))
    if (!due.length) return

    locks.collectionsRefresh = true
    try {
      for (const collection of due) {
        try {
          const ret = await this.generate(collection.id, null, { regenPrompt: false })
          if (ret.success) {
            this.logger.info(
              `[CollectionsManager] 自动刷新合集 ${collection.id} (${collection.name}), ${ret.data?.count ?? 0} 项`
            )
          } else {
            this.logger.warn(`[CollectionsManager] 自动刷新合集 ${collection.id} 失败: ${ret.message}`)
          }
        } catch (err) {
          this.logger.warn(`[CollectionsManager] 自动刷新合集 ${collection.id}: ${err.message}`)
        }
      }
    } finally {
      locks.collectionsRefresh = false
    }
  }
}
