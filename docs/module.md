# 功能模块

## 主进程

- [应用管理](main_process.md#应用管理)
- [窗口管理](main_process.md#窗口管理)
- [数据管理](main_process.md#数据管理)
- [子进程服务管理](main_process.md#子进程服务管理)
- [自定义协议](main_process.md#自定义协议)
- [进程通信](main_process.md#进程通信)
- [日志管理](main_process.md#日志管理)
- [缓存管理](main_process.md#缓存管理)
- [应用更新](main_process.md#应用更新)

## 子进程

- [H5 Server](child_process.md#h5-server)：用于启动 Koa 服务，运行H5接口和H5前端。
- [File Server](child_process.md#file-server)：用于启动文件扫描服务，定时刷新目录。

## 渲染进程

- [主窗口](renderer_process.md#主窗口-mainwindow)：探索、搜索、合集、词库、收藏、历史、设置、工具、关于等模块
- [悬浮球](renderer_process.md#悬浮球-suspensionball)：快捷操作壁纸切换
- [预览图片窗口](renderer_process.md#预览图片窗口-viewimagewindow)：独立窗口预览图片
- [动态壁纸窗口](renderer_process.md#动态壁纸窗口-dynamicwallpaperwindow)：渲染视频作为壁纸
- [律动壁纸窗口](renderer_process.md#律动壁纸窗口-rhythmwallpaperwindow)：渲染律动效果作为壁纸

## AI 与隐私（2.0.0+）

- [AI 能力](ai-features.md)：语义搜索、找相似、智能合集、猜你喜欢、后台分析
- [敏感内容隐藏](privacy-and-sensitive-content.md)：浏览遮罩与壁纸轮换过滤
- [图像美学评分](image-aesthetic-scoring.md)：ONNX 本地评分（Legacy 可选）
