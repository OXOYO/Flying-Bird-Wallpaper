<script setup>
import UseCommonStore from '@h5/stores/commonStore.js'
import UseSettingStore from '@h5/stores/settingStore.js'
import * as api from '@h5/api/index.js'
import { resourceTypeList, filterTypeOptions, orientationOptions, qualityList } from '@common/publicData.js'
import { useTranslation } from 'i18next-vue'
import { infoKeys } from '@common/publicData.js'
import { handleInfoVal } from '@common/utils.js'

const { t } = useTranslation()
const commonStore = UseCommonStore()
const settingStore = UseSettingStore()

const form = reactive({
  keywords: '',
  resourceType: 'localResource',
  resourceName: '',
  filterType: 'images',
  orientation: '',
  quality: '',
  sortField: settingStore.settingData.h5SortField || 'created_at',
  sortType: settingStore.settingData.h5SortType || -1,
  isRandom: false
})

const page = reactive({
  startPage: 1,
  pageSize: 20,
  total: 0
})

const state = reactive({
  loading: false,
  refreshing: false,
  finished: false,
  showFilters: false,
  showActionPopup: false,
  showPreview: false
})
const imageInfoPanelAnchors = [0, Math.round(0.55 * window.innerHeight)]
const imageInfoPanelHeight = ref(imageInfoPanelAnchors[0])

const list = ref([])
const longPress = reactive({
  timer: null,
  selectedIndex: -1,
  startX: 0,
  startY: 0
})

const resourceTypeOptions = computed(() => {
  return resourceTypeList.map((item) => ({
    text: t(item.locale),
    value: item.value
  }))
})

const sourceOptions = computed(() => {
  const rows = commonStore.resourceMap.resourceListByResourceType?.[form.resourceType] || []
  return rows.map((item) => ({
    text: t(item.locale) || item.label || item.value,
    value: item.value,
    supportSearchTypes: item.supportSearchTypes || ['images']
  }))
})

const filterTypeAvailable = computed(() => {
  const selected = sourceOptions.value.find((item) => item.value === form.resourceName)
  const types = selected?.supportSearchTypes || ['images']
  return filterTypeOptions.filter((item) => types.includes(item.value))
})

const filterTypeDropdownOptions = computed(() => {
  return filterTypeAvailable.value.map((item) => ({
    text: t(item.locale),
    value: item.value
  }))
})

const normalizeItem = (item) => {
  if (item.srcType === 'file') {
    const rawUrl = `/api/images/get?filePath=${encodeURIComponent(item.filePath)}`
    return {
      ...item,
      imageSrc: rawUrl
    }
  }
  return {
    ...item,
    imageSrc: item.imageUrl || ''
  }
}

const syncFilterType = () => {
  const target = filterTypeAvailable.value.find((item) => item.value === form.filterType)
  if (!target && filterTypeAvailable.value.length) {
    form.filterType = filterTypeAvailable.value[0].value
  }
}

const loadList = async (reset = false) => {
  if (state.loading) return
  if (reset) {
    page.startPage = 1
    page.total = 0
    list.value = []
    state.finished = false
  }
  state.loading = true
  const payload = {
    ...form,
    filterKeywords: form.keywords,
    keywords: form.keywords,
    startPage: page.startPage,
    pageSize: page.pageSize
  }
  const res = await api.searchImages(payload)
  if (res?.success && Array.isArray(res?.data?.list)) {
    const merged = [...list.value, ...res.data.list.map(normalizeItem)]
    const map = new Map()
    merged.forEach((item) => map.set(item.id || item.uniqueKey, item))
    list.value = [...map.values()]
    page.total = res.data.total || list.value.length
    page.startPage += 1
    if (!res.data.list.length || list.value.length >= page.total) {
      state.finished = true
    }
  } else {
    state.finished = true
    showNotify({
      type: 'danger',
      message: res?.message || t('messages.getDataFail')
    })
  }
  state.loading = false
  state.refreshing = false
}

const onSearch = async () => {
  await loadList(true)
}

const onRefresh = async () => {
  state.refreshing = true
  await loadList(true)
}

const onLoadMore = async () => {
  if (state.finished) return
  await loadList(false)
}

const onChangeResourceType = () => {
  const first = sourceOptions.value[0]
  form.resourceName = first ? first.value : ''
  syncFilterType()
}

const onChangeSource = () => {
  syncFilterType()
}

const onToggleFavorite = async (item) => {
  const res = item.isFavorite ? await api.removeFavorites(item.id) : await api.addToFavorites(item.id)
  if (res?.success) {
    item.isFavorite = !item.isFavorite
    showNotify({ type: 'success', message: t('messages.operationSuccess') })
  } else {
    showNotify({ type: 'danger', message: res?.message || t('messages.operationFail') })
  }
}

