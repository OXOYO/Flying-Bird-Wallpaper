/**
 * 公共数据
 *
 * */

import { inferPresetFromAi } from './aiProviders.js'

export const commonResourceMap = {
  resources: {
    label: '资源库',
    value: 'resources',
    locale: 'resourceList.resources',
    site: '',
    enabled: true,
    remote: false,
    requireSecretKey: false,
    supportSearchTypes: ['images', 'videos']
  },
  local: {
    label: '本地资源',
    value: 'local',
    locale: 'resourceList.local',
    site: '',
    enabled: true,
    remote: false,
    requireSecretKey: false,
    supportSearchTypes: ['images', 'videos']
  },
  favorites: {
    label: '收藏夹',
    value: 'favorites',
    locale: 'resourceList.favorites',
    site: '',
    enabled: true,
    remote: false,
    requireSecretKey: false,
    supportSearchTypes: ['images', 'videos']
  }
}

// 资源数据默认值
export const defaultResourceMap = {
  remoteResourceMap: {},
  supportDownloadRemoteResourceList: [],
  remoteResourceKeyNames: [],
  resourceListByResourceType: {},
  wallpaperResourceList: []
}

export const resourceTypeIcons = {
  localResource: 'custom:desktop-windows-outline',
  remoteResource: 'custom:desktop-cloud-outline'
}

// 资源类型分类
export const resourceTypeList = [
  {
    label: '本地资源库',
    value: 'localResource',
    locale: 'resourceTypeList.localResource',
    icon: resourceTypeIcons.localResource
  },
  {
    label: '远程资源',
    value: 'remoteResource',
    locale: 'resourceTypeList.remoteResource',
    icon: resourceTypeIcons.remoteResource
  }
]

// 菜单列表
export const menuList = [
  {
    name: 'Search',
    shortcutName: '',
    title: '搜索',
    locale: 'menuList.Search',
    icon: 'custom:search',
    canBeEnabled: false,
    // 放置位置
    placement: ['trayMenuChildren', 'sideMenu']
  },
  {
    name: 'Collections',
    shortcutName: '',
    title: '智能合集',
    locale: 'menuList.Collections',
    icon: 'custom:collections',
    canBeEnabled: true,
    placement: ['trayMenuChildren', 'sideMenu']
  },
  {
    name: 'Words',
    shortcutName: '',
    title: '词库',
    locale: 'menuList.Words',
    icon: 'custom:cloud',
    canBeEnabled: true,
    placement: ['trayMenuChildren', 'sideMenu']
  },
  {
    name: 'Favorites',
    shortcutName: '',
    title: '收藏',
    locale: 'menuList.Favorites',
    icon: 'custom:star',
    canBeEnabled: true,
    placement: ['trayMenuChildren', 'sideMenu']
  },
  {
    name: 'History',
    shortcutName: '',
    title: '回忆',
    locale: 'menuList.History',
    icon: 'custom:clock',
    canBeEnabled: true,
    placement: ['trayMenuChildren', 'sideMenu']
  },
  {
    name: 'Setting',
    shortcutName: 'openSettings',
    title: '设置',
    locale: 'menuList.Setting',
    icon: 'custom:settings',
    canBeEnabled: true,
    placement: ['trayFuncMenu', 'sideMenu']
  },
  {
    name: 'Utils',
    shortcutName: 'openUtils',
    title: '工具',
    locale: 'menuList.Utils',
    icon: 'custom:tools',
    canBeEnabled: true,
    placement: ['trayFuncMenu', 'sideMenu']
  },
  {
    name: 'About',
    shortcutName: 'openAbout',
    title: '关于',
    locale: 'menuList.About',
    icon: 'custom:about',
    canBeEnabled: false,
    placement: ['trayFuncMenu']
  }
]

export const defaultMenuList = [
  {
    name: 'LastMenu',
    title: '上次打开菜单',
    shortcutName: '',
    locale: 'defaultMenuList.LastMenu',
    icon: '',
    canBeEnabled: false,
    // 放置位置
    placement: []
  },
  ...menuList
]

