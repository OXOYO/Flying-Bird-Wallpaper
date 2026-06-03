# AI 分析性能与设置体验（2.0.0+ 增量）

> 文档版本：**v2.0**  
> 整理日期：**2026-06-03**  
> 状态：**已实现**  
> 关联：[data-model-resources-and-ai.md](./data-model-resources-and-ai.md) · [resource-lifecycle-and-cleanup.md](./resource-lifecycle-and-cleanup.md) · [ai-dev-plan.md](./ai-dev-plan.md) · [ai-visual-embedding-and-similar.md](./ai-visual-embedding-and-similar.md) · [README.md](./README.md)

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

测试连接、embed 等使用 **`AI_TEST_CONNECTION_TIMEOUT_MS`（60s）** 或各子路径更短上限；视觉测试发 **小图 + analyzeImage**（非纯文本 chat）。

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
| 文件类型 | **`image`** 与 **`video`（有 `posterPath`）** 可分析/入队；无封面视频等标 `skipped` |
| 视频视觉 | 方案 A：用 **封面帧**（`posterPath`）走与图片相同的 analyze/embed 路径（`AiVisionResourcePath.mjs`） |
| 分析模式 | `off` / `on_demand` / `background_slow` / `new_only`（设置页 ⓘ 说明） |
| 后台批次 | 每轮 `fetchPendingBatch(concurrency)` 张，**并行**（`Promise.all`）；`ai.concurrency` 默认 **1** |
| 失败重试上限 | **`ai.analysisMaxRetries`**（默认 **1**，1～20）；后台连续失败达上限 → `skipped`，不再自动重试 |
| 手动分析 | 探索页「AI 分析」**不受**重试上限（仍可一直试；成功则 `aiAnalysisFailCount` 归零） |
| 失败计数 | 附表列 **`fbw_resource_ai.aiAnalysisFailCount`**；`markPendingForResources` 时归零 |
| 语义搜索过滤 | `_filterOrderedResourceIdsBySearchParams` 调用 `search({ skipStatistics: true })`，**不**污染浏览量 |

### 4.1 后台失败重试（v1.2+）

实现：`AiAnalysisManager.handleAnalysisFailure` + `resolveAnalysisMaxRetries`（`aiConstants.mjs`）。

| 场景 | 行为 |
|------|------|
| 后台 `background_slow` / `new_only` | 失败递增计数；达 `analysisMaxRetries` → `aiAnalysisStatus=skipped`，日志 `reason=max_retries` |
| 浏览页手动 `analyzeResourceById` | `respectRetryLimit=false`，不因上限自动 skipped |
| 设置位置 | **已从 AI 设置页移除**（默认 1，逻辑仍在 `aiConstants` / `ensureAiFields`） |
| 非法/空配置 | 迁移与 `ensureAiFields` 回退默认 **1** |

与合集联动：队列稳定（无 pending/failed）且完成至少一轮自动整理后，系统策展暂停定时任务 — 见 [ai-collections-ux-and-curate.md](./ai-collections-ux-and-curate.md) §2.5。

### 4.2 后台调度与省电模式（v1.9）

实现：`src/main/store/index.mjs`（`isPowerSaveOnBattery`、`triggerBackgroundAnalysisPump`、`resumeBackgroundAiTasksIfAllowed`、`restartPowerSaveDependentTasks`）；常量见 `aiConstants.mjs`。

#### 判定与暂停

| 项 | 说明 |
|----|------|
| 省电生效条件 | `settingData.powerSaveMode === true` **且** `powerState.isOnBattery`（`isPowerSaveOnBattery()`） |
| 设置入口 | **基础设置** →「省电模式」（`BaseSetting.vue`） |
| 电池 + 省电 | `powerMonitor.on('on-battery')` → `taskScheduler.clearAllTasks()`；`wasPausedByBattery = true` |
| 设置内开启省电（电池） | `restartPowerSaveDependentTasks` 同样 `clearAllTasks` + 标记暂停 |
| 受影响任务 | AI 分析看门狗 `aiAnalysis`、画面向量 `visualEmbed`、壁纸切换、目录刷新、系统策展等**全部**定时任务 |

