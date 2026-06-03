<script setup>
import { useTranslation } from 'i18next-vue'
import ExploreResourcePicker from './ExploreResourcePicker.vue'
import {
  filterTypeOptions,
  orientationOptions,
  qualityList,
  autoRefreshListOptions,
  isQualityFilterApplicable,
  sortFieldOptions,
  sortTypeOptions,
  DEFAULT_BROWSE_SORT_FIELD,
  DEFAULT_BROWSE_SORT_TYPE
} from '@common/publicData.js'

const props = defineProps({
  menu: { type: String, required: true },
  loading: { type: Boolean, default: false },
  searchForm: { type: Object, required: true },
  selectedResource: { type: Object, default: null },
  resourceGroupList: { type: Array, default: () => [] },
  supportSearchTypes: { type: Array, default: () => ['images'] },
  isLocalResource: { type: Boolean, default: true },
  inPrivacySpace: { type: Boolean, default: false },
  autoRefreshEnabled: { type: Boolean, default: false },
  hotTags: { type: Array, default: () => [] },
  useSemanticSearch: { type: Boolean, default: false },
  semanticSearchAvailable: { type: Boolean, default: false }
})

const emit = defineEmits([
  'resource-change',
  'search',
  'apply-filters',
  'menu-command',
  'update-use-semantic-search'
])

const { t } = useTranslation()

const filterPopoverVisible = ref(false)

/** 筛选面板可滚动区域高度（Popover 挂到 body，需配合全局样式） */
const filterBodyMaxHeight = ref(420)

const updateFilterBodyMaxHeight = () => {
  if (typeof window === 'undefined') {
    return
  }
  filterBodyMaxHeight.value = Math.max(
    220,
    Math.min(Math.floor(window.innerHeight * 0.52), window.innerHeight - 180)
  )
}

onMounted(() => {
  updateFilterBodyMaxHeight()
  window.addEventListener('resize', updateFilterBodyMaxHeight)
})

onUnmounted(() => {
  window.removeEventListener('resize', updateFilterBodyMaxHeight)
})

const isSearchMenu = computed(() => props.menu === 'Search')
const isFavoritesMenu = computed(() => props.menu === 'Favorites')
const isHistoryMenu = computed(() => props.menu === 'History')

const visibleFilterTypes = computed(() =>
  filterTypeOptions.filter((item) => props.supportSearchTypes.includes(item.value))
)

const showFilterTypeField = computed(() => visibleFilterTypes.value.length > 1)

const isLocalBrowseMenu = computed(
  () =>
    (isSearchMenu.value || isFavoritesMenu.value || isHistoryMenu.value) && props.isLocalResource
)

/** 收藏/回忆/本地搜索：列表模式与排序（远程搜索与悬浮钮一致，不展示） */
const showListBrowseOptions = computed(
  () => isFavoritesMenu.value || isHistoryMenu.value || (isSearchMenu.value && props.isLocalResource)
)

/** 搜索/收藏/回忆：语义搜索开关 */
const showSemanticSearchField = computed(
  () => isSearchMenu.value || isFavoritesMenu.value || isHistoryMenu.value
)

const isQualityFilterVisible = (filterType) =>
  isLocalBrowseMenu.value && isQualityFilterApplicable(filterType)

const showQualityField = computed(() => isQualityFilterVisible(draft.filterType))

const keywordsPlaceholder = computed(() =>
  t('exploreCommon.searchForm.filterKeywords.placeholder')
)

const draft = reactive({
  resource: null,
  filterKeywords: '',
  filterType: 'images',
  orientation: [],
  quality: [],
  isRandom: false,
  sortField: DEFAULT_BROWSE_SORT_FIELD,
  sortType: DEFAULT_BROWSE_SORT_TYPE
})

const listModeRadioOptions = computed(() => [
  { value: false, label: t('h5.pages.search.filters.listModeOrder') },
  { value: true, label: t('h5.pages.search.filters.listModeRandom') }
])