const onResetFilters = () => {
  form.resourceType = 'localResource'
  const first = sourceOptions.value[0]
  form.resourceName = first ? first.value : ''
  form.filterType = 'images'
  form.orientation = ''
  form.quality = ''
  onSearch()
}

const previewImages = computed(() => list.value.map((item) => item.imageSrc).filter(Boolean))
const previewStartPosition = computed(() => Math.max(0, longPress.selectedIndex))

const openPreview = (index) => {
  if (!list.value[index]?.imageSrc) return
  longPress.selectedIndex = index
  state.showPreview = true
}

const onImageTouchStart = (index, event) => {
  if (!event.touches?.length) return
  longPress.startX = event.touches[0].clientX
  longPress.startY = event.touches[0].clientY
  longPress.timer = setTimeout(() => {
    longPress.selectedIndex = index
    state.showActionPopup = true
  }, 500)
}

const onImageTouchMove = (event) => {
  if (!longPress.timer || !event.touches?.length) return
  const moveX = event.touches[0].clientX - longPress.startX
  const moveY = event.touches[0].clientY - longPress.startY
  if (Math.sqrt(moveX * moveX + moveY * moveY) > 10) {
    clearTimeout(longPress.timer)
    longPress.timer = null
  }
}

const onImageTouchEnd = () => {
  if (longPress.timer) {
    clearTimeout(longPress.timer)
    longPress.timer = null
  }
}

const selectedItem = computed(() =>
  longPress.selectedIndex >= 0 ? list.value[longPress.selectedIndex] || null : null
)

const showImageInfo = () => {
  if (!selectedItem.value) return
  state.showActionPopup = false
  imageInfoPanelHeight.value = imageInfoPanelAnchors[1]
}

const saveImage = async () => {
  const item = selectedItem.value
  if (!item) return
  try {
    const link = document.createElement('a')
    link.href = item.imageSrc
    link.download = `${item.fileName || item.id || Date.now()}.${item.fileExt || 'jpg'}`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    if (item.id) {
      await api.updateDownloadCount(item.id, 1)
    }
    showNotify({ type: 'success', message: t('messages.saveSuccess') })
  } catch (error) {
    showNotify({ type: 'danger', message: t('messages.saveFail') })
  } finally {
    state.showActionPopup = false
  }
}

const deleteImage = async () => {
  const item = selectedItem.value
  if (!item) return
  try {
    await showConfirmDialog({
      title: t('h5.pages.home.actions.confirmDelete'),
      message: t('h5.pages.home.actions.confirmDeleteMessage'),
      confirmButtonText: t('h5.pages.home.actions.confirmDeleteBtn'),
      cancelButtonText: t('h5.pages.home.actions.cancelDeleteBtn'),
      confirmButtonColor: '#ee0a24',
      closeOnClickOverlay: true
    })
    const res = await api.deleteImage(toRaw(item))
    if (res?.success) {
      list.value = list.value.filter((row) => (row.id || row.uniqueKey) !== (item.id || item.uniqueKey))
      showNotify({ type: 'success', message: t('messages.deleteSuccess') })
    } else {
      showNotify({ type: 'danger', message: res?.message || t('messages.deleteFail') })
    }
  } catch (error) {
    if (error !== 'cancel') {
      showNotify({ type: 'danger', message: t('messages.deleteFail') })
    }
  } finally {
    state.showActionPopup = false
  }
}

const toggleSelectedFavorite = async () => {
  const item = selectedItem.value
  if (!item) return
  await onToggleFavorite(item)
  state.showActionPopup = false
}

const openActionByIndex = (index) => {
  longPress.selectedIndex = index
  state.showActionPopup = true
}

const onFilterResourceTypeChange = () => {
  const first = sourceOptions.value[0]
  form.resourceName = first ? first.value : ''
  syncFilterType()
}

const onApplyFilters = async () => {
  state.showFilters = false
  await onSearch()
}

const onImageInfoHeightChange = (height) => {
  if (height === 0 && !state.showActionPopup) {
    longPress.selectedIndex = -1
  }
}

onUnmounted(() => {
  if (longPress.timer) {
    clearTimeout(longPress.timer)
    longPress.timer = null
  }
})

const init = async () => {
  const first = sourceOptions.value[0]
  form.resourceName = first ? first.value : ''
  syncFilterType()
  await onSearch()
}

defineExpose({
  refresh: onRefresh
})

onMounted(init)
</script>

