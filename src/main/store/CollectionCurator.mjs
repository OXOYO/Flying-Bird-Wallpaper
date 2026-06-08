import { AI_ANALYSIS_STATUS } from '../ai/aiConstants.mjs'
import AiAnalysisProvider from '../ai/AiAnalysisProvider.mjs'
import EmbeddingManager from '../ai/EmbeddingManager.mjs'
import VecStore from '../ai/VecStore.mjs'
import { kMeansCluster, cosineSimilarity } from '../ai/VectorCluster.mjs'
import { buildAutoCollectionStoragePrompt, buildCollectionNamingPrompt } from '../ai/AiPrompts.mjs'
import { extractJsonObject, normalizeCollectionNamingPlan } from '../ai/AiResponseParser.mjs'
import { resolveSkillContext } from '../ai/skills/skillContext.mjs'
import { t } from '../../i18n/server.js'
import {
  AUTO_COLLECTION_MIN_EMBEDDINGS,
  AUTO_COLLECTION_MIN_ITEMS,
  AUTO_COLLECTION_INCREMENTAL_MIN_SIMILARITY,
  AUTO_COLLECTION_CLUSTER_MIN_SIMILARITY,
  COLLECTION_SOURCE,
  resolveAtmosphereFallbackName,
  computeAutoCollectionCount,
  isValidAutoCollectionTag,
  resolveAutoCollectionCountMax,
  resolveAutoCollectionScoreMin,
  COLLECTION_PRIVACY_EXCLUDE_SQL,
  resourceMatchesCollectionTitle,
  titleMatchesAppLocale,
  mergeCollectionPlans,
  shouldMergeCollectionPlans
} from './collectionConstants.mjs'
import { isAutoCurateSettled } from './collectionCurateGate.mjs'
import { buildAnalyzableResourceWhere } from '../ai/AiVisionResourcePath.mjs'

/**
 * 自动策展：画面向量聚类 + LLM 氛围命名
 */
export default class CollectionCurator {
  static _instance = null

  static getInstance(logger, dbManager, settingManager) {
    if (!CollectionCurator._instance) {
      CollectionCurator._instance = new CollectionCurator(logger, dbManager, settingManager)
    }
    return CollectionCurator._instance
  }

  constructor(logger, dbManager, settingManager) {
    if (CollectionCurator._instance) return CollectionCurator._instance
    this.logger = logger
    this.db = dbManager.db
    this.settingManager = settingManager
    this.vecStore = VecStore.getInstance(logger, this.db)
    this.provider = AiAnalysisProvider.getInstance(logger, settingManager)
    this.embeddingManager = EmbeddingManager.getInstance(logger, this.db, settingManager)
    CollectionCurator._instance = this
  }

  get ai() {
    return this.settingManager.settingData?.ai || {}
  }

  getUiLocale() {
    return this.settingManager.settingData?.locale || 'enUS'
  }

  getResourceHintsForTitleCheck(resourceId) {
    const rows = this._loadResourceTextRows([resourceId])
    const row = rows[0]
    if (!row) return { tags: [] }
    return {
      aiTitle: row.aiTitle || '',
      title: row.title || '',
      summary: row.summary || '',
      tags: this.getTagsForResources([resourceId])
    }
  }

  refinePlanMembersByTitle(plan) {
    if (!plan?.name || !plan.resourceIds?.length) return null
    const filtered = plan.resourceIds.filter((id) =>
      resourceMatchesCollectionTitle(plan.name, this.getResourceHintsForTitleCheck(id))
    )
    if (filtered.length < AUTO_COLLECTION_MIN_ITEMS) {
      this.logger.info(
        `[CollectionCurator] 剔图后不足 ${AUTO_COLLECTION_MIN_ITEMS} 张，跳过合集「${plan.name}」(${plan.resourceIds.length}→${filtered.length})`
      )
      return null
    }
    if (filtered.length < plan.resourceIds.length) {
      this.logger.info(
        `[CollectionCurator] 合集「${plan.name}」语义剔图 ${plan.resourceIds.length - filtered.length} 张，保留 ${filtered.length} 张`
      )
    }
    return { ...plan, resourceIds: filtered }
  }

  isEnabled() {
    return !!this.ai.enabled && this.ai.autoCollectionsEnabled !== false
  }

  getScoreMin() {
    return resolveAutoCollectionScoreMin(this.ai)
  }

  /** 已完成 AI 分析的可策展资源数（图片 + 有封面的视频） */
  countAnalyzedImages() {
    const analyzable = buildAnalyzableResourceWhere('r')
    return (
      this.db
        .prepare(
          `SELECT COUNT(*) as c FROM fbw_resource_ai ai
           JOIN fbw_resources r ON r.id = ai.resourceId
           WHERE ${analyzable} AND ai.aiAnalysisStatus = ?`
        )
        .get(AI_ANALYSIS_STATUS.DONE)?.c || 0
    )
  }

