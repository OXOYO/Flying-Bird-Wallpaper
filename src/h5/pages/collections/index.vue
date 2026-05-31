<script setup>
import * as api from '@h5/api/index.js'
import H5BrowseChrome from '@h5/components/H5BrowseChrome.vue'
import H5ResourceBrowseView from '@h5/components/H5ResourceBrowseView.vue'
import UseSettingStore from '@h5/stores/settingStore.js'
import UseCommonStore from '@h5/stores/commonStore.js'
import { useTranslation } from 'i18next-vue'
import { resolveApiUserMessage } from '@common/utils.js'

const { t } = useTranslation()
const settingStore = UseSettingStore()
const commonStore = UseCommonStore()
const { immersiveMode } = storeToRefs(commonStore)

const loading = ref(false)
const collections = ref([])
const selectedId = ref(null)
const showPicker = ref(false)
const showCreate = ref(false)
const createSubmitting = ref(false)
const showHeaderActions = ref(false)
const showRefreshMode = ref(false)
const createPrompt = ref('')
const browseRef = ref(null)
const headerRef = ref(null)

const isAutoCollection = (item) => item?.source === 'auto'

const isUserCollection = (item) => item && !isAutoCollection(item)

const refreshModeOptions = computed(() => [
  { value: 'manual', label: t('pages.Collections.refreshModeManual') },
  { value: '1h', label: t('pages.Collections.refreshMode1h') },
  { value: '6h', label: t('pages.Collections.refreshMode6h') },
  { value: '12h', label: t('pages.Collections.refreshMode12h') },
  { value: '24h', label: t('pages.Collections.refreshMode24h') }
])

const currentRefreshMode = computed(
  () => selectedCollection.value?.refreshMode || 'manual'
)

const refreshModeLabel = (mode) => {
  if (mode === 'on_analysis') return t('pages.Collections.refreshModeOnAnalysis')
  return refreshModeOptions.value.find((item) => item.value === mode)?.label || mode
}

const currentRefreshModeLabel = computed(() => refreshModeLabel(currentRefreshMode.value))

const canManageRefresh = computed(() => isUserCollection(selectedCollection.value))

const autoCollections = computed(() => collections.value.filter((item) => isAutoCollection(item)))
const userCollections = computed(() => collections.value.filter((item) => !isAutoCollection(item)))

const pickerGroups = computed(() => {
  const groups = []
  if (autoCollections.value.length) {
    groups.push({
      key: 'auto',
      title: t('pages.Collections.sectionAuto'),
      items: autoCollections.value
    })
  }
  if (userCollections.value.length) {
    groups.push({
      key: 'user',
      title: t('pages.Collections.sectionUser'),
      items: userCollections.value
    })
  }
  return groups
})

const selectedCollection = computed(
  () => collections.value.find((item) => item.id === selectedId.value) || null
)

const collectionItemCount = (item) => Number(item?.itemCount ?? item?.itemcount ?? 0)

const itemCountText = (item) =>
  t('pages.Collections.itemCount', { count: collectionItemCount(item) })

const dropdownLabel = computed(() => {
  if (selectedCollection.value) return selectedCollection.value.name
  if (loading.value) return t('messages.loading')
  return t('pages.Collections.selectPlaceholder')
})

const dropdownMeta = computed(() => {
  if (!selectedCollection.value) return ''
  return itemCountText(selectedCollection.value)
})

const layoutToggleTitle = computed(() => {
  const exposed = browseRef.value?.layoutToggleTitle
  return typeof exposed === 'string' ? exposed : (exposed?.value ?? '')
})

const browseDisplayMode = computed(() => {
  const exposed = browseRef.value?.displayMode
  const mode = exposed?.value ?? exposed
  return mode === 'waterfall' ? 'waterfall' : 'fullscreen'
})

const selectCollection = (item) => {
  if (!item?.id) return
  selectedId.value = item.id
  showPicker.value = false
  settingStore.vibrate()
}

const ensureSelection = () => {
  const list = collections.value
  if (!list.length) {
    selectedId.value = null
    return
  }
  if (!list.some((item) => item.id === selectedId.value)) {
    selectedId.value = list[0].id
  }
}

