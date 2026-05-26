# 飞鸟壁纸 AI 能力完整功能清单

> 文档版本：v1.0  
> 整理日期：2026-05-26  
> 状态：规划稿（待评审 / 待排期）  
> 关联项目：`Flying-Bird-Wallpaper`（主应用）、`Flying-Bird-Wallpaper-Plugins`（资源插件）

---

## 1. 背景与目标

飞鸟壁纸当前已具备：

- 本地 SQLite 资源库 + 远程资源插件（搜索 / 下载）
- ONNX 美学评分（`picture_score_fp16.onnx` + `onnxruntime-node`）
- jieba 分词词库（`@node-rs/jieba` → `fbw_words`）
- 探索 / 收藏 / 回忆 / 词库 / 设置 / 工具 / H5 控制端

**AI 升级目标：**

1. 用可配置的本地 / 远程 AI 统一替代 ONNX 评分与 jieba 分词
2. 增强发现、推荐、自动化与工具能力
3. 引入 **sqlite-vec** 为语义检索与相似图预留空间，兼顾当前性能与未来扩展
4. **智能合集** 作为独立侧栏菜单，与收藏、词库区分开

**明确不做：**

- H5 **不支持**语音转文字（无 STT）
- 不引入独立向量数据库进程（Chroma / Qdrant 等）；向量检索统一走 **SQLite + sqlite-vec**

---

## 2. 已确认架构决策

| 决策项      | 结论                                                                                        |
| ----------- | ------------------------------------------------------------------------------------------- |
| AI 接入形态 | 主进程 `AiAnalysisProvider`（Provider 工厂 + 统一配置）                                     |
| 本地推理    | 优先 **Ollama**；同时支持 **OpenAI 兼容 API**（LM Studio、llama-server、LocalAI、远程 API） |
| 视觉模型    | 默认推荐 `qwen2.5vl:7b`（中文标签）；低配 `moondream`；备选 `llama3.2-vision`、`llava`      |
| 文本模型    | 独立小模型处理 NL 解析、助手对话、关键词扩展（不必每张图都跑 VLM）                          |
| 向量存储    | **sqlite-vec** 扩展，向量与业务数据同库                                                     |
| 分析策略    | 按需分析 + 后台低速队列 + 仅新图；笔记本省电 / 仅 Wi-Fi 可降级                              |
| 智能合集    | 独立菜单 `Collections`，非探索页子功能                                                      |
| 遗留能力    | ONNX 美学分、jieba 分词 **计划移除**（可保留 legacy 开关一个版本）                          |

---

## 3. 基础设施（必须先于业务功能）

### 3.1 AiAnalysisProvider

**职责：** 统一图像 / 文本 AI 调用、配置读取、任务队列、错误重试、结构化输出解析。

**Provider 类型：**

| Provider            | 说明                                      |
| ------------------- | ----------------------------------------- |
| `none`              | 关闭 AI，score=0，不写 tags               |
| `ollama`            | 默认本地，`baseUrl` + `model`             |
| `openai-compatible` | 通用 HTTP，`baseUrl` + `model` + `apiKey` |
| `onnx-legacy`       | 可选保留一版，后续删除                    |

**图像分析标准输出（JSON）：**

```json
{
  "score": 82,
  "tags": ["夜景", "城市", "霓虹", "赛博朋克"],
  "title": "雨夜都市街景",
  "desc": "蓝紫色调的城市夜景，适合深色桌面",
  "summary": "一句话摘要，供预览与助手使用",
  "nsfwLevel": 0,
  "safeForWork": true
}
```

**文本 LLM 用途：** NL 搜索解析、智能合集 `queryJson` 生成、自动下载关键词扩展、助手 function calling。

### 3.2 设置项（`settingData.ai` 建议结构）

```json
{
  "ai": {
    "enabled": true,
    "visionProvider": "ollama",
    "textProvider": "ollama",
    "visionBaseUrl": "http://127.0.0.1:11434",
    "textBaseUrl": "http://127.0.0.1:11434",
    "visionModel": "qwen2.5vl:7b",
    "textModel": "qwen2.5:7b",
    "apiKey": "",
    "timeout": 60000,
    "concurrency": 1,
    "analysisMode": "on_demand",
    "enableNsfwCheck": false,
    "enableEmbedding": true,
    "embeddingModel": "qwen2.5vl:7b",
    "runOnBattery": false,
    "runOnWifiOnly": false
  }
}
```

`analysisMode` 枚举：`off` | `on_demand` | `background_slow` | `new_only`

### 3.3 sqlite-vec 集成

