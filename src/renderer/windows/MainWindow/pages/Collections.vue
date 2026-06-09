<script setup>
import { useTranslation } from 'i18next-vue'
import { storeToRefs } from 'pinia'
import { resolveApiUserMessage } from '@common/utils.js'
import { scheduleDialogInputFocus } from '@common/focusDialogInput.mjs'
import {
  buildCollectionPickerGroups,
  buildForYouPickerItem,
  COLLECTION_PICKER_TAB_ALL,
  COLLECTION_PICKER_TAB_AUTO,
  COLLECTION_PICKER_TAB_USER,
  COLLECTION_PICKER_TAB_FOR_YOU,
  FOR_YOU_VIRTUAL_ID,
  isForYouVirtualItem
} from '@common/collectionPickerFilter.mjs'
import UseSettingStore from '@renderer/stores/settingStore.js'
import {
  useResourceCardActions,
  normalizeResourceItem
} from '@renderer/composables/useResourceCardActions.js'
import { useExploreCardGrid } from '@renderer/composables/useExploreCardGrid.mjs'
import { useExploreGridSettings } from '@renderer/composables/useExploreGridSettings.mjs'
import { useCollectionFloatingButtons } from '@renderer/composables/useCollectionFloatingButtons.mjs'
import ExploreFixedButtons from '@renderer/components/ExploreFixedButtons.vue'
import CuratorStatsIndicator from '@renderer/components/CuratorStatsIndicator.vue'
import PrivacyPasswordDialog from '@renderer/components/PrivacyPasswordDialog.vue'
import { useSimilarResultsLoadMore } from '@renderer/composables/useSimilarResultsLoadMore.mjs'
import { usePrivacyNsfwMask } from '@common/composables/usePrivacyNsfwMask.mjs'
import { resolveNsfwMaskVerifyFailMessage } from '@common/privacyNsfwMask.js'
import { useExploreCardVideo } from '@renderer/composables/useExploreCardVideo.mjs'

const { t } = useTranslation()
const settingStore = UseSettingStore()
const { settingData } = storeToRefs(settingStore)

const collections = ref([])
const curatorStatsRef = ref(null)
const loading = ref(false)
const prompt = ref('')
const createPromptInputRef = ref(null)
const selectedId = ref(null)
const detail = ref(null)

const selectedCollection = computed(() => detail.value?.collection || null)
const gridItems = ref([])
const itemsTotal = ref(0)
const itemsStartPage = ref(1)
const itemsHasMore = ref(false)
const itemsLoading = ref(false)
const recommendMode = ref(true)
const forYouTotal = ref(0)
const recommendDegraded = ref(false)
const viewImageRef = ref(null)
const viewVideoRef = ref(null)
const viewInfoRef = ref(null)
const privacyPasswordDialogRef = ref(null)
const viewImageOptions = { button: true, backdrop: true }

const {
  shouldMaskItem,
  onMaskClick: onNsfwMaskClick,
  isActionBlocked: isNsfwActionBlocked
} = usePrivacyNsfwMask({
  settingData,
  hasPrivacyPassword: () => window.FBW.hasPrivacyPassword(),
  openPasswordDialog: () => privacyPasswordDialogRef.value?.open(),
  checkPrivacyPassword: (pwd) => window.FBW.checkPrivacyPassword(pwd),
  onVerifyFail: (res) => {
    ElMessage({
      type: res?.errorCode === 'PRIVACY_PASSWORD_NOT_SET' ? 'warning' : 'error',
      message: resolveNsfwMaskVerifyFailMessage(res, t)
    })
  }
})

const notifyNsfwMaskBlocked = () => {
  ElMessage({ type: 'warning', message: t('privacyNsfwMask.actionBlocked') })
}

const exploreCardVideo = useExploreCardVideo({
  getList: () => gridItems.value,
  getSettingData: () => settingData.value,
  isActionBlocked: (item) => isNsfwActionBlocked(item),
  notifyBlocked: notifyNsfwMaskBlocked,
  t
})

const isAutoCollection = (item) => item?.source === 'auto'

const isUserCollection = (item) => item && !isAutoCollection(item)

const showResourceTags = computed(() => !!settingData.value?.showTag)

const {
  cardBlockRef,
  scrollRef,
  cardForm,
  measureAndApply,
  bindResizeObserver,
  unbindResizeObserver
} = useExploreCardGrid(settingData, {
  onLayout: () => {
    nextTick(() => ensureItemsFillViewport())
  }
})

const measureBlock = async () => {
  measureAndApply()
  await nextTick()
}

const { gridSizeList, gridRatioList, onSwitchGridSize, onSwitchGridRatio } = useExploreGridSettings(
  {
    t,
    settingStore,
    settingData,
    cardBlockRef,
    measureAndApply: measureBlock
  }
)

const mapSimilarGridRows = (rows = []) => {
  const gridHWRatio = settingData.value?.gridHWRatio ?? 0.618
  return (rows || []).map((row) =>
    normalizeResourceItem(row, { resourceType: 'localResource', gridHWRatio })
  )
}

const getItemsPageSize = () => Math.max(1, cardForm.pageSize || 50)

const {
  similarMode,
  similarSourceItem,
  similarHasMore,
  similarTotal,
  resetSimilar,
  startSimilar,
  appendSimilarPage
} = useSimilarResultsLoadMore({
  normalizeRows: mapSimilarGridRows,
  getPageSize: getItemsPageSize
})

/** @type {import('vue').Ref<{ cardList: unknown[], hasMore: boolean } | null>} */
const similarListSnapshot = ref(null)

const { fixedBtns, backtopBtnBottom, toggleFixedBtns, showFixedBtns } =
  useCollectionFloatingButtons({
    t,
    settingData,
    gridSizeList,
    gridRatioList,
    selectedCollection,
    recommendMode,
    similarMode,
    isAutoCollection,
    similarBackTitle: computed(() =>
      recommendMode.value
        ? t('pages.Collections.similarBackToForYou')
        : t('pages.Collections.similarBack')
    )
  })

