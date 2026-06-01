# docs/temp 文档索引

> 整理日期：2026-06-01（v1.6 合并去重同步）  
> 说明：本目录为**开发过程临时文档**，与正式用户文档（`docs/` 根目录）区分；内容随实现迭代更新。  
> **占位符约定**：i18n 使用单花括号 `{count}`（见 `src/i18n/i18next.js`），勿写 `{{count}}`。

---

## AI 2.0（主应用）

| 文档 | 用途 | 状态 |
|------|------|------|
| [ai-dev-plan.md](./ai-dev-plan.md) | **开发方案 + 实施清单 + 验收**（Sprint 0–4 及后续增量 §8–§17） | v3.1 |
| [data-model-resources-and-ai.md](./data-model-resources-and-ai.md) | **主表 / AI 附表拆分**、`qualityScore`、JOIN 投影、迁移与清空 AI 语义 | v1.0 |
| [ai-feature-roadmap.md](./ai-feature-roadmap.md) | **完整功能清单**（48+ 项 AI 能力，含优先级与实现状态） | v2.2 |
| [ai-analysis-ux-and-performance.md](./ai-analysis-ux-and-performance.md) | **分析缩图、动态超时、失败重试、进度卡常显、清空/重试 AI、测试连接、语义搜索迁移、探索顶栏、设置 UX** | v1.8 |
| [ai-visual-embedding-and-similar.md](./ai-visual-embedding-and-similar.md) | **找相似方案 C、画面向量、EmbedRequestBuilder、合集画面向量、设置项** | 2026-05-29 v2.2 |
| [ai-collections-ux-and-curate.md](./ai-collections-ux-and-curate.md) | **系统策展（按簇命名、locale、剔图、同名/高重叠合并）、用户合集、分页** | **v1.6** |
| [openclaw-agent-integration.md](./openclaw-agent-integration.md) | 外部 Agent / OpenClaw / MCP 集成规划 | **未编码**（Sprint 5 跳过） |

**阅读顺序建议：**

1. 想了解「做了什么、怎么验收」→ `ai-dev-plan.md`
2. 想查 **库表 / AI 字段在哪张表** → `data-model-resources-and-ai.md`
3. 想查「某功能 ID 是否规划/已实现」→ `ai-feature-roadmap.md`
4. 想查 **大图分析慢/超时、缩图、失败重试、清空 AI、进度卡** → `ai-analysis-ux-and-performance.md`
5. 想查 **画面找相似、远程画面向量、RRF、NVIDIA embed** → `ai-visual-embedding-and-similar.md`
6. 想查 **系统合集流水线、剔图、重复合并、progressive vs manual** → `ai-collections-ux-and-curate.md`
7. 想接 OpenClaw / Telegram 控制壁纸 → `openclaw-agent-integration.md`

---

## 主窗口、隐私与基础设施

| 文档 | 用途 | 状态 |
|------|------|------|
| [main-window-ux-and-infrastructure.md](./main-window-ux-and-infrastructure.md) | **侧栏、快捷键 suspend/resume、检查更新、工具页清空 AI** | 2026-06-01 |
| [privacy-and-sensitive-content.md](./privacy-and-sensitive-content.md) | **敏感内容隐藏、壁纸过滤、密码规则；`nsfwLevel` 在 AI 附表** | v1.1 |

**阅读顺序建议：**

- 侧栏 / 快捷键 / 更新 → `main-window-ux-and-infrastructure.md`
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
| AI 附表 / JOIN | `src/main/store/resourceAiSql.mjs`、`schemaUpgrade.mjs` |
| 自动策展 | `src/main/store/CollectionCurator.mjs` |
| 策展合并 dedupe | `mergeDuplicatePlans`、`reconcilePlansWithExistingAutoCollections`、`dedupeExistingAutoCollections` |
| 策展常量 | `src/main/store/collectionConstants.mjs`（`mergeCollectionPlans`、`shouldMergeCollectionPlans`） |
| 策展命名/解析 | `src/main/ai/AiPrompts.mjs`、`AiResponseParser.mjs` |
| 文本/画面向量 | `EmbeddingManager.mjs`、`VecStore.mjs`、`HybridSimilarSearch.mjs` |
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

### 隐私与敏感内容

| 模块 | 路径 |
|------|------|
| 策略 / 遮罩 / 壁纸过滤 | `privacyNsfwMask.js`、`usePrivacyNsfwMask.mjs`、`WallpaperManager.mjs` |

---

## 近期变更速查（2026-06-01）

| 主题 | 文档 | 要点 |
|------|------|------|
| 系统合集 v1.6 | `ai-collections-ux-and-curate.md` §2.4.2 | 同名或 Jaccard≥0.85 合并；progressive 不再叠 duplicate |
| 系统合集 v1.5 | 同上 §2.1、§2.4.1 | 按簇命名、locale、语义剔图 |
| 快捷键 | `main-window-ux-and-infrastructure.md` §3.5 | 录键 suspend/resume；切 tab 不再全量重注册 |
| 开发清单 | `ai-dev-plan.md` §16–§17 | 增量⁹、增量¹⁰ |

---

## 修订记录

| 日期 | 说明 |
|------|------|
| **2026-06-01** | **v1.6**：系统合集同名/高重叠合并；`ai-collections` v1.6、`ai-dev-plan` v3.1 §17、`ai-feature-roadmap` v2.2；索引与锚点整理 |
| **2026-06-01** | v1.5 按簇命名、locale、剔图；快捷键 suspend/resume；`ai-dev-plan` v3.0 |
| **2026-05-31** | 新增 `main-window-ux-and-infrastructure.md` |
| **2026-05-27** | `fbw_resource_ai` 拆分、`data-model-resources-and-ai.md`；工具页清空 AI |
| **2026-05-29** | 合集画面向量、`regenPrompt`、LLM 标签扩展 |
| 2026-05-28 | 评分门槛、策展稳定暂停、合集分页 |
| 2026-05-26 | 初版 Sprint 0–4 方案与 roadmap |
