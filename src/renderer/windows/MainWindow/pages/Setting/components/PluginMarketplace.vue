<script setup>
import { useTranslation } from 'i18next-vue'
import UseSettingStore from '@renderer/stores/settingStore.js'
import UseCommonStore from '@renderer/stores/commonStore.js'

const { t } = useTranslation()
const settingStore = UseSettingStore()
const commonStore = UseCommonStore()

const activeTab = ref('marketplace')
const marketplaceSearchQuery = ref('')
const installedSearchQuery = ref('')
const availablePlugins = ref([])
const installedPlugins = ref([])
const pluginSources = ref([])
const showAddSourceDialog = ref(false)
const sourceFormRef = ref()
const sourceForm = reactive({
  name: '',
  type: 'github',
  location: ''
})
const loading = reactive({
  available: false,
  installed: false,
  sources: false,
  addSource: false,
  installing: false,
  uninstalling: false,
  updating: false
})
const actionLoading = reactive({
  installingKey: '',
  uninstallingKey: '',
  updatingKey: ''
})

const expandedPluginKeys = ref({})
const settingData = ref({})

const filteredAvailablePlugins = computed(() => {
  if (!marketplaceSearchQuery.value) {
    return availablePlugins.value
  }
  const query = marketplaceSearchQuery.value.toLowerCase()
  return availablePlugins.value.filter((plugin) => {
    const name = (plugin.name || '').toLowerCase()
    const displayName = (plugin.displayName || '').toLowerCase()
    const description = (plugin.description || '').toLowerCase()
    const sourceName = (plugin.sourceName || '').toLowerCase()
    return (
      name.includes(query) ||
      displayName.includes(query) ||
      description.includes(query) ||
      sourceName.includes(query)
    )
  })
})

const filteredInstalledPlugins = computed(() => {
  if (!installedSearchQuery.value) {
    return installedPlugins.value
  }
  const query = installedSearchQuery.value.toLowerCase()
  return installedPlugins.value.filter((plugin) => {
    const name = (plugin.name || '').toLowerCase()
    const displayName = (plugin.displayName || '').toLowerCase()
    const description = (plugin.description || '').toLowerCase()
    const sourceName = (plugin.sourceName || '').toLowerCase()
    return (
      name.includes(query) ||
      displayName.includes(query) ||
      description.includes(query) ||
      sourceName.includes(query)
    )
  })
})

const remoteResourceSecretKeys = computed(() => settingData.value?.remoteResourceSecretKeys || {})

const toPluginKey = (plugin) => plugin.pluginKey || `${plugin.sourceName}:${plugin.name}`

const loadAvailablePlugins = async () => {
  loading.available = true
  try {
    const result = await window.FBW.getAvailablePlugins()
    if (result.success) {
      availablePlugins.value = result.data || []
      if (result.message) {
        ElMessage.warning(result.message)
      }
    } else {
      ElMessage.error(
        result.message || t('pages.Setting.pluginMarketplace.feedback.getAvailableFail')
      )
    }
  } catch (error) {
    console.error(t('pages.Setting.pluginMarketplace.feedback.getAvailableFail'), error)
    ElMessage.error(t('pages.Setting.pluginMarketplace.feedback.getAvailableFail'))
  } finally {
    loading.available = false
  }
}

const loadInstalledPlugins = async () => {
  loading.installed = true
  try {
    const result = await window.FBW.getInstalledPlugins()
    if (result.success) {
      installedPlugins.value = result.data || []
    } else {
      ElMessage.error(
        result.message || t('pages.Setting.pluginMarketplace.feedback.getInstalledFail')
      )
    }
  } catch (error) {
    console.error(t('pages.Setting.pluginMarketplace.feedback.getInstalledFail'), error)
    ElMessage.error(t('pages.Setting.pluginMarketplace.feedback.getInstalledFail'))
  } finally {
    loading.installed = false
  }
}

const loadPluginSources = async () => {
  loading.sources = true
  try {
    const result = await window.FBW.getPluginSources()
    if (result.success) {
      pluginSources.value = result.data || []
    } else {
      ElMessage.error(
        result.message || t('pages.Setting.pluginMarketplace.feedback.getSourcesFail')
      )
    }
  } catch (error) {
    console.error(t('pages.Setting.pluginMarketplace.feedback.getSourcesFail'), error)
    ElMessage.error(t('pages.Setting.pluginMarketplace.feedback.getSourcesFail'))
  } finally {
    loading.sources = false
  }
}

