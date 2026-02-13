# 快捷键功能使用指南

## 1. 功能概述

飞鸟壁纸提供了快捷键功能，允许用户通过键盘快速执行各种操作，提高使用效率。本指南将详细介绍如何使用和自定义这些快捷键。

## 2. 内置快捷键

### 2.1 基础系统操作

| 功能         | macOS     | Windows | Linux  |
| ------------ | --------- | ------- | ------ |
| 完全退出应用 | Command+Q | Ctrl+Q  | Ctrl+Q |

### 2.2 窗口操作

| 功能            | macOS           | Windows      | Linux        |
| --------------- | --------------- | ------------ | ------------ |
| 关闭当前窗口    | Command+W       | Ctrl+W       | Ctrl+W       |
| 最小化当前窗口  | Command+M       | Win+M        | Super+H      |
| 显示/隐藏主窗口 | Command+Shift+M | Ctrl+Shift+M | Ctrl+Shift+M |
| 显示/隐藏悬浮球 | Command+Shift+B | Ctrl+Shift+B | Ctrl+Shift+B |

### 2.3 壁纸管理

| 功能             | macOS               | Windows          | Linux            |
| ---------------- | ------------------- | ---------------- | ---------------- |
| 切换到下一张壁纸 | Command+Shift+Right | Ctrl+Shift+Right | Ctrl+Shift+Right |
| 切换到上一张壁纸 | Command+Shift+Left  | Ctrl+Shift+Left  | Ctrl+Shift+Left  |
| 切换自动壁纸模式 | Command+Shift+A     | Ctrl+Shift+A     | Ctrl+Shift+A     |

### 2.4 设置管理

| 功能     | macOS           | Windows      | Linux        |
| -------- | --------------- | ------------ | ------------ |
| 打开设置 | Command+,       | Ctrl+,       | Ctrl+,       |
| 打开工具 | Command+Shift+U | Ctrl+Shift+U | Ctrl+Shift+U |
| 打开关于 | Command+Shift+I | Ctrl+Shift+I | Ctrl+Shift+I |
| 检查更新 | Command+Shift+R | Ctrl+Shift+R | Ctrl+Shift+R |

## 3. 自定义快捷键

### 3.1 访问快捷键设置

1. 打开飞鸟壁纸主窗口
2. 点击左侧菜单中的「设置」选项
3. 在设置页面中找到「快捷键设置」选项
4. 点击进入快捷键设置界面

### 3.2 修改快捷键

1. 在快捷键设置界面中，找到想要修改的快捷键
2. 点击可编辑的输入框
3. 按下想要设置的快捷键组合
4. 系统会自动检测是否有冲突
5. 失去焦点后系统会自动保存修改

### 3.3 重置快捷键

1. 在快捷键设置界面中，找到想要重置的快捷键
2. 点击「重置」按钮
3. 快捷键会恢复为默认值

### 3.4 清空快捷键

1. 在快捷键设置界面中，找到想要清空的快捷键
2. 点击「清空」按钮
3. 快捷键会被清空

## 4. 冲突检测与处理

### 4.1 冲突类型

- **系统冲突**：快捷键与系统或其他应用的快捷键冲突
- **应用内冲突**：快捷键在应用内部重复使用

### 4.2 冲突处理

1. 当检测到冲突时，系统会在表格中高亮显示冲突的行
2. 点击冲突的快捷键输入框
3. 按下新的快捷键组合
4. 系统会自动检测新的快捷键是否有冲突
5. 失去焦点后系统会自动保存修改

## 5. 技术实现

### 5.1 核心组件

- **ShortcutManager**：快捷键管理器，负责注册、管理和处理快捷键
- **publicData.js**：快捷键配置文件，定义默认快捷键映射
- **Setting.vue**：快捷键设置界面组件

### 5.2 实现原理

1. **快捷键注册**：应用启动时，ShortcutManager 会根据当前平台注册相应的快捷键
2. **事件处理**：当用户按下快捷键时，系统会触发相应的处理函数
3. **配置存储**：用户自定义的快捷键会存储在应用设置中
4. **冲突检测**：系统会定期检测快捷键冲突并提醒用户

## 6. 使用示例

### 6.1 示例1：快速切换壁纸

1. 按下 `Command+Shift+Right` (macOS) 或 `Ctrl+Shift+Right` (Windows/Linux) 切换到下一张壁纸
2. 按下 `Command+Shift+Left` (macOS) 或 `Ctrl+Shift+Left` (Windows/Linux) 切换到上一张壁纸

### 6.2 示例2：快速打开设置

1. 按下 `Command+,` (macOS) 或 `Ctrl+,` (Windows/Linux) 快速打开设置面板
2. 在设置面板中调整应用配置

### 6.3 示例3：自定义快捷键

1. 打开快捷键设置界面
2. 找到「显示/隐藏主窗口」选项
3. 点击输入框
4. 按下 `Command+K` (macOS) 或 `Ctrl+K` (Windows/Linux)
5. 系统会自动保存新的快捷键设置
6. 现在可以使用新的快捷键快速显示/隐藏主窗口

## 7. 常见问题

### 7.1 快捷键不生效

- 检查是否有其他应用占用了相同的快捷键
- 检查快捷键设置是否正确
- 重启应用后再次尝试

### 7.2 无法修改快捷键

- 确保当前用户有足够的权限
- 检查是否有系统限制阻止修改快捷键
- 尝试使用不同的快捷键组合

### 7.3 快捷键冲突

- 选择一个不常用的快捷键组合
- 检查系统设置中是否有冲突的快捷键
- 尝试使用更多修饰键的组合

## 8. 开发集成

### 8.1 在代码中使用快捷键

```javascript
// 导入快捷键管理器
import ShortcutManager from './utils/ShortcutManager.mjs'

// 初始化快捷键管理器
const shortcutManager = ShortcutManager.getInstance(logger, settingManager)
await shortcutManager.initialize()

// 获取当前平台的快捷键
const platformShortcuts = shortcutManager.getPlatformShortcuts()

// 检测冲突
const conflicts = shortcutManager.detectConflicts()

// 更新快捷键
const result = await shortcutManager.updateShortcut('toggleMainWindow', 'Command+K')
```

### 8.2 扩展快捷键

1. 在 `src/common/publicData.js` 文件中的 `keyboardShortcuts` 数组中添加新的快捷键定义
2. 在 `ShortcutManager.mjs` 的 `handleShortcut` 方法中添加相应的处理逻辑
3. 重新启动应用使新快捷键生效

## 9. 总结

快捷键功能是飞鸟壁纸的重要特性之一，通过合理使用快捷键，可以大大提高操作效率。用户可以根据自己的习惯自定义快捷键，系统会自动处理冲突，确保快捷键的正常使用。

如果您在使用过程中遇到任何问题，请参考本指南或联系官方支持。

---

**版本信息**：飞鸟壁纸 v1.3.7+
**最后更新**：2026-02-09