  getActiveVisualModelId() {
    return this.embeddingManager.getActiveVisualModelId()
  }

  countEmbeddings() {
    return this.countImageEmbeddings()
  }

  countImageEmbeddings() {
    const model = this.getActiveVisualModelId()
    const analyzable = buildAnalyzableResourceWhere('r')
    return (
      this.db
        .prepare(
          `SELECT COUNT(*) as c
           FROM fbw_resource_image_vec_blob v
           JOIN fbw_resources r ON r.id = v.resourceId
           INNER JOIN fbw_resource_ai ai ON ai.resourceId = r.id
           WHERE ${analyzable} AND ai.aiAnalysisStatus = ? AND v.model = ?`
        )
        .get(AI_ANALYSIS_STATUS.DONE, model)?.c || 0
    )
  }

  getTagsForResources(resourceIds = []) {
    if (!resourceIds.length) return []
    const ph = resourceIds.map(() => '?').join(',')
    const rows = this.db
      .prepare(
        `SELECT DISTINCT w.word AS tag
         FROM fbw_resource_words rw
         JOIN fbw_words w ON w.id = rw.wordId
         WHERE rw.resourceId IN (${ph})
         ORDER BY w.word ASC`
      )
      .all(...resourceIds)
    return rows.map((r) => r.tag).filter(isValidAutoCollectionTag).slice(0, 12)
  }

  _loadResourceTextRows(resourceIds = []) {
    if (!resourceIds.length) return []
    const ph = resourceIds.map(() => '?').join(',')
    return this.db
      .prepare(
        `SELECT r.id, r.title, COALESCE(ai.summary, '') AS summary, r.desc,
                COALESCE(ai.aiTitle, '') AS aiTitle, COALESCE(ai.aiDesc, '') AS aiDesc
         FROM fbw_resources r
         LEFT JOIN fbw_resource_ai ai ON ai.resourceId = r.id
         WHERE r.id IN (${ph})`
      )
      .all(...resourceIds)
  }

  /** LLM 命名语境：summary / 描述（非标题） */
  getContextTextMap(resourceIds = []) {
    const map = new Map()
    for (const row of this._loadResourceTextRows(resourceIds)) {
      const text =
        row.summary || row.aiDesc || row.aiTitle || row.title || row.desc || ''
      if (text) map.set(row.id, String(text).trim())
    }
    return map
  }

  /** 降级标题：aiTitle / 资源 title */
  getTitleTextMap(resourceIds = []) {
    const map = new Map()
    for (const row of this._loadResourceTextRows(resourceIds)) {
      const text = row.aiTitle || row.title || ''
      if (text) map.set(row.id, String(text).trim())
    }
    return map
  }

  pickTextSampleIds(resourceIds = [], items = [], limit = 6) {
    if (!resourceIds.length) return []
    const idToVec = new Map(items.map((item) => [item.id, item.vector]))
    const textMap = this.getContextTextMap(resourceIds)
    const scored = []

    for (const id of resourceIds) {
      const vec = idToVec.get(id)
      const text = textMap.get(id)
      if (!vec || !text) continue
      scored.push({ id, vec, text })
    }
    if (!scored.length) return resourceIds.slice(0, limit)

    const centroid = this.computeCentroid(scored.map((s) => s.vec))
    if (!centroid) return resourceIds.slice(0, limit)

    for (const item of scored) {
      item.sim = cosineSimilarity(item.vec, centroid)
    }
    scored.sort((a, b) => b.sim - a.sim)

    const picked = []
    const seen = new Set()
    const add = (entry) => {
      if (!entry || seen.has(entry.id)) return
      seen.add(entry.id)
      picked.push(entry.id)
    }

    add(scored[0])
    if (scored.length > 1) add(scored[1])
    if (scored.length > 2) add(scored[scored.length - 1])
    if (scored.length > 3) add(scored[scored.length - 2])
    if (scored.length > 4) add(scored[Math.floor(scored.length / 2)])

    for (const entry of scored) {
      if (picked.length >= limit) break
      add(entry)
    }
    for (const id of resourceIds) {
      if (picked.length >= limit) break
      if (!seen.has(id) && textMap.has(id)) {
        seen.add(id)
        picked.push(id)
      }
    }
    return picked.slice(0, limit)
  }

  getDiverseSamplesForResources(resourceIds = [], items = [], limit = 6) {
    const ids = this.pickTextSampleIds(resourceIds, items, limit)
    const textMap = this.getContextTextMap(ids)
    return ids.map((id) => textMap.get(id)).filter(Boolean)
  }

