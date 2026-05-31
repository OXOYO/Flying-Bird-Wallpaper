<script setup>
import { useTranslation } from 'i18next-vue'
import UseSettingStore from '@renderer/stores/settingStore.js'
import UseCommonStore from '@renderer/stores/commonStore.js'
import {
  API_ERROR_CODE,
  hasRemoteSecretKey,
  normalizeRemoteSecretKey,
  PLUGIN_APP_VERSION_MIN,
  resolveApiUserMessage
} from '@common/utils.js'
import {
  buildCompositeId,
  SOURCE_NAME_MAX_LEN,
  getSourceNameLength,
  validateSourceName
} from '@common/pluginResourceId.js'

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
/** 由主进程返回的结构化加载提示，在渲染层按当前语言拼接 */
const marketplaceLoadNotice = ref(null)

const formatPluginLoadMessage = (message) => {
  if (!message) return ''
  return String(message)
    .replace(/\s*\|\s*url:\s*https?:\/\/\S+/gi, '')
    .replace(/\bhttps?:\/\/\S+/gi, '')
    .trim()
}

const formatSourceLoadErrorItem = (item) => {
  const hint = t(`pages.Setting.pluginMarketplace.loadErrors.${item.hintKey}`)
  return t('pages.Setting.pluginMarketplace.loadErrors.sourceItem', {
    sourceName: item.sourceName,
    hint
  })
}

const formatSourceLoadSummaries = (notice) => {
  if (!Array.isArray(notice?.summaries) || notice.summaries.length === 0) {
    return ''
  }
  const sep = t('pages.Setting.pluginMarketplace.loadErrors.errorsSeparator')
  return notice.summaries
    .map((item) =>
      t('pages.Setting.pluginMarketplace.loadErrors.sourceAllIncompatible', {
        sourceName: item.sourceName,
        total: item.scanned,
        incompatible: item.incompatible
      })
    )
    .join(sep)
}

const buildMarketplaceLoadAlertMessage = (notice) => {
  if (!notice) return ''
  const summaries = formatSourceLoadSummaries(notice)
  const errors =
    Array.isArray(notice.errors) && notice.errors.length > 0
      ? notice.errors.map(formatSourceLoadErrorItem).join(
          t('pages.Setting.pluginMarketplace.loadErrors.errorsSeparator')
        )
      : ''

  if (errors || summaries) {
    const key = `pages.Setting.pluginMarketplace.loadErrors.${notice.kind}`
    const message = t(key, {
      errors: [errors, summaries].filter(Boolean).join(
        t('pages.Setting.pluginMarketplace.loadErrors.errorsSeparator')
      ),
      summaries,
      appVersion: notice.appVersion || '',
      minVersion: PLUGIN_APP_VERSION_MIN
    })
    if (message && message !== key) return message
    return [errors, summaries].filter(Boolean).join(
      t('pages.Setting.pluginMarketplace.loadErrors.errorsSeparator')
    )
  }

  if (notice.errorMessage) {
    const key = `pages.Setting.pluginMarketplace.loadErrors.${notice.kind}`
    const message = t(key, {
      error: formatPluginLoadMessage(notice.errorMessage)
    })
    if (message && message !== key) return message
    return formatPluginLoadMessage(notice.errorMessage)
  }

  return ''
}

const marketplaceLoadAlertMessage = computed(() => {
  const message = buildMarketplaceLoadAlertMessage(marketplaceLoadNotice.value)
  if (message) return message
  if (marketplaceLoadNotice.value) {
    return t('pages.Setting.pluginMarketplace.loadAlert.fallbackBody')
  }
  return ''
})

const marketplaceLoadAlertVisible = computed(
  () => marketplaceLoadNotice.value != null
)

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

const toPluginKey = (plugin) =>
  plugin.pluginKey || buildCompositeId(plugin.sourceName, plugin.name)

const dismissMarketplaceLoadAlert = () => {
  marketplaceLoadNotice.value = null
}

let availablePluginsLoadSeq = 0