const loadSettingData = async () => {
  try {
    const result = await window.FBW.getSettingData()
    if (result.success) {
      settingData.value = result.data || {}
      settingStore.updateSettingData(settingData.value)
    }
  } catch (error) {
    console.error(t('pages.Setting.pluginMarketplace.feedback.getSettingFail'), error)
  }
}

const refreshResourceMap = async () => {
  try {
    const result = await window.FBW.getResourceMap()
    if (result.success && result.data) {
      commonStore.setResourceMap(result.data)
    }
  } catch (error) {
    console.error(error)
  }
}

const installPlugin = async (sourceName, pluginName) => {
  const actionKey = `${sourceName}:${pluginName}`
  actionLoading.installingKey = actionKey
  loading.installing = true
  try {
    const result = await window.FBW.installPlugin(sourceName, pluginName)
    if (result.success) {
      ElMessage.success(
        result.message || t('pages.Setting.pluginMarketplace.feedback.installSuccess')
      )
      await refreshResourceMap()
      await loadInstalledPlugins()
      await loadAvailablePlugins()
    } else {
      ElMessage.error(result.message || t('pages.Setting.pluginMarketplace.feedback.installFail'))
    }
  } catch (error) {
    console.error(t('pages.Setting.pluginMarketplace.feedback.installFail'), error)
    ElMessage.error(t('pages.Setting.pluginMarketplace.feedback.installFail'))
  } finally {
    loading.installing = false
    actionLoading.installingKey = ''
  }
}

const uninstallPlugin = async (sourceName, pluginName) => {
  try {
    await ElMessageBox.confirm(
      t('pages.Setting.pluginMarketplace.confirm.uninstallMessage', { pluginName }),
      t('pages.Setting.pluginMarketplace.confirm.uninstallTitle'),
      {
        type: 'warning',
        confirmButtonText: t('pages.Setting.pluginMarketplace.confirm.confirm'),
        cancelButtonText: t('pages.Setting.pluginMarketplace.confirm.cancel')
      }
    )
  } catch (error) {
    return
  }
  const actionKey = `${sourceName}:${pluginName}`
  actionLoading.uninstallingKey = actionKey
  loading.uninstalling = true
  try {
    const result = await window.FBW.uninstallPlugin(sourceName, pluginName)
    if (result.success) {
      ElMessage.success(
        result.message || t('pages.Setting.pluginMarketplace.feedback.uninstallSuccess')
      )
      await refreshResourceMap()
      await loadInstalledPlugins()
      await loadAvailablePlugins()
    } else {
      ElMessage.error(result.message || t('pages.Setting.pluginMarketplace.feedback.uninstallFail'))
    }
  } catch (error) {
    console.error(t('pages.Setting.pluginMarketplace.feedback.uninstallFail'), error)
    ElMessage.error(t('pages.Setting.pluginMarketplace.feedback.uninstallFail'))
  } finally {
    loading.uninstalling = false
    actionLoading.uninstallingKey = ''
  }
}

const updatePlugin = async (sourceName, pluginName) => {
  const actionKey = `${sourceName}:${pluginName}`
  actionLoading.updatingKey = actionKey
  loading.updating = true
  try {
    const result = await window.FBW.updatePlugin(sourceName, pluginName)
    if (result.success) {
      ElMessage.success(
        result.message || t('pages.Setting.pluginMarketplace.feedback.updateSuccess')
      )
      await refreshResourceMap()
      await loadInstalledPlugins()
      await loadAvailablePlugins()
    } else {
      ElMessage.error(result.message || t('pages.Setting.pluginMarketplace.feedback.updateFail'))
    }
  } catch (error) {
    console.error(t('pages.Setting.pluginMarketplace.feedback.updateFail'), error)
    ElMessage.error(t('pages.Setting.pluginMarketplace.feedback.updateFail'))
  } finally {
    loading.updating = false
    actionLoading.updatingKey = ''
  }
}

const isPluginInstalled = (plugin) => {
  const pluginKey = toPluginKey(plugin)
  return installedPlugins.value.some((item) => toPluginKey(item) === pluginKey)
}

const getPluginAvatarText = (plugin) =>
  (plugin.displayName || plugin.name || '?').trim().charAt(0).toUpperCase()
