# 资源生命周期与关联清理

> 文档版本：**v1.0**  
> 整理日期：**2026-06-03**  
> 状态：**已实现**  
> 关联：[data-model-resources-and-ai.md](./data-model-resources-and-ai.md) · [main-window-ux-and-infrastructure.md](./main-window-ux-and-infrastructure.md) · [ai-visual-embedding-and-similar.md](./ai-visual-embedding-and-similar.md) · [README.md](./README.md)

---

## 1. 设计目标

| 目标 | 说明 |
|------|------|
| 删资源不残留 | 删除 `fbw_resources` 行时，附表（AI、向量、标签、合集成员、收藏/回忆/隐私/统计）同步清理 |
| 统一入口 | 优先走 `resourceDeleteCleanup.mjs`，避免各路径手写 DELETE 分叉 |
| 库级约束 | 关键 junction 表 `ON DELETE CASCADE`；旧库启动时 `upgradeResourceForeignKeys` 迁移 |
| 语义区分 | **清空资源库** vs **清空 AI** vs **clearDB(按源)** 行为不同，文档与 IPC 分开 |

---

## 2. 核心模块 `resourceDeleteCleanup.mjs`

| 函数 | 用途 |
|------|------|
| `cleanupResourceRelatedData(db, ids)` | 删主表**前**：合集成员、词库递减、向量、AI、收藏/回忆/隐私/统计 |
| `purgeResourceRecords(db, ids)` | cleanup + `DELETE fbw_resources`（**不删磁盘**） |
| `clearResourcesLibraryData(db)` | 清**全部**资源行 + auto 合集 + cleanup；**不**整表清收藏/回忆 |
| `clearAiAnalysisDataForResourceIds(db, ids)` | 仅清 AI 附表（标签/向量/`fbw_resource_ai`），保留主表 |
| `decrementWordCountsForResourceIds` | 按 `wordId` **GROUP BY 链接数**递减（修复批量删少减） |
| `deleteAutoCollections` | 删 `source='auto'` 合集及成员 |
| `pruneOrphanCollectionItems` | 删 `collection_items` 中已无主表资源的孤儿行 |

---

## 3. 删除 / 清理路径一览

| 路径 | 磁盘 | DB 主表 | 附表清理 | 备注 |
|------|------|---------|----------|------|
| `FileManager.deleteFile` | ✅ unlink | `purgeResourceRecords` | ✅ 经 cleanup | 无 `id` 时按 `filePath` 查 id；IPC 包 `enterResourceMaintenance` |
| 目录刷新 prune | — | `purgeResourceRecords` | ✅ | 仅 `scanComplete !== false` 时 prune |
| `clearResourcesLibrary`（工具页） | 不删 | 全删 | ✅ + auto 合集 | IPC `main:clearResourcesLibrary` |
| `clearDB(fbw_resources)` **全量** | 不删 | 委托 `clearResourcesLibraryData` | ✅ | 与清空资源库对齐（2026-06-03） |
| `clearDB(fbw_resources, resourceName)` | 不删 | 按源删 | ✅ per-id cleanup | 如按插件源名删 |
| `clearAllAiAnalysisData` | — | 保留 | AI 附表 + auto 合集 | 复用 `clearAiAnalysisDataForResourceIds` |
| `clearDB(fbw_resource_words)` | — | — | 清 junction + **整表 `fbw_words`** | 避免 count 漂移 |
| 删合集 | — | 不删资源 | 仅删 items + collection 行 | `CollectionsManager.delete` |

**仍有限制：** `FileManager.refreshDirectory` / `deleteFile` 主要面向 `resourceName='local'`；远程插件资源删除/刷新路径见 §8。

---

## 4. Schema 与迁移（2026-06-03）

入口：`DatabaseManager._init` → `upgradeResourcesSchema`（在 `createIndexes` 之前）。

| 变更 | 说明 |
|------|------|
| **FK CASCADE** | `favorites` / `history` / `privacy_space` / `statistics` / `resource_words` / `collection_items` / `resource_embeddings` / `resource_vec_blob` → `fbw_resources`；旧库 `upgradeResourceForeignKeys` |
| **画面向量复合主键** | `fbw_resource_image_vec_blob`：`PRIMARY KEY (resourceId, model)`；`migrateImageVecBlobCompositePk` |
| **AI 拆分迁移** | `migrateResourceAiSplitV1` 含 **video** AI 搬迁；`PRAGMA foreign_keys=OFF` 后再 `DROP TABLE` |
| **`posterPath`** | 迁移 DDL 与 `sql.mjs` 对齐；仍保留 `addColumnIfMissing` 兜底 |

新库 DDL：`src/main/store/sql.mjs`。VecStore 动态表与复合 PK / FK 与上表一致。

