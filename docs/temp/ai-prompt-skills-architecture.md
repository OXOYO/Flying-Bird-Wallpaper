# AI 分析：Rules / Skills / Orchestrator 三层架构草案

> 临时文档，供 Prompt 工程与 Agent 边界讨论。与 **AI 2.0 主链路** 直接相关。  
> 正式能力说明：[ai-features.md](../ai-features.md) · 索引：[README.md](./README.md)

---

## 1. 背景与问题

### 1.1 改造前（历史 as-is）

改造前 AI 链路为 **「单次 LLM 调用 + 硬编码 schema 解析」**，并非 General Agent：

```text
AiPrompts.mjs → t('ai.prompts.*')（i18n 超长字符串）
  → AiAnalysisProvider.analyzeImage / chatText
  → extractJsonObject
  → AiResponseParser.normalize*（代码规则）
  → 入库 / 检索 / 策展
```

代码锚点：

| 模块                           | 路径                                               |
| ------------------------------ | -------------------------------------------------- |
| Prompt 构建                    | `src/main/ai/AiPrompts.mjs`                        |
| 视觉/文本调用                  | `src/main/ai/AiAnalysisProvider.mjs`               |
| 规则/normalize                 | `src/main/ai/AiResponseParser.mjs`                 |
| 文本任务入口                   | `src/main/ai/TextQueryParser.mjs`                  |
| 系统策展命名                   | `src/main/store/CollectionCurator.mjs`             |
| Prompt 文案（12 语言，已删除） | ~~`src/i18n/locale/lang/*.json` → `ai.prompts.*`~~ |

### 1.2 当前实现（2026-06-08）

Phase A / B / D 已完成；热路径仍为单次 LLM，Prompt 与 normalize 已外置为 Skill Pack：

```text
buildSkillPrompt(packId)     ← SkillPackRegistry + resources/ai/skills/*/SKILL.md
  → AiAnalysisProvider / TextQueryParser / CollectionCurator（单次 LLM）
  → extractJsonObject
  → applyPackPipeline        ← NormalizeEngine + schemaCoerce + normalize.json
  → 入库 / 检索 / 策展
  （vision：另写 rawLlmJson + analysisMeta，支持 profile 切换离线重放）
```

| 模块            | 路径                                                                                             |
| --------------- | ------------------------------------------------------------------------------------------------ |
| Prompt 组装     | `src/main/ai/skills/SkillPackRegistry.mjs`                                                       |
| Pack 加载       | `src/main/ai/skills/SkillPackLoader.mjs`                                                         |
| 输出语言 footer | `src/main/ai/skills/outputLocale.mjs`                                                            |
| Normalize       | `src/main/ai/normalize/NormalizeEngine.mjs`                                                      |
| Schema 约束     | `src/main/ai/normalize/schemaCoerce.mjs`                                                         |
| 离线重放        | `src/main/ai/AiNormalizeReplay.mjs`                                                              |
| Pack 资源       | `resources/ai/skills/`（打包见 [ai-skill-packs-reference.md §7](./ai-skill-packs-reference.md)） |

`AiPrompts.mjs` 保留函数名，内部已全部委托 `buildSkillPrompt`；`AiResponseParser.mjs` 为兼容层，Pack 可用时走 `applyPackPipeline`。

### 1.3 任务清单（均已迁入 Skill Pack）

| packId                    | 原 i18n / 配置键（已删除）                 | 模型     | 输出                               |
| ------------------------- | ------------------------------------------ | -------- | ---------------------------------- |
| `image-analysis`          | `ai.prompts.imageAnalysis`                 | vision   | score/tags/title/desc/summary/nsfw |
| `video-poster-analysis`   | `ai.prompts.videoPosterAnalysis`           | vision   | 同上                               |
| `search-parse`            | `ai.prompts.searchParse`                   | text     | filterKeywords/tags/orientation…   |
| `collection-query`        | `ai.prompts.collectionQuery`               | text     | queryJson                          |
| `collection-tag-expand`   | `ai.prompts.collectionTagExpand`           | text     | tags[]                             |
| `keyword-expand`          | `ai.prompts.keywordExpand`                 | text     | keywords[]                         |
| `collection-naming`       | `ai.prompts.collectionNaming`              | text     | collections[]                      |
| `auto-collection-storage` | ~~`pages.Collections.auto.storagePrompt`~~ | template | 降级字符串                         |