#### 看门狗与 pump

| 任务 | 首次延迟 | 周期 | 行为 |
|------|----------|------|------|
| `aiAnalysis` | **60s**（`AI_ANALYSIS_PUMP_START_DELAY_MS`） | **3min**（`AI_ANALYSIS_WATCHDOG_MS`） | 回调内 `triggerBackgroundAnalysisPump()`；`background_slow` 为**连续 pump**（非固定间隔轮询） |
| `visualEmbed` | **90s** | **5min** | `triggerVisualEmbedPump()` |

主窗口就绪后由 `ensureBackgroundAiTasks()` 注册；`_backgroundAiScheduled` 仅防重复 init，**不应**阻止省电/插 AC 后的恢复。

#### 恢复路径（v1.9 修复）

| 触发 | 行为 |
|------|------|
| **关闭省电开关**（`updateSettingData`） | `restartPowerSaveDependentTasks` → 若不再 `isPowerSaveOnBattery()`：`startScheduledTasks()` + `resumeBackgroundAiTasksIfAllowed()` |
| **插交流电**（`on-ac`，且曾因电池省电暂停） | 同上：`startScheduledTasks()` + `resumeBackgroundAiTasksIfAllowed()` |
| **修改 AI 设置并保存** | 原有 `restartAiAnalysisTask`：`initAiAnalysisTask` / `initVisualEmbedTask` + 立即 pump |

`resumeBackgroundAiTasksIfAllowed()` 前置条件：`_mainUiReady`、非 `isPowerSaveOnBattery()`；内部仍受 `ai.enabled` 与分析模式（非 `off` / `on_demand`）约束。

#### UI「等待中」与根因

进度卡 / 侧边栏：`pending > 0` 且当前无 `running` → **等待中**（`useAiAnalysisDashboard.js`）。

**修复前：** 电池省电 `clearAllTasks()` 后，仅关省电开关**不会**触发 `restartAiAnalysisTask`（仅 `ai` JSON 变更才触发）→ 队列有积压但 pump 未恢复，长期「等待中」。 workaround：关再开「启用 AI」。

**修复后：** 关省电或插 AC 后自动重新注册看门狗并 `setImmediate` pump，无需手动 toggling AI。

#### 验收

1. 电池 + 省电开启 → AI 进度卡倾向「等待中」或暂停 pump  
2. **仅关闭省电**（不改 AI 设置）→ 数秒内变为「运行中」，pending 下降  
3. 插 AC（曾 `wasPausedByBattery`）→ 定时任务与 AI pump 恢复  
4. 日志含 `[Store] 省电限制已解除，恢复后台 AI 与相关定时任务`

---

## 5. 智能语义搜索配置迁移

| 旧 | 新 |
|----|-----|
| `settingData.ai.smartSearch` | **`settingData.search.useSemanticSearch`** |

