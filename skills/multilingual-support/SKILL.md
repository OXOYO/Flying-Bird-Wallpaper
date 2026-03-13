---
name: "multilingual-support"
description: "指导开发者如何为Flying Bird Wallpaper项目添加新的语言支持或修改现有语言。当用户需要国际化功能或修改翻译时调用。"
---

# 多语言支持

## 功能说明

本技能指导开发者如何为飞鸟壁纸项目添加新的语言支持或修改现有语言，包括语言文件的创建、注册和使用。

## 目录结构

多语言相关文件位于 `src/i18n/` 目录下，主要包含以下结构：

```
src/
└── i18n/
    ├── locale/
    │   ├── lang/
    │   │   ├── ar-SA.json
    │   │   ├── de-DE.json
    │   │   ├── en-US.json
    │   │   ├── es-ES.json
    │   │   ├── fr-FR.json
    │   │   ├── it-IT.json
    │   │   ├── ja-JP.json
    │   │   ├── ko-KR.json
    │   │   ├── pt-BR.json
    │   │   ├── ru-RU.json
    │   │   ├── zh-CN.json
    │   │   └── zh-TW.json
    │   └── index.js
    ├── i18next.js
    ├── server.js
    └── web.js
```

## 语言文件结构

每个语言文件是一个 JSON 文件，包含应用中所有需要翻译的文本。文件命名遵循 `语言代码-地区代码.json` 格式，例如 `zh-CN.json` 表示简体中文。

### 语言文件示例

```json
{
  "appInfo": {
    "appName": "飞鸟壁纸",
    "version": "版本",
    "author": "作者"
  },
  "actions": {
    "save": "保存",
    "cancel": "取消",
    "search": "搜索",
    "download": "下载",
    "setAsWallpaper": "设为壁纸",
    "favorite": "收藏",
    "nextWallpaper": "下一张",
    "prevWallpaper": "上一张",
    "autoSwitchWallpaper": {
      "start": "开始自动切换",
      "stop": "停止自动切换"
    }
  },
  "messages": {
    "loading": "加载中...",
    "success": "操作成功",
    "error": "操作失败",
    "noResults": "没有找到结果",
    "networkError": "网络错误",
    "updateAvailable": "发现新版本: {{version}}"
  },
  "pages": {
    "search": "搜索",
    "favorites": "收藏",
    "history": "历史",
    "setting": "设置",
    "about": "关于",
    "utils": "工具",
    "words": "语录"
  },
  "setting": {
    "language": "语言",
    "theme": "主题",
    "autoStart": "开机自启",
    "autoSwitchWallpaper": "自动切换壁纸",
    "switchInterval": "切换间隔",
    "downloadPath": "下载路径",
    "maxDownloadCount": "最大下载数量"
  }
}
```

## 添加新语言

### 1. 创建语言文件

1. 在 `src/i18n/locale/lang/` 目录下创建新的语言文件，命名格式为 `语言代码-地区代码.json`
2. 复制一个现有的语言文件作为模板
3. 将所有文本翻译为目标语言

### 2. 注册语言

在 `src/i18n/locale/index.js` 文件中注册新语言：

```javascript
import arSA from './lang/ar-SA.json';
import deDE from './lang/de-DE.json';
import enUS from './lang/en-US.json';
import esES from './lang/es-ES.json';
import frFR from './lang/fr-FR.json';
import itIT from './lang/it-IT.json';
import jaJP from './lang/ja-JP.json';
import koKR from './lang/ko-KR.json';
import ptBR from './lang/pt-BR.json';
import ruRU from './lang/ru-RU.json';
import zhCN from './lang/zh-CN.json';
import zhTW from './lang/zh-TW.json';
// 导入新语言
import newLang from './lang/new-lang.json';

export default {
  'ar-SA': arSA,
  'de-DE': deDE,
  'en-US': enUS,
  'es-ES': esES,
  'fr-FR': frFR,
  'it-IT': itIT,
  'ja-JP': jaJP,
  'ko-KR': koKR,
  'pt-BR': ptBR,
  'ru-RU': ruRU,
  'zh-CN': zhCN,
  'zh-TW': zhTW,
  // 注册新语言
  'new-lang': newLang
};
```

### 3. 添加语言选项

在应用的设置页面中添加新的语言选项，修改 `src/renderer/windows/MainWindow/pages/Setting.vue` 文件：

```javascript
const languageOptions = [
  { value: 'zh-CN', label: '简体中文' },
  { value: 'zh-TW', label: '繁體中文' },
  { value: 'en-US', label: 'English' },
  { value: 'ja-JP', label: '日本語' },
  { value: 'ko-KR', label: '한국어' },
  { value: 'de-DE', label: 'Deutsch' },
  { value: 'fr-FR', label: 'Français' },
  { value: 'es-ES', label: 'Español' },
  { value: 'it-IT', label: 'Italiano' },
  { value: 'pt-BR', label: 'Português' },
  { value: 'ru-RU', label: 'Русский' },
  { value: 'ar-SA', label: 'العربية' },
  // 添加新语言选项
  { value: 'new-lang', label: '新语言名称' }
];
```

## 修改现有语言

### 1. 查找语言文件

在 `src/i18n/locale/lang/` 目录下找到需要修改的语言文件。

### 2. 更新翻译

编辑语言文件，修改需要更新的翻译文本。

### 3. 验证修改

启动应用，切换到修改的语言，验证翻译是否正确。

## 翻译最佳实践

