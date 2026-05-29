# AI 分析性能与设置体验（2.0.0+ 增量）

> 文档版本：**v1.3**  
> 整理日期：2026-05-28  
> 状态：**已实现**  
> 关联：[ai-dev-plan.md](./ai-dev-plan.md) · [ai-visual-embedding-and-similar.md](./ai-visual-embedding-and-similar.md) · [ai-feature-roadmap.md](./ai-feature-roadmap.md) · [README.md](./README.md)

---

## 1. 背景

本地视觉模型（如 `qwen2.5vl:3b`）对**大图原图**分析耗时长（实测单张 `vision-http modelMs` 可达 3 分钟级），易触发 HTTP 超时；探索/设置页长说明挤占表单空间。本增量在**不取消超时**的前提下，通过**分析前缩图**、**动态超时**与**设置 UX** 提升稳定性与可读性。

---

## 2. 分析前缩图

### 2.1 模块

| 项 | 说明 |
|----|------|
| 实现 | `src/main/ai/AiVisionImagePrep.mjs` |
| 接入 | `AiAnalysisProvider.analyzeImage` → `HttpAiProviders` 支持 `buffer` / `filePath` |
| 范围 | **仅视觉 analyze**；文本 embed、**视觉 ONNX embed**、测连接、文本 chat 不缩图 |

### 2.2 触发条件

同时满足才跳过缩图（用原图）：

1. `ai.visionPreprocess !== false`（默认开启）
2. 扩展名为可处理图片（jpg/png/webp/bmp/gif）
3. 文件体积 ≤ `visionPreprocessMinSizeMB`（默认 **1.5MB**）
4. 长边 ≤ `visionMaxLongEdge`（默认 **2048px**）

否则：`sharp` 等比缩放 + 输出 **JPEG**（内存 buffer，不写用户目录）。

### 2.3 默认与边界

| 配置 | 默认 | 范围 |
|------|------|------|
| `visionMaxLongEdge` | 2048 | 1024～4096 |
| `visionPreprocessMinSizeMB` | 1.5 | 0～20 |
| `visionJpegQuality` | 88 | 75～95 |

- `sharp` 失败 → 回退原图，日志 `[AiVisionPrep] resize failed`
- 动图 GIF → 取首帧参与缩放

### 2.4 日志

```
[AiVisionPrep] skipped|resized file=... ...
[AiAnalysisProvider] vision pipeline ... preprocess=resized orig=4000x3000/8.2MB out=2048x1536/0.9MB ...
[HttpAi/vision] vision-read done ... b64Size=...
[HttpAi/vision-http] vision-http done modelMs=...
```

---

## 3. 请求超时与动态加成

### 3.1 基础超时

| 项 | 值 |
|----|-----|
| 默认 | **300s**（`300000` ms） |
| 设置范围 | **60～1800s** |
| 迁移 | 仍为旧默认 `120000` 的配置在 `migrateSettingData` 升为 `300000` |

测试连接、embed 等仍使用**基础** `ai.timeout`（取 `min(timeout, 10s/15s)` 的子路径不变）。

### 3.2 视觉分析动态超时

实现：`resolveEffectiveVisionTimeout`（`src/main/ai/aiConstants.mjs`）

```
有效超时(ms) = min( 基础超时 + min(文件MB × 30_000, 600_000), 1800_000 )
```

| 示例 | 基础 | 文件 | 有效超时 |
|------|------|------|----------|
| 小图 | 300s | 0.15MB | 300s |
| 8MB 图 | 300s | 8MB | 300 + 240 = **540s** |
| 极大 | 300s | 30MB | min(300+600, 1800) = **900s** |

`AiAnalysisManager` 日志：`timeout=540s (base=300s)`。

**不建议**取消超时：批量队列串行、Ollama 假死时无法自愈。

---

## 4. 分析范围与队列

| 项 | 说明 |
|----|------|
| 文件类型 | **仅 `fileType=image`**；视频等标 `skipped` |
| 分析模式 | `off` / `on_demand` / `background_slow` / `new_only`（设置页 ⓘ 说明） |
| 后台批次 | 每轮最多 5 张，串行；队列含 `pending` + `failed` |
| 失败重试上限 | **`ai.analysisMaxRetries`**（默认 **5**，1～20）；后台连续失败达上限 → `skipped`，不再自动重试 |
| 手动分析 | 探索页「AI 分析」**不受**重试上限（仍可一直试；成功则 `aiAnalysisFailCount` 归零） |
| 失败计数 | DB 列 `aiAnalysisFailCount`；`markPendingForResources` 时归零 |
| 状态「等待中」 | `pending>0` 且当前未 `running`；侧边栏 Tooltip 多行展示原因 |