const syncGridItems = (items, append = false) => {
  const gridHWRatio = settingData.value?.gridHWRatio ?? 0.618
  const list = (items || []).map((row) =>
    normalizeResourceItem(row, { resourceType: 'localResource', gridHWRatio })
  )
  if (append) {
    const ids = new Set(gridItems.value.map((row) => row.uniqueKey))
    gridItems.value.push(...list.filter((row) => !ids.has(row.uniqueKey)))
  } else {
    gridItems.value = list
  }
}

const showLoadError = (res) => {
  ElMessage({
    type: 'error',
    message: resolveApiUserMessage(res, t) || t('messages.getDataFail')
  })
}

const fetchRecommendItems = async (startPage, append = false) => {
  itemsLoading.value = true
  try {
    const pageSize = getItemsPageSize()
    const res = await window.FBW.recommend({ startPage, pageSize, resourceName: 'resources' })
    if (!res?.success) {
      showLoadError(res)
      return false
    }
    syncGridItems(res.data?.list, append)
    const total = Number(res.data?.total) || 0
    itemsTotal.value = total
    forYouTotal.value = total
    itemsStartPage.value = res.data?.startPage ?? startPage
    itemsHasMore.value = gridItems.value.length < total
    recommendDegraded.value = !!res.data?.degraded
    return true
  } finally {
    itemsLoading.value = false
  }
}

const fetchCollectionItems = async (id, startPage, append = false) => {
  if (!id) return false
  itemsLoading.value = true
  try {
    const pageSize = getItemsPageSize()
    const res = await window.FBW.collectionsGet({ id, startPage, pageSize })
    if (!res?.success) {
      showLoadError(res)
      return false
    }
    detail.value = { collection: res.data.collection }
    syncGridItems(res.data.items, append)
    const total = Number(res.data.total) || 0
    itemsTotal.value = total
    itemsStartPage.value = res.data.startPage ?? startPage
    itemsHasMore.value = gridItems.value.length < total
    collections.value = collections.value.map((row) =>
      row.id === id ? { ...row, ...(res.data.collection || {}), itemCount: total } : row
    )
    return true
  } finally {
    itemsLoading.value = false
  }
}

/** @param {{ anchorPrevious?: boolean }} [opts] anchorPrevious：触底加载时保持视口锚点；找相似首屏补齐时不锚定 */
const loadMoreSimilarItems = async (opts = {}) => {
  const { anchorPrevious = true } = opts
  if (!similarMode.value || itemsLoading.value || !itemsHasMore.value) return
  itemsLoading.value = true
  try {
    const lastLen = gridItems.value.length
    const result = await appendSimilarPage(
      () => gridItems.value,
      (list) => {
        gridItems.value = list
      }
    )
    if (result.failed) {
      showLoadError(result.error)
    }
    itemsHasMore.value = similarHasMore.value
    itemsTotal.value = similarTotal.value
    if (anchorPrevious && lastLen > 0) {
      await nextTick()
      scrollRef.value?.updateVisibleItems?.(false)
      setTimeout(() => scrollRef.value?.scrollToIndex?.(lastLen - 1))
    } else {
      await nextTick()
      scrollRef.value?.scrollToTop?.(0)
    }
  } finally {
    itemsLoading.value = false
  }
}

const ensureItemsFillViewport = async () => {
  if (similarMode.value) {
    if (itemsLoading.value || !itemsHasMore.value || (!selectedId.value && !recommendMode.value)) return
    const pageSize = getItemsPageSize()
    let guard = 0
    while (
      guard < 8 &&
      !itemsLoading.value &&
      itemsHasMore.value &&
      gridItems.value.length < pageSize &&
      gridItems.value.length < similarTotal.value
    ) {
      guard += 1
      await loadMoreSimilarItems({ anchorPrevious: false })
    }
    return
  }
  if (recommendMode.value) {
    if (itemsLoading.value || !itemsHasMore.value) return
    const pageSize = getItemsPageSize()
    if (gridItems.value.length && pageSize > gridItems.value.length) {
      await fetchRecommendItems(itemsStartPage.value + 1, true)
      await nextTick()
      scrollRef.value?.updateVisibleItems?.(false)
    }
    return
  }
  if (itemsLoading.value || !itemsHasMore.value || !selectedId.value) return
  if (gridItems.value.length && getItemsPageSize() > gridItems.value.length) {
    await fetchCollectionItems(selectedId.value, itemsStartPage.value + 1, true)
    await nextTick()
    scrollRef.value?.updateVisibleItems?.(false)
  }
}

const loadMoreItems = async () => {
  if (similarMode.value) {
    await loadMoreSimilarItems()
    return
  }
  if (recommendMode.value) {
    if (itemsLoading.value || !itemsHasMore.value) return
    await fetchRecommendItems(itemsStartPage.value + 1, true)
    await nextTick()
    scrollRef.value?.updateVisibleItems?.(false)
    return
  }
  if (itemsLoading.value || !itemsHasMore.value || !selectedId.value) return
  await fetchCollectionItems(selectedId.value, itemsStartPage.value + 1, true)
  await nextTick()
  scrollRef.value?.updateVisibleItems?.(false)
}

const onCloseBottom = () => {
  loadMoreItems()
}

const resourceActions = useResourceCardActions({
  getList: () => gridItems.value,
  setList: (list) => {
    gridItems.value = list
  },
  viewImageRef,
  viewVideoRef,
  viewInfoRef,
  getSimilarScope: () => {
    if (recommendMode.value) {
      return { type: 'search', resourceType: 'localResource', resourceName: 'resources' }
    }
    if (selectedId.value) return { type: 'collection', collectionId: selectedId.value }
    return { type: 'collection', collectionId: null }
  },
  getSimilarPageSize: getItemsPageSize,
  cardContext: () => ({
    inPrivacySpace: false,
    isFavoritesMenu: false,
    isSearchMenu: false,
    isLocalResource: true
  }),
  shouldBlockView: (item) => shouldMaskItem.value(item),
  onItemRemoved: async () => {
    if (selectedId.value) await loadDetail(selectedId.value)
  },
  onFindSimilarResult: (list, item, meta) => {
    if (!item?.id || (!selectedId.value && !recommendMode.value)) return
    const gridHWRatio = settingData.value?.gridHWRatio ?? 0.618
    const scope = recommendMode.value
      ? { type: 'search', resourceType: 'localResource', resourceName: 'resources' }
      : { type: 'collection', collectionId: selectedId.value }
    const sourceItem = normalizeResourceItem(item, {
      resourceType: 'localResource',
      gridHWRatio
    })
    if (!similarMode.value) {
      similarListSnapshot.value = {
        mode: recommendMode.value ? 'recommend' : 'collection',
        collectionId: selectedId.value,
        items: gridItems.value.slice(),
        itemsHasMore: itemsHasMore.value,
        itemsTotal: itemsTotal.value
      }
    }
    const firstRows = Array.isArray(list) ? list : []
    gridItems.value = startSimilar({
      resourceId: item.id,
      scope,
      sourceItem,
      firstRows,
      pageSize: getItemsPageSize(),
      total: meta?.total
    })
    itemsHasMore.value = similarHasMore.value
    itemsTotal.value = similarTotal.value
    void (async () => {
      await nextTick()
      scrollRef.value?.resetScroll?.()
      await ensureItemsFillViewport()
      scrollRef.value?.resetScroll?.()
    })()
  }
})

