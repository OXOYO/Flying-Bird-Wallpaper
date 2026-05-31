import {
  CREATE_RESOURCE_AI_TABLE,
  RESOURCE_AI_INDEXES,
  hasLegacyAiColumnsOnResources,
  isResourceAiSplitDone
} from './resourceAiSql.mjs'

const addColumnIfMissing = (db, table, column, definition, logger) => {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all()
  if (cols.some((c) => c.name === column)) {
    return false
  }
  db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`)
  logger?.info?.(`已添加列 ${table}.${column}`)
  return true
}

/** 旧库升级：CREATE TABLE IF NOT EXISTS 不会补列，须在 createIndexes 之前执行 */
export function upgradeResourcesSchema(db, logger) {
  migrateResourceAiSplitV1(db, logger)
}

export function upgradeCollectionsSchema(db, logger) {
  addColumnIfMissing(db, 'fbw_collections', 'source', "TEXT NOT NULL DEFAULT 'user'", logger)
}

/**
 * 将 AI 字段从 fbw_resources 迁至 fbw_resource_ai，主表 score 更名为 qualityScore。
 */
export function migrateResourceAiSplitV1(db, logger) {
  db.exec(CREATE_RESOURCE_AI_TABLE)

  if (isResourceAiSplitDone(db)) {
    for (const sql of RESOURCE_AI_INDEXES) {
      try {
        db.exec(sql)
      } catch (err) {
        logger?.warn?.(`resource_ai index: ${err}`)
      }
    }
    return
  }

  if (!hasLegacyAiColumnsOnResources(db)) {
    for (const sql of RESOURCE_AI_INDEXES) {
      try {
        db.exec(sql)
      } catch (err) {
        logger?.warn?.(`resource_ai index: ${err}`)
      }
    }
    return
  }

  logger?.info?.('[schema] migrateResourceAiSplitV1 start')

  const migrate = db.transaction(() => {
    db.exec(`INSERT OR REPLACE INTO fbw_resource_ai (
      resourceId, aiTitle, aiDesc, summary, aiScore, nsfwLevel, safeForWork,
      aiAnalysisStatus, aiAnalyzedAt, aiAnalysisFailCount, updated_at
    )
    SELECT
      id,
      CASE WHEN aiAnalysisStatus = 'done' THEN title ELSE '' END,
      CASE WHEN aiAnalysisStatus = 'done' THEN desc ELSE '' END,
      COALESCE(summary, ''),
      COALESCE(score, 0),
      CASE WHEN aiAnalysisStatus IN ('done', 'failed', 'skipped') THEN nsfwLevel ELSE NULL END,
      NULL,
      COALESCE(NULLIF(aiAnalysisStatus, ''), 'pending'),
      aiAnalyzedAt,
      COALESCE(aiAnalysisFailCount, 0),
      datetime('now', 'localtime')
    FROM fbw_resources
    WHERE fileType = 'image'`)

    db.exec(`CREATE TABLE fbw_resources_new (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      resourceName TEXT NOT NULL DEFAULT '',
      fileName TEXT NOT NULL DEFAULT '',
      filePath TEXT NOT NULL DEFAULT '',
      fileExt TEXT NOT NULL DEFAULT '',
      fileType TEXT NOT NULL DEFAULT 'image',
      fileSize INTEGER NOT NULL DEFAULT 0,
      imageUrl TEXT NOT NULL DEFAULT '',
      videoUrl TEXT NOT NULL DEFAULT '',
      author TEXT NOT NULL DEFAULT '',
      link TEXT NOT NULL DEFAULT '',
      title TEXT NOT NULL DEFAULT '',
      desc TEXT NOT NULL DEFAULT '',
      quality TEXT NOT NULL DEFAULT '',
      width INTEGER NOT NULL DEFAULT 0,
      height INTEGER NOT NULL DEFAULT 0,
      isLandscape INTEGER NOT NULL DEFAULT -1,
      qualityScore INTEGER NOT NULL DEFAULT 0,
      dominantColor TEXT NOT NULL DEFAULT '',
      atimeMs INTEGER NOT NULL DEFAULT 0,
      mtimeMs INTEGER NOT NULL DEFAULT 0,
      ctimeMs INTEGER NOT NULL DEFAULT 0,
      created_at DATETIME DEFAULT (datetime('now', 'localtime')),
      updated_at DATETIME DEFAULT (datetime('now', 'localtime')),
      UNIQUE (filePath)
    )`)

    db.exec(`INSERT INTO fbw_resources_new (
      id, resourceName, fileName, filePath, fileExt, fileType, fileSize,
      imageUrl, videoUrl, author, link, title, desc, quality, width, height,
      isLandscape, qualityScore, dominantColor, atimeMs, mtimeMs, ctimeMs,
      created_at, updated_at
    )
    SELECT
      id, resourceName, fileName, filePath, fileExt, fileType, fileSize,
      imageUrl, videoUrl, author, link, title, desc, quality, width, height,
      isLandscape, COALESCE(score, 0), dominantColor, atimeMs, mtimeMs, ctimeMs,
      created_at, updated_at
    FROM fbw_resources`)

    db.exec('DROP TABLE fbw_resources')
    db.exec('ALTER TABLE fbw_resources_new RENAME TO fbw_resources')

    try {
      db.exec('DROP INDEX IF EXISTS idx_resources_ai_status')
    } catch {
      /* ignore */
    }
  })

  migrate()

  for (const sql of RESOURCE_AI_INDEXES) {
    try {
      db.exec(sql)
    } catch (err) {
      logger?.warn?.(`resource_ai index: ${err}`)
    }
  }

  logger?.info?.('[schema] migrateResourceAiSplitV1 done')
}
