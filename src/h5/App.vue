<script setup>
import UseCommonStore from './stores/commonStore.js'
import UseSettingStore from './stores/settingStore.js'
import home from './pages/home/index.vue'
import setting from './pages/setting/index.vue'
import pageEmpty from './components/pageEmpty.vue'
import { useTranslation } from 'i18next-vue'
import { Locale } from 'vant'
// 导入所有支持的语言包
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
// 导入系统语言映射
import { systemLocaleMap } from '@i18n/locale/index.js'

const { t, i18next } = useTranslation()

const commonStore = UseCommonStore()
const settingStore = UseSettingStore()

const { activeTabbar, tabbarVisible } = storeToRefs(commonStore)
const { settingData } = storeToRefs(settingStore)

const pages = {
  home,
  setting
}

const pageRef = ref(null)

const tabbarList = [
  { name: 'home', title: '首页', locale: 'h5.tabbar.home', icon: 'custom:home-3-line' },
  { name: 'search', title: '搜索', locale: 'h5.tabbar.search', icon: 'custom:search' },
  { name: 'setting', title: '设置', locale: 'h5.tabbar.setting', icon: 'custom:settings' }
]

// 默认tab: 首页
const DEFAULT_TAB = 'home'

// 添加loading状态
const loadingTab = ref('')

// 记录上一次的activeTabbar，用于判断是否真的切换了tab
let prevActiveTabbar = DEFAULT_TAB

let wakeLock = null

const themeVars = computed(() => {
  return {
    primaryColor: settingData.value.themes.primary
  }
})

const currentPage = computed(() => {
  const pageName = activeTabbar.value || DEFAULT_TAB
  return pages[pageName]
})

// 添加一个函数来设置页面标题
const setPageTitle = (pageName) => {
  if (!pageName) return
  const titleKey = tabbarList.find((item) => item.name === pageName)?.locale
  document.title = t('appInfo.appName') + '-' + t(titleKey)
}

// 监听 activeTabbar 变化来更新页面标题
watch(
  () => activeTabbar.value,
  (newTabName) => {
    const pageName = newTabName
    setPageTitle(pageName)
  },
  { immediate: true }
)

// 定义语言映射关系
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
    // 如果设置数据中的语言为空或无效，使用设备语言
    if (!val.locale || !vantLocales[val.locale]) {
      // 检测设备语言
      const systemLocale = navigator.language || navigator.languages?.[0] || 'en-US'
      // 从统一配置获取语言映射
      const deviceLocale =
        systemLocaleMap[systemLocale] || systemLocaleMap[systemLocale.split('-')[0]] || 'enUS'
      val.locale = deviceLocale
      // 同步到服务器
      settingStore.h5UpdateSettingData({ locale: deviceLocale })
    }

    i18next.changeLanguage(val.locale)
    // 使用对应的语言包
    const localeInfo = vantLocales[val.locale]
    if (localeInfo) {
      Locale.use(localeInfo[0], localeInfo[1])
    } else {
      // 默认使用英语
      Locale.use('en-US', enUS)
    }
    // 语言变化时也需要更新页面标题
    setPageTitle(activeTabbar.value)
  },
  {
    deep: true,
    immediate: true
  }
)

watch(
  () => settingData.value.h5WeekScreen,
  (val) => {
    // 处理屏幕常亮
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
    // 只有当点击的tab与之前的activeTabbar相同，且与当前activeTabbar也相同时，才触发刷新
    // 这表示用户点击了当前已经激活的tab
    if (name === prevActiveTabbar && name === activeTabbar.value && pageRef.value.refresh) {
      // 设置loading状态
      loadingTab.value = name
      // 调用刷新方法
      const refreshPromise = pageRef.value.refresh()
      if (refreshPromise && typeof refreshPromise.finally === 'function') {
        refreshPromise.finally(() => {
          setTimeout(() => {
            // 刷新完成后清除loading状态
            loadingTab.value = ''
          }, 500)
        })
      } else {
        setTimeout(() => {
          // 如果不是Promise，直接清除loading状态
          loadingTab.value = ''
        }, 500)
      }
    }
    // 更新previousActiveTabbar
    prevActiveTabbar = activeTabbar.value
  })
}

// 保持屏幕常亮
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
  // 初始化 Socket.IO 监听
  settingStore.initSocketListeners()
  // 获取设置数据
  await settingStore.getSettingData()
  // 获取资源数据
  await commonStore.getResourceMap()
  // 初始化首页
  if (pageRef.value.init) {
    pageRef.value.init()
  }
  // 初始化previousActiveTabbar
  prevActiveTabbar = activeTabbar.value
})

onMounted(() => {
  requestWakeLock()
  // 监听页面可见性变化
  document.addEventListener('visibilitychange', handleVisibilityChange)
})

onUnmounted(() => {
  releaseWakeLock()
  // 移除事件监听
  document.removeEventListener('visibilitychange', handleVisibilityChange)
  // 清理 wakeLock 引用
  wakeLock = null
  // 清空大型数据结构
  tabbarList.length = 0
})
</script>

<template>
  <van-config-provider
    :theme="settingData.themes.dark ? 'dark' : 'light'"
    :theme-vars="themeVars"
    theme-vars-scope="global"
  >
    <div id="app">
      <keep-alive>
        <component :is="currentPage || pageEmpty" ref="pageRef"></component>
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