### 1.4 产品边界（文档已明确）

`docs/ai-features.md`：**当前版本不做** OpenClaw / 外部 Agent 集成。  
本草案 **不推翻** 该决策，仅说明 Agent 应落在 **冷路径 / 开放任务**，热路径保持单次调用。

### 1.5 为何要改组织方式（改造动机与解决情况）

| 问题                  | 改造前表现                     | 当前状态                                                  |
| --------------------- | ------------------------------ | --------------------------------------------------------- |
| Prompt 与 i18n 强绑定 | 12 语言各存一整份超长 prompt   | ✅ 单语 `SKILL.md` + `outputLocale.mjs` footer            |
| Prompt 与 Rules 双份  | nsfw 写进 prompt 又写进 Parser | ✅ `normalize.json` repairs + `schema.json`               |
| 无版本 / 难重跑       | 无法 selective 重算            | ✅ `packVersion` / `normalizeVersion` + `rawLlmJson` 重放 |
| 无 profile            | 难做 strict-nsfw 等策略        | ✅ `promptProfile` + patch 合并                           |
| 测试难                | 缺 golden case                 | ✅ `scripts/run-ai-normalize-golden.mjs` 等               |

---

## 2. 核心结论（修订）

```text
Skill Pack = SKILL.md + **schema.json** + **normalize.json** + version
NormalizeEngine → 薄执行层（schemaCoerce + normalize，不写业务 if-else）
Skills     → Prompt 模块化，替代 i18n 巨型字符串
Rules      → 声明式 **normalize.json**（repair/defaults）；结构约束见 schema.json；见 §3.7
Orchestrator → 仅冷路径多步任务；不接管 analyzeResourceRow 热路径
```

**一句话**：Prompt 与 normalize 都应 **外置为可版本 Skill Pack**；代码只保留 **NormalizeEngine + 少量 Hook 注册表**，不再在 `AiResponseParser` 里堆业务规则。

**区分「规则外置」与「零代码」**：

| 层次           | 放哪                                        | 说明                                                   |
| -------------- | ------------------------------------------- | ------------------------------------------------------ |
| 业务 normalize | `resources/ai/skills/*/normalize.json`      | repair、defaults、ignore                               |
| 结构校验       | `resources/ai/skills/*/schema.json`         | JSON Schema 子集 + `schemaCoerce.mjs`                  |
| 执行引擎       | `src/main/ai/normalize/NormalizeEngine.mjs` | coerce → normalize → hooks                             |
| 复杂 Hook      | `rules/hooks/*.mjs` 注册表                  | 仅当 DSL 表达不了时（如「标题须在 hints 语料中出现」） |
| LLM / Agent    | 不参与 Rules                                | 只产出 JSON，**不**决定入库形态                        |

---

## 3. 架构：Skill Pack + NormalizeEngine + Orchestrator

```text
┌─────────────────────────────────────────────────────────┐
│  Layer 3 — Orchestrator（可选 Agent，冷路径）              │
└───────────────────────────┬─────────────────────────────┘
                            │ 选 skillPack、调工具
┌───────────────────────────▼─────────────────────────────┐
│  Layer 2 — SkillPackRegistry                           │
│  每个 pack：SKILL.md + schema.json + normalize.json + version │
└───────────────────────────┬─────────────────────────────┘
                            │ 单次 LLM
┌───────────────────────────▼─────────────────────────────┐
│  Layer 1 — AiAnalysisProvider（现有，基本不变）           │
└───────────────────────────┬─────────────────────────────┘
                            │ raw JSON
┌───────────────────────────▼─────────────────────────────┐
│  Layer 0 — NormalizeEngine（薄代码）                     │
│  coerce(schema) → normalize.json → hooks                 │
└─────────────────────────────────────────────────────────┘
```

### 3.1 Skill Pack 目录（Skill 与 Rules 同级）

```text
resources/ai/skills/
├── image-analysis/
│   ├── pack.json             # id, version, modelKind, rulesRef
│   ├── SKILL.md              # Prompt 正文
│   ├── schema.json           # JSON Schema（schemaCoerce 约束）
│   ├── normalize.json        # 归一化策略（defaults / repairs / hooks，见 §3.7）
│   └── profiles/
│       ├── default/
│       │   ├── SKILL.patch.md
│       │   └── normalize.patch.json
│       └── strict-nsfw/
│           └── normalize.patch.json
├── collection-query/
│   ├── pack.json
│   ├── SKILL.md
│   ├── schema.json
│   └── normalize.json
└── manifest.json             # 全局 skill 列表与默认 version
```