const syncDraftFromForm = () => {
  draft.resource = props.selectedResource ? { ...props.selectedResource } : null
  draft.filterKeywords = props.searchForm.filterKeywords ?? ''
  draft.filterType = props.searchForm.filterType
  draft.orientation = Array.isArray(props.searchForm.orientation)
    ? [...props.searchForm.orientation]
    : []
  draft.quality = Array.isArray(props.searchForm.quality) ? [...props.searchForm.quality] : []
  draft.isRandom = !!props.searchForm.isRandom
  draft.sortField = props.searchForm.sortField ?? DEFAULT_BROWSE_SORT_FIELD
  draft.sortType = props.searchForm.sortType ?? DEFAULT_BROWSE_SORT_TYPE
}

const getDefaultDraftResource = () => {
  for (const group of props.resourceGroupList) {
    const child = group.children?.[0]
    if (child?.optionValue) {
      return { ...child.optionValue }
    }
  }
  return props.selectedResource ? { ...props.selectedResource } : null
}

watch(filterPopoverVisible, (visible) => {
  if (visible) {
    updateFilterBodyMaxHeight()
    syncDraftFromForm()
  }
})

watch(
  () => [
    props.searchForm.isRandom,
    props.searchForm.sortField,
    props.searchForm.sortType
  ],
  () => {
    if (filterPopoverVisible.value) {
      draft.isRandom = !!props.searchForm.isRandom
      draft.sortField = props.searchForm.sortField ?? DEFAULT_BROWSE_SORT_FIELD
      draft.sortType = props.searchForm.sortType ?? DEFAULT_BROWSE_SORT_TYPE
    }
  }
)

watch(
  () => draft.filterType,
  (type) => {
    if (!isQualityFilterApplicable(type)) {
      draft.quality = []
    }
  }
)

const activeFilterCount = computed(() => {
  let n = 0
  if (String(props.searchForm.filterKeywords ?? '').trim()) {
    n += 1
  }
  if (showFilterTypeField.value && props.searchForm.filterType) {
    n += 1
  }
  if (props.searchForm.orientation?.length) {
    n += 1
  }
  if (isQualityFilterVisible(props.searchForm.filterType) && props.searchForm.quality?.length) {
    n += 1
  }
  return n
})

const filterBtnTitle = computed(() => {
  const label = t('exploreCommon.header.filterBtn')
  if (!activeFilterCount.value) {
    return label
  }
  return `${label} (${activeFilterCount.value})`
})

const onOpenFilter = () => {
  syncDraftFromForm()
}

const onApplyFilters = () => {
  const payload = {
    filterKeywords: draft.filterKeywords ?? '',
    filterType: draft.filterType,
    orientation: [...draft.orientation],
    quality: isQualityFilterApplicable(draft.filterType) ? [...draft.quality] : []
  }
  if (isSearchMenu.value && draft.resource) {
    payload.resource = { ...draft.resource }
  }
  if (showListBrowseOptions.value) {
    payload.isRandom = draft.isRandom
    payload.sortField = draft.sortField
    payload.sortType = draft.sortType
  }
  emit('apply-filters', payload)
  filterPopoverVisible.value = false
}

const onResetDraft = () => {
  const defaultType = visibleFilterTypes.value[0]?.value || 'images'
  draft.filterKeywords = ''
  draft.filterType = defaultType
  draft.orientation = []
  draft.quality = []
  draft.isRandom = false
  draft.sortField = DEFAULT_BROWSE_SORT_FIELD
  draft.sortType = DEFAULT_BROWSE_SORT_TYPE
  if (isSearchMenu.value) {
    draft.resource = getDefaultDraftResource()
  }
}

const useMentionInput = computed(() => isSearchMenu.value && props.hotTags.length > 0)

/** 回车前同步输入框值（mention 的 v-model 可能晚于 keydown） */
const syncKeywordsFromEvent = (event) => {
  const target = event?.target
  if (target && typeof target.value === 'string') {
    props.searchForm.filterKeywords = target.value
  }
}

