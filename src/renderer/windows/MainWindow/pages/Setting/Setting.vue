<script setup>
import { useTranslation } from 'i18next-vue'
import BaseSetting from './components/BaseSetting.vue'
import PrivacySpace from './components/PrivacySpace.vue'
import ShortcutSetting from './components/ShortcutSetting.vue'
import PluginMarketplace from './components/PluginMarketplace.vue'

const { t } = useTranslation()

const activeTab = ref('baseSetting')
const baseSettingRef = ref(null)
const privacySpaceRef = ref(null)
const shortcutSettingRef = ref(null)
const pluginMarketplaceRef = ref(null)

const onTabChange = (tab) => {
  switch (tab.paneName) {
    case 'baseSetting':
      baseSettingRef.value?.resetForm()
      break
    case 'privacySpace':
      privacySpaceRef.value?.resetForm()
      break
    case 'shortcutSetting':
      shortcutSettingRef.value?.resetForm()
      break
    case 'pluginMarketplace':
      pluginMarketplaceRef.value?.resetForm()
      break
  }
}
</script>

<template>
  <el-main class="page-setting">
    <el-tabs v-model="activeTab" @tab-click="onTabChange">
      <el-tab-pane :label="t('pages.Setting.tabs.baseSetting')" name="baseSetting"></el-tab-pane>
      <el-tab-pane :label="t('pages.Setting.tabs.privacySpace')" name="privacySpace"></el-tab-pane>
      <el-tab-pane
        :label="t('pages.Setting.tabs.shortcutSetting')"
        name="shortcutSetting"
      ></el-tab-pane>
      <el-tab-pane
        :label="t('pages.Setting.tabs.pluginMarketplace')"
        name="pluginMarketplace"
      ></el-tab-pane>
    </el-tabs>

    <div v-show="activeTab === 'baseSetting'">
      <BaseSetting ref="baseSettingRef" />
    </div>

    <div v-show="activeTab === 'privacySpace'">
      <PrivacySpace ref="privacySpaceRef" />
    </div>

    <div v-show="activeTab === 'shortcutSetting'">
      <ShortcutSetting ref="shortcutSettingRef" />
    </div>

    <div v-show="activeTab === 'pluginMarketplace'">
      <PluginMarketplace ref="pluginMarketplaceRef" />
    </div>
  </el-main>
</template>

<style scoped lang="scss">
.page-setting {
  padding: 0 20px;
  margin-bottom: 20px;
}
</style>
