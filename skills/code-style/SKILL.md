---
name: 'code-style'
description: '指导开发者如何遵循Flying Bird Wallpaper项目的代码规范和质量要求。当用户需要了解代码风格、命名约定和最佳实践时调用。'
---

# 代码规范

## 功能说明

本技能指导开发者如何遵循飞鸟壁纸项目的代码规范和质量要求，包括代码风格、命名约定、文件结构和最佳实践。

## 代码风格

### 1. 缩进与空格

- **缩进**：使用 2 个空格进行缩进
- **行尾空格**：禁止行尾空格
- **空行**：在函数、类、逻辑块之间使用空行分隔
- **括号空格**：在括号内侧添加空格

```javascript
// 正确
if (condition) {
  // 代码
}

// 错误 - 注意：下面的代码故意不遵循规范，用于展示错误示例
// prettier-ignore
if(condition){
  // 代码
}
```

### 2. 命名约定

- **变量**：使用小驼峰命名法 (`camelCase`)
- **常量**：使用大驼峰命名法 (`PascalCase`) 或全大写加下划线 (`SNAKE_CASE`)
- **函数**：使用小驼峰命名法 (`camelCase`)
- **类**：使用大驼峰命名法 (`PascalCase`)
- **文件**：使用小写字母和连字符 (`kebab-case`)
- **目录**：使用小写字母和连字符 (`kebab-case`)

```javascript
// 变量
const userName = 'John'

// 常量
const MAX_COUNT = 100
const ConfigManager = { ... }

// 函数
function getUserInfo() { ... }

// 类
class WallpaperManager { ... }

// 文件
api-integration.js

// 目录
src/main/utils/
```

### 3. 引号

- **字符串**：使用单引号 (`'`)
- **模板字符串**：使用反引号 (\`)

```javascript
// 正确
const name = 'John'
const message = `Hello, ${name}!`

// 错误 - 注意：下面的代码故意不遵循规范，用于展示错误示例
// prettier-ignore
const name = "John"
```

### 4. 分号

- **语句结束**：不使用分号结束语句

```javascript
// 正确
const name = 'John'
console.log(name)

// 错误 - 注意：下面的代码故意不遵循规范，用于展示错误示例
// prettier-ignore
const name = 'John';
// prettier-ignore
console.log(name);
```

### 5. 大括号

- **位置**：大括号放在行尾，与语句同一行
- **单行语句**：即使是单行语句也使用大括号

```javascript
// 正确
if (condition) {
  console.log('Condition is true')
}

// 错误
if (condition) console.log('Condition is true')
```

## 代码结构

### 1. 文件结构

- **文件大小**：单个文件不超过 500 行
- **模块划分**：每个文件应该只包含一个主要功能或类
- **导入顺序**：按照以下顺序组织导入：
  1. 外部依赖
  2. 内部模块
  3. 相对路径导入

```javascript
// 外部依赖
import axios from 'axios'
import { createI18n } from 'i18next-vue'

// 内部模块
import ApiBase from '../../src/main/ApiBase.js'

// 相对路径导入
import utils from './utils.js'
```

### 2. 函数结构

- **函数长度**：单个函数不超过 50 行
- **参数数量**：函数参数不超过 5 个
- **默认参数**：使用默认参数值
- **箭头函数**：优先使用箭头函数，特别是在回调中

```javascript
// 正确
const getUserInfo = (id, options = {}) => {
  const { includeDetails = false } = options
  // 代码
}

// 错误
function getUserInfo(id, name, age, address, phone, email) {
  // 代码
}
```

### 3. 类结构

- **类成员顺序**：
  1. 静态属性
  2. 实例属性
  3. 构造函数
  4. 静态方法
  5. 实例方法
  6. 私有方法

```javascript
class WallpaperManager {
  static DEFAULT_INTERVAL = 60000

  constructor() {
    this.wallpapers = []
  }

  static createInstance() {
    return new WallpaperManager()
  }

  async getWallpapers() {
    // 代码
  }

  #privateMethod() {
    // 代码
  }
}
```

## 代码质量

### 1. 错误处理

- **try-catch**：使用 try-catch 捕获可能的错误
- **错误消息**：提供清晰、有意义的错误消息
- **错误传递**：适当传递错误，避免吞掉错误

```javascript
async function fetchData() {
  try {
    const response = await axios.get('https://api.example.com/data')
    return response.data
  } catch (error) {
    console.error('Failed to fetch data:', error.message)
    throw new Error(`Data fetch failed: ${error.message}`)
  }
}
```

### 2. 注释

- **函数注释**：使用 JSDoc 格式注释函数
- **复杂逻辑**：为复杂逻辑添加注释
- **文件头部**：为文件添加头部注释，说明文件用途

```javascript
/**
 * 获取壁纸列表
 * @param {string} keyword - 搜索关键词
 * @param {number} page - 页码
 * @returns {Promise<Array>} 壁纸列表
 */