const onKeywordsEnter = async (event) => {
  syncKeywordsFromEvent(event)
  await nextTick()
  emit('search')
}

const onKeywordsClear = () => {
  props.searchForm.filterKeywords = ''
  emit('search')
}

const autoRefreshItem = computed(() =>
  autoRefreshListOptions.find((item) => item.value === props.autoRefreshEnabled)
)

/** 顶栏右侧扩展操作（原「更多」菜单项，仅 1 项时直接外置为图标按钮） */
const headerExtraActions = computed(() => {
  const actions = []
  if (isFavoritesMenu.value) {
    actions.push({
      command: 'privacy',
      icon: props.inPrivacySpace ? 'custom:door-open-outline' : 'custom:door-front-outline',
      title: props.inPrivacySpace
        ? t('exploreCommon.onTogglePrivacySpace.quit')
        : t('exploreCommon.onTogglePrivacySpace.enter'),
      active: props.inPrivacySpace
    })
  }
  if (isHistoryMenu.value) {
    actions.push({
      command: 'autoRefresh',
      icon: autoRefreshItem.value?.icon || 'custom:refresh-right',
      title: autoRefreshItem.value ? t(autoRefreshItem.value.locale) : t('autoRefreshList.off'),
      active: props.autoRefreshEnabled
    })
  }
  if (isSearchMenu.value && props.isLocalResource) {
    actions.push({
      command: 'refreshDirectory',
      icon: 'custom:folder-refresh',
      title: t('exploreCommon.onRefreshDirectory'),
      active: false
    })
  }
  return actions
})

const singleExtraAction = computed(() =>
  headerExtraActions.value.length === 1 ? headerExtraActions.value[0] : null
)

const onExtraCommand = (command) => {
  emit('menu-command', command)
}
</script>

