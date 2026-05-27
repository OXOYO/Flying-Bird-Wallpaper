import { upgradeResourcesSchema } from '../../src/main/store/schemaUpgrade.mjs'

/**
 * 1.3.8 → 2.0.0 AI 能力数据库迁移
 */
export default async function migrate(dbManager, logger) {
  const db = dbManager.db
  logger.info('执行从 1.3.8 到 2.0.0 的迁移')

  upgradeResourcesSchema(db, logger)

  db.exec(`
    CREATE TABLE IF NOT EXISTS fbw_collections (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL DEFAULT '',
      prompt TEXT NOT NULL DEFAULT '',
      queryJson TEXT NOT NULL DEFAULT '{}',
      resourceScope TEXT NOT NULL DEFAULT 'resources',
      limitCount INTEGER NOT NULL DEFAULT 20,
      sortField TEXT NOT NULL DEFAULT 'score',
      sortType INTEGER NOT NULL DEFAULT -1,
      isPinned INTEGER NOT NULL DEFAULT 0,
      refreshMode TEXT NOT NULL DEFAULT 'manual',
      lastGeneratedAt DATETIME,
      created_at DATETIME DEFAULT (datetime('now', 'localtime')),
      updated_at DATETIME DEFAULT (datetime('now', 'localtime'))
    )
  `)

  db.exec(`
    CREATE TABLE IF NOT EXISTS fbw_collection_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      collectionId INTEGER NOT NULL,
      resourceId INTEGER NOT NULL,
      rank INTEGER NOT NULL DEFAULT 0,
      generated_at DATETIME DEFAULT (datetime('now', 'localtime')),
      UNIQUE (collectionId, resourceId)
    )
  `)

  db.exec(`
    CREATE TABLE IF NOT EXISTS fbw_resource_embeddings (
      resourceId INTEGER PRIMARY KEY,
      model TEXT NOT NULL DEFAULT '',
      dim INTEGER NOT NULL DEFAULT 0,
      updated_at DATETIME DEFAULT (datetime('now', 'localtime'))
    )
  `)

  const indexes = [
    'CREATE INDEX IF NOT EXISTS idx_resources_score ON fbw_resources(score)',
    'CREATE INDEX IF NOT EXISTS idx_resources_ai_status ON fbw_resources(aiAnalysisStatus)',
    'CREATE INDEX IF NOT EXISTS idx_collections_pinned ON fbw_collections(isPinned, updated_at)',
    'CREATE INDEX IF NOT EXISTS idx_collection_items_collection ON fbw_collection_items(collectionId, rank)'
  ]
  indexes.forEach((sql) => db.exec(sql))

  db.prepare(
    `UPDATE fbw_resources SET aiAnalysisStatus = 'pending' WHERE aiAnalysisStatus IS NULL OR aiAnalysisStatus = ''`
  ).run()

  logger.info('1.3.8 → 2.0.0 迁移完成')
}
