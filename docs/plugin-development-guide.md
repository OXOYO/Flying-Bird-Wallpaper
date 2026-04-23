# Flying Bird Wallpaper 资源插件开发指南（最新）

本文档对应当前主项目最新实现，适用于外部插件仓库模式。

## 核心结论

- 应用不再内置 `resources/api` 插件。
- 插件元信息只读 `manifest.json`，不再依赖 `api.info()`。
- 运行时插件统一安装到 `FBW_PLUGINS_PATH/installed/<sourceName>/<pluginName>/`。
- 同名插件通过 `sourceName:pluginName` 区分，不会互相覆盖。
- 文档中的“远程资源”在当前版本中即“资源插件”。

## 插件仓库结构

官方与自定义插件源都必须遵循同一结构：

```text
Flying-Bird-Wallpaper-Plugins/
├── plugins.json
└── plugins/
    ├── birdpaper/
    │   ├── manifest.json
    │   └── main.mjs
    └── unsplash/
        ├── manifest.json
        └── main.mjs
```

## `plugins.json` 格式（严格）

当前仅支持字符串数组格式：

```json
["birdpaper", "unsplash", "pixabay"]
```

不支持对象数组等其他格式。

## `manifest.json` 关键字段

```json
{
  "name": "birdpaper",
  "displayName": "BirdPaper",
  "version": "1.0.0",
  "description": "Birdpaper 搜索插件",
  "author": "OXOYO",
  "site": "https://birdpaper.com.cn/",
  "logo": "logo.png",
  "visible": true,
  "enabled": true,
  "remote": true,
  "requireSecretKey": false,
  "supportSearch": true,
  "supportSearchTypes": ["images"],
  "supportDownload": true,
  "searchRequired": { "keywords": true, "orientation": false },
  "downloadRequired": { "keywords": true, "orientation": false },
  "appVersion": { "min": "1.0.0", "max": "*" }
}
```

说明：

- `name` 必须与目录名一致，且在同一 source 内唯一。
- `logo` 可选；未提供时，应用用插件名首字母占位。
- `visible` 为 `false` 时不会在插件市场显示。
- `supportSearch` / `supportDownload` 决定该插件能否出现在对应资源列表中。

## `main.mjs` 开发约束

- 必须默认导出一个继承 `ApiBase` 的类。
- 不需要、也不应再实现 `info()`。
- 搜索插件至少实现 `search()`；如支持热门词可实现 `getHotTags()`。

示例：

```js
const { axios, ApiBase } = global.FBW.apiHelpers

export default class ResourceDemo extends ApiBase {
  constructor() {
    super('demo')
  }

  async search(query) {
    const { keywords, startPage = 1, pageSize = 20 } = query
    const res = await axios.get('https://example.com/api/search', {
      params: { q: keywords, page: startPage, size: pageSize }
    })
    return {
      startPage,
      pageSize,
      total: res.data.total || 0,
      list: Array.isArray(res.data.items) ? res.data.items : []
    }
  }
}
```

## 插件源与安装行为

- 插件源类型支持：
  - GitHub 仓库（`owner/repo`）
  - 本地目录
- 官方源默认指向：`https://github.com/OXOYO/Flying-Bird-Wallpaper-Plugins`
- 安装、卸载、更新成功后会自动重载插件映射，搜索/下载资源列表会同步更新。

## 密钥配置位置（已变更）

资源密钥不再在基础设置页统一维护。  
当前入口：`设置 -> 插件市场 -> 已安装 -> 配置密钥`。

## 快速自检清单

1. `plugins.json` 是字符串数组。
2. 每个插件目录都包含 `manifest.json` + `main.mjs`。
3. `manifest.name` 与插件目录名一致。
4. 需要参与搜索的插件，`supportSearch` 必须为 `true`。
5. 需要密钥的插件，`requireSecretKey` 为 `true` 且已在“已安装”卡片完成配置。

