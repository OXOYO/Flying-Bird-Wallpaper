# docs/temp 文档索引

> 整理日期：2026-06-05（猜你喜欢 / 画面向量迁移 / i18n 对齐）  
> 说明：本目录为**开发过程临时文档**，与正式用户文档（`docs/` 根目录）区分；内容随实现迭代更新。  
> **占位符约定**：i18n 使用单花括号 `{count}`（见 `src/i18n/i18next.js`），勿写 `{{count}}`。

---

## AI 2.0（主应用）

| 文档 | 用途 | 状态 |
|------|------|------|
| [ai-dev-plan.md](./ai-dev-plan.md) | **开发方案 + 实施清单 + 验收**（Sprint 0–4 及后续增量 §8–§20） | **v3.4** |
| [data-model-resources-and-ai.md](./data-model-resources-and-ai.md) | **主表 / AI 附表拆分**、`qualityScore`、JOIN 投影、迁移与清空 AI 语义 | **v1.4** |
| [resource-lifecycle-and-cleanup.md](./resource-lifecycle-and-cleanup.md) | **删资源 / 清空资源库 / 刷新 prune / FK 与向量表迁移**、统一 cleanup 模块 | **v1.1** |
| [ai-feature-roadmap.md](./ai-feature-roadmap.md) | **完整功能清单**（48+ 项 AI 能力，含优先级与实现状态） | v2.5 |
| [ai-analysis-ux-and-performance.md](./ai-analysis-ux-and-performance.md) | **分析缩图、动态超时、失败重试、进度卡常显、清空/重试 AI、视频封面分析、省电恢复、测试连接、语义搜索迁移、探索顶栏、设置 UX、i18n 维护** | **v2.1** |
| [ai-visual-embedding-and-similar.md](./ai-visual-embedding-and-similar.md) | **找相似方案 C、画面向量、多 model 存储、EmbedRequestBuilder、合集画面向量、设置项** | **v2.4** |
| [ai-collections-ux-and-curate.md](./ai-collections-ux-and-curate.md) | **系统策展、用户合集、猜你喜欢、Picker 分页** | **v1.8** |
| [openclaw-agent-integration.md](./openclaw-agent-integration.md) | 外部 Agent / OpenClaw / MCP 集成规划 | **未编码**（Sprint 5 跳过） |

**阅读顺序建议：**

1. 想了解「做了什么、怎么验收」→ `ai-dev-plan.md`
2. 想查 **库表 / AI 字段在哪张表** → `data-model-resources-and-ai.md`
3. 想查 **删资源、清空库、刷新目录、FK 清理** → `resource-lifecycle-and-cleanup.md`
4. 想查「某功能 ID 是否规划/已实现」→ `ai-feature-roadmap.md`
5. 想查 **大图分析慢/超时、缩图、失败重试、清空 AI、进度卡** → `ai-analysis-ux-and-performance.md`
6. 想查 **画面找相似、远程画面向量、RRF、NVIDIA embed** → `ai-visual-embedding-and-similar.md`
7. 想查 **系统合集流水线、猜你喜欢、剔图、重复合并** → `ai-collections-ux-and-curate.md`
8. 想接 OpenClaw / Telegram 控制壁纸 → `openclaw-agent-integration.md`

---

## 主窗口、隐私与基础设施

| 文档 | 用途 | 状态 |
|------|------|------|
| [main-window-ux-and-infrastructure.md](./main-window-ux-and-infrastructure.md) | **侧栏、快捷键、省电与后台 AI、下载清理（自动/手动）、检查更新、工具页** | 2026-06-03 |
| [privacy-and-sensitive-content.md](./privacy-and-sensitive-content.md) | **敏感内容隐藏、壁纸过滤、密码规则；`nsfwLevel` 在 AI 附表** | v1.1 |

**阅读顺序建议：**

- 侧栏 / 快捷键 / 更新 / **下载清理** → `main-window-ux-and-infrastructure.md`
- 敏感遮罩 / 壁纸跳过敏感图 → `privacy-and-sensitive-content.md`

---

## 其他专题（与 AI 2.0 无直接依赖）

