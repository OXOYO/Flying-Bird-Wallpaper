import { defaultSettingData } from '@common/publicData.js'
import * as api from '@h5/api/index.js'
import LocalStore from '../utils/localStore'
import i18next from '@i18n/i18next.js'
import { systemLocaleMap } from '@i18n/locale/index.js'

const localStore = new LocalStore()

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
        if (!this.settingData?.isH5LocaleSet) {
          // 使用顶部定义的设备语言检测函数
          const deviceLocale = getDeviceLocale()
          res.data.h5Locale = deviceLocale
          // 同步设备语言到服务器
          await api.h5UpdateSettingData({ h5Locale: deviceLocale })
        }
        this.settingData = Object.assign({}, this.settingData, res.data)
      }
      return res
    },
    async h5UpdateSettingData(data) {
      if (!this.localSetting.multiDeviceSync) {
        this.settingData = Object.assign({}, this.settingData, data)
        // 更新语言
        i18next.changeLanguage(this.settingData.h5Locale)
        return {
          success: false,
          message: i18next.t('messages.multiDeviceSyncWarning')
        }
      }
      const res = await api.h5UpdateSettingData(data)
      if (res.success) {
        this.settingData = Object.assign({}, this.settingData, res.data)
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
    // 初始化 Socket.IO 监听
    initSocketListeners() {
      // 监听多设备设置更新事件
      api.socketInstance.on('settingUpdated', (res) => {
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
