# 资源库数据模型（主表 + AI 附表）

> 文档版本：**v1.4**  
> 整理日期：2026-06-05  
> 状态：**已实现**（启动时 `migrateResourceAiSplitV1` + FK / 复合 PK 迁移；画面向量 PK 迁移过滤孤儿行）  
> 关联：[ai-dev-plan.md](./ai-dev-plan.md) · [resource-lifecycle-and-cleanup.md](./resource-lifecycle-and-cleanup.md) · [privacy-and-sensitive-content.md](./privacy-and-sensitive-content.md) · [README.md](./README.md)

---

## 1. 设计原则

| 原则 | 说明 |
|------|------|
| 主表存文件与插件元数据 | `fbw_resources`：路径、尺寸、插件入库 `title`/`desc`、本地质量任务分等 |
| AI 结果独立附表 | `fbw_resource_ai`：分析状态、AI 文案、美学分、敏感等级、失败计数等 |
| API 兼容投影 | 列表查询 `LEFT JOIN` 后仍暴露 `title`/`desc`/`score`/`nsfwLevel`/`aiAnalysisStatus` 等别名（见 `RESOURCE_AI_SELECT_SQL`） |
| 外键 | `PRAGMA foreign_keys = ON`；`fbw_resource_ai` 及 junction / 向量表 → `fbw_resources` **ON DELETE CASCADE**（旧库见 `upgradeResourceForeignKeys`） |

---

## 2. 表结构速查

### `fbw_resources`（主表）

| 字段（要点） | 说明 |
|--------------|------|
| `resourceName` | 资源源标识；插件本地库为 **`源名_插件名`**（`buildCompositeId`，见 `pluginResourceId.js`） |
| `title` / `desc` | **插件/API 入库**文案；清空 AI 时 **保留** |
| `imageUrl` / `videoUrl` | 远程原始地址（插件/API 入库或下载时保留，**不因本地化而改写**） |
| `posterPath` | **视频封面**本地路径；下载远程视频时额外 GET `imageUrl` 存为 `{fileName}.poster.jpg`；本地扫描入库的视频默认为空 |
| `qualityScore` | 本地质量扫描任务评分（原主表 `score` 列迁移更名，**非 AI 美学分**） |
| 无 AI 列 | 迁移后不再含 `summary`、`aiAnalysisStatus`、`nsfwLevel` 等 |

### `fbw_resource_ai`（附表，`resourceId` PK → `fbw_resources.id`）

| 字段 | 说明 |
|------|------|
| `aiTitle` / `aiDesc` | AI 生成标题与描述 |
| `summary` | AI 摘要 |
| `aiScore` | AI 美学评分（列表投影为 `score`） |
| `nsfwLevel` / `safeForWork` | 敏感分级；`NULL` 表示未分析 |
| `aiAnalysisStatus` | `pending` / `running`（内存态）/ `done` / `failed` / `skipped` |
| `aiAnalyzedAt` | 最近成功分析时间 |
| `aiAnalysisFailCount` | 后台连续失败次数（成功归零） |

### 其它关联表（未拆）

| 表 | 内容 |
|----|------|
| `fbw_resource_words` | AI/插件标签 |
| `fbw_resource_vec_blob` / `fbw_resource_embeddings` | 文本向量 |
| `fbw_resource_image_vec_blob` | 画面向量；**主键 `(resourceId, model)`**（同资源可存多 model） |

---

## 3. 启动迁移

| 项 | 说明 |
|----|------|
| 入口 | `upgradeResourcesSchema`：`migrateResourceAiSplitV1` + `posterPath` + `migrateImageVecBlobCompositePk` + `ensureVisualEmbedStateTable` + `upgradeResourceForeignKeys` + `migrateResourceVecTablesFk` |
| 版本跃迁 | `VersionManager` 仅加载 `resources/migrations/1.3.8_to_2.0.0.mjs`（1.3.8→2.0.0 一次性表/索引 + 调用 `upgradeResourcesSchema`） |
| 画面向量 PK | `migrateImageVecBlobCompositePk`：旧单主键 `(resourceId)` → `(resourceId, model)`；**INSERT 仅保留** `resourceId ∈ fbw_resources` 的行，跳过孤儿向量 |
| 已迁移判定 | 主表存在 `qualityScore` 且 **无** `aiAnalysisStatus`（`isResourceAiSplitDone`） |
| 数据搬迁 | 旧主表 AI 列写入附表；含 **`fileType IN ('image','video')`**；`done` 时复制 title/desc 到 AI 附表 |
| 插件 ID | 另有一次性 `pluginResourceIdFormatV1`（`pluginResourceMigration.mjs`），与 AI 拆分独立 |

---

## 4. 查询约定

| 场景 | 做法 |
|------|------|
| 探索/列表/推荐 | `FROM fbw_resources r` + `RESOURCE_AI_JOIN` + `RESOURCE_AI_SELECT_SQL` |
| 敏感壁纸过滤 | `getNsfwSafeSqlClause('r')` → `NOT EXISTS (SELECT 1 FROM fbw_resource_ai … nsfwLevel >= 2)` |
| 排序 `sortField=score` | `COALESCE(ai.aiScore, 0)`（AI 美学分，非 `qualityScore`） |
| 清空 AI（工具页） | `clearAiAnalysisDataForResourceIds` + `deleteAutoCollections`；**图片与有封面视频**；不删主表插件文案 |
| 清空资源库（工具页） | `clearResourcesLibraryData`：全部 `fbw_resources` + cleanup + auto 合集；**不**整表清收藏/回忆 — 见 [resource-lifecycle-and-cleanup.md](./resource-lifecycle-and-cleanup.md) |

---

## 5. 代码锚点

| 模块 | 路径 |
|------|------|
| 附表 DDL / JOIN / 投影 | `src/main/store/resourceAiSql.mjs` |
| 迁移 | `src/main/store/schemaUpgrade.mjs` |
| 新库 DDL | `src/main/store/sql.mjs` |
| 列表 | `src/main/store/ResourcesManager.mjs` |
| 分析读写 | `src/main/ai/AiAnalysisManager.mjs` |
| 关联清理 | `src/main/store/resourceDeleteCleanup.mjs` |
| 清空资源库 | `DatabaseManager.clearResourcesLibrary`；IPC `main:clearResourcesLibrary` |
| 清空 AI | `AiAnalysisManager.clearAllAiAnalysisData`；IPC `resetAiAnalysis` |
| 插件复合 ID | `src/common/pluginResourceId.js`、`pluginResourceMigration.mjs` |

---

## 6. 修订记录

| 版本 | 日期 | 说明 |
|------|------|------|
| v1.0 | 2026-05-27 | 初版：AI 附表拆分、`qualityScore`、投影与迁移、清空 AI 语义 |
| v1.1 | 2026-05-27 | 新增 `posterPath`：视频下载本地化封面；`imageUrl`/`videoUrl` 保持远程原址 |
| v1.2 | 2026-05-27 | 远程收藏隐式下载入库；自动下载 `downloadMediaTypes` 多选；统一 `downloadFile` |
| **v1.3** | **2026-06-03** | FK CASCADE；画面向量复合主键；视频纳入 AI 迁移；清空资源库与 cleanup 模块；链至 `resource-lifecycle-and-cleanup.md` |
| **v1.4** | **2026-06-05** | `migrateImageVecBlobCompositePk` 孤儿行过滤与失败清理；版本迁移脚本仅 `1.3.8_to_2.0.0.mjs` |