  getTitleSamplesForResources(resourceIds = [], items = [], limit = 6) {
    const ids = this.pickTextSampleIds(resourceIds, items, limit)
    const textMap = this.getTitleTextMap(ids)
    return ids.map((id) => textMap.get(id)).filter(Boolean)
  }

  /** 命名专用：仅取靠近簇质心的描述，避免离群 sample 误导 LLM */
  getCoreSamplesForResources(resourceIds = [], items = [], limit = 6) {
    if (!resourceIds.length) return []
    const idToVec = new Map(items.map((item) => [item.id, item.vector]))
    const textMap = this.getContextTextMap(resourceIds)
    const scored = []

    for (const id of resourceIds) {
      const vec = idToVec.get(id)
      const text = textMap.get(id)
      if (!vec || !text) continue
      scored.push({ id, vec, text })
    }
    if (!scored.length) return this.getSamplesForResources(resourceIds, limit)

    const centroid = this.computeCentroid(scored.map((s) => s.vec))
    if (!centroid) return this.getSamplesForResources(resourceIds, limit)

    scored.sort(
      (a, b) => cosineSimilarity(b.vec, centroid) - cosineSimilarity(a.vec, centroid)
    )
    return scored
      .slice(0, limit)
      .map((s) => s.text)
      .filter(Boolean)
  }

  getSamplesForResources(resourceIds = [], limit = 4) {
    if (!resourceIds.length) return []
    const ph = resourceIds.slice(0, 8).map(() => '?').join(',')
    const rows = this.db
      .prepare(
        `SELECT r.title, COALESCE(ai.summary, '') AS summary, r.desc,
                COALESCE(ai.aiTitle, '') AS aiTitle, COALESCE(ai.aiDesc, '') AS aiDesc
         FROM fbw_resources r
         LEFT JOIN fbw_resource_ai ai ON ai.resourceId = r.id
         WHERE r.id IN (${ph})
         ORDER BY COALESCE(ai.aiScore, 0) DESC
         LIMIT ?`
      )
      .all(...resourceIds.slice(0, 8), limit)
    return rows
      .map((row) => row.summary || row.aiDesc || row.aiTitle || row.title || row.desc)
      .filter(Boolean)
      .slice(0, limit)
  }

  sortResourceIdsByScore(resourceIds = []) {
    if (!resourceIds.length) return []
    const scoreMin = this.getScoreMin()
    const ph = resourceIds.map(() => '?').join(',')
    const params = [...resourceIds]
    let scoreClause = ''
    if (scoreMin != null) {
      scoreClause = ' AND COALESCE(ai.aiScore, 0) >= ?'
      params.push(scoreMin)
    }
    return this.db
      .prepare(
        `SELECT r.id FROM fbw_resources r
         LEFT JOIN fbw_resource_ai ai ON ai.resourceId = r.id
         WHERE r.id IN (${ph})${scoreClause}
         ORDER BY COALESCE(ai.aiScore, 0) DESC, r.id DESC`
      )
      .all(...params)
      .map((row) => row.id)
  }

  buildThemeHint(resourceIds = [], items = []) {
    const titles =
      items.length > 0
        ? this.getTitleSamplesForResources(resourceIds, items, 3)
        : [...this.getTitleTextMap(resourceIds.slice(0, 8)).values()]
    if (titles.length) {
      return titles[0]
    }
    const samples =
      items.length > 0
        ? this.getDiverseSamplesForResources(resourceIds, items, 1)
        : this.getSamplesForResources(resourceIds, 1)
    return samples[0] || ''
  }

  filterClusterMembers(items, memberIds = []) {
    if (!memberIds.length) return []
    const idToVec = new Map(items.map((item) => [item.id, item.vector]))
    const vectors = memberIds.map((id) => idToVec.get(id)).filter(Boolean)
    const centroid = this.computeCentroid(vectors)
    if (!centroid) return []

    const minSim = AUTO_COLLECTION_CLUSTER_MIN_SIMILARITY
    return memberIds.filter((id) => {
      const vec = idToVec.get(id)
      return vec && cosineSimilarity(vec, centroid) >= minSim
    })
  }

