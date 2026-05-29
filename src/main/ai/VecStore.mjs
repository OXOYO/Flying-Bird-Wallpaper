import * as sqliteVec from 'sqlite-vec'
import { VISUAL_EMBED_DIM, VISUAL_EMBED_MODEL_ID, SIMILAR_RECALL_K } from './aiConstants.mjs'

/**
 * sqlite-vec 封装；加载失败时降级为 BLOB 存储 + 内存余弦检索
 */
export default class VecStore {
  static _instance = null

  static getInstance(logger, db) {
    if (!VecStore._instance) {
      VecStore._instance = new VecStore(logger, db)
    }
    return VecStore._instance
  }

  constructor(logger, db) {
    if (VecStore._instance) return VecStore._instance
    this.logger = logger
    this.db = db
    this.mode = 'blob'
    this.dim = 768
    this.vecIndexDim = null
    this.imageVecIndexDim = null
    this._init()
    VecStore._instance = this
  }

  _init() {
    this._ensureBlobTable()
    this._ensureImageBlobTable()
    try {
      sqliteVec.load(this.db)
      this.mode = 'sqlite-vec'
      const latest = this.db
        .prepare(`SELECT dim FROM fbw_resource_vec_blob ORDER BY updated_at DESC LIMIT 1`)
        .get()
      const initDim = latest?.dim || this.dim
      this._ensureVecTable(initDim)
      const latestImage = this.db
        .prepare(
          `SELECT dim FROM fbw_resource_image_vec_blob WHERE model = ? ORDER BY updated_at DESC LIMIT 1`
        )
        .get(VISUAL_EMBED_MODEL_ID)
      if (latestImage?.dim === VISUAL_EMBED_DIM) {
        this._ensureImageVecTable(VISUAL_EMBED_DIM)
      }
      this.logger.info('[VecStore] sqlite-vec 已加载')
    } catch (err) {
      this.logger.warn(`[VecStore] sqlite-vec 不可用，使用 BLOB 降级: ${err.message}`)
    }
  }