**目标：**

- 语义相似图、语义搜索、智能合集「氛围匹配」、未来 RAG 助手
- 与 `better-sqlite3` 同进程，无额外服务

**建议表结构：**

```sql
-- 资源向量（sqlite-vec 虚拟表或 vec0 表，以实际选型为准）
CREATE TABLE IF NOT EXISTS fbw_resource_embeddings (
  resourceId INTEGER PRIMARY KEY,
  model TEXT NOT NULL,
  dim INTEGER NOT NULL,
  updated_at DATETIME DEFAULT (datetime('now', 'localtime'))
);

-- 向量列由 sqlite-vec 扩展管理，例如：
-- CREATE VIRTUAL TABLE fbw_vec_index USING vec0(embedding float[N]);
```

**写入时机：** 图像 AI 分析成功后异步生成 embedding 并 upsert。

**检索场景：**

| 场景             | 检索方式                                    |
| ---------------- | ------------------------------------------- |
| 找相似（单张）   | KNN，`resourceId` 为 query                  |
| 语义搜索         | 文本 embedding → KNN → 与 tags/SQL 结果融合 |
| 智能合集（进阶） | query 文本向量 + 结构化 filter 交集         |

**依赖：** 新增 npm 包 / 原生扩展（sqlite-vec 与 better-sqlite3 绑定方案需在 spike 阶段验证）。

### 3.4 任务调度

- 与现有 `TaskScheduler`、`FileManager` 扫描队列、`WordsManager` 定时任务统一
- 分析 / embedding 共用队列，可暂停、可断点续跑
- 子进程 `file_server` 中 **不再** 调用 ONNX；重计算放主进程或独立 worker 子进程（避免阻塞扫描）

### 3.5 计划移除的依赖

| 现有                                           | 替代                        |
| ---------------------------------------------- | --------------------------- |
| `onnxruntime-node` + `picture_score_fp16.onnx` | AiAnalysisProvider 视觉评分 |
| `@node-rs/jieba`                               | AI tags → `fbw_words`       |
| `ImageScorer.mjs`                              | 删除或标记 deprecated       |
| `WordsManager.cutWords()` jieba 分支           | 消费 AI tags                |

---

## 4. 完整功能清单

说明：

- **优先级**：P0 必做 → P4 可选
- **状态**：规划中 / 未开始
- **向量**：是否依赖 sqlite-vec

---

### 4.1 核心 AI 分析（P0）

| ID     | 功能                | 说明                                                | 接入点                                 | 向量   |
| ------ | ------------------- | --------------------------------------------------- | -------------------------------------- | ------ |
| AI-001 | AI 美学评分         | 替代 ONNX，写入 `fbw_resources.score`               | `FileManager` / `calculateImageByPath` | 否     |
| AI-002 | AI 标签             | 替代 jieba，写入 `fbw_words` + `fbw_resource_words` | `WordsManager`                         | 否     |
| AI-003 | 自动标题 / 描述     | 补全 `title`、`desc`，改善本地库可搜性              | 同 AI 分析 pipeline                    | 否     |
| AI-004 | 摘要 summary        | 预览窗、列表 tooltip、助手上下文                    | 同 pipeline                            | 否     |
| AI-005 | AiAnalysisProvider  | Provider 抽象 + 配置页                              | `src/main/` 新 Manager                 | 否     |
| AI-006 | AI 设置页           | 模型、URL、模式、省电策略                           | `Setting` 新组件                       | 否     |
| AI-007 | 分析任务队列        | 按需 / 后台 / 仅新图                                | `TaskScheduler`                        | 否     |
| AI-008 | 资源 embedding 入库 | 分析后写 sqlite-vec                                 | 新 `EmbeddingManager`                  | **是** |

---

### 4.2 发现与搜索（P1）

| ID     | 功能                 | 说明                                | 接入点                         | 向量   |
| ------ | -------------------- | ----------------------------------- | ------------------------------ | ------ |
| AI-101 | 自然语言搜索         | 「蓝紫赛博城市横屏 4K」→ 搜索参数   | `ResourcesManager.search` 前   | 可选   |
| AI-102 | 语义搜索             | 文本描述 → embedding KNN + SQL 过滤 | `ResourcesManager` 新接口      | **是** |
| AI-103 | 相似壁纸             | 探索 / 预览「找相似」               | `findSimilar(resourceId)`      | **是** |
| AI-104 | 探索页 AI 元数据展示 | score、tags、summary 标签           | `ExploreCommon.vue`            | 否     |
| AI-105 | 按 score 排序 / 筛选 | 启用已有字段                        | `sortFieldOptions` + 筛选 UI   | 否     |
| AI-106 | 智能搜索词建议       | 基于全库 tags 聚合 + LLM 推荐       | 探索页热词区                   | 否     |
| AI-107 | 远程搜索关键词改写   | 中文意图 → 插件 API 英文 keywords   | `ResourcesManager` remote 分支 | 否     |