  buildVectorCandidates(targetCount) {
    const embedCount = this.countImageEmbeddings()
    if (embedCount < AUTO_COLLECTION_MIN_EMBEDDINGS) return []

    const scoreMin = this.getScoreMin()
    const activeModel = this.getActiveVisualModelId()
    const analyzable = buildAnalyzableResourceWhere('r')
    const vecParams = [activeModel, AI_ANALYSIS_STATUS.DONE]
    let vecScoreClause = ''
    if (scoreMin != null) {
      vecScoreClause = ' AND COALESCE(ai.aiScore, 0) >= ?'
      vecParams.push(scoreMin)
    }
    const rows = this.db
      .prepare(
        `SELECT r.id, v.embedding, v.dim
         FROM fbw_resources r
         JOIN fbw_resource_image_vec_blob v ON v.resourceId = r.id AND v.model = ?
         INNER JOIN fbw_resource_ai ai ON ai.resourceId = r.id
         WHERE ${analyzable}
           AND ai.aiAnalysisStatus = ?
           AND ${COLLECTION_PRIVACY_EXCLUDE_SQL}${vecScoreClause}`
      )
      .all(...vecParams)

    const dimMap = new Map()
    for (const row of rows) {
      const dim = row.dim
      if (!dimMap.has(dim)) dimMap.set(dim, [])
      dimMap.get(dim).push({
        id: row.id,
        vector: this.vecStore.blobToFloat32(row.embedding, dim)
      })
    }

    let bestItems = []
    for (const items of dimMap.values()) {
      if (items.length > bestItems.length) bestItems = items
    }
    if (bestItems.length < AUTO_COLLECTION_MIN_EMBEDDINGS) return []

    const k = Math.min(
      Math.max(2, targetCount),
      Math.floor(bestItems.length / AUTO_COLLECTION_MIN_ITEMS)
    )
    const clusters = kMeansCluster(bestItems, k)
    const candidates = []

    clusters.forEach((cluster) => {
      const filteredMemberIds = this.filterClusterMembers(bestItems, cluster.memberIds)
      const resourceIds = this.sortResourceIdsByScore(filteredMemberIds)
      if (resourceIds.length < AUTO_COLLECTION_MIN_ITEMS) return
      const tags = this.getTagsForResources(resourceIds)
      const themeHint = this.buildThemeHint(resourceIds, bestItems)
      const clusterIndex = candidates.length
      const clusterId = `vec:${clusterIndex}`
      candidates.push({
        id: clusterId,
        type: 'vector',
        resourceIds,
        hints: {
          clusterId,
          tags,
          samples: this.getDiverseSamplesForResources(resourceIds, bestItems, 6),
          namingSamples: this.getCoreSamplesForResources(resourceIds, bestItems, 6),
          titleSamples: this.getTitleSamplesForResources(resourceIds, bestItems, 6),
          themeHint
        }
      })
    })

    return candidates
  }

  buildFallbackPlans(candidates, targetCount) {
    const locale = this.getUiLocale()
    return candidates
      .slice()
      .sort((a, b) => b.resourceIds.length - a.resourceIds.length)
      .slice(0, targetCount)
      .map((candidate) => {
        const name = resolveAtmosphereFallbackName(candidate.hints, locale)
        if (!name || !titleMatchesAppLocale(name, locale)) return null
        return {
          autoKey: candidate.id,
          name,
          prompt: buildAutoCollectionStoragePrompt(name, candidate.hints.themeHint),
          semanticQuery: candidate.hints.themeHint || name,
          tags: candidate.hints.tags || [],
          mergeIds: [candidate.id],
          resourceIds: candidate.resourceIds
        }
      })
      .filter(Boolean)
  }

  async callLlmPlans(buildPrompt, normalizePlan, candidates, targetCount, locale) {
    const raw = await this.provider.chatText(buildPrompt(candidates, targetCount))
    const json = extractJsonObject(raw)
    return normalizePlan(json, candidates, targetCount, AUTO_COLLECTION_MIN_ITEMS, locale)
  }