export const defaultSettingData = {
  /*** 基础配置 ***/
  locale: 'enUS',
  // 是否已设置了语言
  isLocaleSet: false,
  // 主题配置
  themes: {
    dark: false,
    primary: '#71956C'
  },
  // 默认菜单设置
  defaultMenu: 'LastMenu',
  // 上次打开菜单
  selectedMenu: 'Search',
  // 启用菜单
  enabledMenus: ['Search', 'Collections', 'Favorites', 'History', 'Setting', 'Utils', 'About'],
  suspensionBallVisible: false,
  // 启用展开侧边菜单
  enableExpandSideMenu: true,
  // 展开侧边菜单
  expandSideMenu: true,
  // 显示侧边栏文本
  showSideMenuLabel: true,
  /*** AI 配置（2.0.0） ***/
  ai: {
    enabled: false,
    visionProvider: 'ollama',
    textProvider: 'ollama',
    visionPreset: 'ollama',
    textPreset: 'ollama',
    visionBaseUrl: 'http://127.0.0.1:11434',
    textBaseUrl: 'http://127.0.0.1:11434',
    visionModel: 'qwen2.5vl:7b',
    textModel: 'qwen2.5:7b',
    embeddingModel: 'nomic-embed-text',
    apiKey: '',
    visionApiKey: '',
    textApiKey: '',
    remoteReferer: '',
    remoteAppTitle: 'Flying Bird Wallpaper',
    timeout: 300000,
    visionPreprocess: true,
    visionMaxLongEdge: 2048,
    visionPreprocessMinSizeMB: 1.5,
    visionJpegQuality: 88,
    concurrency: 1,
    analysisMode: 'on_demand',
    legacyOnnxScore: false,
    legacyJiebaTags: false,
    enableNsfwCheck: false,
    runOnWifiOnly: false,
    expandDownloadKeywords: false,
    scoreMinFilter: 70,
    autoCollectionsEnabled: true,
    autoCollectionsMaxCount: 20,
    analysisMaxRetries: 5,
    autoCurateSettled: false,
    autoCurateSettledAnalyzed: 0
  },
  /*** 搜索（仅搜索页 / H5 搜索） ***/
  search: {
    useSemanticSearch: false
  },
  /*** 功能配置 ***/
  startup: true,
  openMainWindowOnStartup: false,
  startH5ServerOnStartup: false,
  // 启用分词计算任务
  enableSegmentationTask: false,
  powerSaveMode: true,
  // 系统通知
  notifications: [
    'downloadTaskCompleted',
    'downloadTaskFailed',
    'downloadTaskAllCompleted',
    'autoClearDownloadedTaskSuccess',
    'autoClearDownloadedTaskFailed'
  ],
  /*** 壁纸类型 ***/
  wallpaperType: '',
  /*** 图片壁纸配置 ***/
  autoSwitchWallpaper: false,
  switchIntervalTime: 15,
  switchIntervalUnit: 'm',
  switchType: 1,
  allScreen: false,
  scaleType: 'center',
  orientation: [],
  quality: [],
  wallpaperResource: 'resources',
  filterKeywords: '',
  autoRefreshDirectory: false,
  refreshDirectoryIntervalTime: 1,
  refreshDirectoryIntervalUnit: 'd',
  allowedFileExt: ['.jpg', '.png', '.jpeg'],
  localResourceFolders: [],
  /*** 网页壁纸配置 ***/
  webWallpaperUrl: '',
  autoRefreshWebWallpaper: false,
  refreshWebWallpaperIntervalTime: 1,
  refreshWebWallpaperIntervalUnit: 'h',
  /*** 颜色壁纸配置 ***/
  colorWallpaperVal: '#999999',
  /*** 动态壁纸配置 ***/
  dynamicMuteAudio: true,
  dynamicLastVideoPath: '',
  dynamicBackgroundColor: '#999999',
  dynamicOpacity: 30,
  dynamicBrightness: 100,
  dynamicContrast: 100,
  dynamicPerformanceMode: 'balanced',
  dynamicScaleMode: 'contain',
  /*** 律动壁纸配置 ***/
  rhythmEffect: 'ThreeStageBars',
  rhythmWidthRatio: 100,
  rhythmHeightRatio: 30,
  rhythmColors: [
    '#ff3cac',
    '#784ba0',
    '#2b86c5',
    '#42e695',
    '#ffb347',
    '#ffcc33',
    '#f7971e',
    '#ffd200',
    '#f44369',
    '#43cea2',
    '#185a9d',
    '#f857a6'
  ],
  rhythmAnimation: 'parabola',
  rhythmDensity: 'normal',
  rhythmPosition: 'bottom',
  rhythmSampleRange: [0, 100],
  /*** 远程资源配置 ***/
  remoteResourceSecretKeys: {},
  autoDownload: false,
  downloadSources: [],
  downloadOrientation: [],
  downloadKeywords: [],
  downloadIntervalTime: 15,
  downloadIntervalUnit: 'm',
  downloadFolder: '',
  autoClearDownloaded: false,
  clearDownloadedExpiredTime: 7,
  clearDownloadedExpiredUnit: 'd',
  /*** 浏览配置 ***/
  sortField: 'created_at',
  sortType: -1,
  // 格子大小
  gridSize: 'auto',
  // 格子高宽比例
  gridHWRatio: 0.618,
  // 查询列表自动刷新
  autoRefreshList: false,
  // 预览图片播放间隔
  viewImageIntervalTime: 5,
  viewImageIntervalUnit: 's',
  // 显示图片标签
  showTag: true,
  // 删除文件时是否需要确认
  confirmOnDeleteFile: true,
  /*** h5服务配置 ***/
  h5Locale: 'enUS',
  // 是否已设置了语言
  isH5LocaleSet: false,
  // 主题配置
  h5Themes: {
    dark: false,
    primary: '#71956C'
  },
  /** 铺满模式列表是否使用压缩图（卡片模式始终压缩） */
  h5FullscreenImageCompress: false,
  /** 原图大于该值（MB）且请求带 w 时才 sharp 缩放 */
  h5ImageCompressStartSize: 2,
  h5FloatingButtonPosition: 'left',
  h5EnabledFloatingButtons: [
    'autoSwitch',
    'intervalTime',
    'favorites',
    'displaySize',
    'toggleTabbar',
    'backtop'
  ],
  h5NumberIndicatorPosition: 'top',
  h5Vibration: true,
  h5WeekScreen: true
}