const cardStatusClass = (index) => {
  if (resourceActions.cardItemStatus.index !== index) return ''
  return resourceActions.cardItemStatus.status || ''
}

const similarSourceImageSrc = computed(() => similarSourceItem.value?.imageSrc || '')

const exitSimilarMode = () => {
  const snap = similarListSnapshot.value
  resetSimilar()
  if (snap?.mode === 'recommend') {
    recommendMode.value = true
    selectedId.value = null
    detail.value = null
    gridItems.value = snap.items || []
    itemsHasMore.value = !!snap.itemsHasMore
    itemsTotal.value = snap.itemsTotal ?? gridItems.value.length
  } else if (snap?.collectionId && snap.collectionId === selectedId.value) {
    gridItems.value = snap.items || []
    itemsHasMore.value = !!snap.itemsHasMore
    itemsTotal.value = snap.itemsTotal ?? gridItems.value.length
  } else if (recommendMode.value) {
    void enterRecommendMode()
  } else if (selectedId.value) {
    void loadDetail(selectedId.value)
  } else {
    gridItems.value = []
    itemsHasMore.value = false
    itemsTotal.value = 0
  }
  similarListSnapshot.value = null
  nextTick(() => scrollRef.value?.resetScroll?.())
}

const onCardAction = (action, item, index) => {
  if (isNsfwActionBlocked(item)) {
    notifyNsfwMaskBlocked()
    return
  }
  resourceActions.onCardAction(action, item, index)
}

const onCardDblClick = (item, index) => {
  if (isNsfwActionBlocked(item)) {
    notifyNsfwMaskBlocked()
    return
  }
  resourceActions.onDblClickCard(item, index)
}

const createDialogVisible = ref(false)
const createSubmitting = ref(false)
const promptDialogMode = ref('create')

const promptDialogTitle = computed(() =>
  promptDialogMode.value === 'edit'
    ? t('pages.Collections.editDialogTitle')
    : t('pages.Collections.createDialogTitle')
)

const promptSubmitLabel = computed(() =>
  promptDialogMode.value === 'edit'
    ? t('pages.Collections.saveAndRegenerate')
    : t('pages.Collections.create')
)

const onCreateDialogBeforeClose = (done) => {
  if (createSubmitting.value) return
  done()
}

const collectionPickerOpen = ref(false)
const collectionPickerQuery = ref('')
const collectionPickerTab = ref(COLLECTION_PICKER_TAB_ALL)
const collectionPickerSearchRef = ref(null)
const collectionPickerTriggerRef = ref(null)
const collectionPickerPopoverWidth = ref(360)

const forYouPickerItem = computed(() =>
  buildForYouPickerItem({
    title: t('pages.Collections.forYouTitle'),
    count: forYouTotal.value
  })
)

const collectionPickerGroups = computed(() =>
  buildCollectionPickerGroups(collections.value, {
    query: collectionPickerQuery.value,
    tab: collectionPickerTab.value,
    isAutoCollection,
    sectionAutoLabel: t('pages.Collections.sectionAuto'),
    sectionUserLabel: t('pages.Collections.sectionUser'),
    forYouItem: forYouPickerItem.value,
    forYouSectionLabel: t('pages.Collections.sectionForYou')
  })
)

const pickerActiveId = computed(() =>
  recommendMode.value ? FOR_YOU_VIRTUAL_ID : selectedId.value
)

const hasCollectionPickerFilter = computed(
  () =>
    !!collectionPickerQuery.value.trim() ||
    collectionPickerTab.value !== COLLECTION_PICKER_TAB_ALL
)

const collectionSelectTriggerLabel = computed(() => {
  if (recommendMode.value) return t('pages.Collections.forYouTitle')
  const item = collections.value.find((c) => c.id === selectedId.value)
  if (item?.name) return item.name
  if (loading.value) return t('messages.loading')
  return t('pages.Collections.selectPlaceholder')
})

const collectionSelectTriggerMeta = computed(() => {
  if (recommendMode.value) {
    return t('pages.Collections.itemCount', { count: forYouTotal.value })
  }
  const item = collections.value.find((c) => c.id === selectedId.value)
  return item ? collectionItemCountText(item) : ''
})

const collectionItemCount = (item) => Number(item?.itemCount ?? item?.itemcount ?? 0)

const collectionItemCountText = (item) =>
  t('pages.Collections.itemCount', { count: collectionItemCount(item) })

const refreshModeOptions = computed(() => [
  { value: 'manual', label: t('pages.Collections.refreshModeManual') },
  { value: '1h', label: t('pages.Collections.refreshMode1h') },
  { value: '6h', label: t('pages.Collections.refreshMode6h') },
  { value: '12h', label: t('pages.Collections.refreshMode12h') },
  { value: '24h', label: t('pages.Collections.refreshMode24h') }
])

const refreshModeLabel = (mode) => {
  if (mode === 'on_analysis') return t('pages.Collections.refreshModeOnAnalysis')
  return refreshModeOptions.value.find((item) => item.value === mode)?.label || mode
}

const resetGridScroll = () => {
  nextTick(() => scrollRef.value?.resetScroll?.())
}

