# 视觉向量与找相似（MobileCLIP2-S0）

> 文档版本：**v1.0**  
> 整理日期：2026-05-28  
> 状态：**已实现**  
> 关联：[ai-dev-plan.md](./ai-dev-plan.md) · [ai-feature-roadmap.md](./ai-feature-roadmap.md) · [ai-analysis-ux-and-performance.md](./ai-analysis-ux-and-performance.md) · [README.md](./README.md)

---

## 1. 背景与目标

2.0.0 初版「找相似」基于 **文本向量**（`embeddingModel` 对标题/描述/摘要做 embed），效果接近「文案像不像」，而非画面像不像。

本增量引入 **内置 ONNX 视觉编码器 MobileCLIP2-S0**：

- 不依赖 Ollama / 云端，与美学评分共用 `onnxruntime-node`
- 默认 **找相似按画面向量**；文本向量保留给 **语义搜索** 与 **找相似回退**
- 自动合集聚类仍用 **文本向量表**（`fbw_resource_vec_blob`），逻辑未改

---

## 2. 模型与资源

| 项 | 说明 |
|----|------|
| 模型 | MobileCLIP2-S0 **视觉分支**（社区 ONNX 导出） |
| 文件 | `resources/models/mobileclip2_s0_vision.onnx`（约 **43MB**） |
| 参考配置 | `resources/models/mobileclip2_s0_preprocessor.json` |
| 来源 | [plhery/mobileclip2-onnx](https://huggingface.co/plhery/mobileclip2-onnx)（基于 Apple [MobileCLIP2-S0](https://huggingface.co/apple/MobileCLIP2-S0)） |
| 下载脚本 | `npm run download:mobileclip2-s0` → `scripts/download-mobileclip2-s0.mjs`（默认 hf-mirror） |
| 说明 | [resources/models/README.md](../../resources/models/README.md) |

### 推理规格

| 项 | 值 |
|----|-----|
| 输入名 | `pixel_values` |
| 输出名 | `image_embeds` |
| 输入尺寸 | 256×256（cover 裁剪，RGB，/255，CHW） |
| 输出维度 | **512**（入库前 L2 归一化） |
| 执行 | CPU，`onnxruntime-node` |

---

## 3. 数据层

### 3.1 表结构

| 表 | 用途 |
|----|------|
| `fbw_resource_vec_blob` | **文本向量**（语义搜索、文本找相似、自动合集聚类） |
| `fbw_resource_image_vec_blob` | **视觉向量**（画面找相似） |

`fbw_resource_image_vec_blob` 列：`resourceId` PK、`embedding` BLOB、`dim`、`model`（默认 `mobileclip2-s0`）、`updated_at`。

建表：`src/main/store/sql.mjs`；运行时兜底：`VecStore._ensureImageBlobTable()`。

### 3.2 与 sqlite-vec 索引

- 全局 vec0 索引（`fbw_vec_index`）仍按 **文本向量 dim**（常见 768）维护
- **视觉向量不参与 vec0**，找相似在候选集内用 `rankSimilarAmongImageIds` / `rankSimilarGlobalImage`（内存余弦）

---

## 4. 主进程模块

| 模块 | 路径 | 职责 |
|------|------|------|
| ImageVisualEmbedder | `src/main/ai/ImageVisualEmbedder.mjs` | 加载 ONNX、预处理、512 维向量 |
| EmbeddingManager | `src/main/ai/EmbeddingManager.mjs` | `upsertImageForResource`、`findSimilar` 分流、后台补算 |
| VecStore | `src/main/ai/VecStore.mjs` | `upsertImage`、`rankSimilarAmongImageIds`、`rankSimilarGlobalImage` |
| AiAnalysisManager | `src/main/ai/AiAnalysisManager.mjs` | 分析成功后触发视觉 embed；统计 `imageEmbedding` |
| store/index | `src/main/store/index.mjs` | 定时任务 `visualEmbed`；启动约 60s 后首轮补算 |

### 4.1 写入时机

| 时机 | 文本向量 | 视觉向量 |
|------|----------|----------|
| AI 分析成功 | ✅（需 `ai.enabled`） | ✅（需 `visualEmbedEnabled !== false`，**不要求** AI 开启） |
| 找相似点击（源图无向量） | 回退时尝试 `upsertForResource` | 优先 `upsertImageForResource` |
| 后台 `visualEmbed` 任务 | — | 每 4 分钟最多 **4** 张未入库图片 |

### 4.2 找相似逻辑（`findSimilar`）

1. 读取 `ai.findSimilarMode`：`visual`（默认）| `text`
2. **visual**：查 `fbw_resource_image_vec_blob`，阈值 `ai.similarMinCosineVisual`（默认 **0.72**）
3. 无视觉向量 → 自动回退 **text** + `similarMinCosine`（默认 **0.62**）
4. 有 `candidateIds` / scope → `rankSimilarAmongImageIds`；无 scope → `rankSimilarGlobalImage`
5. 返回 `{ resourceIds, total, mode }`；列表顺序由 `ResourcesManager.getResourcesByIds` 保持 KNN 序

**注意：** `similarMinCosine` 从旧默认 0.42 迁移为 0.62（`migrateSettingData`）；视觉阈值独立配置。

---

## 5. 设置项 `settingData.ai`

| 字段 | 默认 | 说明 |
|------|------|------|
| `findSimilarMode` | `visual` | 找相似依据：画面 / 文案 |
| `visualEmbedEnabled` | `true` | 是否计算并存储视觉向量 |
| `similarMinCosineVisual` | `0.72` | 视觉模式余弦阈值（0.35～0.95） |
| `similarMinCosine` | `0.62` | 文本模式 / 回退阈值 |
| `embeddingModel` | — | **仅文本** embed，与视觉无关 |

**AiSetting 位置：** 功能选项 →「找相似依据」「视觉向量开关」「视觉/文本最低相似度」。

**统计（设置页进度卡）：**

| 文案 | 字段 | 含义 |
|------|------|------|
| 已向量化 | `stats.embedding` | 文本向量条数 |
| 已向量化(视觉) | `stats.imageEmbedding` | 视觉向量条数 |

---

## 6. 前端：卡片角标（当前 **未** 展示向量状态）

探索页 / 合集卡片 **没有**「已向量化(文本)」「已向量化(视觉)」角标。

| 角标 | 条件 | 页面 |
|------|------|------|
| 资源来源 `resourceName` | 有值 | 探索、合集（开「显示标签」） |
| 画质 `quality` | ≠ unset | 同上 |
| 评分 `score` | 有值 | 同上 |
| **AI 已分析** ✨ | `aiAnalysisStatus === 'done'` | **仅探索页** |
| 横/竖屏图标 | `isLandscape` | **仅探索页** |
| 已收藏 ⭐ | `isFavorite` | 探索、合集 |

合集页 `ResourceExploreCard` 使用 `show-ai-badge="false"`，**不显示** ✨。

列表 API **不下发**单张是否已有文本/视觉向量字段。

---

## 7. 与语义搜索 / 自动合集的关系

| 能力 | 向量类型 |
|------|----------|
| `main:semanticSearch` | **文本** |
| `main:findSimilar`（默认） | **视觉**（无则回退文本） |
| `CollectionCurator` K-Means | **文本**（`JOIN fbw_resource_vec_blob`） |
| 探索顶栏语义搜索开关 | **文本** |

---

## 8. IPC

| 通道 | 变更 |
|------|------|
| `main:findSimilar` | 行为改为默认视觉；`total` 为阈值过滤后候选数 |
| `main:getAiAnalysisStats` | `data.imageEmbedding` 视觉向量计数 |
| `main:semanticSearch` | 无变更 |

---

## 9. 性能与运维

| 项 | 说明 |
|----|------|
| 单张 embed | CPU 约 tens～数百 ms（视图大小） |
| 全库补算 | 后台 4 张/4min；万级图需较长时间 |
| 安装包 | `extraResources` 含 `resources/`，模型随包分发（+约 43MB） |
| Git | 大文件建议 LFS 或团队内同步 |
| 省电模式 | 与 AI 分析相同，电池下定时任务暂停 |

### 调参建议

| 现象 | 建议 |
|------|------|
| 找相似结果太少 | 略降 `similarMinCosineVisual`（如 0.65～0.68） |
| 结果太杂 | 提高到 0.75～0.80 |
| 老图无视觉向量 | 等待后台补算或重新分析该图 |

---

## 10. 验收要点

1. `resources/models/mobileclip2_s0_vision.onnx` 存在，启动无「模型不存在」日志  
2. 设置 → AI：可向量化(视觉) 随分析/补算增加  
3. 找相似依据为「画面相似」时，结果以画面相近为主（非仅标题相近）  
4. 关闭「视觉向量」后，找相似回退文本逻辑仍可用（需 AI 开启且已有文本向量）  
5. 语义搜索、系统合集聚类行为与增量前一致  

---

## 11. 代码锚点

| 模块 | 路径 |
|------|------|
| ONNX 视觉 | `src/main/ai/ImageVisualEmbedder.mjs` |
| 向量编排 | `src/main/ai/EmbeddingManager.mjs` |
| 存储 / KNN | `src/main/ai/VecStore.mjs` |
| 常量 | `src/main/ai/aiConstants.mjs`（`VISUAL_EMBED_*`） |
| 默认/迁移 | `src/common/publicData.js` |
| 探索找相似 UI | `ExploreCommon.vue`、`useSimilarResultsLoadMore.mjs` |
| 设置 | `AiSetting.vue`、`AiAnalysisDashboardPanel.vue` |

---

## 12. 修订记录

| 版本 | 日期 | 说明 |
|------|------|------|
| v1.0 | 2026-05-28 | 初稿：MobileCLIP2-S0、双表向量、设置项、卡片角标说明、与语义/策展边界 |