/** 合并默认项并迁移旧版 H5 图片压缩设置 */
export function migrateSettingData(storeData = {}) {
  const next = { ...defaultSettingData, ...storeData }
  next.ai = { ...defaultSettingData.ai, ...(storeData.ai || {}) }
  next.search = { ...defaultSettingData.search, ...(storeData.search || {}) }
  if (next.search.useSemanticSearch === undefined && storeData.ai?.smartSearch != null) {
    next.search.useSemanticSearch = !!storeData.ai.smartSearch
  }
  delete next.ai.smartSearch
  if (next.ai.apiKey) {
    if (!next.ai.visionApiKey) next.ai.visionApiKey = next.ai.apiKey
    if (!next.ai.textApiKey) next.ai.textApiKey = next.ai.apiKey
  }
  if (!next.ai.visionPreset) {
    next.ai.visionPreset = inferPresetFromAi(next.ai.visionProvider, next.ai.visionBaseUrl)
  }
  if (!next.ai.textPreset) {
    next.ai.textPreset = inferPresetFromAi(next.ai.textProvider, next.ai.textBaseUrl)
  }
  if (!next.ai.remoteAppTitle) {
    next.ai.remoteAppTitle = defaultSettingData.ai.remoteAppTitle
  }
  if (next.ai.timeout === 120000) {
    next.ai.timeout = defaultSettingData.ai.timeout
  }
  if (next.ai.visionPreprocess === undefined) {
    next.ai.visionPreprocess = defaultSettingData.ai.visionPreprocess
  }
  if (next.ai.visionMaxLongEdge == null) {
    next.ai.visionMaxLongEdge = defaultSettingData.ai.visionMaxLongEdge
  }
  if (next.ai.visionPreprocessMinSizeMB == null) {
    next.ai.visionPreprocessMinSizeMB = defaultSettingData.ai.visionPreprocessMinSizeMB
  }
  if (next.ai.visionJpegQuality == null) {
    next.ai.visionJpegQuality = defaultSettingData.ai.visionJpegQuality
  }
  if (next.ai.scoreMinFilter == null || next.ai.scoreMinFilter === '') {
    next.ai.scoreMinFilter = defaultSettingData.ai.scoreMinFilter
  }
  if (next.ai.autoCollectionsMaxCount == null || next.ai.autoCollectionsMaxCount === '') {
    next.ai.autoCollectionsMaxCount = defaultSettingData.ai.autoCollectionsMaxCount
  }
  if (next.ai.analysisMaxRetries == null || next.ai.analysisMaxRetries === '') {
    next.ai.analysisMaxRetries = defaultSettingData.ai.analysisMaxRetries
  }
  if (next.ai.autoCurateSettled == null) {
    next.ai.autoCurateSettled = defaultSettingData.ai.autoCurateSettled
  }
  if (next.ai.autoCurateSettledAnalyzed == null) {
    next.ai.autoCurateSettledAnalyzed = defaultSettingData.ai.autoCurateSettledAnalyzed
  }
  if (typeof next.h5FullscreenImageCompress !== 'boolean') {
    if (typeof next.h5ImageCompress === 'boolean') {
      next.h5FullscreenImageCompress = next.h5ImageCompress
    }
  }
  delete next.h5ImageCompress
  return next
}