const selectFirstDisplayed = async () => {
  if (recommendMode.value) return
  const list = collections.value
  if (!list.some((item) => item.id === selectedId.value)) {
    await enterRecommendMode()
  }
}

const enterRecommendMode = async () => {
  selectedId.value = null
  detail.value = null
  recommendMode.value = true
  resetSimilar()
  similarListSnapshot.value = null
  gridItems.value = []
  itemsTotal.value = 0
  itemsHasMore.value = false
  itemsStartPage.value = 1
  recommendDegraded.value = false
  await fetchRecommendItems(1, false)
  resetGridScroll()
  await measureBlock()
  await ensureItemsFillViewport()
}

const onCollectionChange = async (id) => {
  if (!id) {
    selectedId.value = null
    detail.value = null
    gridItems.value = []
    return
  }
  recommendMode.value = false
  await loadDetail(id)
}

const applyCollectionListResponse = (listRes) => {
  if (listRes?.success && Array.isArray(listRes.data)) {
    collections.value = listRes.data.map((row) => ({
      ...row,
      itemCount: Number(row.itemCount ?? row.itemcount ?? 0)
    }))
    return true
  }
  showLoadError(listRes)
  return false
}

const fetchCollectionList = () => window.FBW.collectionsList()

/** 展开下拉时静默刷新列表（不触发整页 loading） */
const refreshCollectionList = async () => {
  const listRes = await fetchCollectionList()
  applyCollectionListResponse(listRes)
  await curatorStatsRef.value?.refresh()
  await nextTick()
  await selectFirstDisplayed()
}

const resetCollectionPickerFilter = () => {
  collectionPickerQuery.value = ''
  collectionPickerTab.value = recommendMode.value
    ? COLLECTION_PICKER_TAB_FOR_YOU
    : COLLECTION_PICKER_TAB_ALL
}

const syncCollectionPickerPopoverWidth = () => {
  const w = collectionPickerTriggerRef.value?.offsetWidth
  if (w > 0) collectionPickerPopoverWidth.value = Math.round(w)
}

const onCollectionPickerShow = () => {
  resetCollectionPickerFilter()
  syncCollectionPickerPopoverWidth()
  void refreshCollectionList()
  nextTick(() => scheduleDialogInputFocus(() => collectionPickerSearchRef.value))
}

const selectCollectionFromPicker = async (item) => {
  if (!item?.id) return
  collectionPickerOpen.value = false
  if (isForYouVirtualItem(item)) {
    if (!recommendMode.value) await enterRecommendMode()
    return
  }
  recommendMode.value = false
  if (selectedId.value !== item.id) {
    await onCollectionChange(item.id)
  }
}

const loadList = async () => {
  loading.value = true
  try {
    const listRes = await fetchCollectionList()
    if (!applyCollectionListResponse(listRes)) return
    await curatorStatsRef.value?.refresh()
    await nextTick()
    if (recommendMode.value) {
      await fetchRecommendItems(1, false)
    } else if (selectedId.value) {
      await selectFirstDisplayed()
    } else {
      await enterRecommendMode()
    }
  } finally {
    loading.value = false
  }
}

const loadDetail = async (id) => {
  recommendMode.value = false
  selectedId.value = id
  resetSimilar()
  similarListSnapshot.value = null
  gridItems.value = []
  itemsTotal.value = 0
  itemsHasMore.value = false
  itemsStartPage.value = 1
  await fetchCollectionItems(id, 1, false)
  resetGridScroll()
  await measureBlock()
  await ensureItemsFillViewport()
}

const onCreate = async () => {
  if (!prompt.value.trim() || createSubmitting.value) return
  createSubmitting.value = true
  try {
    const res = await window.FBW.collectionsCreate({ prompt: prompt.value.trim() })
    ElMessage({
      type: res.success ? 'success' : 'error',
      message: resolveApiUserMessage(res, t)
    })
    if (res.success) {
      prompt.value = ''
      createDialogVisible.value = false
      loading.value = true
      try {
        await loadList()
        if (res.data?.id) await loadDetail(res.data.id)
      } finally {
        loading.value = false
      }
    }
  } finally {
    createSubmitting.value = false
  }
}

const onEdit = async () => {
  const id = selectedCollection.value?.id
  if (!id || !isUserCollection(selectedCollection.value) || !prompt.value.trim() || createSubmitting.value) {
    return
  }
  createSubmitting.value = true
  try {
    const res = await window.FBW.collectionsUpdate({
      id,
      prompt: prompt.value.trim(),
      fromPrompt: true
    })
    ElMessage({
      type: res.success ? 'success' : 'error',
      message: resolveApiUserMessage(res, t)
    })
    if (res.success) {
      createDialogVisible.value = false
      loading.value = true
      try {
        await loadList()
        await loadDetail(id)
      } finally {
        loading.value = false
      }
    }
  } finally {
    createSubmitting.value = false
  }
}

const onPromptSubmit = async () => {
  if (promptDialogMode.value === 'edit') {
    await onEdit()
  } else {
    await onCreate()
  }
}

const onRefresh = async (id) => {
  loading.value = true
  try {
    const res = await window.FBW.collectionsGenerate({ id })
    ElMessage({
      type: res.success ? 'success' : 'error',
      message: resolveApiUserMessage(res, t)
    })
    if (res.success) await loadDetail(id)
  } finally {
    loading.value = false
  }
}

const onDelete = async (id) => {
  await ElMessageBox.confirm(t('pages.Collections.confirmDelete'), { type: 'warning' })
  const res = await window.FBW.collectionsDelete({ id })
  ElMessage({
    type: res.success ? 'success' : 'error',
    message: res.success ? t('messages.deleteSuccess') : resolveApiUserMessage(res, t)
  })
  if (res.success) {
    if (selectedId.value === id) {
      selectedId.value = null
      detail.value = null
      gridItems.value = []
    }
    await loadList()
    await selectFirstDisplayed()
  }
}

const onAddFavorites = async (id) => {
  const item = collections.value.find((c) => c.id === id)
  try {
    await ElMessageBox.confirm(
      t('pages.Collections.confirmAddAllFavorites', { name: item?.name || '' }),
      { type: 'warning' }
    )
  } catch {
    return
  }
  const res = await window.FBW.collectionsAddAllToFavorites({ id })
  ElMessage({
    type: res.success ? 'success' : 'error',
    message: resolveApiUserMessage(res, t)
  })
}

