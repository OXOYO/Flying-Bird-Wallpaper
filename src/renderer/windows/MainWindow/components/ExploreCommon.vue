<script setup>
import { h } from 'vue'
import clipboard from 'clipboardy'
import UseCommonStore from '@renderer/stores/commonStore.js'
import UseMenuStore from '@renderer/stores/menuStore.js'
import UseSettingStore from '@renderer/stores/settingStore.js'
import UseWordsStore from '@renderer/stores/wordsStore.js'
import { useTranslation } from 'i18next-vue'
import {
  resourceTypeList,
  resourceTypeIcons,
  qualityList,
  filterTypeOptions,
  orientationOptions,
  autoRefreshListOptions
} from '@common/publicData.js'
import { hex2RGB } from '@renderer/utils/gen-color.js'
import { debounce } from '@renderer/utils/index.js'

const { t } = useTranslation()
const commonStore = UseCommonStore()
const menuStore = UseMenuStore()
const settingStore = UseSettingStore()
const wordsStore = UseWordsStore()
const { settingData } = storeToRefs(settingStore)
const { selectedMenu, menuList } = storeToRefs(menuStore)
const { wordTypeList, wordDrawerVisible } = storeToRefs(wordsStore)

const cardBlockRef = ref(null)
const scrollRef = ref(null)
let hoverCardIndex = ref(-1)
let hoverBtnName = ref(null)

const viewImageRef = ref(null)
const viewImageOptions = {
  button: true,
  backdrop: true
}
const viewSize = 5

const viewInfoRef = ref(null)

const videoRefs = ref([])

const cardItemStatus = reactive({
  index: -1,
  status: null
})

const props = defineProps({
  menu: String,
  menuParams: Object
})

// 启用的菜单列表
const enabledMenus = computed(() => {
  const list = menuList.value.filter((item) => item.placement.includes('sideMenu'))
  if (
    !settingData.value ||
    !Array.isArray(settingData.value?.enabledMenus) ||
    !settingData.value?.enabledMenus?.length
  ) {
    return list
  }
  return list.filter((item) => {
    if (item.canBeEnabled) {
      return settingData.value.enabledMenus.includes(item.name)
    }
    return true
  })
})

// 是否启用WordDraw
const enabledWordDraw = computed(() => {
  // 词云菜单
  const WordsMenu = enabledMenus.value.find((item) => item.name === 'Words')
  return WordsMenu && selectedMenu.value && selectedMenu.value.name === 'Search'
})

const isExploreMenu = computed(() => {
  return props.menu === 'Explore'
})
const isSearchMenu = computed(() => {
  return props.menu === 'Search'
})
const isFavoritesMenu = computed(() => {
  return props.menu === 'Favorites'
})

const isHistoryMenu = computed(() => {
  return props.menu === 'History'
})

const isLocalResource = computed(() => {
  return searchForm.resourceType === 'localResource'
})

// const isRemoteResource = computed(() => {
//   return searchForm.resourceType === 'remoteResource'
// })

const resourceMap = computed(() => {
  return commonStore.resourceMap
})

// 资源分组列表
const resourceGroupList = computed(() => {
  const { resourceListByResourceType } = resourceMap.value
  return resourceTypeList.map((group) => {
    const resourceType = group.value
    const sourceList = JSON.parse(
      JSON.stringify(toRaw(resourceListByResourceType[resourceType]) || [])
    )
    group.children = sourceList.map((item) => {
      const resourceName = item.value
      item.optionValue = {
        key: `${resourceType}_${resourceName}`,
        resourceType,
        resourceName
      }
      return item
    })
    return group
  })
})

const currentSourceList = computed(() => {
  return resourceMap.value.resourceListByResourceType[searchForm.resourceType] || []
})

const enableSwitchSource = computed(() => {
  return isExploreMenu.value && currentSourceList.value.length > 1
})

const cardBlockStyle = computed(() => {
  return isSearchMenu.value
    ? { height: 'calc(100vh - 130px)' }
    : {
        height: 'calc(100vh - 60px)'
      }
})

const imgSize = computed(() => {
  const w = 1080
  const h = Math.floor(w * gridForm.gridHWRatio)
  return { w, h }
})

const imgUrlQuery = computed(() => {
  let query = {}
  const { w, h } = imgSize.value
  if (searchForm.resourceType === 'localResource') {
    query = { w }
  } else {
    query = { w, h }
  }
  return query
})

const words = ref({
  1: [],
  2: []
})

const activeWordTab = ref(1)
const wordFilter = ref('')

const activeWordTabColor = computed(() => {
  return wordTypeList.value[activeWordTab.value - 1].color
})
const activeWordsList = computed(() => {
  const list = words.value[activeWordTab.value]
  if (wordFilter.value) {
    return list.filter((item) => item.word.includes(wordFilter.value))
  }
  return Array.isArray(list) ? list : []
})

// 卡片列表
const cardList = ref([])

const flags = reactive({
  loading: false,
  empty: false,
  hasMore: true,
  // 是否在隐私空间内
  inPrivacySpace: false,
  loadMoreClicked: false,
  syncToSetting: false,
  scrollDebounce: false, // 添加滚动防抖标志
  showFixedBtns: true // 固定按钮是否显示
})

const autoRefreshForm = reactive({
  enabled: settingData.value.autoRefreshList
})

// 大小区间
const gridSizeRange = { size: 4, wrapperWidth: 900 }
const gridSizeList = [
  { label: t('gridSizeList.label.auto'), alt: t('gridSizeList.alt.auto'), value: 'auto', icon: '' },
  {
    label: t('gridSizeList.label.size', { size: 1 }),
    alt: t('gridSizeList.alt.size', { size: 1 }),
    value: 1,
    icon: ''
  },
  {
    label: t('gridSizeList.label.size', { size: 2 }),
    alt: t('gridSizeList.alt.size', { size: 2 }),
    value: 2,
    icon: ''
  },
  {
    label: t('gridSizeList.label.size', { size: 4 }),
    alt: t('gridSizeList.alt.size', { size: 4 }),
    value: 4,
    icon: ''
  },
  {
    label: t('gridSizeList.label.size', { size: 6 }),
    alt: t('gridSizeList.alt.size', { size: 6 }),
    value: 6,
    icon: ''
  },
  {
    label: t('gridSizeList.label.size', { size: 8 }),
    alt: t('gridSizeList.alt.size', { size: 8 }),
    value: 8,
    icon: ''
  }
]
const gridRatioList = [
  { label: t('gridRatioList.square'), value: 1, icon: 'material-symbols-light:square' },
  { label: t('gridRatioList.rectangle'), value: 0.618, icon: 'material-symbols-light:rectangle' },
  { label: t('gridRatioList.verticalRectangle'), value: 1.618, icon: 'icon-park-solid:rectangle' }
]
const gridForm = reactive({
  // 格子大小
  gridSize: settingData.value.gridSize || 'auto',
  // 格子高宽比例
  gridHWRatio: settingData.value.gridHWRatio || 0.618
})

const cardForm = reactive({
  cardWidth: 225,
  cardHeight: Math.floor(225 * 0.618),
  gridSize: gridForm.gridSize === 'auto' ? 4 : gridForm.gridSize,
  gridGap: 4,
  buffer: 100
})

const searchForm = reactive({
  resourceType: resourceTypeList[0].value,
  resourceNameIndex: -1,
  resourceName: '',
  filterKeywords: '',
  filterType: 'images',
  quality: [],
  orientation: [],
  startPage: 1,
  pageSize: 50,
  isRandom: false,
  sortField: settingData.value.sortField || 'created_at',
  sortType: settingData.value.sortType || -1,
  total: 0
})

