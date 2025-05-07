# 飞鸟壁纸

飞鸟壁纸是一款精美图片浏览器，让你轻松浏览、收藏心动美图，并一键设置壁纸，打造独一无二的桌面风格。

## 目录结构

```
Flying-Bird-Wallpaper/
├── .github/                    # GitHub工作流配置
├── .vscode/                    # VS Code编辑器配置
├── build/                      # 构建相关资源
│   ├── Flying-Bird-Wallpaper.iss  # Windows安装程序脚本
│   ├── entitlements.mac.plist  # macOS权限配置
│   └── icon.*                  # 应用图标文件
├── docs/                       # 项目文档
├── resources/                  # 资源文件
│   ├── api/                    # API集成模块
│   │   ├── bing.mjs            # Bing壁纸API
│   │   ├── nasa.mjs            # NASA图片API
│   │   ├── pexels.mjs          # Pexels API
│   │   ├── pixabay.mjs         # Pixabay API
│   │   ├── unsplash.mjs        # Unsplash API
│   │   └── birdpaper.mjs       # Birdpaper API
│   ├── icons/                  # 应用图标资源
│   ├── lib/                    # 原生库文件
│   └── plugin-templates/       # 插件模板
├── scripts/                    # 构建脚本
├── src/                        # 源代码
│   ├── common/                 # 共享代码
│   │   ├── config.js           # 配置文件
│   │   └── publicData.js       # 公共数据
│   ├── h5/                     # H5网页版代码
│   │   ├── api/                # H5请求API
│   │   ├── assets/             # H5静态资源
│   │   ├── components/         # H5组件
│   │   ├── pages/              # H5页面
│   │   ├── stores/             # 状态管理
│   │   └── main.js             # H5入口文件
│   ├── i18n/                   # 国际化
│   │   ├── locale/             # 语言文件
│   │   ├── i18next.js          # i18next配置
│   │   ├── server.js           # 服务端i18n
│   │   └── web.js              # 网页端i18n
│   ├── main/                   # Electron主进程
│   │   ├── child_server/       # 子进程服务
│   │   ├── jobs/               # 定时任务
│   │   ├── store/              # 数据存储
│   │   ├── utils/              # 工具函数
│   │   ├── ApiBase.js          # API基类
│   │   ├── cache.mjs           # 缓存管理
│   │   ├── logger.mjs          # 日志系统
│   │   ├── updater.mjs         # 自动更新
│   │   └── index.mjs           # 主进程入口
│   ├── preload/                # 预加载脚本
│   └── renderer/               # 渲染进程
│       ├── assets/             # 前端资源
│       ├── components/         # UI组件
│       ├── stores/             # 状态管理
│       ├── utils/              # 工具函数
│       └── windows/            # 窗口管理
├── electron.vite.config.mjs    # Electron Vite配置
├── h5.vite.config.mjs          # H5 Vite配置
├── electron-builder.yml        # 应用打包配置
├── package.json                # 项目依赖
└── README.md                   # 项目说明
```

## Project Setup

### Install

```bash
$ npm install
```

### Development

```bash
$ npm run dev
```

### Build

```bash
# For windows
$ npm run build:win

# For macOS
$ npm run build:mac

# For Linux
$ npm run build:linux
```

## LICENSE

MIT License

Copyright (c) 2025-present OXOYO