export const colorList = [
  '#71956C', // 深绿色
  '#E6A23C', // 橙黄色
  '#F56C6C', // 红色
  '#909399', // 灰色
  '#67C23A', // 浅绿色
  '#409EFF', // 蓝色
  '#FF7F50', // 珊瑚橙
  '#FFD700', // 金色
  '#8A2BE2', // 紫罗兰
  '#00CED1', // 深青
  '#FF69B4', // 热粉色
  '#DC143C', // 猩红
  '#2E8B57', // 海绿色
  '#4682B4', // 钢蓝色
  '#7B68EE', // 中等紫罗兰
  '#B22222', // 耐火砖红
  '#40E0D0', // 绿松石
  '#6A5ACD', // 板岩蓝
  '#FF4500', // 橙红色
  '#2F4F4F' // 深灰青色
]

export const scaleTypesByOS = {
  // FIXME LINUX支持的填充方式存疑
  // Linux: 'auto' | 'fill' | 'fit' | 'stretch' | 'center'
  linux: [
    { label: '自动', value: 'auto', locale: 'scaleTypes.auto' },
    { label: '填充', value: 'fill', locale: 'scaleTypes.fill' },
    { label: '适应', value: 'fit', locale: 'scaleTypes.fit' },
    { label: '拉伸', value: 'stretch', locale: 'scaleTypes.stretch' },
    { label: '居中', value: 'center', locale: 'scaleTypes.center' }
  ],
  // Mac: 'auto' | 'fill' | 'fit' | 'stretch' | 'center'
  mac: [
    { label: '自动', value: 'auto', locale: 'scaleTypes.auto' },
    { label: '填充', value: 'fill', locale: 'scaleTypes.fill' },
    { label: '适应', value: 'fit', locale: 'scaleTypes.fit' },
    { label: '拉伸', value: 'stretch', locale: 'scaleTypes.stretch' },
    { label: '居中', value: 'center', locale: 'scaleTypes.center' }
  ],
  // windows: 'center' | 'stretch' | 'tile' | 'span' | 'fit' | 'fill'
  win: [
    { label: '自动', value: 'span', locale: 'scaleTypes.span' },
    { label: '填充', value: 'fill', locale: 'scaleTypes.fill' },
    { label: '适应', value: 'fit', locale: 'scaleTypes.fit' },
    { label: '拉伸', value: 'stretch', locale: 'scaleTypes.stretch' },
    { label: '居中', value: 'center', locale: 'scaleTypes.center' },
    { label: '平铺', value: 'tile', locale: 'scaleTypes.tile' }
  ]
}

export const intervalUnits = {
  switchIntervalUnit: [
    { label: '秒', value: 's', min: 1, locale: 'intervalUnits.s' },
    { label: '分', value: 'm', min: 1, locale: 'intervalUnits.m' },
    { label: '时', value: 'h', min: 1, locale: 'intervalUnits.h' },
    { label: '天', value: 'd', min: 1, locale: 'intervalUnits.d' }
  ],
  refreshDirectoryIntervalUnit: [
    { label: '分', value: 'm', min: 1, locale: 'intervalUnits.m' },
    { label: '时', value: 'h', min: 1, locale: 'intervalUnits.h' },
    { label: '天', value: 'd', min: 1, locale: 'intervalUnits.d' }
  ],
  downloadIntervalUnit: [
    { label: '分', value: 'm', min: 1, locale: 'intervalUnits.m' },
    { label: '时', value: 'h', min: 1, locale: 'intervalUnits.h' },
    { label: '天', value: 'd', min: 1, locale: 'intervalUnits.d' }
  ],
  clearDownloadedExpiredUnit: [
    { label: '时', value: 'h', min: 1, locale: 'intervalUnits.h' },
    { label: '天', value: 'd', min: 1, locale: 'intervalUnits.d' }
  ],
  refreshWebWallpaperIntervalUnit: [
    { label: '秒', value: 's', min: 1, locale: 'intervalUnits.s' },
    { label: '分', value: 'm', min: 1, locale: 'intervalUnits.m' },
    { label: '时', value: 'h', min: 1, locale: 'intervalUnits.h' },
    { label: '天', value: 'd', min: 1, locale: 'intervalUnits.d' }
  ],
  viewImageIntervalUnit: [{ label: '秒', value: 's', min: 2, locale: 'intervalUnits.s' }]
}

