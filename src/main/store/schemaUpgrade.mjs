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
const runSchemaStep = (logger, name, fn) => {
  try {
    fn()
  } catch (err) {
    logger?.error?.(`[schema] ${name} failed: ${err}`)
  }
}

export function upgradeResourcesSchema(db, logger) {
  runSchemaStep(logger, 'migrateResourceAiSplitV1', () => migrateResourceAiSplitV1(db, logger))
  runSchemaStep(logger, 'add resource ai analysisMeta', () =>
    addColumnIfMissing(db, 'fbw_resource_ai', 'analysisMeta', "TEXT NOT NULL DEFAULT ''", logger)
  )
  runSchemaStep(logger, 'add resource ai rawLlmJson', () =>
    addColumnIfMissing(db, 'fbw_resource_ai', 'rawLlmJson', "TEXT NOT NULL DEFAULT ''", logger)
  )
  runSchemaStep(logger, 'add posterPath', () =>
    addColumnIfMissing(db, 'fbw_resources', 'posterPath', "TEXT NOT NULL DEFAULT ''", logger)
  )
  runSchemaStep(logger, 'migrateImageVecBlobCompositePk', () =>
    migrateImageVecBlobCompositePk(db, logger)
  )
  runSchemaStep(logger, 'ensure visual embed state table', () => ensureVisualEmbedStateTable(db, logger))
  runSchemaStep(logger, 'upgradeResourceForeignKeys', () => upgradeResourceForeignKeys(db, logger))
  runSchemaStep(logger, 'migrateResourceVecTablesFk', () => migrateResourceVecTablesFk(db, logger))
}

const tableHasResourceFk = (db, table) => {
  try {
    return db
      .prepare(`PRAGMA foreign_key_list(${table})`)
      .all()
      .some((fk) => fk.table === 'fbw_resources' && fk.from === 'resourceId')
  } catch {
    return false
  }
}

const rebuildTableFromSelect = (db, table, createSql, insertSql) => {
  db.exec(`DROP TABLE IF EXISTS ${table}_fk_new`)
  db.exec(createSql.replace(`CREATE TABLE IF NOT EXISTS ${table}`, `CREATE TABLE ${table}_fk_new`))
  db.exec(insertSql.replace(`INTO ${table}`, `INTO ${table}_fk_new`))
  db.exec(`DROP TABLE ${table}`)
  db.exec(`ALTER TABLE ${table}_fk_new RENAME TO ${table}`)
}

