# docs/temp 文档索引

> 整理日期：2026-05-28  
> 说明：本目录为**开发过程临时文档**，与正式用户文档（`docs/` 根目录）区分；内容随实现迭代更新。

---

## AI 2.0（主应用）

| 文档 | 用途 | 状态 |
|------|------|------|
| [ai-dev-plan.md](./ai-dev-plan.md) | **开发方案 + 实施清单 + 验收**（Sprint 0–4 及后续增量） | 持续更新 |
| [ai-feature-roadmap.md](./ai-feature-roadmap.md) | **完整功能清单**（48 项 AI 能力，含优先级与实现状态） | 持续更新 |
| [ai-analysis-ux-and-performance.md](./ai-analysis-ux-and-performance.md) | **分析缩图、动态超时、失败重试上限、语义搜索迁移、探索顶栏、设置 UX** | 2026-05-28 |
| [ai-visual-embedding-and-similar.md](./ai-visual-embedding-and-similar.md) | **视觉向量 MobileCLIP2-S0、画面找相似、双表存储、设置项、卡片角标说明** | 2026-05-28 |
| [ai-collections-ux-and-curate.md](./ai-collections-ux-and-curate.md) | **系统策展规则、评分门槛、稳定后暂停自动整理、合集分页、缩略图/主色** | 2026-05-28 |
| [openclaw-agent-integration.md](./openclaw-agent-integration.md) | 外部 Agent / OpenClaw / MCP 集成规划 | **未编码**（Sprint 5 跳过） |

**阅读顺序建议：**

1. 想了解「做了什么、怎么验收」→ `ai-dev-plan.md`
2. 想查「某功能 ID 是否规划/已实现」→ `ai-feature-roadmap.md`
3. 想查 **大图分析慢/超时、缩图、失败重试、语义搜索开关** → `ai-analysis-ux-and-performance.md`
4. 想查 **画面找相似、视觉向量模型、已向量化统计、卡片 tag** → `ai-visual-embedding-and-similar.md`
5. 想查 **系统合集数量/评分门槛、稳定后暂停整理、合集页分页** → `ai-collections-ux-and-curate.md`
6. 想接 OpenClaw / Telegram 控制壁纸 → `openclaw-agent-integration.md`

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
| 分析前缩图 | `src/main/ai/AiVisionImagePrep.mjs` |
| 超时/常量 | `src/main/ai/aiConstants.mjs`（含 `resolveEffectiveVisionTimeout`） |
| Provider / 模型 | `src/main/ai/AiAnalysisProvider.mjs`、`providers/HttpAiProviders.mjs` |
| 探索顶栏 | `src/renderer/.../ExploreSearchHeader.vue` |
| 文本向量 | `src/main/ai/EmbeddingManager.mjs`、`VecStore.mjs` |
| **视觉向量** | `src/main/ai/ImageVisualEmbedder.mjs`、`fbw_resource_image_vec_blob` |
| 聚类 | `src/main/ai/VectorCluster.mjs` |
| 视觉模型文件 | `resources/models/mobileclip2_s0_vision.onnx` |
| 自定义合集 / 分页 get | `src/main/store/CollectionsManager.mjs` |
| **自动策展** | `src/main/store/CollectionCurator.mjs`、`collectionConstants.mjs` |
| **策展门控（稳定暂停）** | `src/main/store/collectionCurateGate.mjs`、`store/index.mjs` |
| 列表缩略 URL | `src/renderer/utils/resourceImageUrl.js` |
| 探索 / 搜索 UI | `src/renderer/.../ExploreCommon.vue` |
| 合集 UI | `src/renderer/.../Collections.vue`、`ResourceExploreCard.vue` |
| AI 设置 | `src/renderer/.../AiSetting.vue` |
| DB 迁移 | `resources/migrations/1.3.8_to_2.0.0.mjs`、`schemaUpgrade.mjs` |

---

## 修订记录

| 日期 | 说明 |
|------|------|
| 2026-05-28 | 新增 `ai-visual-embedding-and-similar.md`；索引补充视觉向量代码锚点 |
| 2026-05-28 | 文档同步：失败重试上限、评分默认 70、分析完成后暂停自动整理（AI-012 / AI-208c） |
| 2026-05-28 | 新增 `ai-collections-ux-and-curate.md`；策展评分门槛、合集分页、AI 设置子项 |
| 2026-05-27 | 新增 `ai-analysis-ux-and-performance.md`；索引补充缩图/顶栏/动态超时 |
| 2026-05-27 | 同步自动策展、向量聚类、LLM 合并等实现 |
| 2026-05-26 | 初版 Sprint 0–4 方案与 roadmap |