const selectedResource = computed(() => {
  const { resourceType, resourceName } = searchForm
  return {
    key: `${resourceType}_${resourceName}`,
    resourceType,
    resourceName
  }
})

const currentResource = computed(() => {
  const { resourceType, resourceName } = searchForm
  const list = resourceMap.value.resourceListByResourceType[resourceType] || []
  const item = list.find((item) => item.value === resourceName)
  return item
})

const supportSearchTypes = computed(() => {
  const types = currentResource.value?.supportSearchTypes
  return Array.isArray(types) && types.length ? types : ['images']
})

const resizeObserver = new ResizeObserver((entries) => {
  for (let entry of entries) {
    handleGridSize(entry.contentRect.width, entry.contentRect.height)
  }
})

const fixedBtns = computed(() => {
  const getBottom = () => {
    return (ret.length - 1) * 60 + 100 + 'px'
  }
  const ret = []
  ret.push({
    action: 'toggleFixedBtns',
    actionParams: [],
    title: t('exploreCommon.toggleFixedBtns'),
    icon: flags.showFixedBtns
      ? 'material-symbols:collapse-all-rounded'
      : 'material-symbols:expand-all-rounded',
    iconStyle: {},
    style: {
      bottom: getBottom()
    }
  })

  if (!flags.showFixedBtns) {
    return ret
  }

  ret.push({
    action: 'onLoadMore',
    actionParams: [],
    title: t('exploreCommon.onLoadMore'),
    icon: 'ep:d-arrow-right',
    iconStyle: {
      transform: 'rotate(90deg)'
    },
    style: {
      bottom: getBottom()
    }
  })

  ret.push({
    action: 'onRefresh',
    actionParams: [false],
    title: t('exploreCommon.onRefresh'),
    icon: 'ep:refresh-right',
    iconStyle: {},
    style: {
      bottom: getBottom()
    }
  })

  // FIXME 注意顺序
  if (!isSearchMenu.value || (isSearchMenu.value && isLocalResource.value)) {
    ret.push({
      action: 'onSwitchSortType',
      actionParams: [],
      title: searchForm.sortType > 0 ? t('sortType.asc') : t('sortType.desc'),
      icon: searchForm.sortType > 0 ? 'lucide:sort-asc' : 'lucide:sort-desc',
      iconStyle: {},
      style: {
        bottom: getBottom()
      }
    })
    ret.push({
      action: 'isRandom',
      actionParams: [],
      title: searchForm.isRandom ? t('exploreCommon.isRandom.on') : t('exploreCommon.isRandom.off'),
      icon: searchForm.isRandom ? 'ri:shuffle-line' : 'ri:repeat-line',
      iconStyle: {},
      style: {
        bottom: getBottom()
      }
    })
  }
  if (isFavoritesMenu.value) {
    ret.push({
      action: 'onTogglePrivacySpace',
      actionParams: [],
      title: flags.inPrivacySpace
        ? t('exploreCommon.onTogglePrivacySpace.quit')
        : t('exploreCommon.onTogglePrivacySpace.enter'),
      icon: flags.inPrivacySpace
        ? 'material-symbols:door-open-outline'
        : 'material-symbols:door-front-outline',
      iconStyle: {},
      style: {
        bottom: getBottom(),
        backgroundColor: flags.inPrivacySpace ? '#FF0000' : 'rgba(50, 57, 65, 0.6)'
      }
    })
  }
  if (enableSwitchSource.value) {
    ret.push({
      action: 'onSwitchResource',
      actionParams: [],
      title: t('exploreCommon.onSwitchResource'),
      icon: 'ep:switch',
      iconStyle: {},
      style: {
        bottom: getBottom()
      }
    })
  }
  // 回忆数据自动刷新
  if (isHistoryMenu.value) {
    const btnItem = autoRefreshListOptions.find((item) => item.value === autoRefreshForm.enabled)
    ret.unshift({
      action: 'onToggleAutoRefresh',
      actionParams: [],
      title: t(btnItem.locale),
      icon: btnItem.icon,
      iconStyle: {},
      style: {
        bottom: getBottom()
      }
    })
  }
  // 切换格子宽高比
  const gridHWRatio = gridRatioList.find((item) => item.value === gridForm.gridHWRatio)
  ret.unshift({
    action: 'onSwitchGridRatio',
    actionParams: [],
    title: gridHWRatio.label,
    icon: gridHWRatio.icon,
    iconStyle: {},
    style: {
      bottom: getBottom()
    },
    children: gridRatioList
  })
  // 切换格子尺寸
  const gridSize = gridSizeList.find((item) => item.value === gridForm.gridSize)
  ret.unshift({
    action: 'onSwitchGridSize',
    actionParams: [],
    title: gridSize.label,
    alt: gridSize.alt,
    icon: gridSize.icon,
    iconStyle: {},
    style: {
      bottom: getBottom()
    },
    children: gridSizeList
  })
  // 刷新目录
  if (isSearchMenu.value && isLocalResource.value) {
    ret.unshift({
      action: 'onRefreshDirectory',
      actionParams: [],
      title: t('exploreCommon.onRefreshDirectory'),
      icon: 'stash:folder-refresh',
      iconStyle: {},
      style: {
        bottom: getBottom()
      }
    })
  }
  return ret
})

const backtopBtnBottom = computed(() => {
  return (fixedBtns.value.length - 1) * 60 + 100
})

const cardItemBtns = computed(() => {
  const item = hoverCardIndex.value > -1 ? cardList.value[hoverCardIndex.value] : null
  if (!item) return []
  const ret = [
    {
      title: t('exploreCommon.setAsWallpaperWithDownload'),
      action: 'setAsWallpaperWithDownload',
      icon: 'lucide:wallpaper'
    },
    {
      title: t('exploreCommon.doViewImage'),
      action: 'doViewImage',
      icon: 'material-symbols:preview'
    }
  ]
  if (item.isFavorite) {
    ret.push({
      title: t('exploreCommon.removeFavorites'),
      action: 'removeFavorites',
      icon: 'ep:star-filled'
    })
  } else {
    ret.push({
      title: t('exploreCommon.addToFavorites'),
      action: 'addToFavorites',
      icon: 'ep:star'
    })
  }
  if (!flags.inPrivacySpace) {
    ret.push({
      title: t('exploreCommon.addToPrivacySpace'),
      action: 'addToPrivacySpace',
      icon: 'material-symbols:privacy-tip-outline'
    })
  }
  if (isFavoritesMenu.value && flags.inPrivacySpace) {
    ret.push({
      title: t('exploreCommon.removePrivacySpace'),
      action: 'removePrivacySpace',
      icon: 'material-symbols:privacy-tip'
    })
  }

  if (item.filePath && (!isSearchMenu.value || (isSearchMenu.value && isLocalResource.value))) {
    ret.push({
      title: t('exploreCommon.onCopyFilePath'),
      action: 'onCopyFilePath',
      icon: 'ep:document-copy'
    })
    ret.push({
      title: t('exploreCommon.onDeleteFile'),
      action: 'onDeleteFile',
      icon: 'ri:delete-bin-line'
    })
    ret.push({
      title: t('exploreCommon.showItemInFolder'),
      action: 'showItemInFolder',
      icon: 'ep:folder-opened'
    })
  }
  if (item.link) {
    ret.push({
      title: t('exploreCommon.openLink'),
      action: 'openLink',
      icon: 'ep:link'
    })
  }

  if (item.srcType === 'url') {
    ret.push({
      title: t('exploreCommon.onDownloadFile'),
      action: 'onDownloadFile',
      icon: 'ri:download-line'
    })
  }

  ret.push({
    title: t('exploreCommon.viewInfo'),
    action: 'onViewInfo',
    icon: 'material-symbols:info-outline-rounded'
  })

  return ret
})

