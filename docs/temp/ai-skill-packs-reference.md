# AI Skill Pack 参考手册

> 版本：manifest `1.1.0` · 文档日期：2026-06-08  
> 资源目录：`resources/ai/skills/` · 架构背景见 [ai-prompt-skills-architecture.md](./ai-prompt-skills-architecture.md)

---

## 1. 什么是 Skill Pack

Skill Pack 是本应用 AI 任务的**可版本化配置包**，替代原先散落在 12 语言 i18n 里的超长 prompt 与 `AiResponseParser` 内联 normalize 逻辑。

每个 Pack 由四件套组成：

| 文件             | 职责                                                       |
| ---------------- | ---------------------------------------------------------- |
| `pack.json`      | 元数据：id、版本、模型类型、文件引用、profile 开关         |
| `SKILL.md`       | Prompt 正文（**英文单语源**）；运行时插值 `{query}` 等变量 |
| `schema.json`    | 输出 JSON 形状约束（类型、长度、枚举）                     |
| `normalize.json` | 入库前归一化：defaults、repairs、hooks、pipeline 类型      |

可选：

| 路径                                   | 职责                                   |
| -------------------------------------- | -------------------------------------- |
| `profiles/<name>/SKILL.patch.md`       | 追加 prompt 片段（如更保守 nsfw 说明） |
| `profiles/<name>/normalize.patch.json` | 合并额外 repairs / defaults            |

**执行管线（热路径，无 Agent）：**

```text
buildSkillPrompt(packId) → LLM 单次调用 → extractJsonObject
  → schema 约束 → normalize.json → hooks → 业务入库 / 返回
```

---

## 2. Pack 总览

| packId                    | 类型     | 版本  | 模型     | 是否持久化            | 主要入口           |
| ------------------------- | -------- | ----- | -------- | --------------------- | ------------------ |
| `image-analysis`          | vision   | 1.0.0 | 视觉模型 | ✅ `fbw_resource_ai`  | 后台/按需分析图片  |
| `video-poster-analysis`   | vision   | 1.0.0 | 视觉模型 | ✅ 同上               | 分析视频封面帧     |
| `search-parse`            | text     | 1.0.0 | 文本模型 | ❌ 即时查询           | 探索页 NL 搜索     |
| `collection-query`        | text     | 1.0.0 | 文本模型 | ❌ 写入合集 queryJson | 用户创建智能合集   |
| `collection-tag-expand`   | text     | 1.0.0 | 文本模型 | ❌                    | 系统策展标签扩展   |
| `keyword-expand`          | text     | 1.0.0 | 文本模型 | ❌                    | 自动下载关键词扩展 |
| `collection-naming`       | text     | 1.0.0 | 文本模型 | ❌ 写入合集 name      | 系统策展 LLM 命名  |
| `auto-collection-storage` | template | 1.0.0 | 无 LLM   | ❌                    | 合集降级入库字符串 |

**设置项（全局）：**

- `settingData.ai.promptProfile`：`default` | `strict-nsfw` 等（设置页「内容分级策略」）
- `settingData.ai.packOverrides`：预留锁定 pack 版本；**Loader 尚未读取**

**Vision 分析元数据（已入库）：** `fbw_resource_ai.analysisMeta` JSON，含 `packId`、`packVersion`、`normalizeVersion`、`profile`；`rawLlmJson` 供 Phase D 离线重放。

---

## 3. 各 Pack 详解

### 3.1 `image-analysis` — 静态壁纸视觉分析

**用途**：对单张图片做美学评分、检索文案、标签与敏感内容分级，结果写入 `fbw_resource_ai` 并驱动标签库、文本/画面向量。

**触发场景**：

- 用户点击「AI 分析」
- 后台分析队列（`background_slow` / `new_only`）
- H5 远程分析接口

**代码路径**：

- Prompt：`AiPrompts.buildImageAnalysisPrompt` → `SkillPackRegistry.buildSkillPrompt`
- 调用：`AiAnalysisProvider.analyzeImage` → `AiAnalysisManager.analyzeResourceRow`
- Normalize：`AiResponseParser.normalizeAnalysisResultWithMeta` → pipeline `analysis-result`