// 时间单位与值对应
export const unitToValField = {
  switchIntervalUnit: 'switchIntervalTime',
  refreshDirectoryIntervalUnit: 'refreshDirectoryIntervalTime',
  downloadIntervalUnit: 'downloadIntervalTime',
  clearDownloadedExpiredUnit: 'clearDownloadedExpiredTime',
  refreshWebWallpaperIntervalUnit: 'refreshWebWallpaperIntervalTime',
  viewImageIntervalUnit: 'viewImageIntervalTime'
}

export const qualityList = ['2K', '4K', '5K', '8K']

export const filterTypeIcons = {
  images: 'custom:image',
  videos: 'custom:video'
}

export const filterTypeOptions = [
  {
    label: '图片',
    value: 'images',
    locale: 'filterTypeOptions.images',
    icon: filterTypeIcons.images
  },
  {
    label: '视频',
    value: 'videos',
    locale: 'filterTypeOptions.videos',
    icon: filterTypeIcons.videos
  }
]

export const orientationIcons = {
  0: 'custom:portrait-outline',
  1: 'custom:landscape-outline'
}

export const orientationOptions = [
  {
    label: '纵向',
    value: 0,
    locale: 'orientationOptions.portrait',
    icon: orientationIcons[0]
  },
  {
    label: '横向',
    value: 1,
    locale: 'orientationOptions.landscape',
    icon: orientationIcons[1]
  }
]

export const switchTypeOptions = [
  { label: '随机', value: 1, locale: 'switchTypeOptions.random' },
  { label: '顺序', value: 2, locale: 'switchTypeOptions.order' }
]

export const sortFieldOptions = [
  { label: '记录创建时间', value: 'created_at', locale: 'sortFieldOptions.created_at' },
  { label: '记录修改时间', value: 'updated_at', locale: 'sortFieldOptions.updated_at' },
  { label: '资源创建时间', value: 'ctimeMs', locale: 'sortFieldOptions.ctimeMs' },
  { label: '资源修改时间', value: 'mtimeMs', locale: 'sortFieldOptions.mtimeMs' },
  { label: '资源文件名', value: 'fileName', locale: 'sortFieldOptions.fileName' },
  { label: '资源文件大小', value: 'fileSize', locale: 'sortFieldOptions.fileSize' },
  { label: '美学评分', value: 'score', locale: 'sortFieldOptions.score' },
  { label: '浏览量', value: 'views', locale: 'sortFieldOptions.views' },
  { label: '下载量', value: 'downloads', locale: 'sortFieldOptions.downloads' },
  { label: '收藏量', value: 'favorites', locale: 'sortFieldOptions.favorites' },
  { label: '壁纸量', value: 'wallpapers', locale: 'sortFieldOptions.wallpapers' }
]

export const sortTypeOptions = [
  { label: '升序', value: 1, locale: 'sortTypeOptions.asc' },
  { label: '降序', value: -1, locale: 'sortTypeOptions.desc' }
]

export const imageDisplaySizeOptions = [
  { label: '适应', value: 'contain', locale: 'imageDisplaySizeOptions.contain' },
  { label: '填充', value: 'cover', locale: 'imageDisplaySizeOptions.cover' }
]

export const h5FloatingButtonPositionOptions = [
  { label: '左侧', value: 'left', locale: 'h5FloatingButtonPositionOptions.left' },
  { label: '右侧', value: 'right', locale: 'h5FloatingButtonPositionOptions.right' }
]

export const h5FloatingButtonsOptions = [
  { label: '自动切换', value: 'autoSwitch', locale: 'h5FloatingButtonsOptions.autoSwitch' },
  { label: '切换间隔', value: 'intervalTime', locale: 'h5FloatingButtonsOptions.intervalTime' },
  { label: '收藏', value: 'favorites', locale: 'h5FloatingButtonsOptions.favorites' },
  { label: '显示尺寸', value: 'displaySize', locale: 'h5FloatingButtonsOptions.displaySize' },
  { label: '沉浸模式', value: 'toggleTabbar', locale: 'h5FloatingButtonsOptions.toggleTabbar' },
  { label: '返回顶部', value: 'backtop', locale: 'h5FloatingButtonsOptions.backtop' }
]