const isDetailExpanded = (plugin) => expandedPluginKeys.value[toPluginKey(plugin)] === true
const isInstalling = (plugin) => actionLoading.installingKey === toPluginKey(plugin)
const isUninstalling = (plugin) => actionLoading.uninstallingKey === toPluginKey(plugin)
const isUpdating = (plugin) => actionLoading.updatingKey === toPluginKey(plugin)
const togglePluginDetail = (plugin) => {
  const key = toPluginKey(plugin)
  expandedPluginKeys.value[key] = !expandedPluginKeys.value[key]
}
const hasSecretKey = (plugin) => Boolean(remoteResourceSecretKeys.value[toPluginKey(plugin)])

const configureSecretKey = async (plugin) => {
  const key = toPluginKey(plugin)
  const currentValue = remoteResourceSecretKeys.value[key] || ''
  try {
    const { value } = await ElMessageBox.prompt(
      t('pages.Setting.pluginMarketplace.secretKey.prompt', {
        pluginName: plugin.displayName || plugin.name
      }),
      t('pages.Setting.pluginMarketplace.secretKey.title'),
      {
        inputValue: currentValue,
        confirmButtonText: t('pages.Setting.pluginMarketplace.confirm.confirm'),
        cancelButtonText: t('pages.Setting.pluginMarketplace.confirm.cancel'),
        inputPlaceholder: t('pages.Setting.pluginMarketplace.secretKey.placeholder')
      }
    )
    const nextKeys = {
      ...remoteResourceSecretKeys.value,
      [key]: String(value || '').trim()
    }
    const res = await window.FBW.updateSettingData({ remoteResourceSecretKeys: nextKeys })
    if (res.success) {
      settingData.value = res.data || settingData.value
      settingStore.updateSettingData(settingData.value)
      ElMessage.success(t('pages.Setting.pluginMarketplace.secretKey.saveSuccess'))
    } else {
      ElMessage.error(res.message || t('pages.Setting.pluginMarketplace.secretKey.saveFail'))
    }
  } catch (error) {
    if (error !== 'cancel' && error !== 'close') {
      ElMessage.error(t('pages.Setting.pluginMarketplace.secretKey.saveFail'))
    }
  }
}

const sourceFormRules = {
  name: [
    {
      required: true,
      message: t('pages.Setting.pluginMarketplace.sourceForm.validation.nameRequired'),
      trigger: 'blur'
    },
    {
      pattern: /^[A-Za-z0-9_-]+$/,
      message: t('pages.Setting.pluginMarketplace.sourceForm.validation.namePattern'),
      trigger: 'blur'
    }
  ],
  location: [
    {
      required: true,
      message: t('pages.Setting.pluginMarketplace.sourceForm.validation.locationRequired'),
      trigger: 'blur'
    }
  ]
}

const openAddSourceDialog = () => {
  sourceForm.name = ''
  sourceForm.type = 'github'
  sourceForm.location = ''
  showAddSourceDialog.value = true
}

const selectLocalSourceFolder = async () => {
  try {
    const { canceled, filePaths } = await window.FBW.selectFolder()
    if (canceled) return
    sourceForm.location = filePaths?.[0] || ''
    sourceFormRef.value?.clearValidate?.('location')
  } catch (error) {
    console.error(t('pages.Setting.pluginMarketplace.feedback.selectLocalFolderFail'), error)
  }
}

const addPluginSource = async () => {
  if (!sourceFormRef.value) return
  await sourceFormRef.value.validate(async (valid) => {
    if (!valid) return
    loading.addSource = true
    try {
      const result = await window.FBW.addPluginSource({
        name: sourceForm.name,
        type: sourceForm.type,
        location: sourceForm.location
      })
      if (result.success) {
        ElMessage.success(
          result.message || t('pages.Setting.pluginMarketplace.feedback.addSourceSuccess')
        )
        showAddSourceDialog.value = false
        await loadPluginSources()
        await loadAvailablePlugins()
      } else {
        ElMessage.error(
          result.message || t('pages.Setting.pluginMarketplace.feedback.addSourceFail')
        )
      }
    } catch (error) {
      console.error(t('pages.Setting.pluginMarketplace.feedback.addSourceFail'), error)
      ElMessage.error(t('pages.Setting.pluginMarketplace.feedback.addSourceFail'))
    } finally {
      loading.addSource = false
    }
  })
}

