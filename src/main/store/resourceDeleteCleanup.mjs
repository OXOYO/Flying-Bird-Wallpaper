/** 删除资源时清理附表数据（向量、标签关联、合集快照等） */

export function decrementWordCountsForResourceIds(db, resourceIds = []) {
  if (!resourceIds.length) return
  const ph = resourceIds.map(() => '?').join(',')
  const wordRows = db
    .prepare(
      `SELECT wordId, COUNT(*) AS linkCount
       FROM fbw_resource_words
       WHERE resourceId IN (${ph})
       GROUP BY wordId`
    )
    .all(...resourceIds)
  db.prepare(`DELETE FROM fbw_resource_words WHERE resourceId IN (${ph})`).run(...resourceIds)
  if (!wordRows.length) return
  const decrementStmt = db.prepare(
    `UPDATE fbw_words SET count = MAX(count - ?, 0), updated_at = datetime('now', 'localtime') WHERE id = ?`
  )
  const tx = db.transaction(() => {
    for (const row of wordRows) {
      const wordId = row.wordId
      const linkCount = Number(row.linkCount) || 0
      if (wordId != null && linkCount > 0) {
        decrementStmt.run(linkCount, wordId)
      }
    }
    db.prepare(`DELETE FROM fbw_words WHERE count <= 0`).run()
  })
  tx()
}

export function deleteEmbeddingsForResourceIds(db, resourceIds = []) {
  if (!resourceIds.length) return
  const ph = resourceIds.map(() => '?').join(',')
  db.prepare(`DELETE FROM fbw_resource_vec_blob WHERE resourceId IN (${ph})`).run(...resourceIds)
  db.prepare(`DELETE FROM fbw_resource_embeddings WHERE resourceId IN (${ph})`).run(...resourceIds)
  db
    .prepare(`DELETE FROM fbw_resource_image_vec_blob WHERE resourceId IN (${ph})`)
    .run(...resourceIds)
  try {
    db.prepare(`DELETE FROM fbw_vec_index WHERE resourceId IN (${ph})`).run(...resourceIds)
  } catch {
    // sqlite-vec 表可能不存在
  }
  try {
    db.prepare(`DELETE FROM fbw_image_vec_index WHERE resourceId IN (${ph})`).run(...resourceIds)
  } catch {
    // sqlite-vec 表可能不存在
  }
}

export function deleteCollectionItemsForResourceIds(db, resourceIds = []) {
  if (!resourceIds.length) return
  const ph = resourceIds.map(() => '?').join(',')
  db.prepare(`DELETE FROM fbw_collection_items WHERE resourceId IN (${ph})`).run(...resourceIds)
}

export function deleteAiForResourceIds(db, resourceIds = []) {
  if (!resourceIds.length) return
  const ph = resourceIds.map(() => '?').join(',')
  db.prepare(`DELETE FROM fbw_resource_ai WHERE resourceId IN (${ph})`).run(...resourceIds)
}

/** 收藏 / 回忆 / 隐私 / 统计等指向资源的关联行（不清整表） */
export function deleteJunctionRowsForResourceIds(db, resourceIds = []) {
  if (!resourceIds.length) return
  const ph = resourceIds.map(() => '?').join(',')
  for (const table of [
    'fbw_favorites',
    'fbw_history',
    'fbw_privacy_space',
    'fbw_statistics'
  ]) {
    db.prepare(`DELETE FROM ${table} WHERE resourceId IN (${ph})`).run(...resourceIds)
  }
}

/** 删除全部 AI 推荐（系统）合集及其成员 */
export function deleteAutoCollections(db) {
  db
    .prepare(
      `DELETE FROM fbw_collection_items WHERE collectionId IN (SELECT id FROM fbw_collections WHERE source = 'auto')`
    )
    .run()
  db.prepare(`DELETE FROM fbw_collections WHERE source = 'auto'`).run()
}

/**
 * 清空资源库：fbw_resources 全部行及向量 / AI / 标签 / 合集成员等关联数据。
 * @returns {{ affected: number, autoCollectionsRemoved: number }}
 */
export function clearResourcesLibraryData(db) {
  const ids = db.prepare(`SELECT id FROM fbw_resources`).all().map((r) => r.id)
  if (!ids.length) {
    return { affected: 0, autoCollectionsRemoved: 0 }
  }
  const autoCollectionsRemoved =
    db.prepare(`SELECT COUNT(*) as c FROM fbw_collections WHERE source = 'auto'`).get()?.c || 0

  const tx = db.transaction(() => {
    cleanupResourceRelatedData(db, ids)
    deleteAutoCollections(db)
    db.prepare(`DELETE FROM fbw_resources`).run()
  })
  tx()

  tx()

  pruneOrphanCollectionItems(db)

  return { affected: ids.length, autoCollectionsRemoved }
}

/** 清空指定资源的 AI 附表（标签、向量、fbw_resource_ai），不删主表行 */
export function clearAiAnalysisDataForResourceIds(db, resourceIds = []) {
  if (!resourceIds.length) return
  decrementWordCountsForResourceIds(db, resourceIds)
  deleteEmbeddingsForResourceIds(db, resourceIds)
  deleteAiForResourceIds(db, resourceIds)
}

/** 在删除 fbw_resources 主记录前调用（含 AI / 向量 / 标签 / 合集成员 / 关联表） */
export function cleanupResourceRelatedData(db, resourceIds = []) {
  if (!resourceIds.length) return
  deleteCollectionItemsForResourceIds(db, resourceIds)
  decrementWordCountsForResourceIds(db, resourceIds)
  deleteEmbeddingsForResourceIds(db, resourceIds)
  deleteAiForResourceIds(db, resourceIds)
  deleteJunctionRowsForResourceIds(db, resourceIds)
}

/** 仅删库内资源行及附表，不删磁盘文件（刷新目录 prune 等） */
export function purgeResourceRecords(db, resourceIds = []) {
  if (!resourceIds.length) return 0
  const ph = resourceIds.map(() => '?').join(',')
  cleanupResourceRelatedData(db, resourceIds)
  db.prepare(`DELETE FROM fbw_resources WHERE id IN (${ph})`).run(...resourceIds)
  return resourceIds.length
}

/** 删除 fbw_collection_items 中已无对应资源的孤儿行 */
export function pruneOrphanCollectionItems(db) {
  return (
    db
      .prepare(
        `DELETE FROM fbw_collection_items
         WHERE resourceId NOT IN (SELECT id FROM fbw_resources)`
      )
      .run().changes || 0
  )
}