const onRecommendRefresh = async () => {
  if (!recommendMode.value || itemsLoading.value) return
  loading.value = true
  try {
    gridItems.value = []
    itemsStartPage.value = 1
    itemsHasMore.value = false
    await fetchRecommendItems(1, false)
    resetGridScroll()
    await measureBlock()
    await ensureItemsFillViewport()
  } finally {
    loading.value = false
  }
}

const onRecommendAddAllFavorites = async () => {
  try {
    await ElMessageBox.confirm(t('pages.Collections.confirmAddAllForYouFavorites'), {
      type: 'warning'
    })
  } catch {
    return
  }
  const res = await window.FBW.recommendAddAllToFavorites({ resourceName: 'resources' })
  ElMessage({
    type: res.success ? 'success' : 'error',
    message: resolveApiUserMessage(res, t)
  })
}

const onFixedBtnAction = async (action, _actionParams, childVal) => {
  switch (action) {
    case 'toggleFixedBtns':
      toggleFixedBtns()
      break
    case 'exitSimilar':
      exitSimilarMode()
      break
    case 'onRefresh':
      if (recommendMode.value) {
        await onRecommendRefresh()
      } else if (selectedCollection.value?.id) {
        await onRefresh(selectedCollection.value.id)
      }
      break
    case 'addAllFavorites':
      if (recommendMode.value) {
        await onRecommendAddAllFavorites()
      } else if (selectedCollection.value?.id) {
        await onAddFavorites(selectedCollection.value.id)
      }
      break
    case 'onSwitchGridSize':
      await onSwitchGridSize(childVal)
      break
    case 'onSwitchGridRatio':
      await onSwitchGridRatio(childVal)
      break
    default:
      break
  }
}

const onRefreshModeChange = async (mode) => {
  if (!selectedCollection.value?.id || isAutoCollection(selectedCollection.value)) return
  const res = await window.FBW.collectionsUpdate({
    id: selectedCollection.value.id,
    refreshMode: mode
  })
  ElMessage({
    type: res.success ? 'success' : 'error',
    message: res.success ? t('pages.Collections.refreshModeUpdated') : resolveApiUserMessage(res, t)
  })
  if (res.success) {
    await loadDetail(selectedCollection.value.id)
    await loadList()
  }
}

const openCreateDialog = () => {
  promptDialogMode.value = 'create'
  prompt.value = ''
  createDialogVisible.value = true
}

const openEditDialog = () => {
  const item = selectedCollection.value
  if (!item?.id || !isUserCollection(item)) return
  promptDialogMode.value = 'edit'
  prompt.value = item.prompt || item.name || ''
  createDialogVisible.value = true
}

const onHeaderMenuCommand = async (command) => {
  if (command === 'create') {
    openCreateDialog()
    return
  }
  if (command === 'edit') {
    openEditDialog()
    return
  }
  if (command === 'curate') {
    await onCurateNow()
    return
  }
  if (recommendMode.value) {
    if (command === 'forYouRefresh') {
      await onRecommendRefresh()
    } else if (command === 'forYouFavorites') {
      await onRecommendAddAllFavorites()
    }
    return
  }
  const id = selectedCollection.value?.id
  if (!id) return
  if (command === 'refresh') {
    await onRefresh(id)
  } else if (command === 'favorites') {
    await onAddFavorites(id)
  } else if (command === 'delete') {
    await onDelete(id)
  } else if (typeof command === 'string' && command.startsWith('refreshMode:')) {
    await onRefreshModeChange(command.slice('refreshMode:'.length))
  }
}

const currentRefreshMode = computed(
  () => selectedCollection.value?.refreshMode || 'manual'
)

const isRefreshModeActive = (mode) => currentRefreshMode.value === mode

const onCurateNow = async () => {
  if (curatorStatsRef.value?.stats?.autoCurateSettled) {
    try {
      await ElMessageBox.confirm(t('pages.Collections.curateManualConfirmSettled'), {
        type: 'warning',
        confirmButtonText: t('pages.Collections.curateNow'),
        cancelButtonText: t('pages.Collections.dialogCancel')
      })
    } catch {
      return
    }
  }
  loading.value = true
  try {
    const res = await window.FBW.collectionsCurate()
    ElMessage({
      type: res.success ? 'success' : 'warning',
      message: res.success
        ? t('pages.Collections.curateSuccess', {
            count: res.data?.autoCollections ?? 0
          })
        : resolveApiUserMessage(res, t)
    })
    await loadList()
    if (selectedId.value) await loadDetail(selectedId.value)
  } finally {
    loading.value = false
  }
}

watch([selectedId, recommendMode], async ([id, inRecommend]) => {
  if (!id && !inRecommend) return
  await nextTick()
  await measureBlock()
})

watch(
  () => gridItems.value.length,
  () => nextTick(() => measureBlock())
)

onMounted(async () => {
  await loadList()
  await nextTick()
  bindResizeObserver()
  if (selectedId.value || recommendMode.value) {
    await measureBlock()
  }
})

onBeforeUnmount(() => {
  exploreCardVideo.setUnmounting(true)
  exploreCardVideo.cleanupVideos()
  unbindResizeObserver()
})
</script>

