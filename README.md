<div align="center">

  <h1>飞鸟壁纸 (Flying Bird Wallpaper)</h1>

  <!-- Github star -->
  <a href="https://github.com/OXOYO/Flying-Bird-Wallpaper/stargazers">
    <img src="https://img.shields.io/github/stars/OXOYO/Flying-Bird-Wallpaper.svg" alt="Github star">
  </a>
  <!-- License -->
  <a href="https://github.com/OXOYO/Flying-Bird-Wallpaper/blob/master/LICENSE">
    <img src="https://img.shields.io/github/license/OXOYO/Flying-Bird-Wallpaper.svg" alt="LICENSE">
  </a>
  <!-- Downloads total -->
  <a href="https://github.com/OXOYO/Flying-Bird-Wallpaper/releases">
    <img src="https://img.shields.io/github/downloads/OXOYO/Flying-Bird-Wallpaper/total.svg" alt="total download">
  </a>
  <!-- Release -->
  <a href="https://github.com/OXOYO/Flying-Bird-Wallpaper/releases">  
    <img src="https://img.shields.io/github/v/release/OXOYO/Flying-Bird-Wallpaper" alt="release">
  </a>
  <!-- Workflow status -->
  <a href="https://github.com/OXOYO/Flying-Bird-Wallpaper/actions">
    <img src="https://img.shields.io/github/actions/workflow/status/OXOYO/Flying-Bird-Wallpaper/release.yml" alt="GitHub Actions Workflow Status">
  </a>
  <!-- Commitizen friendly -->
  <a href="http://commitizen.github.io/cz-cli/">
    <img src="https://img.shields.io/badge/commitizen-friendly-brightgreen.svg" alt="Commitizen friendly">
  </a>
  <!-- DeepWiki -->
  <a href="https://deepwiki.com/OXOYO/Flying-Bird-Wallpaper">
    <img src="https://deepwiki.com/badge.svg" alt="Ask DeepWiki">
  </a>

  <h3>English | <a href="https://github.com/OXOYO/Flying-Bird-Wallpaper/blob/main/README_ZH.md">简体中文</a></h3>

  <h3>Download for Mac & Windows</h3>
  <p>
    <a href="https://github.com/OXOYO/Flying-Bird-Wallpaper/releases">
      <img src="https://img.shields.io/badge/GitHub-100000?style=for-the-badge&logo=github&logoColor=white" alt="Download from GitHub" height=40>
    </a>
    <a href="https://sourceforge.net/projects/flying-bird-wallpaper/files/latest/download">
      <img alt="Download from SourceForge" src="https://a.fsdn.com/con/app/sf-download-button" height=40 srcset="https://a.fsdn.com/con/app/sf-download-button?button_size=2x 2x" >
    </a>
  </p>

</div>

## Project Introduction

Flying Bird Wallpaper is a feature-rich desktop wallpaper application that supports multiple wallpaper types including images, videos, rhythm wallpapers, and solid colors, making your desktop unique and vibrant.


## [Preview](https://github.com/OXOYO/Flying-Bird-Wallpaper/blob/main/docs/preview.en.md)

<img width="1020" alt="Search" src="https://raw.githubusercontent.com/OXOYO/Flying-Bird-Wallpaper/main/docs/fbw_search_en.png" />

<img width="1020" alt="Settings" src="https://raw.githubusercontent.com/OXOYO/Flying-Bird-Wallpaper/main/docs/fbw_settings_en.png" />

<img width="390" alt="H5 Home" src="https://raw.githubusercontent.com/OXOYO/Flying-Bird-Wallpaper/main/docs/fbw_h5_home_en.png" />

<img width="390" alt="H5 Settings" src="https://raw.githubusercontent.com/OXOYO/Flying-Bird-Wallpaper/main/docs/fbw_h5_settings_en.png" />

## [Docs](https://github.com/OXOYO/Flying-Bird-Wallpaper/blob/dev/README.md)