- **启用位置**：探索页顶栏筛选（仅资源库搜索）、H5 搜索筛选；**已从 AI 设置页移除**
- **仍走语义**：桌面搜索页（非收藏/回忆/隐私）、H5 `/api/search/images`；无结果回退关键词 SQL
- **不走语义**：收藏/回忆/隐私、找相似
- **合集生成**：实体词 **仅 SQL/tags**（`regenPrompt` 默认 false；短 prompt ≤32 字兜底）；氛围型可走画面补充；标签扩展见 `TextQueryParser.expandCollectionKeywordTags` — [ai-collections-ux-and-curate.md](./ai-collections-ux-and-curate.md) §6
- **找相似**：**画面向量 RRF**（非语义搜索）；见 [ai-visual-embedding-and-similar.md](./ai-visual-embedding-and-similar.md)

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
| 进度卡显隐 | **与「启用 AI」无关，常显**（`useAiAnalysisDashboard.showAnalysisProgress`） |
| 失败重试 | 失败 chip 可点击 → 确认后 `requeueFailedAiAnalysis`（重置失败次数并标 `pending`） |
| 进度卡统计 | `已向量化`（文本）+ **`已向量化(视觉)`**（`imageEmbedding`） |
| 画面向量 | 兼容选项「**内置画面向量**」；关则显示 **画面向量服务** 卡片 — 见 [ai-visual-embedding-and-similar.md](./ai-visual-embedding-and-similar.md) |
| 测试连接 | 视觉 / 文本 / 文本向量 / 画面向量 四处统一 **「测试连接」**、成功 **「连接成功」** |
| 合集相关子项 | `scoreMinFilter`、`autoCollectionsMaxCount` 在「AI 自动整理合集」下 — 见 [ai-collections-ux-and-curate.md](./ai-collections-ux-and-curate.md) |
| 后台调参（隐藏） | **`analysisMaxRetries`**、**`concurrency`** 默认均为 **1**；表单项已从 `AiSetting.vue` 删除（勿用 HTML 注释隐藏模板） |

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
| `analysisMaxRetries` | 1 | 后台单张最大连续失败次数（1～20）；**设置页不展示** |
| `concurrency` | 1 | 后台并行分析张数（1～10）；**设置页不展示** |
| `autoCurateSettled` | false | 内部：分析稳定且已跑完至少一轮自动整理 |
| `autoCurateSettledAnalyzed` | 0 | 锁存时的已分析张数 |
| `visualEmbedSource` | `builtin` | 内置 / 远程画面向量（兼容选项开关） |
| `visualEmbedPreset` … `visualEmbedModel` | — | 远程画面向量服务四件套 |

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
6. 后台模式：失败重试默认 1（无 UI）；连续失败后进度卡「已跳过」增加、「失败」下降  
7. AI 设置无「后台失败重试次数」「后台分析并发」表单项  
8. 分析全部完成后：自动整理至少一轮后暂停；手动「立即整理」仍可用  
9. 三处/四处「测试连接」文案一致；画面向量 remote 时独立卡片可测通  
10. 工具页清空 AI：成功提示显示数字非 `{count}`；插件 `title`/`desc` 仍在  
11. 设置页：未开 AI 时进度卡仍可见；失败 chip 重试后 pending 上升  
12. **省电恢复**：电池 + 省电暂停后，仅关闭省电开关 → AI 自动恢复「运行中」，无需关开「启用 AI」  

---

## 11. 代码锚点

| 模块 | 路径 |
|------|------|
| 缩图 | `src/main/ai/AiVisionImagePrep.mjs` |
| 超时常量/公式/重试 | `src/main/ai/aiConstants.mjs` |
| 分析调度 | `src/main/ai/AiAnalysisManager.mjs` |
| 省电 / 任务恢复 | `src/main/store/index.mjs` → `resumeBackgroundAiTasksIfAllowed`、`restartPowerSaveDependentTasks`、`setupPowerMonitor` |
| 看门狗常量 | `src/main/ai/aiConstants.mjs` → `AI_ANALYSIS_*`、`VISUAL_EMBED_*` |
| 进度卡状态 | `useAiAnalysisDashboard.js` |
| 策展门控 | `src/main/store/collectionCurateGate.mjs` |
| Provider | `src/main/ai/AiAnalysisProvider.mjs`、`providers/HttpAiProviders.mjs` |
| Embed 方言 | `src/main/ai/EmbedRequestBuilder.mjs` |
| 默认/迁移 | `src/common/publicData.js` → `migrateSettingData` |
| 设置 UI | `src/renderer/.../Setting/components/AiSetting.vue` |
| 进度卡 / 重试 | `AiAnalysisDashboardPanel.vue`、`useAiAnalysisDashboard.js` |
| 清空 AI | `Utils.vue` → `resetAiAnalysis` |
| AI 附表 | `resourceAiSql.mjs`、`schemaUpgrade.mjs` |
| 探索顶栏 | `ExploreSearchHeader.vue`、`ExploreCommon.vue` |
| 视觉 ONNX | `src/main/ai/ImageVisualEmbedder.mjs` |
| 模型文件 | `resources/models/mobileclip2_s0_vision.onnx` |

---

## 12. 探索卡片角标（与向量无关）

