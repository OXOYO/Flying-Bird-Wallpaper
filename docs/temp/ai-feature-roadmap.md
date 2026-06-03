# 飞鸟壁纸 AI 能力完整功能清单

> 文档版本：**v2.4**  
> 整理日期：**2026-06-03**  
> 状态：**2.0.0 核心已落地**；系统合集 **v1.7**；**资源生命周期 / 视频 AI** 已落地；部分 P3/P4 仍为规划  
> 关联：[resource-lifecycle-and-cleanup.md](./resource-lifecycle-and-cleanup.md) · [data-model-resources-and-ai.md](./data-model-resources-and-ai.md) · [ai-dev-plan.md](./ai-dev-plan.md) · [README.md](./README.md)

**图例：** ✅ 已实现 · 🟡 部分实现 · ⬜ 未开始

---

## 1. 背景与目标

飞鸟壁纸 AI 2.0 目标：

1. 可配置本地/远程 AI 替代 ONNX 评分与 jieba 分词（legacy 开关过渡）
2. sqlite-vec 语义检索（文本向量）与**画面找相似**（内置 MobileCLIP 或 **远程画面向量**；RRF 画面优先 + 文案 boost）
3. **智能合集**独立菜单：用户自定义 + **系统自动策展**
4. 推荐、自动化、H5 文字能力

**明确不做：** H5 语音 STT；独立向量数据库进程；Sprint 5 OpenClaw（见 [openclaw-agent-integration.md](./openclaw-agent-integration.md)）

---

## 2. 已确认架构决策

| 决策项 | 结论 |
|--------|------|
| AI 接入 | 主进程 `AiAnalysisProvider` |
| 本地/远程 | Ollama + OpenAI 兼容（OpenRouter 等预设） |
| 向量 | sqlite-vec，失败 BLOB 降级 |
| 分析策略 | 按需 / 后台慢速 / 仅新图 |
| 智能合集 | 独立 `Collections` 菜单；`source=user` 自定义 + `source=auto` 系统 |
| 系统策展 | **画面** K-Means → **按簇** LLM 命名 + UI locale 对齐 + 语义剔图 |

---

## 3. 基础设施

| 模块 | 状态 | 路径/说明 |
|------|------|-----------|
| AiAnalysisProvider | ✅ | `src/main/ai/AiAnalysisProvider.mjs` |
| AiAnalysisManager | ✅ | 队列、写库、tags、触发策展 |
| EmbeddingManager | ✅ | 文本/画面向量化 + `findSimilar`（`HybridSimilarSearch`） |
| HybridSimilarSearch | ✅ | 画面路为主 + 文案 boost；内部阈值 |
| VisualCollectionSearch | ✅ | 用户合集画面语义（**仅氛围型**；实体词禁用） |
| TextQueryParser.expandCollectionKeywordTags | ✅ | 合集短实体词 LLM 动态扩 tags（无硬编码别名表） |
| EmbedRequestBuilder | ✅ | 多服务商 embed 请求方言 |
| ImageVisualEmbedder | ✅ | ONNX MobileCLIP2-S0（内置默认） |
| VecStore | ✅ | 文本表 + **`fbw_resource_image_vec_blob`**；按 model 分桶 KNN |
| VectorCluster | ✅ | K-Means 氛围聚类 |
| CollectionCurator | ✅ | 自动策展三阶段 |
| TaskScheduler | ✅ | `aiAnalysis`、`collectionCurator`、`collectionsRefresh` |
| schemaUpgrade | ✅ | 旧库补列；**`migrateResourceAiSplitV1`**（AI 附表）；**FK CASCADE**、画面向量复合 PK、video 迁移 |
| resourceAiSql | ✅ | `fbw_resource_ai`、JOIN、列表投影 |
| pluginResourceId | ✅ | 本地 `resourceName` = `源名_插件名` |

### 设置项 `settingData.ai`（已实现字段）

