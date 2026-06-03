# 视觉向量与找相似

> 文档版本：**v2.3**  
> 整理日期：**2026-06-03**  
> 状态：**已实现**  
> 关联：[ai-dev-plan.md](./ai-dev-plan.md) · [resource-lifecycle-and-cleanup.md](./resource-lifecycle-and-cleanup.md) · [ai-feature-roadmap.md](./ai-feature-roadmap.md) · [README.md](./README.md)

---

## 1. 背景与目标

2.0.0 初版「找相似」仅基于 **文本向量**（标题/描述 embed），效果接近「文案像不像」。

当前方案（**方案 C**）：

| 能力 | 实现 |
|------|------|
| 画面相似 | 默认 **内置 MobileCLIP2-S0**（512 维，离线 ONNX） |
| 文案相似 | 可选：已配置 **文本 embedding 模型** 且 `ai.enabled` 时参与 |
| 融合排序 | **RRF**（Reciprocal Rank Fusion，k=60）；画面路为主，文案路仅对画面候选 **加权 boost** |
| 远程增强 | 兼容选项关闭「内置画面向量」后，可走 **独立画面向量服务**；失败回退内置 |
| 用户阈值 | **不暴露**相似度滑块；内部常量过滤（见 §5.2） |

**语义搜索**仍用文本向量表；**系统策展 K-Means** 与 **用户合集画面补充** 用画面向量表（见 §9、§13）。

---

## 2. 内置视觉模型（MobileCLIP2-S0）

| 项 | 说明 |
|----|------|
| 模型 | MobileCLIP2-S0 **视觉分支**（社区 ONNX） |
| 文件 | `resources/models/mobileclip2_s0_vision.onnx`（约 43MB） |
| 模块 | `src/main/ai/ImageVisualEmbedder.mjs` |
| 维度 | **512**（L2 归一化） |
| model 字段 | `mobileclip2-s0`（`VISUAL_EMBED_MODEL_ID`） |
| 下载 | `npm run download:mobileclip2-s0` |

详参 [resources/models/README.md](../../resources/models/README.md)。

---

## 3. 远程画面向量服务（可选）

与 **视觉分析**、**文本/向量** 并列的第三套服务配置，字段独立：

| 字段 | 说明 |
|------|------|
| `visualEmbedSource` | `builtin`（默认）\| `remote` |
| `visualEmbedPreset` / `visualEmbedProvider` | 同视觉/文本预设体系 |
| `visualEmbedBaseUrl` / `visualEmbedApiKey` | 服务地址与密钥 |
| `visualEmbedModel` | 须支持 **图像 embedding**（`MODEL_PURPOSE.VISUAL_EMBED`） |

**设置 UI：**

- **兼容选项** →「内置画面向量」开关（开=builtin，关=remote）
- **「画面向量服务」** 卡片始终显示（服务商、地址、API Key、模型、测试连接）
- 侧边栏锚点 `#divider-ai-visual-embed` 始终可见

**主进程路由：** `AiAnalysisProvider.resolveServiceProfile('visualEmbed')` → `createProvider('visualEmbed')`。

**生效条件：** `visualEmbedSource === 'remote'` **且** `visualEmbedModel` 非空（`usesRemoteVisualEmbed()`）。

**失败策略：** 远程 embed 失败 → 日志 warn → **回退内置 MobileCLIP**，并以 **当前 active visual model id** 写入 BLOB（查询侧支持 model 回退）。

---

## 4. Embedding 请求方言（多服务商）

统一构建器：`src/main/ai/EmbedRequestBuilder.mjs`（`HttpAiProviders` 文本/图像 embed 均经此模块）。

| profile | 适用 | 要点 |
|---------|------|------|
| `openai_standard` | OpenAI / DeepSeek 等 | `{ model, input }` |
| `nvidia_nim_text` | NVIDIA `nv-embed-v1` 等 | `+ input_type, encoding_format, truncate`；**无 modality** |
| `nvidia_nim_vl` | NVIDIA Nemotron Embed VL | 文本：`modality: ['text']`；图像：`input` 为 **data URI 字符串**（非数组）+ `modality: ['image']` |
| `asymmetric_text` | 其他非对称文本 embed | `+ input_type` |
| `openrouter_multimodal` | OpenRouter 多模态 embed | `input: [{ content: [...] }]` |
| `vllm_messages` | 本地 vLLM 非对称 VL | `messages` + `role: query/document` |
| `jina_task` | Jina Embeddings v3/v4 | `task: retrieval.query/passage` |