开启「显示标签」且卡片足够大时，探索页角标包括：资源来源、画质、评分、**AI 已分析** ✨（`aiAnalysisStatus === done`）、横竖屏、收藏。**不显示**单张文本/视觉向量化状态；卡片上的数字评分为 **AI 美学分**（附表 `aiScore`，列表投影为 `score`），非相似度。合集页默认不显示 ✨（`show-ai-badge=false`）。详见 [ai-visual-embedding-and-similar.md](./ai-visual-embedding-and-similar.md) §9。

---

## 14. 工具页：清空 AI 分析数据

| 项 | 说明 |
|----|------|
| 入口 | **工具** → 数据工具 →「清空 AI 分析数据」 |
| IPC | `resetAiAnalysis`（无参数；**图片 + 有封面视频**） |
| 范围 | `clearAiAnalysisDataForResourceIds`：附表 + 标签/向量；**删除** `source='auto'` 合集；**不**改主表插件 `title`/`desc` |
| 语义 | 库内全部**可分析**资源 AI 附表清空；用户自建合集保留（成员可能因 auto 合集删除而变） |
| 策展锁存 | 清除 `autoCurateSettled`，分析完成后可重新生成系统合集 |
| 提示 | 主进程 `t('pages.Utils.resetAiAnalysis*', { count })`；须用 **`{count}`** 单花括号 |
| 自动分析 | 须 **启用 AI** 且模式为 **后台连续** / **仅新图**，否则仅入队不 pump |

代码：`Utils.vue`、`AiAnalysisManager.clearAllAiAnalysisData`。

---

## 15. 国际化与提示文案

| 项 | 约定 |
|----|------|
| 占位符 | `src/i18n/i18next.js`：`prefix: '{'`、`suffix: '}'` → 文案写 `{count}`，**勿**写 `{{count}}` |
| 主进程消息 | 清空/重试成功类由主进程 `t()` 生成完整句，渲染端直接 `ElMessage({ message: res.message })` |
| 新键语言 | `clearAiAnalysis*`、`requeueFailed*`、`pumpBlockReason_*`、`runStatusDisabled*` 等 20 键已在 **12 种语言**补全（`scripts/patch-i18n-missing.mjs`） |

---

## 13. 修订记录

| 版本 | 日期 | 说明 |
|------|------|------|
| v1.0 | 2026-05-27 | 缩图、动态超时、语义搜索迁移、探索顶栏、设置 Tooltip/对齐 |
| v1.1 | 2026-05-28 | 设置速查补充 `scoreMinFilter` / `autoCollectionsMaxCount`；链至合集专题文档 |
| v1.2 | 2026-05-28 | `analysisMaxRetries` 与 `aiAnalysisFailCount`；`scoreMinFilter` 默认 70；链至策展稳定暂停 |
| v1.3 | 2026-05-28 | 视觉向量/找相似设置与统计；§12 卡片角标说明；链至 ai-visual-embedding-and-similar |
| **v1.4** | 2026-05-29 | 测试连接 60s、统一文案；移除找相似用户设置；`visualEmbedSource` / 画面向量服务卡片 |
| **v1.5** | 2026-05-29 | 合集生成策略更新：关键词优先 + 画面补充；链至 ai-collections-ux-and-curate §6 |
| **v1.6** | 2026-05-29 | 合集生成：`regenPrompt`、实体词/氛围分流、LLM 标签扩展；链至 ai-collections §6 |
| **v1.7** | 2026-05-27 | 后台 `concurrency` 并行说明；`analysisMaxRetries`/`concurrency` 默认 1 且 UI 移除；链至 [privacy-and-sensitive-content.md](./privacy-and-sensitive-content.md) |
| **v1.8** | 2026-05-27 | 进度卡常显、失败重试入队、工具页清空 AI；附表 `aiAnalysisFailCount`；§12–§15；链至 [data-model-resources-and-ai.md](./data-model-resources-and-ai.md) |
| **v1.9** | 2026-05-27 | §4.2 省电模式暂停/恢复；`restartPowerSaveDependentTasks` + `resumeBackgroundAiTasksIfAllowed`；修复关省电后长期「等待中」 |
| **v2.0** | **2026-06-03** | 视频封面 AI（方案 A）；清空 AI 含视频；`skipStatistics`；词库清理走 `resourceDeleteCleanup`；链至 `resource-lifecycle-and-cleanup.md` |