const fetchList = async () => {
  loading.value = true
  try {
    const res = await api.collectionsList()
    if (res?.success && Array.isArray(res.data)) {
      collections.value = res.data
      ensureSelection()
    } else {
      showNotify({ type: 'danger', message: resolveApiUserMessage(res, t) })
    }
  } finally {
    loading.value = false
  }
}

const onCreateDialogBeforeClose = (action) => {
  if (createSubmitting.value) return false
  if (action === 'confirm') {
    void submitCreate()
    return false
  }
  return true
}

const submitCreate = async () => {
  const prompt = createPrompt.value.trim()
  if (!prompt || createSubmitting.value) return
  createSubmitting.value = true
  try {
    const res = await api.collectionsCreate({ prompt })
    if (res?.success) {
      showNotify({ type: 'success', message: t('messages.operationSuccess') })
      showCreate.value = false
      createPrompt.value = ''
      loading.value = true
      try {
        await fetchList()
        const id = res.data?.id
        const created = collections.value.find((c) => c.id === id)
        if (created) selectCollection(created)
      } finally {
        loading.value = false
      }
    } else {
      showNotify({ type: 'danger', message: resolveApiUserMessage(res, t) })
    }
  } finally {
    createSubmitting.value = false
  }
}

const onCurate = async () => {
  try {
    await showConfirmDialog({
      title: t('pages.Collections.curateNow'),
      message: t('pages.Collections.curateManualConfirmSettled'),
      confirmButtonText: t('pages.Collections.curateNow'),
      cancelButtonText: t('pages.Collections.dialogCancel')
    })
    loading.value = true
    const res = await api.collectionsCurate()
    if (res?.success) {
      showNotify({
        type: 'success',
        message: t('pages.Collections.curateSuccess', {
          count: res.data?.autoCollections ?? 0
        })
      })
      await fetchList()
    } else {
      showNotify({ type: 'danger', message: resolveApiUserMessage(res, t) })
    }
  } catch (err) {
    if (err !== 'cancel') {
      showNotify({ type: 'danger', message: resolveApiUserMessage(err, t) })
    }
  } finally {
    loading.value = false
  }
}

const onDeleteCurrent = async () => {
  const item = selectedCollection.value
  if (!item?.id || isAutoCollection(item)) return
  try {
    await showConfirmDialog({
      title: t('pages.Collections.delete'),
      message: t('pages.Collections.confirmDelete'),
      confirmButtonColor: '#ee0a24'
    })
    settingStore.vibrate()
    const res = await api.collectionsDelete(item.id)
    if (res?.success) {
      await fetchList()
      showNotify({ type: 'success', message: t('messages.deleteSuccess') })
    } else {
      showNotify({ type: 'danger', message: resolveApiUserMessage(res, t) })
    }
  } catch (err) {
    if (err !== 'cancel') {
      showNotify({ type: 'danger', message: resolveApiUserMessage(err, t) })
    }
  }
}

const onAddAllFavorites = async () => {
  const item = selectedCollection.value
  if (!item?.id) return
  settingStore.vibrate()
  const res = await api.collectionsAddAllToFavorites(item.id)
  showNotify({
    type: res?.success ? 'success' : 'danger',
    message: res?.success ? t('messages.operationSuccess') : resolveApiUserMessage(res, t)
  })
}

const onRefreshCollection = async () => {
  const item = selectedCollection.value
  if (!item?.id || !isUserCollection(item)) return
  loading.value = true
  try {
    settingStore.vibrate()
    const res = await api.collectionsGenerate(item.id)
    if (res?.success) {
      showNotify({ type: 'success', message: resolveApiUserMessage(res, t) || t('messages.operationSuccess') })
      await fetchList()
      await browseRef.value?.refresh?.()
    } else {
      showNotify({ type: 'danger', message: resolveApiUserMessage(res, t) })
    }
  } finally {
    loading.value = false
  }
}

