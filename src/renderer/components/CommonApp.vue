<script setup>
import UseCommonStore from '@renderer/stores/commonStore.js'
import UseSettingStore from '@renderer/stores/settingStore.js'
import { useTranslation } from 'i18next-vue'
import zhCN from 'element-plus/es/locale/lang/zh-cn'
import enUS from 'element-plus/es/locale/lang/en'
import { updateThemeColorVar } from '@renderer/utils/index.js'

const { i18next } = useTranslation()
const lang = { zhCN, enUS }

const commonStore = UseCommonStore()
const settingStore = UseSettingStore()

// Element Plus 全局配置
const elGlobalConfig = reactive({
  locale: zhCN,
  message: {
    grouping: true
  }
})

const isReady = ref(false)

const init = async () => {
  isReady.value = false
  // 获取或设置数据
  const res = await window.FBW.getSettingData()
  if (res.success && res.data) {
    settingStore.updateSettingData(res.data)
    updateElLocale(res.data.locale)
    updateThemeColorVar(res.data.themes)
  }
  // 获取资源数据
  const resourceRes = await window.FBW.getResourceMap()
  if (resourceRes.success && resourceRes.data) {
    commonStore.setResourceMap(resourceRes.data)
  }
  isReady.value = true
}

const updateElLocale = (locale) => {
  // 更新 Element Plus 语言
  i18next.changeLanguage(locale)
  elGlobalConfig.locale = lang[locale] || zhCN
}

const onSettingDataUpdateCallback = (event, data) => {
  settingStore.updateSettingData(data)
  updateElLocale(data.locale)
  updateThemeColorVar(data.themes)
}

const onCommonDataCallback = (event, data) => {
  commonStore.setCommonData(data)
}

const onSendMsgCallback = (event, data) => {
  if (data.type && data.message) {
    ElMessage({
      type: data.type,
      message: data.message
    })
  }
}

onBeforeMount(async () => {
  // 监听设置数据更新事件
  window.FBW.onSettingDataUpdate(onSettingDataUpdateCallback)
  // 监听主进程通用数据
  window.FBW.onCommonData(onCommonDataCallback)
  // 监听主进程消息
  window.FBW.onSendMsg(onSendMsgCallback)

  await init()
})

onBeforeUnmount(() => {
  // 取消监听设置数据更新事件
  window.FBW.offSettingDataUpdate(onSettingDataUpdateCallback)
  // 取消监听主进程通用数据
  window.FBW.offCommonData(onCommonDataCallback)
  // 取消监听主进程消息
  window.FBW.offSendMsg(onSendMsgCallback)
})
</script>

<template>
  <el-config-provider v-bind="elGlobalConfig">
    <div class="common-app">
      <slot v-if="isReady" />
    </div>
  </el-config-provider>
</template>

<style scoped lang="scss">
.common-app {
  display: inline-block;
  width: 100%;
  height: 100%;
  margin: 0;
  padding: 0;
  background: transparent;
}
</style>