<template>
  <div class="page-wrapper page-search">
    <div class="page-search-inner">
      <div class="search-toolbar">
        <div class="search-row">
          <van-search
            v-model="form.keywords"
            class="search-input"
            :placeholder="t('h5.pages.search.keywordPlaceholder')"
            @search="onSearch"
          />
          <van-button class="filter-btn" plain @click="state.showFilters = true">
            <van-icon name="arrow-down" />
          </van-button>
        </div>
      </div>

      <van-pull-refresh v-model="state.refreshing" :disabled="state.loading" @refresh="onRefresh">
        <van-list
          v-model:loading="state.loading"
          :finished="state.finished"
          :finished-text="t('messages.noMoreData')"
          @load="onLoadMore"
        >
          <div v-if="state.loading && !list.length" class="result-list result-list-skeleton">
            <van-skeleton v-for="i in 4" :key="i" avatar :row="2" />
          </div>
          <div v-if="list.length" class="result-list">
            <div
              v-for="(item, index) in list"
              :key="item.id || item.uniqueKey"
              class="result-item"
              @touchstart="(e) => onImageTouchStart(index, e)"
              @touchmove="onImageTouchMove"
              @touchend="onImageTouchEnd"
              @touchcancel="onImageTouchEnd"
              @contextmenu.prevent="openActionByIndex(index)"
            >
              <div class="preview-wrap" @click="openPreview(index)">
                <img class="preview" :src="item.imageSrc" alt="preview" loading="lazy" />
              </div>
            </div>
          </div>
          <van-empty v-else-if="state.finished && !state.loading" image="default" :description="t('messages.noData')" />
        </van-list>
      </van-pull-refresh>
    </div>

    <van-popup v-model:show="state.showFilters" position="bottom" round>
      <div class="filter-panel">
        <div class="filter-title">{{ t('h5.pages.search.filters.title') }}</div>
        <van-search
          v-model="form.keywords"
          class="filter-keyword-input"
          :placeholder="t('h5.pages.search.keywordPlaceholder')"
          @search="onApplyFilters"
        />
        <div class="filter-group">
          <div class="group-title">{{ t('exploreCommon.searchForm.resourceType.placeholder') }}</div>
          <van-radio-group
            v-model="form.resourceType"
            class="filter-options"
            direction="horizontal"
            @change="onFilterResourceTypeChange"
          >
            <van-radio v-for="o in resourceTypeOptions" :key="o.value" :name="o.value">{{ o.text }}</van-radio>
          </van-radio-group>
        </div>
        <div class="filter-group">
          <div class="group-title">{{ t('exploreCommon.searchForm.resourceName.placeholder') }}</div>
          <van-radio-group v-model="form.resourceName" class="filter-options" direction="horizontal" @change="onChangeSource">
            <van-radio v-for="o in sourceOptions" :key="o.value" :name="o.value">{{ o.text }}</van-radio>
          </van-radio-group>
        </div>
        <div class="filter-group">
          <div class="group-title">{{ t('exploreCommon.searchForm.filterType.placeholder') }}</div>
          <van-radio-group v-model="form.filterType" class="filter-options" direction="horizontal">
            <van-radio v-for="o in filterTypeDropdownOptions" :key="o.value" :name="o.value">
              {{ o.text }}
            </van-radio>
          </van-radio-group>
        </div>
        <div class="filter-group">
          <div class="group-title">{{ t('exploreCommon.searchForm.orientation.placeholder') }}</div>
          <van-radio-group v-model="form.orientation" class="filter-options" direction="horizontal">
            <van-radio name="">{{ t('h5.pages.search.filters.all') }}</van-radio>
            <van-radio v-for="o in orientationOptions" :key="o.value" :name="String(o.value)">
              {{ t(o.locale) }}
            </van-radio>
          </van-radio-group>
        </div>
        <div class="filter-group">
          <div class="group-title">{{ t('exploreCommon.searchForm.quality.placeholder') }}</div>
          <van-radio-group v-model="form.quality" class="filter-options" direction="horizontal">
            <van-radio name="">{{ t('h5.pages.search.filters.all') }}</van-radio>
            <van-radio v-for="q in qualityList" :key="q" :name="q">{{ q }}</van-radio>
          </van-radio-group>
        </div>
        <div class="filter-actions">
          <van-button class="filter-reset-btn" plain @click="onResetFilters">
            <van-icon name="replay" />
          </van-button>
          <van-button class="filter-search-btn" type="primary" @click="onApplyFilters">
            <van-icon name="search" />
          </van-button>
        </div>
      </div>
    </van-popup>

    <van-image-preview
      v-model:show="state.showPreview"
      :images="previewImages"
      :start-position="previewStartPosition"
      closeable
    />

    <van-popup
      v-model:show="state.showActionPopup"
      destroy-on-close
      position="bottom"
      :style="{ padding: '16px' }"
    >
      <div class="action-popup-content">
        <div class="action-item" @click="showImageInfo">
          <div class="action-icon-wrapper">
            <IconifyIcon class="action-icon-inner" icon="custom:info-line" />
          </div>
          <span class="action-label">{{ t('h5.pages.home.actions.imageInfo') }}</span>
        </div>
        <div class="action-item" @click="toggleSelectedFavorite">
          <div class="action-icon-wrapper">
            <IconifyIcon
              class="action-icon-inner"
              :icon="selectedItem?.isFavorite ? 'custom:star-fill' : 'custom:star'"
              :style="{ color: selectedItem?.isFavorite ? 'gold' : '' }"
            />
          </div>
          <span class="action-label">{{
            selectedItem?.isFavorite ? t('exploreCommon.removeFavorites') : t('exploreCommon.addToFavorites')
          }}</span>
        </div>
        <div class="action-item" @click="saveImage">
          <div class="action-icon-wrapper">
            <IconifyIcon class="action-icon-inner" icon="custom:download-line" />
          </div>
          <span class="action-label">{{ t('h5.pages.home.actions.saveImage') }}</span>
        </div>
        <div class="action-item delete-action" @click="deleteImage">
          <div class="action-icon-wrapper">
            <IconifyIcon class="action-icon-inner" icon="custom:delete-line" />
          </div>
          <span class="action-label">{{ t('h5.pages.home.actions.deleteImage') }}</span>
        </div>
      </div>
    </van-popup>

    <van-floating-panel
      v-model:height="imageInfoPanelHeight"
      :anchors="imageInfoPanelAnchors"
      @height-change="onImageInfoHeightChange"
    >
      <div class="image-info-content">
        <van-cell-group v-if="selectedItem">
          <van-cell
            v-for="key in infoKeys"
            :key="key"
            value-class="image-info-value"
            :title="t(`h5.pages.home.imageInfo.${key}`)"
            :value="handleInfoVal(selectedItem, key)"
          />
        </van-cell-group>
      </div>
    </van-floating-panel>
  </div>