---

### 4.3 智能合集（P1，独立菜单）

| ID     | 功能             | 说明                                  | 接入点                                    | 向量   |
| ------ | ---------------- | ------------------------------------- | ----------------------------------------- | ------ |
| AI-201 | 合集独立菜单     | 侧栏 `Collections`，可 `canBeEnabled` | `publicData.menuList` + `Collections.vue` | 否     |
| AI-202 | 合集 CRUD        | 创建 / 编辑 / 删除 / 固定             | `CollectionsManager` + IPC                | 否     |
| AI-203 | 描述生成合集     | 用户输入自然语言 → `queryJson`        | 文本 LLM                                  | 否     |
| AI-204 | 合集资源生成     | SQL + tags + score 筛选 → 快照列表    | `ResourcesManager.search`                 | 否     |
| AI-205 | 合集刷新         | 手动刷新 / 扫描后刷新 / 定时（可选）  | `CollectionsManager`                      | 否     |
| AI-206 | 合集转收藏       | 整组加入收藏                          | 复用 `addToFavorites`                     | 否     |
| AI-207 | 合集作自动切换源 | 设为 `wallpaperResource` 扩展类型     | `WallpaperManager`                        | 否     |
| AI-208 | 氛围型合集       | 基于 query 文本 embedding 扩召回      | 合集生成逻辑                              | **是** |

**数据表：**

```sql
fbw_collections (
  id, name, prompt, queryJson, resourceScope,
  limitCount, sortField, sortType,
  isPinned, refreshMode, lastGeneratedAt,
  created_at, updated_at
)

fbw_collection_items (
  id, collectionId, resourceId, rank, generated_at
)
```

**`queryJson` 示例：**

```json
{
  "filterKeywords": "",
  "tags": ["夜景", "城市"],
  "tagsMode": "any",
  "orientation": ["landscape"],
  "quality": ["4k", "2k"],
  "scoreMin": 70,
  "scoreMax": 100,
  "resourceName": "resources",
  "isRandom": false,
  "sortField": "score",
  "sortType": -1,
  "semanticQuery": "赛博朋克雨夜",
  "useSemantic": true
}
```

---

### 4.4 推荐与自动化（P2）

| ID     | 功能               | 说明                                  | 接入点                           | 向量 |
| ------ | ------------------ | ------------------------------------- | -------------------------------- | ---- |
| AI-301 | 猜你喜欢           | 基于 statistics + tags + 主色规则推荐 | 探索页新 tab 或侧栏              | 可选 |
| AI-302 | 行为画像（轻量）   | 最近设壁纸 / 收藏提炼偏好 tags        | `RecommendManager`               | 否   |
| AI-303 | 智能自动切换       | 时段 / 主色 / 去重最近 id             | `WallpaperManager.nextWallpaper` | 可选 |
| AI-304 | 自动下载关键词扩展 | LLM 扩展 `downloadKeywords`           | `WallpaperManager` autoDownload  | 否   |
| AI-305 | 下载后质检         | 低 score / NSFW 不入库或归档          | `searchWallpaperWithDownload` 后 | 否   |
| AI-306 | 重复 / 近重复检测  | 感知哈希 +（可选）向量距离            | `FileManager` / Utils            | 可选 |

---

### 4.5 安全与合规（P2）

| ID     | 功能                 | 说明                                | 接入点               | 向量 |
| ------ | -------------------- | ----------------------------------- | -------------------- | ---- |
| AI-401 | NSFW / 内容安全      | 分析时写 `nsfwLevel`、`safeForWork` | AiAnalysis 输出      | 否   |
| AI-402 | 探索页安全筛选       | 隐藏 / 模糊不安全内容               | `ExploreCommon` 筛选 | 否   |
| AI-403 | 自动切换排除不安全   | 家庭模式                            | `WallpaperManager`   | 否   |
| AI-404 | 隐私空间规则（可选） | 按 tag 自动建议或移入隐私库         | 隐私空间 IPC         | 否   |

---

### 4.6 交互与助手（P3）

