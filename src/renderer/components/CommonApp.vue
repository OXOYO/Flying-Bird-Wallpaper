<script setup>
import UseCommonStore from '@renderer/stores/commonStore.js'
import UseSettingStore from '@renderer/stores/settingStore.js'
import { updateThemeColorVar } from '@renderer/utils/index.js'
import { useTranslation } from 'i18next-vue'
// 导入所有支持的语言包
import zhCn from 'element-plus/es/locale/lang/zh-cn'
import zhTw from 'element-plus/es/locale/lang/zh-tw'
import en from 'element-plus/es/locale/lang/en'
import ru from 'element-plus/es/locale/lang/ru'
import de from 'element-plus/es/locale/lang/de'
import fr from 'element-plus/es/locale/lang/fr'
import ja from 'element-plus/es/locale/lang/ja'
import ko from 'element-plus/es/locale/lang/ko'
import es from 'element-plus/es/locale/lang/es'
import ptBr from 'element-plus/es/locale/lang/pt-br'
import it from 'element-plus/es/locale/lang/it'
import ar from 'element-plus/es/locale/lang/ar'

const { i18next } = useTranslation()
// 定义语言映射关系
const lang = {
  zhCN: zhCn,
  zhTW: zhTw,
  enUS: en,
  ruRU: ru,
  deDE: de,
  frFR: fr,
  jaJP: ja,
  koKR: ko,
  esES: es,
  ptBR: ptBr,
  itIT: it,
  arSA: ar
}

const commonStore = UseCommonStore()
const settingStore = UseSettingStore()

// Element Plus 全局配置
const elGlobalConfig = reactive({
  locale: lang.enUS,
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
  // 处理空值
  if (!locale || !lang[locale]) {
    locale = 'enUS'
  }
  // 更新 Element Plus 语言
  i18next.changeLanguage(locale)
  // 使用对应的语言包
  elGlobalConfig.locale = lang[locale]
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
