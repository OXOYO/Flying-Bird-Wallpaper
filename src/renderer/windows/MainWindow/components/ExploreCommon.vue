<script setup>
import clipboard from 'clipboardy'
import UseCommonStore from '@renderer/stores/commonStore.js'
import UseSettingStore from '@renderer/stores/settingStore.js'
import UseWordsStore from '@renderer/stores/wordsStore.js'
import { useTranslation } from 'i18next-vue'
import {
  resourceTypeList,
  qualityList,
  orientationOptions,
  autoRefreshListOptions
} from '@common/publicData.js'

const { t } = useTranslation()
const commonStore = UseCommonStore()
const settingStore = UseSettingStore()
const wordsStore = UseWordsStore()
const { settingData } = storeToRefs(settingStore)
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

const cardItemStatus = reactive({
  index: -1,
  status: null
})

const props = defineProps({
  menu: String,
  menuParams: Object
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

const imgUrlQuery = computed(() => {
  const { cardWidth: w, cardHeight: h } = cardForm
  let query = ''
  switch (searchForm.resourceName) {
    case 'pexels':
      query = `?w=${w}&h=${h}`
      break
    case 'unsplash':
      query = `?w=${w}&h=${h}`
      break
    case 'birdpaper':
      query = ''
      break
    default:
      query = `?w=${w}&h=${h}`
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
  scrollDebounce: false // 添加滚动防抖标志
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
  cardGap: 4,
  cardHeight: Math.floor(225 * 0.618),
  gridItems: gridForm.gridSize === 'auto' ? 4 : gridForm.gridSize,
  buffer: 100
})

const searchForm = reactive({
  resourceType: resourceTypeList[0].value,
  resourceNameIndex: -1,
  resourceName: '',
  filterKeywords: '',
  quality: [],
  orientation: [],
  startPage: 1,
  pageSize: 50,
  sortField: settingData.value.sortField || 'created_at',
  sortType: settingData.value.sortType || -1,
  total: 0
})

const resizeObserver = new ResizeObserver((entries) => {
  for (let entry of entries) {
    handleGridSize(entry.contentRect.width, entry.contentRect.height)
  }
})

const itemStyle = computed(() => {
  const gap = cardForm.cardGap
  return {
    width: `${cardForm.cardWidth - gap * 2}px`,
    height: `${cardForm.cardHeight - gap * 2}px`,
    margin: `${gap}px`
  }
})

const fixedBtns = computed(() => {
  const ret = [
    {
      action: 'onLoadMore',
      actionParams: [],
      title: t('exploreCommon.onLoadMore'),
      icon: 'ep:d-arrow-right',
      iconStyle: {
        transform: 'rotate(90deg)'
      },
      style: {
        bottom: '40px'
      }
    },
    {
      action: 'onRefresh',
      actionParams: [false],
      title: t('exploreCommon.onRefresh'),
      icon: 'ep:refresh-right',
      iconStyle: {},
      style: {
        bottom: '100px'
      }
    }
  ]
  const getBottom = () => {
    return (ret.length - 1) * 60 + 100 + 'px'
  }
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
      type: 'setAsWallpaperWithDownload' === hoverBtnName.value ? 'primary' : '',
      action: 'setAsWallpaperWithDownload',
      icon: 'ep:check'
    },
    {
      title: t('exploreCommon.doViewImage'),
      type: 'doViewImage' === hoverBtnName.value ? 'primary' : '',
      action: 'doViewImage',
      icon: 'material-symbols:preview'
    }
  ]
  if (item.isFavorite) {
    ret.push({
      title: t('exploreCommon.removeFavorites'),
      type: 'removeFavorites' === hoverBtnName.value ? 'primary' : '',
      action: 'removeFavorites',
      icon: 'ep:star-filled'
    })
  } else {
    ret.push({
      title: t('exploreCommon.addToFavorites'),
      type: 'addToFavorites' === hoverBtnName.value ? 'primary' : '',
      action: 'addToFavorites',
      icon: 'ep:star'
    })
  }
  if (!flags.inPrivacySpace) {
    ret.push({
      title: t('exploreCommon.addToPrivacySpace'),
      type: 'addToPrivacySpace' === hoverBtnName.value ? 'primary' : '',
      action: 'addToPrivacySpace',
      icon: 'material-symbols:privacy-tip-outline'
    })
  }
  if (isFavoritesMenu.value && flags.inPrivacySpace) {
    ret.push({
      title: t('exploreCommon.removePrivacySpace'),
      type: 'removePrivacySpace' === hoverBtnName.value ? 'primary' : '',
      action: 'removePrivacySpace',
      icon: 'material-symbols:privacy-tip'
    })
  }

  if (item.filePath && (!isSearchMenu.value || (isSearchMenu.value && isLocalResource.value))) {
    ret.push({
      title: t('exploreCommon.onCopyFilePath'),
      type: 'onCopyFilePath' === hoverBtnName.value ? 'primary' : '',
      action: 'onCopyFilePath',
      icon: 'ep:document-copy'
    })
    ret.push({
      title: t('exploreCommon.onDeleteFile'),
      type: 'onDeleteFile' === hoverBtnName.value ? 'primary' : '',
      action: 'onDeleteFile',
      icon: 'ep:close'
    })
    ret.push({
      title: t('exploreCommon.showItemInFolder'),
      type: 'showItemInFolder' === hoverBtnName.value ? 'primary' : '',
      action: 'showItemInFolder',
      icon: 'ep:folder-opened'
    })
  }
  if (item.link) {
    ret.push({
      title: t('exploreCommon.openLink'),
      type: 'openLink' === hoverBtnName.value ? 'primary' : '',
      action: 'openLink',
      icon: 'ep:link'
    })
  }

  ret.push({
    title: t('exploreCommon.viewInfo'),
    type: 'onViewInfo' === hoverBtnName.value ? 'primary' : '',
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
  if (isSearchMenu.value) {
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
    case 'onLoadMore':
      onLoadMore()
      break
    case 'onRefresh':
      onRefresh(...actionParams)
      break
    case 'onSwitchSortType':
      onSwitchSortType()
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
          message: res.msg
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
  handleGridSize(entry.clientWidth, entry.clientHeight)
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
  handleGridSize(entry.clientWidth, entry.clientHeight)
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
  if (gridForm.gridSize === 'auto') {
    for (let i = 0; i < 10; i++) {
      const size = gridSizeRange.size * Math.pow(1.5, i)
      const minWidth = gridSizeRange.wrapperWidth * Math.pow(1.5, i)
      const maxWidth = gridSizeRange.wrapperWidth * Math.pow(1.5, i + 1)
      if (blockWidth >= minWidth && blockWidth < maxWidth) {
        cardForm.gridItems = size
        cardForm.cardWidth = Math.floor(blockWidth / cardForm.gridItems)
        cardForm.cardHeight = Math.floor(cardForm.cardWidth * gridForm.gridHWRatio)
        break
      }
    }
  } else {
    cardForm.gridItems = gridForm.gridSize
    cardForm.cardWidth = Math.floor(blockWidth / cardForm.gridItems)
    cardForm.cardHeight = Math.floor(cardForm.cardWidth * gridForm.gridHWRatio)
  }
  // 优化 buffer 设置 - 根据滚动速度和设备性能动态调整
  const calculateOptimalBuffer = () => {
    const baseBuffer = cardForm.cardHeight * 2 // 基础缓冲区为两行高度
    const screenRows = Math.ceil(blockHeight / cardForm.cardHeight) // 屏幕可见行数

    // 根据设备性能调整缓冲区大小
    const performanceMultiplier = window.navigator.hardwareConcurrency > 4 ? 1.5 : 1

    // 计算最终缓冲区大小，确保至少有一屏的缓冲
    return Math.min(
      Math.max(baseBuffer, screenRows * cardForm.cardHeight * performanceMultiplier),
      blockHeight * 0.5 // 最大不超过视口高度的50%
    )
  }

  cardForm.buffer = parseInt(calculateOptimalBuffer())
  // FIXME 动态计算pageSize
  // 计算当前卡片大小下，block容器可以包含多少个卡片
  const allCardSize = Math.floor(
    (blockWidth * blockHeight) / (cardForm.cardWidth * cardForm.cardHeight)
  )
  // 计算当前卡片大小下，block容器可以包含行
  const rows = Math.floor(allCardSize / cardForm.gridItems)
  // 在当前block容器可以包含的行数基础上再加1行，乘以每行grid数量得出新的分页量
  searchForm.pageSize = Math.floor((rows + 2) * cardForm.gridItems)
  doCompleteList()
}

// 补齐列表
const doCompleteList = async () => {
  if (cardList.value.length && searchForm.pageSize > cardList.value.length) {
    await getNextList()
    // 在获取新数据后强制更新视图
    nextTick(() => {
      scrollRef.value?.updateVisibleItems(true)
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

const onRefreshDirectory = () => {
  window.FBW.refreshDirectory()
}

const onSourceTypeChange = () => {
  nextTick(() => {
    searchForm.resourceNameIndex = 0
    searchForm.resourceName = currentSourceList.value[0].value
    onSearch()
  })
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
  // 强制更新可视区域的项目
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
      scrollRef.value?.scrollToItem(lastIndex)
    })
  }
}

const onScroll = (event) => {
  const { scrollTop, scrollHeight, clientHeight } = event.target
  // 检测是否接近底部（可以调整 buffer 区域）
  const isCloseBottom = scrollHeight - scrollTop - clientHeight < cardForm.buffer
  if (!isCloseBottom || flags.loading || !flags.hasMore) {
    return
  }
  // 添加防抖处理，避免频繁触发
  if (flags.scrollDebounce) {
    return
  }
  flags.scrollDebounce = true
  setTimeout(() => {
    flags.scrollDebounce = false
  }, 300)
  getNextList()
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
    quality,
    orientation,
    startPage,
    pageSize,
    sortField,
    sortType
  } = searchForm
  let payload = {
    resourceType,
    resourceName,
    startPage,
    pageSize,
    sortField,
    sortType,
    filterKeywords,
    quality: quality.toString(),
    orientation: orientation.toString()
  }
  let res
  try {
    res = await window.FBW.searchImages(payload)
    if (res && res.success && Array.isArray(res.data.list)) {
      if (res.data.list.length) {
        // 去重
        const ids = cardList.value.map((item) => item.uniqueKey)
        const list = res.data.list.filter((item) => !ids.includes(item.uniqueKey))
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
              message: res.msg || t('messages.noMoreData')
            })
          }
        }
      } else {
        flags.hasMore = false
        ElMessage({
          type: 'warning',
          message: res.msg || t('messages.noMoreData')
        })
      }
    } else {
      searchForm.total = 0
      ElMessage({
        type: 'error',
        message: res?.msg || t('messages.getDataFail')
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

    // 强制更新可视区域的项目
    setTimeout(() => {
      scrollRef.value?.updateVisibleItems(true)
    })

    flags.empty = !cardList.value.length
  }
  nextTick(() => {
    scrollRef.value?.updateVisibleItems(true)
  })
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
    options.message = res.msg
    settingStore.updateSettingData(res.data)
  } else {
    options.type = 'error'
    options.message = res.msg
  }
  ElMessage(options)
}

// 设置为壁纸
const setAsWallpaperWithDownload = async (item, index) => {
  const res = await window.FBW.setAsWallpaperWithDownload(toRaw(item))
  let options = {}
  if (res && res.success) {
    options.type = 'success'
    options.message = res.msg
    setCardItemStatus(index, 'success')
  } else {
    options.type = 'error'
    options.message = res.msg
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
      callback = async () => {
        await removeFavorites(item, index)
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
    const res = await window.FBW.deleteFile(toRaw(item))
    let callback
    if (res.success) {
      callback = async () => {
        cardList.value.splice(index, 1)
        await doCompleteList()
        // 强制更新
        nextTick(() => {
          scrollRef.value?.updateVisibleItems(true)
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
  resizeObserver.observe(cardBlockRef.value)
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
            v-model="searchForm.resourceType"
            :disabled="flags.loading"
            :placeholder="t('exploreCommon.searchForm.resourceType.placeholder')"
            size="large"
            style="width: 120px"
            @change="onSourceTypeChange"
          >
            <el-option
              v-for="item in resourceTypeList"
              :key="item.value"
              :label="t(item.locale)"
              :value="item.value"
            />
          </el-select>
          <el-select
            v-model="searchForm.resourceName"
            :disabled="flags.loading"
            :placeholder="t('exploreCommon.searchForm.resourceName.placeholder')"
            size="large"
            style="width: 140px; margin-left: 20px"
            @change="onSearch"
          >
            <el-option
              v-for="item in currentSourceList"
              :key="item.value"
              :label="t(item.locale) || item.value"
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
        v-if="isSearchMenu"
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
          class="fixed-btn"
          :right="40"
          :bottom="backtopBtnBottom"
          :visibility-height="200"
          target=".vue-recycle-scroller"
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
        <RecycleScroller
          v-show="cardList.length"
          ref="scrollRef"
          :items="cardList"
          :item-size="cardForm.cardHeight"
          :item-secondary-size="cardForm.cardWidth"
          :grid-items="cardForm.gridItems"
          :buffer="cardForm.buffer"
          key-field="uniqueKey"
          style="height: 100%"
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
              :style="itemStyle"
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
              </div>
              <div class="card-item-image-wrapper">
                <!-- 高清图 -->
                <el-image
                  class="card-item-image"
                  :src="`${item.src}${imgUrlQuery}`"
                  loading="lazy"
                  lazy
                  fit="cover"
                  :style="{
                    backgroundColor: item.dominantColor || 'transparent'
                  }"
                  @dblclick="doViewImage(item, index, true)"
                >
                  <!-- <template #placeholder>
                    <div class="image-loading-inner">Loading...</div>
                  </template> -->
                  <template #error>
                    <div class="image-error-inner">
                      <IconifyIcon icon="material-symbols:broken-image-sharp" />
                    </div>
                  </template>
                </el-image>
              </div>
              <div v-if="hoverCardIndex === index" class="card-item-btns">
                <el-button
                  v-for="btn in cardItemBtns"
                  :key="btn.action"
                  class="card-item-btn"
                  :type="btn.type"
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
        </RecycleScroller>
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
    background-color: rgba(149, 212, 117, 0.5);
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
    background-color: rgba(248, 152, 152, 0.5);
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

  .card-item-image {
    width: 100%;
    height: 100%;
    position: absolute;
    top: 0;
    left: 0;
    color: rgba(255, 255, 255, 0.7);
    font-size: 12px;
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
  backdrop-filter: blur(4px);
  background-color: rgba(255, 255, 255, 0.5);

  .card-item-btn {
    margin: 0;
    + .card-item-btn {
      margin: 0;
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