<template>
  <div class="explore-search-header header-block">
    <ExploreResourcePicker
      v-if="isSearchMenu"
      class="condition-item explore-search-header__primary"
      :model-value="selectedResource"
      :resource-group-list="resourceGroupList"
      :loading="loading"
      :disabled="loading"
      @change="(val) => emit('resource-change', val)"
    />

    <el-mention
      v-if="useMentionInput"
      v-model="searchForm.filterKeywords"
      class="condition-item condition-keywords explore-search-header__keywords"
      :disabled="loading"
      :options="hotTags"
      :prefix="['#']"
      :placeholder="keywordsPlaceholder"
      clearable
      size="large"
      @keydown.enter.prevent="onKeywordsEnter"
      @clear="onKeywordsClear"
    />
    <el-input
      v-else
      v-model="searchForm.filterKeywords"
      class="condition-item condition-keywords explore-search-header__keywords"
      :disabled="loading"
      :placeholder="keywordsPlaceholder"
      clearable
      size="large"
      @keydown.enter.prevent="onKeywordsEnter"
      @clear="onKeywordsClear"
    />

    <div class="explore-search-header__actions">
      <el-popover
        v-model:visible="filterPopoverVisible"
        placement="bottom-end"
        :width="340"
        trigger="click"
        popper-class="explore-filter-popover"
        @show="onOpenFilter"
      >
        <template #reference>
          <div class="condition-item explore-search-header__filter-btn">
            <el-button
              class="header-icon-btn header-icon-btn--ghost"
              circle
              :disabled="loading"
              :title="filterBtnTitle"
              :aria-label="filterBtnTitle"
            >
              <IconifyIcon icon="custom:filter-list" />
            </el-button>
            <span
              v-if="activeFilterCount"
              class="explore-search-header__filter-count"
              aria-hidden="true"
            >
              {{ activeFilterCount }}
            </span>
          </div>
        </template>

        <div class="explore-filter-panel" @mousedown.stop @click.stop>
          <div class="explore-filter-panel__title">{{ t('exploreCommon.header.filterTitle') }}</div>
          <el-scrollbar
            :height="filterBodyMaxHeight"
            always
            class="explore-filter-panel__scroll"
          >
            <div v-if="isSearchMenu" class="explore-filter-panel__field">
              <div class="explore-filter-panel__label">
                {{ t('exploreCommon.searchForm.resourceName.placeholder') }}
              </div>
              <ExploreResourcePicker
                embedded
                v-model="draft.resource"
                :resource-group-list="resourceGroupList"
                :loading="loading"
                :embedded-max-list-height="200"
              />
            </div>

            <div class="explore-filter-panel__field">
              <div class="explore-filter-panel__label">
                {{ t('exploreCommon.header.filterKeywords') }}
              </div>
              <el-input
                v-model="draft.filterKeywords"
                :disabled="loading"
                :placeholder="keywordsPlaceholder"
                clearable
                @keydown.enter.prevent="onApplyFilters"
              />
            </div>

            <div
              v-if="showSemanticSearchField"
              class="explore-filter-panel__field explore-filter-panel__field--switch"
            >
              <div class="explore-filter-panel__switch-row">
                <span class="explore-filter-panel__label explore-filter-panel__label--inline">
                  {{ t('exploreCommon.header.useSemanticSearch') }}
                </span>
                <el-tooltip
                  v-if="!semanticSearchAvailable"
                  :content="t('exploreCommon.header.useSemanticSearchHint')"
                  placement="top"
                >
                  <el-switch
                    :model-value="useSemanticSearch"
                    disabled
                    @change="(val) => emit('update-use-semantic-search', val)"
                  />
                </el-tooltip>
                <el-switch
                  v-else
                  :model-value="useSemanticSearch"
                  :disabled="loading"
                  @change="(val) => emit('update-use-semantic-search', val)"
                />
              </div>
            </div>

            <template v-if="showListBrowseOptions">
              <div class="explore-filter-panel__field">
                <div class="explore-filter-panel__label">
                  {{ t('h5.pages.search.filters.listMode') }}
                </div>
                <el-radio-group v-model="draft.isRandom" size="small">
                  <el-radio-button
                    v-for="item in listModeRadioOptions"
                    :key="String(item.value)"
                    :value="item.value"
                  >
                    {{ item.label }}
                  </el-radio-button>
                </el-radio-group>
              </div>

              <template v-if="!draft.isRandom">
                <div class="explore-filter-panel__field">
                  <div class="explore-filter-panel__label">
                    {{ t('pages.Setting.settingDataForm.sortField') }}
                  </div>
                  <el-select
                    v-model="draft.sortField"
                    :teleported="false"
                    popper-class="explore-filter-select-popper"
                    style="width: 100%"
                  >
                    <el-option
                      v-for="item in sortFieldOptions"
                      :key="item.value"
                      :label="t(item.locale)"
                      :value="item.value"
                    />
                  </el-select>
                </div>

                <div class="explore-filter-panel__field">
                  <div class="explore-filter-panel__label">
                    {{ t('pages.Setting.settingDataForm.sortType') }}
                  </div>
                  <el-radio-group v-model="draft.sortType" size="small">
                    <el-radio-button
                      v-for="item in sortTypeOptions"
                      :key="item.value"
                      :value="item.value"
                    >
                      {{ t(item.locale) }}
                    </el-radio-button>
                  </el-radio-group>
                </div>
              </template>
            </template>

            <div v-if="showFilterTypeField" class="explore-filter-panel__field">
              <div class="explore-filter-panel__label">
                {{ t('exploreCommon.searchForm.filterType.placeholder') }}
              </div>
              <el-radio-group v-model="draft.filterType" size="small">
                <el-radio-button
                  v-for="item in visibleFilterTypes"
                  :key="item.value"
                  :value="item.value"
                >
                  <IconifyIcon :icon="item.icon" />
                  {{ t(item.locale) }}
                </el-radio-button>
              </el-radio-group>
            </div>

            <div class="explore-filter-panel__field">
              <div class="explore-filter-panel__label">
                {{ t('exploreCommon.searchForm.orientation.placeholder') }}
              </div>
              <el-select
                v-model="draft.orientation"
                multiple
                collapse-tags
                :teleported="false"
                :placeholder="t('exploreCommon.searchForm.orientation.placeholder')"
                popper-class="explore-filter-select-popper"
                style="width: 100%"
              >
                <el-option
                  v-for="item in orientationOptions"
                  :key="item.value"
                  :label="t(item.locale)"
                  :value="item.value"
                >
                  <IconifyIcon :icon="item.icon" style="vertical-align: middle; margin-right: 8px" />
                  {{ t(item.locale) }}
                </el-option>
              </el-select>
            </div>

            <div v-if="showQualityField" class="explore-filter-panel__field">
              <div class="explore-filter-panel__label">
                {{ t('exploreCommon.searchForm.quality.placeholder') }}
              </div>
              <el-select
                v-model="draft.quality"
                multiple
                collapse-tags
                :teleported="false"
                :placeholder="t('exploreCommon.searchForm.quality.placeholder')"
                popper-class="explore-filter-select-popper"
                style="width: 100%"
              >
                <el-option v-for="text in qualityList" :key="text" :label="text" :value="text" />
              </el-select>
            </div>
          </el-scrollbar>

          <div class="explore-filter-panel__actions">
            <el-button size="small" @click="onResetDraft">
              {{ t('exploreCommon.header.reset') }}
            </el-button>
            <el-button type="primary" size="small" @click="onApplyFilters">
              {{ t('exploreCommon.header.apply') }}
            </el-button>
          </div>
        </div>
      </el-popover>

      <el-button
        v-if="singleExtraAction"
        class="condition-item header-icon-btn header-icon-btn--ghost"
        :class="{ 'header-icon-btn--active': singleExtraAction.active }"
        circle
        :disabled="loading"
        :title="singleExtraAction.title"
        :aria-label="singleExtraAction.title"
        @click="onExtraCommand(singleExtraAction.command)"
      >
        <IconifyIcon :icon="singleExtraAction.icon" />
      </el-button>

      <el-dropdown
        v-if="headerExtraActions.length > 1"
        trigger="click"
        placement="bottom-end"
        class="condition-item"
        @command="onExtraCommand"
      >
        <el-button
          class="header-icon-btn header-icon-btn--ghost"
          circle
          :disabled="loading"
          :title="t('exploreCommon.header.actionsMenu')"
          :aria-label="t('exploreCommon.header.actionsMenu')"
        >
          <IconifyIcon icon="custom:more-vertical" />
        </el-button>
        <template #dropdown>
          <el-dropdown-menu>
            <el-dropdown-item
              v-for="action in headerExtraActions"
              :key="action.command"
              :command="action.command"
            >
              <IconifyIcon :icon="action.icon" style="vertical-align: middle; margin-right: 8px" />
              {{ action.title }}
            </el-dropdown-item>
          </el-dropdown-menu>
        </template>
      </el-dropdown>
    </div>
  </div>
