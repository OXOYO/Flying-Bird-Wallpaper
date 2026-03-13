---
name: 代码规范与质量控制
description: 指导开发者如何遵循Flying Bird Wallpaper项目的代码规范和质量要求
---

# 代码规范与质量控制

## 描述
本技能用于指导开发者如何遵循Flying Bird Wallpaper项目的代码规范、进行代码质量控制以及提交代码。

## 使用场景
- 开发者需要了解项目的代码规范
- 开发者在提交代码前需要检查代码质量
- 团队需要确保代码风格的一致性

## 指令

### 1. 代码规范工具
- **ESLint**: 用于检查JavaScript/TypeScript代码的语法和风格问题
- **Prettier**: 用于自动格式化代码，确保代码风格一致
- **EditorConfig**: 用于统一编辑器配置

### 2. 运行代码规范检查

#### 格式化代码
```bash
npm run format
# 使用Prettier格式化全项目代码
```

#### 检查并修复代码风格
```bash
npm run lint
# 使用ESLint检查并自动修复代码风格问题
```

### 3. 代码规范要点

#### JavaScript/TypeScript规范
- 使用ES模块语法（`import`/`export`）
- 优先使用箭头函数
- 使用`const`/`let`，避免使用`var`
- 遵循函数式编程原则，避免副作用
- 代码缩进使用2个空格

#### Vue3规范
- 组件命名使用大驼峰命名法（PascalCase）
- 模板中使用短横线命名法（kebab-case）引用组件
- 使用Composition API
- 组件拆分遵循单一职责原则
- 合理使用Pinia进行状态管理

#### CSS/SCSS规范
- 使用BEM命名规范
- 避免使用`!important`
- 合理使用SCSS变量和混合宏
- 保持CSS选择器简洁

### 4. 提交代码规范

#### 提交信息格式
项目采用Conventional Commits规范，提交信息格式为：
```
type(scope?): subject

body?

footer?
```

**类型（type）**：
- `feat`: 新功能
- `fix`: 修复bug
- `docs`: 文档更新
- `style`: 代码风格修改
- `refactor`: 代码重构
- `perf`: 性能优化
- `test`: 测试相关
- `chore`: 构建过程或辅助工具的变动

**示例**：
```
feat: 添加壁纸自动切换功能

fix: 修复壁纸加载失败的问题
docs: 更新README文档
refactor: 重构壁纸管理模块
```

#### 生成CHANGELOG
```bash
# 生成最新的CHANGELOG条目
npm run changelog

# 生成完整的CHANGELOG（首次使用）
npm run changelog:first
```

### 5. 质量控制建议
- 提交代码前务必运行`npm run lint`和`npm run format`
- 编写清晰的注释，特别是复杂的逻辑
- 保持函数简洁，单一函数只做一件事
- 合理使用类型定义，提高代码的可维护性
- 定期进行代码重构，优化代码结构

## 示例

### 提交代码流程示例
```bash
# 1. 确保代码规范
npm run format
npm run lint

# 2. 添加修改的文件
git add .

# 3. 提交代码，使用规范的提交信息
git commit -m "feat: 添加新的壁纸API集成"

# 4. 推送代码
git push origin <branch-name>
```