**原则**：改 nsfw 联动或合集 `resourceName` 强制值 → **只改 `normalize.json`**；字段类型/长度 → **`schema.json`**；字段语义 → **`SKILL.md`**。

### 3.2 归一化声明格式（`normalize.json` 草案，§3.7 起与 schema 拆分）

> **历史说明**：v2 草案曾用单一 `rules.json` 含 `fieldRules`；v2.2 起 **校验归 schema**，**repair 归 normalize**，与 JSON Schema 主流做法对齐。

Normalize 由 NormalizeEngine 顺序执行：`parse → coerce(schema) → defaults → ignore → repairs → hooks → postProcess`

```json
{
  "version": "1.0.0",
  "defaults": {
    "resourceName": "resources",
    "tagsMode": "any",
    "sortField": "score",
    "sortType": -1,
    "orientation": []
  },
  "ignoreFromModel": ["scoreMin"],
  "repairs": [
    {
      "id": "nsfw-safeForWork",
      "fields": ["nsfwLevel", "safeForWork"],
      "rules": [
        { "when": { "safeForWork": false, "nsfwLevelLt": 2 }, "set": { "nsfwLevel": 2 } },
        { "when": { "nsfwLevelGte": 2 }, "set": { "safeForWork": false } },
        { "when": { "nsfwLevelEq": 0 }, "set": { "safeForWork": true } },
        { "when": { "nsfwLevelEq": 1, "safeForWork": false }, "set": { "nsfwLevel": 2 } }
      ]
    }
  ],
  "hooks": ["collectionTitleAgainstHints"],
  "postProcess": ["dedupeTags"]
}
```

**`schema.json` 承担（示例片段）**：

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "required": ["score", "tags", "title"],
  "properties": {
    "score": { "type": "integer", "minimum": 0, "maximum": 100 },
    "tags": { "type": "array", "maxItems": 12, "items": { "type": "string", "maxLength": 64 } },
    "title": { "type": "string", "maxLength": 120 },
    "desc": { "type": "string", "maxLength": 500 },
    "summary": { "type": "string", "maxLength": 200 },
    "nsfwLevel": { "type": "integer", "minimum": 0, "maximum": 3 },
    "safeForWork": { "type": "boolean" }
  }
}
```

**从现有代码迁出的映射**：

| 现 `AiResponseParser` / Constants                  | 迁到                                       |
| -------------------------------------------------- | ------------------------------------------ |
| 类型、maxLength、maxItems                          | `schema.json`                              |
| `normalizeAnalysisResult` clamp/trim               | schema + coerce 或 normalize `postProcess` |
| `applyNsfwConsistency`                             | `normalize.json` → `repairs`               |
| `normalizeCollectionQueryJson` 强制 `resourceName` | `defaults` + `ignoreFromModel`             |
| `limitCount` clamp 5–50                            | `schema.json` `minimum`/`maximum`          |
| `validateCollectionTitleAgainstHints`              | `hooks`                                    |
| `normalizeCollectionQuality`                       | schema enum 或 hook                        |

#### NormalizeEngine API（草案）

```javascript
// src/main/ai/normalize/NormalizeEngine.mjs

export function validatePackOutput(packId, raw) {}
export function normalizePackOutput(packId, raw, ctx) {}
export function applyPackPipeline(packId, raw, ctx) {}

export function registerNormalizeHook(id, fn) {}
```

`AiResponseParser.mjs` 迁移后：

```javascript
// 薄兼容层，逐步废弃 normalize*
export const normalizeAnalysisResult = (raw, ctx) =>
  applyPackPipeline('image-analysis', raw, ctx).data