const handleMenuParams = () => {
  searchForm.filterKeywords = props.menuParams && props.menuParams.word ? props.menuParams.word : ''
}

const onTabChange = () => {
  wordFilter.value = ''
}
const getWords = () => {
  if (enabledWordDraw.value) {
    window.FBW.getWords({
      types: [1, 2],
      size: 1000
    }).then((res) => {
      if (res && res.success && res.data) {
        words.value = res.data
      }
    })
  }
}

const onWordClick = (item) => {
  searchForm.filterKeywords = item.word
  onRefresh(true)
}

const onFixedBtnClick = (action, actionParams, childVal) => {
  switch (action) {
    case 'toggleFixedBtns':
      toggleFixedBtns()
      break
    case 'onLoadMore':
      onLoadMore()
      break
    case 'onRefresh':
      onRefresh(...actionParams)
      break
    case 'onSwitchSortType':
      onSwitchSortType()
      break
    case 'isRandom':
      isRandom()
      break
    case 'onSwitchResource':
      onSwitchResource()
      break
    case 'onTogglePrivacySpace':
      onTogglePrivacySpace()
      break
    case 'onToggleAutoRefresh':
      onToggleAutoRefresh()
      break
    case 'onSwitchGridRatio':
      onSwitchGridRatio(childVal)
      break
    case 'onSwitchGridSize':
      onSwitchGridSize(childVal)
      break
    case 'onRefreshDirectory':
      onRefreshDirectory()
      break
  }
}

const onCardItemBtnClick = (action, item, index) => {
  switch (action) {
    case 'setAsWallpaperWithDownload':
      setAsWallpaperWithDownload(item, index)
      break
    case 'doViewImage':
      doViewImage(item, index)
      break
    case 'addToFavorites':
      addToFavorites(item, index)
      break
    case 'removeFavorites':
      removeFavorites(item, index)
      break
    case 'addToPrivacySpace':
      addToFavorites(item, index, true)
      break
    case 'removePrivacySpace':
      removeFavorites(item, index, true)
      break
    case 'onCopyFilePath':
      onCopyFilePath(item.filePath)
      break
    case 'onDeleteFile':
      onDeleteFile(item, index)
      break
    case 'onDownloadFile':
      onDownloadFile(item, index)
      break
    case 'showItemInFolder':
      showItemInFolder(item.filePath)
      break
    case 'openLink':
      openLink(item.link)
      break
    case 'onViewInfo':
      onViewInfo(item)
      break
  }
}

// 切换固定按钮显示隐藏
const toggleFixedBtns = () => {
  flags.showFixedBtns = !flags.showFixedBtns
}

// 切换资源
const onSwitchResource = async () => {
  const prevIndex = searchForm.resourceNameIndex
  const nextIndex = prevIndex + 1 >= currentSourceList.value.length ? 0 : prevIndex + 1
  searchForm.resourceNameIndex = nextIndex
  searchForm.resourceName = currentSourceList.value[nextIndex].value
  await onRefresh(false)
}

// 进入、退出隐私空间
const onTogglePrivacySpace = async () => {
  if (!flags.inPrivacySpace) {
    // 先检查是否设置了隐私密码
    const res = await window.FBW.hasPrivacyPassword()
    if (!res || !res.success || !res.data) {
      ElMessage({
        type: 'error',
        message: t('messages.privacyPasswordNotSet')
      })
      return
    }
    // 弹窗输入隐私空间密码，验证后才能进入隐私空间
    ElMessageBox.prompt(t('messages.inputPrivacySpacePassword'), {
      draggable: true,
      inputType: 'password',
      // 只能输入3到6位的数字，不可以是小数、中文、字母
      inputPattern: /^[0-9]{3,6}$/,
      inputErrorMessage: t('messages.inputPrivacySpacePasswordErrorMessage')
    }).then(async ({ value }) => {
      const res = await window.FBW.checkPrivacyPassword(value)
      if (res && res.success) {
        flags.inPrivacySpace = true
        ElMessage({
          type: 'success',
          message: t('messages.enterPrivacySpaceSuccess')
        })
        await onRefresh(true)
      } else {
        ElMessage({
          type: 'error',
          message: res.message
        })
      }
    })
  } else {
    flags.inPrivacySpace = false
    ElMessage({
      type: 'info',
      message: t('messages.exitedPrivacySpaceSuccess')
    })
    await onRefresh(true)
  }
}

const onToggleAutoRefresh = async () => {
  autoRefreshForm.enabled = !autoRefreshForm.enabled
  const res = await window.FBW.updateSettingData({
    autoRefreshList: autoRefreshForm.enabled
  })
  if (res && res.success) {
    settingStore.updateSettingData(res.data)
  }
}

const onSwitchGridRatio = async (childVal) => {
  if (childVal !== undefined) {
    if (childVal === gridForm.gridHWRatio) {
      return
    }
    gridForm.gridHWRatio = childVal
  } else {
    const index = gridRatioList.findIndex((item) => item.value === gridForm.gridHWRatio)
    const nextIndex = index + 1 < gridRatioList.length ? index + 1 : 0
    gridForm.gridHWRatio = gridRatioList[nextIndex].value
  }

  const entry = cardBlockRef.value
  if (entry) {
    handleGridSize(entry.clientWidth, entry.clientHeight)
  }
  // 创建纯数据对象
  const gridFormData = {
    gridSize: gridForm.gridSize,
    gridHWRatio: gridForm.gridHWRatio
  }

  try {
    const res = await window.FBW.updateSettingData(gridFormData)
    if (res?.success) {
      settingStore.updateSettingData(res.data)
    }
  } catch (err) {
    console.error('Failed to update grid settings:', err)
  }
}

const onSwitchGridSize = async (childVal) => {
  if (childVal !== undefined) {
    if (childVal === gridForm.gridSize) {
      return
    }
    gridForm.gridSize = childVal
  } else {
    const index = gridSizeList.findIndex((item) => item.value === gridForm.gridSize)
    const nextIndex = index + 1 < gridSizeList.length ? index + 1 : 0
    gridForm.gridSize = gridSizeList[nextIndex].value
  }

  const entry = cardBlockRef.value
  if (entry) {
    handleGridSize(entry.clientWidth, entry.clientHeight)
  }

  // 创建纯数据对象
  const gridFormData = {
    gridSize: gridForm.gridSize,
    gridHWRatio: gridForm.gridHWRatio
  }

  const res = await window.FBW.updateSettingData(gridFormData)
  if (res && res.success) {
    settingStore.updateSettingData(res.data)
  }
}