> Developer documentation (build, architecture, AI 2.0) lives on the [`dev`](https://github.com/OXOYO/Flying-Bird-Wallpaper/tree/dev) branch.

## Core Features

1. **Multiple Wallpaper Sources** - Integrates high-quality wallpaper sources such as NASA, Unsplash, Pixabay, supports custom wallpaper source plugins, and local directory images.
2. **Smart Search** - Keyword search, filters, and **semantic search** (AI-powered natural language queries in Explore / H5).
3. **AI 2.0** - Configurable vision/text AI analysis (Ollama, OpenAI-compatible APIs): auto tags, titles, aesthetic scores, and background queue processing.
4. **Find Similar** - Visual embedding search (built-in MobileCLIP or remote service) with text boost; available from explore cards and collections.
5. **Smart Collections** - User-created collections via natural language plus **auto-curated** system collections; **For You** recommendations on desktop and H5.
6. **One-Click Management** - Set wallpaper, favorite images, and save locally with one click for efficient operation.
7. **Desktop Floating Ball** - Quickly switch wallpapers without opening the main interface.
8. **H5 Version** - Supports mobile access, browse wallpapers anytime, anywhere; inline video preview with mute toggle.
9. **Multi-language Support** - Built-in multilingual interface (12 languages) to meet international needs.
10. **Auto Update** - Automatically checks for updates to keep the application up to date.
11. **Cross-Platform Compatibility** - Windows (x64 / ARM64) and macOS (Intel / Apple Silicon).
12. **Scheduled Tasks** - Set scheduled wallpaper changes, directory refresh, resource downloads, and automatic desktop background switching.
13. **Word Bank Function** - Automatically generates a word bank through word segmentation for quick keyword search.
14. **History** - Records used wallpapers for easy review and reuse.
15. **Favorites** - Collect your favorite wallpapers and build a personal wallpaper library.
16. **Private Space** - Password-protected private storage; optional **sensitive content masking** for browsing and wallpaper rotation.
17. **Image & Video Preview** - Preview images and videos; fullscreen video close button on hover; card inline playback with mute control.

## Experimental Features

1. **Dynamic Wallpaper** - Supports dynamic wallpapers to add vivid effects to your desktop.
2. **Webpage Wallpaper** - Supports setting web pages as wallpapers for unlimited creativity.
3. **Color wallpaper** - Supports setting solid color wallpaper.
4. **Rhythm wallpaper** - Supports wallpaper with music rhythm effect.

## Tech Stack

- **Electron Framework** - Ensures cross-platform compatibility
- **Vue 3 Frontend** - Builds a modern user interface
- **Modular Design** - Improves application stability
- **Plugin System** - Supports extending new wallpaper sources
- **SQLite Database** - Local storage for user data; **sqlite-vec** for semantic / visual search
- **AI Integration** - Ollama and OpenAI-compatible providers for analysis and embeddings
- **Electron IPC** - Desktop main ↔ renderer communication
- **HTTP REST + SSE** - H5 REST APIs and Server-Sent Events (e.g. settings sync push)

## System Requirements

- **Windows** 10 or above (x64 and ARM64 installers)
- **macOS** 10.15 (Catalina) or above; Intel and Apple Silicon (M series)
- **Memory** 4 GB RAM minimum; 8 GB recommended for AI background analysis

## LICENSE

MIT License

Copyright (c) 2025-present OXOYO

<!-- GitAds-Verify: 2DQDBEC5WHGXH8Q8198DF9OQ85LSRDJ4 -->

## GitAds Sponsored

[![Sponsored by GitAds](https://gitads.dev/v1/ad-serve?source=oxoyo/flying-bird-wallpaper@github)](https://gitads.dev/v1/ad-track?source=oxoyo/flying-bird-wallpaper@github)

## Contact

<div align="left">
    <img src="https://raw.githubusercontent.com/OXOYO/OXOYO/refs/heads/master/contact_me_wx.png" width="200px"/>
    <div>Add me to the group, remark [Project Name]</div>
</div>

## Buy Me a Coffee

[afdian](https://afdian.com/a/OXOYO)
---

| Name | Amount |
|------|------|
| [hantangtouzi](https://github.com/hantangtouzi) | 10￥ |

## Stargazers over time
[![Stargazers over time](https://starchart.cc/OXOYO/Flying-Bird-Wallpaper.svg?variant=adaptive)](https://starchart.cc/OXOYO/Flying-Bird-Wallpaper)

---

Flying Bird Wallpaper, make your desktop brand new!