<template>
  <el-main
    v-loading="loading"
    class="page-collections"
    aria-label="collections"
    element-loading-background="rgba(0, 0, 0, 0.2)"
  >
    <div class="header-block header-block--overlay-host">
      <div
        class="header-block__controls"
        :class="{ 'header-block__controls--under-banner': similarMode }"
      >
        <div class="collection-picker-toolbar__row">
          <el-popover
            v-model:visible="collectionPickerOpen"
            trigger="click"
            placement="bottom-start"
            :width="collectionPickerPopoverWidth"
            popper-class="collection-picker-popper"
            :disabled="loading"
            @show="onCollectionPickerShow"
          >
            <template #reference>
              <button
                ref="collectionPickerTriggerRef"
                type="button"
                class="collection-select-trigger"
                :disabled="loading"
                :aria-label="t('pages.Collections.selectPlaceholder')"
              >
                <span class="collection-select-trigger__name">{{
                  collectionSelectTriggerLabel
                }}</span>
                <span
                  v-if="collectionSelectTriggerMeta"
                  class="collection-select-trigger__meta"
                >
                  {{ collectionSelectTriggerMeta }}
                </span>
                <IconifyIcon
                  icon="custom:arrow-right"
                  class="collection-select-trigger__arrow"
                  aria-hidden="true"
                />
              </button>
            </template>
            <div class="collection-picker-panel">
              <div class="collection-picker-panel__filter">
                <el-input
                  ref="collectionPickerSearchRef"
                  v-model="collectionPickerQuery"
                  clearable
                  :placeholder="t('pages.Collections.listSearchPlaceholder')"
                >
                  <template #prefix>
                    <IconifyIcon icon="custom:search" />
                  </template>
                </el-input>
                <el-tabs v-model="collectionPickerTab" class="collection-picker-panel__tabs">
                  <el-tab-pane
                    :label="t('pages.Collections.listTabAll')"
                    :name="COLLECTION_PICKER_TAB_ALL"
                  />
                  <el-tab-pane
                    :label="t('pages.Collections.listTabForYou')"
                    :name="COLLECTION_PICKER_TAB_FOR_YOU"
                  />
                  <el-tab-pane
                    :label="t('pages.Collections.listTabAuto')"
                    :name="COLLECTION_PICKER_TAB_AUTO"
                  />
                  <el-tab-pane
                    :label="t('pages.Collections.listTabUser')"
                    :name="COLLECTION_PICKER_TAB_USER"
                  />
                </el-tabs>
              </div>
              <el-scrollbar height="300" class="collection-picker-panel__list">
                <template v-if="collectionPickerGroups.length">
                  <div
                    v-for="group in collectionPickerGroups"
                    :key="group.key"
                    class="collection-picker-panel__group"
                  >
                    <div
                      v-if="group.title && !group.hideTitle"
                      class="collection-picker-panel__group-title"
                    >
                      {{ group.title }}
                    </div>
                    <button
                      v-for="item in group.items"
                      :key="item.id"
                      type="button"
                      class="collection-picker-panel__item"
                      :class="{ 'collection-picker-panel__item--active': item.id === pickerActiveId }"
                      @click="selectCollectionFromPicker(item)"
                    >
                      <span class="collection-picker-panel__item-name">{{ item.name }}</span>
                      <span class="collection-picker-panel__item-tail">
                        <span class="collection-picker-panel__item-count">{{
                          collectionItemCountText(item)
                        }}</span>
                        <span
                          v-if="item.id === pickerActiveId"
                          class="collection-picker-panel__item-check"
                          aria-hidden="true"
                        >✓</span>
                      </span>
                    </button>
                  </div>
                </template>
                <div v-else class="collection-picker-panel__empty">
                  {{
                    hasCollectionPickerFilter
                      ? t('pages.Collections.listNoMatch')
                      : t('pages.Collections.empty')
                  }}
                </div>
              </el-scrollbar>
            </div>
          </el-popover>

          <el-dropdown trigger="click" placement="bottom-end" @command="onHeaderMenuCommand">
          <el-button
            class="condition-item header-actions-btn"
            circle
            :disabled="loading"
            :title="t('pages.Collections.actionsMenu')"
            :aria-label="t('pages.Collections.actionsMenu')"
          >
            <IconifyIcon icon="custom:more-vertical" />
          </el-button>
          <template #dropdown>
            <el-dropdown-menu class="collections-actions-menu">
              <li class="dropdown-group-header" role="presentation">
                {{ t('pages.Collections.actionsSectionCreate') }}
              </li>
              <el-dropdown-item command="create">
                {{ t('pages.Collections.createNew') }}
              </el-dropdown-item>
              <el-dropdown-item command="curate" :disabled="loading">
                {{ t('pages.Collections.curateNow') }}
              </el-dropdown-item>

              <template v-if="recommendMode">
                <li class="dropdown-group-header" role="presentation">
                  {{ t('pages.Collections.actionsSectionCurrent') }}
                </li>
                <el-dropdown-item command="forYouRefresh" :disabled="loading">
                  {{ t('pages.Collections.forYouRefresh') }}
                </el-dropdown-item>
                <el-dropdown-item command="forYouFavorites">
                  {{ t('pages.Collections.addFavorites') }}
                </el-dropdown-item>
              </template>

              <template v-else-if="selectedCollection">
                <li class="dropdown-group-header" role="presentation">
                  {{ t('pages.Collections.actionsSectionCurrent') }}
                </li>
                <template v-if="!isAutoCollection(selectedCollection)">
                  <el-dropdown-item command="edit" :disabled="loading">
                    {{ t('pages.Collections.editCollection') }}
                  </el-dropdown-item>
                  <li class="dropdown-group-caption" role="presentation">
                    {{ t('pages.Collections.refreshMode') }}
                  </li>
                  <el-dropdown-item
                    v-for="item in refreshModeOptions"
                    :key="item.value"
                    :command="`refreshMode:${item.value}`"
                    class="dropdown-option-item"
                    :class="{ 'is-active': isRefreshModeActive(item.value) }"
                  >
                    <span v-if="isRefreshModeActive(item.value)" class="dropdown-check-mark">✓</span>
                    {{ item.label }}
                  </el-dropdown-item>
                  <el-dropdown-item command="refresh" :disabled="loading" divided>
                    {{ t('pages.Collections.refresh') }}
                  </el-dropdown-item>
                </template>
                <el-dropdown-item
                  command="favorites"
                  :divided="isAutoCollection(selectedCollection)"
                >
                  {{ t('pages.Collections.addFavorites') }}
                </el-dropdown-item>
                <el-dropdown-item
                  v-if="!isAutoCollection(selectedCollection)"
                  command="delete"
                  divided
                >
                  <span class="dropdown-danger">{{ t('pages.Collections.delete') }}</span>
                </el-dropdown-item>
              </template>
            </el-dropdown-menu>
          </template>
          </el-dropdown>
        </div>
        <p v-if="recommendMode && recommendDegraded && !similarMode" class="for-you-degraded-hint">
          {{ t('pages.Collections.forYouDegraded') }}
        </p>
      </div>
      <ExploreSimilarModeBanner
        v-if="similarMode"
        :message="t('pages.Collections.similarModeBanner')"
        :source-image-src="similarSourceImageSrc"
        :back-aria-label="
          recommendMode
            ? t('pages.Collections.similarBackToForYou')
            : t('pages.Collections.similarBack')
        "
        bar-background="rgba(50, 57, 65, 1)"
        @back="exitSimilarMode"
      />
    </div>

    <div class="body-block">
      <section class="collections-body">
        <div ref="cardBlockRef" class="collection-card-block">
          <VirtualList
            v-if="(selectedCollection || recommendMode) && (gridItems.length || itemsLoading)"
            ref="scrollRef"
            :items="gridItems"
            :item-height="cardForm.cardHeight"
            :item-width="cardForm.cardWidth"
            :grid-size="cardForm.gridSize"
            :grid-gap="cardForm.gridGap"
            :buffer="cardForm.buffer"
            key-field="uniqueKey"
            style="height: 100%; margin: 0 10px"
            @close-bottom="onCloseBottom"
          >
            <template #default="{ item, index }">
              <div
                :class="[
                  'card-item',
                  cardStatusClass(index) ? `card-item__${cardStatusClass(index)}` : ''
                ]"
              >
                <ResourceExploreCard
                  :item="item"
                  :index="index"
                  :video-api="exploreCardVideo"
                  fill
                  :show-tags="showResourceTags"
                  :show-ai-badge="false"
                  :show-caption="false"
                  :nsfw-masked="shouldMaskItem(item)"
                  :actions-disabled="shouldMaskItem(item)"
                  @action="onCardAction"
                  @dblclick-card="onCardDblClick"
                  @nsfw-mask-click="onNsfwMaskClick"
                />
              </div>
            </template>
          </VirtualList>
          <div v-else-if="!collections.length && !recommendMode && !loading" class="body-empty">
            <EmptyHelp :text="t('pages.Collections.empty')" :enable-jump="false">
              <template #action>
                <el-button type="primary" @click="enterRecommendMode">
                  {{ t('pages.Collections.forYouTitle') }}
                </el-button>
                <el-button @click="openCreateDialog">
                  {{ t('pages.Collections.createNew') }}
                </el-button>
              </template>
            </EmptyHelp>
          </div>
          <div
            v-else-if="(selectedCollection || recommendMode) && !gridItems.length && !loading && !itemsLoading"
            class="body-empty"
          >
            <EmptyHelp
              :text="recommendMode ? t('pages.Collections.forYouEmpty') : t('pages.Collections.noItems')"
              :enable-jump="false"
            />
          </div>
          <div v-else-if="!selectedCollection && !recommendMode && !loading" class="body-empty">
            <EmptyHelp :text="t('pages.Collections.selectHint')" :enable-jump="false" />
          </div>
        </div>
      </section>

      <ExploreFixedButtons
        v-if="selectedCollection || recommendMode"
        :buttons="fixedBtns"
        :show="showFixedBtns"
        :loading="loading"
        :show-backtop="gridItems.length > 0"
        :backtop-bottom="backtopBtnBottom"
        @action="onFixedBtnAction"
      />
    </div>

    <CuratorStatsIndicator ref="curatorStatsRef" />
    <ListCountIndicator
      v-if="selectedCollection || recommendMode"
      :current="gridItems.length"
      :total="itemsTotal"
    />

    <el-dialog
      v-model="createDialogVisible"
      :title="promptDialogTitle"
      width="520px"
      destroy-on-close
      :close-on-click-modal="!createSubmitting"
      :close-on-press-escape="!createSubmitting"
      :show-close="!createSubmitting"
      :before-close="onCreateDialogBeforeClose"
      @opened="() => scheduleDialogInputFocus(() => createPromptInputRef.value)"
      @closed="prompt = ''"
    >
      <el-input
        ref="createPromptInputRef"
        v-model="prompt"
        type="textarea"
        :rows="4"
        :disabled="createSubmitting"
        :placeholder="t('pages.Collections.promptPlaceholder')"
        @keyup.enter.ctrl="onPromptSubmit"
      />
      <template #footer>
        <el-button :disabled="createSubmitting" @click="createDialogVisible = false">{{
          t('pages.Collections.dialogCancel')
        }}</el-button>
        <el-button type="primary" :loading="createSubmitting" :disabled="createSubmitting" @click="onPromptSubmit">
          {{ promptSubmitLabel }}
        </el-button>
      </template>
    </el-dialog>

    <ViewImage
      ref="viewImageRef"
      :options="viewImageOptions"
      :should-mask-item="shouldMaskItem"
      :on-mask-click="onNsfwMaskClick"
      @prev-more="resourceActions.onViewImagePrevMore"
      @next-more="resourceActions.onViewImageNextMore"
    />
    <ViewVideo
      ref="viewVideoRef"
      :should-mask-item="shouldMaskItem"
      :on-mask-click="onNsfwMaskClick"
    />
    <PrivacyPasswordDialog ref="privacyPasswordDialogRef" />
    <ViewInfo ref="viewInfoRef" />
  </el-main>
