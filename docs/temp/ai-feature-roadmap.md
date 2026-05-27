# 飞鸟壁纸 AI 能力完整功能清单

> 文档版本：**v1.2**  
> 整理日期：2026-05-27  
> 状态：**2.0.0 核心已落地**；部分 P3/P4 仍为规划  
> 关联：[ai-dev-plan.md](./ai-dev-plan.md) · [README.md](./README.md)

**图例：** ✅ 已实现 · 🟡 部分实现 · ⬜ 未开始

---

## 1. 背景与目标

飞鸟壁纸 AI 2.0 目标：

1. 可配置本地/远程 AI 替代 ONNX 评分与 jieba 分词（legacy 开关过渡）
2. sqlite-vec 语义检索与相似图
3. **智能合集**独立菜单：用户自定义 + **系统自动策展**
4. 推荐、自动化、H5 文字能力

**明确不做：** H5 语音 STT；独立向量数据库进程；Sprint 5 OpenClaw（见 [openclaw-agent-integration.md](./openclaw-agent-integration.md)）

---

## 2. 已确认架构决策

| 决策项 | 结论 |
|--------|------|
| AI 接入 | 主进程 `AiAnalysisProvider` |
| 本地/远程 | Ollama + OpenAI 兼容（OpenRouter 等预设） |
| 向量 | sqlite-vec，失败 BLOB 降级 |
| 分析策略 | 按需 / 后台慢速 / 仅新图 |
| 智能合集 | 独立 `Collections` 菜单；`source=user` 自定义 + `source=auto` 系统 |
| 系统策展 | 标签聚类 + 向量 K-Means + LLM 合并命名 |

---

## 3. 基础设施

| 模块 | 状态 | 路径/说明 |
|------|------|-----------|
| AiAnalysisProvider | ✅ | `src/main/ai/AiAnalysisProvider.mjs` |
| AiAnalysisManager | ✅ | 队列、写库、tags、触发策展 |
| EmbeddingManager | ✅ | 分析后异步向量化 |
| VecStore | ✅ | sqlite-vec；DELETE+INSERT；维数迁移 |
| VectorCluster | ✅ | K-Means 氛围聚类 |
| CollectionCurator | ✅ | 自动策展三阶段 |
| TaskScheduler | ✅ | `aiAnalysis`、`collectionCurator`、`collectionsRefresh` |
| schemaUpgrade | ✅ | 旧库补列 `source` 等 |

### 设置项 `settingData.ai`（已实现字段）

`enabled`、`visionPreset`/`textPreset`、`visionModel`/`textModel`/`embeddingModel`、`timeout`（默认 120s）、`analysisMode`、`enableEmbedding`、`autoCollectionsEnabled`、`enableNsfwCheck`、`smartSearch`、`expandDownloadKeywords`、`runOnBattery`、`legacyOnnxScore`、`legacyJiebaTags`、`scoreMinFilter` 等。

---

## 4. 功能清单与实现状态

### 4.1 核心 AI 分析（P0）

| ID | 功能 | 状态 | 说明 |
|----|------|------|------|
| AI-001 | AI 美学评分 | ✅ | 写入 `score` |
| AI-002 | AI 标签 | ✅ | `applyTagsFromAnalysis` → `fbw_words` |
| AI-003 | 自动标题/描述 | ✅ | 分析 pipeline |
| AI-004 | summary | ✅ | 预览/搜索 |
| AI-005 | AiAnalysisProvider | ✅ | Ollama + OpenAI 兼容 |
| AI-006 | AI 设置页 | ✅ | `AiSetting.vue`：进度、模型刷新 toast |
| AI-007 | 分析任务队列 | ✅ | `background_slow` / `new_only` |
| AI-008 | embedding 入库 | ✅ | `EmbeddingManager` + `VecStore` |

### 4.2 发现与搜索（P1）

