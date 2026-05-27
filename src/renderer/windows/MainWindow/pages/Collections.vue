<script setup>
import { useTranslation } from 'i18next-vue'
import { resolveApiUserMessage } from '@common/utils.js'

const { t } = useTranslation()

const collections = ref([])
const curatorStats = ref(null)
const loading = ref(false)
const prompt = ref('')
const selectedId = ref(null)
const detail = ref(null)

const selectedCollection = computed(() => detail.value?.collection || null)
const detailItems = computed(() => detail.value?.items || [])
const isAutoCollection = (item) => item?.source === 'auto'

const autoCollections = computed(() => collections.value.filter((item) => isAutoCollection(item)))
const userCollections = computed(() => collections.value.filter((item) => !isAutoCollection(item)))

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

const formatTime = (value) => {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString()
}

const loadList = async () => {
  loading.value = true
  try {
    const [listRes, statsRes] = await Promise.all([
      window.FBW.collectionsList(),
      window.FBW.collectionsCuratorStats()
    ])
    if (listRes?.success && Array.isArray(listRes.data)) {
      collections.value = listRes.data
    }
    if (statsRes?.success) {
      curatorStats.value = statsRes.data
    }
  } finally {
    loading.value = false
  }
}

const loadDetail = async (id) => {
  selectedId.value = id
  const res = await window.FBW.collectionsGet({ id })
  if (res?.success) detail.value = res.data
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
    }
    await loadList()
  }
}