const onRefreshModeChange = async (mode) => {
  const item = selectedCollection.value
  if (!item?.id || !isUserCollection(item)) return
  if (mode === currentRefreshMode.value) {
    showRefreshMode.value = false
    return
  }
  loading.value = true
  try {
    const res = await api.collectionsUpdate({ id: item.id, refreshMode: mode })
    if (res?.success) {
      showNotify({ type: 'success', message: t('pages.Collections.refreshModeUpdated') })
      showRefreshMode.value = false
      await fetchList()
    } else {
      showNotify({ type: 'danger', message: resolveApiUserMessage(res, t) })
    }
  } finally {
    loading.value = false
  }
}

const headerActionSheetActions = computed(() => {
  const item = selectedCollection.value
  const actions = [
    { name: t('pages.Collections.createNew'), actionKey: 'create' },
    { name: t('pages.Collections.curateNow'), actionKey: 'curate' }
  ]
  if (item && isUserCollection(item)) {
    actions.push({ name: t('pages.Collections.refresh'), actionKey: 'refresh' })
    actions.push({
      name: t('pages.Collections.refreshMode'),
      subname: currentRefreshModeLabel.value,
      actionKey: 'refreshMode',
      arrow: true
    })
  }
  if (item) {
    actions.push({ name: t('pages.Collections.addFavorites'), actionKey: 'favorites' })
  }
  if (item && isUserCollection(item)) {
    actions.push({
      name: t('pages.Collections.delete'),
      actionKey: 'delete',
      color: '#ee0a24'
    })
  }
  return actions
})

const onHeaderActionSelect = async (action) => {
  showHeaderActions.value = false
  if (!action?.actionKey) return
  switch (action.actionKey) {
    case 'create':
      showCreate.value = true
      break
    case 'curate':
      await onCurate()
      break
    case 'refresh':
      await onRefreshCollection()
      break
    case 'refreshMode':
      showRefreshMode.value = true
      break
    case 'favorites':
      await onAddAllFavorites()
      break
    case 'delete':
      await onDeleteCurrent()
      break
    default:
      break
  }
}

const onToggleLayoutMode = () => {
  browseRef.value?.toggleDisplayMode?.()
}

const init = async () => {
  await fetchList()
}

const refresh = async () => {
  await fetchList()
  if (selectedId.value) {
    await browseRef.value?.refresh?.()
  }
}

defineExpose({ init, refresh })

onMounted(() => {
  void init()
})
</script>