const handleGridSize = (blockWidth = 900, blockHeight = 600) => {
  if (!blockWidth || !blockHeight) return
  const { gridSize, gridHWRatio } = gridForm

  // 减去VirtualList组件的左右margin (10px * 2)
  const availableWidth = blockWidth - 20

  // 批量计算所有需要更新的值
  const updates = {}
  if (gridSize === 'auto') {
    for (let i = 0; i < 10; i++) {
      const size = gridSizeRange.size * Math.pow(1.5, i)
      const minWidth = gridSizeRange.wrapperWidth * Math.pow(1.5, i)
      const maxWidth = gridSizeRange.wrapperWidth * Math.pow(1.5, i + 1)
      if (availableWidth >= minWidth && availableWidth < maxWidth) {
        updates.gridSize = size
        // 计算总间距并从总宽度中减去
        const totalGap = (updates.gridSize - 1) * cardForm.gridGap
        // 使用更精确的计算方法，保留一位小数
        updates.cardWidth = Math.round(((availableWidth - totalGap) / updates.gridSize) * 10) / 10
        updates.cardHeight = Math.round(updates.cardWidth * gridHWRatio * 10) / 10
        break
      }
    }
  } else {
    updates.gridSize = gridSize
    // 计算总间距并从总宽度中减去
    const totalGap = (updates.gridSize - 1) * cardForm.gridGap
    // 使用更精确的计算方法，保留一位小数
    updates.cardWidth = Math.round(((availableWidth - totalGap) / updates.gridSize) * 10) / 10
    updates.cardHeight = Math.round(updates.cardWidth * gridHWRatio * 10) / 10
  }
  // 计算最优缓冲区大小
  updates.buffer = calculateOptimalBuffer(blockHeight, updates.cardHeight)
  // FIXME 动态计算pageSize
  // 计算当前卡片大小下，block容器可以包含多少个卡片
  const allCardSize = Math.floor(
    (blockWidth * blockHeight) / (updates.cardWidth * updates.cardHeight)
  )
  // 计算当前卡片大小下，block容器可以包含行
  const rows = Math.floor(allCardSize / updates.gridSize)
  // 在当前block容器可以包含的行数基础上再加1行，乘以每行grid数量得出新的分页量
  updates.pageSize = Math.floor((rows + 2) * updates.gridSize)

  // 一次性应用所有更新，减少重排次数
  Object.assign(cardForm, updates)
  searchForm.pageSize = updates.pageSize

  doCompleteList()
}

// 优化 buffer 设置 - 根据滚动速度和设备性能动态调整
const calculateOptimalBuffer = (blockHeight, cardHeight) => {
  const baseBuffer = cardHeight * 2 // 基础缓冲区为两行高度
  const screenRows = Math.ceil(blockHeight / cardHeight) // 屏幕可见行数

  // 根据设备性能调整缓冲区大小
  const performanceMultiplier = window.navigator.hardwareConcurrency > 4 ? 1.5 : 1

  // 计算最终缓冲区大小，确保至少有一屏的缓冲
  return parseInt(
    Math.min(
      Math.max(baseBuffer, screenRows * cardHeight * performanceMultiplier),
      blockHeight * 0.5 // 最大不超过视口高度的50%
    )
  )
}

// 补齐列表
const doCompleteList = async () => {
  if (cardList.value.length && searchForm.pageSize > cardList.value.length) {
    await getNextList()
    // 在获取新数据后强制更新视图，但不重置滚动位置
    nextTick(() => {
      scrollRef.value?.updateVisibleItems(false)
    })
  }
}

const onSwitchSortType = async () => {
  searchForm.sortType = 0 - searchForm.sortType
  await onRefresh(false)

  const res = await window.FBW.updateSettingData({
    sortType: searchForm.sortType
  })
  if (res && res.success) {
    settingStore.updateSettingData(res.data)
  }
}

const isRandom = async () => {
  searchForm.isRandom = !searchForm.isRandom
  await onRefresh(false)
}

const onRefreshDirectory = () => {
  window.FBW.refreshDirectory()
}

const onResourceChange = (value) => {
  searchForm.resourceType = value.resourceType
  searchForm.resourceName = value.resourceName
  // 检查是否支持当前的过滤类型
  const types = toRaw(supportSearchTypes)
  const isArray = Array.isArray(types)
  const includes = isArray && types.includes(searchForm.filterType)
  if (!isArray) {
    searchForm.filterType = 'images'
  } else if (isArray && !includes) {
    searchForm.filterType = types[0] || 'images'
  }
  onSearch()
}

const onRefresh = async (flag = true) => {
  // 重置数据
  searchForm.startPage = 1
  searchForm.total = 0
  if (flag) {
    if (isExploreMenu.value || isSearchMenu.value) {
      searchForm.resourceNameIndex = 0
      searchForm.resourceName = currentSourceList.value.length
        ? currentSourceList.value[0].value
        : 'resources'
    } else if (isFavoritesMenu.value) {
      searchForm.resourceType = 'localResource'
      searchForm.resourceNameIndex = -1
      searchForm.resourceName = flags.inPrivacySpace ? 'privacy_space' : 'favorites'
    } else if (isHistoryMenu.value) {
      searchForm.resourceType = 'localResource'
      searchForm.resourceNameIndex = -1
      searchForm.resourceName = 'history'
    }
  }

  cardList.value = []
  // 重置标识
  flags.loading = false
  flags.empty = false
  flags.hasMore = true

  // 使用nextTick替代setTimeout
  await nextTick()
  // 强制更新可视区域的项目，并重置滚动位置
  scrollRef.value?.updateVisibleItems(true)
  // 执行查询
  await getNextList()
}

const onSearch = async () => {
  await onRefresh(false)
}

const onLoadMore = async () => {
  if (flags.loading || !flags.hasMore) {
    return
  }
  flags.loadMoreClicked = true
  // 记录当前最后一个元素的位置
  const lastIndex = cardList.value.length - 1
  await getNextList()
  // 在数据加载完成后，滚动到新加载内容的开始位置
  if (lastIndex >= 0) {
    setTimeout(() => {
      scrollRef.value?.scrollToIndex(lastIndex)
    })
  }
  // 更新可视区域的项目，但不重置滚动位置
  nextTick(() => {
    scrollRef.value?.updateVisibleItems(false)
  })
}
// 防抖
const debouncedGetNextList = debounce(() => {
  getNextList()
}, 300)

const onScroll = (scrollInfo) => {
  // 直接从参数中获取滚动信息
  const { scrollTop, scrollHeight, clientHeight } = scrollInfo

  // 检测是否接近底部（可以调整 buffer 区域）
  const isCloseBottom = scrollHeight - scrollTop - clientHeight < cardForm.buffer
  if (!isCloseBottom || flags.loading || !flags.hasMore) {
    return
  }
  debouncedGetNextList()
}

const getNextList = async () => {
  if (flags.loading) {
    return
  }

  flags.loading = true
  const {
    resourceType,
    resourceName,
    filterKeywords,
    filterType,
    quality,
    orientation,
    startPage,
    pageSize,
    isRandom,
    sortField,
    sortType
  } = searchForm
  let payload = {
    resourceType,
    resourceName,
    startPage,
    pageSize,
    isRandom,
    sortField,
    sortType,
    filterKeywords,
    filterType,
    quality: quality.toString(),
    orientation: orientation.toString()
  }
  let res
  try {
    res = await window.FBW.search(payload)
    if (res && res.success && Array.isArray(res.data.list)) {
      if (res.data.list.length) {
        // 去重
        const ids = cardList.value.map((item) => item.uniqueKey)
        const list = res.data.list
          .filter((item) => !ids.includes(item.uniqueKey))
          .map((item) => {
            const isVideo = item.fileType === 'video'
            // 处理图片路径
            let rawImageUrl
            if (item.srcType === 'file') {
              if (isVideo) {
                rawImageUrl = item.rawImageUrl = item.imageUrl
              } else {
                rawImageUrl =
                  item.rawImageUrl = `fbwtp://fbw/api/images/get?filePath=${item.filePath}`
              }
            } else if (item.srcType === 'url') {
              rawImageUrl = item.rawImageUrl = item.imageUrl
            }
            if (rawImageUrl) {
              const urlObj = new URL(rawImageUrl)
              Object.keys(imgUrlQuery.value).forEach((key) => {
                urlObj.searchParams.set(key, imgUrlQuery.value[key])
              })
              item.imageSrc = urlObj.toString()
            } else {
              item.imageSrc = ''
            }
            // 处理视频URL
            if (isVideo) {
              item.isPlaying = false
              if (item.srcType === 'file') {
                item.videoSrc = `fbwtp://fbw/api/videos/get?filePath=${item.filePath}`
              } else {
                item.videoSrc = item.videoUrl
              }
            }

            // 处理颜色
            item.dominantColorRgb = hex2RGB(item.dominantColor)
            return item
          })

        cardList.value.push(...list)
        searchForm.total = res.data.total
        flags.hasMore = cardList.value.length < res.data.total

        if (list.length) {
          searchForm.startPage = res.data.startPage + 1
        } else {
          // 如果没有新数据但还未达到总数，可能是数据重复，尝试跳过当前页
          if (flags.hasMore && !flags.loadMoreClicked) {
            searchForm.startPage += 1
          } else {
            flags.hasMore = false
            ElMessage({
              type: 'warning',
              message: res.message || t('messages.noMoreData')
            })
          }
        }
      } else {
        flags.hasMore = false
        ElMessage({
          type: 'warning',
          message: res.message || t('messages.noMoreData')
        })
      }
    } else {
      searchForm.total = 0
      ElMessage({
        type: 'error',
        message: res?.message || t('messages.getDataFail')
      })
    }
  } catch (err) {
    console.error(err)
    ElMessage({
      type: 'error',
      message: t('messages.getDataFail')
    })
  } finally {
    flags.loading = false
    flags.loadMoreClicked = false
    flags.empty = !cardList.value.length

    // 强制更新可视区域的项目，但不重置滚动位置
    nextTick(() => {
      scrollRef.value?.updateVisibleItems(false)
    })
  }
}

