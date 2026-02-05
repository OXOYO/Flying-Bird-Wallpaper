/**
 * 公共数据
 *
 * */

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
    title: '搜索',
    locale: 'menuList.Search',
    icon: 'custom:search',
    canBeEnabled: false,
    // 放置位置
    placement: ['trayMenuChildren', 'sideMenu']
  },
  {
    name: 'Words',
    title: '词库',
    locale: 'menuList.Words',
    icon: 'custom:cloud',
    canBeEnabled: true,
    placement: ['trayMenuChildren', 'sideMenu']
  },
  {
    name: 'Favorites',
    title: '收藏',
    locale: 'menuList.Favorites',
    icon: 'custom:star',
    canBeEnabled: true,
    placement: ['trayMenuChildren', 'sideMenu']
  },
  {
    name: 'History',
    title: '回忆',
    locale: 'menuList.History',
    icon: 'custom:clock',
    canBeEnabled: true,
    placement: ['trayMenuChildren', 'sideMenu']
  },
  {
    name: 'Setting',
    title: '设置',
    locale: 'menuList.Setting',
    icon: 'custom:settings',
    canBeEnabled: true,
    placement: ['trayFuncMenu', 'sideMenu']
  },
  {
    name: 'Utils',
    title: '工具',
    locale: 'menuList.Utils',
    icon: 'custom:tools',
    canBeEnabled: true,
    placement: ['trayFuncMenu', 'sideMenu']
  },
  {
    name: 'About',
    title: '关于',
    locale: 'menuList.About',
    icon: 'custom:about',
    canBeEnabled: false,
    placement: ['trayFuncMenu']
  }
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
  defaultMenu: 'Search',
  // 启用菜单
  enabledMenus: ['Search', 'Favorites', 'History', 'Setting', 'Utils', 'About'],
  suspensionBallVisible: false,
  // 启用展开侧边菜单
  enableExpandSideMenu: true,
  // 展开侧边菜单
  expandSideMenu: true,
  // 显示侧边栏文本
  showSideMenuLabel: true,
  /*** 功能配置 ***/
  startup: true,
  openMainWindowOnStartup: false,
  startH5ServerOnStartup: false,
  // 启用分词计算任务
  enableSegmentationTask: false,
  powerSaveMode: true,
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
  rhythmEffect: 'LeaferBar',
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
  h5AutoSwitch: true,
  h5SwitchType: 1,
  h5SwitchIntervalTime: 3,
  h5SwitchIntervalUnit: 's',
  h5Resource: 'resources',
  h5Orientation: '',
  h5Quality: '',
  h5SortField: 'created_at',
  h5SortType: -1,
  h5ImageDisplaySize: 1,
  h5ImageCompress: true,
  h5ImageCompressStartSize: 2,
  h5FloatingButtonPosition: 'left',
  h5EnabledFloatingButtons: [
    'autoSwitch',
    'intervalTime',
    'switchType',
    'favorites',
    'displaySize',
    'toggleTabbar',
    'backtop'
  ],
  h5NumberIndicatorPosition: 'top',
  h5Vibration: true,
  h5WeekScreen: true
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
  viewImageIntervalUnit: [{ label: '秒', value: 's', min: 2, locale: 'intervalUnits.s' }],
  h5SwitchIntervalUnit: [{ label: '秒', value: 's', min: 2, locale: 'intervalUnits.s' }]
}

