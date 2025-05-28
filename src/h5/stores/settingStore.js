import { defaultSettingData } from '@common/publicData.js'
import * as api from '@h5/api/index.js'

const UseSettingStore = defineStore('setting', {
  state: () => {
    return {
      settingData: {
        ...JSON.parse(JSON.stringify(defaultSettingData))
      }
    }
  },
  actions: {
    async getSettingData() {
      const res = await api.getSettingData()
      if (res.success) {
        this.settingData = Object.assign({}, this.settingData, res.data)
      }
      return res
    },
    async h5UpdateSettingData(data) {
      const res = await api.h5UpdateSettingData(data)
      if (res.success) {
        this.settingData = Object.assign({}, this.settingData, res.data)
      }
      return res
    },
    // 初始化 Socket.IO 监听
    initSocketListeners() {
      // 监听设置更新事件
      api.socketInstance.on('settingUpdated', (res) => {
        if (res.success) {
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
