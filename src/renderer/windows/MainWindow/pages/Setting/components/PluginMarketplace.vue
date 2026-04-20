<script setup>
import { useTranslation } from 'i18next-vue'

const { t } = useTranslation()

const activeTab = ref('marketplace')
const searchQuery = ref('')
const availablePlugins = ref([])
const installedPlugins = ref([])
const loading = reactive({
  available: false,
  installed: false,
  installing: false,
  uninstalling: false,
  updating: false
})

const currentPlugin = ref(null)
const showPluginDetail = ref(false)

const filteredPlugins = computed(() => {
  if (!searchQuery.value) {
    return availablePlugins.value
  }
  const query = searchQuery.value.toLowerCase()
  return availablePlugins.value.filter((plugin) => {
    const name = plugin.name.toLowerCase()
    const displayName = (plugin.displayName || '').toLowerCase()
    const description = (plugin.description || '').toLowerCase()
    return name.includes(query) || displayName.includes(query) || description.includes(query)
  })
})

const loadAvailablePlugins = async () => {
  loading.available = true
  try {
    const result = await window.FBW.getAvailablePlugins()
    if (result.success) {
      availablePlugins.value = result.data || []
    } else {
      ElMessage.error(result.message || '获取可用插件列表失败')
    }
  } catch (error) {
    console.error('获取可用插件列表失败:', error)
    ElMessage.error('获取可用插件列表失败')
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
      ElMessage.error(result.message || '获取已安装插件列表失败')
    }
  } catch (error) {
    console.error('获取已安装插件列表失败:', error)
    ElMessage.error('获取已安装插件列表失败')
  } finally {
    loading.installed = false
  }
}

const installPlugin = async (pluginName) => {
  loading.installing = true
  try {
    const result = await window.FBW.installPlugin(pluginName)
    if (result.success) {
      ElMessage.success(result.message || '插件安装成功')
      await loadInstalledPlugins()
      await loadAvailablePlugins()
    } else {
      ElMessage.error(result.message || '插件安装失败')
    }
  } catch (error) {
    console.error('安装插件失败:', error)
    ElMessage.error('插件安装失败')
  } finally {
    loading.installing = false
  }
}

const uninstallPlugin = async (pluginName) => {
  loading.uninstalling = true
  try {
    const result = await window.FBW.uninstallPlugin(pluginName)
    if (result.success) {
      ElMessage.success(result.message || '插件卸载成功')
      await loadInstalledPlugins()
      await loadAvailablePlugins()
    } else {
      ElMessage.error(result.message || '插件卸载失败')
    }
  } catch (error) {
    console.error('卸载插件失败:', error)
    ElMessage.error('插件卸载失败')
  } finally {
    loading.uninstalling = false
  }
}

const updatePlugin = async (pluginName) => {
  loading.updating = true
  try {
    const result = await window.FBW.updatePlugin(pluginName)
    if (result.success) {
      ElMessage.success(result.message || '插件更新成功')
      await loadInstalledPlugins()
      await loadAvailablePlugins()
    } else {
      ElMessage.error(result.message || '插件更新失败')
    }
  } catch (error) {
    console.error('更新插件失败:', error)
    ElMessage.error('插件更新失败')
  } finally {
    loading.updating = false
  }
}

const showPluginDetailDialog = (plugin) => {
  currentPlugin.value = plugin
  showPluginDetail.value = true
}

const isPluginInstalled = (pluginName) => {
  return installedPlugins.value.some((plugin) => plugin.name === pluginName)
}

const getInstalledPluginVersion = (pluginName) => {
  const plugin = installedPlugins.value.find((p) => p.name === pluginName)
  return plugin ? plugin.version : null
}

onMounted(() => {
  loadAvailablePlugins()
  loadInstalledPlugins()
})

defineExpose({
  resetForm: () => {
    searchQuery.value = ''
  }
})
</script>

