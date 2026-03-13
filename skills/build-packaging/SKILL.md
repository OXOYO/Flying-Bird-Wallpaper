---
name: 构建与打包
description: 指导开发者如何构建和打包Flying Bird Wallpaper项目
---

# 构建与打包

## 描述

本技能用于指导开发者如何构建和打包Flying Bird Wallpaper项目，生成各平台的安装包。

## 使用场景

- 开发者需要构建生产版本的应用
- 开发者需要为不同平台生成安装包
- 团队需要发布新版本

## 指令

### 1. 构建流程

#### 清理构建目录

```bash
npm run clean
# 清理 out 和 dist 目录
```

#### 构建H5端

```bash
npm run build:h5
# 构建H5端静态资源，生成的文件在 out/h5 目录
```

#### 构建Electron应用

```bash
npm run build:app
# 构建Electron主进程和渲染进程
```

#### 完整构建（推荐）

```bash
npm run build
# 清理、构建H5和Electron应用（完整打包流程）
```

### 2. 打包各平台安装包

#### Windows打包

```bash
npm run build:win
# 构建Windows安装包，生成的文件在 dist/ 目录
```

#### macOS打包

```bash
npm run build:mac
# 构建macOS安装包，生成的文件在 dist/ 目录
```

#### Linux打包

```bash
npm run build:linux
# 构建Linux安装包，生成的文件在 dist/ 目录
```

#### 本地特定环境打包

```bash
# Windows本地打包（使用特定环境配置）
npm run local:build:win

# macOS本地打包（使用特定环境配置）
npm run local:build:mac
```

#### 生成未打包目录（便于调试）

```bash
npm run build:unpack
# 构建应用并生成未打包目录，位于 out/ 目录
```

### 3. 版本管理

#### 更新版本号

```bash
npm run version <version>
# 例如：npm run version 1.2.3
# 自动更新package.json、electron-builder.yml等相关文件中的版本号
```

### 4. 打包配置

#### 主要配置文件

- `electron-builder.yml`: Electron打包的主要配置文件
- `electron.vite.config.mjs`: Electron Vite构建配置
- `h5.vite.config.mjs`: H5 Vite构建配置

#### 自定义打包配置

- 可以修改`electron-builder.yml`中的配置，如应用名称、图标、版本等
- 可以修改构建脚本，添加自定义的构建步骤

### 5. 发布流程

1. **更新版本号**

   ```bash
   npm run version 1.2.3
   ```

2. **提交代码**

   ```bash
   git add .
   git commit -m "release: v1.2.3"
   git push origin <branch>
   ```

3. **创建Git Tag**

   ```bash
   git tag v1.2.3
   git push origin v1.2.3
   ```

4. **GitHub Actions自动打包**
   - 推送tag后，GitHub Actions会自动触发打包流程
   - 自动构建Windows/macOS/Linux安装包
   - 在Release页面生成对应的安装包和变更日志

### 6. 构建注意事项

- 确保Node.js版本符合要求（>=22.12.0）
- 构建前确保代码规范检查通过
- 构建过程中可能需要下载依赖，确保网络通畅
- 不同平台的构建需要在对应平台上进行（或使用CI/CD）

## 示例

### 完整构建和打包示例

```bash
# 1. 更新版本号
npm run version 1.2.3

# 2. 清理、构建H5和Electron应用
npm run build

# 3. 打包Windows安装包
npm run build:win

# 4. 打包macOS安装包
npm run build:mac

# 5. 提交代码和tag
git add .
git commit -m "release: v1.2.3"
git push origin main
git tag v1.2.3
git push origin v1.2.3
```
