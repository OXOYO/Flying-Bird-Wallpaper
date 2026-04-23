<script setup>
import UseCommonStore from '@h5/stores/commonStore.js'
import UseSettingStore from '@h5/stores/settingStore.js'
import * as api from '@h5/api/index.js'
import { resourceTypeList, filterTypeOptions, orientationOptions, qualityList } from '@common/publicData.js'
import { useTranslation } from 'i18next-vue'

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
  showFilters: false
})

const list = ref([])

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

const resourceTypeLabel = computed(() => {
  const row = resourceTypeOptions.value.find((item) => item.value === form.resourceType)
  return row?.text || ''
})

const sourceLabel = computed(() => {
  const row = sourceOptions.value.find((item) => item.value === form.resourceName)
  return row?.text || ''
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
  onSearch()
}

const onChangeSource = () => {
  syncFilterType()
  onSearch()
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
    <van-nav-bar :title="t('h5.pages.search.title')" fixed safe-area-inset-top />
    <div class="page-search-inner">
      <van-search
        v-model="form.keywords"
        :placeholder="t('exploreCommon.searchForm.filterKeywords.placeholder')"
        @search="onSearch"
      />

      <div class="selectors">
        <van-dropdown-menu class="selectors-main">
          <van-dropdown-item v-model="form.resourceType" :options="resourceTypeOptions" @change="onChangeResourceType" />
          <van-dropdown-item v-model="form.resourceName" :options="sourceOptions" @change="onChangeSource" />
        </van-dropdown-menu>
      </div>
      <div class="selectors selectors-sub">
        <van-dropdown-menu class="selectors-main">
          <van-dropdown-item
            v-model="form.filterType"
            :options="filterTypeDropdownOptions"
            @change="onSearch"
          />
        </van-dropdown-menu>
        <van-button class="filter-btn" size="small" type="primary" @click="state.showFilters = true"
          >高级筛选</van-button
        >
      </div>

      <van-pull-refresh v-model="state.refreshing" :disabled="state.loading" @refresh="onRefresh">
        <van-list
          v-model:loading="state.loading"
          :finished="state.finished"
          :finished-text="t('messages.noMoreData')"
          @load="onLoadMore"
        >
          <div v-if="list.length" class="result-list">
            <div v-for="item in list" :key="item.id || item.uniqueKey" class="result-item">
              <img class="preview" :src="item.imageSrc" alt="preview" />
              <div class="meta">
                <div class="title">{{ item.title || item.fileName || item.resourceName || '-' }}</div>
                <div class="sub">{{ item.resourceName }} · {{ item.quality || '-' }}</div>
                <div class="actions">
                  <van-button size="small" plain type="primary" @click="onToggleFavorite(item)">
                    {{ item.isFavorite ? '取消收藏' : '收藏' }}
                  </van-button>
                  <van-button
                    size="small"
                    plain
                    @click="window.open(item.imageSrc, '_blank')"
                  >
                    预览
                  </van-button>
                </div>
              </div>
            </div>
          </div>
          <van-empty v-else-if="state.finished && !state.loading" image="default" :description="t('messages.noData')" />
        </van-list>
      </van-pull-refresh>
    </div>

    <van-popup v-model:show="state.showFilters" position="bottom" round>
      <div class="filter-panel">
        <div class="filter-title">高级筛选</div>
        <van-cell :title="t('exploreCommon.searchForm.orientation.placeholder')" />
        <van-radio-group v-model="form.orientation" direction="horizontal">
          <van-radio name="">全部</van-radio>
          <van-radio v-for="o in orientationOptions" :key="o.value" :name="String(o.value)">
            {{ t(o.locale) }}
          </van-radio>
        </van-radio-group>
        <van-cell :title="t('exploreCommon.searchForm.quality.placeholder')" />
        <van-radio-group v-model="form.quality" direction="horizontal">
          <van-radio name="">全部</van-radio>
          <van-radio v-for="q in qualityList" :key="q" :name="q">{{ q }}</van-radio>
        </van-radio-group>
        <div class="filter-actions">
          <van-button block type="primary" @click="state.showFilters = false; onSearch()">应用筛选</van-button>
        </div>
      </div>
    </van-popup>
  </div>
</template>

<style scoped lang="scss">
.page-search-inner {
  padding-top: var(--van-nav-bar-height);
  padding-bottom: var(--fbw-tabbar-height);
}
.selectors {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 0 12px 10px;
}
.selectors-sub {
  padding-top: 0;
}
.selectors-main {
  flex: 1;
}
.filter-btn {
  min-width: 84px;
}
.result-list {
  padding: 0 12px 12px;
}
.result-item {
  display: flex;
  gap: 10px;
  padding: 10px;
  margin-bottom: 8px;
  background: rgba(0, 0, 0, 0.05);
  border-radius: 8px;
}
.preview {
  width: 96px;
  height: 64px;
  object-fit: cover;
  border-radius: 6px;
}
.meta {
  flex: 1;
}
.title {
  font-size: 13px;
  font-weight: 600;
  line-height: 1.4;
}
.sub {
  margin-top: 4px;
  font-size: 12px;
  opacity: 0.8;
}
.actions {
  margin-top: 8px;
  display: flex;
  gap: 8px;
}
.filter-panel {
  padding: 16px;
}
.filter-title {
  margin-bottom: 8px;
  font-weight: 600;
}
.filter-actions {
  margin-top: 16px;
}
</style>
