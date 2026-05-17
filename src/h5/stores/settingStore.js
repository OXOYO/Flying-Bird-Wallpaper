import { defaultSettingData } from '@common/publicData.js'
import * as api from '@h5/api/index.js'
import LocalStore from '../utils/localStore'
import i18next from '@i18n/i18next.js'
import { systemLocaleMap } from '@i18n/locale/index.js'

const localStore = new LocalStore()
const H5_SETTING_CACHE_KEY = 'h5SettingDataCache'

const persistH5SettingCache = (settingData) => {
  try {
    localStore.set(H5_SETTING_CACHE_KEY, settingData)
  } catch (_) {
    /* noop */
  }
}

const readH5SettingCache = () => {
  try {
    return localStore.get(H5_SETTING_CACHE_KEY)
  } catch (_) {
    return { success: false, data: null }
  }
}

// 检测设备语言
const getDeviceLocale = () => {
  const deviceLocale = navigator.language || navigator.languages?.[0] || 'en-US'
  // 从统一配置获取语言映射
  return systemLocaleMap[deviceLocale] || systemLocaleMap[deviceLocale.split('-')[0]] || 'enUS'
}

const UseSettingStore = defineStore('setting', {
  state: () => {
    let localSetting = {
      // 多设备同步
      multiDeviceSync: true
    }
    const localSettingRes = localStore.get('localSetting')
    if (localSettingRes.success && localSettingRes.data) {
      localSetting = Object.assign({}, localSetting, localSettingRes.data)
    }
    return {
      settingData: {
        ...JSON.parse(JSON.stringify(defaultSettingData))
      },
      localSetting
    }
  },
  actions: {
    async getSettingData() {
      const res = await api.getSettingData()
      if (res.success) {
        const serverData = res.data || {}
        if (!serverData.isH5LocaleSet) {
          const deviceLocale = getDeviceLocale()
          serverData.h5Locale = deviceLocale
          if (this.localSetting.multiDeviceSync) {
            await api.h5UpdateSettingData({ h5Locale: deviceLocale, isH5LocaleSet: false })
          }
        }
        let merged = Object.assign({}, this.settingData, serverData)
        if (!this.localSetting.multiDeviceSync) {
          const cached = readH5SettingCache()
          if (cached.success && cached.data) {
            merged = Object.assign({}, merged, cached.data)
          }
        }
        this.settingData = merged
        if (!this.localSetting.multiDeviceSync) {
          persistH5SettingCache(this.settingData)
        }
      }
      return res
    },
    async h5UpdateSettingData(data) {
      const nextData = Object.assign({}, this.settingData, data)
      if (!this.localSetting.multiDeviceSync) {
        this.settingData = nextData
        persistH5SettingCache(this.settingData)
        if (this.settingData.h5Locale) {
          i18next.changeLanguage(this.settingData.h5Locale)
        }
        return {
          success: true,
          message: i18next.t('messages.operationSuccess'),
          data: this.settingData
        }
      }
      const res = await api.h5UpdateSettingData(data)
      if (res.success) {
        this.settingData = Object.assign({}, this.settingData, res.data)
        persistH5SettingCache(this.settingData)
      }
      return res
    },
    updateLocalSetting(data) {
      try {
        if (typeof data !== 'object' || !data) return false
        this.localSetting = Object.assign({}, this.localSetting, data)
        localStore.set('localSetting', this.localSetting)
        return true
      } catch (err) {
        return false
      }
    },
    // 初始化 SSE 监听
    initSocketListeners() {
      api.initEventStream()
      api.on('settingUpdated', (res) => {
        // 本地可控制多设备数据是否同步
        if (res.success && this.localSetting.multiDeviceSync) {
          this.settingData = Object.assign({}, this.settingData, res.data)
        }
      })
    },
    vibrate(duration = 10, callback = null) {
      if (typeof duration === 'function') {
        callback = duration
        duration = 10
      }
      if (this.settingData.h5Vibration && navigator.vibrate) {
        navigator.vibrate(duration)
      }
      if (callback) {
        setTimeout(callback, duration)
      }
    }
  }
})

export default UseSettingStore