</template>

<style scoped lang="scss">
/* 布局与 ExploreCommon 一致：header + .card-block 同高，条数用 ListCountIndicator--fixed-br */
.page-collections {
  --el-main-padding: 0;
  padding: 0;
  position: relative;
  max-width: 100%;
  background-color: rgba(50, 57, 65, 1);
}

.header-block {
  flex-shrink: 0;
  margin: 10px;
  border-bottom: 1px solid #ffffff;
  min-width: 0;
  align-self: stretch;
  width: calc(100% - 20px);
  box-sizing: border-box;

  &--overlay-host {
    position: relative;
  }

  &__controls {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0;
    width: 100%;
    min-width: 0;

    &--under-banner {
      visibility: hidden;
      pointer-events: none;
    }

    .condition-item {
      flex: none;
    }
  }
}

.collection-picker-toolbar__row {
  display: flex;
  align-items: center;
  gap: 0;
  width: 100%;
  min-width: 0;
}

.for-you-degraded-hint {
  margin: 0 16px 6px;
  font-size: 12px;
  line-height: 1.4;
  color: rgba(255, 255, 255, 0.65);
}

.collection-select-trigger {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 6px;
  height: 40px;
  /* 与搜索页 ExploreSearchHeader el-select（large: 8px 16px）左右留白一致 */
  padding: 0 16px;
  border: none;
  border-radius: 0;
  background: transparent;
  color: #fff;
  cursor: pointer;
  box-sizing: border-box;
  text-align: left;

  &:disabled {
    opacity: 0.55;
    cursor: not-allowed;
  }

  &__name {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 15px;
    font-weight: 600;
    line-height: 1.2;
  }

  &__meta {
    flex-shrink: 0;
    font-size: 12px;
    color: rgba(255, 255, 255, 0.65);
    white-space: nowrap;
  }

  &__arrow {
    flex-shrink: 0;
    width: 14px;
    height: 14px;
    font-size: 14px;
    color: rgba(255, 255, 255, 0.85);
    transform: rotate(90deg);
  }
}