// 时间单位与值对应
export const unitToValField = {
  switchIntervalUnit: 'switchIntervalTime',
  refreshDirectoryIntervalUnit: 'refreshDirectoryIntervalTime',
  downloadIntervalUnit: 'downloadIntervalTime',
  clearDownloadedExpiredUnit: 'clearDownloadedExpiredTime',
  refreshWebWallpaperIntervalUnit: 'refreshWebWallpaperIntervalTime',
  viewImageIntervalUnit: 'viewImageIntervalTime',
  h5SwitchIntervalUnit: 'h5SwitchIntervalTime'
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
  { label: '切换方式', value: 'switchType', locale: 'h5FloatingButtonsOptions.switchType' },
  { label: '收藏', value: 'favorites', locale: 'h5FloatingButtonsOptions.favorites' },
  { label: '显示尺寸', value: 'displaySize', locale: 'h5FloatingButtonsOptions.displaySize' },
  { label: '切换标签栏', value: 'toggleTabbar', locale: 'h5FloatingButtonsOptions.toggleTabbar' },
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

// 律动壁纸效果类型
export const rhythmEffectOptions = [
  // Leafer效果
  { label: '柱状', locale: 'rhythmEffectOptions.LeaferBar', value: 'LeaferBar' },
  { label: '波形', locale: 'rhythmEffectOptions.LeaferWave', value: 'LeaferWave' },
  { label: '小球', locale: 'rhythmEffectOptions.LeaferBall', value: 'LeaferBall' },
  { label: '迪斯科', locale: 'rhythmEffectOptions.LeaferDisco', value: 'LeaferDisco' },
  {
    label: '频谱环',
    locale: 'rhythmEffectOptions.LeaferSpectrumRing',
    value: 'LeaferSpectrumRing'
  },
  {
    label: '粒子喷泉',
    locale: 'rhythmEffectOptions.LeaferParticleFountain',
    value: 'LeaferParticleFountain'
  },
  {
    label: '呼吸光圈',
    locale: 'rhythmEffectOptions.LeaferBreathingHalo',
    value: 'LeaferBreathingHalo'
  },
  // { label: '动态网格', locale: 'rhythmEffectOptions.LeaferDynamicGrid', value: 'LeaferDynamicGrid' },
  {
    label: '流动线条',
    locale: 'rhythmEffectOptions.LeaferFlowingLines',
    value: 'LeaferFlowingLines'
  },
  {
    label: '音符雨',
    locale: 'rhythmEffectOptions.LeaferMusicNoteRain',
    value: 'LeaferMusicNoteRain'
  },
  {
    label: '旋转星芒',
    locale: 'rhythmEffectOptions.LeaferRotatingStarburst',
    value: 'LeaferRotatingStarburst'
  },
  { label: '3D柱状', locale: 'rhythmEffectOptions.LeaferBars3D', value: 'LeaferBars3D' },
  {
    label: '液体波纹',
    locale: 'rhythmEffectOptions.LeaferLiquidRipple',
    value: 'LeaferLiquidRipple'
  },
  {
    label: '频谱花朵',
    locale: 'rhythmEffectOptions.LeaferSpectrumFlower',
    value: 'LeaferSpectrumFlower'
  },
  { label: '彩虹', locale: 'rhythmEffectOptions.LeaferRainbow', value: 'LeaferRainbow' },
  { label: '风车', locale: 'rhythmEffectOptions.LeaferWindmill', value: 'LeaferWindmill' },
  { label: '太极', locale: 'rhythmEffectOptions.LeaferTaiji', value: 'LeaferTaiji' },
  { label: '木鱼', locale: 'rhythmEffectOptions.LeaferMuyu', value: 'LeaferMuyu' },
  { label: '烟花', locale: 'rhythmEffectOptions.LeaferFirework', value: 'LeaferFirework' },
  { label: '雪花', locale: 'rhythmEffectOptions.LeaferSnowflake', value: 'LeaferSnowflake' }
  // Three.js 效果
  // { label: '3D柱状', locale: 'rhythmEffectOptions.ThreeBar', value: 'ThreeBar' },
  // { label: '3D波形', locale: 'rhythmEffectOptions.ThreeWave', value: 'ThreeWave' },
  // { label: '3D粒子', locale: 'rhythmEffectOptions.ThreeParticle', value: 'ThreeParticle' },
  // { label: '3D球体', locale: 'rhythmEffectOptions.ThreeSphere', value: 'ThreeSphere' },
  // {
  //   label: '3D音频可视化',
  //   locale: 'rhythmEffectOptions.ThreeAudioVisualizer',
  //   value: 'ThreeAudioVisualizer'
  // }
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