1. **保持一致性**：同一概念在整个应用中使用相同的翻译
2. **考虑文化差异**：某些表达可能在不同文化中有不同含义
3. **保持简洁**：翻译应简洁明了，避免过长的文本
4. **保留占位符**：确保翻译中保留原始的占位符，如 `{{version}}`
5. **测试翻译**：在实际应用中测试翻译效果

## 语言切换机制

### 1. 前端语言切换

在渲染进程中，使用 i18next-vue 实现语言切换：

```javascript
// src/i18n/web.js
import { createI18n } from 'i18next-vue';
import i18next from './i18next';

export default createI18n({ i18next });

// 在组件中使用
import { useTranslation } from 'i18next-vue';

const { t } = useTranslation();

// 切换语言
function changeLanguage(lang) {
  i18next.changeLanguage(lang);
}
```

### 2. 主进程语言切换

在主进程中，使用 i18next 实现语言切换：

```javascript
// src/i18n/server.js
import i18next from './i18next';

export default i18next;

// 在主进程中使用
import i18next from './i18n/server';

// 切换语言
i18next.changeLanguage(lang);

// 使用翻译
const translatedText = i18next.t('key');
```

## 语言资源管理

### 1. 提取未翻译文本

使用 i18next-parser 等工具提取应用中的未翻译文本：

```bash
npx i18next-parser
```

### 2. 管理翻译资源

建议使用以下策略管理翻译资源：

1. **使用翻译管理工具**：如 Lokalise、Crowdin 等
2. **建立翻译流程**：明确翻译、审核、测试的流程
3. **定期更新**：随着应用功能的更新，及时更新翻译

## 常见问题

### 1. 翻译不生效

- 检查语言文件是否正确注册
- 检查键名是否正确
- 检查语言代码是否匹配

### 2. 占位符不显示

- 确保翻译中保留了原始的占位符格式
- 检查占位符名称是否一致

### 3. 语言切换不生效

- 检查 i18next 配置是否正确
- 检查语言代码是否有效
- 检查是否重新渲染了界面

## 示例：添加新语言

以下是添加新语言的完整示例：

### 1. 创建语言文件

创建 `src/i18n/locale/lang/fr-CA.json` 文件：

```json
{
  "appInfo": {
    "appName": "Flying Bird Wallpaper",
    "version": "Version",
    "author": "Auteur"
  },
  "actions": {
    "save": "Enregistrer",
    "cancel": "Annuler",
    "search": "Rechercher",
    "download": "Télécharger",
    "setAsWallpaper": "Définir comme fond d'écran",
    "favorite": "Favori",
    "nextWallpaper": "Suivant",
    "prevWallpaper": "Précédent",
    "autoSwitchWallpaper": {
      "start": "Démarrer la rotation automatique",
      "stop": "Arrêter la rotation automatique"
    }
  },
  "messages": {
    "loading": "Chargement...",
    "success": "Opération réussie",
    "error": "Échec de l'opération",
    "noResults": "Aucun résultat trouvé",
    "networkError": "Erreur réseau",
    "updateAvailable": "Nouvelle version disponible: {{version}}"
  },
  "pages": {
    "search": "Recherche",
    "favorites": "Favoris",
    "history": "Historique",
    "setting": "Paramètres",
    "about": "À propos",
    "utils": "Outils",
    "words": "Citations"
  },
  "setting": {
    "language": "Langue",
    "theme": "Thème",
    "autoStart": "Démarrage automatique",
    "autoSwitchWallpaper": "Rotation automatique des fonds d'écran",
    "switchInterval": "Intervalle de rotation",
    "downloadPath": "Chemin de téléchargement",
    "maxDownloadCount": "Nombre maximal de téléchargements"
  }
}
```

### 2. 注册语言

修改 `src/i18n/locale/index.js` 文件：

```javascript
import arSA from './lang/ar-SA.json';
import deDE from './lang/de-DE.json';
import enUS from './lang/en-US.json';
import esES from './lang/es-ES.json';
import frFR from './lang/fr-FR.json';
import frCA from './lang/fr-CA.json'; // 导入新语言
import itIT from './lang/it-IT.json';
import jaJP from './lang/ja-JP.json';
import koKR from './lang/ko-KR.json';
import ptBR from './lang/pt-BR.json';
import ruRU from './lang/ru-RU.json';
import zhCN from './lang/zh-CN.json';
import zhTW from './lang/zh-TW.json';

export default {
  'ar-SA': arSA,
  'de-DE': deDE,
  'en-US': enUS,
  'es-ES': esES,
  'fr-FR': frFR,
  'fr-CA': frCA, // 注册新语言
  'it-IT': itIT,
  'ja-JP': jaJP,
  'ko-KR': koKR,
  'pt-BR': ptBR,
  'ru-RU': ruRU,
  'zh-CN': zhCN,
  'zh-TW': zhTW
};
```

### 3. 添加语言选项

修改 `src/renderer/windows/MainWindow/pages/Setting.vue` 文件：

```javascript
const languageOptions = [
  { value: 'zh-CN', label: '简体中文' },
  { value: 'zh-TW', label: '繁體中文' },
  { value: 'en-US', label: 'English' },
  { value: 'ja-JP', label: '日本語' },
  { value: 'ko-KR', label: '한국어' },
  { value: 'de-DE', label: 'Deutsch' },
  { value: 'fr-FR', label: 'Français' },
  { value: 'fr-CA', label: 'Français (Canada)' }, // 添加新语言选项
  { value: 'es-ES', label: 'Español' },
  { value: 'it-IT', label: 'Italiano' },
  { value: 'pt-BR', label: 'Português' },
  { value: 'ru-RU', label: 'Русский' },
  { value: 'ar-SA', label: 'العربية' }
];
```