export const h5NumberIndicatorPositionOptions = [
  { label: '顶部', value: 'top', locale: 'h5NumberIndicatorPositionOptions.top' },
  { label: '底部', value: 'bottom', locale: 'h5NumberIndicatorPositionOptions.bottom' }
]

export const allowedImageExtList = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp']
export const allowedVideoExtList = ['.mp4']
export const allowedFileExtList = [...allowedImageExtList, ...allowedVideoExtList]

// 性能模式选项
export const dynamicPerformanceModeOptions = [
  { label: '高质量', value: 'high', locale: 'dynamicPerformanceModeOptions.high' },
  { label: '平衡', value: 'balanced', locale: 'dynamicPerformanceModeOptions.balanced' },
  { label: '省电', value: 'powersave', locale: 'dynamicPerformanceModeOptions.powersave' }
]

// 缩放模式选项
export const dynamicScaleModeOptions = [
  { label: '填充', value: 'cover', locale: 'dynamicScaleModeOptions.cover' },
  { label: '适应', value: 'contain', locale: 'dynamicScaleModeOptions.contain' },
  { label: '拉伸', value: 'stretch', locale: 'dynamicScaleModeOptions.stretch' }
]

// 自动刷新
export const autoRefreshListOptions = [
  {
    label: '开启自动刷新',
    locale: 'autoRefreshList.on',
    value: true,
    icon: 'custom:refresh-on'
  },
  {
    label: '关闭自动刷新',
    locale: 'autoRefreshList.off',
    value: false,
    icon: 'custom:refresh-off'
  }
]

// 文件类型
export const mimeTypes = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.avif': 'image/avif',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.ogg': 'video/ogg',
  '.mov': 'video/quicktime',
  '.avi': 'video/x-msvideo',
  '.wmv': 'video/x-ms-wmv',
  '.flv': 'video/x-flv'
}

// 律动壁纸效果类型（Three.js 舞台）
export const rhythmEffectOptions = [
  { label: '演唱会柱', locale: 'rhythmEffectOptions.ThreeStageBars', value: 'ThreeStageBars' },
  { label: '霓虹墙', locale: 'rhythmEffectOptions.ThreeStageWall', value: 'ThreeStageWall' },
  { label: '地柱网格', locale: 'rhythmEffectOptions.ThreeStageGrid', value: 'ThreeStageGrid' },
  {
    label: '纹理球',
    locale: 'rhythmEffectOptions.ThreeStageTexturedSphere',
    value: 'ThreeStageTexturedSphere'
  }
]

// 律动动效
export const rhythmAnimationOptions = [
  { label: '线型', locale: 'rhythmAnimationOptions.linear', value: 'linear' },
  { label: '对数', locale: 'rhythmAnimationOptions.log', value: 'log' },
  { label: '抛物线', locale: 'rhythmAnimationOptions.parabola', value: 'parabola' },
  { label: '平方根', locale: 'rhythmAnimationOptions.sqrt', value: 'sqrt' },
  { label: '指数', locale: 'rhythmAnimationOptions.exp', value: 'exp' },
  { label: '正弦', locale: 'rhythmAnimationOptions.sin', value: 'sin' },
  { label: '弹跳', locale: 'rhythmAnimationOptions.bounce', value: 'bounce' },
  { label: '阶梯', locale: 'rhythmAnimationOptions.step', value: 'step' }
]

// 律动密集度
export const rhythmDensityOptions = [
  { label: '稀疏', locale: 'rhythmDensityOptions.sparse', value: 'sparse' },
  { label: '正常', locale: 'rhythmDensityOptions.normal', value: 'normal' },
  { label: '密集', locale: 'rhythmDensityOptions.dense', value: 'dense' }
]

// 位置
export const positionOptions = [
  { label: '', locale: 'positionOptions.topLeft', value: 'top-left' },
  { label: '', locale: 'positionOptions.top', value: 'top' },
  { label: '', locale: 'positionOptions.topRight', value: 'top-right' },
  { label: '', locale: 'positionOptions.right', value: 'right' },
  { label: '', locale: 'positionOptions.bottomRight', value: 'bottom-right' },
  { label: '', locale: 'positionOptions.bottom', value: 'bottom' },
  { label: '', locale: 'positionOptions.bottomLeft', value: 'bottom-left' },
  { label: '', locale: 'positionOptions.left', value: 'left' },
  { label: '', locale: 'positionOptions.center', value: 'center' }
]

