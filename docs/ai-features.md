# AI 能力（2.0.0）

> 应用版本：**2.0.0**（自 1.3.8 升级）  
> 状态：**核心能力已落地**

飞鸟壁纸 2.0 在保留 ONNX 本地美学评分（legacy 可选）的基础上，引入可配置的视觉/文本 AI 分析、向量检索、智能合集与轻量推荐。

---

## 1. 能力概览

| 类别 | 功能 |
|------|------|
| **AI 分析** | 美学分、标签、标题/描述、摘要、敏感等级（`nsfwLevel`） |
| **语义搜索** | 文本向量 + 自然语言查询解析（探索页 / H5） |
| **找相似** | 画面向量优先（MobileCLIP 内置或远程服务）+ 文案 boost，RRF 融合 |
| **智能合集** | 用户 NL 创建 + 系统自动策展（`source=user` / `source=auto`） |
| **猜你喜欢** | 基于向量与行为的轻量推荐（桌面合集页 + H5） |
| **Legacy** | `legacyOnnxScore`、`legacyJiebaTags` 可独立开关过渡 |

**明确不做（当前版本）：** H5 语音 STT、独立向量数据库进程、OpenClaw / 外部 Agent 集成。

---

## 2. 架构

```
渲染进程 (AiSetting / ExploreCommon / Collections)
        ↕ IPC
主进程 (AiAnalysisManager / EmbeddingManager / HybridSimilarSearch / CollectionCurator / TaskScheduler)
        ↕
SQLite + sqlite-vec
  ├── fbw_resources          文件元数据、qualityScore
  ├── fbw_resource_ai        AI 文案/分数/敏感等级/分析状态
  ├── fbw_resource_vec_blob  文本向量
  ├── fbw_resource_image_vec_blob  画面向量（按 model 分桶）
  └── fbw_collections        用户合集 + 系统策展
```

- 文件扫描子进程 **仅** 负责 sharp 元数据；AI 分析、向量化、策展均在 **主进程**。
- 版本迁移脚本：`resources/migrations/1.3.8_to_2.0.0.mjs`；每次启动由 `schemaUpgrade.mjs` 幂等补 schema。

---

## 3. 主要设置项

### 3.1 AI 设置（`settingData.ai`）

| 字段 | 说明 |
|------|------|
| `enabled` | 总开关 |
| `visionPreset` / `textPreset` | Ollama、OpenAI 兼容等预设 |
| `visionModel` / `textModel` / `embeddingModel` | 模型名（embedding 仅文本） |
| `visualEmbedSource` | `builtin`（MobileCLIP2-S0）或 `remote` |
| `analysisMode` | 按需 / 后台慢速 / 仅新图 |
| `autoCollectionsEnabled` | 系统自动策展 |
| `scoreMinFilter` | 策展评分门槛（默认 70） |
| `legacyOnnxScore` / `legacyJiebaTags` | 旧版 ONNX / jieba 过渡 |

敏感内容改由 **设置 → 隐私空间 → 敏感内容隐藏** 控制，见 [privacy-and-sensitive-content.md](./privacy-and-sensitive-content.md)。

### 3.2 搜索（`settingData.search`）

| 字段 | 说明 |
|------|------|
| `useSemanticSearch` | 智能语义搜索（探索 / H5 筛选） |

---

## 4. 用户可见功能

### 4.1 探索与搜索

- 统一顶栏：评分筛选、语义搜索开关、AI 标签展示
- **找相似**：卡片菜单或右键，画面向量 + 文案融合排序
- 分析进度在 **设置 → AI** 页展示；大图分析前自动缩图、动态超时

### 4.2 合集

- **用户合集**：自然语言描述创建，支持编辑、画面语义检索（氛围型）
- **系统策展**：后台 K-Means 聚类 → LLM 按簇命名 → 语义剔图
- **猜你喜欢**：虚拟 Tab，分页推荐，桌面与 H5 均已接入

### 4.3 视频资源

- 有封面（poster）的视频可参与 AI 分析、找相似、系统策展
- 分析使用封面帧路径（`AiVisionResourcePath.mjs`）

### 4.4 省电与后台任务

- 仅 **电池 + 省电模式** 下暂停后台 AI / 视觉补算
- 关省电或插入电源后 `resumeBackgroundAiTasksIfAllowed` 自动恢复队列

---

## 5. 资源生命周期

删资源、清空资源库、刷新目录 prune 时，统一经 `resourceDeleteCleanup.mjs` 清理：

- `fbw_resource_ai`、文本/画面向量表
- 合集成员引用、FK 级联

工具页提供 **清空资源库**、**清空 AI 数据** 等操作（与 `DatabaseManager` 对齐）。

---

## 6. 代码锚点

| 模块 | 路径 |
|------|------|
| AI 分析 | `src/main/ai/AiAnalysisManager.mjs` |
| Provider | `src/main/ai/AiAnalysisProvider.mjs` |
| 文本/画面向量 | `src/main/ai/EmbeddingManager.mjs` |
| 找相似 | `src/main/ai/HybridSimilarSearch.mjs` |
| 画面向量 ONNX | `src/main/ai/ImageVisualEmbedder.mjs` |
| 向量存储 | `src/main/store/VecStore.mjs` |
| 自动策展 | `src/main/store/CollectionCurator.mjs` |
| 轻量推荐 | `src/main/store/RecommendManager.mjs` |
| AI 附表 SQL | `src/main/store/resourceAiSql.mjs` |
| 关联清理 | `src/main/store/resourceDeleteCleanup.mjs` |
| AI 设置 UI | `src/renderer/windows/MainWindow/pages/Setting/components/AiSetting.vue` |
| 合集页 | `src/renderer/windows/MainWindow/pages/Collections.vue` |

---

## 7. 相关文档

- [图像美学评分（ONNX Legacy）](./image-aesthetic-scoring.md)
- [敏感内容隐藏](./privacy-and-sensitive-content.md)
- [主进程](./main_process.md) · [渲染进程](./renderer_process.md)
- [H5 功能](./h5.md)

内置 MobileCLIP 模型下载：`npm run download:mobileclip2-s0`