`enabled`、`visionPreset`/`textPreset`、`visionModel`/`textModel`/`embeddingModel`（**仅文本 embed**）、`visualEmbedSource`（默认 `builtin`）、`visualEmbedPreset`/`visualEmbedProvider`/`visualEmbedBaseUrl`/`visualEmbedApiKey`/`visualEmbedModel`（**远程画面向量**，独立第三套）、`timeout`（默认 **300s**，视觉分析动态加成；测试连接 **60s** 上限）、`visionPreprocess`/`visionMaxLongEdge`/`visionPreprocessMinSizeMB`/`visionJpegQuality`、`analysisMode`、`analysisMaxRetries`（默认 **1**，**设置页不展示**）、`concurrency`（默认 **1**，**设置页不展示**）、`autoCollectionsEnabled`、`scoreMinFilter`（默认 70）、`autoCollectionsMaxCount`（默认 20，3～50）、`autoCurateSettled`/`autoCurateSettledAnalyzed`（内部锁存）、`expandDownloadKeywords`、`legacyOnnxScore`、`legacyJiebaTags` 等。**已移除** `enableNsfwCheck`（改由 `privacy.enableNsfwContentMask`，见 [privacy-and-sensitive-content.md](./privacy-and-sensitive-content.md)）。分析成功后：**文本向量**需 `ai.enabled`；**画面向量**默认内置（`visualEmbedSource=builtin`），remote 时走独立服务、失败回退内置。找相似阈值 **不暴露**（`SIMILAR_*` 内部常量）。电池下后台分析/视觉补算受「省电模式」约束（**仅电池 + 省电**）；关省电或插 AC 后 **`resumeBackgroundAiTasksIfAllowed`** 自动恢复 pump（见 [ai-analysis-ux-and-performance.md](./ai-analysis-ux-and-performance.md) §4.2）。`scoreMinFilter` / `autoCollectionsMaxCount` 在 **AiSetting → 功能选项 → AI 自动整理合集** 下方；**内置画面向量**在 **兼容选项**；远程时显示 **画面向量服务** 卡片。

**`settingData.search`：** `useSemanticSearch`（智能语义搜索，探索/H5 筛选；原 `ai.smartSearch` 已迁移）。

---

## 4. 功能清单与实现状态

### 4.1 核心 AI 分析（P0）

| ID | 功能 | 状态 | 说明 |
|----|------|------|------|
| AI-001 | AI 美学评分 | ✅ | 写入 **`fbw_resource_ai.aiScore`**（列表投影 `score`） |
| AI-002 | AI 标签 | ✅ | `applyTagsFromAnalysis` → `fbw_words` |
| AI-003 | 自动标题/描述 | ✅ | 分析 pipeline |
| AI-004 | summary | ✅ | 预览/搜索 |
| AI-005 | AiAnalysisProvider | ✅ | Ollama + OpenAI 兼容 |
| AI-006 | AI 设置页 | ✅ | `AiSetting.vue`：进度卡、模型测试、ⓘ Tooltip |
| AI-007 | 分析任务队列 | ✅ | `background_slow` / `new_only`；**image + 有封面 video**；看门狗 60s 首启 + 3min；省电暂停后可自动恢复 |
| AI-008 | 文本 embedding 入库 | ✅ | `fbw_resource_vec_blob`；分析后 + 语义搜索 |
| AI-008a | **视觉 embedding 入库** | ✅ | 内置 MobileCLIP + 可选远程；`fbw_resource_image_vec_blob` |
| AI-008b | 视觉向量后台补算 | ✅ | 定时任务 `visualEmbed`；每轮批量补算；省电暂停后可自动恢复 |
| AI-017 | 省电恢复后台 AI | ✅ | `restartPowerSaveDependentTasks` + `resumeBackgroundAiTasksIfAllowed`；插 AC 同步恢复 |
| AI-008c | **远程画面向量服务** | ✅ | 独立 `visualEmbed*` 配置；`EmbedRequestBuilder`；NVIDIA/OpenRouter 等 |
| AI-009 | 分析前缩图 | ✅ | `AiVisionImagePrep.mjs` |
| AI-010 | 视觉动态超时 | ✅ | `resolveEffectiveVisionTimeout` |
| AI-011 | 分析耗时日志 | ✅ | `[AiVisionPrep]`、`vision-http modelMs` |
| AI-012 | 后台失败重试上限 | ✅ | `analysisMaxRetries`（默认 1，UI 隐藏）+ **`fbw_resource_ai.aiAnalysisFailCount`**；达上限 → `skipped`；手动分析不限 |
| AI-013 | 清空库内 AI 分析数据 | ✅ | 工具页 → `resetAiAnalysis`；**图片 + 有封面视频**；删附表+标签+向量+**系统推荐合集** |
| AI-014 | 失败项重新入队 | ✅ | 设置进度卡失败 chip → `requeueFailedAiAnalysis` |
| AI-015 | AI 字段附表拆分 | ✅ | `fbw_resource_ai`；主表 `qualityScore`；启动迁移（含 video） |
| AI-016 | 分析进度卡常显 | ✅ | 与 `ai.enabled` 解耦；`BaseSetting` / `AiSetting` 均挂载 |
| AI-018 | **视频封面 AI 分析** | ✅ | 方案 A：`posterPath` 单帧；`AiVisionResourcePath`；菜单/向量/策展纳入 |
| AI-019 | **资源关联清理 / Schema** | ✅ | `resourceDeleteCleanup`；FK CASCADE；复合 PK；刷新 prune — 见 lifecycle 文档 |
| INF-001 | 清空资源库（工具页） | ✅ | `clearResourcesLibrary`；不删磁盘、不清收藏整表 |
| INF-002 | 猜你喜欢 `recommend` | 🟡 | 后端 IPC 就绪；**前端未接入** |