| 文档 | 用途 |
|------|------|
| [api-integration-suggestions.md](./api-integration-suggestions.md) | 壁纸资源 API 插件扩展建议 |
| [rhythm-audio-processing-analysis.md](./rhythm-audio-processing-analysis.md) | 律动壁纸音频/节拍算法分析（正式 doc：`docs/rhythm_wallpaper.md`） |

---

## 代码锚点（常用）

### AI 2.0 核心

| 模块 | 路径 |
|------|------|
| AI 分析 | `src/main/ai/AiAnalysisManager.mjs` |
| 省电 / AI 任务恢复 | `src/main/store/index.mjs` → `resumeBackgroundAiTasksIfAllowed`、`restartPowerSaveDependentTasks` |
| AI 附表 / JOIN | `src/main/store/resourceAiSql.mjs`、`schemaUpgrade.mjs` |
| 自动策展 | `src/main/store/CollectionCurator.mjs` |
| 策展合并 dedupe | `mergeDuplicatePlans`、`reconcilePlansWithExistingAutoCollections`、`dedupeExistingAutoCollections` |
| 策展常量 | `src/main/store/collectionConstants.mjs`（`mergeCollectionPlans`、`shouldMergeCollectionPlans`） |
| 策展命名/解析 | `src/main/ai/AiPrompts.mjs`、`AiResponseParser.mjs` |
| 关联清理 | `src/main/store/resourceDeleteCleanup.mjs` |
| 清空资源库 | `DatabaseManager.clearResourcesLibrary`、`Utils.vue` |
| 视觉路径（含视频封面） | `src/main/ai/AiVisionResourcePath.mjs` |
| 文本/画面向量 | `EmbeddingManager.mjs`、`VecStore.mjs`、`HybridSimilarSearch.mjs` |
| 轻量推荐 | `RecommendManager.mjs`；IPC `main:recommend`、`main:recommend:addAllToFavorites` |
| 合集 Picker / 猜你喜欢 | `collectionPickerFilter.mjs`（`FOR_YOU_VIRTUAL_ID`）；`Collections.vue`、H5 `collections/index.vue` |
| 合集画面检索 | `VisualCollectionSearch.mjs` |
| 稳定暂停门控 | `collectionCurateGate.mjs` |
| AI 设置 | `src/renderer/.../AiSetting.vue` |
| 合集页 | `src/renderer/.../pages/Collections.vue` |

### 主窗口基础设施

| 模块 | 路径 |
|------|------|
| 快捷键 suspend/resume | `ShortcutManager.mjs`、`ShortcutSetting.vue` |
| 更新 | `updater.mjs`、`index.mjs` |
| 侧栏 | `MainWindow.vue`、`SideMenu.vue` |
| 下载清理 | `WallpaperManager.mjs` → `clearDownloadedAll`、`clearDownloadedExpired`；`index.mjs` → `startClearDownloadedTask` |

### 隐私与敏感内容

| 模块 | 路径 |
|------|------|
| 策略 / 遮罩 / 壁纸过滤 | `privacyNsfwMask.js`、`usePrivacyNsfwMask.mjs`、`WallpaperManager.mjs` |

### i18n 维护

| 脚本 | 用途 |
|------|------|
| `scripts/sync-i18n.mjs` | 以 `zh-CN` / `en-US` 为基准补缺失键；`zh-TW` 自动简转繁 |
| `scripts/check-i18n.mjs` | 键数量 parity、与 `en-US` 相同的长文案、空值检查 |

语言包：`src/i18n/locale/lang/`（12 语言 × 1081 键）。新增文案流程见 [ai-analysis-ux-and-performance.md](./ai-analysis-ux-and-performance.md) §15。

---

## 近期变更速查（2026-06-05）

| 主题 | 文档 | 要点 |
|------|------|------|
| **猜你喜欢** | `ai-collections-ux-and-curate.md` §3.5、`ai-dev-plan.md` §20 | Picker 第 4 Tab 虚拟项；`recommend` 分页；桌面 + H5；与 `source=auto` 系统合集命名分离 |
| **画面向量 PK 迁移** | `resource-lifecycle-and-cleanup.md` §4、`data-model` v1.4 | `migrateImageVecBlobCompositePk` 过滤孤儿 `resourceId`；失败清理 `_new` 表 |
| **版本迁移脚本** | `ai-dev-plan.md` Sprint 0 | 仅保留 `resources/migrations/1.3.8_to_2.0.0.mjs` |
| **i18n 对齐** | `ai-analysis-ux-and-performance.md` §15 | 12 语言 1081 键；英文 UI / `ai.prompts.*` 本地化；一次性补丁脚本已删除，保留 `sync-i18n` + `check-i18n` |