async function getWallpapers(keyword, page) {
  // 复杂逻辑注释
  // 1. 构建请求参数
  // 2. 发送 API 请求
  // 3. 处理响应数据
  // 4. 返回结果
}
```

### 3. 性能优化

- **缓存**：合理使用缓存减少重复计算
- **懒加载**：使用懒加载减少初始加载时间
- **防抖节流**：对频繁触发的事件使用防抖或节流

```javascript
// 防抖函数
function debounce(func, wait) {
  let timeout
  return function (...args) {
    clearTimeout(timeout)
    timeout = setTimeout(() => func.apply(this, args), wait)
  }
}

// 缓存函数
function memoize(func) {
  const cache = new Map()
  return function (...args) {
    const key = JSON.stringify(args)
    if (cache.has(key)) {
      return cache.get(key)
    }
    const result = func.apply(this, args)
    cache.set(key, result)
    return result
  }
}
```

## ESLint 配置

项目使用 ESLint 进行代码质量检查，配置通过 `package.json` 中的依赖和脚本实现：

- 使用 `@electron-toolkit/eslint-config` 和 `@vue/eslint-config-prettier` 作为基础配置
- 支持的文件扩展名：`.js, .jsx, .cjs, .mjs, .ts, .tsx, .cts, .mts, .vue`
- 可以通过运行 `npm run lint` 来检查和修复代码质量问题

**相关依赖**：

- `eslint`
- `@babel/eslint-parser`
- `@electron-toolkit/eslint-config`
- `@vue/eslint-config-prettier`
- `eslint-plugin-vue`
- `vue-eslint-parser`

## Prettier 配置

项目使用 Prettier 进行代码格式化，配置文件为 `.prettierrc.yaml`：

```yaml
singleQuote: true
semi: false
printWidth: 100
trailingComma: none
tabWidth: 2
```

## 开发工具配置

### 1. VS Code 配置

项目提供了 VS Code 配置文件 `.vscode/settings.json`：

```json
{
  "editor.tabSize": 2,
  "editor.insertSpaces": true,
  "editor.detectIndentation": false,
  "editor.formatOnSave": true,
  "editor.codeActionsOnSave": {
    "source.fixAll": true
  },
  "prettier.enable": true,
  "eslint.enable": true
}
```

### 2. EditorConfig 配置

项目提供了 EditorConfig 配置文件 `.editorconfig`：

```ini
root = true

[*]
charset = utf-8
indent_style = space
indent_size = 2
end_of_line = lf
insert_final_newline = true
trim_trailing_whitespace = true

[*.md]
trim_trailing_whitespace = false
```

## 最佳实践

1. **保持代码简洁**：避免不必要的复杂性
2. **遵循单一职责**：每个函数和类只负责一个功能
3. **使用 TypeScript**：在可能的情况下使用 TypeScript 增加类型安全性
4. **测试代码**：为关键功能编写测试
5. **代码审查**：定期进行代码审查
6. **文档化**：为公共 API 和复杂功能添加文档

## 常见问题

### 1. 代码格式化

- **问题**：代码格式不一致
- **解决方案**：使用 Prettier 自动格式化代码

### 2. 代码质量

- **问题**：代码质量问题
- **解决方案**：使用 ESLint 检查代码质量，修复发现的问题

### 3. 性能问题

- **问题**：代码性能问题
- **解决方案**：使用性能分析工具，优化关键路径

### 4. 可维护性

- **问题**：代码难以维护
- **解决方案**：遵循代码规范，使用清晰的命名和结构
