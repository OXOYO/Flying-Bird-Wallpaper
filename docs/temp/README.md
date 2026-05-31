# docs/temp 文档索引

> 整理日期：2026-05-27（索引同步）  
> 说明：本目录为**开发过程临时文档**，与正式用户文档（`docs/` 根目录）区分；内容随实现迭代更新。

---

## AI 2.0（主应用）

| 文档 | 用途 | 状态 |
|------|------|------|
| [ai-dev-plan.md](./ai-dev-plan.md) | **开发方案 + 实施清单 + 验收**（Sprint 0–4 及后续增量 §8–§14） | v2.8 |
| [ai-feature-roadmap.md](./ai-feature-roadmap.md) | **完整功能清单**（48+ 项 AI 能力，含优先级与实现状态） | 2026-05-27 |
| [ai-analysis-ux-and-performance.md](./ai-analysis-ux-and-performance.md) | **分析缩图、动态超时、失败重试、测试连接、语义搜索迁移、探索顶栏、设置 UX** | v1.7 |
| [ai-visual-embedding-and-similar.md](./ai-visual-embedding-and-similar.md) | **找相似方案 C、画面向量、EmbedRequestBuilder、合集画面向量、设置项** | 2026-05-29 v2.2 |
| [ai-collections-ux-and-curate.md](./ai-collections-ux-and-curate.md) | **系统策展（画面 K-Means）、用户合集实体词/氛围策略、分页、缩略图/主色** | 2026-05-29 v1.4 |
| [openclaw-agent-integration.md](./openclaw-agent-integration.md) | 外部 Agent / OpenClaw / MCP 集成规划 | **未编码**（Sprint 5 跳过） |

**阅读顺序建议：**

1. 想了解「做了什么、怎么验收」→ `ai-dev-plan.md`
2. 想查「某功能 ID 是否规划/已实现」→ `ai-feature-roadmap.md`
3. 想查 **大图分析慢/超时、缩图、失败重试、测试连接、语义搜索开关** → `ai-analysis-ux-and-performance.md`
4. 想查 **画面找相似、远程画面向量、RRF、NVIDIA embed、合集画面向量** → `ai-visual-embedding-and-similar.md`
5. 想查 **系统合集、用户合集刷新策略（regenPrompt/标签扩展）、评分门槛、分页** → `ai-collections-ux-and-curate.md`
6. 想接 OpenClaw / Telegram 控制壁纸 → `openclaw-agent-integration.md`

---

## 主窗口、隐私与基础设施

| 文档 | 用途 | 状态 |
|------|------|------|
| [main-window-ux-and-infrastructure.md](./main-window-ux-and-infrastructure.md) | **侧栏折叠钮、SideMenu 主题色、快捷键管理器、检查更新通知** | 2026-05-31 |
| [privacy-and-sensitive-content.md](./privacy-and-sensitive-content.md) | **敏感内容隐藏、壁纸过滤、密码规则；移除内容安全筛选** | v1.0 |

**阅读顺序建议：**

- 侧栏 / 快捷键 / 更新 → `main-window-ux-and-infrastructure.md`
- 敏感遮罩 / 壁纸跳过敏感图 / 与搜索·合集关系 → `privacy-and-sensitive-content.md`

---

## 其他专题（与 AI 2.0 无直接依赖）

| 文档 | 用途 |
|------|------|
| [api-integration-suggestions.md](./api-integration-suggestions.md) | 壁纸资源 API 插件扩展建议 |
| [rhythm-audio-processing-analysis.md](./rhythm-audio-processing-analysis.md) | 律动壁纸音频/节拍算法分析（正式 doc：`docs/rhythm_wallpaper.md`） |

---

## 代码锚点（常用）

### AI 2.0 核心

| 模块 | 路径 |
|------|------|
| AI 分析 | `src/main/ai/AiAnalysisManager.mjs` |
| 分析前缩图 | `src/main/ai/AiVisionImagePrep.mjs` |
| 超时/常量 | `src/main/ai/aiConstants.mjs` |
| Provider / 模型 | `src/main/ai/AiAnalysisProvider.mjs`、`providers/HttpAiProviders.mjs` |
| 探索顶栏 | `src/renderer/.../ExploreSearchHeader.vue` |
| 文本向量 | `src/main/ai/EmbeddingManager.mjs`、`VecStore.mjs` |
| 找相似融合 | `src/main/ai/HybridSimilarSearch.mjs` |
| 合集画面检索 | `src/main/ai/VisualCollectionSearch.mjs` |
| 自动策展 | `src/main/store/CollectionCurator.mjs` |
| AI 设置 | `src/renderer/.../AiSetting.vue` |

### 隐私与敏感内容

| 模块 | 路径 |
|------|------|
| 策略 | `src/common/privacyNsfwMask.js` |
| 遮罩 composable | `src/common/composables/usePrivacyNsfwMask.mjs` |
| 开关与密码 | `src/common/composables/useNsfwMaskSettingToggle.mjs` |
| 壁纸过滤 | `src/main/store/WallpaperManager.mjs` |
| 隐私设置 UI | `src/renderer/.../PrivacySpace.vue` |

### 主窗口基础设施

| 模块 | 路径 |
|------|------|
| 快捷键 | `src/main/store/ShortcutManager.mjs` |
| 更新 | `src/main/updater.mjs`、`src/main/index.mjs` |
| 侧栏 | `MainWindow.vue`、`SideMenu.vue` |

---

## 修订记录

| 日期 | 说明 |
|------|------|
| **2026-05-27** | 新增 `privacy-and-sensitive-content.md`；同步敏感内容策略、移除 `enableNsfwCheck`、AI 设置隐藏重试/并发；`ai-analysis` v1.7、`ai-dev-plan` v2.8、`ai-feature-roadmap` 更新 |
| **2026-05-31** | 新增 `main-window-ux-and-infrastructure.md`；索引补充主窗/快捷键/更新锚点 |
| **2026-05-29** | 合集刷新策略：`regenPrompt` 默认 false、LLM 标签扩展；`ai-collections` v1.4、`ai-visual-embedding` v2.2、dev-plan v2.7 |
| **2026-05-29** | 合集画面向量、`VisualCollectionSearch`；dev-plan §14 |
| 2026-05-28 | 失败重试、评分默认 70、策展稳定暂停 |
| 2026-05-28 | 新增 `ai-collections-ux-and-curate.md` |
| 2026-05-27 | 新增 `ai-analysis-ux-and-performance.md` |
| 2026-05-26 | 初版 Sprint 0–4 方案与 roadmap |
