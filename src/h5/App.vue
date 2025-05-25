<script setup>
import UseCommonStore from './stores/commonStore.js'
import UseSettingStore from './stores/settingStore.js'
import home from './pages/home/index.vue'
import setting from './pages/setting/index.vue'
import pageEmpty from './components/pageEmpty.vue'
import { useTranslation } from 'i18next-vue'
import { Locale } from 'vant'
import zhCN from 'vant/es/locale/lang/zh-CN'
import enUS from 'vant/es/locale/lang/en-US'

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
  { name: 'home', title: '首页', locale: 'h5.tabbar.home', icon: 'ri:home-3-line' },
  { name: 'search', title: '搜索', locale: 'h5.tabbar.search', icon: 'ri:search-line' },
  { name: 'setting', title: '设置', locale: 'h5.tabbar.setting', icon: 'ri:settings-line' }
]

let wakeLock = null

const themeVars = computed(() => {
  return {
    primaryColor: settingData.value.themes.primary
  }
})

const currentPage = computed(() => {
  const pageName = activeTabbar.value || 'home'
  return pages[pageName]
})

// 添加一个函数来设置页面标题
const setPageTitle = (pageName) => {
  const titleKey = tabbarList.find((item) => item.name === pageName)?.locale
  document.title = t('appInfo.name') + '-' + t(titleKey)
}

// 监听 activeTabbar 变化来更新页面标题
watch(
  () => activeTabbar.value,
  (newTabName) => {
    const pageName = newTabName || 'home'
    setPageTitle(pageName)
  },
  { immediate: true }
)

watch(
  () => settingData.value,
  (val) => {
    i18next.changeLanguage(val.locale)
    if (val.locale === 'zhCN') {
      Locale.use('zh-CN', zhCN)
    } else {
      Locale.use('en-US', enUS)
    }
    // 语言变化时也需要更新页面标题
    setPageTitle(activeTabbar.value || 'home')
  },
  {
    deep: true,
    immediate: true
  }
)

const onTabbarChange = (name) => {
  commonStore.setActiveTabbar(name)
}
const onTabbarTrigger = (name) => {
  nextTick(() => {
    if (name === activeTabbar.value && name === 'home' && pageRef.value.init) {
      pageRef.value.init()
    }
  })
}

// 保持屏幕常亮
const requestWakeLock = async () => {
  try {
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
})
</script>

<template>
  <van-config-provider :theme-vars="themeVars" theme-vars-scope="global">
    <div id="app">
      <component :is="currentPage || pageEmpty" ref="pageRef"></component>
      <van-tabbar v-if="tabbarVisible" v-model="activeTabbar" @change="onTabbarChange">
        <van-tabbar-item
          v-for="item in tabbarList"
          :key="item.name"
          :name="item.name"
          @click="() => onTabbarTrigger(item.name)"
        >
          {{ t(item.locale) }}
          <template #icon>
            <IconifyIcon :icon="item.icon" />
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
</style>