const toggleSourceEnabled = async (source) => {
  const result = await window.FBW.updatePluginSource(source.name, { enabled: source.enabled })
  if (!result.success) {
    ElMessage.error(
      result.message || t('pages.Setting.pluginMarketplace.feedback.updateSourceFail')
    )
  }
}

const renamePluginSource = async (source) => {
  try {
    const { value } = await ElMessageBox.prompt(
      t('pages.Setting.pluginMarketplace.sources.renamePrompt'),
      t('pages.Setting.pluginMarketplace.sources.renameTitle'),
      {
        inputValue: source.name,
        confirmButtonText: t('pages.Setting.pluginMarketplace.confirm.confirm'),
        cancelButtonText: t('pages.Setting.pluginMarketplace.confirm.cancel'),
        inputPattern: /^[A-Za-z0-9_-]+$/,
        inputErrorMessage: t('pages.Setting.pluginMarketplace.sourceForm.validation.namePattern')
      }
    )
    const nextName = String(value || '').trim()
    if (!nextName || nextName === source.name) return
    const result = await window.FBW.updatePluginSource(source.name, { name: nextName })
    if (result.success) {
      ElMessage.success(
        result.message || t('pages.Setting.pluginMarketplace.feedback.updateSourceSuccess')
      )
      await loadPluginSources()
      await loadAvailablePlugins()
    } else {
      ElMessage.error(
        result.message || t('pages.Setting.pluginMarketplace.feedback.updateSourceFail')
      )
    }
  } catch (error) {
    if (error !== 'cancel' && error !== 'close') {
      ElMessage.error(t('pages.Setting.pluginMarketplace.feedback.updateSourceFail'))
    }
  }
}

const removePluginSource = async (sourceName) => {
  try {
    await ElMessageBox.confirm(
      t('pages.Setting.pluginMarketplace.confirm.removeSourceMessage', { sourceName }),
      t('pages.Setting.pluginMarketplace.confirm.removeSourceTitle'),
      {
        type: 'warning',
        confirmButtonText: t('pages.Setting.pluginMarketplace.confirm.confirm'),
        cancelButtonText: t('pages.Setting.pluginMarketplace.confirm.cancel')
      }
    )
  } catch (error) {
    return
  }
  const result = await window.FBW.removePluginSource(sourceName)
  if (result.success) {
    ElMessage.success(
      result.message || t('pages.Setting.pluginMarketplace.feedback.removeSourceSuccess')
    )
    await loadPluginSources()
    await loadAvailablePlugins()
  } else {
    ElMessage.error(
      result.message || t('pages.Setting.pluginMarketplace.feedback.removeSourceFail')
    )
  }
}

onMounted(() => {
  loadSettingData()
  loadAvailablePlugins()
  loadInstalledPlugins()
  loadPluginSources()
})

watch(
  () => activeTab.value,
  (tab) => {
    if (tab === 'marketplace') {
      loadAvailablePlugins()
    } else if (tab === 'installed') {
      loadInstalledPlugins()
    } else if (tab === 'sources') {
      loadPluginSources()
    }
  }
)

defineExpose({
  resetForm: () => {
    marketplaceSearchQuery.value = ''
    installedSearchQuery.value = ''
  }
})
</script>