## 近期变更速查（2026-06-03）

| 主题 | 文档 | 要点 |
|------|------|------|
| **关联清理 / Schema** | `resource-lifecycle-and-cleanup.md` | FK CASCADE、画面向量 `(resourceId,model)`、统一 cleanup、刷新 UPSERT+prune |
| **视频 AI** | `ai-analysis-ux-and-performance.md` §4、`data-model` v1.3 | 封面帧分析；清空 AI 含视频；策展/找相似含有封面视频 |
| **清空资源库** | `main-window` §5.4、`resource-lifecycle` §6 | 工具页 `clearResourcesLibrary`；与 `clearDB` 全量对齐 |
| **系统合集 v1.7** | `ai-collections-ux-and-curate.md` | 含封面视频入集；`itemCount` JOIN；隐私排除；`useSemantic` 尊重用户 |
| 下载清理 | `main-window-ux-and-infrastructure.md` §5.2、§8 | 自动保留收藏/隐私；工具页手动可删 |
| 视频封面 | `data-model-resources-and-ai.md` | 下载视频时本地化 poster → `posterPath`；`imageUrl` 保留远程 |
| 自动下载/收藏 | `main-window-ux-and-infrastructure.md` §9 | 多选 images/videos；远程收藏隐式入库 |
| 省电恢复 AI | `ai-analysis-ux-and-performance.md` §4.2 · `ai-dev-plan.md` §18 | 关省电/插 AC 自动恢复 pump；修复长期「等待中」 |
| 系统合集 v1.6 | `ai-collections-ux-and-curate.md` §2.4.2 | 同名或 Jaccard≥0.85 合并；progressive 不再叠 duplicate |
| 系统合集 v1.5 | 同上 §2.1、§2.4.1 | 按簇命名、locale、语义剔图 |
| 快捷键 | `main-window-ux-and-infrastructure.md` §3.5 | 录键 suspend/resume；切 tab 不再全量重注册 |
| 开发清单 | `ai-dev-plan.md` §16–§19 | 增量⁹–¹² |

---

## 修订记录

| 日期 | 说明 |
|------|------|
| **2026-06-05** | **猜你喜欢**：合集页/H5 接入 `RecommendManager`；**Schema**：画面向量复合 PK 迁移过滤孤儿行；迁移脚本仅保留 `1.3.8_to_2.0.0.mjs`；**i18n**：12 语言键对齐与英文残留清理，维护脚本收敛 |
| **2026-06-03** | **资源生命周期**：新增 `resource-lifecycle-and-cleanup.md`；FK/复合 PK、cleanup 统一、视频 AI、清空资源库；各专题文档 v1.3/v2.0/v2.3 同步 |
| **2026-06-03** | **下载清理**：自动 `excludeProtected` 保留收藏/隐私；工具页手动可删；`main-window` §5.2、§8 |
| **2026-05-27** | **省电恢复 AI**：`ai-analysis` v1.9 §4.2、`ai-dev-plan` v3.2 §18、`ai-feature-roadmap` v2.3 AI-017 |
| **2026-06-01** | **v1.6**：系统合集同名/高重叠合并；`ai-collections` v1.6、`ai-dev-plan` v3.1 §17、`ai-feature-roadmap` v2.2；索引与锚点整理 |
| **2026-06-01** | v1.5 按簇命名、locale、剔图；快捷键 suspend/resume；`ai-dev-plan` v3.0 |
| **2026-05-31** | 新增 `main-window-ux-and-infrastructure.md` |
| **2026-05-27** | `fbw_resource_ai` 拆分、`data-model-resources-and-ai.md`；工具页清空 AI |
| **2026-05-29** | 合集画面向量、`regenPrompt`、LLM 标签扩展 |
| 2026-05-28 | 评分门槛、策展稳定暂停、合集分页 |
| 2026-05-26 | 初版 Sprint 0–4 方案与 roadmap |