<template>
  <div
    class="page-collections-h5"
    :class="{ 'page-collections-h5--immersive': immersiveMode }"
  >
    <div ref="headerRef" class="collections-header browse-toolbar">
      <H5BrowseChrome :immersive-mode="immersiveMode">
        <button
          v-if="!immersiveMode"
          type="button"
          class="collection-dropdown"
          :class="{ 'collection-dropdown--disabled': !collections.length && !loading }"
          :disabled="!collections.length && !loading"
          @click="showPicker = true"
        >
          <span class="collection-dropdown__main">
            <span class="collection-dropdown__name">{{ dropdownLabel }}</span>
            <span v-if="dropdownMeta" class="collection-dropdown__meta">{{ dropdownMeta }}</span>
          </span>
          <van-icon class="collection-dropdown__arrow" name="arrow-down" />
        </button>
        <template v-if="!immersiveMode" #trailing>
          <van-button
            v-if="canManageRefresh"
            class="h5-chrome-icon-btn"
            plain
            :disabled="loading"
            :title="t('pages.Collections.refresh')"
            :aria-label="t('pages.Collections.refresh')"
            @click="onRefreshCollection"
          >
            <van-icon name="replay" />
          </van-button>
          <van-button
            v-if="selectedId"
            class="h5-chrome-icon-btn"
            plain
            :title="layoutToggleTitle"
            :aria-label="layoutToggleTitle"
            @click="onToggleLayoutMode"
          >
            <van-icon :name="browseDisplayMode === 'waterfall' ? 'expand-o' : 'apps-o'" />
          </van-button>
          <van-button
            class="h5-chrome-icon-btn"
            plain
            icon="ellipsis"
            :aria-label="t('pages.Collections.actionsMenu')"
            @click="showHeaderActions = true"
          />
        </template>
        <template #mini-trailing>
          <van-button
            v-if="canManageRefresh"
            class="chrome-mini-btn"
            plain
            :disabled="loading"
            :title="t('pages.Collections.refresh')"
            :aria-label="t('pages.Collections.refresh')"
            @click="onRefreshCollection"
          >
            <van-icon name="replay" />
          </van-button>
          <van-button
            class="chrome-mini-btn"
            plain
            :disabled="!collections.length && !loading"
            :aria-label="t('pages.Collections.selectPlaceholder')"
            @click="showPicker = true"
          >
            <van-icon name="arrow-down" />
          </van-button>
          <van-button
            v-if="selectedId"
            class="chrome-mini-btn"
            plain
            :title="layoutToggleTitle"
            :aria-label="layoutToggleTitle"
            @click="onToggleLayoutMode"
          >
            <van-icon :name="browseDisplayMode === 'waterfall' ? 'expand-o' : 'apps-o'" />
          </van-button>
          <van-button
            class="chrome-mini-btn"
            plain
            icon="ellipsis"
            :aria-label="t('pages.Collections.actionsMenu')"
            @click="showHeaderActions = true"
          />
        </template>
      </H5BrowseChrome>
    </div>

    <H5ResourceBrowseView
      v-if="selectedId"
      ref="browseRef"
      browse-type="collection"
      :collection-id="selectedId"
      display-mode-storage-key="fbw_h5_collections_display_mode"
      hide-chrome
      :external-toolbar-ref="headerRef"
    />

    <div v-else-if="!loading" class="collections-empty-wrap">
      <van-empty :description="t('pages.Collections.empty')">
        <van-button type="primary" size="small" @click="showCreate = true">
          {{ t('pages.Collections.createNew') }}
        </van-button>
      </van-empty>
    </div>

    <van-popup
      v-model:show="showPicker"
      position="bottom"
      round
      class="collection-picker-popup"
      :style="{ maxHeight: '70vh' }"
    >
      <div class="collection-picker">
        <div class="collection-picker__title">{{ t('pages.Collections.selectPlaceholder') }}</div>
        <div class="collection-picker__body">
          <template v-if="pickerGroups.length">
            <div v-for="group in pickerGroups" :key="group.key" class="collection-picker__group">
              <div class="collection-picker__group-title">{{ group.title }}</div>
              <van-cell-group inset>
                <van-cell
                  v-for="item in group.items"
                  :key="item.id"
                  clickable
                  :class="{ 'collection-picker__item--active': item.id === selectedId }"
                  @click="selectCollection(item)"
                >
                  <template #title>
                    <div class="collection-picker__row">
                      <span class="collection-picker__name">{{ item.name }}</span>
                      <span class="collection-picker__tail">
                        <span class="collection-picker__count">{{ itemCountText(item) }}</span>
                        <van-icon
                          v-if="item.id === selectedId"
                          name="success"
                          class="collection-picker__check"
                        />
                      </span>
                    </div>
                  </template>
                </van-cell>
              </van-cell-group>
            </div>
          </template>
          <van-empty v-else :description="t('pages.Collections.empty')" />
        </div>
      </div>
    </van-popup>

    <van-dialog
      v-model:show="showCreate"
      :title="t('pages.Collections.createDialogTitle')"
      show-cancel-button
      :close-on-click-overlay="!createSubmitting"
      :before-close="onCreateDialogBeforeClose"
      :confirm-button-loading="createSubmitting"
      :confirm-button-disabled="createSubmitting"
      :cancel-button-disabled="createSubmitting"
    >
      <van-field
        v-model="createPrompt"
        type="textarea"
        rows="3"
        :disabled="createSubmitting"
        :placeholder="t('pages.Collections.promptPlaceholder')"
      />
    </van-dialog>

    <van-action-sheet
      v-model:show="showHeaderActions"
      :actions="headerActionSheetActions"
      :cancel-text="t('pages.Collections.dialogCancel')"
      @select="onHeaderActionSelect"
    >
      <template #action="{ action }">
        <div
          class="collection-action-item"
          :class="{ 'collection-action-item--nav': action.arrow }"
        >
          <span v-if="action.arrow" class="collection-action-item__balance" aria-hidden="true">
            <van-icon name="arrow" />
          </span>
          <div class="collection-action-item__text">
            <span>{{ action.name }}</span>
            <span v-if="action.subname" class="collection-action-item__subname">{{ action.subname }}</span>
          </div>
          <van-icon v-if="action.arrow" name="arrow" class="collection-action-item__arrow" />
        </div>
      </template>
    </van-action-sheet>

    <van-popup
      v-model:show="showRefreshMode"
      position="bottom"
      round
      class="collection-refresh-mode-popup"
    >
      <div class="refresh-mode-panel">
        <div class="refresh-mode-panel__title">{{ t('pages.Collections.refreshMode') }}</div>
        <p class="refresh-mode-panel__hint">{{ t('pages.Collections.refreshModeHint') }}</p>
        <van-radio-group :model-value="currentRefreshMode" class="refresh-mode-options">
          <van-cell-group inset>
            <van-cell
              v-for="item in refreshModeOptions"
              :key="item.value"
              clickable
              :title="item.label"
              @click="onRefreshModeChange(item.value)"
            >
              <template #right-icon>
                <van-radio :name="item.value" />
              </template>
            </van-cell>
          </van-cell-group>
        </van-radio-group>
      </div>
    </van-popup>
  </div>