<template>
  <div class="plugin-marketplace-wrapper">
    <el-scrollbar style="height: 100%">
      <div class="plugin-marketplace">
        <el-tabs v-model="activeTab">
          <el-tab-pane :label="t('pages.Setting.pluginMarketplace.tabs.marketplace')" name="marketplace">
            <div class="marketplace-content">
              <div class="search-box">
                <el-input
                  v-model="searchQuery"
                  :placeholder="t('pages.Setting.pluginMarketplace.searchPlaceholder')"
                  clearable
                  style="width: 400px"
                >
                  <template #prefix>
                    <IconifyIcon icon="custom:search" />
                  </template>
                </el-input>
                <el-button
                  type="primary"
                  :loading="loading.available"
                  @click="loadAvailablePlugins"
                  style="margin-left: 10px"
                >
                  <IconifyIcon icon="custom:refresh" />
                  {{ t('pages.Setting.pluginMarketplace.refresh') }}
                </el-button>
              </div>

              <el-empty v-if="!loading.available && filteredPlugins.length === 0" />

              <div v-loading="loading.available" class="plugin-grid">
                <div
                  v-for="plugin in filteredPlugins"
                  :key="plugin.name"
                  class="plugin-card"
                >
                  <div class="plugin-header">
                    <div class="plugin-icon">
                      <IconifyIcon icon="custom:plugin" />
                    </div>
                    <div class="plugin-title">
                      <h3>{{ plugin.displayName || plugin.name }}</h3>
                      <span class="plugin-version">v{{ plugin.version }}</span>
                    </div>
                  </div>
                  <div class="plugin-body">
                    <p class="plugin-description">{{ plugin.description }}</p>
                    <div class="plugin-meta">
                      <span class="plugin-author">
                        <IconifyIcon icon="custom:user" />
                        {{ plugin.author }}
                      </span>
                      <el-tag
                        v-if="!plugin.compatible"
                        type="danger"
                        size="small"
                      >
                        {{ t('pages.Setting.pluginMarketplace.incompatible') }}
                      </el-tag>
                    </div>
                  </div>
                  <div class="plugin-footer">
                    <el-button
                      v-if="plugin.site"
                      link
                      @click="window.FBW.openUrl(plugin.site)"
                    >
                      <IconifyIcon icon="custom:link" />
                      {{ t('pages.Setting.pluginMarketplace.website') }}
                    </el-button>
                    <el-button
                      v-if="isPluginInstalled(plugin.name)"
                      disabled
                    >
                      <IconifyIcon icon="custom:check" />
                      {{ t('pages.Setting.pluginMarketplace.installed') }}
                    </el-button>
                    <el-button
                      v-else
                      type="primary"
                      :disabled="!plugin.compatible"
                      :loading="loading.installing"
                      @click="installPlugin(plugin.name)"
                    >
                      <IconifyIcon icon="custom:download" />
                      {{ t('pages.Setting.pluginMarketplace.install') }}
                    </el-button>
                  </div>
                </div>
              </div>
            </div>
          </el-tab-pane>

          <el-tab-pane :label="t('pages.Setting.pluginMarketplace.tabs.installed')" name="installed">
            <div class="installed-content">
              <el-button
                type="primary"
                :loading="loading.installed"
                @click="loadInstalledPlugins"
                style="margin-bottom: 20px"
              >
                <IconifyIcon icon="custom:refresh" />
                {{ t('pages.Setting.pluginMarketplace.refresh') }}
              </el-button>

              <el-empty v-if="!loading.installed && installedPlugins.length === 0" />

              <div v-loading="loading.installed" class="plugin-list">
                <div
                  v-for="plugin in installedPlugins"
                  :key="plugin.name"
                  class="installed-plugin-item"
                >
                  <div class="plugin-info">
                    <div class="plugin-icon">
                      <IconifyIcon icon="custom:plugin" />
                    </div>
                    <div class="plugin-details">
                      <h3>{{ plugin.displayName || plugin.name }}</h3>
                      <p class="plugin-description">{{ plugin.description }}</p>
                      <div class="plugin-meta">
                        <span class="plugin-version">v{{ plugin.version }}</span>
                        <span class="plugin-author">
                          <IconifyIcon icon="custom:user" />
                          {{ plugin.author }}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div class="plugin-actions">
                    <el-button
                      link
                      @click="showPluginDetailDialog(plugin)"
                    >
                      <IconifyIcon icon="custom:info" />
                      {{ t('pages.Setting.pluginMarketplace.details') }}
                    </el-button>
                    <el-button
                      type="primary"
                      :loading="loading.updating"
                      @click="updatePlugin(plugin.name)"
                    >
                      <IconifyIcon icon="custom:refresh" />
                      {{ t('pages.Setting.pluginMarketplace.update') }}
                    </el-button>
                    <el-button
                      type="danger"
                      :loading="loading.uninstalling"
                      @click="uninstallPlugin(plugin.name)"
                    >
                      <IconifyIcon icon="custom:delete" />
                      {{ t('pages.Setting.pluginMarketplace.uninstall') }}
                    </el-button>
                  </div>
                </div>
              </div>
            </div>
          </el-tab-pane>
        </el-tabs>
      </div>
    </el-scrollbar>

    <el-dialog
      v-model="showPluginDetail"
      :title="currentPlugin?.displayName || currentPlugin?.name"
      width="600px"
    >
      <div v-if="currentPlugin" class="plugin-detail">
        <div class="detail-row">
          <span class="detail-label">{{ t('pages.Setting.pluginMarketplace.name') }}:</span>
          <span class="detail-value">{{ currentPlugin.displayName || currentPlugin.name }}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">{{ t('pages.Setting.pluginMarketplace.version') }}:</span>
          <span class="detail-value">v{{ currentPlugin.version }}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">{{ t('pages.Setting.pluginMarketplace.author') }}:</span>
          <span class="detail-value">{{ currentPlugin.author }}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">{{ t('pages.Setting.pluginMarketplace.description') }}:</span>
          <span class="detail-value">{{ currentPlugin.description }}</span>
        </div>
        <div v-if="currentPlugin.site" class="detail-row">
          <span class="detail-label">{{ t('pages.Setting.pluginMarketplace.website') }}:</span>
          <el-link :href="currentPlugin.site" target="_blank">
            {{ currentPlugin.site }}
          </el-link>
        </div>
        <div v-if="currentPlugin.appVersion" class="detail-row">
          <span class="detail-label">{{ t('pages.Setting.pluginMarketplace.appVersion') }}:</span>
          <span class="detail-value">
            {{ currentPlugin.appVersion.min }} - {{ currentPlugin.appVersion.max }}
          </span>
        </div>
      </div>
      <template #footer>
        <el-button @click="showPluginDetail = false">
          {{ t('pages.Setting.pluginMarketplace.close') }}
        </el-button>
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
  padding: 20px;
}