| ID     | 功能             | 说明                                             | 接入点                   | 向量 |
| ------ | ---------------- | ------------------------------------------------ | ------------------------ | ---- |
| AI-501 | AI 助手面板      | 对话找壁纸、设壁纸、管理合集                     | 主窗新侧栏 / 浮层        | 可选 |
| AI-502 | Function Calling | 映射 search / setWallpaper / favorites IPC       | `AiAssistantManager`     | 否   |
| AI-503 | 预览窗智能说明   | `ViewImageWindow` 展示 summary / tags / 推荐理由 | 打开预览时读库或按需分析 | 否   |
| AI-504 | 桌面可读性提示   | 明暗分布 / 图标区域是否可读                      | 设壁纸前提示             | 否   |

**H5 范围（无语音）：**

| ID     | 功能                    | 说明                                   | 向量 |
| ------ | ----------------------- | -------------------------------------- | ---- |
| AI-511 | H5 文字 NL 搜索         | 输入描述 → 解析 → `/api/search/images` | 否   |
| AI-512 | H5 展示 AI 元数据       | score、tags、summary                   | 否   |
| AI-513 | H5 浏览智能合集（可选） | 只读展示桌面端生成的合集               | 否   |

---

### 4.7 内容生成与图像工具（P3）

| ID     | 功能             | 说明                             | 接入点                      | 向量 |
| ------ | ---------------- | -------------------------------- | --------------------------- | ---- |
| AI-601 | 文生图资源插件   | `search(prompt)` 实为生成        | Plugins 仓库新插件          | 否   |
| AI-602 | 图生图 / 风格化  | Utils 选图 → API → 入库 / 设壁纸 | `Utils.vue`                 | 否   |
| AI-603 | AI 超分          | 设壁纸前或 Utils 放大            | sharp + 外部 API / 本地模型 | 否   |
| AI-604 | AI 扩图          | 超宽屏 outpainting               | Utils                       | 否   |
| AI-605 | 智能配色纯色壁纸 | 由当前壁纸 / AI 推荐生成渐变色   | `setColorWallpaper`         | 否   |

---

### 4.8 视频与律动（P4）

| ID     | 功能              | 说明                         | 接入点                   | 向量 |
| ------ | ----------------- | ---------------------------- | ------------------------ | ---- |
| AI-701 | 视频关键帧 / 封面 | 列表缩略图优化               | `FileManager` video 分支 | 否   |
| AI-702 | 视频最佳循环点    | 动态壁纸 loop 优化           | `DynamicWallpaperWindow` | 否   |
| AI-703 | 律动壁纸 AI 配色  | 根据静态壁纸主色生成特效参数 | `RhythmWallpaperWindow`  | 否   |

---

### 4.9 插件生态与开发（P4）

| ID     | 功能                 | 说明                             | 接入点                  | 向量 |
| ------ | -------------------- | -------------------------------- | ----------------------- | ---- |
| AI-801 | 插件密钥配置助手     | 引导申请 Key + 连通性检测        | `PluginMarketplace.vue` | 否   |
| AI-802 | 插件开发 skills 增强 | 已有 create/modify/review skills | Plugins 仓库            | 否   |

---

## 5. 菜单与导航变更

### 5.1 新增菜单

| name          | title    | canBeEnabled | 页面                    |
| ------------- | -------- | ------------ | ----------------------- |
| `Collections` | 智能合集 | true         | `pages/Collections.vue` |

建议顺序：`Search` → `Collections` → `Words`（或 AI 改标签后改名为「标签」）→ `Favorites` → `History` → …

### 5.2 设置页新增

- **AI 设置**：Provider、模型、分析模式、embedding、隐私与省电
- **可选**：词库菜单改名为「标签库」（仅文案，数据结构可不变）

### 5.3 IPC 建议（节选）

| 通道                                           | 说明                    |
| ---------------------------------------------- | ----------------------- |
| `main:analyzeResource`                         | 按需分析单张            |
| `main:getAiSettings` / `main:updateAiSettings` | AI 配置                 |
| `main:findSimilar`                             | 相似壁纸（sqlite-vec）  |
| `main:parseSearchQuery`                        | NL → 搜索参数           |
| `main:collections:*`                           | 合集 CRUD / 生成 / 刷新 |
| `main:assistant:chat`                          | 助手对话（P3）          |

H5 对应 REST 扩展见 `h5_server/api/business.mjs`。

---

## 6. 数据库变更汇总