<template>
  <div class="plugin-marketplace-wrapper">
    <div class="plugin-marketplace">
      <el-tabs v-model="activeTab">
        <el-tab-pane
          :label="t('pages.Setting.pluginMarketplace.tabs.marketplace')"
          name="marketplace"
        >
          <div class="marketplace-content">
            <div class="search-box">
              <el-input
                v-model="marketplaceSearchQuery"
                :placeholder="t('pages.Setting.pluginMarketplace.searchPlaceholder')"
                clearable
                style="width: 400px"
              >
                <template #prefix>
                  <IconifyIcon icon="custom:search" />
                </template>
              </el-input>
              <div class="toolbar-actions">
                <el-button
                  type="primary"
                  :loading="loading.available"
                  @click="loadAvailablePlugins"
                >
                  <IconifyIcon icon="custom:refresh" />
                  {{ t('pages.Setting.pluginMarketplace.refresh') }}
                </el-button>
              </div>
            </div>
            <div class="tab-scroll-wrap" v-loading="loading.available">
              <div class="tab-scroll-content">
                <el-empty v-if="!loading.available && filteredAvailablePlugins.length === 0" />
                <div v-else class="plugin-grid">
                  <div
                    v-for="plugin in filteredAvailablePlugins"
                    :key="toPluginKey(plugin)"
                    class="plugin-card"
                  >
                    <div class="plugin-header">
                      <div class="plugin-icon">
                        <img
                          v-if="plugin.logoUrl"
                          :src="plugin.logoUrl"
                          class="plugin-logo"
                          :alt="plugin.displayName || plugin.name"
                        />
                        <span v-else>{{ getPluginAvatarText(plugin) }}</span>
                      </div>
                      <div class="plugin-title">
                        <h3>{{ plugin.displayName || plugin.name }}</h3>
                        <div class="plugin-meta-line">
                          <div class="plugin-meta-main">
                            <el-tag size="small">{{ plugin.sourceName }}</el-tag>
                            <span class="plugin-version">v{{ plugin.version }}</span>
                            <el-button
                              v-if="plugin.site"
                              link
                              class="inline-link-btn"
                              @click="window.FBW.openUrl(plugin.site)"
                            >
                              <IconifyIcon icon="custom:link" />
                              {{ t('pages.Setting.pluginMarketplace.website') }}
                            </el-button>
                            <el-tag v-if="isPluginInstalled(plugin)" type="success" size="small">
                              {{ t('pages.Setting.pluginMarketplace.installed') }}
                            </el-tag>
                            <el-button link circle @click="togglePluginDetail(plugin)">
                              <IconifyIcon
                                class="detail-toggle-icon"
                                :class="{ 'is-expanded': isDetailExpanded(plugin) }"
                                icon="custom:arrow-right"
                              />
                            </el-button>
                          </div>
                          <div class="plugin-meta-actions">
                            <el-button
                              v-if="!isPluginInstalled(plugin)"
                              type="primary"
                              :disabled="!plugin.compatible"
                              :loading="isInstalling(plugin)"
                              @click="installPlugin(plugin.sourceName, plugin.name)"
                            >
                              <IconifyIcon icon="custom:download" />
                              {{ t('pages.Setting.pluginMarketplace.install') }}
                            </el-button>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div class="plugin-body">
                      <p class="plugin-description">{{ plugin.description }}</p>
                      <div class="plugin-meta">
                        <el-tag v-if="!plugin.compatible" type="danger" size="small">
                          {{ t('pages.Setting.pluginMarketplace.incompatible') }}
                        </el-tag>
                      </div>
                    </div>
                    <div v-show="isDetailExpanded(plugin)" class="plugin-detail-panel">
                      <div class="detail-item">
                        <span>{{ t('pages.Setting.pluginMarketplace.supportSearch') }}</span>
                        <el-tag :type="plugin.supportSearch ? 'success' : 'info'" size="small">
                          {{
                            plugin.supportSearch
                              ? t('pages.Setting.pluginMarketplace.yes')
                              : t('pages.Setting.pluginMarketplace.no')
                          }}
                        </el-tag>
                      </div>
                      <div class="detail-item">
                        <span>{{ t('pages.Setting.pluginMarketplace.supportDownload') }}</span>
                        <el-tag :type="plugin.supportDownload ? 'success' : 'info'" size="small">
                          {{
                            plugin.supportDownload
                              ? t('pages.Setting.pluginMarketplace.yes')
                              : t('pages.Setting.pluginMarketplace.no')
                          }}
                        </el-tag>
                      </div>
                      <div class="detail-item">
                        <span>{{ t('pages.Setting.pluginMarketplace.appVersion') }}</span>
                        <span
                          >{{ plugin.appVersion?.min || '*' }} -
                          {{ plugin.appVersion?.max || '*' }}</span
                        >
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </el-tab-pane>

        <el-tab-pane :label="t('pages.Setting.pluginMarketplace.tabs.installed')" name="installed">
          <div class="installed-content">
            <div class="search-box">
              <el-input
                v-model="installedSearchQuery"
                :placeholder="t('pages.Setting.pluginMarketplace.searchInstalledPlaceholder')"
                clearable
                style="width: 400px"
              >
                <template #prefix>
                  <IconifyIcon icon="custom:search" />
                </template>
              </el-input>
              <div class="toolbar-actions">
                <el-button
                  type="primary"
                  :loading="loading.installed"
                  @click="loadInstalledPlugins"
                >
                  <IconifyIcon icon="custom:refresh" />
                  {{ t('pages.Setting.pluginMarketplace.refresh') }}
                </el-button>
              </div>
            </div>
            <div class="tab-scroll-wrap" v-loading="loading.installed">
              <div class="tab-scroll-content">
                <el-empty v-if="!loading.installed && filteredInstalledPlugins.length === 0" />
                <div v-else class="plugin-grid">
                  <div
                    v-for="plugin in filteredInstalledPlugins"
                    :key="toPluginKey(plugin)"
                    class="plugin-card"
                  >
                    <div class="plugin-header">
                      <div class="plugin-icon">
                        <img
                          v-if="plugin.logoUrl"
                          :src="plugin.logoUrl"
                          class="plugin-logo"
                          :alt="plugin.displayName || plugin.name"
                        />
                        <span v-else>{{ getPluginAvatarText(plugin) }}</span>
                      </div>
                      <div class="plugin-title">
                        <h3>{{ plugin.displayName || plugin.name }}</h3>
                        <div class="plugin-meta-line">
                          <div class="plugin-meta-main">
                            <el-tag size="small">{{ plugin.sourceName }}</el-tag>
                            <span class="plugin-version">v{{ plugin.version }}</span>
                            <el-button
                              v-if="plugin.site"
                              link
                              class="inline-link-btn"
                              @click="window.FBW.openUrl(plugin.site)"
                            >
                              <IconifyIcon icon="custom:link" />
                              {{ t('pages.Setting.pluginMarketplace.website') }}
                            </el-button>
                            <el-tag type="success" size="small">
                              {{ t('pages.Setting.pluginMarketplace.installed') }}
                            </el-tag>
                            <el-button link circle @click="togglePluginDetail(plugin)">
                              <IconifyIcon
                                class="detail-toggle-icon"
                                :class="{ 'is-expanded': isDetailExpanded(plugin) }"
                                icon="custom:arrow-right"
                              />
                            </el-button>
                          </div>
                          <div class="plugin-meta-actions">
                            <el-button
                              v-if="plugin.requireSecretKey"
                              type="warning"
                              plain
                              @click="configureSecretKey(plugin)"
                            >
                              <IconifyIcon icon="custom:key" />
                              {{ t('pages.Setting.pluginMarketplace.secretKey.config') }}
                            </el-button>
                            <el-button
                              type="primary"
                              :loading="isUpdating(plugin)"
                              @click="updatePlugin(plugin.sourceName, plugin.name)"
                            >
                              <IconifyIcon icon="custom:refresh" />
                              {{ t('pages.Setting.pluginMarketplace.update') }}
                            </el-button>
                            <el-button
                              type="danger"
                              :loading="isUninstalling(plugin)"
                              @click="uninstallPlugin(plugin.sourceName, plugin.name)"
                            >
                              <IconifyIcon icon="custom:delete" />
                              {{ t('pages.Setting.pluginMarketplace.uninstall') }}
                            </el-button>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div class="plugin-body">
                      <p class="plugin-description">{{ plugin.description }}</p>
                      <div class="plugin-meta">
                        <el-tag
                          v-if="plugin.requireSecretKey && !hasSecretKey(plugin)"
                          type="warning"
                          size="small"
                        >
                          {{ t('pages.Setting.pluginMarketplace.secretKey.missing') }}
                        </el-tag>
                      </div>
                    </div>
                    <div v-show="isDetailExpanded(plugin)" class="plugin-detail-panel">
                      <div class="detail-item">
                        <span>{{ t('pages.Setting.pluginMarketplace.supportSearch') }}</span>
                        <el-tag :type="plugin.supportSearch ? 'success' : 'info'" size="small">
                          {{
                            plugin.supportSearch
                              ? t('pages.Setting.pluginMarketplace.yes')
                              : t('pages.Setting.pluginMarketplace.no')
                          }}
                        </el-tag>
                      </div>
                      <div class="detail-item">
                        <span>{{ t('pages.Setting.pluginMarketplace.supportDownload') }}</span>
                        <el-tag :type="plugin.supportDownload ? 'success' : 'info'" size="small">
                          {{
                            plugin.supportDownload
                              ? t('pages.Setting.pluginMarketplace.yes')
                              : t('pages.Setting.pluginMarketplace.no')
                          }}
                        </el-tag>
                      </div>
                      <div class="detail-item">
                        <span>{{ t('pages.Setting.pluginMarketplace.appVersion') }}</span>
                        <span
                          >{{ plugin.appVersion?.min || '*' }} -
                          {{ plugin.appVersion?.max || '*' }}</span
                        >
                      </div>
                      <div class="detail-item">
                        <span>{{ t('pages.Setting.pluginMarketplace.secretKey.status') }}</span>
                        <el-tag
                          v-if="plugin.requireSecretKey"
                          :type="hasSecretKey(plugin) ? 'success' : 'warning'"
                          size="small"
                        >
                          {{
                            hasSecretKey(plugin)
                              ? t('pages.Setting.pluginMarketplace.secretKey.configured')
                              : t('pages.Setting.pluginMarketplace.secretKey.missing')
                          }}
                        </el-tag>
                        <el-tag v-else type="info" size="small">{{
                          t('pages.Setting.pluginMarketplace.secretKey.notRequired')
                        }}</el-tag>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </el-tab-pane>
        <el-tab-pane :label="t('pages.Setting.pluginMarketplace.tabs.sources')" name="sources">
          <div class="sources-content">
            <div class="search-box">
              <div class="toolbar-actions">
                <el-button type="primary" @click="openAddSourceDialog">
                  {{ t('pages.Setting.pluginMarketplace.sources.addSource') }}
                </el-button>
                <el-button type="primary" :loading="loading.sources" @click="loadPluginSources">
                  <IconifyIcon icon="custom:refresh" />
                  {{ t('pages.Setting.pluginMarketplace.sources.refreshSources') }}
                </el-button>
              </div>
            </div>
            <div class="tab-scroll-wrap" v-loading="loading.sources">
              <div class="tab-scroll-content">
                <div
                  v-for="source in pluginSources"
                  :key="source.id"
                  class="installed-plugin-item source-item"
                >
                  <div class="plugin-details">
                    <div class="source-header">
                      <h3>{{ source.name }}</h3>
                      <el-tag size="small" effect="plain">{{ source.type.toUpperCase() }}</el-tag>
                      <el-tag v-if="source.isOfficial" type="success" size="small">
                        {{ t('pages.Setting.pluginMarketplace.sources.official') }}
                      </el-tag>
                    </div>
                    <p class="plugin-description source-location">{{ source.location }}</p>
                  </div>
                  <div v-if="!source.isOfficial" class="plugin-actions">
                    <el-switch v-model="source.enabled" @change="toggleSourceEnabled(source)" />
                    <el-button type="primary" @click="renamePluginSource(source)">
                      {{ t('pages.Setting.pluginMarketplace.sources.renameSource') }}
                    </el-button>
                    <el-button type="danger" @click="removePluginSource(source.name)">
                      {{ t('pages.Setting.pluginMarketplace.sources.deleteSource') }}
                    </el-button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </el-tab-pane>
      </el-tabs>
    </div>

    <el-dialog
      v-model="showAddSourceDialog"
      :title="t('pages.Setting.pluginMarketplace.sourceForm.title')"
      width="650px"
    >
      <el-form ref="sourceFormRef" :model="sourceForm" :rules="sourceFormRules" label-width="90px">
        <el-form-item :label="t('pages.Setting.pluginMarketplace.sourceForm.name')" prop="name">
          <el-input
            v-model="sourceForm.name"
            :placeholder="t('pages.Setting.pluginMarketplace.sourceForm.namePlaceholder')"
          />
        </el-form-item>
        <el-form-item :label="t('pages.Setting.pluginMarketplace.sourceForm.type')" prop="type">
          <el-radio-group v-model="sourceForm.type">
            <el-radio label="github">GitHub</el-radio>
            <el-radio label="local">{{
              t('pages.Setting.pluginMarketplace.sourceForm.local')
            }}</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item
          :label="
            sourceForm.type === 'github'
              ? t('pages.Setting.pluginMarketplace.sourceForm.githubLocation')
              : t('pages.Setting.pluginMarketplace.sourceForm.localLocation')
          "
          prop="location"
        >
          <el-input
            v-if="sourceForm.type === 'github'"
            v-model="sourceForm.location"
            :placeholder="t('pages.Setting.pluginMarketplace.sourceForm.githubPlaceholder')"
          />
          <el-input
            v-else
            v-model="sourceForm.location"
            readonly
            :placeholder="t('pages.Setting.pluginMarketplace.sourceForm.localPlaceholder')"
          >
            <template #append>
              <el-button @click="selectLocalSourceFolder">
                <IconifyIcon icon="custom:folder-opened" />
              </el-button>
            </template>
          </el-input>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showAddSourceDialog = false">{{
          t('pages.Setting.pluginMarketplace.sourceForm.cancel')
        }}</el-button>
        <el-button type="primary" :loading="loading.addSource" @click="addPluginSource">{{
          t('pages.Setting.pluginMarketplace.sourceForm.confirm')
        }}</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped lang="scss">