### 4.1 后台失败重试（v1.2+）

实现：`AiAnalysisManager.handleAnalysisFailure` + `resolveAnalysisMaxRetries`（`aiConstants.mjs`）。

| 场景 | 行为 |
|------|------|
| 后台 `background_slow` / `new_only` | 失败递增计数；达 `analysisMaxRetries` → `aiAnalysisStatus=skipped`，日志 `reason=max_retries` |
| 浏览页手动 `analyzeResourceById` | `respectRetryLimit=false`，不因上限自动 skipped |
| 设置位置 | AI 设置 → **分析模式**下方（仅后台模式显示） |
| 非法/空配置 | 迁移与 `ensureAiFields` 回退默认 **5** |

与合集联动：队列稳定（无 pending/failed）且完成至少一轮自动整理后，系统策展暂停定时任务 — 见 [ai-collections-ux-and-curate.md](./ai-collections-ux-and-curate.md) §2.5。

---

## 5. 智能语义搜索配置迁移

| 旧 | 新 |
|----|-----|
| `settingData.ai.smartSearch` | **`settingData.search.useSemanticSearch`** |

- **启用位置**：探索页顶栏筛选（仅资源库搜索）、H5 搜索筛选；**已从 AI 设置页移除**
- **仍走语义**：桌面搜索页（非收藏/回忆/隐私）、H5 `/api/search/images`；无结果回退关键词 SQL
- **不走语义**：收藏/回忆/隐私、找相似、合集生成（`useSemantic` 已解析未接入 `semanticSearch`）
- **找相似**：默认 **视觉向量**（非语义搜索）；见 [ai-visual-embedding-and-similar.md](./ai-visual-embedding-and-similar.md)

---

## 6. 探索页顶栏（方案 A）

| 组件 | 路径 |
|------|------|
| 统一顶栏 | `ExploreSearchHeader.vue` |
| 集成 | `ExploreCommon.vue` |

- 资源库 / 关键词 / 筛选 Popover / 扩展按钮
- 筛选面板含资源、关键词；收藏/回忆无「资源」项
- 布局：`width: calc(100% - 20px)` + Grid，避免右侧按钮被 `overflow-x` 裁切

---

## 7. AI 设置页 UX

| 项 | 说明 |
|----|------|
| 长说明 | 标签旁 **ⓘ + Tooltip**（`popper-class=ai-setting-feature-tip`，max-width 换行） |
| 分析模式 / 超时 / 视觉输入 / 功能开关 | 均用 Tooltip，无大块 `field-hint` |
| 标签列宽 | `label-width="auto"`（按最宽标签对齐），**不固定宽度**，避免长标签换行 |
| 进度卡 Tooltip | `AiAnalysisDashboardPanel.vue` 同步换行样式 |
| 进度卡统计 | `已向量化`（文本）+ **`已向量化(视觉)`**（`imageEmbedding`） |
| 找相似设置 | `findSimilarMode`、`visualEmbedEnabled`、`similarMinCosineVisual` / `similarMinCosine` — 见 [ai-visual-embedding-and-similar.md](./ai-visual-embedding-and-similar.md) |
| 合集相关子项 | `scoreMinFilter`、`autoCollectionsMaxCount` 在「AI 自动整理合集」下；`analysisMaxRetries` 在分析模式旁 — 见 [ai-collections-ux-and-curate.md](./ai-collections-ux-and-curate.md) |

---

## 8. 设置字段速查（新增/变更）

### `settingData.ai`