**NVIDIA 非对称模型注意：**

- 图像 **不支持** `input_type: query`（仅 passage）；找相似对 Nemotron VL 走 **passage ↔ passage**
- 纯文本 `nv-embed-v1` 勿发 `modality` 字段（会 400 `extra_forbidden`）

兼容层 re-export：`src/main/ai/AsymmetricEmbedUtils.mjs`。

---

## 5. 找相似逻辑

### 5.1 模块

| 模块 | 路径 |
|------|------|
| HybridSimilarSearch | `src/main/ai/HybridSimilarSearch.mjs` |
| EmbeddingManager | `src/main/ai/EmbeddingManager.mjs` |
| VecStore | `src/main/ai/VecStore.mjs` |

### 5.2 算法（当前）

1. 取源图 **画面向量** +（可选）**文案向量**
2. **画面路**：Top-200 召回 → 余弦 ≥ `SIMILAR_VISUAL_MIN_COSINE`（**0.72**，内部常量）
3. **文案路**（有 embedding 且 AI 开启）：Top-200；**不单独引入**画面路以外的 ID，仅对画面候选做 `SIMILAR_TEXT_BOOST_WEIGHT` 加权
4. 无画面向量时：全文案路 + `SIMILAR_TEXT_MIN_COSINE`（0.62）回退
5. 结果缓存 5 分钟（`SIMILAR_SESSION_TTL_MS`），key 含 `visualModel`

### 5.3 远程非对称模型

若 `supportsImageAsQuery(model)` 为 false（含 NVIDIA Nemotron VL）：源图查询 **不** 用 query 重算，直接用库内 **passage** 向量。

### 5.4 与旧版差异（已移除设置）

| 已删除字段 | 替代 |
|------------|------|
| `findSimilarMode` | 自动双路融合，无需用户选 visual/text |
| `similarMinCosine` / `similarMinCosineVisual` | `aiConstants.mjs` 内部常量 |
| `visualEmbedEnabled` | `visualEmbedSource: 'builtin'` |

迁移：`publicData.js` 删除旧 key；首次 remote 可从 vision 配置复制（一次性）。

---

## 6. 数据层

| 表 | 用途 |
|----|------|
| `fbw_resource_vec_blob` | 文本向量（语义搜索、找相似文案 boost） |
| `fbw_resource_image_vec_blob` | 画面向量（找相似、**系统策展 K-Means**、**用户合集画面补充**）；**主键 `(resourceId, model)`** |

内置 512 维可走 sqlite-vec `fbw_image_vec_index`（仅 **builtin model** 行）；远程 model 维数不同，按 `model` 分桶 BLOB 检索。

---

## 7. 写入时机

| 时机 | 文本向量 | 画面向量 |
|------|----------|----------|
| AI 分析成功 | ✅（需 `ai.enabled`） | ✅（需 `ai.enabled`；builtin 或 remote） |
| 找相似（源图无向量） | 按需 `upsertForResource` | 优先 `upsertImageForResource` |
| 后台 `visualEmbed` | — | 须 **`ai.enabled`**；每轮批量补算（内置约 40 张/批），按 **当前 active visual model** |
| 找相似（用户点击） | 按需 | 源图无向量时可 **单张** `upsertImageForResource`（**不要求** `ai.enabled`）；**视频**用 `posterPath` |

入库：远程非对称模型用 `input_type: passage`；语义搜索 query 用 `input_type: query`。

---

## 8. 设置项 `settingData.ai`（相关）