/** 旧库 junction 表补 FK CASCADE */
export function upgradeResourceForeignKeys(db, logger) {
  const tx = db.transaction(() => {
    db.exec('PRAGMA foreign_keys=OFF')

    if (!tableHasResourceFk(db, 'fbw_favorites')) {
      rebuildTableFromSelect(
        db,
        'fbw_favorites',
        `CREATE TABLE IF NOT EXISTS fbw_favorites (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          resourceId INTEGER NOT NULL REFERENCES fbw_resources(id) ON DELETE CASCADE,
          created_at DATETIME DEFAULT (datetime('now', 'localtime')),
          updated_at DATETIME DEFAULT (datetime('now', 'localtime')),
          UNIQUE (resourceId)
        )`,
        `INSERT INTO fbw_favorites (id, resourceId, created_at, updated_at)
         SELECT id, resourceId, created_at, updated_at FROM fbw_favorites
         WHERE resourceId IN (SELECT id FROM fbw_resources)`
      )
      logger?.info?.('[schema] fbw_favorites FK upgraded')
    }

    if (!tableHasResourceFk(db, 'fbw_history')) {
      rebuildTableFromSelect(
        db,
        'fbw_history',
        `CREATE TABLE IF NOT EXISTS fbw_history (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          resourceId INTEGER NOT NULL REFERENCES fbw_resources(id) ON DELETE CASCADE,
          created_at DATETIME DEFAULT (datetime('now', 'localtime')),
          updated_at DATETIME DEFAULT (datetime('now', 'localtime')),
          UNIQUE (id)
        )`,
        `INSERT INTO fbw_history (id, resourceId, created_at, updated_at)
         SELECT id, resourceId, created_at, updated_at FROM fbw_history
         WHERE resourceId IN (SELECT id FROM fbw_resources)`
      )
      logger?.info?.('[schema] fbw_history FK upgraded')
    }

    if (!tableHasResourceFk(db, 'fbw_privacy_space')) {
      rebuildTableFromSelect(
        db,
        'fbw_privacy_space',
        `CREATE TABLE IF NOT EXISTS fbw_privacy_space (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          resourceId INTEGER NOT NULL REFERENCES fbw_resources(id) ON DELETE CASCADE,
          created_at DATETIME DEFAULT (datetime('now', 'localtime')),
          updated_at DATETIME DEFAULT (datetime('now', 'localtime')),
          UNIQUE (resourceId)
        )`,
        `INSERT INTO fbw_privacy_space (id, resourceId, created_at, updated_at)
         SELECT id, resourceId, created_at, updated_at FROM fbw_privacy_space
         WHERE resourceId IN (SELECT id FROM fbw_resources)`
      )
      logger?.info?.('[schema] fbw_privacy_space FK upgraded')
    }

    if (!tableHasResourceFk(db, 'fbw_statistics')) {
      rebuildTableFromSelect(
        db,
        'fbw_statistics',
        `CREATE TABLE IF NOT EXISTS fbw_statistics (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          resourceId INTEGER NOT NULL REFERENCES fbw_resources(id) ON DELETE CASCADE,
          views INTEGER NOT NULL DEFAULT 0,
          downloads INTEGER NOT NULL DEFAULT 0,
          favorites INTEGER NOT NULL DEFAULT 0,
          wallpapers INTEGER NOT NULL DEFAULT 0,
          created_at DATETIME DEFAULT (datetime('now', 'localtime')),
          updated_at DATETIME DEFAULT (datetime('now', 'localtime')),
          UNIQUE (resourceId)
        )`,
        `INSERT INTO fbw_statistics (id, resourceId, views, downloads, favorites, wallpapers, created_at, updated_at)
         SELECT id, resourceId, views, downloads, favorites, wallpapers, created_at, updated_at FROM fbw_statistics
         WHERE resourceId IN (SELECT id FROM fbw_resources)`
      )
      logger?.info?.('[schema] fbw_statistics FK upgraded')
    }

    if (!tableHasResourceFk(db, 'fbw_resource_words')) {
      rebuildTableFromSelect(
        db,
        'fbw_resource_words',
        `CREATE TABLE IF NOT EXISTS fbw_resource_words (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          resourceId INTEGER NOT NULL REFERENCES fbw_resources(id) ON DELETE CASCADE,
          wordId INTEGER NOT NULL REFERENCES fbw_words(id) ON DELETE CASCADE,
          created_at DATETIME DEFAULT (datetime('now', 'localtime')),
          updated_at DATETIME DEFAULT (datetime('now', 'localtime')),
          UNIQUE (resourceId, wordId)
        )`,
        `INSERT INTO fbw_resource_words (id, resourceId, wordId, created_at, updated_at)
         SELECT rw.id, rw.resourceId, rw.wordId, rw.created_at, rw.updated_at
         FROM fbw_resource_words rw
         WHERE rw.resourceId IN (SELECT id FROM fbw_resources)
           AND rw.wordId IN (SELECT id FROM fbw_words)`
      )
      logger?.info?.('[schema] fbw_resource_words FK upgraded')
    }

    const collectionItemFks = db.prepare(`PRAGMA foreign_key_list(fbw_collection_items)`).all()
    const hasCollectionItemResourceFk = collectionItemFks.some(
      (fk) => fk.table === 'fbw_resources' && fk.from === 'resourceId'
    )
    if (!hasCollectionItemResourceFk) {
      rebuildTableFromSelect(
        db,
        'fbw_collection_items',
        `CREATE TABLE IF NOT EXISTS fbw_collection_items (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          collectionId INTEGER NOT NULL REFERENCES fbw_collections(id) ON DELETE CASCADE,
          resourceId INTEGER NOT NULL REFERENCES fbw_resources(id) ON DELETE CASCADE,
          rank INTEGER NOT NULL DEFAULT 0,
          generated_at DATETIME DEFAULT (datetime('now', 'localtime')),
          UNIQUE (collectionId, resourceId)
        )`,
        `INSERT INTO fbw_collection_items (id, collectionId, resourceId, rank, generated_at)
         SELECT ci.id, ci.collectionId, ci.resourceId, ci.rank, ci.generated_at
         FROM fbw_collection_items ci
         WHERE ci.collectionId IN (SELECT id FROM fbw_collections)
           AND ci.resourceId IN (SELECT id FROM fbw_resources)`
      )
      logger?.info?.('[schema] fbw_collection_items FK upgraded')
    }

    db.exec('PRAGMA foreign_keys=ON')
  })
  try {
    tx()
  } catch (err) {
    logger?.warn?.(`[schema] upgradeResourceForeignKeys: ${err}`)
    try {
      db.exec('PRAGMA foreign_keys=ON')
    } catch {
      /* ignore */
    }
  }
}