</template>

<style scoped lang="scss">
.page-search-inner {
  padding-bottom: var(--fbw-tabbar-height);
}
.search-toolbar {
  position: sticky;
  top: 0;
  z-index: 10;
  background: #fff;
  box-shadow: 0 1px 0 rgba(0, 0, 0, 0.06);
}
.search-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px 10px;
}
.search-input {
  flex: 1;
}
.filter-btn {
  width: 34px;
  height: 34px;
  min-width: 34px;
  border-radius: 8px;
  padding: 0;
}
.result-list {
  padding: 0 12px 12px;
  column-count: 2;
  column-gap: 10px;
}
.result-list-skeleton {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}
.result-item {
  display: inline-block;
  width: 100%;
  margin-bottom: 10px;
  padding: 0;
  background: #fff;
  border-radius: 10px;
  border: 1px solid rgba(0, 0, 0, 0.06);
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.04);
  overflow: hidden;
  break-inside: avoid;
}
.preview-wrap {
  border-radius: 0;
  overflow: hidden;
  background: rgba(0, 0, 0, 0.05);
}
.preview {
  width: 100%;
  height: auto;
  display: block;
  object-fit: contain;
}
.filter-panel {
  padding: 16px;
  max-width: 820px;
  margin: 0 auto;
}
.filter-title {
  margin-bottom: 12px;
  font-weight: 600;
  font-size: 15px;
}
.filter-group {
  padding: 10px 0;
  border-bottom: 1px solid var(--van-border-color);
}
.group-title {
  margin-bottom: 8px;
  font-size: 13px;
  color: var(--van-text-color-2);
}
.filter-keyword-input {
  margin-bottom: 10px;
}
.filter-options {
  display: flex;
  flex-wrap: wrap;
  gap: 10px 14px;
}
.filter-options :deep(.van-radio) {
  min-width: 96px;
}
.filter-actions {
  margin-top: 16px;
  display: flex;
  gap: 10px;
}
.filter-reset-btn {
  width: 44px;
  min-width: 44px;
  padding: 0;
}
.filter-search-btn {
  flex: 1;
}

.action-popup-content {
  display: flex;
  justify-content: space-evenly;
  align-items: center;
  flex-direction: row;
  gap: 16px;
}

.action-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  font-size: 16px;
}

.action-icon-wrapper {
  display: flex;
  justify-content: center;
  align-items: center;
  background-color: #eee;
  border-radius: 10px;
  padding: 14px;
  font-size: 24px;
}

.action-icon-inner {
  transition: transform 0.3s ease-out;
}

.action-label {
  font-size: 12px;
}

.delete-action {
  color: #ff4d4f;
}

.image-info-content {
  max-height: 60vh;
  overflow: auto;
}

@media (min-width: 768px) {
  .page-search-inner {
    max-width: 1080px;
    margin: 0 auto;
  }

  .result-list {
    column-count: 3;
  }
}

@media (min-width: 1200px) {
  .result-list {
    column-count: 4;
  }
}
</style>