.plugin-marketplace-wrapper {
  height: calc(100vh - 110px);
  position: relative;
}

.plugin-marketplace {
  height: 100%;
  background-color: #ffffff;
  border-radius: 6px;
  padding: 20px;
}

:deep(.el-tabs) {
  height: 100%;
  display: flex;
  flex-direction: column;
}

:deep(.el-tabs__header) {
  flex-shrink: 0;
}

:deep(.el-tabs__content) {
  flex: 1;
  min-height: 0;
}

:deep(.el-tab-pane) {
  height: 100%;
}

.marketplace-content,
.installed-content,
.sources-content {
  height: 100%;
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.search-box {
  display: flex;
  align-items: center;
  margin-bottom: 20px;
  flex-shrink: 0;
  gap: 10px;
}

.toolbar-actions {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: 10px;
}

.tab-scroll-wrap {
  flex: 1;
  min-height: 0;
  overflow: hidden;
  position: relative;
}

.tab-scroll-content {
  height: 100%;
  overflow-y: auto;
  padding: 10px 14px 10px 0;
}

.plugin-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 20px;
  min-height: 200px;
}

.plugin-card {
  border: 1px solid var(--el-border-color);
  border-radius: 8px;
  padding: 20px;
  transition: all 0.3s;

  &:hover {
    box-shadow: 0 2px 12px rgba(0, 0, 0, 0.1);
    transform: translateY(-2px);
  }
}