const loadAvailablePlugins = async () => {
  const loadSeq = ++availablePluginsLoadSeq
  loading.available = true
  try {
    const result = await window.FBW.getAvailablePlugins()
    if (loadSeq !== availablePluginsLoadSeq) {
      return
    }
    if (result.success) {
      availablePlugins.value = result.data || []
      marketplaceLoadNotice.value = result.loadNotice || null
    } else {
      marketplaceLoadNotice.value = result.loadNotice || null
      if (!marketplaceLoadNotice.value) {
        ElMessage.error(
          formatPluginLoadMessage(result.message) ||
            t('pages.Setting.pluginMarketplace.feedback.getAvailableFail')
        )
      }
    }
  } catch (error) {
    if (loadSeq !== availablePluginsLoadSeq) {
      return
    }
    console.error(t('pages.Setting.pluginMarketplace.feedback.getAvailableFail'), error)
    ElMessage.error(t('pages.Setting.pluginMarketplace.feedback.getAvailableFail'))
  } finally {
    if (loadSeq === availablePluginsLoadSeq) {
      loading.available = false
    }
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

/** 已安装页刷新：同步市场列表（更新状态）与已安装列表 */
const refreshInstalledTab = () => {
  loadAvailablePlugins()
  loadInstalledPlugins()
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

const compareVersions = (version1, version2) => {
  const v1 = String(version1 || '0')
    .split('.')
    .map((n) => Number(n) || 0)
  const v2 = String(version2 || '0')
    .split('.')
    .map((n) => Number(n) || 0)
  for (let i = 0; i < Math.max(v1.length, v2.length); i++) {
    const num1 = v1[i] || 0
    const num2 = v2[i] || 0
    if (num1 > num2) return 1
    if (num1 < num2) return -1
  }
  return 0
}

const findInstalledPlugin = (pluginKey) =>
  installedPlugins.value.find((item) => toPluginKey(item) === pluginKey)

const findAvailablePlugin = (pluginKey) =>
  availablePlugins.value.find((item) => toPluginKey(item) === pluginKey)

/** 插件源中存在比已安装更高的版本时，才视为可更新 */
const hasPluginUpdate = (plugin) => {
  const pluginKey = toPluginKey(plugin)
  const installed = findInstalledPlugin(pluginKey)
  if (!installed?.version) return false
  const available = findAvailablePlugin(pluginKey)
  if (!available?.version) return false
  return compareVersions(available.version, installed.version) > 0
}

const isPluginInstalled = (plugin) => {
  const pluginKey = toPluginKey(plugin)
  return Boolean(findInstalledPlugin(pluginKey))
}

const getUpdateVersionLabel = (plugin) => {
  const pluginKey = toPluginKey(plugin)
  const installed = findInstalledPlugin(pluginKey)
  const available = findAvailablePlugin(pluginKey)
  if (!installed?.version || !available?.version) return ''
  return t('pages.Setting.pluginMarketplace.updateVersionLabel', {
    current: installed.version,
    latest: available.version
  })
}

const confirmUpdatePlugin = async (plugin) => {
  const pluginKey = toPluginKey(plugin)
  const installed = findInstalledPlugin(pluginKey) || plugin
  const available = findAvailablePlugin(pluginKey)
  if (!available?.version) return
  try {
    await ElMessageBox.confirm(
      t('pages.Setting.pluginMarketplace.confirm.updateMessage', {
        pluginName: plugin.displayName || plugin.name,
        currentVersion: installed.version || '?',
        latestVersion: available.version
      }),
      t('pages.Setting.pluginMarketplace.confirm.updateTitle'),
      {
        type: 'warning',
        confirmButtonText: t('pages.Setting.pluginMarketplace.confirm.confirm'),
        cancelButtonText: t('pages.Setting.pluginMarketplace.confirm.cancel')
      }
    )
  } catch {
    return
  }
  await updatePlugin(plugin.sourceName, plugin.name)
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
const hasSecretKey = (plugin) =>
  hasRemoteSecretKey(toPluginKey(plugin), remoteResourceSecretKeys.value)

const hasPluginSummaryContent = (plugin) => {
  if (Boolean(String(plugin.description || '').trim())) return true
  if (plugin.compatible === false) return true
  if (plugin.requireSecretKey && !hasSecretKey(plugin)) return true
  return false
}

const getSecretKeyPlaceholder = (plugin) => {
  const hintKey = `pages.Setting.pluginMarketplace.secretKey.hint.${plugin.name}`
  const hint = t(hintKey)
  return hint !== hintKey ? hint : t('pages.Setting.pluginMarketplace.secretKey.placeholder')
}

const configureSecretKey = async (plugin) => {
  const key = toPluginKey(plugin)
  const currentValue =
    remoteResourceSecretKeys.value[key] ||
    remoteResourceSecretKeys.value[plugin.name] ||
    ''
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
        inputPlaceholder: getSecretKeyPlaceholder(plugin)
      }
    )
    const normalized = normalizeRemoteSecretKey(key, value)
    const nextKeys = {
      ...remoteResourceSecretKeys.value,
      [key]: normalized
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

const validateSourceNameField = (_rule, value, callback) => {
  const check = validateSourceName(value)
  if (!check.valid) {
    callback(new Error(t('pages.Setting.pluginMarketplace.sourceForm.validation.namePattern')))
    return
  }
  callback()
}

const sourceFormRules = {
  name: [
    {
      required: true,
      message: t('pages.Setting.pluginMarketplace.sourceForm.validation.nameRequired'),
      trigger: 'blur'
    },
    { validator: validateSourceNameField, trigger: 'blur' }
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

const normalizeGithubRepo = (location) => {
  if (!location) return null
  const str = String(location).trim().replace(/\.git$/, '')
  const sshMatch = str.match(/^git@github\.com:([^/]+)\/([^/]+)$/i)
  if (sshMatch) return `${sshMatch[1]}/${sshMatch[2]}`
  const httpsMatch = str.match(/^https?:\/\/github\.com\/([^/]+)\/([^/]+)$/i)
  if (httpsMatch) return `${httpsMatch[1]}/${httpsMatch[2]}`
  const shortMatch = str.match(/^([^/]+)\/([^/]+)$/)
  if (shortMatch) return `${shortMatch[1]}/${shortMatch[2]}`
  return null
}

const getGithubRepoUrl = (location) => {
  const repo = normalizeGithubRepo(location)
  return repo ? `https://github.com/${repo}` : ''
}

const canOpenPluginSourceLocation = (source) => {
  if (!source?.location) return false
  if (source.type === 'github') return Boolean(getGithubRepoUrl(source.location))
  if (source.type === 'local') return Boolean(String(source.location).trim())
  return false
}

const getPluginSourceLocationTitle = (source) => {
  if (source.type === 'github') {
    return t('pages.Setting.pluginMarketplace.sources.openGithub')
  }
  if (source.type === 'local') {
    return t('pages.Setting.pluginMarketplace.sources.openLocal')
  }
  return ''
}

const openPluginSourceLocation = async (source) => {
  if (!canOpenPluginSourceLocation(source)) return
  try {
    if (source.type === 'github') {
      const url = getGithubRepoUrl(source.location)
      await window.FBW.openUrl(url)
      return
    }
    if (source.type === 'local') {
      const location = String(source.location).trim()
      const opener = window.FBW.openPath || window.FBW.openDir
      if (typeof opener !== 'function') {
        ElMessage.error(t('pages.Setting.pluginMarketplace.sources.openLocalFail'))
        return
      }
      const result = await opener(location)
      if (result?.success === false) {
        if (result.errorCode === API_ERROR_CODE.OPEN_DIR_NOT_FOUND) {
          ElMessage.error(
            t('pages.Setting.pluginMarketplace.sources.openLocalNotFound', { path: location })
          )
        } else {
          ElMessage.error(
            resolveApiUserMessage(result, t) ||
              t('pages.Setting.pluginMarketplace.sources.openLocalFail')
          )
        }
      }
    }
  } catch (error) {
    console.error(error)
    const isMissingHandler = /no handler registered/i.test(String(error?.message || error))
    if (source.type === 'local' && isMissingHandler) {
      ElMessage.error(t('pages.Setting.pluginMarketplace.sources.openLocalNeedRestart'))
      return
    }
    ElMessage.error(
      source.type === 'github'
        ? t('pages.Setting.pluginMarketplace.sources.openGithubFail')
        : t('pages.Setting.pluginMarketplace.sources.openLocalFail')
    )
  }
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
        inputValidator: (val) => {
          const check = validateSourceName(val)
          if (!check.valid) {
            return t('pages.Setting.pluginMarketplace.sourceForm.validation.namePattern')
          }
          return true
        }
      }
    )
    const nextName = String(value || '').trim()
    if (!nextName || nextName === source.name) return
    if (getSourceNameLength(nextName) > SOURCE_NAME_MAX_LEN) {
      ElMessage.error(t('pages.Setting.pluginMarketplace.sourceForm.validation.namePattern'))
      return
    }
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
    if (tab === 'marketplace' || tab === 'installed') {
      loadAvailablePlugins()
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
  },
  refresh: () => {
    loadAvailablePlugins()
    loadInstalledPlugins()
    loadPluginSources()
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
            <el-alert
              v-if="marketplaceLoadAlertVisible"
              class="marketplace-load-alert"
              type="warning"
              :title="t('pages.Setting.pluginMarketplace.loadAlert.title')"
              show-icon
              closable
              @close="dismissMarketplaceLoadAlert"
            >
              <p class="marketplace-load-alert__text">
                {{ marketplaceLoadAlertMessage }}
              </p>
            </el-alert>
            <div class="tab-panel-body" v-loading="loading.available">
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
                <el-button @click="loadAvailablePlugins">
                  <template #icon>
                    <IconifyIcon icon="custom:refresh-right" />
                  </template>
                  {{ t('pages.Setting.pluginMarketplace.refresh') }}
                </el-button>
              </div>
            </div>
            <div class="tab-scroll-wrap">
              <el-scrollbar class="tab-scrollbar">
                <div class="tab-scroll-content">
                <el-empty v-if="!loading.available && filteredAvailablePlugins.length === 0" />
                <div v-else-if="filteredAvailablePlugins.length > 0" class="plugin-grid">
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
                            <el-tag
                              v-if="hasPluginUpdate(plugin)"
                              type="warning"
                              size="small"
                              class="plugin-version-update"
                            >
                              {{ getUpdateVersionLabel(plugin) }}
                            </el-tag>
                            <span v-else class="plugin-version">v{{ plugin.version }}</span>
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
                              <template #icon>
                                <IconifyIcon icon="custom:download-line" />
                              </template>
                              {{ t('pages.Setting.pluginMarketplace.install') }}
                            </el-button>
                            <el-button
                              v-else-if="hasPluginUpdate(plugin)"
                              type="success"
                              :loading="isUpdating(plugin)"
                              @click="confirmUpdatePlugin(plugin)"
                            >
                              <template #icon>
                                <IconifyIcon icon="custom:refresh-right" />
                              </template>
                              {{ t('pages.Setting.pluginMarketplace.update') }}
                            </el-button>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div v-if="hasPluginSummaryContent(plugin)" class="plugin-body">
                      <p v-if="plugin.description" class="plugin-description">
                        {{ plugin.description }}
                      </p>
                      <div v-if="!plugin.compatible" class="plugin-meta">
                        <el-tag type="danger" size="small">
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
              </el-scrollbar>
            </div>
            </div>
          </div>
        </el-tab-pane>

        <el-tab-pane :label="t('pages.Setting.pluginMarketplace.tabs.installed')" name="installed">
          <div class="installed-content">
            <div
              class="tab-panel-body"
              v-loading="loading.installed || loading.available"
            >
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
                <el-button @click="refreshInstalledTab">
                  <template #icon>
                    <IconifyIcon icon="custom:refresh-right" />
                  </template>
                  {{ t('pages.Setting.pluginMarketplace.refresh') }}
                </el-button>
              </div>
            </div>
            <div class="tab-scroll-wrap">
              <el-scrollbar class="tab-scrollbar">
                <div class="tab-scroll-content">
                <el-empty
                  v-if="
                    !loading.installed &&
                    !loading.available &&
                    filteredInstalledPlugins.length === 0
                  "
                />
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
                            <el-tag
                              v-if="hasPluginUpdate(plugin)"
                              type="warning"
                              size="small"
                              class="plugin-version-update"
                            >
                              {{ getUpdateVersionLabel(plugin) }}
                            </el-tag>
                            <span v-else class="plugin-version">v{{ plugin.version }}</span>
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
                              {{ t('pages.Setting.pluginMarketplace.secretKey.config') }}
                            </el-button>
                            <el-button
                              v-if="hasPluginUpdate(plugin)"
                              type="success"
                              :loading="isUpdating(plugin)"
                              @click="confirmUpdatePlugin(plugin)"
                            >
                              <template #icon>
                                <IconifyIcon icon="custom:refresh-right" />
                              </template>
                              {{ t('pages.Setting.pluginMarketplace.update') }}
                            </el-button>
                            <el-button
                              type="danger"
                              plain
                              :loading="isUninstalling(plugin)"
                              @click="uninstallPlugin(plugin.sourceName, plugin.name)"
                            >
                              <template #icon>
                                <IconifyIcon icon="custom:delete-line" />
                              </template>
                              {{ t('pages.Setting.pluginMarketplace.uninstall') }}
                            </el-button>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div v-if="hasPluginSummaryContent(plugin)" class="plugin-body">
                      <p v-if="plugin.description" class="plugin-description">
                        {{ plugin.description }}
                      </p>
                      <div
                        v-if="plugin.requireSecretKey && !hasSecretKey(plugin)"
                        class="plugin-meta"
                      >
                        <el-tag type="warning" size="small">
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
              </el-scrollbar>
            </div>
            </div>
          </div>
        </el-tab-pane>
        <el-tab-pane :label="t('pages.Setting.pluginMarketplace.tabs.sources')" name="sources">
          <div class="sources-content">
            <div class="tab-panel-body" v-loading="loading.sources">
            <div class="search-box">
              <div class="toolbar-actions">
                <el-button type="primary" @click="openAddSourceDialog">
                  {{ t('pages.Setting.pluginMarketplace.sources.addSource') }}
                </el-button>
                <el-button @click="loadPluginSources">
                  <template #icon>
                    <IconifyIcon icon="custom:refresh-right" />
                  </template>
                  {{ t('pages.Setting.pluginMarketplace.sources.refreshSources') }}
                </el-button>
              </div>
            </div>
            <div class="tab-scroll-wrap">
              <el-scrollbar class="tab-scrollbar">
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
                    <button
                      v-if="canOpenPluginSourceLocation(source)"
                      type="button"
                      class="source-location-btn"
                      :title="getPluginSourceLocationTitle(source)"
                      @click="openPluginSourceLocation(source)"
                    >
                      <IconifyIcon
                        class="source-location-icon"
                        :icon="source.type === 'github' ? 'custom:link' : 'custom:folder-opened'"
                      />
                      <span class="source-location-text">{{ source.location }}</span>
                    </button>
                    <p v-else class="plugin-description source-location">{{ source.location }}</p>
                  </div>
                  <div v-if="!source.isOfficial" class="plugin-actions">
                    <el-switch v-model="source.enabled" @change="toggleSourceEnabled(source)" />
                    <el-button @click="renamePluginSource(source)">
                      {{ t('pages.Setting.pluginMarketplace.sources.renameSource') }}
                    </el-button>
                    <el-button type="danger" plain @click="removePluginSource(source.name)">
                      {{ t('pages.Setting.pluginMarketplace.sources.deleteSource') }}
                    </el-button>
                  </div>
                </div>
              </div>
              </el-scrollbar>
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
      <el-form
        ref="sourceFormRef"
        :model="sourceForm"
        :rules="sourceFormRules"
        label-width="90px"
        class="ai-setting-form"
      >
        <el-form-item :label="t('pages.Setting.pluginMarketplace.sourceForm.name')" prop="name">
          <el-input
            v-model="sourceForm.name"
            :maxlength="SOURCE_NAME_MAX_LEN"
            show-word-limit
            :placeholder="t('pages.Setting.pluginMarketplace.sourceForm.namePlaceholder')"
          />
        </el-form-item>
        <el-form-item :label="t('pages.Setting.pluginMarketplace.sourceForm.type')" prop="type">
          <el-radio-group v-model="sourceForm.type" class="setting-radio-group--2">
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

.marketplace-load-alert {
  flex-shrink: 0;
  margin-bottom: 16px;
}

.marketplace-load-alert__text {
  margin: 0;
  line-height: 1.5;
  white-space: pre-wrap;
  word-break: break-word;
}

.plugin-version-update {
  font-variant-numeric: tabular-nums;
}

.tab-panel-body {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  position: relative;
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
}

.tab-scrollbar {
  height: 100%;
}

.tab-scroll-content {
  padding: 10px 14px 10px 0;
}

.plugin-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 20px;
  min-height: 200px;
}

.plugin-card {
  display: flex;
  flex-direction: column;
  gap: 12px;
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
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.plugin-description {
  margin: 0;
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

.source-location-btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  max-width: 100%;
  margin: 0 0 6px;
  padding: 0;
  border: none;
  background: transparent;
  color: var(--el-color-primary);
  font: inherit;
  font-size: 14px;
  line-height: 22px;
  text-align: left;
  cursor: pointer;
  white-space: normal;
  word-break: break-all;

  &:hover {
    color: var(--el-color-primary-light-3);

    .source-location-text {
      text-decoration: underline;
    }
  }
}

.source-location-icon {
  display: inline-flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 22px;
  font-size: 16px;
  line-height: 0;

  :deep(svg) {
    display: block;
    width: 16px;
    height: 16px;
  }
}

.source-location-text {
  flex: 1;
  min-width: 0;
  line-height: 22px;
}

.source-item .plugin-actions {
  min-width: 260px;
  justify-content: flex-end;
  align-items: center;
}

.plugin-detail-panel {
  padding-top: 12px;
  border-top: 1px dashed var(--el-border-color);
  font-size: var(--el-font-size-small);
  line-height: 20px;
  color: var(--el-text-color-regular);
}

.detail-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 6px;
  font-size: inherit;
  line-height: inherit;

  &:last-child {
    margin-bottom: 0;
  }

  > span:first-child {
    flex-shrink: 0;
    color: var(--el-text-color-secondary);
  }

  > span:last-child:not(:only-child) {
    color: var(--el-text-color-regular);
    font-variant-numeric: tabular-nums;
  }
}
</style>
