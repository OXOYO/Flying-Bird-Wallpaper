# 敏感内容隐藏与内容安全策略（2.0.0+）

> 应用版本：**2.0.0+**  
> 状态：**已实现**

---

## 1. 产品原则

| 能力 | 用户开关 | 数据层 | 展示层 | 壁纸轮换 |
|------|----------|--------|--------|----------|
| **敏感内容隐藏** | `privacy.enableNsfwContentMask` | 等级存 **`fbw_resource_ai.nsfwLevel`**；搜索/合集/H5 **不过滤** | 收藏/探索等 **遮罩**（≥2） | 上/下一张 **跳过** ≥2 |

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
| 未分析资源 | 附表无行或 `nsfwLevel` 为 `NULL` 时 **不遮罩、轮换仍可命中** |

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

实现模块：

- `src/common/privacyNsfwMask.js` — 策略常量与 SQL 片段
- `src/common/composables/usePrivacyNsfwMask.mjs` — 浏览页遮罩与解锁
- `src/common/composables/useNsfwMaskSettingToggle.mjs` — 开/关开关与密码校验

---

## 4. 壁纸切换过滤

| 路径 | 行为 |
|------|------|
| 下一张候选 SQL | `enableNsfwContentMask` 为真时追加 `getNsfwSafeSqlClause('r')` |
| `doSwitchToPrevWallpaper` | 在历史记录中循环，**跳过** `isNsfwMaskableItem` 的条目 |
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

## 6. 代码锚点

| 模块 | 路径 |
|------|------|
| 策略常量 | `src/common/privacyNsfwMask.js` |
| 解析联动 | `src/main/ai/AiResponseParser.mjs` → 写入 `fbw_resource_ai` |
| AI 附表 | `src/main/store/resourceAiSql.mjs` |
| 壁纸轮换 | `src/main/store/WallpaperManager.mjs` |
| 隐私设置 UI | `PrivacySpace.vue`、`h5/pages/setting/index.vue` |
| 默认隐私配置 | `src/common/publicData.js` → `privacy.enableNsfwContentMask` |

关联文档：[AI 能力](./ai-features.md) · [H5 功能](./h5.md) · [渲染进程](./renderer_process.md)