  _ensureBlobTable() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS fbw_resource_vec_blob (
        resourceId INTEGER PRIMARY KEY,
        embedding BLOB NOT NULL,
        dim INTEGER NOT NULL,
        updated_at DATETIME DEFAULT (datetime('now', 'localtime'))
      )
    `)
  }

  _ensureImageBlobTable() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS fbw_resource_image_vec_blob (
        resourceId INTEGER PRIMARY KEY,
        embedding BLOB NOT NULL,
        dim INTEGER NOT NULL,
        model TEXT NOT NULL DEFAULT 'mobileclip2-s0',
        updated_at DATETIME DEFAULT (datetime('now', 'localtime'))
      )
    `)
  }

  _ensureVecTable(dim) {
    if (this.mode !== 'sqlite-vec') return
    if (this.vecIndexDim === dim) return

    try {
      this.db.exec('DROP TABLE IF EXISTS fbw_vec_index')
      this.db.exec(`
        CREATE VIRTUAL TABLE fbw_vec_index USING vec0(
          resourceId INTEGER PRIMARY KEY,
          embedding float[${dim}]
        )
      `)
      this.vecIndexDim = dim
      this._rebuildVecIndexFromBlobs(dim)
    } catch (err) {
      this.logger.warn(`[VecStore] vec0 表创建失败: ${err.message}`)
      this.mode = 'blob'
      this.vecIndexDim = null
    }
  }

  /** sqlite-vec + better-sqlite3：主进程加载 onnxruntime-node 后 vec0 主键须为 BigInt */
  _toVecPk(resourceId) {
    if (typeof resourceId === 'bigint') return resourceId
    const n = Number(resourceId)
    if (!Number.isInteger(n) || n < 0) {
      throw new Error(`invalid resourceId for vec index: ${resourceId}`)
    }
    return BigInt(n)
  }

  _insertVecRow(resourceId, vector) {
    const pk = this._toVecPk(resourceId)
    this.db.prepare('DELETE FROM fbw_vec_index WHERE resourceId = ?').run(pk)
    this.db
      .prepare('INSERT INTO fbw_vec_index(resourceId, embedding) VALUES (?, ?)')
      .run(pk, JSON.stringify(vector))
  }

  _rebuildVecIndexFromBlobs(dim) {
    if (this.mode !== 'sqlite-vec') return
    const rows = this.db
      .prepare(`SELECT resourceId, embedding FROM fbw_resource_vec_blob WHERE dim = ?`)
      .all(dim)
    if (!rows.length) return

    const tx = this.db.transaction(() => {
      for (const row of rows) {
        const vec = this.blobToFloat32(row.embedding, dim)
        this._insertVecRow(row.resourceId, vec)
      }
    })
    tx()
    this.logger.info(`[VecStore] 已从 BLOB 重建 vec 索引 ${rows.length} 条 (dim=${dim})`)
  }

  float32ToBlob(vec) {
    const arr = Float32Array.from(vec)
    return Buffer.from(arr.buffer)
  }

  blobToFloat32(buf, dim) {
    const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength)
    const fa = new Float32Array(ab)
    return fa.length >= dim ? Array.from(fa.slice(0, dim)) : Array.from(fa)
  }

  upsert(resourceId, vector, dim) {
    if (!Array.isArray(vector) || !vector.length) return false
    const d = dim || vector.length
    this.dim = d

    this.db
      .prepare(
        `INSERT INTO fbw_resource_embeddings (resourceId, model, dim, updated_at)
         VALUES (?, ?, ?, datetime('now', 'localtime'))
         ON CONFLICT(resourceId) DO UPDATE SET model=excluded.model, dim=excluded.dim, updated_at=excluded.updated_at`
      )
      .run(resourceId, 'default', d)

    const blob = this.float32ToBlob(vector)
    this.db
      .prepare(
        `INSERT INTO fbw_resource_vec_blob (resourceId, embedding, dim, updated_at)
         VALUES (?, ?, ?, datetime('now', 'localtime'))
         ON CONFLICT(resourceId) DO UPDATE SET embedding=excluded.embedding, dim=excluded.dim, updated_at=excluded.updated_at`
      )
      .run(resourceId, blob, d)

    if (this.mode === 'sqlite-vec') {
      try {
        this._ensureVecTable(d)
        this._insertVecRow(resourceId, vector)
      } catch (err) {
        this.logger.warn(`[VecStore] vec upsert 失败: ${err.message}`)
      }
    }
    return true
  }

  cosine(a, b) {
    let dot = 0
    let na = 0
    let nb = 0
    const len = Math.min(a.length, b.length)
    for (let i = 0; i < len; i++) {
      dot += a[i] * b[i]
      na += a[i] * a[i]
      nb += b[i] * b[i]
    }
    if (!na || !nb) return 0
    return dot / (Math.sqrt(na) * Math.sqrt(nb))
  }

  knn(queryVec, limit = 20, excludeId = null) {
    const k = Math.min(Math.max(limit, 1), 100)
    if (this.mode === 'sqlite-vec') {
      try {
        const rows = this.db
          .prepare(
            `SELECT resourceId, distance
             FROM fbw_vec_index
             WHERE embedding MATCH ?
             ORDER BY distance
             LIMIT ?`
          )
          .all(JSON.stringify(queryVec), k + 5)
        return rows
          .filter((r) => excludeId == null || r.resourceId !== excludeId)
          .slice(0, k)
          .map((r) => ({ resourceId: r.resourceId, distance: r.distance }))
      } catch {
        // fallback blob
      }
    }

    const queryDim = queryVec?.length || 0
    const rows = this.db.prepare(`SELECT resourceId, embedding, dim FROM fbw_resource_vec_blob`).all()
    const scored = []
    for (const row of rows) {
      if (excludeId != null && Number(row.resourceId) === Number(excludeId)) continue
      if (queryDim > 0 && Number(row.dim) !== queryDim) continue
      const vec = this.blobToFloat32(row.embedding, row.dim)
      if (vec.length !== queryDim) continue
      scored.push({ resourceId: row.resourceId, distance: 1 - this.cosine(queryVec, vec) })
    }
    scored.sort((a, b) => a.distance - b.distance)
    return scored.slice(0, k)
  }

  /**
   * 仅在指定 resourceId 集合内做 KNN（找相似范围限定，避免全库 Top-K 再过滤漏结果）
   */
  knnAmongIds(queryVec, resourceIds = [], limit = 20, excludeId = null) {
    const ranked = this.rankSimilarAmongIds(queryVec, resourceIds, excludeId, 0)
    const k = Math.min(Math.max(limit, 1), ranked.length || 1)
    return ranked.slice(0, k).map(({ resourceId, distance }) => ({ resourceId, distance }))
  }

  _scoreEmbeddingRow(queryVec, row, queryDim, excludeId) {
    if (excludeId != null && Number(row.resourceId) === Number(excludeId)) return null
    if (queryDim > 0 && Number(row.dim) !== queryDim) return null
    const vec = this.blobToFloat32(row.embedding, row.dim)
    if (vec.length !== queryDim) return null
    const similarity = this.cosine(queryVec, vec)
    return { resourceId: row.resourceId, similarity, distance: 1 - similarity }
  }

  /**
   * 在候选 id 内按相似度排序；仅保留 similarity >= minSimilarity
   * @returns {{ resourceId: number, similarity: number, distance: number }[]}
   */
  rankSimilarAmongIds(queryVec, resourceIds = [], excludeId = null, minSimilarity = 0) {
    const ids = [...new Set(resourceIds.map((id) => Number(id)).filter((id) => id > 0))]
    if (!ids.length) return []

    const queryDim = queryVec?.length || 0
    const minSim = Math.min(1, Math.max(0, Number(minSimilarity) || 0))
    const scored = []
    const chunkSize = 400
    for (let i = 0; i < ids.length; i += chunkSize) {
      const chunk = ids.slice(i, i + chunkSize)
      const ph = chunk.map(() => '?').join(',')
      const rows = this.db
        .prepare(
          `SELECT resourceId, embedding, dim FROM fbw_resource_vec_blob WHERE resourceId IN (${ph})`
        )
        .all(...chunk)
      for (const row of rows) {
        const hit = this._scoreEmbeddingRow(queryVec, row, queryDim, excludeId)
        if (hit && hit.similarity >= minSim) scored.push(hit)
      }
    }
    scored.sort((a, b) => b.similarity - a.similarity)
    return scored
  }

  /** 全库有向量记录内找相似（无 scope 时） */
  rankSimilarGlobal(queryVec, excludeId = null, minSimilarity = 0) {
    const queryDim = queryVec?.length || 0
    const minSim = Math.min(1, Math.max(0, Number(minSimilarity) || 0))
    const rows = this.db.prepare(`SELECT resourceId, embedding, dim FROM fbw_resource_vec_blob`).all()
    const scored = []
    for (const row of rows) {
      const hit = this._scoreEmbeddingRow(queryVec, row, queryDim, excludeId)
      if (hit && hit.similarity >= minSim) scored.push(hit)
    }
    scored.sort((a, b) => b.similarity - a.similarity)
    return scored
  }

  upsertImage(resourceId, vector, dim, model = VISUAL_EMBED_MODEL_ID) {
    if (!Array.isArray(vector) || !vector.length) return false
    const d = dim || vector.length
    const blob = this.float32ToBlob(vector)
    this.db
      .prepare(
        `INSERT INTO fbw_resource_image_vec_blob (resourceId, embedding, dim, model, updated_at)
         VALUES (?, ?, ?, ?, datetime('now', 'localtime'))
         ON CONFLICT(resourceId) DO UPDATE SET
           embedding=excluded.embedding,
           dim=excluded.dim,
           model=excluded.model,
           updated_at=excluded.updated_at`
      )
      .run(resourceId, blob, d, model || VISUAL_EMBED_MODEL_ID)

    if (this.mode === 'sqlite-vec' && d === VISUAL_EMBED_DIM && (model || VISUAL_EMBED_MODEL_ID) === VISUAL_EMBED_MODEL_ID) {
      try {
        this._ensureImageVecTable(d)
        this._insertImageVecRow(resourceId, vector)
      } catch (err) {
        this.logger.warn(`[VecStore] image vec upsert 失败: ${err.message}`)
      }
    }
    return true
  }

  _ensureImageVecTable(dim) {
    if (this.mode !== 'sqlite-vec') return
    if (this.imageVecIndexDim === dim) return

    try {
      this.db.exec('DROP TABLE IF EXISTS fbw_image_vec_index')
      this.db.exec(`
        CREATE VIRTUAL TABLE fbw_image_vec_index USING vec0(
          resourceId INTEGER PRIMARY KEY,
          embedding float[${dim}]
        )
      `)
      this.imageVecIndexDim = dim
      this._rebuildImageVecIndexFromBlobs(dim, VISUAL_EMBED_MODEL_ID)
    } catch (err) {
      this.logger.warn(`[VecStore] image vec0 表创建失败: ${err.message}`)
    }
  }

  _insertImageVecRow(resourceId, vector) {
    const pk = this._toVecPk(resourceId)
    this.db.prepare('DELETE FROM fbw_image_vec_index WHERE resourceId = ?').run(pk)
    this.db
      .prepare('INSERT INTO fbw_image_vec_index(resourceId, embedding) VALUES (?, ?)')
      .run(pk, JSON.stringify(vector))
  }

  _rebuildImageVecIndexFromBlobs(dim, model = VISUAL_EMBED_MODEL_ID) {
    if (this.mode !== 'sqlite-vec') return
    const rows = this.db
      .prepare(
        `SELECT resourceId, embedding FROM fbw_resource_image_vec_blob WHERE dim = ? AND model = ?`
      )
      .all(dim, model)
    if (!rows.length) return

    const tx = this.db.transaction(() => {
      for (const row of rows) {
        const vec = this.blobToFloat32(row.embedding, dim)
        this._insertImageVecRow(row.resourceId, vec)
      }
    })
    tx()
    this.logger.info(
      `[VecStore] 已从 BLOB 重建 image vec 索引 ${rows.length} 条 (dim=${dim}, model=${model})`
    )
  }

  knnImage(queryVec, limit = 20, excludeId = null, model = VISUAL_EMBED_MODEL_ID) {
    const k = Math.min(Math.max(limit, 1), SIMILAR_RECALL_K)
    const queryDim = queryVec?.length || 0
    if (
      this.mode === 'sqlite-vec' &&
      queryDim === VISUAL_EMBED_DIM &&
      model === VISUAL_EMBED_MODEL_ID &&
      this.imageVecIndexDim === VISUAL_EMBED_DIM
    ) {
      try {
        const rows = this.db
          .prepare(
            `SELECT resourceId, distance
             FROM fbw_image_vec_index
             WHERE embedding MATCH ?
             ORDER BY distance
             LIMIT ?`
          )
          .all(JSON.stringify(queryVec), k + 5)
        return rows
          .filter((r) => excludeId == null || Number(r.resourceId) !== Number(excludeId))
          .slice(0, k)
          .map((r) => ({ resourceId: r.resourceId, distance: r.distance }))
      } catch {
        // fallback blob
      }
    }
    return this.recallTopKImageGlobal(queryVec, excludeId, k, model).map((h) => ({
      resourceId: h.resourceId,
      distance: 1 - (h.similarity ?? 0)
    }))
  }

  /** @returns {{ resourceId: number, similarity: number }[]} */
  recallTopKGlobal(queryVec, excludeId = null, limit = 200) {
    const ranked = this.rankSimilarGlobal(queryVec, excludeId, 0)
    return ranked.slice(0, Math.max(1, limit)).map(({ resourceId, similarity }) => ({
      resourceId,
      similarity
    }))
  }

  /** @returns {{ resourceId: number, similarity: number }[]} */
  recallTopKAmongIds(queryVec, resourceIds = [], excludeId = null, limit = 200) {
    const ranked = this.rankSimilarAmongIds(queryVec, resourceIds, excludeId, 0)
    return ranked.slice(0, Math.max(1, limit)).map(({ resourceId, similarity }) => ({
      resourceId,
      similarity
    }))
  }

  /** @returns {{ resourceId: number, similarity: number }[]} */
  recallTopKImageGlobal(queryVec, excludeId = null, limit = 200, model = null) {
    const ranked = this.rankSimilarGlobalImage(queryVec, excludeId, 0, model)
    return ranked.slice(0, Math.max(1, limit)).map(({ resourceId, similarity }) => ({
      resourceId,
      similarity
    }))
  }

  /** @returns {{ resourceId: number, similarity: number }[]} */
  recallTopKImageAmongIds(
    queryVec,
    resourceIds = [],
    excludeId = null,
    limit = 200,
    model = null
  ) {
    const ranked = this.rankSimilarAmongImageIds(queryVec, resourceIds, excludeId, 0, model)
    return ranked.slice(0, Math.max(1, limit)).map(({ resourceId, similarity }) => ({
      resourceId,
      similarity
    }))
  }

  getImageVectorRow(resourceId) {
    return this.db
      .prepare(
        `SELECT resourceId, embedding, dim, model FROM fbw_resource_image_vec_blob WHERE resourceId = ?`
      )
      .get(resourceId)
  }

  rankSimilarAmongImageIds(
    queryVec,
    resourceIds = [],
    excludeId = null,
    minSimilarity = 0,
    model = null
  ) {
    const ids = [...new Set(resourceIds.map((id) => Number(id)).filter((id) => id > 0))]
    if (!ids.length) return []

    const queryDim = queryVec?.length || 0
    const minSim = Math.min(1, Math.max(0, Number(minSimilarity) || 0))
    const modelFilter = model ? String(model) : null
    const scored = []
    const chunkSize = 400
    for (let i = 0; i < ids.length; i += chunkSize) {
      const chunk = ids.slice(i, i + chunkSize)
      const ph = chunk.map(() => '?').join(',')
      const rows = this.db
        .prepare(
          `SELECT resourceId, embedding, dim, model FROM fbw_resource_image_vec_blob WHERE resourceId IN (${ph})`
        )
        .all(...chunk)
      for (const row of rows) {
        if (modelFilter && String(row.model) !== modelFilter) continue
        const hit = this._scoreEmbeddingRow(queryVec, row, queryDim, excludeId)
        if (hit && hit.similarity >= minSim) scored.push(hit)
      }
    }
    scored.sort((a, b) => b.similarity - a.similarity)
    return scored
  }

  rankSimilarGlobalImage(queryVec, excludeId = null, minSimilarity = 0, model = null) {
    const queryDim = queryVec?.length || 0
    const minSim = Math.min(1, Math.max(0, Number(minSimilarity) || 0))
    const modelFilter = model ? String(model) : null
    const rows = this.db
      .prepare(`SELECT resourceId, embedding, dim, model FROM fbw_resource_image_vec_blob`)
      .all()
    const scored = []
    for (const row of rows) {
      if (modelFilter && String(row.model) !== modelFilter) continue
      const hit = this._scoreEmbeddingRow(queryVec, row, queryDim, excludeId)
      if (hit && hit.similarity >= minSim) scored.push(hit)
    }
    scored.sort((a, b) => b.similarity - a.similarity)
    return scored
  }
}