.collection-picker-panel {
  display: flex;
  flex-direction: column;
  min-width: 0;

  &__filter {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding-bottom: 10px;
  }

  &__tabs {
    width: 100%;

    :deep(.el-tabs__header) {
      margin: 0 0 8px;
    }

    :deep(.el-tabs__nav-wrap) {
      &::after {
        display: none;
      }
    }

    :deep(.el-tabs__nav-scroll) {
      justify-content: flex-start;
    }

    :deep(.el-tabs__nav) {
      justify-content: flex-start;
    }

    :deep(.el-tabs__item) {
      padding: 0 16px 0 0;
      height: 28px;
      line-height: 28px;
      font-size: 13px;

      &:last-child {
        padding-right: 0;
      }
    }

    :deep(.el-tabs__content) {
      display: none;
    }
  }

  &__list {
    height: 300px;
    flex-shrink: 0;
    padding-top: 4px;
    box-sizing: border-box;
  }

  &__group {
    margin-bottom: 6px;
  }

  &__group-title {
    padding: 10px 8px 4px;
    font-size: 12px;
    font-weight: 600;
    color: var(--el-text-color-secondary);
  }

  &__item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    width: 100%;
    min-width: 0;
    padding: 8px 12px;
    border: none;
    border-radius: 6px;
    background: transparent;
    color: var(--el-text-color-primary);
    cursor: pointer;
    text-align: left;
    box-sizing: border-box;

    &:hover {
      background: var(--el-fill-color-light);
    }

    &--active {
      background: var(--el-color-primary-light-9);
      color: var(--el-color-primary);
    }
  }

  &__item-name {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 14px;
  }

  &__item-tail {
    flex-shrink: 0;
    display: inline-flex;
    align-items: center;
    gap: 8px;
  }

  &__item-count {
    font-size: 12px;
    color: var(--el-text-color-secondary);
  }

  &__item-check {
    font-size: 14px;
    font-weight: 700;
    color: var(--el-color-primary);
  }

  &__empty {
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 276px;
    padding: 24px 12px;
    text-align: center;
    font-size: 13px;
    color: var(--el-text-color-secondary);
    box-sizing: border-box;
  }
}

.header-actions-btn {
  flex: none;
  margin-left: 0;
  font-size: 18px;
  color: #ffffff !important;
  background-color: transparent !important;
  border: none !important;
  box-shadow: none !important;

  &:hover {
    color: #95d475 !important;
  }
}

.body-block {
  position: relative;
  max-width: 100%;
  overflow-x: hidden;
}

.collections-actions-menu {
  min-width: 240px;
  padding: 4px 0 !important;

  :deep(.el-dropdown-menu__item) {
    font-size: 14px;
    line-height: 1.4;
    color: var(--el-text-color-primary);
  }

  :deep(.el-dropdown-menu__item.dropdown-option-item) {
    position: relative;
    padding-left: 28px;
    font-size: 13px;
  }

  :deep(.el-dropdown-menu__item.is-active) {
    color: var(--el-color-primary);
    font-weight: 600;
  }
}

.dropdown-group-caption {
  list-style: none;
  margin: 0;
  padding: 4px 14px 2px 20px;
  font-size: 12px;
  line-height: 1.3;
  color: var(--el-text-color-secondary);
  user-select: none;
  pointer-events: none;
}

.dropdown-check-mark {
  position: absolute;
  left: 12px;
  font-weight: 700;
}

.dropdown-group-header {
  list-style: none;
  margin: 0;
  padding: 10px 14px 6px;
  font-size: 11px;
  font-weight: 600;
  line-height: 1.2;
  letter-spacing: 0.04em;
  color: var(--el-text-color-secondary);
  background: var(--el-fill-color-light);
  border-top: 1px solid var(--el-border-color-lighter);
  user-select: none;
  pointer-events: none;

  &:first-child {
    border-top: none;
    padding-top: 8px;
  }
}

.dropdown-danger {
  color: var(--el-color-danger);
}

.collections-body {
  position: relative;
  box-sizing: border-box;
  padding: 0;
  max-width: 100%;
  min-width: 0;
}

.collection-card-block {
  height: calc(100vh - 130px);
  position: relative;
  overflow: hidden;

  :deep(.virtual-list-scrollbar) {
    height: 100%;
  }
}

.body-block :deep(.explore-fixed-btn) {
  z-index: 30;
}

.card-item {
  contain: content;
  width: 100%;
  height: 100%;
  margin: 0;
  padding: 0;
  position: relative;
  cursor: pointer;
  overflow: hidden;
  will-change: transform;
  transform: translateZ(0);
  backface-visibility: hidden;
}

.card-item__success::after,
.card-item__error::after {
  content: '';
  position: absolute;
  inset: 0;
  z-index: 30;
  pointer-events: none;
  animation: collection-card-fade 0.3s forwards;
}

.card-item__success::after {
  background-color: rgba(149, 212, 117, 0.8);
}

.card-item__error::after {
  background-color: rgba(248, 152, 152, 0.8);
}

@keyframes collection-card-fade {
  to {
    opacity: 0;
  }
}

.body-empty {
  position: relative;
  min-height: 240px;
  height: 100%;
}
</style>

<style lang="scss">
.collection-picker-popper.el-popover.el-popper {
  padding: 10px;
  box-sizing: border-box;

  .el-input__wrapper {
    border-radius: 6px;
  }
}
</style>
