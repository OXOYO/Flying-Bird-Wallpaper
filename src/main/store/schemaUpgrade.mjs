const addColumnIfMissing = (db, table, column, definition, logger) => {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all()
  if (cols.some((c) => c.name === column)) {
    return false
  }
  db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`)
  logger?.info?.(`已添加列 ${table}.${column}`)
  return true
}

/** 旧库升级：CREATE TABLE IF NOT EXISTS 不会补列，需在创建索引前执行 */
export function upgradeResourcesSchema(db, logger) {
  addColumnIfMissing(db, 'fbw_resources', 'summary', "TEXT NOT NULL DEFAULT ''", logger)
  addColumnIfMissing(db, 'fbw_resources', 'nsfwLevel', 'INTEGER NOT NULL DEFAULT 0', logger)
  const addedStatus = addColumnIfMissing(
    db,
    'fbw_resources',
    'aiAnalysisStatus',
    "TEXT NOT NULL DEFAULT 'pending'",
    logger
  )
  addColumnIfMissing(db, 'fbw_resources', 'aiAnalyzedAt', 'DATETIME', logger)
  addColumnIfMissing(db, 'fbw_resources', 'aiAnalysisFailCount', 'INTEGER NOT NULL DEFAULT 0', logger)

  if (addedStatus) {
    db.prepare(
      `UPDATE fbw_resources SET aiAnalysisStatus = 'pending' WHERE aiAnalysisStatus IS NULL OR aiAnalysisStatus = ''`
    ).run()
  }
}

export function upgradeCollectionsSchema(db, logger) {
  addColumnIfMissing(db, 'fbw_collections', 'source', "TEXT NOT NULL DEFAULT 'user'", logger)
}