### 4.2 发现与搜索（P1）

| ID | 功能 | 状态 | 说明 |
|----|------|------|------|
| AI-101 | 自然语言搜索 | ✅ | `TextQueryParser.parseSearchQuery` |
| AI-102 | 语义搜索 | ✅ | `semanticSearch`；开关 `search.useSemanticSearch`（探索/H5 筛选） |
| AI-102a | 探索顶栏方案 A | ✅ | `ExploreSearchHeader.vue` + `ExploreCommon` |
| AI-103 | 相似壁纸 | ✅ | `HybridSimilarSearch`：画面路 + 文案 boost；内部 0.72 阈值 |
| AI-103a | 找相似文本回退 | ✅ | 无画面向量时纯文案路 + 内部 0.62 |
| AI-104 | 探索页 AI 元数据 | ✅ | score 标签 + **AI 已分析** ✨（`done`）；**无**单张「已向量化」角标 |
| AI-104b | 卡片展示向量状态 | ⬜ | 列表未下发 `hasTextVec`/`hasVisualVec`；统计仅在设置进度卡 |
| AI-104+ | 探索页展示 AI tags/summary | ⬜ | v1.0 扩展项，**非 2.0 验收** |
| AI-105 | score 排序/筛选 | ✅ | Explore + `scoreMinFilter` |
| AI-106 | 智能搜索词建议 | ⬜ | 热词仍主要为插件 tags |
| AI-107 | 远程搜索关键词改写 | ⬜ | |

### 4.3 智能合集（P1）

| ID | 功能 | 状态 | 说明 |
|----|------|------|------|
| AI-201 | 合集独立菜单 | ✅ | `Collections.vue` + `ResourceExploreCard` |
| AI-202 | 合集 CRUD | ✅ | 含 `source`；`list` 带 `itemCount` |
| AI-203 | 描述生成合集 | ✅ | 用户 NL → `queryJson` |
| AI-204 | 合集资源生成 | ✅ | 实体词：SQL/tags；氛围型：画面向量补充（`VisualCollectionSearch`） |
| AI-205 | 合集刷新 | ✅ | 手动；自定义定时 1h/6h/12h/24h；系统 `on_analysis` + 策展任务 |
| AI-206 | 合集转收藏 | ✅ | `addAllToFavorites` |
| AI-206a | 合集壁纸分页加载 | ✅ | `collectionsGet` + `VirtualList` close-bottom |
| AI-206b | 合集缩略图/主色 | ✅ | `resourceImageUrl.js`、`dominantColor` 与探索一致 |
| AI-207 | 合集作自动切换源 | ⬜ | |
| AI-208a | 氛围型合集（系统策展） | ✅ | 画面 K-Means + 按簇 LLM 命名 + locale + 剔图 + **同名/高重叠合并 dedupe** |
| AI-208c | 分析完成后暂停自动整理 | ✅ | `collectionCurateGate`；至少一轮后锁存；手动 `curate` 不限 |
| AI-208b | 用户 NL 合集画面语义扩召回 | 🟡 | 氛围描述靠画面；实体词走 SQL + **LLM 标签扩展**；`regenPrompt` 默认 false |

#### 系统自动策展（AI-205+ 扩展，已实现）

| 能力 | 说明 |
|------|------|
| 向量候选 | **画面** K-Means → `vec:{n}`（`fbw_resource_image_vec_blob`）；簇内离群剔除 minSim **0.77** |
| LLM 命名 | **每簇独立** `buildCollectionNamingPrompt`；禁止跨簇 merge；失败 → `resolveAtmosphereFallbackName` |
| 语言 | `titleMatchesAppLocale`；标题须与 UI locale 一致 |
| 语义剔图 | 命名后 `refinePlanMembersByTitle`（n-gram 重叠 ≥ **0.35**） |
| **重复合并** | `mergeCollectionPlans` + 库内 reconcile + `dedupeExistingAutoCollections`（Jaccard≥**0.85** 或同名） |
| 重叠 | 多合集可含同一张图（合并后同名同成员只保留一行） |
| 可删 | 系统合集 `source=auto` 允许删除 |
| 数量 | `computeAutoCollectionCount(已分析, ai)`，封顶 `ai.autoCollectionsMaxCount`（默认 20，3～50） |
| 入选 | `ai.scoreMinFilter`（默认 **70**，0～100）；**无**每合集固定条数顶 |
| 稳定暂停 | 分析队列稳定 + 至少一轮自动整理 → 停 30min/防抖；手动 `curate` 不限 |
| 遗留清理 | 旧 `tag:*` / `merged:*` 系统合集在手动整理时移除 |

