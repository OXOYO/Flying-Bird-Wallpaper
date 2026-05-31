<script setup>
import { useTranslation } from 'i18next-vue'
import { storeToRefs } from 'pinia'
import { resolveApiUserMessage } from '@common/utils.js'
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

const { t } = useTranslation()
const settingStore = UseSettingStore()
const { settingData } = storeToRefs(settingStore)

const collections = ref([])
const curatorStatsRef = ref(null)
const loading = ref(false)
const prompt = ref('')
const selectedId = ref(null)
const detail = ref(null)

const selectedCollection = computed(() => detail.value?.collection || null)
const gridItems = ref([])
const itemsTotal = ref(0)
const itemsStartPage = ref(1)
const itemsHasMore = ref(false)
const itemsLoading = ref(false)
const viewImageRef = ref(null)
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

const isAutoCollection = (item) => item?.source === 'auto'

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
    similarMode,
    isAutoCollection
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

const fetchCollectionItems = async (id, startPage, append = false) => {
  if (!id) return
  itemsLoading.value = true
  try {
    const pageSize = getItemsPageSize()
    const res = await window.FBW.collectionsGet({ id, startPage, pageSize })
    if (!res?.success) return
    detail.value = { collection: res.data.collection }
    syncGridItems(res.data.items, append)
    const total = Number(res.data.total) || 0
    itemsTotal.value = total
    itemsStartPage.value = res.data.startPage ?? startPage
    itemsHasMore.value = gridItems.value.length < total
    collections.value = collections.value.map((row) =>
      row.id === id ? { ...row, ...(res.data.collection || {}), itemCount: total } : row
    )
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
    await appendSimilarPage(
      () => gridItems.value,
      (list) => {
        gridItems.value = list
      }
    )
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
    if (itemsLoading.value || !itemsHasMore.value || !selectedId.value) return
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
  viewInfoRef,
  getSimilarScope: () =>
    selectedId.value
      ? { type: 'collection', collectionId: selectedId.value }
      : { type: 'collection', collectionId: null },
  getSimilarPageSize: getItemsPageSize,
  cardContext: () => ({
    inPrivacySpace: false,
    isFavoritesMenu: false,
    isSearchMenu: false,
    isLocalResource: true
  }),
  onItemRemoved: async () => {
    if (selectedId.value) await loadDetail(selectedId.value)
  },
  onFindSimilarResult: (list, item, meta) => {
    if (!item?.id || !selectedId.value) return
    const gridHWRatio = settingData.value?.gridHWRatio ?? 0.618
    const scope = { type: 'collection', collectionId: selectedId.value }
    const sourceItem = normalizeResourceItem(item, {
      resourceType: 'localResource',
      gridHWRatio
    })
    if (!similarMode.value) {
      similarListSnapshot.value = {
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
  if (snap?.collectionId && snap.collectionId === selectedId.value) {
    gridItems.value = snap.items || []
    itemsHasMore.value = !!snap.itemsHasMore
    itemsTotal.value = snap.itemsTotal ?? gridItems.value.length
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

const autoCollections = computed(() => collections.value.filter((item) => isAutoCollection(item)))
const userCollections = computed(() => collections.value.filter((item) => !isAutoCollection(item)))

const createDialogVisible = ref(false)
const createSubmitting = ref(false)

const onCreateDialogBeforeClose = (done) => {
  if (createSubmitting.value) return
  done()
}

const collectionOptionGroups = computed(() => {
  const groups = []
  if (autoCollections.value.length) {
    groups.push({
      key: 'auto',
      label: t('pages.Collections.sectionAuto'),
      children: autoCollections.value
    })
  }
  if (userCollections.value.length) {
    groups.push({
      key: 'user',
      label: t('pages.Collections.sectionUser'),
      children: userCollections.value
    })
  }
  return groups
})

const collectionItemCount = (item) => Number(item?.itemCount ?? item?.itemcount ?? 0)

const collectionItemCountText = (item) =>
  t('pages.Collections.itemCount', { count: collectionItemCount(item) })

const collectionOptionLabel = (item) => {
  if (!item) return ''
  return `${item.name || ''} (${collectionItemCount(item)})`
}

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
  const list = collections.value
  if (!list.length) {
    selectedId.value = null
    detail.value = null
    gridItems.value = []
    return
  }
  if (!list.some((item) => item.id === selectedId.value)) {
    await loadDetail(list[0].id)
  }
}

const onCollectionChange = async (id) => {
  if (!id) {
    selectedId.value = null
    detail.value = null
    gridItems.value = []
    return
  }
  await loadDetail(id)
}

const applyCollectionListResponse = (listRes) => {
  if (listRes?.success && Array.isArray(listRes.data)) {
    collections.value = listRes.data.map((row) => ({
      ...row,
      itemCount: Number(row.itemCount ?? row.itemcount ?? 0)
    }))
  }
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

const onCollectionSelectVisibleChange = (visible) => {
  if (visible) void refreshCollectionList()
}

const loadList = async () => {
  loading.value = true
  try {
    const listRes = await fetchCollectionList()
    applyCollectionListResponse(listRes)
    await curatorStatsRef.value?.refresh()
    await nextTick()
    if (!selectedId.value && collections.value.length) {
      await loadDetail(collections.value[0].id)
    } else {
      await selectFirstDisplayed()
    }
  } finally {
    loading.value = false
  }
}

const loadDetail = async (id) => {
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
  const res = await window.FBW.collectionsAddAllToFavorites({ id })
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
      if (selectedCollection.value?.id) await onRefresh(selectedCollection.value.id)
      break
    case 'addAllFavorites':
      if (selectedCollection.value?.id) await onAddFavorites(selectedCollection.value.id)
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

const onHeaderMenuCommand = async (command) => {
  if (command === 'create') {
    createDialogVisible.value = true
    return
  }
  if (command === 'curate') {
    await onCurateNow()
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

watch(selectedId, async (id) => {
  unbindResizeObserver()
  if (!id) return
  await nextTick()
  bindResizeObserver()
  await measureBlock()
})

watch(
  () => gridItems.value.length,
  () => nextTick(() => measureBlock())
)

onMounted(() => {
  loadList()
})

onBeforeUnmount(() => {
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
        <el-select
          v-model="selectedId"
          class="condition-item collection-select"
          filterable
          size="large"
          :disabled="loading || !collections.length"
          :placeholder="t('pages.Collections.selectPlaceholder')"
          @change="onCollectionChange"
          @visible-change="onCollectionSelectVisibleChange"
        >
          <template #label="{ label }">
            <span class="collection-select__label">{{ label }}</span>
          </template>
          <el-option-group
            v-for="group in collectionOptionGroups"
            :key="group.key"
            :label="group.label"
          >
            <el-option
              v-for="item in group.children"
              :key="item.id"
              :label="collectionOptionLabel(item)"
              :value="item.id"
            >
              <div class="collection-option">
                <span class="collection-option__name">{{ item.name }}</span>
                <span class="collection-option__count">{{ collectionItemCountText(item) }}</span>
              </div>
            </el-option>
          </el-option-group>
        </el-select>

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

              <template v-if="selectedCollection">
                <li class="dropdown-group-header" role="presentation">
                  {{ t('pages.Collections.actionsSectionCurrent') }}
                </li>
                <template v-if="!isAutoCollection(selectedCollection)">
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
                <el-dropdown-item command="delete" divided>
                  <span class="dropdown-danger">{{ t('pages.Collections.delete') }}</span>
                </el-dropdown-item>
              </template>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
      </div>
      <ExploreSimilarModeBanner
        v-if="similarMode"
        :message="t('pages.Collections.similarModeBanner')"
        :source-image-src="similarSourceImageSrc"
        :back-aria-label="t('pages.Collections.similarBack')"
        bar-background="rgba(50, 57, 65, 1)"
        @back="exitSimilarMode"
      />
    </div>

    <div class="body-block">
      <section class="collections-body">
        <div ref="cardBlockRef" class="collection-card-block">
          <VirtualList
            v-if="selectedCollection && (gridItems.length || itemsLoading)"
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
          <div v-else-if="!collections.length && !loading" class="body-empty">
            <EmptyHelp :text="t('pages.Collections.empty')" :enable-jump="false" />
          </div>
          <div
            v-else-if="selectedCollection && !gridItems.length && !loading && !itemsLoading"
            class="body-empty"
          >
            <EmptyHelp :text="t('pages.Collections.noItems')" :enable-jump="false" />
          </div>
          <div v-else-if="!selectedCollection && !loading" class="body-empty">
            <EmptyHelp :text="t('pages.Collections.selectHint')" :enable-jump="false" />
          </div>
        </div>
      </section>

      <ExploreFixedButtons
        v-if="selectedCollection"
        :buttons="fixedBtns"
        :show="showFixedBtns"
        :loading="loading"
        :show-backtop="gridItems.length > 0"
        :backtop-bottom="backtopBtnBottom"
        @action="onFixedBtnAction"
      />
    </div>

    <CuratorStatsIndicator ref="curatorStatsRef" />
    <ListCountIndicator v-if="selectedCollection" :current="gridItems.length" :total="itemsTotal" />

    <el-dialog
      v-model="createDialogVisible"
      :title="t('pages.Collections.createDialogTitle')"
      width="520px"
      destroy-on-close
      :close-on-click-modal="!createSubmitting"
      :close-on-press-escape="!createSubmitting"
      :show-close="!createSubmitting"
      :before-close="onCreateDialogBeforeClose"
      @closed="prompt = ''"
    >
      <el-input
        v-model="prompt"
        type="textarea"
        :rows="4"
        :disabled="createSubmitting"
        :placeholder="t('pages.Collections.promptPlaceholder')"
        @keyup.enter.ctrl="onCreate"
      />
      <template #footer>
        <el-button :disabled="createSubmitting" @click="createDialogVisible = false">{{
          t('pages.Collections.dialogCancel')
        }}</el-button>
        <el-button type="primary" :loading="createSubmitting" :disabled="createSubmitting" @click="onCreate">
          {{ t('pages.Collections.create') }}
        </el-button>
      </template>
    </el-dialog>

    <ViewImage
      ref="viewImageRef"
      :options="viewImageOptions"
      @prev-more="resourceActions.onViewImagePrevMore"
      @next-more="resourceActions.onViewImageNextMore"
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

.collection-select {
  flex: 1 !important;
  min-width: 0;

  &__label {
    color: #ffffff;
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

.collection-option {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  min-width: 0;
  width: 100%;

  &__name {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &__count {
    flex-shrink: 0;
    font-size: 12px;
    color: var(--el-text-color-secondary);
    white-space: nowrap;
  }
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

  &:active {
    opacity: 0.8;
  }
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
.page-collections .header-block {
  .collection-select .el-select__wrapper {
    width: 100% !important;
    border: none !important;
    border-radius: 0 !important;
    background-color: transparent !important;
    box-shadow: none !important;

    .el-select__placeholder,
    .el-select__selected-item {
      color: #ffffff;
    }

    .el-select__caret {
      color: #ffffff;
    }
  }
}
</style>
