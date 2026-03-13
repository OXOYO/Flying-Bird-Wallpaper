---
name: 多语言支持
description: 指导开发者如何为Flying Bird Wallpaper项目添加新的语言支持或修改现有语言
---

# 多语言支持

## 描述

本技能用于指导开发者如何为Flying Bird Wallpaper项目添加新的语言支持或修改现有语言，确保项目的国际化和本地化。

## 使用场景

- 开发者需要添加新的语言支持
- 开发者需要修改现有语言的翻译
- 团队需要更新多语言资源

## 指令

### 1. 多语言架构

多语言支持模块位于`src/i18n/`目录下，主要包括：

- `locale/` - 语言包目录
- `i18next.js` - i18next配置
- `server.js` - 服务端i18n配置
- `web.js` - 网页端i18n配置

### 2. 语言包结构

语言包文件位于`src/i18n/locale/lang/`目录下，每个语言对应一个JSON文件，命名格式为`<language-code>.json`，例如：`zh-CN.json`、`en-US.json`等。

### 3. 添加新语言支持

#### 步骤1：创建语言包文件

在`src/i18n/locale/lang/`目录下创建一个新的语言包文件，命名格式为`<language-code>.json`，例如：`fr-FR.json`。

#### 步骤2：编写翻译内容

参考现有语言包的结构，编写新语言的翻译内容。语言包采用嵌套JSON结构，按功能模块组织翻译内容。

```json
{
  "appInfo": {
    "appName": "Flying Bird Wallpaper",
    "appDescription": "一款功能丰富的桌面壁纸软件"
  },
  "actions": {
    "search": "搜索",
    "download": "下载",
    "favorite": "收藏",
    "nextWallpaper": "下一张",
    "prevWallpaper": "上一张"
  },
  "messages": {
    "loading": "加载中...",
    "noResults": "没有找到结果",
    "downloadSuccess": "下载成功",
    "downloadFail": "下载失败"
  },
  "pages": {
    "search": {
      "title": "搜索壁纸",
      "placeholder": "输入关键词搜索"
    },
    "favorites": {
      "title": "我的收藏",
      "empty": "暂无收藏"
    }
  }
}
```

#### 步骤3：注册语言包

在`src/i18n/locale/index.js`文件中注册新的语言包：

```javascript
// 导入新的语言包
import frFR from './lang/fr-FR.json'

// 在resources对象中添加新的语言包
export const resources = {
  // 其他语言包
  frFR: {
    translation: frFR
  }
}

// 在localeOptions数组中添加新的语言选项
export const localeOptions = [
  // 其他语言选项
  { label: 'Français', value: 'frFR' }
]
```

### 4. 修改现有语言

#### 步骤1：找到语言包文件

在`src/i18n/locale/lang/`目录下找到需要修改的语言包文件。

#### 步骤2：修改翻译内容

根据需要修改相应的翻译内容，确保翻译准确、自然。

#### 步骤3：测试修改效果

运行开发环境，切换到修改的语言，检查修改效果是否符合预期。

### 5. 使用多语言

在代码中使用多语言功能：

#### 在JavaScript/TypeScript文件中使用

```javascript
import { t } from '../i18n/server.js' // 服务端
// 或
import { t } from '../i18n/web.js' // 网页端

// 使用翻译函数
const title = t('pages.search.title')
const message = t('messages.downloadSuccess')
```

#### 在Vue模板中使用

```vue
<template>
  <div>
    <h1>{{ $t('pages.search.title') }}</h1>
    <p>{{ $t('messages.loading') }}</p>
  </div>
</template>

<script setup>
// 或在Composition API中使用
import { useI18n } from 'i18next-vue'

const { t } = useI18n()
const title = t('pages.search.title')
</script>
```

### 6. 多语言开发要点

- 语言包采用嵌套JSON结构，按功能模块组织
- 翻译内容要准确、自然，符合目标语言的表达习惯
- 保持所有语言包的结构一致，便于维护和扩展
- 避免在翻译内容中硬编码变量，使用i18next的插值功能
- 定期更新和维护语言包，确保翻译内容的准确性

### 7. 多语言测试

在开发过程中，可以使用以下方法测试多语言支持：

1. 运行开发环境：`npm run dev`
2. 在应用设置中切换到不同的语言
3. 检查应用界面上的文字是否正确显示
4. 测试不同语言下的功能是否正常工作

## 示例

### 添加法语支持示例

1. 创建语言包文件：`src/i18n/locale/lang/fr-FR.json`
2. 编写法语翻译内容
3. 在`src/i18n/locale/index.js`中注册法语支持

```javascript
// 导入法语语言包
import frFR from './lang/fr-FR.json'

// 在resources对象中添加法语支持
export const resources = {
  // 其他语言包
  frFR: {
    translation: frFR
  }
}

// 在localeOptions数组中添加法语选项
export const localeOptions = [
  // 其他语言选项
  { label: 'Français', value: 'frFR' }
]
```

### 使用插值功能示例

在语言包中使用占位符：

```json
{
  "messages": {
    "updateAvailable": "发现新版本: {{version}}"
  }
}
```

在代码中使用插值：

```javascript
const message = t('messages.updateAvailable', { version: 'v1.2.3' })
// 输出："发现新版本: v1.2.3"
```
