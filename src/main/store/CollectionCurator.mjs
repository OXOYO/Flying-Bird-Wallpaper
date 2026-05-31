import { AI_ANALYSIS_STATUS } from '../ai/aiConstants.mjs'
import AiAnalysisProvider from '../ai/AiAnalysisProvider.mjs'
import EmbeddingManager from '../ai/EmbeddingManager.mjs'
import VecStore from '../ai/VecStore.mjs'
import { kMeansCluster } from '../ai/VectorCluster.mjs'
import { buildCollectionMergePrompt } from '../ai/AiPrompts.mjs'
import { extractJsonObject, normalizeCollectionMergePlan } from '../ai/AiResponseParser.mjs'
import { t } from '../../i18n/server.js'
import {
  AUTO_COLLECTION_MIN_EMBEDDINGS,
  AUTO_COLLECTION_MIN_ITEMS,
  AUTO_COLLECTION_MIN_TAG_RESOURCES,
  COLLECTION_SOURCE,
  computeAutoCollectionCount,
  isValidAutoCollectionTag,
  resolveAutoCollectionCountMax,
  resolveAutoCollectionScoreMin,
  COLLECTION_PRIVACY_EXCLUDE_SQL
} from './collectionConstants.mjs'
import { isAutoCurateSettled } from './collectionCurateGate.mjs'