**Prompt 要点（`SKILL.md`）**：

| 字段          | 语义                     | 长度建议     |
| ------------- | ------------------------ | ------------ |
| `title`       | 短标题，主体 + 场景      | ≤40 字       |
| `summary`     | 检索用一句话，不写用途   | ≤80 字       |
| `desc`        | 给人看的可见内容详述     | 120–220 字   |
| `tags`        | 检索标签，与 UI 语言一致 | 3–10 个      |
| `score`       | 美学综合分               | 1–100        |
| `nsfwLevel`   | 敏感分级 0–3             | 见 rubric    |
| `safeForWork` | 是否适合办公场景         | 与 nsfw 联动 |

**输出语言**：Prompt 末尾自动追加 `outputLocaleFooter`（由 `outputLocale.mjs` 根据界面语言生成），要求 `title/summary/desc/tags` 使用用户界面语言，**无需 12 份 SKILL 翻译**。

**schema.json**：约束各字段类型与 maxLength / maxItems。

**normalize.json**（pipeline: `analysis-result`）：

- 字段截断：score 0–100，tags ≤12，title ≤120 等
- **repairs `nsfw-safeForWork`**（机器强制执行，与 prompt 说明互补）：
  - `safeForWork=false` 且 `nsfwLevel<2` → 提升 `nsfwLevel` 至 2
  - `nsfwLevel≥2` → 强制 `safeForWork=false`
  - `nsfwLevel=0` → 强制 `safeForWork=true`
  - `nsfwLevel=1` 且 `safeForWork=false` → 提升 `nsfwLevel` 至 2

**入库副作用**（`AiAnalysisManager`）：

- 更新 `aiTitle / aiDesc / summary / aiScore / nsfwLevel / safeForWork`
- `WordsManager.applyTagsFromAnalysis` 写标签关联
- `EmbeddingManager` 异步更新文本向量与画面向量

**示例输出**：

```json
{
  "score": 82,
  "tags": ["night", "city", "neon", "rain", "blue"],
  "title": "Rainy city skyline",
  "summary": "Night cityscape after rain, towers and wet reflections",
  "desc": "Wide skyline with neon reflections on wet pavement, cinematic calm mood.",
  "nsfwLevel": 0,
  "safeForWork": true
}
```

---

### 3.2 `video-poster-analysis` — 视频壁纸封面帧分析

**用途**：动态壁纸仅分析**封面帧**（非完整视频），输出形状与 `image-analysis` 相同。

**与 image-analysis 的差异**：

| 项                | 说明                                                    |
| ----------------- | ------------------------------------------------------- |
| Prompt            | 强调「仅封面帧、勿推断动态/声音」                       |
| `normalizePackId` | 复用 `image-analysis` 的 normalize（nsfw repairs 一致） |
| packId            | 单独记录，便于统计与 future prompt 分化                 |

**触发**：`row.fileType === 'video'` 时 `AiAnalysisProvider` 选用本 pack。

**配置**：

```json
{
  "id": "video-poster-analysis",
  "normalizePackId": "image-analysis",
  "outputLocaleFooter": true
}
```

---

### 3.3 `search-parse` — 自然语言搜索解析

**用途**：将用户探索页输入的自然语言（如「横屏 4K 海洋」）解析为结构化搜索参数。

**触发**：`TextQueryParser.parseSearchQuery`

**Prompt 变量**：`{query}` — 用户原始输入

**输出字段**：

| 字段                    | 说明                          |
| ----------------------- | ----------------------------- |
| `filterKeywords`        | 核心关键词字符串              |
| `tags`                  | 标签数组，可空                |
| `orientation`           | `[1]` 横屏 / `[0]` 竖屏，可空 |
| `quality`               | 仅 `8K/5K/4K/2K`，可空        |
| `filterType`            | `images` / `videos` / `""`    |
| `scoreMin` / `scoreMax` | 分数区间或 null               |

**normalize**（pipeline: `search-params`）：

- `filterType` 规范化（兼容 `fileType` 别名）
- `orientation` → `normalizeOrientationToIsLandscape`
- `quality` → `normalizeCollectionQuality`（过滤非法分辨率写法）
- `scoreMin/Max` clamp 0–100

