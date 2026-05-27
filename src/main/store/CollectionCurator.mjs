import { AI_ANALYSIS_STATUS } from '../ai/aiConstants.mjs'
import AiAnalysisProvider from '../ai/AiAnalysisProvider.mjs'
import VecStore from '../ai/VecStore.mjs'
import { kMeansCluster } from '../ai/VectorCluster.mjs'
import { buildCollectionMergePrompt } from '../ai/AiPrompts.mjs'
import { extractJsonObject, normalizeCollectionMergePlan } from '../ai/AiResponseParser.mjs'
import { t } from '../../i18n/server.js'
import {
  AUTO_COLLECTION_ITEM_LIMIT,
  AUTO_COLLECTION_MIN_EMBEDDINGS,
  AUTO_COLLECTION_MIN_ITEMS,
  AUTO_COLLECTION_MIN_TAG_RESOURCES,
  COLLECTION_SOURCE,
  computeAutoCollectionCount,
  isValidAutoCollectionTag
} from './collectionConstants.mjs'

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
    CollectionCurator._instance = this
  }

  get ai() {
    return this.settingManager.settingData?.ai || {}
  }

  isEnabled() {
    return !!this.ai.enabled && this.ai.autoCollectionsEnabled !== false
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

  countEmbeddings() {
    return (
      this.db
        .prepare(
          `SELECT COUNT(*) as c
           FROM fbw_resource_vec_blob v
           JOIN fbw_resources r ON r.id = v.resourceId
           WHERE r.fileType='image' AND r.aiAnalysisStatus = ?`
        )
        .get(AI_ANALYSIS_STATUS.DONE)?.c || 0
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
         GROUP BY w.word
         HAVING cnt >= ?
         ORDER BY cnt DESC, w.word ASC`
      )
      .all(AI_ANALYSIS_STATUS.DONE, AUTO_COLLECTION_MIN_TAG_RESOURCES)

    return rows.filter((row) => isValidAutoCollectionTag(row.tag)).slice(0, limit)
  }

  getResourceIdsForTag(tag, limit = AUTO_COLLECTION_ITEM_LIMIT) {
    return this.db
      .prepare(
        `SELECT r.id
         FROM fbw_resources r
         JOIN fbw_resource_words rw ON rw.resourceId = r.id
         JOIN fbw_words w ON w.id = rw.wordId
         WHERE r.fileType = 'image'
           AND r.aiAnalysisStatus = ?
           AND w.word = ?
         ORDER BY r.score DESC, r.id DESC
         LIMIT ?`
      )
      .all(AI_ANALYSIS_STATUS.DONE, tag, limit)
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

  sortResourceIdsByScore(resourceIds = [], limit = AUTO_COLLECTION_ITEM_LIMIT) {
    if (!resourceIds.length) return []
    const ph = resourceIds.map(() => '?').join(',')
    return this.db
      .prepare(
        `SELECT id FROM fbw_resources WHERE id IN (${ph}) ORDER BY score DESC, id DESC LIMIT ?`
      )
      .all(...resourceIds, limit)
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
    const embedCount = this.countEmbeddings()
    if (embedCount < AUTO_COLLECTION_MIN_EMBEDDINGS) return []

    const rows = this.db
      .prepare(
        `SELECT r.id, v.embedding, v.dim
         FROM fbw_resources r
         JOIN fbw_resource_vec_blob v ON v.resourceId = r.id
         WHERE r.fileType = 'image' AND r.aiAnalysisStatus = ?`
      )
      .all(AI_ANALYSIS_STATUS.DONE)

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
          themeHint: tags.slice(0, 3).join('、') || '视觉语义相近的壁纸'
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
              : `氛围推荐：${candidate.hints.themeHint || '语义相近壁纸'}`,
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
    const queryJson = {
      autoKey,
      autoType: mergeIds.length > 1 || autoKey.startsWith('merged:') ? 'merged' : autoKey.split(':')[0],
      mergeIds,
      tags,
      tagsMode: 'any',
      semanticQuery,
      useSemantic: !!semanticQuery,
      limitCount: AUTO_COLLECTION_ITEM_LIMIT,
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
        this.logger.info(`[CollectionCurator] 移除过期系统合集: ${col.name}`)
      }
    }
  }

  getStats() {
    const analyzed = this.countAnalyzedImages()
    const embeddings = this.countEmbeddings()
    const target = computeAutoCollectionCount(analyzed)
    const autoCount = this.listAutoCollections().length
    return {
      enabled: this.isEnabled(),
      aiEnabled: !!this.ai.enabled,
      autoCollectionsEnabled: this.ai.autoCollectionsEnabled !== false,
      analyzed,
      embeddings,
      targetCollections: target,
      autoCollections: autoCount
    }
  }

  async run(locks) {
    if (!this.isEnabled()) {
      return { success: true, data: { skipped: true, reason: 'disabled' } }
    }
    if (locks.collectionCurator) {
      return { success: true, data: { skipped: true, reason: 'busy' } }
    }

    locks.collectionCurator = true
    try {
      const analyzed = this.countAnalyzedImages()
      const embeddings = this.countEmbeddings()
      const targetCount = computeAutoCollectionCount(analyzed)
      if (!targetCount) {
        return {
          success: true,
          data: { analyzed, embeddings, created: 0, updated: 0, removed: 0 },
          message: t('messages.operationSuccess')
        }
      }

      const tagCandidates = this.buildTagCandidates(targetCount)
      const vectorCandidates = this.buildVectorCandidates(targetCount)
      const candidates = [...tagCandidates, ...vectorCandidates]

      if (!candidates.length) {
        return {
          success: true,
          data: { analyzed, embeddings, created: 0, updated: 0, removed: 0, autoCollections: 0 },
          message: t('messages.operationSuccess')
        }
      }

      const plans = await this.mergeWithLlm(candidates, targetCount)
      const beforeAuto = this.listAutoCollections().length

      for (const plan of plans) {
        this.upsertAutoCollection(plan)
      }
      this.removeStaleAutoCollections(plans.map((p) => p.autoKey))

      const afterAuto = this.listAutoCollections().length
      const created = Math.max(0, afterAuto - beforeAuto)
      const updated = Math.max(0, plans.length - created)

      this.logger.info(
        `[CollectionCurator] 完成：候选 标签${tagCandidates.length}+向量${vectorCandidates.length} → 最终${plans.length} 个系统合集`
      )

      return {
        success: true,
        data: {
          analyzed,
          embeddings,
          targetCount,
          tagCandidates: tagCandidates.length,
          vectorCandidates: vectorCandidates.length,
          finalCollections: plans.length,
          created,
          updated,
          autoCollections: afterAuto,
          usedLlm: plans.some((p) => p.autoKey.startsWith('merged:'))
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