</template>

<style scoped lang="scss">
.explore-search-header {
  flex-shrink: 0;
  display: grid;
  align-items: center;
  gap: 6px;
  /* width:100% + 左右 margin 会撑出父级，被 explore-common-wrapper 的 overflow-x 裁掉右侧按钮 */
  box-sizing: border-box;
  width: calc(100% - 20px);
  max-width: calc(100% - 20px);
  margin: 10px;
  border-bottom: 1px solid #ffffff;
  min-width: 0;
  grid-template-columns: minmax(0, 1fr) auto;

  &:has(.explore-search-header__primary) {
    grid-template-columns: minmax(0, 260px) minmax(0, 1fr) auto;
  }

  .condition-item {
    min-width: 0;
  }

  &__primary {
    grid-column: 1;
    width: 100%;
    max-width: 260px;
    min-width: 0;
  }

  &__keywords {
    min-width: 0;
    width: 100%;
    max-width: 100%;
    overflow: hidden;

    &:first-child {
      grid-column: 1;
    }
  }

  &:has(.explore-search-header__primary) .explore-search-header__keywords {
    grid-column: 2;
  }

  &__actions {
    grid-column: -1;
    display: flex;
    align-items: center;
    gap: 6px;
    justify-self: end;
    flex-shrink: 0;
  }

  &__filter-btn {
    position: relative;
    display: inline-flex;
    flex-shrink: 0;
  }

  &__filter-count {
    position: absolute;
    top: 0;
    right: 0;
    z-index: 1;
    pointer-events: none;
    transform: translate(15%, -15%);
    min-width: 14px;
    height: 14px;
    padding: 0 3px;
    border-radius: 7px;
    background-color: var(--el-color-danger);
    color: #ffffff;
    font-size: 10px;
    font-weight: 600;
    line-height: 14px;
    text-align: center;
    box-sizing: border-box;
  }

  &--under-similar-banner {
    visibility: hidden;
    pointer-events: none;
  }
}

