# 敏感内容隐藏与内容安全策略（2.0.0+）

> 文档版本：**v1.1**  
> 整理日期：2026-05-27  
> 状态：**已实现**  
> 关联：[data-model-resources-and-ai.md](./data-model-resources-and-ai.md) · [main-window-ux-and-infrastructure.md](./main-window-ux-and-infrastructure.md) · [ai-analysis-ux-and-performance.md](./ai-analysis-ux-and-performance.md) · [README.md](./README.md)

---

## 1. 产品原则（当前）

| 能力 | 用户开关 | 数据层 | 展示层 | 壁纸轮换 |
|------|----------|--------|--------|----------|
| **敏感内容隐藏** | `privacy.enableNsfwContentMask` | 等级存 **`fbw_resource_ai.nsfwLevel`**；搜索/合集/H5 **不过滤** | 收藏/探索等 **遮罩**（≥2） | 上/下一张 **跳过** ≥2 |
| ~~内容安全筛选~~ | ~~`ai.enableNsfwCheck`~~ | ~~`hideUnsafe` SQL~~ | — | — |

- **已移除** AI 设置中的「内容安全筛选」（`enableNsfwCheck`）；探索、语义搜索、AI 合集生成、H5 搜索均 **不再** 传 `hideUnsafe`。
- **合集**：按原逻辑正常生成；敏感图仅在浏览时用遮罩处理，不参与列表 SQL 剔除。
- **手动「设为壁纸」**：不拦截敏感等级，用户可主动设置。
- **隐私空间**：已进入时不遮罩。

---

## 2. 敏感等级与遮罩阈值

| 字段 | 说明 |
|------|------|
| `nsfwLevel` | 存于 **`fbw_resource_ai`**；0～3，由视觉分析 prompt + `AiResponseParser` 写入，联动 `safeForWork` |
| 列表展示 | `ResourcesManager` JOIN 后仍投影为 `nsfwLevel`（与 API 兼容） |
| 遮罩/轮换跳过 | **`nsfwLevel ≥ 2`**（`NSFW_MASK_MIN_LEVEL`） |
| 未分析资源 | 附表无行或 `nsfwLevel` 为 `NULL` 时 **不遮罩、轮换仍可命中**（与旧 `hideUnsafe` 对 NULL 行为一致） |

Prompt 文案已软化（中/英/台等），字段名与 0～3 分级规则未改。

---

## 3. 「敏感内容隐藏」开关与密码

设置位置：**设置 → 隐私空间**（非 AI 页）。

| 操作 | 规则 |
|------|------|
| **开启** | 须 **已设置** 隐私密码（仅检查存在，不需输入验证） |
| **关闭** | 须 **验证** 隐私密码 |
| **浏览遮罩** | 开关 **且** 已设密码 → 显示遮罩 |
| **点击遮罩查看** | 须 **验证** 密码；本页临时解锁，切菜单/应用后台后恢复 |
| **壁纸过滤** | 仅看开关是否打开（不要求密码） |

实现：

- `src/common/privacyNsfwMask.js` — `isNsfwMaskFeatureActive`、`shouldFilterSensitiveForWallpaper`、`getNsfwSafeSqlClause`
- `src/common/composables/usePrivacyNsfwMask.mjs` — 浏览页遮罩与解锁
- `src/common/composables/useNsfwMaskSettingToggle.mjs` — 开/关开关与密码校验

---

## 4. 壁纸切换过滤

| 路径 | 行为 |
|------|------|
| 下一张候选 SQL | `enableNsfwContentMask` 为真时追加 `getNsfwSafeSqlClause('r')`：`NOT EXISTS (SELECT 1 FROM fbw_resource_ai … nsfwLevel >= 2)` |
| `doSwitchToPrevWallpaper` | 在历史记录中循环，**跳过** `isNsfwMaskableItem` 的条目（读列表投影的 `nsfwLevel`） |
| `setAsWallpaper` / 手动设壁纸 | **不过滤** |

代码：`src/main/store/WallpaperManager.mjs`、`src/common/privacyNsfwMask.js`

---

## 5. 浏览页遮罩接入点

| 端 | 文件 |
|----|------|
| 桌面探索 | `ExploreCommon.vue` + `NsfwContentMask.vue` |
| 桌面合集 | `Collections.vue` |
| H5 浏览/搜索 | `useH5ResourceBrowse.mjs`、`H5NsfwContentMask.vue`、`h5/pages/search/index.vue` |

遮罩时部分操作会提示 `privacyNsfwMask.actionBlocked`。

---

## 6. 国际化

- 开关文案：`pages.Setting.privacySpace.enableNsfwContentMask`（如「敏感内容隐藏」）
- 说明含：密码规则、仅展示层、合集/搜索不变、上/下一张壁纸跳过、手动设壁纸不受影响
- 分析 prompt：`ai.prompts.imageAnalysis`（多语言；中英台为软化版）

---

## 7. 与 AI 分析设置的关系

后台 **`ai.concurrency`**（默认 **1**）、**`ai.analysisMaxRetries`**（默认 **1**）仍在配置与 `AiAnalysisManager` 中生效，但 **AI 设置页已移除对应表单项**（勿用 HTML 注释隐藏 Vue 模板，会仍被编译渲染）。详见 [ai-analysis-ux-and-performance.md](./ai-analysis-ux-and-performance.md) §4、§7。

---

## 8. 代码锚点

| 模块 | 路径 |
|------|------|
| 策略常量 | `src/common/privacyNsfwMask.js` |
| 解析联动 | `src/main/ai/AiResponseParser.mjs` → 写入 `fbw_resource_ai` |
| AI 附表 | `src/main/store/resourceAiSql.mjs` |
| 壁纸轮换 | `src/main/store/WallpaperManager.mjs` |
| 搜索（无 hideUnsafe） | `ExploreCommon.vue`、`ResourcesManager.mjs`、`h5_server/api/business.mjs` |
| 合集生成（无 hideUnsafe） | `CollectionsManager.mjs` |
| 隐私设置 UI | `PrivacySpace.vue`、`h5/pages/setting/index.vue` |
| 默认隐私配置 | `src/common/publicData.js` → `privacy.enableNsfwContentMask` |

---

## 9. 验收要点

1. 未设隐私密码时无法打开「敏感内容隐藏」
2. 关闭开关需验证密码
3. 开关+密码：探索/收藏见遮罩；搜索与合集列表仍含敏感项（仅遮罩）
4. 开关开：自动/手动下一张跳过敏感；上一张在历史中跳过；手动设壁纸仍可设敏感图
5. 隐私空间内不遮罩
6. AI 设置页无「内容安全筛选」「后台失败重试次数」「后台分析并发」

---

## 10. 修订记录

| 版本 | 日期 | 说明 |
|------|------|------|
| v1.1 | 2026-05-27 | `nsfwLevel` 迁至 `fbw_resource_ai`；壁纸 SQL 改为 `NOT EXISTS` 子查询；链至数据模型文档 |
| v1.0 | 2026-05-27 | 移除 `enableNsfwCheck`；合并为敏感内容隐藏；壁纸上/下一张过滤；密码与遮罩规则；AI 两项设置 UI 隐藏 |