| 字段 | 默认 | 说明 |
|------|------|------|
| `visualEmbedSource` | `builtin` | 内置 / 远程 |
| `visualEmbedPreset` … `visualEmbedModel` | 见 `aiConstants.defaultAiSettings` | 远程画面向量服务 |
| `embeddingModel` | — | **仅文本** embed |
| `legacyLocalVisualEmbed`（UI） | 映射 `visualEmbedSource === 'builtin'` | 兼容选项开关 |

**测试连接：** 三处服务统一按钮「测试连接」、成功「连接成功」；超时 **60s**（`AI_TEST_CONNECTION_TIMEOUT_MS`）。视觉测试发 **小图 + analyzeImage**，非纯文本 chat。

---

## 9. 与语义搜索 / 合集 / 卡片角标

| 能力 | 向量 |
|------|------|
| `main:semanticSearch` | 文本 |
| `main:findSimilar` | 画面为主 + 文案 boost |
| `CollectionCurator` K-Means（`vec:*`） | **画面**（`fbw_resource_image_vec_blob`，按 active model） |
| 用户合集 `generate`（画面补充） | **画面**（`VisualCollectionSearch`；关键词优先，见 §15） |
| 卡片 ✨ | `aiAnalysisStatus === 'done'`（**非**相似度；评分角标为美学分） |

---

## 10. IPC

| 通道 | 说明 |
|------|------|
| `main:findSimilar` | `{ resourceIds, total, signals? }`；**须有效 `resourceId`**；`signals` 如 `visual`、`visual+text_boost` |
| `main:testAiConnection` | `type`: `vision` \| `text` \| `embed` \| `visual-embed` |
| `main:listAiModels` | `kind`: `visualEmbed` + `purpose`: `visual-embed` |
| `main:getAiAnalysisStats` | `imageEmbedding` 按当前 visual model 计数 |

---

## 11. 运维与排错

| 现象 | 可能原因 | 建议 |
|------|----------|------|
| 找相似混入无关图（动物/海/天空） | 旧版 RRF 等权文案路 | 已改为画面路为主 + 内部 0.72 阈值；清 5min 缓存或换源图重试 |
| NVIDIA 画面 embed 400 | `input` 格式 / `modality` / `input_type` | 查日志 `profile=nvidia_nim_vl`；确认已用字符串 data URI |
| NVIDIA 视觉分析 504 | 网关超时（非格式错误） | 换模型、降超时、或本机 Ollama 做视觉 |
| 远程失败仍能用 | 回退内置 | 预期行为；查 warn 日志 |
| 测试连接一直 loading | 曾用纯文本测视觉模型 | 已改为小图 vision 测试 + 60s 上限 |
| 用户合集刷新全是风景（如「汽车」） | ① `regenPrompt` 默认 true 时 LLM 清空 `filterKeywords` → 全库按 score 排序；② 画面检索顶替关键词 | 已修复：`regenPrompt=false`、短 prompt 兜底、实体词 **禁用** 画面补充、`expandCollectionKeywordTags` 动态扩 tags |
| 系统策展 `embeddings` 很少 | 画面向量补算慢（约 4 张/4min） | 等待 `visualEmbed` 或手动分析；`curatorStats.embeddings` 指画面向量数 |

---

## 12. 验收要点

1. 默认（内置画面向量）：找相似以画面相近为主；有 embedding 时文案可微调排序  
2. 关闭「内置画面向量」+ 配置 Nemotron VL：测试连接成功；入库 dim=2048；失败回退 512 维内置  
3. 文本 `nv-embed-v1` @ NVIDIA：测试文本连接成功（无 modality 400）  
4. 设置页三处「测试连接 / 连接成功」文案一致  
5. 语义搜索仍用文本表；系统 `vec:*` 合集按画面聚类  
6. 用户合集实体词（如「汽车」）：刷新 `regenPrompt=false`、日志 `visual=no`；有 SQL 匹配则入选，无则空集  
7. 氛围描述合集（无 filterKeywords/tags）：画面向量可补充至 `limitCount`

---

## 13. 合集与画面向量

### 13.1 系统自动策展（`CollectionCurator`）