**降级**：AI 未启用或解析失败 → 仅 `{ filterKeywords: query.trim() }`

**示例**：

```json
{
  "filterKeywords": "ocean",
  "tags": ["ocean", "blue"],
  "orientation": [1],
  "quality": ["4K"],
  "filterType": "images",
  "scoreMin": null,
  "scoreMax": null
}
```

---

### 3.4 `collection-query` — 智能合集查询 JSON

**用途**：用户用自然语言描述想要的合集（如「随机 20 张赛博朋克夜景」），解析为 `queryJson` 供 `CollectionsManager` 持久化。

**触发**：`TextQueryParser.parseCollectionPrompt`

**Prompt 变量**：`{prompt}`

**输出字段**：

| 字段                | 说明                             |
| ------------------- | -------------------------------- |
| `filterKeywords`    | 核心检索词                       |
| `tags` / `tagsMode` | 标签及 any/all 模式              |
| `quality`           | 分辨率，默认空（除非用户明确要） |
| `resourceName`      | 固定 `"resources"`（全库）       |
| `isRandom`          | 是否随机                         |
| `sortField`         | `score` / `created_at` / `views` |
| `sortType`          | `-1` 降序 / `1` 升序             |
| `semanticQuery`     | 语义检索短语                     |
| `useSemantic`       | 是否启用语义搜索                 |
| `limitCount`        | 5–50                             |

**normalize**（pipeline: `collection-query`）：

- **defaultsMode: force** 强制默认值：
  - `resourceName: "resources"`
  - `tagsMode: "any"`
  - `sortField: "score"`, `sortType: -1`, `orientation: []`
- **ignoreFromModel**：丢弃模型输出的 `scoreMin`、`orientation`（最低分由应用 AI 设置决定）
- `limitCount` clamp 5–50
- `quality` 合法化

**降级**：解析失败 → 用用户原文作 `filterKeywords` + `semanticQuery`

---

### 3.5 `collection-tag-expand` — 合集标签同义扩展

**用途**：系统策展时，对单个主题词扩展同义/相关标签，提高召回。

**触发**：`TextQueryParser.expandCollectionKeywordTags`

**Prompt 变量**：`{keyword}`

**输出**：

```json
{ "tags": ["tag1", "tag2", ...] }
```

最多 8 项；语言与资源 AI 标签 / UI 一致。

**normalize**（pipeline: `tags-list`）：trim、去空、截断至 8 条。

**后处理**（代码层，非 pack）：与原词合并去重，最多 16 条返回。

---

### 3.6 `keyword-expand` — 下载关键词扩展

**用途**：自动壁纸下载任务中，扩展用户/规则给出的关键词列表。

**触发**：`TextQueryParser.expandDownloadKeywords`（需 `ai.expandDownloadKeywords` 开启；开关位于 **基础设置 → 远程资源 → 扩展关键词**）

**Prompt 变量**：`{keywords}` — JSON 字符串形式的输入数组

**输出**：

```json
{ "keywords": ["word1", "word2", ...] }
```

最多 10 项。

**normalize**（pipeline: `keywords-list`）：截断至 10 条。

**后处理**：与输入关键词合并去重，最多 20 条。

---

### 3.7 `collection-naming` — 系统策展簇命名

**用途**：自动策展（`CollectionCurator`）对画面向量聚类后，为**每个簇单独**生成氛围化短标题，禁止跨簇合并语料。

**触发**：`CollectionCurator.nameWithLlm` → `buildCollectionNamingPrompt`

**Prompt 变量**：

| 变量                            | 来源                                              |
| ------------------------------- | ------------------------------------------------- |
| `{targetCount}`                 | 目标合集数量上限                                  |
| `{nameMinLen}` / `{nameMaxLen}` | `collectionConstants` 命名长度                    |
| `{uiLocale}`                    | 当前界面语言                                      |
| `{candidates}`                  | JSON：每簇 id、count、tags、titleSamples、samples |

**模型输出格式**：