| ID | 功能 | 状态 | 说明 |
|----|------|------|------|
| AI-101 | 自然语言搜索 | ✅ | `TextQueryParser.parseSearchQuery` |
| AI-102 | 语义搜索 | ✅ | `semanticSearch` |
| AI-103 | 相似壁纸 | ✅ | `findSimilar` |
| AI-104 | 探索页 AI 元数据 | ✅ | score 标签 + **AI 已分析** 标识（`done` + 开启「显示标签」）；见 [ai-dev-plan.md](./ai-dev-plan.md) 验收 |
| AI-104+ | 探索页展示 AI tags/summary | ⬜ | v1.0 扩展项，**非 2.0 验收** |
| AI-105 | score 排序/筛选 | ✅ | Explore + `scoreMinFilter` |
| AI-106 | 智能搜索词建议 | ⬜ | 热词仍主要为插件 tags |
| AI-107 | 远程搜索关键词改写 | ⬜ | |

### 4.3 智能合集（P1）

| ID | 功能 | 状态 | 说明 |
|----|------|------|------|
| AI-201 | 合集独立菜单 | ✅ | `Collections.vue` |
| AI-202 | 合集 CRUD | ✅ | 含 `source` 字段 |
| AI-203 | 描述生成合集 | ✅ | 用户 NL → `queryJson` |
| AI-204 | 合集资源生成 | ✅ | 搜索快照 |
| AI-205 | 合集刷新 | ✅ | 手动；自定义定时 1h/6h/12h/24h；系统 `on_analysis` + 策展任务 |
| AI-206 | 合集转收藏 | ✅ | `addAllToFavorites` |
| AI-207 | 合集作自动切换源 | ⬜ | |
| AI-208a | 氛围型合集（系统策展） | ✅ | 向量 K-Means + LLM 合并命名，`CollectionCurator` |
| AI-208b | 氛围型合集（用户 NL 语义扩召回） | ⬜ | `queryJson.useSemantic` 已解析，`CollectionsManager.generate()` 未接入 `semanticSearch` |

#### 系统自动策展（AI-205+ 扩展，已实现）

| 能力 | 说明 |
|------|------|
| 标签候选 | 高频 AI 标签 → `tag:{标签}` |
| 向量候选 | K-Means → `vec:{n}` |
| LLM 合并 | 相近组合并命名；失败降级 |
| 重叠 | 多合集可含同一张图 |
| 可删 | 系统合集 `source=auto` 允许删除 |
| 数量 | 动态 3–12，见 `computeAutoCollectionCount` |

**数据表：**

```sql
fbw_collections (
  id, name, prompt, queryJson, resourceScope,
  limitCount, sortField, sortType,
  isPinned, refreshMode, source,  -- source: user | auto
  lastGeneratedAt, created_at, updated_at
)
```

**系统合集 `queryJson` 示例：**

```json
{
  "autoKey": "merged:tag:夜景+vec:0",
  "autoType": "merged",
  "mergeIds": ["tag:夜景", "vec:0"],
  "tags": ["夜景", "城市"],
  "semanticQuery": "赛博雨夜都市",
  "useSemantic": true
}
```

### 4.4 推荐与自动化（P2）

| ID | 功能 | 状态 | 说明 |
|----|------|------|------|
| AI-301 | 猜你喜欢 | 🟡 | `RecommendManager` 基础版 |
| AI-302 | 行为画像 | 🟡 | tags 统计推荐 |
| AI-303 | 智能自动切换 | 🟡 | smartSwitch 策略 |
| AI-304 | 自动下载扩词 | ✅ | `expandDownloadKeywords` |
| AI-305 | 下载后质检 | 🟡 | score/NSFW 部分 |
| AI-306 | 近重复检测 | ⬜ | |

### 4.5 安全与合规（P2）

| ID | 功能 | 状态 |
|----|------|------|
| AI-401 | NSFW 分析字段 | ✅ |
| AI-402 | 探索页安全筛选 | ✅ `enableNsfwCheck` |
| AI-403 | 自动切换排除不安全 | 🟡 |
| AI-404 | 隐私空间规则 | ⬜ |