```

#### Prompt 与 Rules 如何不重复

| 内容                              | 放 SKILL.md | 放 schema.json    | 放 normalize.json  |
| --------------------------------- | ----------- | ----------------- | ------------------ |
| 字段语义（title 与 summary 区别） | ✅          | ❌                | ❌                 |
| nsfw 分级 **说明**（给模型看）    | ✅ 简短     | ❌                | ❌                 |
| nsfw 分级 **强制执行**            | ❌          | 可选 if/then 校验 | ✅ repairs         |
| maxLength / type / enum           | ❌          | ✅                | ❌                 |
| 输出 JSON 示例                    | ✅          | ❌                | ❌                 |
| 「禁止模型带 scoreMin」           | ✅ 一句     | ❌                | ✅ ignoreFromModel |
| 强制 resourceName                 | ❌          | ❌                | ✅ defaults        |

模型说明与机器约束 **允许语义重叠一句**；**校验权威在 schema，修复权威在 normalize.json**。

### 3.3 Skills（Prompt 层）

（原 §3.2 内容保留，略去与 Rules 重复部分。）

#### SkillPackRegistry API（草案）

```javascript
// src/main/ai/skills/SkillPackRegistry.mjs

export function buildPrompt(packId, ctx) {}
export function getPackMeta(packId, ctx) {} // { version, normalizeVersion, profile }
export function applyPackRules(packId, raw, ctx) {
  return applyPackPipeline(packId, raw, ctx)
}
```

`AiPrompts.mjs` 迁移后：

```javascript
export const buildImageAnalysisPrompt = (ctx) => buildPrompt('image-analysis', ctx)
```

#### i18n 迁移策略

- **迁出**：`ai.prompts.*` 长正文 → `SKILL.md`（**单语源，见 §3.5**）✅ 已完成
- **保留在 i18n**：设置页、按钮、错误提示等 UI 文案
- **已删除**：12 语言 `ai.prompts.*` 大键；`pages.Collections.auto.storagePrompt`（改由 `auto-collection-storage` pack）
- **输出语言 footer**：不在 i18n，由 `src/main/ai/skills/outputLocale.mjs` 注入（en/zh 模板，其它语言回退英文）

### 3.5 Prompt 语言：不必 12 语版（单语源 + 输出语言）

#### 结论

**Skill 正文（SKILL.md）只需一种工作语言，通常英文或中文二选一**；不需要像 UI 那样维护 12 套完整 prompt。

要区分两个概念：

| 概念            | 含义                               | 要不要 12 语言            |
| --------------- | ---------------------------------- | ------------------------- |
| **Prompt 语言** | 写给模型看的任务说明               | ❌ **不要** 12 份         |
| **输出语言**    | tags / title / desc 用什么自然语言 | ✅ 跟用户 **界面语言** 走 |

用户界面是日语，不等于要把整份几千字的 `imageAnalysis` prompt 翻译成日语；只要在 prompt 里写清：

```text
Output title, summary, desc, and tags in {outputLanguage}.
Use natural {outputLanguage} for tags; do not mix languages unless the image text requires it.
```

`{outputLanguage}` 由运行时从 `settingData.locale` / `i18next.language` 映射（如 `ja-JP` → `Japanese`）。

#### 为什么单语源足够

1. **主流 VL/LLM 对英/中指令最稳**（项目默认 Qwen、OpenAI 兼容）；12 份翻译不会等比例提升质量，却 **12 倍维护成本**。
2. **当前痛点正是 12 语言同步**——改 nsfw 说明要改 12 个 json 大字符串。
3. **检索/合集依赖的是输出 tags 的语言**，由 `outputLanguage` 控制即可；与 prompt 正文语种无关。
4. **Rules（normalize.json）与语言无关**——clamp、nsfw 联动是结构化逻辑，更不应做 12 语版。

#### 推荐默认：英文单语源 + 输出语言参数

| 选项                             | 适用                                                        |
| -------------------------------- | ----------------------------------------------------------- |
| **English SKILL.md（推荐默认）** | 多 provider、OpenAI/OpenRouter、国际化文档、社区 Skill Pack |
| **Chinese SKILL.md**             | 主力用户国内、默认 Ollama+Qwen、团队编辑 prompt 以中文为主  |

可留设置项（可选，非必须）：

```javascript
settingData.ai.promptLanguage // 'en' | 'zh' — 选读哪份 SKILL.md，不是 UI 语言
```

**不要**为 `de-DE`、`fr-FR` 等各做一份 SKILL 全文。

#### i18n 里还应保留什么

| 保留在 i18n（12 语言）  | 迁出到 SKILL / 代码                  |
| ----------------------- | ------------------------------------ |
| 设置页、按钮、错误提示  | 字段职责、nsfw 长表、JSON 示例       |
| 用户可见的 AI 说明/help | `collectionQuery` 等任务全文         |
| —                       | 输出语言 footer → `outputLocale.mjs` |

`outputLocaleFooter` 由 `buildOutputLocaleFooter(locale)` 生成，示例：

```text
Output title, summary, desc, and tags entirely in {languageName}. Match the app UI language…
```

#### 与现有 prompt 规则的关系

现 `collectionQuery` 等已要求「tags 与界面语言一致」——这条应保留，但作为 **运行时注入的一两句**，而不是把整 prompt 翻译成 12 种语言。

#### 例外（仍不必 12 语版）

- **Regulatory / 合规措辞**：若某市场有特殊说明，用 **profile**（`profiles/eu/normalize.patch.json`）或 footnote 段落，而不是 12 完整 SKILL。
- **多语混合图**（海报上英法文字）：在 SKILL 里用 **一条通用规则** 处理，无需按 UI 语言拆 prompt。

#### 迁移验收

- [x] 删除 `ai.prompts.imageAnalysis` 等 12 语言大键（2026-06-08）
- [x] 删除 `pages.Collections.auto.storagePrompt` 遗留键（2026-06-08）
- [ ] 日/德/法界面下分析 **输出 tags 仍为对应自然语言**（需人工抽测）
- [ ] 同一图片：`outputLanguage=Japanese` vs `English`，tags 语种不同，**rules 归一化结果结构一致**
- [x] Skill Pack 仓库内仅 `SKILL.md`（en），**无** `SKILL.ja.md` 等 12 语版

### 3.6 Layer 3 — Orchestrator（可选 Agent）

**定义**：目标不固定、需 **多步 + 工具** 的任务编排。

| 适合 Orchestrator                     | 不适合（保持 Skill 单次）       |
| ------------------------------------- | ------------------------------- |
| 「帮我把图库整理成 5 个主题并设轮换」 | 单图 `analyzeResourceRow`       |
| OpenClaw / IM 控制壁纸                | 后台队列批量分析                |
| 复杂 NL 策展（多轮澄清）              | search-parse / collection-query |
| 律动 DanceScript LLM（15–30s 慢更新） | collection-naming 按簇单次      |

#### Orchestrator 工具面（草案）

```javascript
// 仅 Orchestrator 可调用；不暴露给 vision 热路径
const TOOLS = {
  queryResources: (filter) => {},
  runVisualCluster: (opts) => {},
  nameCluster: (clusterId) => {}, // 内部仍调 skill collection-naming
  createCollection: (plan) => {},
  setWallpaperRotation: (collectionId) => {},
  getAnalysisStats: () => {}
}
```

#### 与 OpenClaw 关系

- OpenClaw **只接 Orchestrator**，不接 `AiAnalysisManager` 内部队列
- 避免外部 Agent 绕过 normalize 直接写库

### 3.7 与主流「Rules」的区别 & schema + normalize 拆分

#### 3.7.1 名称澄清：此 Rules 不是 Cursor Rules

业界「Rules」至少四类，Skill Pack 里的策略文件只属于其中一种 **子类**：

| 主流叫法               | 典型形态                            | 作用对象       | 何时       | 失败策略              |
| ---------------------- | ----------------------------------- | -------------- | ---------- | --------------------- |
| **IDE / Cursor Rules** | `.mdc`、自然语言                    | 编码 Agent     | 对话全程   | 软约束（可能不遵守）  |
| **Agent Skills**       | `SKILL.md`                          | 任务 Agent     | 调用前     | 软约束                |
| **JSON Schema / Zod**  | `schema.json`、类型                 | 输出 JSON      | 输出后     | 硬 **reject** / retry |
| **规则引擎 BRMS**      | json-rules-engine、Drools、OPA      | 业务事件/事实  | 事件驱动   | 触发动作              |
| **本项目的 normalize** | `normalize.json`（原 `rules.json`） | **入库前数据** | LLM 输出后 | 硬 **repair** + 覆盖  |

```text
SKILL.md        → 让模型尽量写对（软）
schema.json     → 结构是否合法（主流校验）
normalize.json  → 不合法/缺字段时怎么改、哪些强制覆盖（本项目特有）
```

**一句话**：不是给 LLM 看的 Cursor Rules，而是 **LLM 输出 ETL / Normalization Policy**。

#### 3.7.2 与 JSON Schema 的重叠与分工

草案 §3.2 的 `fieldRules`（clamp、maxLength、maxItems）与 **JSON Schema 2020-12** 高度重叠，落地时 **合并进 `schema.json`**。

**实际实现（2026-06-08）**：使用 `schemaCoerce.mjs` 按 schema 做类型/长度/enum 约束，**未引入 AJV 运行时**。理由：Pack 数量固定、schema 子集可控，自研 coerce 更轻、与 pipeline 专用分支（`analysis-result` 等）耦合更顺。若未来 Pack 插件化或 schema 复杂度上升，可再换 AJV。

| 能力                                     | JSON Schema（AJV 等） | 当前 `schemaCoerce` | normalize.json          |
| ---------------------------------------- | --------------------- | ------------------- | ----------------------- |
| `required`、`type`、`enum`               | ✅                    | ✅ 子集             | ❌                      |
| `maxLength`、`minimum`、`maximum`        | ✅                    | ✅                  | ❌                      |
| `clamp`、数组 `trim`、截断               | ❌ 非标准             | ✅ pipeline 内      | 可配合                  |
| `defaults`、强制 `resourceName`          | ❌                    | ❌                  | ✅                      |
| `ignoreFromModel` / 丢弃字段             | ❌                    | ❌                  | ✅                      |
| 跨字段 **repair**（nsfw ↔ safeForWork） | `if/then` 仅 **校验** | ❌                  | ✅ `repairs[]` **改值** |
| 领域 hook（标题 vs hints）               | ❌                    | ❌                  | ✅ `hooks[]`            |

**为何不能只要 Schema**：壁纸批量分析场景要 **repair-first**（改好再入库），reject + 重问模型 = 成本 ×N。Guardrails 类方案偏 retry；本项目热路径偏 **确定性 normalize**。

Schema 可表达 nsfw 联动 **校验**，例如：

```json
{
  "if": { "properties": { "nsfwLevel": { "minimum": 2 } } },
  "then": { "properties": { "safeForWork": { "const": false } } }
}
```

但校验失败时仍需 `normalize.json` 的 `repairs` **写回合法值**，而不是整图重跑 vision。

#### 3.7.3 与规则引擎、Guardrails、OPA 的边界

| 方案                           | 与本项目关系                                                                  |
| ------------------------------ | ----------------------------------------------------------------------------- |
| **json-rules-engine / Drools** | 输入为事件流，过重；`crossField` 复杂时可借 **JSON Logic** 语法，不必自造方言 |
| **Guardrails / NeMo**          | validator 部分重叠；默认 retry LLM 与批量 ETL 成本模型冲突                    |
| **OPA / Rego**                 | 权限策略，与 LLM 输出 normalize 无关                                          |
| **Structured Outputs**         | 生成阶段约束，**不能替代**入库前 normalize（模型仍可能越界）                  |

#### 3.7.4 推荐文件命名与结构（对齐主流）

```text
resources/ai/skills/image-analysis/
  pack.json
  SKILL.md
  schema.json       # JSON Schema 子集（schemaCoerce 读取）
  normalize.json    # 原 rules.json 改名，避免与 Cursor Rules 混淆
  profiles/strict-nsfw/
    SKILL.patch.md
    normalize.patch.json