.header-icon-btn {
  width: 32px;
  height: 32px;
  padding: 0;
  flex-shrink: 0;
  font-size: 18px;

  &--ghost {
    color: #ffffff !important;
    background-color: transparent !important;
    border: none !important;
    box-shadow: none !important;

    &:hover {
      color: #95d475 !important;
      background-color: rgba(255, 255, 255, 0.08) !important;
    }
  }

  &--active {
    color: #95d475 !important;
  }
}

.explore-filter-panel {
  &__title {
    font-size: 14px;
    font-weight: 600;
    margin-bottom: 10px;
  }

  &__field {
    margin-bottom: 10px;
  }

  &__label {
    font-size: 12px;
    color: var(--el-text-color-secondary);
    margin-bottom: 6px;

    &--inline {
      margin-bottom: 0;
    }
  }

  &__field--switch {
    margin-bottom: 12px;
  }

  &__switch-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
  }

  &__actions {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
    margin-top: 0;
    padding-top: 10px;
    border-top: 1px solid var(--el-border-color-lighter);
  }
}

:deep(.condition-keywords) {
  display: block;
  width: 100%;
  max-width: 100%;
  min-width: 0 !important;

  .el-input,
  .el-mention {
    width: 100%;
    max-width: 100%;
    min-width: 0 !important;
  }

  .el-input__wrapper,
  .el-textarea__inner {
    min-width: 0 !important;
  }

  .el-input__inner {
    min-width: 0 !important;
    color: #ffffff !important;
  }
}

</style>

<style lang="scss">
/* 筛选 Popover 内 Select 不挂到 body，避免选选项时误判为点击外部而关闭 Popover */
.explore-filter-popover.el-popover.el-popper {
  overflow: visible !important;
  box-sizing: border-box;

  .explore-filter-panel {
    display: flex;
    flex-direction: column;
    max-height: min(72vh, calc(100vh - 100px));
    overflow: hidden;
    box-sizing: border-box;
  }

  .explore-filter-panel__scroll.el-scrollbar {
    flex: 1;
    min-height: 0;
    align-self: stretch;

    .el-scrollbar__wrap {
      overflow-x: hidden;
      overflow-y: scroll;
    }

    .el-scrollbar__view {
      padding-right: 2px;
    }
  }

  .resource-picker-panel__list--embedded.el-scrollbar .el-scrollbar__wrap {
    overflow-x: hidden;
  }
}

.explore-filter-select-popper {
  z-index: 1 !important;
}

.explore-search-header.header-block {
  .condition-keywords .el-input__wrapper,
  .condition-keywords .el-textarea__inner {
    width: 100% !important;
    max-width: 100% !important;
    border: none !important;
    border-radius: 0 !important;
    background-color: transparent !important;
    box-shadow: none !important;

    .el-input__inner {
      color: #ffffff !important;
      caret-color: #ffffff;
    }
  }

  .condition-keywords .el-input__suffix {
    .el-input__clear,
    .el-icon {
      color: rgba(255, 255, 255, 0.65);
    }

    .el-input__clear:hover {
      color: #ffffff;
    }
  }
}
</style>
