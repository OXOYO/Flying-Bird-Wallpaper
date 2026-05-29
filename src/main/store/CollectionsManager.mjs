import { t } from '../../i18n/server.js'
import TextQueryParser from '../ai/TextQueryParser.mjs'
import {
  COLLECTION_ITEMS_DEFAULT_PAGE_SIZE,
  isCollectionRefreshDue
} from './collectionConstants.mjs'
import { COLLECTION_VISUAL_SEARCH_MIN_COSINE, COLLECTION_VISUAL_MIN_EMBEDDINGS } from '../ai/aiConstants.mjs'

export default class CollectionsManager {
  static _instance = null

  static getInstance(
    logger,
    dbManager,
    settingManager,
    resourcesManager,
    textQueryParser,
    embeddingManager
  ) {
    if (!CollectionsManager._instance) {
      CollectionsManager._instance = new CollectionsManager(
        logger,
        dbManager,
        settingManager,
        resourcesManager,
        textQueryParser,
        embeddingManager
      )
    }
    return CollectionsManager._instance
  }

  constructor(logger, dbManager, settingManager, resourcesManager, textQueryParser, embeddingManager) {
    if (CollectionsManager._instance) return CollectionsManager._instance
    this.logger = logger
    this.db = dbManager.db
    this.settingManager = settingManager
    this.resourcesManager = resourcesManager
    this.textQueryParser = textQueryParser
    this.embeddingManager = embeddingManager
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

  /**
   * 短实体词合集：AI 动态扩展 tags（结果写入 queryJson 缓存，同关键词不重复调 LLM）
   */
  async _resolveSearchFilters(queryJson, collection) {
    const filterKeywords = this._resolveFilterKeywords(queryJson, collection)
    let tags = Array.isArray(queryJson.tags) ? queryJson.tags.map(String).filter(Boolean) : []
    let tagsMode = queryJson.tagsMode === 'all' ? 'all' : 'any'
    let searchKeywords = filterKeywords

    const ai = this.settingManager.settingData?.ai
    const cachedFor = String(queryJson.keywordTagsExpandedFor || '').trim()
    const isShortEntity = filterKeywords && filterKeywords.length <= 32
    const shouldExpand =
      isShortEntity &&
      ai?.enabled &&
      cachedFor !== filterKeywords

    if (shouldExpand) {
      const ret = await this.textQueryParser.expandCollectionKeywordTags(filterKeywords)
      if (ret.success && ret.data?.length) {
        tags = [...new Set([...tags, ...ret.data])]
        tagsMode = 'any'
        queryJson.tags = tags
        queryJson.tagsMode = tagsMode
        queryJson.keywordTagsExpandedFor = filterKeywords
        searchKeywords = ''
      }
    } else if (cachedFor === filterKeywords && tags.length) {
      searchKeywords = ''
    }

    return { filterKeywords: searchKeywords, tags, tagsMode }
  }

  _resolveFilterKeywords(queryJson, collection) {
    const fromJson = String(queryJson.filterKeywords || '').trim()
    if (fromJson) return fromJson
    const prompt = String(collection.prompt || '').trim()
    // 短 prompt（如「汽车」）视为关键词合集，避免 LLM 清空 filterKeywords 后全库按分排序
    if (prompt && prompt.length <= 32) return prompt
    return ''
  }

  _hasStructuredFilters(queryJson, collection) {
    return !!(
      this._resolveFilterKeywords(queryJson, collection) ||
      (Array.isArray(queryJson.tags) && queryJson.tags.length)
    )
  }

  _resolveVisualSearchQuery(queryJson, collection) {
    return String(queryJson.semanticQuery || '').trim()
  }

  _canUseVisualSearch(collection, queryJson) {
    if (collection.source === 'auto') return false
    if (queryJson.useSemantic === false) return false
    if (!this.embeddingManager) return false
    if (this._hasStructuredFilters(queryJson, collection)) return false
    const q = this._resolveVisualSearchQuery(queryJson, collection) || String(collection.prompt || '').trim()
    if (!q) return false
    return this.embeddingManager.countImageEmbeddings(true) >= COLLECTION_VISUAL_MIN_EMBEDDINGS
  }

  /**
   * 画面向量补充检索（须在关键词/标签约束的候选池内）
   * @param {{ excludeIds?: number[], limit: number }} extra
   */
  async _searchByVisualVectors(searchParams, queryJson, collection, extra = {}) {
    const { excludeIds = [], limit } = extra
    const semanticQuery = this._resolveVisualSearchQuery(queryJson, collection) || String(collection.prompt || '').trim()
    if (!this._canUseVisualSearch(collection, queryJson) || limit <= 0) {
      return []
    }

    const poolParams = {
      ...searchParams,
      startPage: 1,
      pageSize: Math.min(800, Math.max(limit * 10, 120))
    }
    const poolRet = await this.resourcesManager.searchWithFilters(poolParams)
    let candidateIds = (poolRet.data?.list || []).map((item) => item.id).filter(Boolean)
    if (excludeIds.length) {
      const excluded = new Set(excludeIds)
      candidateIds = candidateIds.filter((id) => !excluded.has(id))
    }
    if (!candidateIds.length) return []

    const visualIds = await this.embeddingManager.visualSearchByQuery(semanticQuery, {
      limit,
      candidateIds,
      minSimilarity: COLLECTION_VISUAL_SEARCH_MIN_COSINE
    })
    if (!visualIds.length) return []

    const visualSearchRet = await this.resourcesManager.searchWithFilters({
      ...searchParams,
      resourceIds: visualIds,
      pageSize: visualIds.length,
      startPage: 1
    })
    const byId = new Map((visualSearchRet.data?.list || []).map((item) => [item.id, item]))
    const list = visualIds.map((id) => byId.get(id)).filter(Boolean).slice(0, limit)

    if (list.length) {
      queryJson.useVisualSearch = true
      queryJson.visualSearchQuery = semanticQuery
      this.logger.info(
        `[CollectionsManager] 画面向量补充合集 ${collection.id}: +${list.length} 项 (query="${semanticQuery.slice(0, 40)}")`
      )
    }
    return list
  }

  _mergeResourceLists(primary = [], extra = [], pageSize) {
    const seen = new Set()
    const merged = []
    for (const item of [...primary, ...extra]) {
      if (!item?.id || seen.has(item.id)) continue
      seen.add(item.id)
      merged.push(item)
      if (merged.length >= pageSize) break
    }
    return merged
  }

  async generate(collectionId, queryJsonOverride = null, options = {}) {
    const { regenPrompt = false } = options
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
      if (parsed.success) {
        queryJson = { ...queryJson, ...parsed.data }
        delete queryJson.keywordTagsExpandedFor
      }
    }

    const pageSize = queryJson.limitCount || collection.limitCount || 20
    const resolved = await this._resolveSearchFilters(queryJson, collection)
    const filterKeywords = this._resolveFilterKeywords(queryJson, collection)
    const searchParams = {
      resourceType: 'localResource',
      resourceName: queryJson.resourceName || collection.resourceScope || 'resources',
      filterKeywords: resolved.filterKeywords,
      filterType: queryJson.fileType === 'video' ? 'videos' : 'images',
      quality: Array.isArray(queryJson.quality) ? queryJson.quality.join(',') : '',
      orientation: Array.isArray(queryJson.orientation) ? queryJson.orientation.join(',') : '',
      startPage: 1,
      pageSize,
      isRandom: !!queryJson.isRandom,
      sortField: queryJson.sortField || collection.sortField || 'score',
      sortType: queryJson.sortType ?? collection.sortType ?? -1,
      scoreMin: queryJson.scoreMin,
      scoreMax: queryJson.scoreMax,
      tags: resolved.tags,
      tagsMode: resolved.tagsMode,
      hideUnsafe: this.settingManager.settingData?.ai?.enableNsfwCheck
    }

    const searchRet = await this.resourcesManager.searchWithFilters(searchParams)
    let list = searchRet.data?.list || []

    const canVisual = this._canUseVisualSearch(collection, queryJson)

    if (canVisual && list.length < pageSize) {
      try {
        const visualList = await this._searchByVisualVectors(searchParams, queryJson, collection, {
          excludeIds: list.map((item) => item.id),
          limit: pageSize - list.length
        })
        list = this._mergeResourceLists(list, visualList, pageSize)
      } catch (err) {
        this.logger.warn(`[CollectionsManager] 画面向量补充失败: ${err.message}`)
      }
    }

    if (filterKeywords) {
      queryJson.filterKeywords = filterKeywords
    }

    this.logger.info(
      `[CollectionsManager] 生成合集 ${collectionId} "${collection.name}": ${list.length} 项` +
        ` keyword=${filterKeywords ? 'yes' : 'no'} visual=${canVisual ? 'yes' : 'no'} regenPrompt=${regenPrompt}`
    )

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