// 将筛选条件同步到壁纸设置
const onSyncToWallpaperSetting = async () => {
  if (flags.syncToSetting) return

  flags.syncToSetting = true
  // 创建一个简单的纯数据对象，确保可以被序列化
  const settingData = {
    resourceName: searchForm.resourceName,
    quality: Array.isArray(searchForm.quality) ? [...searchForm.quality] : searchForm.quality,
    orientation: Array.isArray(searchForm.orientation)
      ? [...searchForm.orientation]
      : searchForm.orientation,
    filterKeywords: searchForm.filterKeywords
  }
  const res = await window.FBW.updateSettingData(settingData)
  flags.syncToSetting = false
  let options = {}
  if (res && res.success) {
    options.type = 'success'
    options.message = res.message
    settingStore.updateSettingData(res.data)
  } else {
    options.type = 'error'
    options.message = res.message
  }
  ElMessage(options)
}

// 设置为壁纸
const setAsWallpaperWithDownload = async (item, index) => {
  const res = await window.FBW.setAsWallpaperWithDownload(JSON.parse(JSON.stringify(item)))

  let options = {}
  if (res && res.success) {
    options.type = 'success'
    options.message = res.message
    setCardItemStatus(index, 'success')
  } else {
    options.type = 'error'
    options.message = res.message
    setCardItemStatus(index, 'error')
  }
  ElMessage(options)
}

// 添加事件处理函数
const onTagClick = (field, value) => {
  // 如果不是搜索菜单，则不处理
  if (!isSearchMenu.value) {
    return
  }

  // 设置查询条件
  switch (field) {
    case 'resourceName':
      searchForm.resourceName = value
      break
    case 'quality':
      // 判断数组是否包含该值
      if (searchForm.quality.includes(value)) {
        searchForm.quality = searchForm.quality.filter((q) => q !== value)
      } else {
        searchForm.quality = [...searchForm.quality, value]
      }
      break
    case 'orientation':
      // 判断数组是否包含该值
      if (searchForm.orientation.includes(value)) {
        searchForm.orientation = searchForm.orientation.filter((o) => o !== value)
      } else {
        searchForm.orientation = [...searchForm.orientation, value]
      }
      break
  }

  // 触发刷新
  onRefresh(false)
}

// 查看图片
const doViewImage = async (item, index, inner = false) => {
  const list = getRecords(index, viewSize)
  const activeIndex = list.findIndex((i) => i.uniqueKey === item.uniqueKey)
  if (inner) {
    viewImageRef.value.view(activeIndex, list)
  } else {
    window.FBW.openViewImageWindow({
      activeIndex,
      list
    })
  }
}

const onViewImagePrevMore = (item) => {
  let empty = false
  const index = cardList.value.findIndex((i) => i.uniqueKey === item.uniqueKey)
  if (index === 0 || index === -1) {
    empty = true
  } else {
    let end = index < 0 ? 0 : index
    let start = end - viewSize < 0 ? 0 : end - viewSize
    if (end - start < viewSize) {
      start = 0
      end = start + viewSize
    }
    const list = cardList.value.slice(start, end)
    if (list.length) {
      const targetIndex = list.findIndex((i) => i.uniqueKey === item.uniqueKey)
      const activeIndex = targetIndex > 0 ? targetIndex - 1 : list.length - 1
      viewImageRef.value.prepend(activeIndex, list)
    } else {
      empty = true
    }
  }
  if (empty) {
    ElMessage({
      type: 'warning',
      message: t('messages.noMoreData')
    })
    viewImageRef.value.resetLoading()
  }
}

const onViewImageNextMore = (item) => {
  let empty = false
  const index = cardList.value.findIndex((i) => i.uniqueKey === item.uniqueKey)
  if (index === cardList.value.length - 1 || index === -1) {
    empty = true
  } else {
    let start = index + 1
    let end = start + viewSize
    if (end > cardList.value.length) {
      start = cardList.value.length - viewSize
      end = cardList.value.length
    }
    const list = cardList.value.slice(start, end)
    if (list.length) {
      const targetIndex = list.findIndex((i) => i.uniqueKey === item.uniqueKey)
      const activeIndex = targetIndex < list.length - 1 ? targetIndex + 1 : 0
      viewImageRef.value.append(activeIndex, list)
    } else {
      empty = true
    }
  }
  if (empty) {
    ElMessage({
      type: 'warning',
      message: t('messages.noMoreData')
    })
    viewImageRef.value.resetLoading()
  }
}

const getRecords = (startIndex, size = 5) => {
  const len = cardList.value.length
  if (len <= size) {
    return toRaw(cardList.value)
  }
  // 确保索引在有效范围内
  startIndex = Math.max(0, Math.min(startIndex, len - 1))

  // 计算开始和结束索引
  const start = Math.max(0, startIndex - Math.floor(size / 2)) // 向前取5条（包括startIndex本身）
  const end = Math.min(len, startIndex + Math.floor((size - 1) / 2 + 1)) // 向后取5条
  // 返回所需的记录
  return toRaw(cardList.value).slice(start, end)
}

// 加入收藏夹或隐私空间
const addToFavorites = async (item, index, isPrivacySpace = false) => {
  const res = await window.FBW.addToFavorites(item.id, isPrivacySpace)
  // 在加入隐私空间后需要将该条记录从收藏夹移除
  let callback
  if (res.success) {
    item.isFavorite = 1
    if (isPrivacySpace) {
      if (isFavoritesMenu.value) {
        callback = async () => {
          await removeFavorites(item, index)
        }
      } else {
        callback = async () => {
          await onRefresh(true)
        }
      }
    }
  }
  setCardItemStatus(index, res.success ? 'success' : 'error', callback)
}
// 移出收藏或隐私空间
const removeFavorites = async (item, index, isPrivacySpace = false) => {
  const res = await window.FBW.removeFavorites(item.id, isPrivacySpace)
  let callback
  if (res.success) {
    item.isFavorite = 0
    if (isFavoritesMenu.value || isPrivacySpace) {
      callback = async () => {
        await onRefresh(true)
      }
    }
  }
  setCardItemStatus(index, res.success ? 'success' : 'error', callback)
}