.plugin-header {
  display: flex;
  align-items: center;
  margin-bottom: 15px;
}

.plugin-icon {
  width: 48px;
  height: 48px;
  border-radius: 8px;
  background: linear-gradient(135deg, var(--el-color-primary), var(--el-color-success));
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-size: 20px;
  margin-right: 15px;
  overflow: hidden;
}

.plugin-logo {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.plugin-title {
  flex: 1;

  h3 {
    margin: 0 0 5px 0;
    font-size: 16px;
    font-weight: 600;
  }
}

.plugin-meta-line {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.plugin-meta-main {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.plugin-meta-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  justify-content: flex-end;
  margin-left: auto;
}

.plugin-version {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.plugin-body {
  margin-bottom: 15px;
}

.plugin-description {
  margin: 0 0 10px 0;
  font-size: 14px;
  color: var(--el-text-color-regular);
  line-height: 1.5;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.plugin-meta {
  display: flex;
  align-items: center;
  gap: 10px;
}

.inline-link-btn {
  padding: 0;
}

.detail-toggle-icon {
  transition: transform 0.2s ease;
}

.detail-toggle-icon.is-expanded {
  transform: rotate(90deg);
}

.plugin-list {
  display: flex;
  flex-direction: column;
  gap: 15px;
}

.installed-plugin-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px;
  border: 1px solid var(--el-border-color);
  border-radius: 8px;
  transition: all 0.3s;

  &:hover {
    box-shadow: 0 2px 12px rgba(0, 0, 0, 0.1);
    transform: translateY(-2px);
  }
}

.plugin-details {
  flex: 1;
  h3 {
    margin: 0;
  }
}

.plugin-actions {
  display: flex;
  gap: 10px;
}

.source-item {
  align-items: flex-start;
}

.source-item + .source-item {
  margin-top: 20px;
}

.source-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
}

.source-location {
  margin-bottom: 6px;
  word-break: break-all;
}

.source-item .plugin-actions {
  min-width: 260px;
  justify-content: flex-end;
  align-items: center;
}

.plugin-detail-panel {
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px dashed var(--el-border-color);
}

.detail-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 8px;

  &:last-child {
    margin-bottom: 0;
  }
}
</style>
