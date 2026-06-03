// 创建表
export const createTables = [
  // 数据表: fbw_sys 用于存储系统数据
  `CREATE TABLE IF NOT EXISTS fbw_sys (
    storeKey TEXT PRIMARY KEY, -- 存储Key
    storeData TEXT NOT NULL, -- 存储数据
    storeType TEXT NOT NULL DEFAULT 'string', -- 数据类型
    created_at DATETIME DEFAULT (datetime('now', 'localtime')), -- 记录创建时间
    updated_at DATETIME DEFAULT (datetime('now', 'localtime')), -- 记录修改时间
    UNIQUE (storeKey) -- 唯一键
  )`,
  // 数据表: fbw_favorites 用于存储收藏夹数据
  `CREATE TABLE IF NOT EXISTS fbw_favorites (
    id INTEGER PRIMARY KEY AUTOINCREMENT, -- 收藏记录自增ID
    resourceId INTEGER NOT NULL REFERENCES fbw_resources(id) ON DELETE CASCADE, -- 资源记录ID
    created_at DATETIME DEFAULT (datetime('now', 'localtime')), -- 记录创建时间
    updated_at DATETIME DEFAULT (datetime('now', 'localtime')), -- 记录修改时间
    UNIQUE (resourceId) -- 唯一键
  )`,
  // 数据表: fbw_history 用于存储已设置的壁纸记录数据
  `CREATE TABLE IF NOT EXISTS fbw_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT, -- 壁纸记录自增ID
    resourceId INTEGER NOT NULL REFERENCES fbw_resources(id) ON DELETE CASCADE, -- 资源记录ID
    created_at DATETIME DEFAULT (datetime('now', 'localtime')), -- 记录创建时间
    updated_at DATETIME DEFAULT (datetime('now', 'localtime')), -- 记录修改时间
    UNIQUE (id) -- 唯一键
  )`,
  // 数据表: fbw_privacy_space 用于存储隐私空间数据
  `CREATE TABLE IF NOT EXISTS fbw_privacy_space (
    id INTEGER PRIMARY KEY AUTOINCREMENT, -- 隐私空间记录自增ID
    resourceId INTEGER NOT NULL REFERENCES fbw_resources(id) ON DELETE CASCADE, -- 资源记录ID
    created_at DATETIME DEFAULT (datetime('now', 'localtime')), -- 记录创建时间
    updated_at DATETIME DEFAULT (datetime('now', 'localtime')), -- 记录修改时间
    UNIQUE (resourceId) -- 唯一键
  )`,
  // 数据表: fbw_statistics 用于存储资源统计数据
  `CREATE TABLE IF NOT EXISTS fbw_statistics (
    id INTEGER PRIMARY KEY AUTOINCREMENT, -- 统计记录自增ID
    resourceId INTEGER NOT NULL REFERENCES fbw_resources(id) ON DELETE CASCADE, -- 资源记录ID
    views INTEGER NOT NULL DEFAULT 0, -- 曝光次数
    downloads INTEGER NOT NULL DEFAULT 0, -- 下载次数
    favorites INTEGER NOT NULL DEFAULT 0, -- 收藏次数
    wallpapers INTEGER NOT NULL DEFAULT 0, -- 设置为壁纸次数
    created_at DATETIME DEFAULT (datetime('now', 'localtime')), -- 记录创建时间
    updated_at DATETIME DEFAULT (datetime('now', 'localtime')), -- 记录修改时间
    UNIQUE (resourceId) -- 唯一键
  )`,
  // 数据表: fbw_resources 用于存储图片资源数据
  `CREATE TABLE IF NOT EXISTS fbw_resources (
    id INTEGER PRIMARY KEY AUTOINCREMENT, -- 资源记录自增ID
    resourceName TEXT NOT NULL DEFAULT '', -- 资源名称
    fileName TEXT NOT NULL DEFAULT '', -- 文件名
    filePath TEXT NOT NULL DEFAULT '', -- 文件路径
    fileExt TEXT NOT NULL DEFAULT '', -- 文件扩展名
    fileType TEXT NOT NULL DEFAULT 'image', -- 文件类型
    fileSize INTEGER NOT NULL DEFAULT 0, -- 文件大小
    imageUrl TEXT NOT NULl DEFAULT '', -- 远程资源图片网址
    videoUrl TEXT NOT NULl DEFAULT '', -- 远程资源视频网址
    posterPath TEXT NOT NULL DEFAULT '', -- 视频封面本地路径（下载后）
    author TEXT NOT NULL DEFAULT '', -- 作者
    link TEXT NOT NULL DEFAULT '', -- 页面链接
    title TEXT NOT NULL DEFAULT '', -- 标题
    desc TEXT NOT NULL DEFAULT '', -- 描述
    quality TEXT NOT NULL DEFAULT '', -- 图片质量
    width INTEGER NOT NULL DEFAULT 0, -- 图片宽度
    height INTEGER NOT NULL DEFAULT 0, -- 图片高度
    isLandscape INTEGER NOT NULL DEFAULT -1, -- 是否为横屏
    qualityScore INTEGER NOT NULL DEFAULT 0, -- 本地质量任务评分（非 AI）
    dominantColor TEXT NOT NULL DEFAULT '', -- 主色调
    atimeMs INTEGER NOT NULL DEFAULT 0, -- 本地文件最后访问时间
    mtimeMs INTEGER NOT NULL DEFAULT 0, -- 本地文件最后修改时间
    ctimeMs INTEGER NOT NULL DEFAULT 0, -- 本地文件创建时间
    created_at DATETIME DEFAULT (datetime('now', 'localtime')), -- 记录创建时间
    updated_at DATETIME DEFAULT (datetime('now', 'localtime')), -- 记录修改时间
    UNIQUE (filePath) -- 唯一键
  )`,
  // 数据表：资源分词关联表
  `CREATE TABLE IF NOT EXISTS fbw_resource_words (
    id INTEGER PRIMARY KEY AUTOINCREMENT, -- 记录自增ID
    resourceId INTEGER NOT NULL REFERENCES fbw_resources(id) ON DELETE CASCADE, -- 资源ID
    wordId INTEGER NOT NULL REFERENCES fbw_words(id) ON DELETE CASCADE, -- 分词ID
    created_at DATETIME DEFAULT (datetime('now', 'localtime')), -- 记录创建时间
    updated_at DATETIME DEFAULT (datetime('now', 'localtime')), -- 记录修改时间
    UNIQUE (resourceId, wordId) -- 确保资源和分词的组合唯一
  )`,
  // 数据表：分词数据
  `CREATE TABLE IF NOT EXISTS fbw_words (
    id INTEGER PRIMARY KEY AUTOINCREMENT, -- 分词记录自增ID
    word TEXT NOT NULL DEFAULT '', -- 分词
    count INTEGER  NOT NULL DEFAULT 0, -- 计数
    type INTEGER  NOT NULL DEFAULT 0, -- 类型：中文、英文
    created_at DATETIME DEFAULT (datetime('now', 'localtime')), -- 记录创建时间
    updated_at DATETIME DEFAULT (datetime('now', 'localtime')), -- 记录修改时间
    UNIQUE (word) -- 唯一键
  )`,
  // 数据表：智能合集
  `CREATE TABLE IF NOT EXISTS fbw_collections (
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
    source TEXT NOT NULL DEFAULT 'user',
    lastGeneratedAt DATETIME,
    created_at DATETIME DEFAULT (datetime('now', 'localtime')),
    updated_at DATETIME DEFAULT (datetime('now', 'localtime'))
  )`,
  // 数据表：智能合集成员快照
  `CREATE TABLE IF NOT EXISTS fbw_collection_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    collectionId INTEGER NOT NULL REFERENCES fbw_collections(id) ON DELETE CASCADE,
    resourceId INTEGER NOT NULL REFERENCES fbw_resources(id) ON DELETE CASCADE,
    rank INTEGER NOT NULL DEFAULT 0,
    generated_at DATETIME DEFAULT (datetime('now', 'localtime')),
    UNIQUE (collectionId, resourceId)
  )`,
  // 数据表：资源向量元数据
  `CREATE TABLE IF NOT EXISTS fbw_resource_embeddings (
    resourceId INTEGER PRIMARY KEY REFERENCES fbw_resources(id) ON DELETE CASCADE,
    model TEXT NOT NULL DEFAULT '',
    dim INTEGER NOT NULL DEFAULT 0,
    updated_at DATETIME DEFAULT (datetime('now', 'localtime'))
  )`,
  // 数据表：资源 AI 视觉分析结果（1:1 附表，仅图片）
  `CREATE TABLE IF NOT EXISTS fbw_resource_ai (
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
  )`,
  // 数据表：资源视觉向量（找相似 · MobileCLIP2-S0 等）
  `CREATE TABLE IF NOT EXISTS fbw_resource_image_vec_blob (
    resourceId INTEGER NOT NULL REFERENCES fbw_resources(id) ON DELETE CASCADE,
    embedding BLOB NOT NULL,
    dim INTEGER NOT NULL,
    model TEXT NOT NULL DEFAULT 'mobileclip2-s0',
    updated_at DATETIME DEFAULT (datetime('now', 'localtime')),
    PRIMARY KEY (resourceId, model)
  )`,
  // 系统表：版本管理
  `CREATE TABLE IF NOT EXISTS fbw_version (
    id INTEGER PRIMARY KEY AUTOINCREMENT, -- 记录自增ID
    version TEXT NOT NULL, -- 版本号
    created_at DATETIME DEFAULT (datetime('now', 'localtime')), -- 记录创建时间
    updated_at DATETIME DEFAULT (datetime('now', 'localtime')), -- 记录修改时间
    UNIQUE (version) -- 唯一键
  )`
]