| 表 / 扩展                                  | 用途                                                          |
| ------------------------------------------ | ------------------------------------------------------------- |
| `fbw_resources`                            | 可选增 `aiAnalyzedAt`、`nsfwLevel`；沿用 score / title / desc |
| `fbw_words`                                | 存 AI tags（word 字段语义变为 tag）                           |
| `fbw_resource_embeddings` + **sqlite-vec** | 向量索引                                                      |
| `fbw_collections`                          | 智能合集定义                                                  |
| `fbw_collection_items`                     | 合集快照成员                                                  |
| `fbw_sys`                                  | `settingData.ai` 配置                                         |

**迁移：** 通过 `VersionManager` 递增 DB 版本；旧 score 可保留；旧 jieba 词库可一键清空后按 AI 重建。

---

## 7. 实施分期

### Phase 0 — 基建（2～3 周量级，视 spike 而定）

- [ ] AiAnalysisProvider（Ollama + OpenAI 兼容）
- [ ] AI 设置页 + `settingData.ai`
- [ ] 替代 ONNX 评分、jieba 标签（AI-001～007）
- [ ] sqlite-vec spike + EmbeddingManager（AI-008）
- [ ] 分析任务队列与省电策略

### Phase 1 — 核心体验

- [ ] 探索页 AI 元数据、score 排序筛选（AI-104、105）
- [ ] 自然语言搜索（AI-101）
- [ ] 相似壁纸 + 语义搜索（AI-102、103）
- [ ] **智能合集独立菜单** 全链路（AI-201～207）
- [ ] title / desc / summary 入库（AI-003、004）

### Phase 2 — 自动化与安全

- [ ] 猜你喜欢、智能自动切换（AI-301～303）
- [ ] 自动下载扩词 + 质检（AI-304、305）
- [ ] NSFW 筛选（AI-401～403）
- [ ] 去重工具（AI-306）
- [ ] H5 文字 NL 搜索 + 元数据展示（AI-511、512）

### Phase 3 — 助手与 AIGC

- [ ] AI 助手 + function calling（AI-501、502）
- [ ] 预览窗说明、可读性提示（AI-503、504）
- [ ] 文生图插件、Utils 图像工具（AI-601～605）
- [ ] 合集氛围语义召回（AI-208）

### Phase 4 — 增强与生态

- [ ] 视频 / 律动 AI（AI-701～703）
- [ ] 插件密钥助手（AI-801）
- [ ] 移除 `onnxruntime-node`、`@node-rs/jieba` 及 legacy 代码

---

## 8. 非功能需求

| 项     | 要求                                                  |
| ------ | ----------------------------------------------------- |
| 隐私   | 远程 API 上传图片须明示；默认本地 Ollama              |
| 性能   | 扫描路径不阻塞；VLM 并发默认 1                        |
| 容错   | AI 失败不阻断入库；score=0、tags 空可重试             |
| 可观测 | pino 记录 provider、耗时、失败原因（不记录 apiKey）   |
| 国际化 | 标签 / summary 支持 zh-CN 优先；设置与错误信息走 i18n |
| 兼容   | Win / macOS / Linux；sqlite-vec 需验证各平台预编译包  |

---

## 9. 风险与待验证项

| 风险                              | mitigation                                  |
| --------------------------------- | ------------------------------------------- |
| sqlite-vec 与 better-sqlite3 绑定 | Phase 0 spike，失败则降级 BLOB + 暴力 KNN   |
| VLM 太慢                          | 按需优先；全库后台限速                      |
| JSON 输出不稳定                   | prompt + 重试 + zod 校验                    |
| 模型未安装                        | 设置页检测 Ollama / 模型 pull 状态          |
| 包体积                            | 移除 ONNX 后略减；sqlite-vec 原生扩展需评估 |

---

## 10. 功能总览（按优先级统计）

| 优先级   | 功能数 | 范围                               |
| -------- | ------ | ---------------------------------- |
| P0       | 8      | 核心 AI 分析 + embedding + 基建    |
| P1       | 15     | 搜索、相似、语义、**智能合集菜单** |
| P2       | 10     | 推荐、自动化、安全、H5 文字        |
| P3       | 9      | 助手、AIGC、图像工具               |
| P4       | 6      | 视频律动、插件生态                 |
| **合计** | **48** | —                                  |

---

## 11. 相关文档

- [外部 Agent 平台集成分析（OpenClaw / MCP 等）](./openclaw-agent-integration.md)

---

## 12. 修订记录

| 版本 | 日期       | 说明                                                                 |
| ---- | ---------- | -------------------------------------------------------------------- |
| v1.0 | 2026-05-26 | 初稿：整合 AI 规划讨论；确认 sqlite-vec、智能合集独立菜单、H5 无语音 |