```json
{
  "collections": [
    {
      "id": "vec:0",
      "name": "Alpine Lakes",
      "prompt": "One-line mood for this group",
      "semanticQuery": "Phrase for semantic search"
    }
  ]
}
```

**normalize**（pipeline: `collection-naming-plan`）：

- Hook：`collectionNamingPlan`（`normalizeHooks.mjs`）
- 校验：簇 id 必须来自输入；`name` 长度与 locale 匹配；`validateCollectionTitleAgainstHints`
- 未覆盖簇：用 `resolveAtmosphereFallbackName` 规则降级补全
- 输出：**plans 数组**（非 raw JSON），含 `autoKey / name / prompt / semanticQuery / tags / resourceIds`

**重试**：LLM 失败或 plans 为空时最多 2 次，仍失败则纯规则 `buildFallbackPlans`。

---

### 3.8 `auto-collection-storage` — 合集入库 Prompt 模板

**用途**：非 LLM 模板 pack；生成写入合集 `queryJson.prompt` 的短字符串（降级路径、fallback 命名后使用）。

**触发**：`buildAutoCollectionStoragePrompt(name, themeHint)`

**SKILL.md**：仅 `{detail}` 占位符。

**normalize**（pipeline: `storage-prompt`）：取 `detail` 或 `name`，截断至 200 字符。

**说明**：这是 **template** 类型 pack，不调用模型；纳入 Skill 体系是为了版本化与统一 normalize 截断逻辑。

---

## 4. Profile 策略包

当前仅 `image-analysis` 实现 profile。

### 4.1 `default`

无 patch，使用基础 `SKILL.md` + `normalize.json`。

### 4.2 `strict-nsfw`

路径：`image-analysis/profiles/strict-nsfw/`

**SKILL.patch.md**（追加至 prompt 末尾）：

> 保守分级：0/1、1/2 之间犹豫时选更高档；暗示性内容倾向 `safeForWork=false`。

**normalize.patch.json**（合并 repairs）：

- `nsfwLevel=1` → 强制 `safeForWork=false`

**启用**：设置 → AI 设置 → **内容分级策略**（`promptProfile`）

---

## 5. Normalize Pipeline 类型速查

| pipeline                 | 使用 Pack                       | 行为                             |
| ------------------------ | ------------------------------- | -------------------------------- |
| `analysis-result`        | image-analysis（及 video 复用） | 截断 + nsfw repairs → 七字段对象 |
| `search-params`          | search-parse                    | 搜索参数字典                     |
| `collection-query`       | collection-query                | queryJson 字典 + 强制 defaults   |
| `tags-list`              | collection-tag-expand           | `{ tags: string[] }`             |
| `keywords-list`          | keyword-expand                  | `{ keywords: string[] }`         |
| `collection-naming-plan` | collection-naming               | Hook 输出 plans 数组             |
| `storage-prompt`         | auto-collection-storage         | 返回截断字符串                   |

---

## 6. 代码映射表

| Pack                    | buildPrompt                        | normalize                         | 调用方                       |
| ----------------------- | ---------------------------------- | --------------------------------- | ---------------------------- |
| image-analysis          | `buildImageAnalysisPrompt`         | `normalizeAnalysisResultWithMeta` | `AiAnalysisProvider`         |
| video-poster-analysis   | `buildVideoPosterAnalysisPrompt`   | 同上（`packId` 不同）             | 同上                         |
| search-parse            | `buildSearchParsePrompt`           | `normalizeSearchParams`           | `TextQueryParser`            |
| collection-query        | `buildCollectionQueryPrompt`       | `normalizeCollectionQueryJson`    | `TextQueryParser`            |
| collection-tag-expand   | `buildCollectionTagExpandPrompt`   | `applyPackPipeline`               | `TextQueryParser`            |
| keyword-expand          | `buildKeywordExpandPrompt`         | `applyPackPipeline`               | `TextQueryParser`            |
| collection-naming       | `buildCollectionNamingPrompt`      | `normalizeCollectionNamingPlan`   | `CollectionCurator`          |
| auto-collection-storage | `buildAutoCollectionStoragePrompt` | `applyPackPipeline`               | `CollectionCurator` fallback |

