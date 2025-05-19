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
    resourceId INTEGER NOT NULL, -- 资源记录ID
    created_at DATETIME DEFAULT (datetime('now', 'localtime')), -- 记录创建时间
    updated_at DATETIME DEFAULT (datetime('now', 'localtime')), -- 记录修改时间
    UNIQUE (resourceId) -- 唯一键
  )`,
  // 数据表: fbw_history 用于存储已设置的壁纸记录数据
  `CREATE TABLE IF NOT EXISTS fbw_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT, -- 壁纸记录自增ID
    resourceId INTEGER NOT NULL, -- 资源记录ID
    created_at DATETIME DEFAULT (datetime('now', 'localtime')), -- 记录创建时间
    updated_at DATETIME DEFAULT (datetime('now', 'localtime')), -- 记录修改时间
    UNIQUE (id) -- 唯一键
  )`,
  // 数据表: fbw_privacy_space 用于存储隐私空间数据
  `CREATE TABLE IF NOT EXISTS fbw_privacy_space (
    id INTEGER PRIMARY KEY AUTOINCREMENT, -- 隐私空间记录自增ID
    resourceId INTEGER NOT NULL, -- 资源记录ID
    created_at DATETIME DEFAULT (datetime('now', 'localtime')), -- 记录创建时间
    updated_at DATETIME DEFAULT (datetime('now', 'localtime')), -- 记录修改时间
    UNIQUE (resourceId) -- 唯一键
  )`,
  // 数据表: resources 用于存储图片资源数据
  `CREATE TABLE IF NOT EXISTS fbw_resources (
    id INTEGER PRIMARY KEY AUTOINCREMENT, -- 资源记录自增ID
    resourceName TEXT NOT NULL DEFAULT '', -- 资源名称
    fileName TEXT NOT NULL DEFAULT '', -- 文件名
    filePath TEXT NOT NULL DEFAULT '', -- 文件路径
    fileExt TEXT NOT NULL DEFAULT '', -- 文件扩展名
    fileSize INTEGER NOT NULL DEFAULT 0, -- 文件大小
    url TEXT NOT NULl DEFAULT '', -- 远程资源网址
    author TEXT NOT NULL DEFAULT '', -- 作者
    link TEXT NOT NULL DEFAULT '', -- 页面链接
    title TEXT NOT NULL DEFAULT '', -- 标题
    desc TEXT NOT NULL DEFAULT '', -- 描述
    quality TEXT NOT NULL DEFAULT '', -- 图片质量
    width INTEGER NOT NULL DEFAULT 0, -- 图片宽度
    height INTEGER NOT NULL DEFAULT 0, -- 图片高度
    isLandscape INTEGER NOT NULL DEFAULT -1, -- 是否为横屏
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
    resourceId INTEGER NOT NULL, -- 资源ID
    wordId INTEGER NOT NULL, -- 分词ID
    created_at DATETIME DEFAULT (datetime('now', 'localtime')), -- 记录创建时间
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

  // 分词表索引
  'CREATE INDEX IF NOT EXISTS idx_words_type_count ON fbw_words(type, count)',

  // 复合索引
  'CREATE INDEX IF NOT EXISTS idx_resources_name_created ON fbw_resources(resourceName, created_at)',
  // 分词相关索引
  'CREATE INDEX IF NOT EXISTS idx_resource_words_resourceid ON fbw_resource_words(resourceId)',
  'CREATE INDEX IF NOT EXISTS idx_resource_words_wordid ON fbw_resource_words(wordId)'
]