.search-box {
  display: flex;
  align-items: center;
  margin-bottom: 20px;
}

.plugin-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 20px;
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
  font-size: 24px;
  margin-right: 15px;
}

.plugin-title {
  flex: 1;

  h3 {
    margin: 0 0 5px 0;
    font-size: 16px;
    font-weight: 600;
  }
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
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.plugin-meta {
  display: flex;
  align-items: center;
  gap: 10px;
}

.plugin-author {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  display: flex;
  align-items: center;
  gap: 4px;
}

.plugin-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-top: 15px;
  border-top: 1px solid var(--el-border-color-lighter);
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
  }
}

.plugin-info {
  display: flex;
  align-items: center;
  flex: 1;
}

.plugin-details {
  margin-left: 15px;
  flex: 1;

  h3 {
    margin: 0 0 5px 0;
    font-size: 16px;
    font-weight: 600;
  }
}

.plugin-actions {
  display: flex;
  gap: 10px;
}

.plugin-detail {
  .detail-row {
    display: flex;
    margin-bottom: 15px;
    align-items: center;

    &:last-child {
      margin-bottom: 0;
    }
  }

  .detail-label {
    width: 120px;
    font-weight: 600;
    color: var(--el-text-color-primary);
  }

  .detail-value {
    flex: 1;
    color: var(--el-text-color-regular);
  }
}
</style>