| 字段 | 默认 | 说明 |
|------|------|------|
| `timeout` | 300000 | 基础 HTTP 超时（ms） |
| `visionPreprocess` | true | 分析前缩图 |
| `visionMaxLongEdge` | 2048 | 最长边 px |
| `visionPreprocessMinSizeMB` | 1.5 | 低于此体积且长边已够则不缩 |
| `visionJpegQuality` | 88 | 缩图 JPEG 质量 |
| `scoreMinFilter` | 70 | 最低评分（0～100）；搜索 + 系统合集；无「不限制」 |
| `autoCollectionsMaxCount` | 20 | 系统推荐合集数量上限（3～50） |
| `analysisMaxRetries` | 5 | 后台单张最大连续失败次数（1～20） |
| `autoCurateSettled` | false | 内部：分析稳定且已跑完至少一轮自动整理 |
| `autoCurateSettledAnalyzed` | 0 | 锁存时的已分析张数 |
| `findSimilarMode` | `visual` | 找相似：画面 / 文案 |
| `visualEmbedEnabled` | true | 内置 MobileCLIP2-S0 视觉向量 |
| `similarMinCosineVisual` | 0.72 | 视觉找相似阈值 |
| `similarMinCosine` | 0.62 | 文本找相似 / 回退 |

### `settingData.search`

| 字段 | 默认 | 说明 |
|------|------|------|
| `useSemanticSearch` | false | 智能语义搜索 |

---

## 9. 调参建议

| 场景 | 建议 |
|------|------|
| 本地 Ollama + VL 3b/7b | 超时 ≥300s，开启缩图，长边 2048 |
| 4K / 10MB 图库 | 超时 600～900s；确认日志 `preprocess=resized` |
| 在意小字/NSFW 边界 | 长边 2560～3072 或略提高 JPEG 质量 |
| 云端 OpenAI 兼容 | 长边 1536～2048；超时 120～300s |

---

## 10. 验收要点

1. 设置 → AI：视觉输入四项、超时默认 300s；ⓘ 悬停可读多行说明  
2. 大图分析：日志 `preprocess=resized`，`b64Size` 明显小于原图  
3. 小图：日志 `preprocess=original reason=below_threshold`  
4. 探索搜索：筛选内可开关语义搜索；AI 设置无该开关  
5. 功能选项长标签（如「允许远程模型上传图片」）单行不换行  
6. 后台模式：失败重试次数默认 5；连续失败后进度卡「已跳过」增加、「失败」下降  
7. 分析全部完成后：自动整理至少一轮后暂停；手动「立即整理」仍可用  

---

## 11. 代码锚点

| 模块 | 路径 |
|------|------|
| 缩图 | `src/main/ai/AiVisionImagePrep.mjs` |
| 超时常量/公式/重试 | `src/main/ai/aiConstants.mjs` |
| 分析调度 | `src/main/ai/AiAnalysisManager.mjs` |
| 策展门控 | `src/main/store/collectionCurateGate.mjs` |
| Provider | `src/main/ai/AiAnalysisProvider.mjs`、`providers/HttpAiProviders.mjs` |
| 默认/迁移 | `src/common/publicData.js` → `migrateSettingData` |
| 设置 UI | `src/renderer/.../Setting/components/AiSetting.vue` |
| 进度卡 | `AiAnalysisDashboardPanel.vue` |
| 探索顶栏 | `ExploreSearchHeader.vue`、`ExploreCommon.vue` |
| 视觉 ONNX | `src/main/ai/ImageVisualEmbedder.mjs` |
| 模型文件 | `resources/models/mobileclip2_s0_vision.onnx` |

---

## 12. 探索卡片角标（与向量无关）

开启「显示标签」且卡片足够大时，探索页角标包括：资源来源、画质、评分、**AI 已分析** ✨（`aiAnalysisStatus === done`）、横竖屏、收藏。**不显示**单张文本/视觉向量化状态。合集页默认不显示 ✨（`show-ai-badge=false`）。详见 [ai-visual-embedding-and-similar.md](./ai-visual-embedding-and-similar.md) §6。

---

## 13. 修订记录

| 版本 | 日期 | 说明 |
|------|------|------|
| v1.0 | 2026-05-27 | 缩图、动态超时、语义搜索迁移、探索顶栏、设置 Tooltip/对齐 |
| v1.1 | 2026-05-28 | 设置速查补充 `scoreMinFilter` / `autoCollectionsMaxCount`；链至合集专题文档 |
| v1.2 | 2026-05-28 | `analysisMaxRetries` 与 `aiAnalysisFailCount`；`scoreMinFilter` 默认 70；链至策展稳定暂停 |
| v1.3 | 2026-05-28 | 视觉向量/找相似设置与统计；§12 卡片角标说明；链至 ai-visual-embedding-and-similar |