  async nameWithLlm(candidates, targetCount, locale = this.getUiLocale()) {
    const eligible = candidates.filter((c) => c.resourceIds.length >= AUTO_COLLECTION_MIN_ITEMS)
    if (!eligible.length) return { plans: [], usedLlm: false }

    const skillCtx = resolveSkillContext(this.settingManager, { outputLocale: locale })

    if (this.ai.enabled) {
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          const plans = await this.callLlmPlans(
            (c, n) => buildCollectionNamingPrompt(c, n, skillCtx),
            (json, c, n, min, loc) =>
              normalizeCollectionNamingPlan(json, c, n, min, loc, skillCtx),
            eligible,
            targetCount,
            locale
          )
          if (plans.length) return { plans, usedLlm: true }
        } catch (err) {
          this.logger.warn(
            `[CollectionCurator] LLM 氛围命名失败${attempt ? '（重试）' : ''}: ${err.message}`
          )
        }
      }
    }

    return { plans: this.buildFallbackPlans(eligible, targetCount), usedLlm: false }
  }

  listAutoCollections() {
    return this.db
      .prepare(`SELECT * FROM fbw_collections WHERE source = ? ORDER BY id ASC`)
      .all(COLLECTION_SOURCE.AUTO)
  }

  parseAutoKey(collection) {
    try {
      const qj = JSON.parse(collection.queryJson || '{}')
      if (qj.autoKey) return qj.autoKey
      if (qj.autoTag) return `tag:${qj.autoTag}`
      return ''
    } catch {
      return ''
    }
  }

  upsertAutoCollection(plan) {
    const { autoKey, name, prompt, resourceIds, tags = [], semanticQuery = '', mergeIds = [] } =
      plan
    const existing = this.listAutoCollections().find((c) => this.parseAutoKey(c) === autoKey)
    const scoreMin = this.getScoreMin()
    const queryJson = {
      autoKey,
      autoType:
        mergeIds.length > 1 || autoKey.startsWith('merged:')
          ? 'merged'
          : autoKey.startsWith('vec:')
            ? 'vector'
            : autoKey.split(':')[0],
      mergeIds,
      tags,
      tagsMode: 'any',
      semanticQuery,
      useSemantic: !!semanticQuery,
      scoreMin,
      sortField: 'score',
      sortType: -1,
      source: COLLECTION_SOURCE.AUTO
    }

    let collectionId
    if (existing) {
      collectionId = existing.id
      this.db
        .prepare(
          `UPDATE fbw_collections SET name = ?, prompt = ?, queryJson = ?, updated_at = datetime('now', 'localtime') WHERE id = ?`
        )
        .run(name, prompt, JSON.stringify(queryJson), collectionId)
    } else {
      const res = this.db
        .prepare(
          `INSERT INTO fbw_collections (name, prompt, queryJson, source, refreshMode)
           VALUES (?, ?, ?, ?, 'on_analysis')`
        )
        .run(name, prompt, JSON.stringify(queryJson), COLLECTION_SOURCE.AUTO)
      collectionId = res.lastInsertRowid
    }

    const sortedIds = this.sortResourceIdsByScore(resourceIds)
    this.db.prepare(`DELETE FROM fbw_collection_items WHERE collectionId = ?`).run(collectionId)
    const insert = this.db.prepare(
      `INSERT INTO fbw_collection_items (collectionId, resourceId, rank) VALUES (?, ?, ?)`
    )
    const tx = this.db.transaction(() => {
      sortedIds.forEach((resourceId, index) => {
        insert.run(collectionId, resourceId, index + 1)
      })
    })
    tx()

    this.db
      .prepare(
        `UPDATE fbw_collections SET lastGeneratedAt = datetime('now', 'localtime'), updated_at = datetime('now', 'localtime') WHERE id = ?`
      )
      .run(collectionId)

    return collectionId
  }

  removeLegacyTagAutoCollections() {
    let removed = 0
    for (const col of this.listAutoCollections()) {
      const key = this.parseAutoKey(col)
      let isLegacyTag = key?.startsWith('tag:')
      if (!isLegacyTag) {
        try {
          const qj = JSON.parse(col.queryJson || '{}')
          if (qj.autoType === 'tag' || qj.autoTag) isLegacyTag = true
        } catch {
          /* ignore */
        }
      }
      if (!isLegacyTag) continue
      this.db.prepare(`DELETE FROM fbw_collection_items WHERE collectionId = ?`).run(col.id)
      this.db.prepare(`DELETE FROM fbw_collections WHERE id = ?`).run(col.id)
      this.logger.info(`[CollectionCurator] 移除旧版标签系统合集: ${col.name}`)
      removed++
    }
    return removed
  }

  removeStaleAutoCollections(activeKeys) {
    const activeSet = new Set(activeKeys)
    for (const col of this.listAutoCollections()) {
      const key = this.parseAutoKey(col)
      if (!key || !activeSet.has(key)) {
        this.deleteAutoCollection(col, '移除未入选系统合集')
      }
    }
  }

  deleteAutoCollection(col, reason = '移除系统合集') {
    this.db.prepare(`DELETE FROM fbw_collection_items WHERE collectionId = ?`).run(col.id)
    this.db.prepare(`DELETE FROM fbw_collections WHERE id = ?`).run(col.id)
    const key = this.parseAutoKey(col)
    this.logger.info(
      `[CollectionCurator] ${reason}: ${col.name}${key ? ` (${key})` : ''}`
    )
  }

  getAutoCollectionMemberIds(collectionId) {
    return this.db
      .prepare(
        `SELECT ci.resourceId FROM fbw_collection_items ci
         JOIN fbw_resources r ON r.id = ci.resourceId
         WHERE ci.collectionId = ?
         ORDER BY ci.rank ASC`
      )
      .all(collectionId)
      .map((row) => row.resourceId)
  }

  mergeDuplicatePlans(plans = []) {
    const before = plans.length
    const merged = mergeCollectionPlans(plans)
    if (merged.length < before) {
      this.logger.info(`[CollectionCurator] 合并重复 plan：${before} → ${merged.length}`)
    }
    return merged
  }

  /** 将 plan 对齐到库内已有同名/高重叠合集，避免 progressive 叠加重复行 */
  reconcilePlansWithExistingAutoCollections(plans = []) {
    const autoKeysToRemove = new Set()
    const existing = this.listAutoCollections()

    for (const plan of plans) {
      const matches = existing.filter((col) => {
        const key = this.parseAutoKey(col)
        if (key === plan.autoKey) return false
        const memberIds = this.getAutoCollectionMemberIds(col.id)
        return shouldMergeCollectionPlans({ name: col.name, resourceIds: memberIds }, plan)
      })
      if (!matches.length) continue

      matches.sort((a, b) => a.id - b.id)
      const keeper = matches[0]
      const keeperKey = this.parseAutoKey(keeper)
      if (!keeperKey) continue

      if (plan.autoKey !== keeperKey) {
        this.logger.info(
          `[CollectionCurator] plan「${plan.name}」${plan.autoKey} 合并至已有 id=${keeper.id} (${keeperKey})`
        )
        if (plan.autoKey) autoKeysToRemove.add(plan.autoKey)
        plan.autoKey = keeperKey
        plan.mergeIds = [keeperKey]
      }

      for (let i = 1; i < matches.length; i++) {
        const key = this.parseAutoKey(matches[i])
        if (key) autoKeysToRemove.add(key)
      }
    }

    return autoKeysToRemove
  }

  removeAutoCollectionsByAutoKeys(autoKeys = []) {
    const keySet = new Set(autoKeys.filter(Boolean))
    if (!keySet.size) return 0
    let removed = 0
    for (const col of this.listAutoCollections()) {
      const key = this.parseAutoKey(col)
      if (key && keySet.has(key)) {
        this.deleteAutoCollection(col, '移除重复系统合集')
        removed++
      }
    }
    return removed
  }

  /** 扫描库内系统合集，合并同名或成员高重叠的重复项（保留 id 最小者） */
  dedupeExistingAutoCollections() {
    const cols = this.listAutoCollections()
    const toRemove = new Set()

    for (let i = 0; i < cols.length; i++) {
      if (toRemove.has(cols[i].id)) continue
      const idsI = this.getAutoCollectionMemberIds(cols[i].id)
      for (let j = i + 1; j < cols.length; j++) {
        if (toRemove.has(cols[j].id)) continue
        const idsJ = this.getAutoCollectionMemberIds(cols[j].id)
        if (
          !shouldMergeCollectionPlans(
            { name: cols[i].name, resourceIds: idsI },
            { name: cols[j].name, resourceIds: idsJ }
          )
        ) {
          continue
        }
        const removeCol = cols[i].id < cols[j].id ? cols[j] : cols[i]
        const keepCol = cols[i].id < cols[j].id ? cols[i] : cols[j]
        toRemove.add(removeCol.id)
        this.logger.info(
          `[CollectionCurator] 合并重复系统合集：移除 id=${removeCol.id}「${removeCol.name}」，保留 id=${keepCol.id}`
        )
      }
    }

    for (const col of cols) {
      if (!toRemove.has(col.id)) continue
      this.deleteAutoCollection(col, '移除重复系统合集')
    }
    return toRemove.size
  }

  countCollectionItems(collectionId) {
    return (
      this.db
        .prepare(
          `SELECT COUNT(*) as c FROM fbw_collection_items ci
           JOIN fbw_resources r ON r.id = ci.resourceId
           WHERE ci.collectionId = ?`
        )
        .get(collectionId)?.c || 0
    )
  }

  /** 仅移除空合集或不足最少张数的系统合集（不按 targetCount 裁剪） */
  pruneInvalidAutoCollections() {
    let removed = 0
    for (const col of this.listAutoCollections()) {
      const count = this.countCollectionItems(col.id)
      if (count >= AUTO_COLLECTION_MIN_ITEMS) continue
      this.db.prepare(`DELETE FROM fbw_collection_items WHERE collectionId = ?`).run(col.id)
      this.db.prepare(`DELETE FROM fbw_collections WHERE id = ?`).run(col.id)
      this.logger.info(
        `[CollectionCurator] 移除无效系统合集: ${col.name}（${count} 张，少于 ${AUTO_COLLECTION_MIN_ITEMS}）`
      )
      removed++
    }
    return removed
  }


  getResourceImageVector(resourceId) {
    const model = this.getActiveVisualModelId()
    const row = this.db
      .prepare(
        `SELECT embedding, dim FROM fbw_resource_image_vec_blob WHERE resourceId = ? AND model = ?`
      )
      .get(resourceId, model)
    if (!row) return null
    return this.vecStore.blobToFloat32(row.embedding, row.dim)
  }

  getCollectionMemberVectors(resourceIds = []) {
    if (!resourceIds.length) return []
    const model = this.getActiveVisualModelId()
    const ph = resourceIds.map(() => '?').join(',')
    const rows = this.db
      .prepare(
        `SELECT embedding, dim FROM fbw_resource_image_vec_blob
         WHERE resourceId IN (${ph}) AND model = ?`
      )
      .all(...resourceIds, model)
    return rows.map((row) => this.vecStore.blobToFloat32(row.embedding, row.dim))
  }

  computeCentroid(vectors = []) {
    if (!vectors.length) return null
    const dim = vectors[0].length
    const sum = new Array(dim).fill(0)
    for (const vec of vectors) {
      for (let i = 0; i < dim; i++) sum[i] += vec[i]
    }
    const n = vectors.length
    for (let i = 0; i < dim; i++) sum[i] /= n
    const norm = Math.sqrt(sum.reduce((acc, v) => acc + v * v, 0)) || 1
    return sum.map((v) => v / norm)
  }

  /**
   * 锁存后：新分析完成的资源（图片 / 有封面视频）按画面向量相似度增量加入已有氛围合集
   */
  incrementalAddResource(resourceId) {
    if (!this.isEnabled() || !isAutoCurateSettled(this.ai)) {
      return { success: true, data: { added: 0, skipped: true } }
    }

    const analyzable = buildAnalyzableResourceWhere('r')
    const row = this.db
      .prepare(
        `SELECT r.id, COALESCE(ai.aiScore, 0) AS score, ai.aiAnalysisStatus
         FROM fbw_resources r
         LEFT JOIN fbw_resource_ai ai ON ai.resourceId = r.id
         WHERE r.id = ? AND ${analyzable} AND ${COLLECTION_PRIVACY_EXCLUDE_SQL}`
      )
      .get(resourceId)
    if (!row || row.aiAnalysisStatus !== AI_ANALYSIS_STATUS.DONE) {
      return { success: true, data: { added: 0 } }
    }

    const scoreMin = this.getScoreMin()
    if (scoreMin != null && (row.score ?? 0) < scoreMin) {
      return { success: true, data: { added: 0 } }
    }

    const resourceVec = this.getResourceImageVector(resourceId)
    if (!resourceVec) {
      return { success: true, data: { added: 0 } }
    }

    let bestCollection = null
    let bestSimilarity = AUTO_COLLECTION_INCREMENTAL_MIN_SIMILARITY

    for (const col of this.listAutoCollections()) {
      const autoKey = this.parseAutoKey(col)
      if (autoKey?.startsWith('tag:')) continue

      const memberRows = this.db
        .prepare(
          `SELECT ci.resourceId FROM fbw_collection_items ci
           JOIN fbw_resources r ON r.id = ci.resourceId
           WHERE ci.collectionId = ?`
        )
        .all(col.id)
      const memberIds = memberRows.map((r) => r.resourceId)
      if (!memberIds.length) continue

      const memberVectors = this.getCollectionMemberVectors(memberIds)
      const centroid = this.computeCentroid(memberVectors)
      if (!centroid) continue

      const similarity = cosineSimilarity(resourceVec, centroid)
      if (similarity >= bestSimilarity) {
        bestSimilarity = similarity
        bestCollection = col
      }
    }

    if (!bestCollection) {
      return { success: true, data: { added: 0 } }
    }

    if (
      !resourceMatchesCollectionTitle(
        bestCollection.name,
        this.getResourceHintsForTitleCheck(resourceId)
      )
    ) {
      return { success: true, data: { added: 0, skipped: true, reason: 'title_mismatch' } }
    }

    const exists = this.db
      .prepare(`SELECT 1 FROM fbw_collection_items WHERE collectionId = ? AND resourceId = ? LIMIT 1`)
      .get(bestCollection.id, resourceId)
    if (exists) {
      return { success: true, data: { added: 0 } }
    }

    const maxRank =
      this.db
        .prepare(`SELECT MAX(rank) as m FROM fbw_collection_items WHERE collectionId = ?`)
        .get(bestCollection.id)?.m ?? 0
    this.db
      .prepare(`INSERT INTO fbw_collection_items (collectionId, resourceId, rank) VALUES (?, ?, ?)`)
      .run(bestCollection.id, resourceId, maxRank + 1)
    this.db
      .prepare(`UPDATE fbw_collections SET updated_at = datetime('now', 'localtime') WHERE id = ?`)
      .run(bestCollection.id)

    this.logger.info(
      `[CollectionCurator] 增量加入资源 ${resourceId} → 氛围合集「${bestCollection.name}」(sim=${bestSimilarity.toFixed(3)})`
    )

    return { success: true, data: { added: 1 } }
  }

  getStats() {
    const analyzed = this.countAnalyzedImages()
    const embeddings = this.countEmbeddings()
    const target = computeAutoCollectionCount(analyzed, this.ai)
    const autoCount = this.listAutoCollections().length
    const ai = this.ai
    return {
      enabled: this.isEnabled(),
      aiEnabled: !!ai.enabled,
      autoCollectionsEnabled: ai.autoCollectionsEnabled !== false,
      autoCurateSettled: ai.autoCurateSettled === true,
      autoCurateSettledAnalyzed: Number(ai.autoCurateSettledAnalyzed) || 0,
      curatePhase: ai.autoCurateSettled === true ? 'settled' : 'progressive',
      analyzed,
      embeddings,
      targetCollections: target,
      autoCollections: autoCount
    }
  }

  async run(locks, { manual = false, pipelineStable = false } = {}) {
    if (!this.isEnabled()) {
      return { success: true, data: { skipped: true, reason: 'disabled' } }
    }
    if (!manual && isAutoCurateSettled(this.ai)) {
      return { success: true, data: { skipped: true, reason: 'settled' } }
    }
    if (locks.collectionCurator) {
      return { success: true, data: { skipped: true, reason: 'busy' } }
    }

    locks.collectionCurator = true
    try {
      const analyzed = this.countAnalyzedImages()
      const embeddings = this.countEmbeddings()
      const targetCount = computeAutoCollectionCount(analyzed, this.ai)
      if (!targetCount) {
        return {
          success: true,
          data: {
            analyzed,
            embeddings,
            phase: manual ? 'manual' : 'progressive',
            created: 0,
            updated: 0,
            removed: 0
          },
          message: t('messages.operationSuccess')
        }
      }

      const isFinalize = !manual && pipelineStable
      const candidateLimit = manual || isFinalize
        ? targetCount
        : resolveAutoCollectionCountMax(this.ai)

      const legacyRemoved = this.removeLegacyTagAutoCollections()
      const vectorCandidates = this.buildVectorCandidates(candidateLimit)
      const candidates = vectorCandidates

      if (!candidates.length) {
        return {
          success: true,
          data: {
            analyzed,
            embeddings,
            phase: manual ? 'manual' : isFinalize ? 'finalize' : 'progressive',
            created: 0,
            updated: 0,
            removed: legacyRemoved,
            autoCollections: this.listAutoCollections().length
          },
          message: t('messages.operationSuccess')
        }
      }

      const planCap =
        manual || isFinalize
          ? targetCount
          : Math.min(candidates.length, resolveAutoCollectionCountMax(this.ai))

      let plans
      let usedLlm = false
      const planLimit = manual || isFinalize ? targetCount : planCap
      const locale = this.getUiLocale()
      if (this.ai.enabled) {
        const named = await this.nameWithLlm(candidates, planLimit, locale)
        plans = named.plans
        usedLlm = named.usedLlm
      } else {
        plans = this.buildFallbackPlans(candidates, planLimit)
      }

      plans = plans.map((p) => this.refinePlanMembersByTitle(p)).filter(Boolean)
      plans = this.mergeDuplicatePlans(plans)
      const duplicateAutoKeys = this.reconcilePlansWithExistingAutoCollections(plans)

      const beforeAuto = this.listAutoCollections().length

      for (const plan of plans) {
        this.upsertAutoCollection(plan)
      }

      let removed = legacyRemoved
      removed += this.removeAutoCollectionsByAutoKeys([...duplicateAutoKeys])
      removed += this.dedupeExistingAutoCollections()

      if (manual || isFinalize) {
        const beforeStale = this.listAutoCollections().length
        this.removeStaleAutoCollections(plans.map((p) => p.autoKey))
        removed += Math.max(0, beforeStale - this.listAutoCollections().length)
      } else {
        removed += this.pruneInvalidAutoCollections()
      }

      const afterAuto = this.listAutoCollections().length
      const created = Math.max(0, afterAuto - beforeAuto)
      const phase = manual ? 'manual' : isFinalize ? 'finalize' : 'progressive'

      this.logger.info(
        `[CollectionCurator] 完成${manual ? '（手动）' : ''} [${phase}]：氛围候选 ${vectorCandidates.length} → 写入 ${plans.length} 个计划，当前共 ${afterAuto} 个系统合集`
      )

      return {
        success: true,
        data: {
          analyzed,
          embeddings,
          targetCount,
          phase,
          vectorCandidates: vectorCandidates.length,
          finalCollections: plans.length,
          created,
          updated: Math.max(0, plans.length - created),
          removed,
          autoCollections: afterAuto,
          usedLlm,
          pipelineStable: !!pipelineStable
        },
        message: t('messages.operationSuccess')
      }
    } catch (err) {
      this.logger.error(`[CollectionCurator] ${err.message}`)
      return { success: false, message: String(err.message || err) }
    } finally {
      locks.collectionCurator = false
    }
  }
}
