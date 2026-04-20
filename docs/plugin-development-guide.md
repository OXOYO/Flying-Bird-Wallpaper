# Flying Bird Wallpaper 插件开发指南

本指南将帮助你为 Flying Bird Wallpaper 应用开发插件。

## 目录

- [快速开始](#快速开始)
- [仓库结构](#仓库结构)
- [插件开发](#插件开发)
- [manifest.json 格式](#manifestjson-格式)
- [main.mjs 接口](#mainmjs-接口)
- [示例插件](#示例插件)
- [测试指南](#测试指南)
- [发布流程](#发布流程)

## 快速开始

### 前置要求

1. **Node.js 环境**：Node.js 16.0 或更高版本
2. **ES6+ 支持**：插件使用 ES6+ 语法
3. **开发工具**：推荐使用 VS Code 或其他现代编辑器
4. **应用版本**：了解目标应用版本和兼容性要求

### 创建第一个插件

1. Fork 本仓库到你的 GitHub 账户
2. 在 `plugins/` 目录下创建你的插件目录
3. 按照插件结构创建必需的文件
4. 编写插件功能代码
5. 测试插件功能
6. 提交 Pull Request

## 仓库结构

```
Flying-Bird-Wallpaper-Plugins/
├── plugins.json                    # 插件清单文件（只包含插件名称）
├── plugins/                      # 插件目录
│   ├── example-plugin/           # 示例插件
│   │   ├── manifest.json          # 插件配置文件
│   │   └── main.mjs              # 插件主文件
│   └── another-example-plugin/    # 另一个示例插件
│       ├── manifest.json
│       └── main.mjs
├── README.md                     # 仓库文档
└── LICENSE                       # 许可证
```

## 插件开发

### 插件结构

每个插件必须包含以下文件：

```
plugin-name/
├── manifest.json    # 插件配置文件（必需）
└── main.mjs        # 插件主文件（必需）
```

### manifest.json 格式

`manifest.json` 是插件的配置文件，必须包含以下字段：

```json
{
  "name": "plugin-name",           // 插件名称（必需，唯一标识符）
  "version": "1.0.0",            // 插件版本（必需，语义化版本）
  "displayName": "插件显示名称",   // 插件显示名称（必需，用户界面显示）
  "description": "插件描述",       // 插件描述（必需，功能说明）
  "author": "作者名称",            // 作者名称（必需）
  "site": "https://...",          // 插件官网（可选）
  "visible": true,                  // 是否在插件市场显示（必需，默认 true）
  "enabled": true,                  // 是否启用（可选，默认 true）
  "appVersion": {                   // 应用版本兼容性（必需）
    "min": "1.0.0",            // 最低支持版本
    "max": "*"                     // 最高支持版本（* 表示无限制）
  }
}
```

#### 字段说明

| 字段 | 类型 | 必需 | 说明 | 示例 |
|------|------|------|------|------|
| name | string | 是 | 插件唯一标识符，只能包含字母、数字、连字符 | "wallpaper-enhancer" |
| version | string | 是 | 插件版本，遵循语义化版本规范 | "1.0.0" |
| displayName | string | 是 | 插件在用户界面显示的名称 | "壁纸增强器" |
| description | string | 是 | 插件功能的详细描述 | "提供多种壁纸切换效果" |
| author | string | 是 | 插件作者或组织名称 | "OXOYO" |
| site | string | 否 | 插件官网或文档链接 | "https://github.com/OXOYO/Flying-Bird-Wallpaper-Plugins" |
| visible | boolean | 是 | 是否在插件市场显示，必须显式设置为 true | true |
| enabled | boolean | 否 | 是否启用插件，默认为 true | true |
| appVersion | object | 是 | 应用版本兼容性范围 | { "min": "1.0.0", "max": "*" } |

#### 版本兼容性

`appVersion` 字段控制插件与应用版本的兼容性：

```json
"appVersion": {
  "min": "1.0.0",    // 最低支持的应用版本
  "max": "*"         // 最高支持的应用版本（* 表示无限制）
}
```

- **min**: 插件支持的应用最低版本
- **max**: 插件支持的应用最高版本（"*" 表示无版本限制）
- **兼容性检查**: 应用会检查当前版本是否在 `[min, max]` 范围内

#### 可见性控制

`visible` 字段控制插件是否在插件市场中显示：

- `visible: true` - 插件在插件市场显示（必须显式设置）
- `visible: false` - 插件不在插件市场显示（隐藏插件）

**重要**：`visible` 字段必须显式设置为 `true` 才会显示，不设置或设置为 `false` 都不会显示。

## main.mjs 接口

插件主文件必须导出以下方法：

### 必需方法

```javascript
export default {
  name: 'plugin-name',        // 插件名称（必须与 manifest.json 一致）
  version: '1.0.0',          // 插件版本（必须与 manifest.json 一致）
  
  async init(context) {       // 初始化插件（必需）
    // context 包含应用上下文信息
    // 在这里进行插件的初始化逻辑
  },
  
  async activate(context) {    // 激活插件（必需）
    // 插件激活时的逻辑
    // 例如：注册事件监听器、创建菜单项等
  },
  
  async deactivate(context) { // 停用插件（必需）
    // 插件停用时的逻辑
    // 例如：清理资源、停止定时任务等
  },
  
  async uninstall(context) {   // 卸载插件（必需）
    // 插件卸载时的逻辑
    // 例如：清理数据、移除菜单项等
  }
}
```

### Context 对象

`context` 对象包含应用上下文信息：

```javascript
{
  app: {                    // 应用实例
    getVersion(): string,    // 获取应用版本
    getPath(): string,      // 获取应用路径
  },
  logger: {                 // 日志记录器
    info(message): void,    // 记录信息
    error(message): void,   // 记录错误
  },
  dbManager: {              // 数据库管理器
    getSysRecord(): Promise, // 获取系统记录
    setSysRecord(): Promise, // 设置系统记录
  },
  settingManager: {          // 设置管理器
    getSettingData(): Promise, // 获取设置数据
  },
  // 其他应用上下文信息...
}
```

### 生命周期

插件的生命周期如下：

1. **init** - 插件加载时调用，用于初始化
2. **activate** - 插件激活时调用，用于启动功能
3. **deactivate** - 插件停用时调用，用于清理资源
4. **uninstall** - 插件卸载时调用，用于完全清理

### 最佳实践

1. **错误处理**：在异步方法中使用 try-catch 捕获错误
2. **日志记录**：使用 `context.logger` 记录重要操作和错误
3. **资源清理**：在 `deactivate` 和 `uninstall` 中清理所有资源
4. **状态管理**：避免在插件中保存状态，使用应用提供的存储
5. **事件监听**：在 `activate` 中注册事件监听器，在 `deactivate` 中移除

## 示例插件

### 示例一：壁纸增强器

#### manifest.json

```json
{
  "name": "wallpaper-enhancer",
  "version": "1.0.0",
  "displayName": "壁纸增强器",
  "description": "提供多种壁纸切换效果，包括淡入淡出、缩放、旋转等",
  "author": "OXOYO",
  "site": "https://github.com/OXOYO/Flying-Bird-Wallpaper-Plugins",
  "visible": true,
  "enabled": true,
  "appVersion": {
    "min": "1.0.0",
    "max": "*"
  }
}
```

#### main.mjs

```javascript
export default {
  name: 'wallpaper-enhancer',
  version: '1.0.0',
  
  async init(context) {
    context.logger.info('壁纸增强器插件初始化')
    
    // 初始化插件配置
    this.config = {
      transitionEffect: 'fade',
      transitionDuration: 1000,
      scaleEffect: false,
      rotateEffect: false
    }
    
    // 从设置中加载用户配置
    try {
      const settings = await context.settingManager.getSettingData()
      if (settings.wallpaperEnhancer) {
        Object.assign(this.config, settings.wallpaperEnhancer)
      }
    } catch (error) {
      context.logger.error('加载插件配置失败:', error)
    }
  },
  
  async activate(context) {
    context.logger.info('壁纸增强器插件激活')
    
    // 注册壁纸切换事件监听器
    this.wallpaperChangeListener = (event) => {
      this.onWallpaperChange(event, context)
    }
    
    // 监听壁纸切换事件
    context.app.on('wallpaper-changed', this.wallpaperChangeListener)
    
    // 应用当前效果
    await this.applyCurrentEffect(context)
  },
  
  async deactivate(context) {
    context.logger.info('壁纸增强器插件停用')
    
    // 移除壁纸切换事件监听器
    if (this.wallpaperChangeListener) {
      context.app.removeListener('wallpaper-changed', this.wallpaperChangeListener)
      this.wallpaperChangeListener = null
    }
    
    // 清理当前效果
    await this.cleanupEffects(context)
  },
  
  async uninstall(context) {
    context.logger.info('壁纸增强器插件卸载')
    
    // 先停用插件
    await this.deactivate(context)
    
    // 清理插件配置
    try {
      await context.settingManager.updateSettingData({
        wallpaperEnhancer: null
      })
    } catch (error) {
      context.logger.error('清理插件配置失败:', error)
    }
  },
  
  async onWallpaperChange(event, context) {
    const { oldWallpaper, newWallpaper } = event
    
    if (!newWallpaper) {
      return
    }
    
    context.logger.info(`壁纸切换: ${oldWallpaper} -> ${newWallpaper}`)
    
    // 应用过渡效果
    await this.applyTransitionEffect(oldWallpaper, newWallpaper, context)
  },
  
  async applyCurrentEffect(context) {
    // 实现当前的壁纸效果
    // 这里可以根据配置应用不同的效果
  },
  
  async applyTransitionEffect(oldWallpaper, newWallpaper, context) {
    // 实现壁纸切换时的过渡效果
    // 例如：淡入淡出、缩放、旋转等
  },
  
  async cleanupEffects(context) {
    // 清理所有效果和资源
  }
}
```

### 示例二：通知增强器

#### manifest.json

```json
{
  "name": "notification-enhancer",
  "version": "1.0.0",
  "displayName": "通知增强器",
  "description": "提供更丰富的通知功能，包括自定义声音、动画效果等",
  "author": "OXOYO",
  "site": "https://github.com/OXOYO/Flying-Bird-Wallpaper-Plugins",
  "visible": true,
  "enabled": true,
  "appVersion": {
    "min": "1.0.0",
    "max": "*"
  }
}
```

#### main.mjs

```javascript
export default {
  name: 'notification-enhancer',
  version: '1.0.0',
  
  async init(context) {
    context.logger.info('通知增强器插件初始化')
    
    // 初始化通知配置
    this.config = {
      customSounds: true,
      soundEnabled: true,
      animationEnabled: true,
      animationType: 'slide'
    }
    
    // 从设置中加载用户配置
    try {
      const settings = await context.settingManager.getSettingData()
      if (settings.notificationEnhancer) {
        Object.assign(this.config, settings.notificationEnhancer)
      }
    } catch (error) {
      context.logger.error('加载插件配置失败:', error)
    }
  },
  
  async activate(context) {
    context.logger.info('通知增强器插件激活')
    
    // 注册通知事件拦截器
    this.notificationInterceptor = (event) => {
      return this.onNotification(event, context)
    }
    
    // 拦截通知事件
    context.notificationManager.interceptNotifications(this.notificationInterceptor)
  },
  
  async deactivate(context) {
    context.logger.info('通知增强器插件停用')
    
    // 移除通知事件拦截器
    if (this.notificationInterceptor) {
      context.notificationManager.removeInterceptor(this.notificationInterceptor)
      this.notificationInterceptor = null
    }
  },
  
  async uninstall(context) {
    context.logger.info('通知增强器插件卸载')
    
    // 先停用插件
    await this.deactivate(context)
    
    // 清理插件配置
    try {
      await context.settingManager.updateSettingData({
        notificationEnhancer: null
      })
    } catch (error) {
      context.logger.error('清理插件配置失败:', error)
    }
  },
  
  async onNotification(event, context) {
    const { title, body, type } = event
    
    // 应用自定义声音
    if (this.config.soundEnabled) {
      await this.playCustomSound(type, context)
    }
    
    // 应用自定义动画
    if (this.config.animationEnabled) {
      await this.applyCustomAnimation(event, context)
    }
  },
  
  async playCustomSound(type, context) {
    // 播放自定义通知声音
  },
  
  async applyCustomAnimation(event, context) {
    // 应用自定义通知动画
  }
}
```

## 测试指南

### 本地测试

1. **创建测试环境**
   ```bash
   # 克隆仓库
   git clone https://github.com/OXOYO/Flying-Bird-Wallpaper-Plugins.git
   
   # 进入插件目录
   cd Flying-Bird-Wallpaper-Plugins/plugins/your-plugin
   ```

2. **测试插件结构**
   ```bash
   # 检查文件结构
   ls -la
   
   # 验证 manifest.json 格式
   cat manifest.json | jq .
   
   # 验证 main.mjs 语法
   node --check main.mjs
   ```

3. **单元测试**
   ```javascript
   // 创建测试文件
   // test/plugin.test.js
   
   import { describe, it, expect, beforeEach, afterEach } from 'vitest'
   
   describe('插件功能测试', () => {
     let mockContext
     
     beforeEach(() => {
       mockContext = createMockContext()
     })
     
     afterEach(() => {
       mockContext.cleanup()
     })
     
     it('应该正确初始化', async () => {
       const plugin = await import('../main.mjs')
       await plugin.init(mockContext)
       expect(mockContext.logger.info).toHaveBeenCalledWith('插件初始化')
     })
     
     it('应该正确激活', async () => {
       const plugin = await import('../main.mjs')
       await plugin.activate(mockContext)
       expect(mockContext.logger.info).toHaveBeenCalledWith('插件激活')
     })
     
     it('应该正确停用', async () => {
       const plugin = await import('../main.mjs')
       await plugin.deactivate(mockContext)
       expect(mockContext.logger.info).toHaveBeenCalledWith('插件停用')
     })
     
     it('应该正确卸载', async () => {
       const plugin = await import('../main.mjs')
       await plugin.uninstall(mockContext)
       expect(mockContext.logger.info).toHaveBeenCalledWith('插件卸载')
     })
   })
   ```

### 集成测试

1. **在应用中测试**
   - 安装插件到应用
   - 验证插件是否正确加载
   - 测试插件功能是否正常工作
   - 检查日志记录是否正确

2. **版本兼容性测试**
   - 测试不同应用版本下的插件行为
   - 验证版本兼容性检查是否正确
   - 测试插件在不兼容版本下的行为

3. **错误处理测试**
   - 测试插件在异常情况下的行为
   - 验证错误日志是否正确记录
   - 测试插件崩溃时的恢复机制

### 测试检查清单

- [ ] 插件文件结构正确
- [ ] manifest.json 格式正确
- [ ] main.mjs 导出所有必需方法
- [ ] init 方法正确初始化
- [ ] activate 方法正确激活功能
- [ ] deactivate 方法正确清理资源
- [ ] uninstall 方法正确清理所有数据
- [ ] 错误处理完善
- [ ] 日志记录完整
- [ ] 版本兼容性检查正确
- [ ] 资源清理完整
- [ ] 与应用其他功能无冲突

## 发布流程

### 1. 准备发布

1. **代码审查**
   - 确保代码符合项目规范
   - 检查是否有安全漏洞
   - 验证错误处理是否完善
   - 确保日志记录是否完整

2. **文档完善**
   - 更新 manifest.json 中的描述
   - 添加使用说明和截图
   - 更新 README.md 文档
   - 添加版本更新日志

3. **版本管理**
   - 遵循语义化版本规范（如 1.0.0, 1.0.1, 1.1.0）
   - 在 manifest.json 中更新版本号
   - 在 main.mjs 中更新版本号
   - 添加版本更新说明

### 2. 提交 Pull Request

1. **创建功能分支**
   ```bash
   git checkout -b feature/your-plugin-name
   ```

2. **提交更改**
   ```bash
   git add .
   git commit -m "feat: 添加新功能"
   ```

3. **推送到 GitHub**
   ```bash
   git push origin feature/your-plugin-name
   ```

4. **创建 Pull Request**
   - 在 GitHub 上创建 Pull Request
   - 填写 PR 模板
   - 等待代码审查

### 3. Pull Request 模板

```markdown
## 插件名称

**插件名称**: your-plugin-name

**插件描述**: 简要描述插件的功能和用途

**变更类型**: 
- [ ] 新功能 (feat)
- [ ] 错误修复 (fix)
- [ ] 文档更新 (docs)
- [ ] 性能优化 (perf)
- [ ] 重构 (refactor)

**变更说明**: 详细描述本次变更的内容

**测试情况**: 
- [ ] 已通过单元测试
- [ ] 已通过集成测试
- [ ] 已在不同版本测试

**截图**: 添加插件功能的截图（如果有）

**相关 Issue**: 关联相关的 Issue（如果有）

**检查清单**:
- [ ] 代码符合项目规范
- [ ] 文档已更新
- [ ] 版本号已更新
- [ ] 测试已通过
- [ ] 无安全漏洞
- [ ] 错误处理完善
- [ ] 日志记录完整
```

### 4. 审核和合并

1. **等待审查**
   - 项目维护者会审查你的代码
   - 可能会提出修改建议
   - 及时响应审查意见

2. **修改代码**
   - 根据审查意见修改代码
   - 确保所有问题都已解决
   - 更新相关文档

3. **合并到主分支**
   - 审核通过后，PR 会被合并到主分支
   - 插件会出现在下一个应用版本中

### 5. 版本发布

1. **自动发布**
   - 插件合并后会自动包含在应用更新中
   - 用户可以通过插件市场安装更新版本

2. **版本标签**
   - 建议使用 Git 标签（如 v1.0.0）
   - 在发布说明中标注重要变更

## 常见问题

### Q: 插件无法加载怎么办？

**A**: 检查以下几点：
1. manifest.json 格式是否正确
2. main.mjs 是否导出所有必需方法
3. 插件名称是否与 manifest.json 一致
4. 查看应用日志中的错误信息

### Q: 插件功能不工作怎么办？

**A**: 检查以下几点：
1. 插件是否已正确激活
2. 查看插件日志中的错误信息
3. 检查插件权限是否足够
4. 测试插件在不同应用版本下的兼容性

### Q: 如何调试插件？

**A**: 使用以下方法：
1. 在插件代码中添加 `context.logger.info()` 调试信息
2. 使用 `context.logger.error()` 记录错误
3. 在应用日志中查看插件相关日志
4. 使用浏览器开发者工具调试前端组件

### Q: 插件会影响应用性能吗？

**A**: 可能会影响，建议：
1. 避免在插件中进行大量计算
2. 使用异步操作避免阻塞主线程
3. 及时清理不再使用的资源
4. 避免频繁的 DOM 操作

### Q: 如何更新插件？

**A**: 按照以下步骤：
1. 在 manifest.json 中更新版本号
2. 在 main.mjs 中更新版本号
3. 更新插件功能代码
4. 测试新版本功能
5. 提交 Pull Request

## 最佳实践

### 1. 代码规范

- 使用 ES6+ 语法
- 遵循项目代码风格
- 添加必要的注释
- 使用有意义的变量名和函数名
- 避免全局变量污染

### 2. 错误处理

- 在所有异步方法中使用 try-catch
- 使用 `context.logger.error()` 记录错误
- 提供有意义的错误信息
- 确保资源在错误情况下也能正确清理

### 3. 资源管理

- 在 `activate` 中创建资源
- 在 `deactivate` 和 `uninstall` 中清理资源
- 避免内存泄漏
- 及时释放不再使用的引用

### 4. 日志记录

- 使用 `context.logger.info()` 记录重要操作
- 使用 `context.logger.error()` 记录错误
- 提供足够的上下文信息
- 避免记录敏感信息

### 5. 版本兼容性

- 在 manifest.json 中正确设置 appVersion
- 测试插件在不同应用版本下的行为
- 处理版本不兼容的情况
- 提供清晰的兼容性说明

### 6. 用户体验

- 提供清晰的功能描述
- 添加使用说明和截图
- 确保插件界面友好
- 处理错误情况并提供反馈

## 许可证

本插件仓库采用 MIT 许可证，允许自由使用、修改和分发插件。

## 支持

如有问题或建议，请：

1. 提交 Issue：https://github.com/OXOYO/Flying-Bird-Wallpaper-Plugins/issues
2. 创建 Pull Request：https://github.com/OXOYO/Flying-Bird-Wallpaper-Plugins/pulls
3. 查看文档：https://github.com/OXOYO/Flying-Bird-Wallpaper-Plugins/wiki

## 更新日志

### v1.0.0 (2026-03-15)

- 初始版本发布
- 提供完整的插件开发指南
- 定义 manifest.json 格式规范
- 定义 main.mjs 接口规范
- 提供示例插件代码
- 实现插件可见性控制
- 实现插件市场集成
