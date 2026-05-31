<script setup>
import UseCommonStore from './stores/commonStore.js'
import UseSettingStore from './stores/settingStore.js'
import BrowseShell from './pages/BrowseShell.vue'
import setting from './pages/setting/index.vue'
import pageEmpty from './components/pageEmpty.vue'
import H5BrowseDrawer from './components/H5BrowseDrawer.vue'
import { getBrowsePageMeta } from './stores/browseMeta.js'
import { useTranslation } from 'i18next-vue'
import { Locale } from 'vant'
import zhCN from 'vant/es/locale/lang/zh-CN'
import zhTW from 'vant/es/locale/lang/zh-TW'
import enUS from 'vant/es/locale/lang/en-US'
import ruRU from 'vant/es/locale/lang/ru-RU'
import deDE from 'vant/es/locale/lang/de-DE'
import frFR from 'vant/es/locale/lang/fr-FR'
import jaJP from 'vant/es/locale/lang/ja-JP'
import koKR from 'vant/es/locale/lang/ko-KR'
import esES from 'vant/es/locale/lang/es-ES'
import ptBR from 'vant/es/locale/lang/pt-BR'
import itIT from 'vant/es/locale/lang/it-IT'
import arSA from 'vant/es/locale/lang/ar-SA'
import { systemLocaleMap } from '@i18n/locale/index.js'

const { t, i18next } = useTranslation()

const commonStore = UseCommonStore()
const settingStore = UseSettingStore()

const { activeTabbar, activeBrowsePage, tabbarVisible } = storeToRefs(commonStore)
const { settingData } = storeToRefs(settingStore)

const pages = {
  browse: BrowseShell,
  setting
}

const pageRef = ref(null)

const DEFAULT_TAB = 'browse'

const loadingTab = ref('')
let prevActiveTabbar = DEFAULT_TAB
let wakeLock = null

const browseTabMeta = computed(() => getBrowsePageMeta(activeBrowsePage.value))

const tabbarList = computed(() => [
  {
    name: 'browse',
    locale: browseTabMeta.value.locale,
    icon: browseTabMeta.value.icon
  },
  { name: 'setting', locale: 'h5.tabbar.setting', icon: 'custom:settings' }
])

const themeVars = computed(() => ({
  primaryColor: settingData.value.h5Themes.primary
}))

const currentPage = computed(() => pages[activeTabbar.value || DEFAULT_TAB] || pages.browse)

const setPageTitle = () => {
  if (activeTabbar.value === 'setting') {
    document.title = `${t('appInfo.appName')}-${t('h5.tabbar.setting')}`
    return
  }
  document.title = `${t('appInfo.appName')}-${t(browseTabMeta.value.locale)}`
}

watch([activeTabbar, activeBrowsePage], setPageTitle, { immediate: true })

const vantLocales = {
  zhCN: ['zh-CN', zhCN],
  zhTW: ['zh-TW', zhTW],
  enUS: ['en-US', enUS],
  ruRU: ['ru-RU', ruRU],
  deDE: ['de-DE', deDE],
  frFR: ['fr-FR', frFR],
  jaJP: ['ja-JP', jaJP],
  koKR: ['ko-KR', koKR],
  esES: ['es-ES', esES],
  ptBR: ['pt-BR', ptBR],
  itIT: ['it-IT', itIT],
  arSA: ['ar-SA', arSA]
}

watch(
  () => settingData.value,
  (val) => {
    let h5Locale = val.h5Locale
    if (!h5Locale || !vantLocales[h5Locale]) {
      const systemLocale = navigator.language || navigator.languages?.[0] || 'en-US'
      const deviceLocale =
        systemLocaleMap[systemLocale] || systemLocaleMap[systemLocale.split('-')[0]] || 'enUS'
      h5Locale = deviceLocale
      settingStore.h5UpdateSettingData({ h5Locale: deviceLocale })
    }

    i18next.changeLanguage(h5Locale)
    const localeInfo = vantLocales[h5Locale]
    if (localeInfo) {
      Locale.use(localeInfo[0], localeInfo[1])
    } else {
      Locale.use('en-US', enUS)
    }
    setPageTitle()
  },
  { deep: true, immediate: true }
)

watch(
  () => settingData.value.h5WeekScreen,
  (val) => {
    if (val) {
      requestWakeLock()
    } else {
      releaseWakeLock()
    }
  }
)

const onTabbarChange = (name) => {
  commonStore.setActiveTabbar(name)
}

const onTabbarTrigger = (name) => {
  settingStore.vibrate()
  nextTick(() => {
    if (name === prevActiveTabbar && name === activeTabbar.value && pageRef.value?.refresh) {
      loadingTab.value = name
      const refreshPromise = pageRef.value.refresh()
      if (refreshPromise && typeof refreshPromise.finally === 'function') {
        refreshPromise.finally(() => {
          setTimeout(() => {
            loadingTab.value = ''
          }, 500)
        })
      } else {
        setTimeout(() => {
          loadingTab.value = ''
        }, 500)
      }
    }
    prevActiveTabbar = activeTabbar.value
  })
}

const requestWakeLock = async () => {
  try {
    if (!settingData.value.h5WeekScreen) return
    wakeLock = await navigator.wakeLock.request('screen')
    wakeLock.addEventListener('release', () => {})
  } catch (err) {
    console.error(`${err.name}, ${err.message}`)
  }
}

const releaseWakeLock = () => {
  if (wakeLock !== null) {
    wakeLock.release().then(() => {
      wakeLock = null
    })
  }
}

const handleVisibilityChange = () => {
  if (document.hidden) {
    releaseWakeLock()
  } else {
    requestWakeLock()
  }
}

onBeforeMount(async () => {
  settingStore.initSocketListeners()
  await settingStore.getSettingData()
  await commonStore.getResourceMap()
  if (pageRef.value?.init) {
    pageRef.value.init()
  }
  commonStore.syncTabbarHeightCss()
  prevActiveTabbar = activeTabbar.value
})

onMounted(() => {
  requestWakeLock()
  document.addEventListener('visibilitychange', handleVisibilityChange)
})

onUnmounted(() => {
  releaseWakeLock()
  document.removeEventListener('visibilitychange', handleVisibilityChange)
  wakeLock = null
})
</script>

<template>
  <van-config-provider
    :theme="settingData.h5Themes.dark ? 'dark' : 'light'"
    :theme-vars="themeVars"
    theme-vars-scope="global"
  >
    <div id="app">
      <H5BrowseDrawer />
      <keep-alive>
        <component :is="currentPage || pageEmpty" ref="pageRef" />
      </keep-alive>
      <van-tabbar
        v-if="tabbarVisible"
        v-model="activeTabbar"
        safe-area-inset-bottom
        @change="onTabbarChange"
      >
        <van-tabbar-item
          v-for="item in tabbarList"
          :key="item.name"
          :name="item.name"
          @click="() => onTabbarTrigger(item.name)"
        >
          {{ t(item.locale) }}
          <template #icon>
            <IconifyIcon
              :icon="loadingTab === item.name ? 'custom:loading' : item.icon"
              :class="{ 'loading-spin': loadingTab === item.name }"
            />
          </template>
        </van-tabbar-item>
      </van-tabbar>
    </div>
  </van-config-provider>
</template>

<style>
body {
  margin: 0;
  font-family: Arial, sans-serif;
}

.loading-spin {
  animation: spin 0.5s linear infinite;
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(180deg);
  }
}
</style>
