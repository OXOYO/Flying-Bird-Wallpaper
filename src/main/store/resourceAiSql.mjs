/** AI 分析附表与查询片段（与 fbw_resources 主表分离） */

export const CREATE_RESOURCE_AI_TABLE = `CREATE TABLE IF NOT EXISTS fbw_resource_ai (
  resourceId INTEGER PRIMARY KEY,
  aiTitle TEXT NOT NULL DEFAULT '',
  aiDesc TEXT NOT NULL DEFAULT '',
  summary TEXT NOT NULL DEFAULT '',
  aiScore INTEGER NOT NULL DEFAULT 0,
  nsfwLevel INTEGER,
  safeForWork INTEGER,
  aiAnalysisStatus TEXT NOT NULL DEFAULT 'pending',
  aiAnalyzedAt DATETIME,
  aiAnalysisFailCount INTEGER NOT NULL DEFAULT 0,
  updated_at DATETIME DEFAULT (datetime('now', 'localtime')),
  FOREIGN KEY (resourceId) REFERENCES fbw_resources(id) ON DELETE CASCADE
)`

export const RESOURCE_AI_INDEXES = [
  'CREATE INDEX IF NOT EXISTS idx_resource_ai_status ON fbw_resource_ai(aiAnalysisStatus)',
  'CREATE INDEX IF NOT EXISTS idx_resource_ai_nsfw ON fbw_resource_ai(nsfwLevel)',
  'CREATE INDEX IF NOT EXISTS idx_resource_ai_score ON fbw_resource_ai(aiScore)'
]

/** LEFT JOIN，列表查询在 FROM fbw_resources r 后追加 */
export const RESOURCE_AI_JOIN = `LEFT JOIN fbw_resource_ai ai ON ai.resourceId = r.id`

/**
 * 与旧 API 兼容的投影列（接在 r.* 后，逗号前缀）
 * - title/desc：展示用，优先 AI 文案
 * - score：AI 美学分
 */
export const RESOURCE_AI_SELECT_SQL = `
  COALESCE(NULLIF(ai.aiTitle, ''), r.title) AS title,
  COALESCE(NULLIF(ai.aiDesc, ''), r.desc) AS desc,
  r.title AS sourceTitle,
  r.desc AS sourceDesc,
  ai.aiTitle AS aiTitle,
  ai.aiDesc AS aiDesc,
  ai.summary AS summary,
  COALESCE(ai.aiScore, 0) AS score,
  ai.nsfwLevel AS nsfwLevel,
  COALESCE(ai.aiAnalysisStatus, 'pending') AS aiAnalysisStatus,
  ai.aiAnalyzedAt AS aiAnalyzedAt,
  COALESCE(ai.aiAnalysisFailCount, 0) AS aiAnalysisFailCount,
  ai.safeForWork AS safeForWork`

export function hasLegacyAiColumnsOnResources(db) {
  const cols = db.prepare('PRAGMA table_info(fbw_resources)').all()
  return cols.some((c) => c.name === 'aiAnalysisStatus' || c.name === 'summary')
}

export function isResourceAiSplitDone(db) {
  const cols = db.prepare('PRAGMA table_info(fbw_resources)').all()
  return cols.some((c) => c.name === 'qualityScore') && !cols.some((c) => c.name === 'aiAnalysisStatus')
}