```

> `examples.json` 为草案可选文件，**当前仓库未实现**。

**执行管线（当前实现）**：

```text
extractJsonObject
  → applyPackPipeline
      → coerceBySchema(schema)   // schemaCoerce.mjs
      → applyNormalize()         // defaults / ignore / repairs / hooks
  → 入库
```

`normalize.json` 精简示例（§3.2 的演进版）：

```json
{
  "version": "1.0.0",
  "defaults": {
    "resourceName": "resources",
    "tagsMode": "any",
    "sortField": "score",
    "sortType": -1,
    "orientation": []
  },
  "ignoreFromModel": ["scoreMin"],
  "repairs": [
    {
      "id": "nsfw-safeForWork",
      "fields": ["nsfwLevel", "safeForWork"],
      "rules": [
        { "when": { "safeForWork": false, "nsfwLevelLt": 2 }, "set": { "nsfwLevel": 2 } },
        { "when": { "nsfwLevelGte": 2 }, "set": { "safeForWork": false } },
        { "when": { "nsfwLevelEq": 0 }, "set": { "safeForWork": true } },
        { "when": { "nsfwLevelEq": 1, "safeForWork": false }, "set": { "nsfwLevel": 2 } }
      ]
    }
  ],
  "hooks": ["collectionTitleAgainstHints"],
  "postProcess": ["dedupeTags"]
}
```

`fieldRules` 中纯校验/截断项 **删除**，改由 `schema.json` + `schemaCoerce.mjs` 处理；若 coerce 不够，可用 JSON Schema **`x-fbw-coerce`** 扩展 keyword（文档化即可）。未来 Pack 插件化时可评估引入 **AJV** 标准校验库。

#### 3.7.5 引擎 API（已实现）

```javascript
// src/main/ai/normalize/NormalizeEngine.mjs
export function validatePackOutput(packId, raw, ctx) {} // coerceBySchema + schema.json
export function normalizePackOutput(packId, raw, ctx) {} // normalize.json + hooks
export function applyPackPipeline(packId, raw, ctx) {} // normalizePackOutput（热路径入口）
```

文档与代码中 **逐步用 normalize 替代 rules** 指称此类文件，**Rules** 一词保留给 Cursor/Agent 语境，减少团队沟通歧义。

#### 3.7.6 对照总览

```text
                    约束谁          何时           错了怎么办