**基础设施**：

| 模块                     | 路径                                        |
| ------------------------ | ------------------------------------------- |
| 加载 / 缓存              | `src/main/ai/skills/SkillPackLoader.mjs`    |
| Prompt 组装              | `src/main/ai/skills/SkillPackRegistry.mjs`  |
| 输出语言 footer          | `src/main/ai/skills/outputLocale.mjs`       |
| Profile 合并             | `src/main/ai/skills/skillProfileMerge.mjs`  |
| 上下文（profile/locale） | `src/main/ai/skills/skillContext.mjs`       |
| Schema 约束（coerce）    | `src/main/ai/normalize/schemaCoerce.mjs`    |
| Normalize 引擎           | `src/main/ai/normalize/NormalizeEngine.mjs` |
| 命名校验 Hook            | `src/main/ai/normalize/normalizeHooks.mjs`  |

---

## 7. 目录结构

```text
resources/ai/skills/
├── manifest.json
├── image-analysis/
│   ├── pack.json
│   ├── SKILL.md
│   ├── schema.json
│   ├── normalize.json
│   └── profiles/
│       └── strict-nsfw/
│           ├── SKILL.patch.md
│           └── normalize.patch.json
├── video-poster-analysis/
│   ├── pack.json          # normalizePackId → image-analysis
│   ├── SKILL.md
│   └── schema.json
├── search-parse/
├── collection-query/
├── collection-tag-expand/
├── keyword-expand/
├── collection-naming/
└── auto-collection-storage/
```

打包路径：`FBW_RESOURCES_PATH/ai/skills`（`electron-builder` extraResources 已包含 `resources/`）。

---

## 8. 验收脚本

| 脚本                                  | 作用                                                              |
| ------------------------------------- | ----------------------------------------------------------------- |
| `scripts/run-ai-skill-pack-smoke.mjs` | 8 个 pack prompt 可加载                                           |
| `scripts/run-ai-normalize-golden.mjs` | normalize 与 legacy 行为一致（image / search / collection-query） |
| `scripts/run-ai-normalize-replay.mjs`   | Phase D：profile 切换 / strict-nsfw 重放逻辑（无 LLM、无 DB）   |

---

## 9. 与后续 Phase 的关系

| 能力                            | 涉及 Pack                             | 状态                                                      |
| ------------------------------- | ------------------------------------- | --------------------------------------------------------- |
| `rawLlmJson` 离线重放 normalize | image-analysis、video-poster-analysis | ✅ Phase D：`AiNormalizeReplay` + 设置切换 / 启动版本检查 |
| Orchestrator 多步编排           | 组合多个 text/vision pack             | ⏸ Phase C，按需                                           |
| 设置页 profile 选择 UI          | strict-nsfw                           | ✅ AI 设置 → 内容分级策略；切换后自动重放                 |
| 第三方 Skill Pack 插件          | manifest 签名校验                     | ❌ 未实现                                                 |
| `packOverrides` 版本锁定        | 全部 pack                             | ❌ 设置字段已预留，Loader 未读                            |
| i18n prompt 遗留键清理          | —                                     | ✅ 2026-06-08 删除 `storagePrompt`、`ai.skills.*`       |

**Phase D 行为摘要**

- 新分析：`AiAnalysisProvider` 返回 `rawLlmJson`（LLM 原始 JSON），写入 `fbw_resource_ai.rawLlmJson`。
- Profile 切换：`updateSettingData` 检测 `ai.promptProfile` 变化 → `scheduleNormalizeReplay({ reason: 'profile-change' })`。
- 启动：`startup-version-check` 对 `normalizeVersion` / `packVersion` 不一致的行重放。
- 重放保留 `aiAnalyzedAt`，更新 tags / 文本向量；**不**重跑画面向量。
- 无 `rawLlmJson` 的历史行无法离线重放，需手动重新分析。

---

## 10. 修订记录

| 日期       | 说明                                                       |
| ---------- | ---------------------------------------------------------- |
| 2026-06-08 | 初版成稿：8 个 Pack 说明、profile / pipeline / 代码映射、Phase D 重放、打包路径 |
