# 主窗口侧栏 UX 与基础设施修订

> 整理日期：2026-06-01（§3.5 快捷键 suspend/resume；§7 省电恢复 AI 2026-05-27）  
> 说明：记录主窗口侧栏、快捷键管理器、检查更新通知、工具页等实现约定与代码锚点。正式文档 `docs/renderer_process.md`、`docs/shortcut_guide.md` 部分片段仍偏旧，以本文与源码为准。敏感内容遮罩与壁纸过滤见 [privacy-and-sensitive-content.md](./privacy-and-sensitive-content.md)。

---

## 1. 侧栏折叠手柄（`side-expand-btn`）

### 1.1 行为与位置（保持原设计）

| 项 | 约定 |
|----|------|
| 位置 | `el-aside` 内，`top: 50%`、`right: -18px`，半圆贴在侧栏右缘垂直居中 |
| 显隐 | 默认 `visibility: hidden` + `opacity: 0`；鼠标移入 `.window-container` 时显示 |
| 开关 | 设置项 `enableExpandSideMenu`；状态 `expandSideMenu`（宽 70px / 0） |
| 图标 | 展开：`custom:caret-left`；收起：`custom:caret-right` |

### 1.2 样式（2026-05-31）

- 背景与侧栏一致：`#f6f7f9`（各状态不改为纯白）
- 无 `box-shadow`、无 `border`
- hover / focus / 收起态：仅箭头使用 `var(--el-color-primary)`
- 扩大点击：`min-height: 44px`、`::before` 扩展热区
- 使用 `<button type="button">` + `aria-expanded`

### 1.3 代码锚点

- `src/renderer/windows/MainWindow/containers/MainWindow.vue`
- 配置默认值：`src/common/publicData.js` → `enableExpandSideMenu`、`expandSideMenu`

---

## 2. 侧栏菜单与底部工具钮（`SideMenu`）

### 2.1 本地快捷键绑定窗口

`publicData.js` 中 **local** 类型快捷键的 `windowNames` 仅为：

```text
['mainWindow', 'viewImageWindow']
```

**不包含** `loadingWindow`、`suspensionBall`（启动 Loading、悬浮球不注册菜单级 local 快捷键）。

### 2.2 Hover 主题色（2026-05-31）

| 区域 | hover 表现 |
|------|------------|
| 菜单项（`side-menu-btn`） | 图标与文字 `var(--el-color-primary)` |
| 底部工具（`side-footer-btn`） | `.footer-btn-icon` → `var(--el-color-primary)` |
| 底部「开启」态 | `.footer-btn-icon.active` → `var(--el-color-success)`（替代写死 `#67c23a`） |
| 关闭动态/律动壁纸按下 | 仍为红色（`btn-close`） |

### 2.3 代码锚点

- `src/renderer/windows/MainWindow/components/SideMenu.vue`
- 窗口生命周期注册：`MainWindow.mjs`、`ViewImageWindow.mjs`（`registerLocalShortcuts` / `unregisterLocalShortcuts`）

---

## 3. 快捷键管理器（`ShortcutManager`）

### 3.1 分层

| 类型 | 机制 | 典型能力 |
|------|------|----------|
| `global` | `electron.globalShortcut` | 切壁纸、显隐主窗/悬浮球（后台也可触发） |
| `local` | `electron-localshortcut` | 退出、关窗、打开设置等（**窗口有焦点**时） |

### 3.2 设计决策：`quitApp` 保持 local

- **不**改为 global，避免 macOS `Command+Q` / Win `Ctrl+Q` 与系统及其他应用抢键。
- 主窗 `hide()` 到托盘后，快捷键退出可能无效 → 使用托盘/菜单「退出」。
- 托盘场景不依赖全局 `quitApp`。

### 3.3 登记表复合键（P0 修复）

`registeredShortcuts` Map 键格式：

```text
global:{name}
local:{name}:{winName}
```

避免多窗口 local 同 `name` 互相覆盖导致注销残留。

### 3.4 全局注册与冲突检测

- `globalShortcut.register()` 检查返回值，失败打 warn 且不写入 Map。
- `detectGlobalConflicts`：`isRegistered` 为真且归属本应用同一 global 项 → 不报「系统冲突」。
- `checkShortcutConflict`：先应用内冲突，再系统冲突；排除本应用已占用的 global。
- `before-quit`：`unregisterAllShortcuts()`（`src/main/index.mjs`）。

### 3.5 设置页录制（2026-06-01）

**目的：** 录制快捷键时卸载全局/本地键，避免与系统键冲突、让 `isRegistered` 检测更准确。

**IPC 与主进程：**

| IPC | 主进程方法 | 行为 |
|-----|------------|------|
| `main:disableShortcuts` | `suspendShortcutsForRecording()` | 引用计数 +1；**仅首次** `unregisterAllShortcuts()` |
| `main:enableShortcuts` | `resumeShortcutsAfterRecording()` | 引用计数 -1；**归零后**重注册全局 + 各窗口 local（不再先全量注销） |

**渲染进程（`ShortcutSetting.vue`）：**

| 时机 | 行为 |
|------|------|
| 输入框 `@focus` | `suspendShortcuts()`（本地 `shortcutsSuspended` 守卫，避免重复 IPC） |
| 输入框 `@blur` / 录键结束 | 仅当曾 suspend 时 `resumeShortcuts()` |
| `resetForm` / `onBeforeUnmount` | **仅**正在录键或已 suspend 时恢复 |
| 切换设置 tab / 进出设置页（未录键） | **不**触发 disable/enable |