/**
 * 自动策展：标签候选 + 向量聚类 + LLM 命名合并
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

  isEnabled() {
    return !!this.ai.enabled && this.ai.autoCollectionsEnabled !== false
  }

  getScoreMin() {
    return resolveAutoCollectionScoreMin(this.ai)
  }

  countAnalyzedImages() {
    return (
      this.db
        .prepare(
          `SELECT COUNT(*) as c FROM fbw_resources WHERE fileType='image' AND aiAnalysisStatus = ?`
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
    return (
      this.db
        .prepare(
          `SELECT COUNT(*) as c
           FROM fbw_resource_image_vec_blob v
           JOIN fbw_resources r ON r.id = v.resourceId
           WHERE r.fileType='image' AND r.aiAnalysisStatus = ? AND v.model = ?`
        )
        .get(AI_ANALYSIS_STATUS.DONE, model)?.c || 0
    )
  }

  getTopTags(limit) {
    const rows = this.db
      .prepare(
        `SELECT w.word AS tag, COUNT(DISTINCT rw.resourceId) AS cnt
         FROM fbw_words w
         JOIN fbw_resource_words rw ON rw.wordId = w.id
         JOIN fbw_resources r ON r.id = rw.resourceId
         WHERE r.fileType = 'image'
           AND r.aiAnalysisStatus = ?
           AND ${COLLECTION_PRIVACY_EXCLUDE_SQL}
         GROUP BY w.word
         HAVING cnt >= ?
         ORDER BY cnt DESC, w.word ASC`
      )
      .all(AI_ANALYSIS_STATUS.DONE, AUTO_COLLECTION_MIN_TAG_RESOURCES)

    return rows.filter((row) => isValidAutoCollectionTag(row.tag)).slice(0, limit)
  }

  getResourceIdsForTag(tag) {
    const scoreMin = this.getScoreMin()
    const params = [AI_ANALYSIS_STATUS.DONE, tag]
    let scoreClause = ''
    if (scoreMin != null) {
      scoreClause = ' AND r.score >= ?'
      params.push(scoreMin)
    }
    return this.db
      .prepare(
        `SELECT r.id
         FROM fbw_resources r
         JOIN fbw_resource_words rw ON rw.resourceId = r.id
         JOIN fbw_words w ON w.id = rw.wordId
         WHERE r.fileType = 'image'
           AND r.aiAnalysisStatus = ?
           AND ${COLLECTION_PRIVACY_EXCLUDE_SQL}
           AND w.word = ?${scoreClause}
         ORDER BY r.score DESC, r.id DESC`
      )
      .all(...params)
      .map((row) => row.id)
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

  getSamplesForResources(resourceIds = [], limit = 4) {
    if (!resourceIds.length) return []
    const ph = resourceIds.slice(0, 8).map(() => '?').join(',')
    const rows = this.db
      .prepare(
        `SELECT title, summary, desc
         FROM fbw_resources
         WHERE id IN (${ph})
         ORDER BY score DESC
         LIMIT ?`
      )
      .all(...resourceIds.slice(0, 8), limit)
    return rows
      .map((row) => row.summary || row.title || row.desc)
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
      scoreClause = ' AND score >= ?'
      params.push(scoreMin)
    }
    return this.db
      .prepare(
        `SELECT id FROM fbw_resources WHERE id IN (${ph})${scoreClause} ORDER BY score DESC, id DESC`
      )
      .all(...params)
      .map((row) => row.id)
  }

  buildTagCandidates(targetCount) {
    const tagRows = this.getTopTags(targetCount * 2)
    const candidates = []
    for (const row of tagRows) {
      const resourceIds = this.getResourceIdsForTag(row.tag)
      if (resourceIds.length < AUTO_COLLECTION_MIN_ITEMS) continue
      candidates.push({
        id: `tag:${row.tag}`,
        type: 'tag',
        resourceIds,
        hints: {
          label: row.tag,
          tags: [row.tag, ...this.getTagsForResources(resourceIds).slice(0, 6)],
          samples: this.getSamplesForResources(resourceIds)
        }
      })
    }
    return candidates
  }

  buildVectorCandidates(targetCount) {
    const embedCount = this.countImageEmbeddings()
    if (embedCount < AUTO_COLLECTION_MIN_EMBEDDINGS) return []

    const scoreMin = this.getScoreMin()
    const activeModel = this.getActiveVisualModelId()
    const vecParams = [activeModel, AI_ANALYSIS_STATUS.DONE]
    let vecScoreClause = ''
    if (scoreMin != null) {
      vecScoreClause = ' AND r.score >= ?'
      vecParams.push(scoreMin)
    }
    const rows = this.db
      .prepare(
        `SELECT r.id, v.embedding, v.dim
         FROM fbw_resources r
         JOIN fbw_resource_image_vec_blob v ON v.resourceId = r.id AND v.model = ?
         WHERE r.fileType = 'image'
           AND r.aiAnalysisStatus = ?
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
      Math.max(2, Math.ceil(targetCount / 2)),
      Math.floor(bestItems.length / AUTO_COLLECTION_MIN_ITEMS),
      8
    )
    const clusters = kMeansCluster(bestItems, k)
    const candidates = []

    clusters.forEach((cluster, index) => {
      const resourceIds = this.sortResourceIdsByScore(cluster.memberIds)
      if (resourceIds.length < AUTO_COLLECTION_MIN_ITEMS) return
      const tags = this.getTagsForResources(resourceIds)
      candidates.push({
        id: `vec:${index}`,
        type: 'vector',
        resourceIds,
        hints: {
          label: `氛围 ${index + 1}`,
          tags,
          samples: this.getSamplesForResources(resourceIds),
          themeHint: tags.slice(0, 3).join('、') || '画面视觉相近的壁纸'
        }
      })
    })

    return candidates
  }

  buildFallbackPlans(candidates, targetCount) {
    return candidates
      .slice()
      .sort((a, b) => b.resourceIds.length - a.resourceIds.length)
      .slice(0, targetCount)
      .map((candidate) => {
        const name =
          candidate.type === 'tag'
            ? candidate.hints.label
            : candidate.hints.themeHint
              ? `${candidate.hints.themeHint}`
              : `氛围合集 ${candidate.hints.label}`
        return {
          autoKey: candidate.id,
          name: String(name).slice(0, 40),
          prompt:
            candidate.type === 'tag'
              ? `系统推荐：${candidate.hints.label}`
              : `氛围推荐：${candidate.hints.themeHint || '画面相近壁纸'}`,
          semanticQuery: candidate.hints.themeHint || candidate.hints.label || '',
          tags: candidate.hints.tags || [],
          mergeIds: [candidate.id],
          resourceIds: candidate.resourceIds
        }
      })
  }

  async mergeWithLlm(candidates, targetCount) {
    if (!candidates.length) return []

    if (this.ai.enabled && candidates.length >= 2) {
      try {
        const raw = await this.provider.chatText(buildCollectionMergePrompt(candidates, targetCount))
        const json = extractJsonObject(raw)
        const plans = normalizeCollectionMergePlan(json, candidates, targetCount, AUTO_COLLECTION_MIN_ITEMS)
        if (plans.length) return plans
      } catch (err) {
        this.logger.warn(`[CollectionCurator] LLM 合并失败，使用降级策略: ${err.message}`)
      }
    }

    return this.buildFallbackPlans(candidates, targetCount)
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
      autoType: mergeIds.length > 1 || autoKey.startsWith('merged:') ? 'merged' : autoKey.split(':')[0],
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

  removeStaleAutoCollections(activeKeys) {
    const activeSet = new Set(activeKeys)
    for (const col of this.listAutoCollections()) {
      const key = this.parseAutoKey(col)
      if (!key || !activeSet.has(key)) {
        this.db.prepare(`DELETE FROM fbw_collection_items WHERE collectionId = ?`).run(col.id)
        this.db.prepare(`DELETE FROM fbw_collections WHERE id = ?`).run(col.id)
        this.logger.info(`[CollectionCurator] 移除未入选系统合集: ${col.name}`)
      }
    }
  }

  countCollectionItems(collectionId) {
    return (
      this.db
        .prepare(`SELECT COUNT(*) as c FROM fbw_collection_items WHERE collectionId = ?`)
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

  getResourceTags(resourceId) {
    const rows = this.db
      .prepare(
        `SELECT DISTINCT w.word AS tag
         FROM fbw_resource_words rw
         JOIN fbw_words w ON w.id = rw.wordId
         WHERE rw.resourceId = ?
         ORDER BY w.word ASC`
      )
      .all(resourceId)
    return rows.map((r) => r.tag).filter(isValidAutoCollectionTag)
  }

  /**
   * 锁存后：新分析完成的图按标签增量加入已有系统合集（不删组、不 LLM）
   */
  incrementalAddResource(resourceId) {
    if (!this.isEnabled() || !isAutoCurateSettled(this.ai)) {
      return { success: true, data: { added: 0, skipped: true } }
    }

    const row = this.db
      .prepare(
        `SELECT id, score, aiAnalysisStatus FROM fbw_resources WHERE id = ? AND fileType = 'image'`
      )
      .get(resourceId)
    if (!row || row.aiAnalysisStatus !== AI_ANALYSIS_STATUS.DONE) {
      return { success: true, data: { added: 0 } }
    }

    const scoreMin = this.getScoreMin()
    if (scoreMin != null && (row.score ?? 0) < scoreMin) {
      return { success: true, data: { added: 0 } }
    }

    const resourceTags = this.getResourceTags(resourceId)
    if (!resourceTags.length) {
      return { success: true, data: { added: 0 } }
    }

    const resourceTagSet = new Set(resourceTags.map((tag) => tag.toLowerCase()))
    let added = 0

    for (const col of this.listAutoCollections()) {
      let queryJson = {}
      try {
        queryJson = JSON.parse(col.queryJson || '{}')
      } catch {
        queryJson = {}
      }

      const colTags = []
      if (Array.isArray(queryJson.tags)) {
        queryJson.tags.forEach((tag) => {
          if (tag) colTags.push(String(tag))
        })
      }
      const autoKey = this.parseAutoKey(col)
      if (autoKey?.startsWith('tag:')) {
        colTags.push(autoKey.slice(4))
      }

      const matches = colTags.some((tag) => resourceTagSet.has(String(tag).toLowerCase()))
      if (!matches) continue

      const exists = this.db
        .prepare(
          `SELECT 1 FROM fbw_collection_items WHERE collectionId = ? AND resourceId = ? LIMIT 1`
        )
        .get(col.id, resourceId)
      if (exists) continue

      const maxRank =
        this.db
          .prepare(`SELECT MAX(rank) as m FROM fbw_collection_items WHERE collectionId = ?`)
          .get(col.id)?.m ?? 0
      this.db
        .prepare(
          `INSERT INTO fbw_collection_items (collectionId, resourceId, rank) VALUES (?, ?, ?)`
        )
        .run(col.id, resourceId, maxRank + 1)
      this.db
        .prepare(
          `UPDATE fbw_collections SET updated_at = datetime('now', 'localtime') WHERE id = ?`
        )
        .run(col.id)
      added++
    }

    if (added > 0) {
      this.logger.info(`[CollectionCurator] 增量加入资源 ${resourceId} → ${added} 个系统合集`)
    }

    return { success: true, data: { added } }
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

      const tagCandidates = this.buildTagCandidates(candidateLimit)
      const vectorCandidates = this.buildVectorCandidates(candidateLimit)
      const candidates = [...tagCandidates, ...vectorCandidates]

      if (!candidates.length) {
        return {
          success: true,
          data: {
            analyzed,
            embeddings,
            phase: manual ? 'manual' : isFinalize ? 'finalize' : 'progressive',
            created: 0,
            updated: 0,
            removed: 0,
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
      if (manual || isFinalize) {
        plans = await this.mergeWithLlm(candidates, targetCount)
        usedLlm = plans.some((p) => p.autoKey.startsWith('merged:'))
      } else {
        plans = this.buildFallbackPlans(candidates, planCap)
      }

      const beforeAuto = this.listAutoCollections().length

      for (const plan of plans) {
        this.upsertAutoCollection(plan)
      }

      let removed = 0
      if (manual) {
        this.removeStaleAutoCollections(plans.map((p) => p.autoKey))
        removed = Math.max(0, beforeAuto - this.listAutoCollections().length)
      } else {
        removed = this.pruneInvalidAutoCollections()
      }

      const afterAuto = this.listAutoCollections().length
      const created = Math.max(0, afterAuto - beforeAuto)
      const phase = manual ? 'manual' : isFinalize ? 'finalize' : 'progressive'

      this.logger.info(
        `[CollectionCurator] 完成${manual ? '（手动）' : ''} [${phase}]：候选 标签${tagCandidates.length}+向量${vectorCandidates.length} → 写入${plans.length} 个计划，当前共 ${afterAuto} 个系统合集`
      )

      return {
        success: true,
        data: {
          analyzed,
          embeddings,
          targetCount,
          phase,
          tagCandidates: tagCandidates.length,
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