// 复制文件地址
const onCopyFilePath = (filePath) => {
  clipboard
    .write(filePath)
    .then(() => {
      ElMessage({
        type: 'success',
        message: t('messages.copySuccess')
      })
    })
    .catch(() => {
      ElMessage({
        type: 'error',
        message: t('messages.copyFail')
      })
    })
}

const onDeleteFile = (item, index) => {
  const onConfirmDeleteFile = async () => {
    const res = await window.FBW.deleteFile(JSON.parse(JSON.stringify(item)))
    let callback
    if (res.success) {
      callback = async () => {
        cardList.value.splice(index, 1)
        await doCompleteList()
        // 强制更新
        nextTick(() => {
          scrollRef.value?.updateVisibleItems(false)
        })
      }
    }
    setCardItemStatus(index, res.success ? 'success' : 'error', callback)
  }
  if (settingData.value.confirmOnDeleteFile) {
    ElMessageBox({
      type: 'warning',
      draggable: true,
      showCancelButton: true,
      message: h(
        'div',
        {
          style: { marginTop: '20px' }
        },
        [
          h('div', null, t('messages.confirmDelete')),
          h(ElCheckbox, {
            label: t('pages.Setting.settingDataForm.confirmOnDeleteFile'),
            // size: 'small',
            checked: settingData.value.confirmOnDeleteFile,
            'onUpdate:modelValue': async (val) => {
              await window.FBW.updateSettingData({
                confirmOnDeleteFile: val
              })
            }
          })
        ]
      )
    }).then(onConfirmDeleteFile)
  } else {
    onConfirmDeleteFile()
  }
}

const showItemInFolder = (filePath) => {
  window.FBW.showItemInFolder(filePath)
}

const openLink = (url) => {
  window.open(url, '_blank')
}

const onDownloadFile = async (item, index) => {
  const res = await window.FBW.downloadFile(JSON.parse(JSON.stringify(item)))

  let options = {}
  if (res && res.success) {
    options.type = 'success'
    options.message = res.message
    setCardItemStatus(index, 'success')
  } else {
    options.type = 'error'
    options.message = res.message
    setCardItemStatus(index, 'error')
  }
  ElMessage(options)
}

const onViewInfo = (item) => {
  if (viewInfoRef.value) {
    viewInfoRef.value.view(toRaw(item))
  }
}

const setCardItemStatus = (index, status, callback) => {
  cardItemStatus.index = index
  cardItemStatus.status = status
  setTimeout(() => {
    cardItemStatus.index = -1
    cardItemStatus.status = null
    typeof callback === 'function' && callback()
  }, 300)
}

const onOverCard = (index) => {
  hoverCardIndex.value = index
}

const onOverBtn = (key) => {
  hoverBtnName.value = key
}
const onOutBtn = () => {
  hoverBtnName.value = null
}

const toggleVideo = (item, index) => {
  const video = videoRefs.value[index]
  window.videoSrc = video?.src
  if (!video) return
  try {
    if (video.paused) {
      item.isPlaying = true
      video.play()
    } else {
      item.isPlaying = false
      video.pause()
    }
  } catch (err) {
    console.error(err)
  }
}

const isShowTag = (item) => {
  return (
    settingData.value.showImageTag &&
    (item.resourceName ||
      (item.quality && item.quality !== 'unset') ||
      item.isLandscape === 1 ||
      item.isLandscape === 0) &&
    cardForm.cardHeight > 100 &&
    cardForm.cardWidth > 100
  )
}

const onTriggerActionCallback = (event, action, params) => {
  if (
    action === 'setWallpaper' &&
    params.success &&
    isHistoryMenu.value &&
    autoRefreshForm.enabled
  ) {
    onRefresh(true)
  } else if (action === 'refreshSearchList' && isSearchMenu.value && isLocalResource.value) {
    onRefresh(true)
  }
}

onBeforeMount(() => {
  // 监听主进程触发事件
  window.FBW.onTriggerAction(onTriggerActionCallback)
})

onMounted(() => {
  // 监听元素宽度变化
  const entry = cardBlockRef.value
  if (entry) {
    resizeObserver.observe(entry)
  }
  handleMenuParams()
  getWords()

  // 确保在组件挂载后立即加载数据
  nextTick(() => {
    onRefresh(true)
  })
})
onBeforeUnmount(() => {
  // 取消主进程事件监听
  window.FBW.offTriggerAction()
  // 清理ResizeObserver
  const entry = cardBlockRef.value
  if (entry) {
    resizeObserver.unobserve(entry)
  }
  resizeObserver.disconnect()

  // 清空大型数据结构
  cardList.value = []
})
</script>