Cursor Rules        编码 Agent      对话全程       软
SKILL.md            任务 Agent      调用前         软
JSON Schema         输出形状        输出后         reject / retry
normalize.json      入库数据        输出后         repair + 覆盖
规则引擎            业务系统        事件驱动       触发动作
```

---

## 4. 场景路由表

| 场景                    | 层级                                 | 说明            |
| ----------------------- | ------------------------------------ | --------------- |
| 单图/封面 AI 分析       | Skill Pack → NormalizeEngine         | 热路径          |
| 语义搜索 / 合集 NL 解析 | Skill Pack → NormalizeEngine         | 单次 JSON       |
| 系统策展 LLM 命名       | Skill Pack → NormalizeEngine + hooks | 命名校验走 hook |
| 整库重策展 / 复杂 NL    | Orchestrator → 多 Pack + Tools       | 冷路径          |
| 外部 IM 控制            | Orchestrator + MCP                   | 未来 OpenClaw   |
| 律动 DanceScript        | Skill Pack（慢刷新）                 |                 |

---

## 5. 数据模型扩展（可选）

分析结果记录 **Skill Pack 与 Rules 双版本**：

```javascript
// fbw_resource_ai.analysisMeta 或等价 JSON 字段
{
  packId: 'image-analysis',
  packVersion: '1.2.0',
  normalizeVersion: '1.0.0',
  profile: 'default',
  promptHash: 'sha256:...'
}
```

设置项：

```javascript
settingData.ai.promptProfile // profile 名（UI：内容分级策略）
settingData.ai.packOverrides // { 'image-analysis': '1.1.0' }，预留字段，Loader 尚未读取
```

**Selective 重跑**：`normalizeVersion` 变更 → 对存 `rawLlmJson` 离线重放（Phase D ✅）。

---

## 6. 分期实施

> **状态摘要（2026-06-08）**：Phase A / B / D **已完成**；Phase C（Orchestrator）按需，未启动。

### Phase A — 首个 Skill Pack + NormalizeEngine MVP（2–3 周）

- [x] `NormalizeEngine.mjs` + `schema.json` / `normalize.json` 格式文档
- [x] 迁移 `image-analysis`：`SKILL.md` + `schema.json` + `normalize.json`（含 nsfw repairs）
- [x] `AiResponseParser.normalizeAnalysisResult` → 调 `applyPackPipeline`（兼容导出保留）
- [x] golden：`scripts/run-ai-normalize-golden.mjs`（不调用 LLM）

**验收**：与现 `applyNsfwConsistency` + normalize 行为 bit-equal ✅

### Phase B — 全 Pack + Profile（+2 周）

- [x] 其余 7 个 pack；`collection-naming` 的 hook 注册
- [x] `promptProfile` + `normalize.patch.json` 合并逻辑
- [x] 写入 `packVersion` / `normalizeVersion`（`analysisMeta`）
- [x] 删除 i18n 已迁出 prompt 键（含 `storagePrompt` 遗留）

### Phase C — Orchestrator（按需）

- [ ] 冷路径编排；OpenClaw 后置

### Phase D — Rules 离线重放（可选）

- [x] 存 `rawLlmJson`；Rules / profile 升级时对历史记录重放 normalize
- [x] `AiNormalizeReplay` + 设置切换 `promptProfile` 自动调度 + 启动版本检查
- [x] 验收：`scripts/run-ai-normalize-replay.mjs`

---

## 7. 明确不做

| 方案                      | 原因                                        |
| ------------------------- | ------------------------------------------- |
| 用 Agent/LLM 执行 Rules   | 合规必须确定性                              |
| 把全部 hook 逻辑硬 DSL 化 | 维护 DSL 比少量 hook 更糟；hook 要克制      |
| 无版本 normalize 热更新   | 必须 packVersion / normalizeVersion，可回滚 |
| 批量分析改 ReAct 多轮     | 成本与延迟                                  |
| 热路径 LLM 自主写库       | 安全                                        |

### 7.1 仍保留在代码中的最小集合（「薄代码」边界）

| 保留                    | 原因                                        |
| ----------------------- | ------------------------------------------- |
| `NormalizeEngine`       | 不可能零代码；schemaCoerce + normalize 解释 |
| `extractJsonObject`     | 通用解析                                    |
| `registerNormalizeHook` | 复杂域校验                                  |
| Hook 实现体             | 可测；`normalize.json` 只 **引用 id**       |
| 恶意/异常输入兜底       | 引擎级 try/catch，防 pack 配错拖垮主进程    |

**目标**：`AiResponseParser.mjs` 从 **业务规则容器** 降为 **兼容 re-export**；新规则 **禁止** 再写进 Parser。

---

## 8. 测试策略

当前验收脚本位于 `scripts/`（非 `tests/ai/`）：

```text
scripts/
├── run-ai-skill-pack-smoke.mjs    # 8 个 pack prompt 可加载
├── run-ai-normalize-golden.mjs      # normalize 与 legacy bit-equal
└── run-ai-normalize-replay.mjs      # rawLlmJson + profile 重放逻辑
```

用法示例：`FBW_RESOURCES_PATH=./resources node scripts/run-ai-normalize-golden.mjs`

- **Normalize 单测（优先）**：raw → pipeline，覆盖 repairs、defaults、ignore
- **Pack 端到端**：同图允许 score/tags 浮动，**nsfw 档位必须稳定**
- **Pack 升级**：同 raw + normalize v1 vs v2 diff 可预期（Phase D 重放）

---

## 9. 迁移对照（已完成）

以下映射已于 2026-06-08 落地；保留供查阅。

### AiPrompts.mjs → packId

| 现函数                           | packId                  |
| -------------------------------- | ----------------------- |
| `buildImageAnalysisPrompt`       | `image-analysis`        |
| `buildVideoPosterAnalysisPrompt` | `video-poster-analysis` |
| `buildSearchParsePrompt`         | `search-parse`          |
| `buildCollectionQueryPrompt`     | `collection-query`      |
| `buildKeywordExpandPrompt`       | `keyword-expand`        |
| `buildCollectionTagExpandPrompt` | `collection-tag-expand` |
| `buildCollectionNamingPrompt`    | `collection-naming`     |

### AiResponseParser → schema + normalize.json

| 现函数                          | packId / 说明                                   |
| ------------------------------- | ----------------------------------------------- |
| `normalizeAnalysisResult`       | `image-analysis/schema.json` + `normalize.json` |
| `applyNsfwConsistency`          | `normalize.json` → `repairs`                    |
| `normalizeSearchParams`         | `search-parse/`                                 |
| `normalizeCollectionQueryJson`  | `collection-query/`                             |
| `normalizeCollectionNamingPlan` | `collection-naming/` + hooks                    |

---

## 10. 修订记录

| 日期           | 说明                                                                                                           |
| -------------- | -------------------------------------------------------------------------------------------------------------- |
| **2026-06-08** | 初版成稿：§1 改造前/现状拆分、Phase A/B/D 状态、schemaCoerce 选型、§8 测试脚本路径、§9 迁移对照、i18n 清理说明 |