**数据表：**

```sql
fbw_collections (
  id, name, prompt, queryJson, resourceScope,
  limitCount, sortField, sortType,
  isPinned, refreshMode, source,  -- source: user | auto
  lastGeneratedAt, created_at, updated_at
)
```

**系统合集 `queryJson` 示例：**

```json
{
  "autoKey": "vec:0",
  "mergeIds": ["vec:0"],
  "tags": ["夜景", "城市"],
  "semanticQuery": "赛博雨夜都市",
  "useSemantic": true,
  "scoreMin": 70
}
```

### 4.4 推荐与自动化（P2）

| ID | 功能 | 状态 | 说明 |
|----|------|------|------|
| AI-301 | 猜你喜欢 | 🟡 | `RecommendManager` 基础版 |
| AI-302 | 行为画像 | 🟡 | tags 统计推荐 |
| AI-303 | 智能自动切换 | 🟡 | smartSwitch 策略 |
| AI-304 | 自动下载扩词 | ✅ | `expandDownloadKeywords` |
| AI-305 | 下载后质检 | 🟡 | score/NSFW 部分 |
| AI-306 | 近重复检测 | ⬜ | |

### 4.5 安全与合规（P2）

| ID | 功能 | 状态 |
|----|------|------|
| AI-401 | NSFW 分析字段 | ✅ |
| AI-402 | 敏感内容隐藏（原探索安全筛选） | ✅ | `privacy.enableNsfwContentMask`；浏览遮罩；壁纸上/下一张过滤；**已移除** `enableNsfwCheck` / `hideUnsafe` — [privacy-and-sensitive-content.md](./privacy-and-sensitive-content.md) |
| AI-403 | 自动切换排除不安全 | 🟡 |
| AI-404 | 隐私空间规则 | ⬜ |

### 4.6 交互与助手（P3）

| ID | 功能 | 状态 |
|----|------|------|
| AI-501～504 | AI 助手面板等 | ⬜ |
| AI-511 | H5 文字 NL 搜索 | ✅ |
| AI-512 | H5 AI 元数据 | 🟡 |
| AI-513 | H5 浏览合集 | 🟡 |

### 4.7～4.9（P3/P4）

文生图插件、Utils 图像工具、视频律动 AI、插件密钥助手等 — **⬜ 仍为规划**

---

## 5. 菜单与 IPC

### 菜单

| name | 页面 | 状态 |
|------|------|------|
| `Collections` | `Collections.vue` | ✅ |

### IPC（已实现节选）

| 通道 | 状态 |
|------|------|
| `main:analyzeResource` | ✅ |
| `main:getAiAnalysisStats` | ✅ |
| `main:listAiModels` | ✅ |
| `main:findSimilar` / `main:semanticSearch` | ✅ |
| `main:collections:*` | ✅（`get` 分页：`startPage`/`pageSize`/`total`） |
| `main:collections:curate` | ✅ |
| `main:collections:curatorStats` | ✅ |
| `main:assistant:*` | ⬜ |

---

## 6. 实施分期（更新后）

### Phase 0 — 基建 ✅

AiAnalysisProvider、AI 设置、分析队列、EmbeddingManager、VecStore

### Phase 1 — 核心体验 ✅

探索 AI 元数据、NL/语义/相似搜索、**智能合集（含自动策展）**

### Phase 2 — 自动化与安全 🟡

Recommend、smartSwitch、扩词、NSFW；去重/H5 部分

### Phase 3 — 助手与 AIGC ⬜

AI 助手、AIGC 工具

### Phase 4 — 增强 ⬜

视频律动 AI、插件生态

---

## 7. 非功能需求

| 项 | 要求 | 现状 |
|----|------|------|
| 隐私 | 远程上传须明示 | 视觉区选用云端服务商时显示静态说明（`remoteVisionPrivacyNote`） |
| 性能 | 扫描不阻塞；VLM 并发 1；大图缩图 | ✅ |
| 容错 | AI 失败不阻断入库 | ✅；LLM 命名失败 → 规则降级；语义剔图过严时可能 0 合集 |
| 可观测 | pino 日志 | ✅ |
| i18n | 错误友好化 | ✅ `aiErrorUtils` |