// 创建索引
export const createIndexes = [
  // 基础单列索引 - 按使用频率排序
  'CREATE INDEX IF NOT EXISTS idx_resources_resourcename ON fbw_resources(resourceName)',
  'CREATE INDEX IF NOT EXISTS idx_resources_created_at ON fbw_resources(created_at)',
  'CREATE INDEX IF NOT EXISTS idx_resources_landscape ON fbw_resources(isLandscape)',
  'CREATE INDEX IF NOT EXISTS idx_resources_quality ON fbw_resources(quality)',
  'CREATE INDEX IF NOT EXISTS idx_resources_filePath ON fbw_resources(filePath)',
  'CREATE INDEX IF NOT EXISTS idx_resources_fileExt ON fbw_resources(fileExt)',

  // 收藏、历史和隐私空间的基础索引
  'CREATE INDEX IF NOT EXISTS idx_favorites_resourceid ON fbw_favorites(resourceId)',
  'CREATE INDEX IF NOT EXISTS idx_favorites_created_at ON fbw_favorites(created_at)',
  'CREATE INDEX IF NOT EXISTS idx_history_resourceid ON fbw_history(resourceId)',
  'CREATE INDEX IF NOT EXISTS idx_history_created_at ON fbw_history(created_at)',
  'CREATE INDEX IF NOT EXISTS idx_privacy_space_resourceid ON fbw_privacy_space(resourceId)',
  'CREATE INDEX IF NOT EXISTS idx_privacy_space_created_at ON fbw_privacy_space(created_at)',

  // 统计表索引
  'CREATE INDEX IF NOT EXISTS idx_statistics_views ON fbw_statistics(views)',

  // 分词表索引
  'CREATE INDEX IF NOT EXISTS idx_words_type_count ON fbw_words(type, count)',

  // 复合索引
  'CREATE INDEX IF NOT EXISTS idx_resources_name_created ON fbw_resources(resourceName, created_at)',
  // 分词相关索引
  'CREATE INDEX IF NOT EXISTS idx_resource_words_resourceid ON fbw_resource_words(resourceId)',
  'CREATE INDEX IF NOT EXISTS idx_resource_words_wordid ON fbw_resource_words(wordId)',
  'CREATE INDEX IF NOT EXISTS idx_resources_quality_score ON fbw_resources(qualityScore)',
  'CREATE INDEX IF NOT EXISTS idx_resource_ai_status ON fbw_resource_ai(aiAnalysisStatus)',
  'CREATE INDEX IF NOT EXISTS idx_resource_ai_nsfw ON fbw_resource_ai(nsfwLevel)',
  'CREATE INDEX IF NOT EXISTS idx_resource_ai_score ON fbw_resource_ai(aiScore)',
  'CREATE INDEX IF NOT EXISTS idx_collections_pinned ON fbw_collections(isPinned, updated_at)',
  'CREATE INDEX IF NOT EXISTS idx_collection_items_collection ON fbw_collection_items(collectionId, rank)',
  'CREATE INDEX IF NOT EXISTS idx_image_vec_model ON fbw_resource_image_vec_blob(model)'
]
