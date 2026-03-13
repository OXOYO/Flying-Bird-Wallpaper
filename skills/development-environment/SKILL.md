---
name: 开发环境搭建与运行
description: 指导开发者如何搭建Flying Bird Wallpaper的开发环境和运行项目
---

# 开发环境搭建与运行

## 描述

本技能用于指导开发者如何搭建Flying Bird Wallpaper的开发环境、运行项目以及进行日常开发工作。

## 使用场景

- 新开发者加入项目时，需要快速搭建开发环境
- 开发者在新机器上需要重新配置开发环境
- 开发者需要了解项目的运行流程和开发模式

## 指令

### 1. 环境要求

- Node.js >= 22.12.0
- npm >= 10.0.0
- Git

### 2. 安装依赖

```bash
npm install
```

### 3. 本地开发

- 启动Electron桌面端（推荐）：
  ```bash
  npm run dev
  # Windows下可以运行 npm run dev:win 避免命令行中文乱码
  ```
- 代码修改后支持热更新

### 4. 单独构建H5

```bash
npm run build:h5
# 生成的静态文件在 out/h5 目录
```

### 5. 预览应用

```bash
npm run preview:app
# Windows下可以运行 npm run preview:app_win
```

### 6. 项目结构

- `src/main/` - Electron主进程代码
- `src/renderer/` - Electron渲染进程代码（Vue3）
- `src/h5/` - H5前端代码（Vue3）
- `src/common/` - 共享配置与数据
- `resources/api/` - 各类壁纸API集成模块

### 7. 开发建议

- 使用VSCode + Volar插件进行Vue3开发
- 遵循模块化开发原则，保持代码结构清晰
- 定期运行代码规范检查

## 示例

### 启动开发环境示例

```bash
# 克隆仓库
git clone https://github.com/OXOYO/Flying-Bird-Wallpaper.git
cd Flying-Bird-Wallpaper

# 安装依赖
npm install

# 启动开发环境
npm run dev
```