/** 画面向量表主键 (resourceId, model) */
export function migrateImageVecBlobCompositePk(db, logger) {
  let cols = []
  try {
    cols = db.prepare(`PRAGMA table_info(fbw_resource_image_vec_blob)`).all()
  } catch {
    return
  }
  if (!cols.length) return

  const pkCols = cols.filter((c) => c.pk > 0).sort((a, b) => a.pk - b.pk)
  if (pkCols.length === 2 && pkCols[0].name === 'resourceId' && pkCols[1].name === 'model') {
    return
  }
  if (pkCols.length !== 1 || pkCols[0].name !== 'resourceId') {
    return
  }

  const hasModelCol = cols.some((c) => c.name === 'model')
  const modelSelect = hasModelCol ? "COALESCE(NULLIF(model, ''), 'mobileclip2-s0')" : "'mobileclip2-s0'"

  const orphanCount =
    db
      .prepare(
        `SELECT COUNT(*) AS c FROM fbw_resource_image_vec_blob v
         WHERE NOT EXISTS (SELECT 1 FROM fbw_resources r WHERE r.id = v.resourceId)`
      )
      .get()?.c || 0
  if (orphanCount > 0) {
    logger?.info?.(
      `[schema] migrateImageVecBlobCompositePk skip ${orphanCount} orphan image vec row(s)`
    )
  }

  logger?.info?.('[schema] migrateImageVecBlobCompositePk start')
  const tx = db.transaction(() => {
    db.exec('PRAGMA foreign_keys=OFF')
    db.exec('DROP TABLE IF EXISTS fbw_resource_image_vec_blob_new')
    db.exec(`CREATE TABLE fbw_resource_image_vec_blob_new (
      resourceId INTEGER NOT NULL REFERENCES fbw_resources(id) ON DELETE CASCADE,
      embedding BLOB NOT NULL,
      dim INTEGER NOT NULL,
      model TEXT NOT NULL DEFAULT 'mobileclip2-s0',
      updated_at DATETIME DEFAULT (datetime('now', 'localtime')),
      PRIMARY KEY (resourceId, model)
    )`)
    db.exec(`INSERT OR IGNORE INTO fbw_resource_image_vec_blob_new
      (resourceId, embedding, dim, model, updated_at)
      SELECT resourceId, embedding, dim, ${modelSelect}, updated_at
      FROM fbw_resource_image_vec_blob
      WHERE resourceId IN (SELECT id FROM fbw_resources)`)
    db.exec('DROP TABLE fbw_resource_image_vec_blob')
    db.exec('ALTER TABLE fbw_resource_image_vec_blob_new RENAME TO fbw_resource_image_vec_blob')
    db.exec('PRAGMA foreign_keys=ON')
  })
  try {
    tx()
    logger?.info?.('[schema] migrateImageVecBlobCompositePk done')
  } catch (err) {
    logger?.warn?.(`[schema] migrateImageVecBlobCompositePk: ${err}`)
    try {
      db.exec('DROP TABLE IF EXISTS fbw_resource_image_vec_blob_new')
      db.exec('PRAGMA foreign_keys=ON')
    } catch {
      /* ignore */
    }
  }
}

