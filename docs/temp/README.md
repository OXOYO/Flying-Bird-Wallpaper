# docs/temp 文档索引

> 整理日期：2026-05-27  
> 说明：本目录为**开发过程临时文档**，与正式用户文档（`docs/` 根目录）区分；内容随实现迭代更新。

---

## AI 2.0（主应用）

| 文档 | 用途 | 状态 |
|------|------|------|
| [ai-dev-plan.md](./ai-dev-plan.md) | **开发方案 + 实施清单 + 验收**（Sprint 0–4 及后续增量） | 持续更新 |
| [ai-feature-roadmap.md](./ai-feature-roadmap.md) | **完整功能清单**（48 项 AI 能力，含优先级与实现状态） | 持续更新 |
| [openclaw-agent-integration.md](./openclaw-agent-integration.md) | 外部 Agent / OpenClaw / MCP 集成规划 | **未编码**（Sprint 5 跳过） |

**阅读顺序建议：**

1. 想了解「做了什么、怎么验收」→ `ai-dev-plan.md`
2. 想查「某功能 ID 是否规划/已实现」→ `ai-feature-roadmap.md`
3. 想接 OpenClaw / Telegram 控制壁纸 → `openclaw-agent-integration.md`

---

## 其他专题（与 AI 2.0 无直接依赖）

| 文档 | 用途 |
|------|------|
| [api-integration-suggestions.md](./api-integration-suggestions.md) | 壁纸资源 API 插件扩展建议 |
| [rhythm-audio-processing-analysis.md](./rhythm-audio-processing-analysis.md) | 律动壁纸音频/节拍算法分析（正式 doc：`docs/rhythm_wallpaper.md`） |

---

## 代码锚点（AI 2.0 核心）

| 模块 | 路径 |
|------|------|
| AI 分析 | `src/main/ai/AiAnalysisManager.mjs` |
| Provider / 模型 | `src/main/ai/AiAnalysisProvider.mjs`、`providers/HttpAiProviders.mjs` |
| 向量 | `src/main/ai/EmbeddingManager.mjs`、`VecStore.mjs`、`VectorCluster.mjs` |
| 自定义合集 | `src/main/store/CollectionsManager.mjs` |
| **自动策展** | `src/main/store/CollectionCurator.mjs`、`collectionConstants.mjs` |
| 探索 / 搜索 UI | `src/renderer/.../ExploreCommon.vue` |
| 合集 UI | `src/renderer/.../Collections.vue` |
| AI 设置 | `src/renderer/.../AiSetting.vue` |
| DB 迁移 | `resources/migrations/1.3.8_to_2.0.0.mjs`、`schemaUpgrade.mjs` |

---

## 修订记录

| 日期 | 说明 |
|------|------|
| 2026-05-27 | 新增索引；同步自动策展、向量聚类、LLM 合并等实现 |
| 2026-05-26 | 初版 Sprint 0–4 方案与 roadmap |