</template>

<style scoped lang="scss">
.page-collections-h5 {
  min-height: calc(100vh - var(--fbw-tabbar-height));
  box-sizing: border-box;
}

/* 顶栏基础样式见 h5/assets/styles/main.css */

.page-collections-h5--immersive .collections-header {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 0;
  overflow: visible;
  background: transparent;
  box-shadow: none;
  z-index: 20;
}

.page-collections-h5--immersive .chrome-mini-btn {
  width: 40px;
  height: 40px;
  min-width: 40px;
  border-radius: 50%;
  padding: 0;
  background: rgba(0, 0, 0, 0.45);
  backdrop-filter: blur(8px);
  border: none;
  color: #fff;

  :deep(.van-icon) {
    color: #fff;
  }
}

.collections-empty-wrap {
  padding: 48px 16px 80px;
}

.collection-picker {
  display: flex;
  flex-direction: column;
  max-height: 70vh;
}

.collection-picker__title {
  flex-shrink: 0;
  padding: 14px 20px 8px;
  font-size: 16px;
  font-weight: 600;
  text-align: center;
}

.collection-picker__body {
  flex: 1;
  min-height: 0;
  overflow: auto;
  padding-bottom: calc(12px + env(safe-area-inset-bottom, 0px));
}

.collection-picker__group {
  margin-bottom: 8px;
}

.collection-picker__group-title {
  padding: 8px 20px 6px;
  font-size: 13px;
  color: var(--van-text-color-2);
}

.collection-picker__item--active .collection-picker__name {
  color: var(--van-primary-color);
  font-weight: 600;
}

.collection-picker__row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  width: 100%;
}

.collection-picker__name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.collection-picker__tail {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
}

.collection-picker__count {
  font-size: 12px;
  color: var(--van-text-color-2);
  white-space: nowrap;
}

.collection-picker__check {
  color: var(--van-primary-color);
}

.refresh-mode-panel {
  padding: 16px 16px calc(16px + env(safe-area-inset-bottom, 0px));
}

.refresh-mode-panel__title {
  font-size: 16px;
  font-weight: 600;
  text-align: center;
  margin-bottom: 8px;
}

.refresh-mode-panel__hint {
  margin: 0 4px 12px;
  font-size: 12px;
  line-height: 1.45;
  color: var(--van-text-color-2);
}

.refresh-mode-options :deep(.van-cell__title) {
  flex: 1;
}

.collection-action-item {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  box-sizing: border-box;

  &--nav {
    gap: 0;
    padding: 0;
  }
}

.collection-action-item__text {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  min-width: 0;
  text-align: center;

  .collection-action-item--nav & {
    flex: 1;
  }
}

.collection-action-item__balance {
  flex-shrink: 0;
  visibility: hidden;
  font-size: 14px;
  line-height: 1;
}

.collection-action-item__subname {
  font-size: 12px;
  line-height: 1.3;
  color: var(--van-text-color-2);
}

.collection-action-item__arrow {
  flex-shrink: 0;
  font-size: 14px;
  line-height: 1;
  color: var(--van-text-color-3);
}
</style>