const onAddFavorites = async (id) => {
  const res = await window.FBW.collectionsAddAllToFavorites({ id })
  ElMessage({
    type: res.success ? 'success' : 'error',
    message: resolveApiUserMessage(res, t)
  })
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

onMounted(() => {
  loadList()
})
</script>

<template>
  <el-main class="page-collections">
    <header class="page-header">
      <div class="page-header__text">
        <h2>{{ t('pages.Collections.title') }}</h2>
        <p>{{ t('pages.Collections.subtitle') }}</p>
        <p v-if="curatorStats" class="curator-stats">
          {{
            t('pages.Collections.curatorStats', {
              analyzed: curatorStats.analyzed ?? 0,
              embeddings: curatorStats.embeddings ?? 0,
              auto: curatorStats.autoCollections ?? 0,
              target: curatorStats.targetCollections ?? 0
            })
          }}
        </p>
      </div>
      <el-button size="small" :loading="loading" @click="onCurateNow">
        {{ t('pages.Collections.curateNow') }}
      </el-button>
    </header>

    <section class="create-card">
      <div class="create-card__icon">
        <IconifyIcon icon="custom:collections" />
      </div>
      <el-input
        v-model="prompt"
        :placeholder="t('pages.Collections.promptPlaceholder')"
        class="create-card__input"
        clearable
        @keyup.enter="onCreate"
      />
      <el-button type="primary" :loading="loading" @click="onCreate">
        {{ t('pages.Collections.create') }}
      </el-button>
    </section>

    <section class="content-layout">
      <aside class="list-panel">
        <div class="panel-head">
          <span>{{ t('pages.Collections.listTitle') }}</span>
          <el-tag size="small" type="info" effect="plain">{{ collections.length }}</el-tag>
        </div>
        <el-scrollbar v-loading="loading" class="list-scroll">
          <div v-if="autoCollections.length" class="list-section-title">
            {{ t('pages.Collections.sectionAuto') }}
          </div>
          <div
            v-for="item in autoCollections"
            :key="item.id"
            class="collection-item"
            :class="{ active: selectedId === item.id }"
            @click="loadDetail(item.id)"
          >
            <div class="collection-item__main">
              <div class="name-row">
                <span class="name">{{ item.name }}</span>
                <el-tag size="small" type="warning" effect="plain" class="auto-tag">
                  {{ t('pages.Collections.sourceAuto') }}
                </el-tag>
              </div>
              <div class="meta">
                {{ formatTime(item.lastGeneratedAt || item.updated_at) }}
                · {{ refreshModeLabel(item.refreshMode) }}
              </div>
            </div>
            <IconifyIcon class="collection-item__arrow" icon="custom:arrow-right" />
          </div>

          <div class="list-section-title">{{ t('pages.Collections.sectionUser') }}</div>
          <div
            v-for="item in userCollections"
            :key="item.id"
            class="collection-item"
            :class="{ active: selectedId === item.id }"
            @click="loadDetail(item.id)"
          >
            <div class="collection-item__main">
              <div class="name-row">
                <span class="name">{{ item.name }}</span>
                <el-tag
                  v-if="item.refreshMode && item.refreshMode !== 'manual'"
                  size="small"
                  type="success"
                  effect="plain"
                  class="auto-tag"
                >
                  {{ t('pages.Collections.autoRefreshTag') }}
                </el-tag>
              </div>
              <div class="meta">
                {{ formatTime(item.lastGeneratedAt || item.updated_at) }}
                <template v-if="item.refreshMode && item.refreshMode !== 'manual'">
                  · {{ refreshModeLabel(item.refreshMode) }}
                </template>
              </div>
            </div>
            <IconifyIcon class="collection-item__arrow" icon="custom:arrow-right" />
          </div>
          <div v-if="!collections.length && !loading" class="list-empty">
            <EmptyHelp :text="t('pages.Collections.empty')" :enable-jump="false" />
          </div>
        </el-scrollbar>
      </aside>

      <main class="detail-panel">
        <template v-if="selectedCollection">
          <div class="detail-header">
            <div>
              <div class="detail-title-row">
                <h3>{{ selectedCollection.name }}</h3>
                <el-tag
                  v-if="isAutoCollection(selectedCollection)"
                  size="small"
                  type="warning"
                  effect="plain"
                >
                  {{ t('pages.Collections.sourceAuto') }}
                </el-tag>
              </div>
              <p class="prompt-text">{{ selectedCollection.prompt }}</p>
            </div>
            <div class="actions">
              <el-button
                v-if="!isAutoCollection(selectedCollection)"
                size="small"
                :loading="loading"
                @click="onRefresh(selectedCollection.id)"
              >
                {{ t('pages.Collections.refresh') }}
              </el-button>
              <el-button size="small" @click="onAddFavorites(selectedCollection.id)">
                {{ t('pages.Collections.addFavorites') }}
              </el-button>
              <el-button size="small" type="danger" plain @click="onDelete(selectedCollection.id)">
                {{ t('pages.Collections.delete') }}
              </el-button>
            </div>
          </div>

          <div class="detail-meta">
            <el-tag size="small" effect="plain">
              {{ t('pages.Collections.itemCount', { count: detailItems.length }) }}
            </el-tag>
            <div v-if="isAutoCollection(selectedCollection)" class="field-hint">
              {{ t('pages.Collections.autoCollectionHint') }}
            </div>
            <div v-else class="refresh-mode-row">
              <span class="refresh-mode-label">{{ t('pages.Collections.refreshMode') }}</span>
              <el-select
                :model-value="selectedCollection.refreshMode || 'manual'"
                size="small"
                style="width: 140px"
                @change="onRefreshModeChange"
              >
                <el-option
                  v-for="item in refreshModeOptions"
                  :key="item.value"
                  :label="item.label"
                  :value="item.value"
                />
              </el-select>
            </div>
            <div v-else-if="selectedCollection.refreshMode !== 'manual'" class="field-hint">
              {{ t('pages.Collections.refreshModeHint') }}
            </div>
          </div>

          <el-scrollbar v-loading="loading" class="detail-scroll">
            <div v-if="detailItems.length" class="grid">
              <article v-for="item in detailItems" :key="item.id" class="thumb-card">
                <div class="thumb-image">
                  <img
                    v-if="item.filePath"
                    :src="`fbwtp://fbw/api/images/get?filePath=${encodeURIComponent(item.filePath)}`"
                    alt=""
                    loading="lazy"
                  />
                  <div v-else class="thumb-placeholder">
                    <IconifyIcon icon="custom:image" />
                  </div>
                  <el-tag v-if="item.score" class="thumb-score" size="small" type="success">
                    {{ item.score }}
                  </el-tag>
                </div>
                <div class="caption" :title="item.title || item.fileName">
                  {{ item.title || item.fileName }}
                </div>
              </article>
            </div>
            <div v-else class="detail-empty">
              <EmptyHelp :text="t('pages.Collections.noItems')" :enable-jump="false" />
            </div>
          </el-scrollbar>
        </template>
        <div v-else class="detail-placeholder">
          <EmptyHelp :text="t('pages.Collections.selectHint')" :enable-jump="false" />
        </div>
      </main>
    </section>
  </el-main>
</template>

<style scoped lang="scss">
.page-collections {
  padding: 8px 20px 24px;
  min-height: calc(100vh - 35px);
  box-sizing: border-box;
}

.page-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 16px;

  h2 {
    margin: 0;
    font-size: 22px;
    font-weight: 600;
    color: var(--el-text-color-primary);
  }

  p {
    margin: 6px 0 0;
    font-size: 13px;
    color: var(--el-text-color-secondary);
  }

  .curator-stats {
    margin-top: 4px;
    font-size: 12px;
  }
}

