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
    requireSecretKey: false
  },
  local: {
    label: '本地资源',
    value: 'local',
    locale: 'resourceList.local',
    site: '',
    enabled: true,
    remote: false,
    requireSecretKey: false
  },
  favorites: {
    label: '收藏夹',
    value: 'favorites',
    locale: 'resourceList.favorites',
    site: '',
    enabled: true,
    remote: false,
    requireSecretKey: false
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

// 资源类型分类
export const resourceTypeList = [
  { label: '本地资源库', value: 'localResource', locale: 'resourceTypeList.localResource' },
  { label: '远程资源', value: 'remoteResource', locale: 'resourceTypeList.remoteResource' }
]

// 菜单列表
export const menuList = [
  // { name: 'Explore', title: '图库', locale: 'menuList.Explore', icon: 'ep:files', canBeEnabled: true },
  {
    name: 'Search',
    title: '搜索',
    locale: 'menuList.Search',
    icon: 'ep:search',
    canBeEnabled: false,
    // 放置位置
    placement: ['trayMenuChildren', 'sideMenu']
  },
  {
    name: 'Words',
    title: '词库',
    locale: 'menuList.Words',
    icon: 'ep:mostly-cloudy',
    canBeEnabled: true,
    placement: ['trayMenuChildren', 'sideMenu']
  },
  {
    name: 'Favorites',
    title: '收藏',
    locale: 'menuList.Favorites',
    icon: 'ep:star',
    canBeEnabled: true,
    placement: ['trayMenuChildren', 'sideMenu']
  },
  {
    name: 'History',
    title: '回忆',
    locale: 'menuList.History',
    icon: 'ep:toilet-paper',
    canBeEnabled: true,
    placement: ['trayMenuChildren', 'sideMenu']
  },
  {
    name: 'Setting',
    title: '设置',
    locale: 'menuList.Setting',
    icon: 'ep:setting',
    canBeEnabled: true,
    placement: ['trayFuncMenu', 'sideMenu']
  },
  {
    name: 'Utils',
    title: '工具',
    locale: 'menuList.Utils',
    icon: 'ep:key',
    canBeEnabled: true,
    placement: ['trayFuncMenu', 'sideMenu']
  },
  {
    name: 'About',
    title: '关于',
    locale: 'menuList.About',
    icon: 'ep:lollipop',
    canBeEnabled: false,
    placement: ['trayFuncMenu']
  }
]

export const defaultSettingData = {
  // 多语言
  locale: 'zhCN',
  startup: true,
  openMainWindowOnStartup: false,
  startH5ServerOnStartup: false,
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
  webWallpaperUrl: '',
  dynamicAutoPlayOnStartup: false,
  dynamicMuteAudio: true,
  dynamicLastVideoPath: '',
  dynamicBrightness: 100,
  dynamicContrast: 100,
  dynamicPerformanceMode: 'balanced',
  dynamicScaleMode: 'contain',
  remoteResourceSecretKeys: {},
  autoDownload: false,
  downloadSources: [],
  downloadOrientation: [],
  downloadKeywords: '',
  downloadIntervalTime: 15,
  downloadIntervalUnit: 'm',
  downloadFolder: '',
  autoClearDownloaded: false,
  clearDownloadedExpiredTime: 7,
  clearDownloadedExpiredUnit: 'd',
  // 启用菜单
  enabledMenus: ['Search', 'Favorites', 'History', 'Setting', 'Utils', 'About'],
  suspensionBallVisible: false,
  sortField: 'created_at',
  sortType: -1,
  // 格子大小
  gridSize: 'auto',
  // 格子高宽比例
  gridHWRatio: 0.618,
  // 查询列表自动刷新
  autoRefreshList: false,
  // 主题配置
  themes: {
    primary: '#71956C'
  },
  // 启用展开侧边菜单
  enableExpandSideMenu: true,
  // 展开侧边菜单
  expandSideMenu: true,
  // 显示侧边栏文本
  showSideMenuLabel: true,
  // 预览图片播放间隔
  viewImageIntervalTime: 5,
  viewImageIntervalUnit: 's',
  // 显示图片标签
  showImageTag: true,
  // 删除文件时是否需要确认
  confirmOnDeleteFile: true,
  /* h5服务配置 */
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
  h5FloatingButtonPosition: 'left'
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
  // Mac: 'auto' | 'fill' | 'fit' | 'stretch' | 'center'
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
    { label: '分', value: 'm', min: 5, locale: 'intervalUnits.m' },
    { label: '时', value: 'h', min: 1, locale: 'intervalUnits.h' },
    { label: '天', value: 'd', min: 1, locale: 'intervalUnits.d' }
  ],
  downloadIntervalUnit: [
    { label: '分', value: 'm', min: 1, locale: 'intervalUnits.m' },
    { label: '时', value: 'h', min: 1, locale: 'intervalUnits.h' },
    { label: '天', value: 'd', min: 1, locale: 'intervalUnits.d' }
  ],
  clearDownloadedExpiredUnit: [{ label: '天', value: 'd', min: 1, locale: 'intervalUnits.d' }],
  viewImageIntervalUnit: [{ label: '秒', value: 's', min: 2, locale: 'intervalUnits.s' }],
  h5SwitchIntervalUnit: [{ label: '秒', value: 's', min: 2, locale: 'intervalUnits.s' }]
}

// 时间单位与值对应
export const unitToValField = {
  switchIntervalUnit: 'switchIntervalTime',
  refreshDirectoryIntervalUnit: 'refreshDirectoryIntervalTime',
  downloadIntervalUnit: 'downloadIntervalTime',
  clearDownloadedExpiredUnit: 'clearDownloadedExpiredTime',
  viewImageIntervalUnit: 'viewImageIntervalTime',
  h5SwitchIntervalUnit: 'h5SwitchIntervalTime'
}

export const qualityList = ['2K', '4K', '5k', '8K']

export const orientationOptions = [
  { label: '纵向', value: 0, locale: 'orientationOptions.portrait' },
  { label: '横向', value: 1, locale: 'orientationOptions.landscape' }
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
  { label: '资源文件名', value: 'fileName', locale: 'sortFieldOptions.fileName' }
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

export const allowedFileExtList = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp']

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
  { label: '开启自动刷新', locale: 'autoRefreshList.on', value: true, icon: 'lucide:refresh-cw' },
  {
    label: '关闭自动刷新',
    locale: 'autoRefreshList.off',
    value: false,
    icon: 'lucide:refresh-cw-off'
  }
]