---

## 5. 目录刷新（local）

| 阶段 | 行为 |
|------|------|
| 子进程扫描 | `listDirectoryFilePaths` 全量 glob；**任一路径失败** → `scanComplete=false`，不传 prune 集合 |
| 增量列表 | `readDirRecursive` → 新增/变更文件列表 |
| 主进程 insert | `ON CONFLICT(filePath) DO UPDATE`：mtime/大小/类型变化时更新元数据 |
| prune | DB 中 `resourceName=local` 且 `filePath` 不在扫描集合 → `purgeResourceRecords` |
| 收尾 | `pruneOrphanCollectionItems` |

IPC 成功且 `insertedCount` / `updatedCount` / `prunedCount` > 0 时触发探索列表刷新。

---

## 6. 清空 AI vs 清空资源库

| 操作 | 入口 | 范围 |
|------|------|------|
| **清空 AI 分析数据** | 工具页 `resetAiAnalysis` | 库内**可分析资源**（`fileType IN ('image','video')`）：附表 + 向量 + 标签关联 + **auto 合集**；主表插件 `title`/`desc` 保留 |
| **清空资源库** | 工具页 `clearResourcesLibraryDB` | **全部** `fbw_resources` + 关联 cleanup + auto 合集；**不**整表清收藏/回忆/隐私 |

i18n 文案已改为「图片与（有封面的）视频」（`zh-CN` / `en-US`）。

---

## 7. 视频与 AI（方案 A）

| 项 | 说明 |
|----|------|
| 视觉路径 | `AiVisionResourcePath.resolveVisionImagePath`：图片 `filePath`；视频 **`posterPath`** |
| 分析 / 向量 / 策展 | `buildAnalyzableResourceWhere`：有封面视频与图片同等纳入队列 |
| 增量入系统合集 | `incrementalAddResource` 排除 **隐私空间**（与批量策展 `COLLECTION_PRIVACY_EXCLUDE_SQL` 一致） |
| 远程画面 fallback | embed 失败回退内置时，向量以 **active model id** 写入；查询支持 model 回退 |

详述：[ai-analysis-ux-and-performance.md](./ai-analysis-ux-and-performance.md) · [ai-visual-embedding-and-similar.md](./ai-visual-embedding-and-similar.md)

---

## 8. 其它逻辑修复（同批）

| 主题 | 说明 |
|------|------|
| `RecommendManager.recommend` | 虚拟 `resourceName`（`resources` / `favorites` / `history`）与 search 对齐；偏好标签排除隐私；tag 零结果降级 |
| 语义搜索统计 | `search({ skipStatistics: true })` 过滤路径不 +views |
| `findSimilar` IPC | 校验 `resourceId`；collection scope 缺 id 返回 `null`（不限制范围） |
| 合集 `itemCount` | `JOIN fbw_resources`，不计孤儿成员 |
| 合集 `useSemantic` | 用户显式 `false` 不再被强制改 `true` |
| 动态壁纸性能 | `BaseSetting` → `setDynamicWallpaperPerformance`（修复错误方法名） |
| `getAiAnalysisStats.total` | 含 `skipped` |

---

## 9. 代码锚点

| 模块 | 路径 |
|------|------|
| 关联清理 | `src/main/store/resourceDeleteCleanup.mjs` |
| Schema 迁移 | `src/main/store/schemaUpgrade.mjs` |
| 清空资源库 | `DatabaseManager.clearResourcesLibrary`、`Utils.vue` |
| 删文件 | `FileManager.deleteFile`、`index.mjs` `main:deleteFile` |
| 刷新目录 | `file_server/index.mjs`、`FileManager.processDirectoryData` |
| 视觉路径 | `src/main/ai/AiVisionResourcePath.mjs` |
| 推荐（仅后端） | `RecommendManager.mjs`、`main:recommend` |

---

## 10. 已知限制（未做 / 刻意保留）

| 项 | 说明 |
|------|------|
| 前端未接 `recommend` / `parseSearchQuery` | 后端 IPC 就绪，产品入口待做 |
| `FileManager` 本地限定 | FIXME：刷新/删除以 `local` 为主 |
| 用户合集空壳 | 清空资源库后用户自建合集行保留、成员被 FK 清掉 |
| sqlite-vec 索引 | `fbw_image_vec_index` 仍按单 resourceId；多 model 时 BLOB 路检索为准 |

---

## 11. 修订记录

| 版本 | 日期 | 说明 |
|------|------|------|
| v1.0 | 2026-06-03 | 关联清理统一、FK/复合 PK 迁移、刷新 UPSERT+prune、clearDB 对齐、视频 AI/清空语义、Recommend/IPC 修复 |