.list-section-title {
  padding: 10px 14px 4px;
  font-size: 12px;
  font-weight: 600;
  color: var(--el-text-color-secondary);
}

.detail-title-row {
  display: flex;
  align-items: center;
  gap: 8px;

  h3 {
    margin: 0;
  }
}

.create-card {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px 18px;
  margin-bottom: 16px;
  border-radius: 12px;
  border: 1px solid var(--el-border-color-lighter);
  background: var(--el-fill-color-blank);
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);

  &__icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 40px;
    height: 40px;
    border-radius: 10px;
    background: var(--el-color-primary-light-9);
    color: var(--el-color-primary);
    font-size: 22px;
    flex-shrink: 0;
  }

  &__input {
    flex: 1;
  }
}

.content-layout {
  display: grid;
  grid-template-columns: 280px minmax(0, 1fr);
  gap: 16px;
  height: calc(100vh - 240px);
  min-height: 420px;
}

.list-panel,
.detail-panel {
  display: flex;
  flex-direction: column;
  min-height: 0;
  border-radius: 12px;
  border: 1px solid var(--el-border-color-lighter);
  background: var(--el-fill-color-blank);
  overflow: hidden;
}

.panel-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 16px;
  font-size: 14px;
  font-weight: 600;
  border-bottom: 1px solid var(--el-border-color-lighter);
  background: var(--el-fill-color-light);
}

.list-scroll,
.detail-scroll {
  flex: 1;
  min-height: 0;

  :deep(.el-scrollbar__view) {
    min-height: 100%;
  }
}

.collection-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 14px;
  margin: 8px 10px 0;
  border-radius: 10px;
  cursor: pointer;
  border: 1px solid transparent;
  transition:
    background-color 0.15s ease,
    border-color 0.15s ease;

  &:last-child {
    margin-bottom: 8px;
  }

  &:hover {
    background: var(--el-fill-color-light);
  }

  &.active {
    border-color: var(--el-color-primary-light-5);
    background: var(--el-color-primary-light-9);

    .collection-item__arrow {
      color: var(--el-color-primary);
    }
  }

  &__main {
    flex: 1;
    min-width: 0;
  }

  &__arrow {
    font-size: 16px;
    color: var(--el-text-color-placeholder);
    flex-shrink: 0;
  }

  .name {
    font-weight: 600;
    font-size: 14px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .name-row {
    display: flex;
    align-items: center;
    gap: 6px;
    min-width: 0;

    .name {
      flex: 1;
      min-width: 0;
    }

    .auto-tag {
      flex-shrink: 0;
      transform: scale(0.92);
    }
  }

  .meta {
    margin-top: 4px;
    font-size: 12px;
    color: var(--el-text-color-secondary);
  }
}

.list-empty,
.detail-empty,
.detail-placeholder {
  position: relative;
  padding: 24px;
}

.detail-placeholder {
  flex: 1;
  min-height: 0;
}

.list-empty,
.detail-empty {
  min-height: 280px;
}

.detail-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 16px;
  padding: 16px 16px 0;

  h3 {
    margin: 0;
    font-size: 18px;
    font-weight: 600;
  }

  .actions {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    justify-content: flex-end;
  }
}

.prompt-text {
  margin: 8px 0 0;
  font-size: 13px;
  line-height: 1.5;
  color: var(--el-text-color-secondary);
}

.detail-meta {
  padding: 10px 16px 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.refresh-mode-row {
  display: flex;
  align-items: center;
  gap: 10px;
}

.refresh-mode-label {
  font-size: 13px;
  color: var(--el-text-color-regular);
}

.field-hint {
  font-size: 12px;
  line-height: 1.5;
  color: var(--el-text-color-secondary);
}

.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
  gap: 14px;
  padding: 16px;
}

.thumb-card {
  .thumb-image {
    position: relative;
    border-radius: 10px;
    overflow: hidden;
    background: var(--el-fill-color-light);
    aspect-ratio: 16 / 10;

    img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      display: block;
    }
  }

  .thumb-placeholder {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--el-text-color-placeholder);
    font-size: 28px;
  }

  .thumb-score {
    position: absolute;
    top: 8px;
    right: 8px;
  }

  .caption {
    margin-top: 8px;
    font-size: 12px;
    color: var(--el-text-color-regular);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
}
</style>