<template>
  <el-main
    v-loading="flags.loading"
    class="explore-common-wrapper"
    :class="{ 'privacy-space': flags.inPrivacySpace }"
    element-loading-background="rgba(0, 0, 0, 0.2)"
  >
    <div v-if="isSearchMenu" class="header-block">
      <el-input
        v-model="searchForm.filterKeywords"
        class="header-search-input"
        :disabled="flags.loading"
        :placeholder="t('exploreCommon.searchForm.filterKeywords.placeholder')"
        clearable
        size="large"
        @keyup.enter="onSearch"
      >
        <template #prepend>
          <el-select
            v-model="selectedResource"
            value-key="key"
            :disabled="flags.loading"
            :placeholder="t('exploreCommon.searchForm.resourceName.placeholder')"
            size="large"
            style="width: 140px"
            @change="onResourceChange"
          >
            <template #label="{ label, value }">
              <IconifyIcon
                :icon="resourceTypeIcons[value.resourceType]"
                style="vertical-align: middle; margin-right: 10px"
              />
              <span>{{ label }}</span>
            </template>
            <el-option-group
              v-for="group in resourceGroupList"
              :key="group.value"
              :label="t(group.locale)"
            >
              <el-option
                v-for="item in group.children"
                :key="item.optionValue.key"
                :label="t(item.locale) || item.value"
                :value="item.optionValue"
              >
                <IconifyIcon
                  :icon="group.icon"
                  style="vertical-align: middle; margin-right: 10px"
                />
                <span>{{ t(item.locale) || item.value }}</span>
              </el-option>
            </el-option-group>
          </el-select>

          <el-select
            v-if="supportSearchTypes.length > 1"
            v-model="searchForm.filterType"
            :disabled="flags.loading"
            :placeholder="t('exploreCommon.searchForm.filterType.placeholder')"
            size="large"
            style="width: 140px; margin-left: 20px"
            @change="onSearch"
          >
            <el-option
              v-for="item in filterTypeOptions"
              :key="item.value"
              :label="t(item.locale)"
              :value="item.value"
            />
          </el-select>

          <el-select
            v-model="searchForm.orientation"
            :disabled="flags.loading"
            :placeholder="t('exploreCommon.searchForm.orientation.placeholder')"
            size="large"
            multiple
            collapse-tags
            style="width: 140px; margin-left: 20px"
            @change="onSearch"
          >
            <el-option
              v-for="item in orientationOptions"
              :key="item.value"
              :label="t(item.locale)"
              :value="item.value"
            />
          </el-select>
          <el-select
            v-if="isLocalResource"
            v-model="searchForm.quality"
            :disabled="flags.loading"
            :placeholder="t('exploreCommon.searchForm.quality.placeholder')"
            size="large"
            multiple
            collapse-tags
            style="width: 140px; margin-left: 20px"
            @change="onSearch"
          >
            <el-option v-for="text in qualityList" :key="text" :label="text" :value="text" />
          </el-select>
        </template>
        <template v-if="isSearchMenu && isLocalResource" #append>
          <el-button type="primary" size="large" @click="onSyncToWallpaperSetting">{{
            t('exploreCommon.onSyncToWallpaperSetting')
          }}</el-button>
        </template>
      </el-input>
    </div>
    <div class="body-block">
      <div
        v-if="enabledWordDraw"
        :class="{ 'word-drawer': true, 'word-drawer-visible': wordDrawerVisible }"
      >
        <el-tabs v-model="activeWordTab" class="words-tabs" @tab-change="onTabChange">
          <el-tab-pane
            v-for="tabItem in wordTypeList"
            :key="tabItem.value"
            :label="t(tabItem.locale)"
            :name="tabItem.value"
          >
          </el-tab-pane>
        </el-tabs>
        <!-- 过滤分词列表 -->
        <div class="word-filter">
          <el-input
            v-model="wordFilter"
            :placeholder="t('exploreCommon.wordFilter.placeholder')"
            clearable
            size="small"
          />
        </div>
        <!-- 分词列表 -->
        <el-scrollbar style="height: calc(100% - 100px); width: 100%">
          <div v-if="activeWordsList.length" class="word-list">
            <el-button
              v-for="item in activeWordsList"
              :key="item.word"
              class="word-item"
              :color="activeWordTabColor"
              size="small"
              plain
              @click="onWordClick(item)"
            >
              <span>{{ item.word }}</span>
              <span>{{ item.count }}</span>
            </el-button>
          </div>
          <EmptyHelp v-else />
        </el-scrollbar>
      </div>
      <div ref="cardBlockRef" class="card-block" :style="cardBlockStyle">
        <el-backtop
          v-if="flags.showFixedBtns"
          class="fixed-btn"
          :right="40"
          :bottom="backtopBtnBottom"
          :visibility-height="200"
          target=".virtual-list-scrollbar .el-scrollbar__wrap"
        />
        <div v-for="item in fixedBtns" :key="item.action" class="fixed-btn" :style="item.style">
          <div v-if="item.children && item.children.length" class="fixed-btn-children">
            <div
              v-for="child in item.children"
              :key="child.value"
              class="fixed-btn-child"
              :title="child.alt || child.title || child.label"
              @click="onFixedBtnClick(item.action, item.actionParams, child.value)"
            >
              <IconifyIcon v-if="child.icon" :icon="child.icon" :style="child.iconStyle" />
              <span v-else class="fixed-btn-text">{{ child.title || child.label }}</span>
            </div>
          </div>
          <el-button
            class="fixed-btn-show"
            circle
            :disabled="flags.loading"
            :title="item.alt || item.title"
            size="large"
            @click="onFixedBtnClick(item.action, item.actionParams)"
          >
            <IconifyIcon v-if="item.icon" :icon="item.icon" :style="item.iconStyle" />
            <span v-else class="fixed-btn-text">{{ item.title }}</span>
          </el-button>
        </div>

        <VirtualList
          v-show="cardList.length"
          ref="scrollRef"
          :items="cardList"
          :item-height="cardForm.cardHeight"
          :item-width="cardForm.cardWidth"
          :grid-size="cardForm.gridSize"
          :grid-gap="cardForm.gridGap"
          :buffer="cardForm.buffer"
          key-field="uniqueKey"
          style="height: 100%; margin: 0 10px"
          @scroll="onScroll"
        >
          <template #default="{ item, index }">
            <div
              :class="[
                'card-item',
                cardItemStatus.index === index && cardItemStatus.status
                  ? 'card-item__' + cardItemStatus.status
                  : ''
              ]"
              :style="{
                '--dominant-color': item.dominantColor || 'transparent',
                '--dominant-color-rgba': item.dominantColorRgb
                  ? `rgba(${item.dominantColorRgb.r}, ${item.dominantColorRgb.g}, ${item.dominantColorRgb.b}, .5)`
                  : 'rgba(255, 255, 255, 0.5)'
              }"
              @mouseenter="onOverCard(index)"
            >
              <div v-if="isShowTag(item)" class="card-item-tags">
                <div
                  v-if="item.resourceName"
                  class="tag-item"
                  :title="item.resourceName"
                  @click.stop="onTagClick('resourceName', item.resourceName)"
                >
                  {{ item.resourceName }}
                </div>
                <div
                  v-if="item.quality && item.quality !== 'unset'"
                  class="tag-item"
                  :title="item.quality"
                  @click.stop="onTagClick('quality', item.quality)"
                >
                  {{ item.quality }}
                </div>
                <div
                  v-if="item.isLandscape === 1"
                  class="tag-item"
                  :title="t('orientationOptions.landscape')"
                  @click.stop="onTagClick('orientation', 1)"
                >
                  <IconifyIcon icon="material-symbols:crop-landscape-outline" />
                </div>
                <div
                  v-else-if="item.isLandscape === 0"
                  class="tag-item"
                  :title="t('orientationOptions.portrait')"
                  @click.stop="onTagClick('orientation', 0)"
                >
                  <IconifyIcon icon="material-symbols:crop-portrait-outline" />
                </div>
                <!-- 收藏 -->
                <div
                  v-if="item.isFavorite"
                  class="tag-item"
                  :title="t('exploreCommon.tagItem.favorited')"
                  style="cursor: not-allowed"
                >
                  <IconifyIcon icon="ep:star-filled" />
                </div>
              </div>
              <div v-if="item.fileType === 'image'" class="card-item-image-wrapper">
                <!-- 高清图 -->
                <el-image
                  class="card-item-image-inner"
                  :src="item.imageSrc"
                  loading="lazy"
                  lazy
                  fit="cover"
                  @dblclick="doViewImage(item, index, true)"
                >
                  <template #error>
                    <div class="image-error-inner">
                      <IconifyIcon icon="material-symbols:broken-image-sharp" />
                    </div>
                  </template>
                </el-image>
              </div>
              <!-- 视频 -->
              <div v-else-if="item.fileType === 'video'" class="card-item-video-wrapper">
                <video
                  :ref="(el) => (videoRefs[index] = el)"
                  class="card-item-video-player"
                  :src="item.videoSrc"
                  :poster="item.imageSrc"
                  preload="metadata"
                  muted
                  loop
                  @dblclick="doViewImage(item, index, true)"
                ></video>
                <IconifyIcon
                  class="card-item-video-btn"
                  :icon="
                    item.isPlaying
                      ? 'material-symbols:pause-circle'
                      : 'material-symbols:play-circle'
                  "
                  @click="toggleVideo(item, index)"
                />
              </div>
              <div class="card-item-btns">
                <el-button
                  v-for="btn in cardItemBtns"
                  :key="btn.action"
                  class="card-item-btn"
                  type="primary"
                  link
                  :title="btn.title"
                  @click="onCardItemBtnClick(btn.action, item, index)"
                  @dblclick.stop
                  @mouseenter="onOverBtn(btn.action)"
                  @mouseleave="onOutBtn()"
                >
                  <IconifyIcon class="card-item-btn-icon" :icon="btn.icon" />
                </el-button>
              </div>
            </div>
          </template>
        </VirtualList>

        <EmptyHelp v-if="flags.empty" />
      </div>
    </div>
    <div class="total-text">
      {{ t('exploreCommon.totalText', { current: cardList.length, total: searchForm.total }) }}
    </div>
    <view-image
      ref="viewImageRef"
      :options="viewImageOptions"
      @prev-more="onViewImagePrevMore"
      @next-more="onViewImageNextMore"
    />
    <view-info ref="viewInfoRef" />
  </el-main>
</template>

<style scoped lang="scss">
.explore-common-wrapper {
  padding: 0;
  position: relative;
  background-color: rgba(50, 57, 65, 1);

  &.privacy-space {
    background-color: rgba(0, 0, 0, 0.8);
  }
}
.header-block {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  margin-bottom: 10px;
  padding: 10px;
}

