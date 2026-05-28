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

const { t } = useTranslation()
const settingStore = UseSettingStore()
const { settingData } = storeToRefs(settingStore)

const collections = ref([])
const curatorStats = ref(null)
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
const similarMode = ref(false)
const viewImageRef = ref(null)
const viewInfoRef = ref(null)
const viewImageOptions = { button: true, backdrop: true }

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

const { gridSizeList, gridRatioList, onSwitchGridSize, onSwitchGridRatio } = useExploreGridSettings({
  t,
  settingStore,
  settingData,
  cardBlockRef,
  measureAndApply: measureBlock
})

const { fixedBtns, backtopBtnBottom, toggleFixedBtns, showFixedBtns } = useCollectionFloatingButtons({
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

const getItemsPageSize = () => Math.max(1, cardForm.pageSize || 50)

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

const ensureItemsFillViewport = async () => {
  if (similarMode.value || itemsLoading.value || !itemsHasMore.value || !selectedId.value) return
  if (gridItems.value.length && getItemsPageSize() > gridItems.value.length) {
    await fetchCollectionItems(selectedId.value, itemsStartPage.value + 1, true)
    await nextTick()
    scrollRef.value?.updateVisibleItems?.(false)
  }
}

const loadMoreItems = async () => {
  if (similarMode.value || itemsLoading.value || !itemsHasMore.value || !selectedId.value) return
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
  cardContext: () => ({
    inPrivacySpace: false,
    isFavoritesMenu: false,
    isSearchMenu: false,
    isLocalResource: true
  }),
  onItemRemoved: async () => {
    if (selectedId.value) await loadDetail(selectedId.value)
  },
  onFindSimilarResult: (list) => {
    gridItems.value = list
    similarMode.value = true
  }
})

const cardStatusClass = (index) => {
  if (resourceActions.cardItemStatus.index !== index) return ''
  return resourceActions.cardItemStatus.status || ''
}

const exitSimilarMode = () => {
  similarMode.value = false
  syncGridItems(detail.value?.items)
}

const onCardAction = (action, item, index) => {
  resourceActions.onCardAction(action, item, index)
}

const onCardDblClick = (item, index) => {
  resourceActions.onDblClickCard(item, index)
}

const autoCollections = computed(() => collections.value.filter((item) => isAutoCollection(item)))
const userCollections = computed(() => collections.value.filter((item) => !isAutoCollection(item)))

const createDialogVisible = ref(false)

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

const collectionItemCount = (item) =>
  Number(item?.itemCount ?? item?.itemcount ?? 0)

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

const curatorStatsShort = computed(() => {
  if (!curatorStats.value) return ''
  return t('pages.Collections.curatorStatsShort', {
    analyzed: curatorStats.value.analyzed ?? 0,
    embeddings: curatorStats.value.embeddings ?? 0,
    auto: curatorStats.value.autoCollections ?? 0,
    target: curatorStats.value.targetCollections ?? 0
  })
})

/** 与 MainWindow 侧栏宽度一致，避免 fixed 文案贴到侧栏下 */
const SIDE_MENU_WIDTH_PX = 70
const footerStatsFixedStyle = computed(() => {
  const sideW = settingData.value.expandSideMenu ? SIDE_MENU_WIDTH_PX : 0
  const inset = 10
  return {
    left: `${sideW + inset}px`,
    maxWidth: `min(520px, calc(100vw - ${sideW + 220}px))`
  }
})

const resetGridScroll = () => {
  nextTick(() => scrollRef.value?.scrollToTop?.(0))
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

const loadList = async () => {
  loading.value = true
  try {
    const [listRes, statsRes] = await Promise.all([
      window.FBW.collectionsList(),
      window.FBW.collectionsCuratorStats()
    ])
    if (listRes?.success && Array.isArray(listRes.data)) {
      collections.value = listRes.data.map((row) => ({
        ...row,
        itemCount: Number(row.itemCount ?? row.itemcount ?? 0)
      }))
    }
    if (statsRes?.success) {
      curatorStats.value = statsRes.data
    }
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
  similarMode.value = false
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
  if (!prompt.value.trim()) return
  loading.value = true
  try {
    const res = await window.FBW.collectionsCreate({ prompt: prompt.value.trim() })
    ElMessage({
      type: res.success ? 'success' : 'error',
      message: resolveApiUserMessage(res, t)
    })
    if (res.success) {
      prompt.value = ''
      createDialogVisible.value = false
      await loadList()
      if (res.data?.id) await loadDetail(res.data.id)
    }
  } finally {
    loading.value = false
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
    message: res.success
      ? t('pages.Collections.refreshModeUpdated')
      : resolveApiUserMessage(res, t)
  })
  if (res.success) {
    await loadDetail(selectedCollection.value.id)
    await loadList()
  }
}

const autoCollectionsEnabled = computed(
  () => curatorStats.value?.autoCollectionsEnabled !== false
)
const aiEnabled = computed(() => curatorStats.value?.aiEnabled === true)

const onAutoCollectionsChange = async (value) => {
  loading.value = true
  try {
    const res = await window.FBW.updateSettingData({
      ai: { ...(settingData.value?.ai || {}), autoCollectionsEnabled: value }
    })
    ElMessage({
      type: res?.success ? 'success' : 'error',
      message: res?.success
        ? t('pages.Collections.autoCollectionsUpdated')
        : resolveApiUserMessage(res, t)
    })
    if (res?.success) {
      settingStore.updateSettingData(res.data)
      const statsRes = await window.FBW.collectionsCuratorStats()
      if (statsRes?.success) curatorStats.value = statsRes.data
    }
  } finally {
    loading.value = false
  }
}

const onCurateNow = async () => {
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

const isRefreshModeActive = (mode) =>
  (selectedCollection.value?.refreshMode || 'manual') === mode

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
    <div class="header-block">
      <el-select
        v-model="selectedId"
        class="condition-item collection-select"
        filterable
        size="large"
        :disabled="loading || !collections.length"
        :placeholder="t('pages.Collections.selectPlaceholder')"
        @change="onCollectionChange"
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
          <el-dropdown-menu>
            <el-dropdown-item command="create">
              {{ t('pages.Collections.createNew') }}
            </el-dropdown-item>
            <el-dropdown-item command="curate" :disabled="loading">
              {{ t('pages.Collections.curateNow') }}
            </el-dropdown-item>
            <el-dropdown-item divided @click.stop>
              <div class="dropdown-switch-row">
                <span>{{ t('pages.Collections.autoCurateShort') }}</span>
                <el-tooltip
                  v-if="!aiEnabled"
                  :content="t('pages.Collections.autoCollectionsDisabledHint')"
                  placement="left"
                >
                  <el-switch :model-value="autoCollectionsEnabled" disabled size="small" />
                </el-tooltip>
                <el-switch
                  v-else
                  :model-value="autoCollectionsEnabled"
                  :disabled="loading"
                  size="small"
                  @click.stop
                  @change="onAutoCollectionsChange"
                />
              </div>
            </el-dropdown-item>

            <template v-if="selectedCollection">
              <template v-if="!isAutoCollection(selectedCollection)">
                <el-dropdown-item divided disabled class="dropdown-section-title">
                  {{ t('pages.Collections.refreshMode') }}
                </el-dropdown-item>
                <el-dropdown-item
                  v-for="item in refreshModeOptions"
                  :key="item.value"
                  :command="`refreshMode:${item.value}`"
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
                v-else
                divided
                disabled
                class="dropdown-hint-item"
              >
                {{ t('pages.Collections.autoCollectionRefreshHint') }}
              </el-dropdown-item>
              <el-dropdown-item command="favorites" :divided="isAutoCollection(selectedCollection)">
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

    <div class="body-block">
    <section class="collections-body">
      <el-alert
        v-if="similarMode"
        class="similar-mode-alert"
        type="info"
        :closable="false"
        show-icon
      >
        <template #default>
          <span>{{ t('pages.Collections.similarModeBanner') }}</span>
          <el-button type="primary" link size="small" @click="exitSimilarMode">
            {{ t('pages.Collections.similarBack') }}
          </el-button>
        </template>
      </el-alert>

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
                @action="onCardAction"
                @dblclick-card="onCardDblClick"
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
    </section>
    </div>

    <!-- 与搜索页一致：固定于主区域浅灰底栏，无独立 footer 色块 -->
    <span
      v-if="curatorStats"
      class="collections-footer-stats collections-footer-stats--fixed"
      :style="footerStatsFixedStyle"
      role="status"
    >
      {{ curatorStatsShort }}
    </span>
    <ListCountIndicator
      v-if="selectedCollection && !similarMode"
      :current="gridItems.length"
      :total="itemsTotal"
    />

    <el-dialog
      v-model="createDialogVisible"
      :title="t('pages.Collections.createDialogTitle')"
      width="520px"
      destroy-on-close
      @closed="prompt = ''"
    >
      <el-input
        v-model="prompt"
        type="textarea"
        :rows="4"
        :placeholder="t('pages.Collections.promptPlaceholder')"
        @keyup.enter.ctrl="onCreate"
      />
      <template #footer>
        <el-button @click="createDialogVisible = false">{{ t('pages.Collections.dialogCancel') }}</el-button>
        <el-button type="primary" :loading="loading" @click="onCreate">
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
    <ViewInfo ref="viewInfoRef" />
  </el-main>
</template>

<style scoped lang="scss">
.page-collections {
  --el-main-padding: 0;
  padding: 0;
  position: relative;
  box-sizing: border-box;
  background-color: rgba(50, 57, 65, 1);
}

.header-block {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0;
  margin: 10px;
  border-bottom: 1px solid #ffffff;
  min-width: 0;

  .condition-item {
    flex: none;
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

.dropdown-switch-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  min-width: 200px;
}

.dropdown-section-title {
  font-size: 12px;
  font-weight: 600;
}

.dropdown-check-mark {
  margin-right: 6px;
  font-weight: 700;
}

:deep(.el-dropdown-menu__item.is-active) {
  color: var(--el-color-primary);
  font-weight: 600;
}

.dropdown-danger {
  color: var(--el-color-danger);
}

.dropdown-hint-item {
  max-width: 240px;
  line-height: 1.4;
  white-space: normal;
}

.collections-body {
  position: relative;
  box-sizing: border-box;
  padding: 0 10px;
  max-width: 100%;
  min-width: 0;
}

.similar-mode-alert {
  margin: 0 0 8px;
  width: 100%;
  max-width: 100%;
  box-sizing: border-box;
  flex-shrink: 0;

  :deep(.el-alert__content) {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 4px 8px;
    min-width: 0;
    line-height: 1.4;
  }
}

.collection-card-block {
  height: calc(100vh - 130px);
  position: relative;
  overflow: hidden;

  :deep(.virtual-list-scrollbar) {
    height: 100%;
  }
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

.collections-footer-stats {
  font-size: 12px;
  line-height: 1.4;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  pointer-events: none;
  user-select: none;
  color: var(--el-text-color-secondary);

  &--fixed {
    position: fixed;
    bottom: 4px;
    z-index: 20;
  }
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