/** 文本向量 BLOB / embeddings 元数据表补 FK */
export function migrateResourceVecTablesFk(db, logger) {
  const tx = db.transaction(() => {
    db.exec('PRAGMA foreign_keys=OFF')

    const vecExists = db
      .prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name='fbw_resource_vec_blob'`)
      .get()
    if (vecExists && !tableHasResourceFk(db, 'fbw_resource_vec_blob')) {
      rebuildTableFromSelect(
        db,
        'fbw_resource_vec_blob',
        `CREATE TABLE IF NOT EXISTS fbw_resource_vec_blob (
          resourceId INTEGER PRIMARY KEY REFERENCES fbw_resources(id) ON DELETE CASCADE,
          embedding BLOB NOT NULL,
          dim INTEGER NOT NULL,
          updated_at DATETIME DEFAULT (datetime('now', 'localtime'))
        )`,
        `INSERT INTO fbw_resource_vec_blob (resourceId, embedding, dim, updated_at)
         SELECT resourceId, embedding, dim, updated_at FROM fbw_resource_vec_blob
         WHERE resourceId IN (SELECT id FROM fbw_resources)`
      )
      logger?.info?.('[schema] fbw_resource_vec_blob FK upgraded')
    }

    const embExists = db
      .prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name='fbw_resource_embeddings'`)
      .get()
    if (embExists && !tableHasResourceFk(db, 'fbw_resource_embeddings')) {
      rebuildTableFromSelect(
        db,
        'fbw_resource_embeddings',
        `CREATE TABLE IF NOT EXISTS fbw_resource_embeddings (
          resourceId INTEGER PRIMARY KEY REFERENCES fbw_resources(id) ON DELETE CASCADE,
          model TEXT NOT NULL DEFAULT '',
          dim INTEGER NOT NULL DEFAULT 0,
          updated_at DATETIME DEFAULT (datetime('now', 'localtime'))
        )`,
        `INSERT INTO fbw_resource_embeddings (resourceId, model, dim, updated_at)
         SELECT resourceId, model, dim, updated_at FROM fbw_resource_embeddings
         WHERE resourceId IN (SELECT id FROM fbw_resources)`
      )
      logger?.info?.('[schema] fbw_resource_embeddings FK upgraded')
    }

    db.exec('PRAGMA foreign_keys=ON')
  })
  try {
    tx()
  } catch (err) {
    logger?.warn?.(`[schema] migrateResourceVecTablesFk: ${err}`)
    try {
      db.exec('PRAGMA foreign_keys=ON')
    } catch {
      /* ignore */
    }
  }
}

export function upgradeCollectionsSchema(db, logger) {
  addColumnIfMissing(db, 'fbw_collections', 'source', "TEXT NOT NULL DEFAULT 'user'", logger)
}

export function ensureVisualEmbedStateTable(db, logger) {
  db.exec(`CREATE TABLE IF NOT EXISTS fbw_resource_visual_embed_state (
    resourceId INTEGER NOT NULL REFERENCES fbw_resources(id) ON DELETE CASCADE,
    model TEXT NOT NULL,
    failCount INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'failed',
    lastError TEXT NOT NULL DEFAULT '',
    updated_at DATETIME DEFAULT (datetime('now', 'localtime')),
    PRIMARY KEY (resourceId, model)
  )`)
  try {
    db.exec(
      'CREATE INDEX IF NOT EXISTS idx_visual_embed_state_model_status ON fbw_resource_visual_embed_state(model, status)'
    )
  } catch (err) {
    logger?.warn?.(`[schema] visual embed state index: ${err}`)
  }
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
    db.exec('PRAGMA foreign_keys=OFF')

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
    WHERE fileType IN ('image', 'video')`)

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
      posterPath TEXT NOT NULL DEFAULT '',
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

    db.exec('PRAGMA foreign_keys=ON')
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