---

## 8. 风险与待验证

| 风险 | mitigation |
|------|------------|
| OpenRouter 429 | 换模型/充值；分析未完成则无法策展 |
| sqlite-vec 绑定 | BLOB 降级已验证路径 |
| VLM 慢 | 后台每轮 5 张串行；缩图 + 动态超时缓解 |
| 缩图质量 | 极小字/边界 NSFW 可调高 `visionMaxLongEdge` |
| JSON 不稳定 | Prompt + 解析 + 降级 |
| vec0 UPSERT | 已改为 DELETE+INSERT |

---

## 9. 功能统计（实现进度）

| 优先级 | 规划数 | 已实现/部分 |
|--------|--------|-------------|
| P0 | 14 | 14 ✅（含 AI-008a/b/c） |
| P1 | 18+2 子项 | 18 ✅ / 1 🟡（AI-208b 部分）/ 1 ⬜（AI-104+）；AI-104b 向量角标 ⬜ |
| P2 | 10 | 4 ✅ / 4 🟡 / 2 ⬜ |
| P3+ | 15 | 少量 🟡 |

---

## 10. 相关文档

- [data-model-resources-and-ai.md](./data-model-resources-and-ai.md) — 主表 / AI 附表
- [ai-dev-plan.md](./ai-dev-plan.md) — 开发与验收
- [ai-collections-ux-and-curate.md](./ai-collections-ux-and-curate.md) — 策展规则、合集分页、评分/上限设置
- [ai-analysis-ux-and-performance.md](./ai-analysis-ux-and-performance.md) — 缩图、超时、语义搜索、设置 UX
- [ai-visual-embedding-and-similar.md](./ai-visual-embedding-and-similar.md) — 视觉向量、画面找相似、模型与角标说明
- [openclaw-agent-integration.md](./openclaw-agent-integration.md) — Agent 规划（未编码）
- [README.md](./README.md) — 本目录索引

---

## 11. 修订记录

| 版本 | 日期 | 说明 |
|------|------|------|
| v1.0 | 2026-05-26 | 初稿 48 项功能规划 |
| v1.1 | 2026-05-27 | 标注实现状态；补充自动策展、VecStore、IPC；更新分期进度 |
| **v1.2** | 2026-05-27 | AI-104 按 dev-plan 标 ✅；AI-208 拆为 208a/208b；AI-104+ 标为后续增强 |
| v1.3 | 2026-05-27 | AI-009～011、AI-102a；`search.useSemanticSearch`；超时/缩图默认值 |
| **v1.4** | 2026-05-28 | AI-206a/b；评分门槛取代条数顶；`autoCollectionsMaxCount`；合集分页；AiSetting 子项 |
| **v1.5** | 2026-05-28 | AI-012 失败重试上限；AI-208c 稳定后暂停自动整理；`scoreMinFilter` 默认 70 |
| **v1.6** | 2026-05-28 | AI-008a/b、AI-103/103a；MobileCLIP2-S0；找相似用户阈值（已废弃） |
| **v1.7** | 2026-05-29 | 方案 C、AI-008c、远程画面向量、`EmbedRequestBuilder`；移除 `findSimilarMode` 等用户设置 |
| **v1.8** | 2026-05-29 | 合集画面向量：策展 K-Means、AI-208b 部分、`VisualCollectionSearch`、关键词优先 |
| **v1.9** | 2026-05-29 | `regenPrompt` 默认 false；`expandCollectionKeywordTags`；实体词禁用画面补充 |
| **v2.0** | 2026-05-27 | AI-013～016：附表拆分、清空 AI、失败重试、进度卡常显；AI-001/012 字段路径更新 |
| **v2.1** | 2026-06-01 | 系统策展 v1.5：按簇命名、locale 对齐、语义剔图；更新 AI-208a 与 queryJson 示例 |
| **v2.2** | 2026-06-01 | AI-208a 增补 v1.6：同名/高重叠合并 dedupe；progressive 不再累积重复系统合集 |
| **v2.3** | 2026-05-27 | AI-017 省电恢复后台 AI；AI-007/008b 说明看门狗与恢复路径；链至 ai-analysis §4.2 |
| **v2.4** | **2026-06-03** | AI-018 视频封面 AI；AI-019/INF-001 关联清理与清空资源库；INF-002 recommend 后端就绪 |
