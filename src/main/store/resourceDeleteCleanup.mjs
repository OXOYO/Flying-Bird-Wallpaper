/** 删除资源时清理附表数据（向量、标签关联、合集快照等） */

export function decrementWordCountsForResourceIds(db, resourceIds = []) {
  if (!resourceIds.length) return
  const ph = resourceIds.map(() => '?').join(',')
  const wordRows = db
    .prepare(`SELECT DISTINCT wordId FROM fbw_resource_words WHERE resourceId IN (${ph})`)
    .all(...resourceIds)
  const wordIds = wordRows.map((r) => r.wordId).filter((id) => id != null)
  db.prepare(`DELETE FROM fbw_resource_words WHERE resourceId IN (${ph})`).run(...resourceIds)
  if (!wordIds.length) return
  const wph = wordIds.map(() => '?').join(',')
  db
    .prepare(
      `UPDATE fbw_words SET count = MAX(count - 1, 0), updated_at = datetime('now', 'localtime') WHERE id IN (${wph})`
    )
    .run(...wordIds)
  db.prepare(`DELETE FROM fbw_words WHERE count <= 0`).run()
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

/** 在删除 fbw_resources 主记录前调用 */
export function cleanupResourceRelatedData(db, resourceIds = []) {
  if (!resourceIds.length) return
  deleteCollectionItemsForResourceIds(db, resourceIds)
  decrementWordCountsForResourceIds(db, resourceIds)
  deleteEmbeddingsForResourceIds(db, resourceIds)
}