- `buildVectorCandidates`：从 `fbw_resource_image_vec_blob` 读取，按 **当前 active visual model** 过滤
- `countEmbeddings` / `curatorStats.embeddings`：统计 **画面向量** 数量（非文本表）
- 画面向量补算完成 → `onVisualEmbeddingDone` → ~60s 防抖触发策展

### 13.2 用户自定义合集（`CollectionsManager.generate`）

模块：`VisualCollectionSearch.mjs`（经 `EmbeddingManager.visualSearchByQuery`）；标签扩展：`TextQueryParser.expandCollectionKeywordTags`。

| 步骤 | 说明 |
|------|------|
| 0. 刷新策略 | `generate(id)` 默认 **`regenPrompt: false`**；仅显式传 `regenPrompt: true` 才重跑 NL 解析 |
| 0b. 短 prompt | `filterKeywords` 为空且 `prompt` ≤ **32** 字 → 当作关键词（实体词合集） |
| 0c. 标签扩展 | 短实体词 + AI 开启 + 未缓存：LLM 扩展 `tags`（**无写死别名表**）；缓存 `keywordTagsExpandedFor` |
| 1. 关键词优先 | `searchWithFilters`（`filterKeywords` / `tags` / 评分等） |
| 2. 画面补充 | 仅 **无** `filterKeywords`/tags（`_hasStructuredFilters` 为 false）；且 `useSemantic !== false`、结果不足、画面向量 ≥ **12** |
| 3. 候选池 | 氛围型合集：画面 KNN 在 SQL 过滤池内（`pageSize` 约 120～800） |
| 4. 内置模型 | 远程多模态：文本直 embed；内置 MobileCLIP：池内文本种子 → 画面质心 → KNN |
| 5. 纯氛围描述 | 无结构化关键词时，可主要靠画面语义填满合集 |

常量：`COLLECTION_VISUAL_MIN_EMBEDDINGS`（12）、`COLLECTION_VISUAL_SEARCH_MIN_COSINE`（0.65）、`COLLECTION_VISUAL_SEED_COUNT`（24）；标签扩展上限 **16**（代码）/ prompt 建议 ≤8（i18n）。

详述：[ai-collections-ux-and-curate.md](./ai-collections-ux-and-curate.md) §2、§6。

---

## 14. 代码锚点

| 模块 | 路径 |
|------|------|
| 内置 ONNX | `ImageVisualEmbedder.mjs` |
| 编排 / findSimilar | `EmbeddingManager.mjs` |
| RRF / 融合 | `HybridSimilarSearch.mjs` |
| 合集画面检索 | `VisualCollectionSearch.mjs` |
| 用户合集 / 系统策展 | `CollectionsManager.mjs`、`CollectionCurator.mjs` |
| 标签扩展 | `TextQueryParser.mjs`（`expandCollectionKeywordTags`） |
| 请求方言 | `EmbedRequestBuilder.mjs` |
| HTTP Provider | `providers/HttpAiProviders.mjs` |
| 三套路由 | `AiAnalysisProvider.mjs` |
| 常量 | `aiConstants.mjs` |
| 模型用途过滤 | `src/common/aiModelCatalog.js` |
| 默认/迁移 | `src/common/publicData.js` |
| 设置 UI | `AiSetting.vue` |

---

## 15. 修订记录

| 版本 | 日期 | 说明 |
|------|------|------|
| v1.0 | 2026-05-28 | MobileCLIP2-S0、双表、findSimilarMode / 用户阈值 |
| **v2.0** | 2026-05-29 | 方案 C：RRF 画面为主；独立画面向量服务；EmbedRequestBuilder；兼容选项开关；移除用户阈值；测试连接统一 |
| **v2.1** | 2026-05-29 | 合集改用画面向量：策展 K-Means、用户合集关键词优先 + `VisualCollectionSearch`；§13 |
| **v2.2** | 2026-05-29 | `regenPrompt` 默认 false；LLM 动态标签扩展；实体词禁用画面补充；风景顶替根因与修复 |
| **v2.3** | **2026-06-03** | 复合主键 `(resourceId,model)`；远程 fallback 写 active model；视频 `posterPath`；findSimilar IPC 校验；链至 cleanup 文档 |