### 4.6 交互与助手（P3）

| ID | 功能 | 状态 |
|----|------|------|
| AI-501～504 | AI 助手面板等 | ⬜ |
| AI-511 | H5 文字 NL 搜索 | ✅ |
| AI-512 | H5 AI 元数据 | 🟡 |
| AI-513 | H5 浏览合集 | 🟡 |

### 4.7～4.9（P3/P4）

文生图插件、Utils 图像工具、视频律动 AI、插件密钥助手等 — **⬜ 仍为规划**

---

## 5. 菜单与 IPC

### 菜单

| name | 页面 | 状态 |
|------|------|------|
| `Collections` | `Collections.vue` | ✅ |

### IPC（已实现节选）

| 通道 | 状态 |
|------|------|
| `main:analyzeResource` | ✅ |
| `main:getAiAnalysisStats` | ✅ |
| `main:listAiModels` | ✅ |
| `main:findSimilar` / `main:semanticSearch` | ✅ |
| `main:collections:*` | ✅ |
| `main:collections:curate` | ✅ |
| `main:collections:curatorStats` | ✅ |
| `main:assistant:*` | ⬜ |

---

## 6. 实施分期（更新后）

### Phase 0 — 基建 ✅

AiAnalysisProvider、AI 设置、分析队列、EmbeddingManager、VecStore

### Phase 1 — 核心体验 ✅

探索 AI 元数据、NL/语义/相似搜索、**智能合集（含自动策展）**

### Phase 2 — 自动化与安全 🟡

Recommend、smartSwitch、扩词、NSFW；去重/H5 部分

### Phase 3 — 助手与 AIGC ⬜

AI 助手、AIGC 工具

### Phase 4 — 增强 ⬜

视频律动 AI、插件生态

---

## 7. 非功能需求

| 项 | 要求 | 现状 |
|----|------|------|
| 隐私 | 远程上传须明示 | 设置中有 `allowRemoteImageUpload` |
| 性能 | 扫描不阻塞；VLM 并发 1 | ✅ |
| 容错 | AI 失败不阻断入库 | ✅；LLM 合并失败降级 |
| 可观测 | pino 日志 | ✅ |
| i18n | 错误友好化 | ✅ `aiErrorUtils` |

---

## 8. 风险与待验证

| 风险 | mitigation |
|------|------------|
| OpenRouter 429 | 换模型/充值；分析未完成则无法策展 |
| sqlite-vec 绑定 | BLOB 降级已验证路径 |
| VLM 慢 | 后台 5min×5 张 |
| JSON 不稳定 | Prompt + 解析 + 降级 |
| vec0 UPSERT | 已改为 DELETE+INSERT |

---

## 9. 功能统计（实现进度）

| 优先级 | 规划数 | 已实现/部分 |
|--------|--------|-------------|
| P0 | 8 | 8 ✅ |
| P1 | 15+2 子项 | 14 ✅ / 2 ⬜（AI-104+、AI-208b） |
| P2 | 10 | 4 ✅ / 4 🟡 / 2 ⬜ |
| P3+ | 15 | 少量 🟡 |

---

## 10. 相关文档

- [ai-dev-plan.md](./ai-dev-plan.md) — 开发与验收
- [openclaw-agent-integration.md](./openclaw-agent-integration.md) — Agent 规划（未编码）
- [README.md](./README.md) — 本目录索引

---

## 11. 修订记录

| 版本 | 日期 | 说明 |
|------|------|------|
| v1.0 | 2026-05-26 | 初稿 48 项功能规划 |
| v1.1 | 2026-05-27 | 标注实现状态；补充自动策展、VecStore、IPC；更新分期进度 |
| **v1.2** | 2026-05-27 | AI-104 按 dev-plan 标 ✅；AI-208 拆为 208a/208b；AI-104+ 标为后续增强 |