**修复前问题：** 切 tab、离开设置页、`resetForm` 无条件调用 `enableShortcuts()` → 主进程 `registerAllShortcuts()` 先全量注销再注册，日志反复出现「所有快捷键已注销」。

**注意：** 应用退出时仍由 `before-quit` → `unregisterAllShortcuts()`（与录键 suspend 无关）。

### 3.6 代码锚点

| 模块 | 路径 |
|------|------|
| 管理器 | `src/main/store/ShortcutManager.mjs` |
| 默认配置 | `src/common/publicData.js` → `keyboardShortcuts` |
| IPC | `src/main/store/index.mjs` |
| 设置 UI | `src/renderer/.../ShortcutSetting.vue` |

---

## 4. 检查更新与通知（`Updater`）

### 4.1 问题与修复摘要

| 问题 | 处理 |
|------|------|
| `global.FBW.notificationManager` 不存在 | 使用 `global.FBW.store.notificationManager` |
| Updater 在 Store 前绑定事件 | `new Updater()` + `bindUpdaterEvents()` 移到 `waitForInitialization()` 之后 |
| 更新失败未通知 / 崩溃 | `error` 回调发系统通知；`checkForUpdates().catch()` 避免未捕获 rejection |
| 开发环境 `ERR_CONNECTION_REFUSED` | 仍提示「检查更新失败」；日志说明 dev 需可访问 `dev-app-update.yml` |

### 4.2 代码锚点

- `src/main/updater.mjs` — `checkUpdate()` 包装 Promise
- `src/main/index.mjs` — `sendUpdateNotification()`、`bindUpdaterEvents()`
- `src/main/store/NotificationManager.mjs` — `send(options, name?)`

---

## 5. 工具页（`Utils.vue`）

| 项 | 说明 |
|----|------|
| 清空 AI | 数据工具 →「清空 AI 分析数据」→ IPC `resetAiAnalysis`（全库图片） |
| 确认文案 | `pages.Utils.clearAiAnalysisDataConfirm`（HTML 确认框） |
| 成功提示 | 展示主进程返回的 `res.message`（已含 `{count}` 插值） |
| 关联文档 | [ai-analysis-ux-and-performance.md](./ai-analysis-ux-and-performance.md) §14 · [data-model-resources-and-ai.md](./data-model-resources-and-ai.md) |

---

## 6. 验收要点

### 侧栏

- [ ] 移入主窗口后，折叠钮在侧栏右缘中部出现，背景与侧栏同色
- [ ] 折叠/展开不遮挡菜单文字；底部图标 hover 为主题色
- [ ] 悬浮球、Loading 窗无 local 菜单快捷键

### 快捷键

- [ ] 主窗 + 看图窗分别注销后无幽灵 `quitApp`
- [ ] 设置页冲突检测不把本应用 global 误报为系统占用
- [ ] **进出设置页、切换设置 tab（未录键）**：日志无「所有快捷键已注销」
- [ ] **仅 focus 快捷键输入框录键时**：注销一次；blur 后恢复一次
- [ ] `Ctrl+Shift+R` 检查更新：dev 可失败但有通知，无 `reading 'send'` 异常

---

## 7. 省电模式与后台 AI（基础设置）

| 项 | 说明 |
|----|------|
| 设置入口 | **设置 → 基础设置** →「省电模式」（`BaseSetting.vue` → `settingData.powerSaveMode`） |
| 生效条件 | **仅**「省电模式开启 **且** 当前用电池」时暂停后台任务（`isPowerSaveOnBattery()`） |
| 暂停范围 | `taskScheduler.clearAllTasks()`：含 AI 分析、画面向量、壁纸切换、目录刷新、系统策展等 |
| 恢复 | 关闭省电开关 → `restartPowerSaveDependentTasks`；插 AC（曾暂停）→ `resumeBackgroundAiTasksIfAllowed` |
| 详细行为 | 见 [ai-analysis-ux-and-performance.md](./ai-analysis-ux-and-performance.md) **§4.2** · [ai-dev-plan.md](./ai-dev-plan.md) **§18** |

### 7.1 验收

- [ ] 电池 + 省电：AI 进度卡「等待中」或 pump 停止  
- [ ] **仅关省电**（不改 AI 设置）：自动恢复「运行中」  
- [ ] 插 AC 后定时任务恢复（若曾因电池省电暂停）

### 7.2 代码锚点

| 模块 | 路径 |
|------|------|
| 省电开关 UI | `src/renderer/.../Setting/components/BaseSetting.vue` |
| 电源与恢复 | `src/main/store/index.mjs` → `setupPowerMonitor`、`restartPowerSaveDependentTasks`、`resumeBackgroundAiTasksIfAllowed` |

---

## 8. 修订记录

| 日期 | 说明 |
|------|------|
| **2026-05-27** | §7 省电模式与后台 AI 恢复；链至 ai-analysis §4.2、ai-dev-plan §18 |
| **2026-06-01** | §3.5 录键 suspend/resume 引用计数；渲染端 `shortcutsSuspended` 守卫；修复切设置 tab/进出设置页误触发全量重注册 |
| 2026-05-27 | §5 工具页「清空 AI 分析数据」；链至数据模型与分析 UX 文档 |
| 2026-05-31 | 初版：侧栏折叠钮样式、SideMenu hover 主题色、ShortcutManager 复合键与冲突检测、Updater 通知修复 |
| 2026-05-27 | 索引：链至 `privacy-and-sensitive-content.md`（敏感遮罩与壁纸上/下一张过滤） |
