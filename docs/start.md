# 快速开始

## 目录结构

```
Flying-Bird-Wallpaper/
├── CHANGELOG.md                # 更新日志
├── dev-app-update.yml          # 应用更新配置
├── electron-builder.yml        # Electron打包配置
├── electron.vite.config.mjs    # Electron Vite配置
├── eslint.config.mjs           # ESLint配置
├── h5.vite.config.mjs          # H5 Vite配置
├── LICENSE                     # 许可证
├── package-lock.json           # 依赖锁定文件
├── package.json                # 项目依赖
├── README.md                   # 项目说明
├── resources/                  # 资源文件
│   ├── api/                    # 各类壁纸API集成模块
│   ├── icons/                  # 应用图标资源
│   ├── lib/                    # 原生库文件
│   ├── loading.html            # 加载页
│   ├── migrations/             # 数据迁移脚本
│   └── plugin-templates/       # 插件模板
├── scripts/                    # 构建和工具脚本
├── src/                        # 源代码
│   ├── common/                 # 共享配置与数据
│   ├── h5/                     # H5前端
│   │   ├── api/                # H5请求API
│   │   ├── assets/             # H5静态资源
│   │   ├── components/         # H5组件
│   │   ├── pages/              # H5页面
│   │   ├── public/             # H5公共资源
│   │   ├── stores/             # H5状态管理
│   │   ├── utils/              # H5工具函数
│   │   ├── App.vue             # H5主入口组件
│   │   ├── index.html          # H5入口HTML
│   │   └── main.js             # H5入口文件
│   ├── i18n/                   # 国际化
│   │   ├── i18next.js          # i18next配置
│   │   ├── locale/             # 语言包
│   │   ├── server.js           # 服务端i18n
│   │   └── web.js              # 网页端i18n
│   ├── main/                   # Electron主进程
│   │   ├── ApiBase.js          # API基类
│   │   ├── cache.mjs           # 缓存管理
│   │   ├── child_server/       # 子进程服务
│   │   ├── jobs/               # 定时任务
│   │   ├── logger.mjs          # 日志系统
│   │   ├── store/              # 主进程数据存储
│   │   ├── updater.mjs         # 自动更新
│   │   ├── utils/              # 主进程工具函数
│   │   └── windows/            # Electron窗口管理
│   ├── preload/                # 预加载脚本
│   └── renderer/               # 渲染进程
│       ├── assets/             # 前端资源
│       ├── components/         # 公共组件
│       ├── stores/             # 渲染进程状态管理
│       ├── utils/              # 渲染进程工具函数
│       └── windows/            # 多窗口页面
```

---

## 脚本命令

| 脚本命令                | 说明                                                     |
| ----------------------- | -------------------------------------------------------- |
| npm run clean           | 清理 out 和 dist 目录                                    |
| npm run format          | 使用 Prettier 格式化全项目代码                           |
| npm run lint            | 使用 ESLint 检查并自动修复代码风格问题                   |
| npm run build:h5_watch  | 以 watch 模式持续构建 H5 端（开发用）                    |
| npm run build:h5        | 构建 H5 端静态资源（生产环境）                           |
| npm run preview:app     | 清理、构建 H5 后，预览 Electron 应用（跨平台）           |
| npm run preview:app_win | Windows 下清理、构建 H5 后，预览 Electron 应用           |
| npm run dev             | 并行 watch H5 构建和启动 Electron 开发环境（主开发命令） |
| npm run dev:win         | Windows 下并行 watch H5 构建和启动 Electron 开发环境     |
| npm run build:app       | 构建 Electron 应用（主进程/渲染进程）                    |
| npm run build           | 清理、构建 H5 和 Electron 应用（完整打包流程）           |
| npm run postinstall     | 安装 Electron 依赖（自动执行）                           |
| npm run version         | 运行版本号自动更新脚本（eg: npm run version 1.0.0）      |
| npm run build:unpack    | 构建应用并生成未打包目录（便于调试）                     |
| npm run build:win       | 构建 Windows 安装包                                      |
| npm run build:mac       | 构建 macOS 安装包                                        |
| npm run build:linux     | 构建 Linux 安装包                                        |
| npm run changelog       | 生成/更新 CHANGELOG.md（基于 conventional-changelog）    |
| npm run changelog:first | 生成完整的 CHANGELOG.md（首次/全量）                     |

> 说明：大部分开发、调试、打包相关操作都可通过上述脚本一键完成，建议开发者优先使用这些脚本而非手动命令。

---

## 本地开发

1. **安装依赖**
   ```bash
   npm install
   ```
2. **本地开发**
   - 启动 Electron 桌面端：
     ```bash
     npm run dev
     # Windows 下可以运行 npm run dev:win 避免命令行中文乱码
     ```
   - 代码修改后支持热更新。
3. **代码规范**
   - 建议遵循 ESLint/Prettier 规范，提交前可运行 `npm run lint` 检查。
   - 采用模块化开发，组件/页面/状态管理分层清晰。

---

## 本地打包

- **H5 端打包**
  ```bash
  npm run build:h5
  # 生成的静态文件在 out/h5 目录，后续应用打包时会 copy 进 resources 目录
  ```
- **Electron 桌面端打包**
  - Windows:
    ```bash
    npm run build:win
    ```
  - macOS:
    ```bash
    npm run build:mac
    ```
  - Linux:
    ```bash
    npm run build:linux
    ```
  - 打包产物在 `dist/` 目录，包含安装包和可执行文件。

---

## 发布

项目采用 Github Actions 自动化打包与发布，推荐的发布流程如下：

1. **更新版本号**

   使用脚本自动更新 `package.json`、`electron-builder.yml` 等相关文件中的版本号：

   ```bash
   npm run version 1.2.3   # 例如将版本号更新为 1.2.3
   ```

2. **提交代码并推送**

   ```bash
   git add .
   git commit -m "release: v1.2.3"
   git push origin <your-branch>
   ```

3. **创建 Git Tag 并推送**

   ```bash
   git tag v1.2.3
   git push origin v1.2.3
   ```

4. **Github Actions 自动打包**

   推送 tag 后，Github Actions 会自动触发打包流程，自动构建 Windows/macOS/Linux 安装包，并在 Release 页面生成对应的安装包和变更日志。

5. **检查 Release 页面**

   打包完成后，可在 Github Releases 页面下载各平台的安装包和查看自动生成的 CHANGELOG。

> 注意：如需自定义打包流程或发布内容，可修改 `.github/workflows/` 目录下的 CI 配置文件。

---

## 其他建议

- 推荐使用 VSCode + Volar 插件进行 Vue3 开发。
- 多语言/主题/壁纸源等均支持扩展，详见各自目录下的 README 或注释。
- 如需二次开发或贡献代码，请先阅读主仓库的 `CONTRIBUTING.md`（如有）。

---

如有问题可在 Issues 区反馈，欢迎 Star & PR！