.header-search-input {
  :deep(.el-input-group__prepend) {
    border-radius: 0;
    background-color: transparent !important;
    box-shadow: 0 -1px 0px 0px var(--el-input-border-color, var(--el-border-color)) inset;

    .el-select__wrapper {
      border-radius: 0;
      box-shadow: 0 -1px 0px 0px var(--el-input-border-color, var(--el-border-color)) inset;

      .el-select__placeholder {
        color: #ffffff;
      }
      .el-tag {
        background-color: transparent;
        color: #ffffff;

        .el-tag__close {
          display: none;
        }
      }
    }
  }
  :deep(.el-input__wrapper) {
    border-radius: 0;
    background-color: transparent !important;
    box-shadow: 0 -1px 0px 0px var(--el-input-border-color, var(--el-border-color)) inset;
    .el-input__inner {
      color: #ffffff;
    }
  }
  :deep(.el-input-group__append) {
    border-radius: 0;
    background-color: transparent !important;
    box-shadow: 0 -1px 0px 0px var(--el-input-border-color, var(--el-border-color)) inset;
    color: #ffffff;
  }
}

.body-block {
  position: relative;
}

.word-drawer {
  position: absolute;
  top: 0;
  bottom: 0;
  left: -300px;
  z-index: 10;
  width: 200px;
  height: 100%;
  padding: 0 10px 20px;
  background-color: #ffffff;
  transition: all 0.3s ease-in-out;

  &.word-drawer-visible {
    left: 0;
  }

  .words-tabs {
    width: 100%;
  }

  .word-filter {
    width: 100%;
    margin: 0 0 10px;
  }
  .word-list {
    width: 100%;
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    gap: 10px;
  }

  .word-item {
    margin: 0;
    width: 100%;

    :deep(> span) {
      width: 100%;
      display: inline-flex;
      justify-content: space-between;
      align-items: center;
    }
  }
}

.card-block {
  flex: 1;
  height: calc(100vh - 60px);
  position: relative;
}
.fixed-btn {
  position: absolute;
  right: 40px;
  bottom: 0;
  z-index: 5;
  font-size: 20px;
  font-weight: bolder;
  background-color: rgba(50, 57, 65, 0.6);
  box-shadow: 0 0 6px rgba(0, 0, 0, 0.12);
  border: none;
  border-radius: 40px;
  color: #ffffff;
  display: flex;
  justify-content: center;
  align-items: center;
  overflow: hidden;
  transform: translateZ(0);
  will-change: transform, opacity;

  &:hover {
    background-color: rgba(50, 57, 65, 0.9);
    .fixed-btn-children {
      transform: translateX(0);
      width: auto;
      padding: 0 10px;
    }
  }

  .fixed-btn-children {
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 10px;
    padding: 0;
    transform: translateX(100%);
    width: 0;
    overflow: hidden;
    transition: all 0.3s ease-in-out;

    .fixed-btn-child {
      min-width: 30px;
      min-height: 30px;
      display: flex;
      justify-content: center;
      align-items: center;
      cursor: pointer;
      color: #ffffff;

      &:hover {
        color: #95d475;
      }

      &:active {
        opacity: 0.8;
      }
    }
  }

  .fixed-btn-show {
    position: relative;
    right: 0px;
    bottom: 0;
    z-index: 5;
    font-size: 20px;
    font-weight: bolder;
    background-color: rgba(50, 57, 65, 0.6);
    box-shadow: 0 0 6px rgba(0, 0, 0, 0.12);
    border: none;
    color: #ffffff;

    &:hover {
      color: #95d475;
    }
    &:active {
      opacity: 0.8;
    }
  }

  .fixed-btn-text {
    font-size: 12px;
  }
}

.card-item {
  contain: content;
  width: 100%;
  height: 100%;
  margin: 0;
  padding: 0;
  background-color: rgba(0, 0, 0, 0.2);
  position: relative;
  cursor: pointer;
  overflow: hidden;
  will-change: transform;
  transform: translateZ(0);
  backface-visibility: hidden;
  transition:
    transform 0.3s ease-out,
    opacity 0.3s ease-out;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;

  &:active {
    opacity: 0.8;
  }
}

.card-item__success {
  position: relative;

  &::after {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background-color: rgba(149, 212, 117, 0.8);
    z-index: 11;
    animation: fadeOut 0.3s forwards;
  }
}

.card-item__error {
  position: relative;

  &::after {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background-color: rgba(248, 152, 152, 0.8);
    z-index: 11;
    animation: fadeOut 0.3s forwards;
  }
}

@keyframes fadeOut {
  0% {
    opacity: 1;
  }
  100% {
    opacity: 0;
  }
}

.card-item-image-wrapper {
  width: 100%;
  height: 100%;
  position: relative;
  overflow: hidden;

  .card-item-image-inner {
    width: 100%;
    height: 100%;
    position: absolute;
    top: 0;
    left: 0;
    color: rgba(255, 255, 255, 0.7);
    font-size: 12px;
    background-color: var(--dominant-color);
    will-change: transform;
    transform: translateZ(0);
    backface-visibility: hidden;

    :deep(.el-image__placeholder) {
      background-color: transparent !important;
    }

    .image-loading-inner {
      display: flex;
      justify-content: center;
      align-items: center;
      width: 100%;
      height: 100%;
      font-size: 12px;
      color: #ffffff;
    }
    .image-error-inner {
      display: flex;
      justify-content: center;
      align-items: center;
      width: 100%;
      height: 100%;
      font-size: 50px;
      color: #ffffff;
    }
  }
}

.card-item-video-wrapper {
  width: 100%;
  height: 100%;
  position: relative;
  overflow: hidden;

  &:hover {
    .card-item-video-btn {
      display: inline-block;
    }
  }

  .card-item-video-player {
    width: 100%;
    height: 100%;
    position: absolute;
    top: 0;
    left: 0;
    object-fit: cover;
    background-color: var(--dominant-color);
    will-change: transform;
    transform: translateZ(0);
    backface-visibility: hidden;
  }
  .card-item-video-btn {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    z-index: 10;
    display: none;
    transition: all 0.3s ease-in-out;
    font-size: 50px;
  }
}

.card-item:hover .card-item-btns {
  transform: translate(0, 0);
}
.card-item-btns {
  position: absolute;
  left: 0;
  bottom: 0;
  transform: translate(0, 100%);
  z-index: 10;
  width: 100%;
  line-height: 1;
  padding: 2px 4px;
  transition: all 0.3s ease-in-out;
  display: grid;
  /* 使用 auto-fit 和 minmax 实现自动换行 */
  grid-template-columns: repeat(auto-fit, minmax(30px, 1fr));
  /* 当元素在单行时水平垂直居中对齐 */
  justify-items: center;
  align-items: center;
  /* 网格间距 */
  gap: 4px;
  backdrop-filter: blur(6px);
  background-color: var(--dominant-color-rgba);

  .card-item-btn {
    margin: 0;
    + .card-item-btn {
      margin: 0;
    }

    &:hover {
      background-color: rgba(0, 0, 0, 0.3);
    }
  }
}

.card-item-btn-icon {
  font-size: 20px;
}

.card-item-tags {
  position: absolute;
  top: 4px;
  left: 4px;
  z-index: 10;
  font-size: 12px;
  color: #ffffff;
  display: flex;
  gap: 4px;
  justify-content: center;
  align-items: center;
}

.tag-item {
  background-color: rgba(0, 0, 0, 0.6);
  padding: 2px 4px;
  border-radius: 4px;
}

.total-text {
  position: fixed;
  bottom: 4px;
  right: 40px;
  font-size: 12px;
}
</style>