// 支持显示的信息字段
export const infoKeys = [
  'title',
  'desc',
  'author',
  'link',
  'resourceName',
  'fileName',
  'filePath',
  'fileExt',
  'fileSize',
  'quality',
  'score',
  'dimensions',
  'views',
  'downloads',
  'favorites',
  'wallpapers',
  'ctimeMs',
  'mtimeMs',
  'created_at',
  'updated_at'
]

// 快捷键默认配置
export const keyboardShortcuts = [
  // 基础系统操作
  {
    name: 'quitApp',
    locale: 'keyboardShortcuts.quitApp',
    description: '完全退出应用',
    type: 'local',
    windowNames: ['mainWindow', 'loadingWindow', 'viewImageWindow', 'suspensionBall'],
    category: 'system',
    editable: false,
    visible: true,
    shortcuts: {
      mac: 'Command+Q',
      win: 'Ctrl+Q',
      linux: 'Ctrl+Q'
    }
  },
  // 窗口操作
  {
    name: 'closeWindow',
    locale: 'keyboardShortcuts.closeWindow',
    description: '关闭当前窗口',
    type: 'local',
    windowNames: ['mainWindow', 'loadingWindow', 'viewImageWindow', 'suspensionBall'],
    category: 'window',
    editable: false,
    visible: true,
    shortcuts: {
      mac: 'Command+W',
      win: 'Ctrl+W',
      linux: 'Ctrl+W'
    }
  },
  {
    name: 'minimizeWindow',
    locale: 'keyboardShortcuts.minimizeWindow',
    description: '最小化当前窗口',
    type: 'local',
    windowNames: ['mainWindow', 'loadingWindow', 'viewImageWindow', 'suspensionBall'],
    category: 'window',
    editable: false,
    visible: true,
    shortcuts: {
      mac: 'Command+M',
      win: 'Ctrl+M',
      linux: 'Super+M'
    }
  },
  {
    name: 'toggleMainWindow',
    locale: 'keyboardShortcuts.toggleMainWindow',
    description: '显示/隐藏主窗口',
    type: 'global',
    windowNames: ['mainWindow', 'loadingWindow', 'viewImageWindow', 'suspensionBall'],
    category: 'window',
    editable: true,
    visible: true,
    shortcuts: {
      mac: 'Command+Shift+M',
      win: 'Ctrl+Shift+M',
      linux: 'Ctrl+Shift+M'
    }
  },
  {
    name: 'toggleSuspensionBall',
    locale: 'keyboardShortcuts.toggleSuspensionBall',
    description: '显示/隐藏悬浮球',
    type: 'global',
    category: 'window',
    editable: true,
    visible: true,
    shortcuts: {
      mac: 'Command+Shift+B',
      win: 'Ctrl+Shift+B',
      linux: 'Ctrl+Shift+B'
    }
  },

  // 壁纸管理
  {
    name: 'nextWallpaper',
    locale: 'keyboardShortcuts.nextWallpaper',
    description: '切换到下一张壁纸',
    type: 'global',
    category: 'wallpaper',
    editable: true,
    visible: true,
    shortcuts: {
      mac: 'Command+Shift+Right',
      win: 'Ctrl+Shift+Right',
      linux: 'Ctrl+Shift+Right'
    }
  },
  {
    name: 'prevWallpaper',
    locale: 'keyboardShortcuts.prevWallpaper',
    description: '切换到上一张壁纸',
    type: 'global',
    category: 'wallpaper',
    editable: true,
    visible: true,
    shortcuts: {
      mac: 'Command+Shift+Left',
      win: 'Ctrl+Shift+Left',
      linux: 'Ctrl+Shift+Left'
    }
  },
  {
    name: 'toggleAutoSwitchWallpaper',
    locale: 'keyboardShortcuts.toggleAutoSwitchWallpaper',
    description: '切换自动壁纸模式',
    type: 'global',
    category: 'wallpaper',
    editable: true,
    visible: true,
    shortcuts: {
      mac: 'Command+Shift+A',
      win: 'Ctrl+Shift+A',
      linux: 'Ctrl+Shift+A'
    }
  },

  // 文本操作
  {
    name: 'editSelectAll',
    locale: 'keyboardShortcuts.editSelectAll',
    description: '全选',
    type: 'local',
    windowNames: ['mainWindow', 'viewImageWindow'],
    category: 'text',
    editable: false,
    visible: false,
    shortcuts: {
      mac: 'Command+A',
      win: 'Ctrl+A',
      linux: 'Ctrl+A'
    }
  },
  {
    name: 'editCopy',
    locale: 'keyboardShortcuts.editCopy',
    description: '复制',
    type: 'local',
    windowNames: ['mainWindow', 'viewImageWindow'],
    category: 'text',
    editable: false,
    visible: false,
    shortcuts: {
      mac: 'Command+C',
      win: 'Ctrl+C',
      linux: 'Ctrl+C'
    }
  },
  {
    name: 'editPaste',
    locale: 'keyboardShortcuts.editPaste',
    description: '粘贴',
    type: 'local',
    windowNames: ['mainWindow', 'viewImageWindow'],
    category: 'text',
    editable: false,
    visible: false,
    shortcuts: {
      mac: 'Command+V',
      win: 'Ctrl+V',
      linux: 'Ctrl+V'
    }
  },

  // 设置管理
  {
    name: 'openSettings',
    locale: 'keyboardShortcuts.openSettings',
    description: '打开设置',
    type: 'local',
    windowNames: ['mainWindow', 'loadingWindow', 'viewImageWindow', 'suspensionBall'],
    category: 'settings',
    editable: true,
    visible: true,
    shortcuts: {
      mac: 'Command+,',
      win: 'Ctrl+P',
      linux: 'Ctrl+P'
    }
  },
  {
    name: 'openUtils',
    locale: 'keyboardShortcuts.openUtils',
    description: '打开工具',
    type: 'local',
    windowNames: ['mainWindow', 'loadingWindow', 'viewImageWindow', 'suspensionBall'],
    category: 'settings',
    editable: true,
    visible: true,
    shortcuts: {
      mac: 'Command+Shift+U',
      win: 'Ctrl+Shift+U',
      linux: 'Ctrl+Shift+U'
    }
  },
  {
    name: 'openAbout',
    locale: 'keyboardShortcuts.openAbout',
    description: '打开关于',
    type: 'local',
    windowNames: ['mainWindow', 'loadingWindow', 'viewImageWindow', 'suspensionBall'],
    category: 'settings',
    editable: true,
    visible: true,
    shortcuts: {
      mac: 'Command+Shift+I',
      win: 'Ctrl+Shift+I',
      linux: 'Ctrl+Shift+I'
    }
  },
  {
    name: 'checkUpdate',
    locale: 'keyboardShortcuts.checkUpdate',
    description: '检查更新',
    type: 'local',
    windowNames: ['mainWindow', 'loadingWindow', 'viewImageWindow', 'suspensionBall'],
    category: 'settings',
    editable: true,
    visible: true,
    shortcuts: {
      mac: 'Command+Shift+R',
      win: 'Ctrl+Shift+R',
      linux: 'Ctrl+Shift+R'
    }
  }
]

export const notificationsOptions = [
  {
    label: '刷新目录任务',
    name: 'autoRefreshDirectoryTask',
    locale: 'notificationsOptions.autoRefreshDirectoryTask',
    children: [
      {
        label: '任务成功',
        locale: 'notificationsOptions.autoRefreshDirectoryTaskSuccess',
        value: 'autoRefreshDirectoryTaskSuccess'
      },
      {
        label: '任务失败',
        locale: 'notificationsOptions.autoRefreshDirectoryTaskFailed',
        value: 'autoRefreshDirectoryTaskFailed'
      }
    ]
  },
  {
    label: '下载任务',
    name: 'downloadTask',
    locale: 'notificationsOptions.downloadTask',
    children: [
      {
        label: '任务完成',
        locale: 'notificationsOptions.downloadTaskCompleted',
        value: 'downloadTaskCompleted'
      },
      {
        label: '任务失败',
        locale: 'notificationsOptions.downloadTaskFailed',
        value: 'downloadTaskFailed'
      },
      {
        label: '所有下载任务完成',
        locale: 'notificationsOptions.downloadTaskAllCompleted',
        value: 'downloadTaskAllCompleted'
      }
    ]
  },
  {
    label: '自动清理任务',
    name: 'autoClearDownloadedTask',
    locale: 'notificationsOptions.autoClearDownloadedTask',
    children: [
      {
        label: '任务成功',
        locale: 'notificationsOptions.autoClearDownloadedTaskSuccess',
        value: 'autoClearDownloadedTaskSuccess'
      },
      {
        label: '任务失败',
        locale: 'notificationsOptions.autoClearDownloadedTaskFailed',
        value: 'autoClearDownloadedTaskFailed'
      }
    ]
  }
]
