import { defaultSettingData } from '@common/publicData.js'

const UseSettingStore = defineStore('setting', {
  state: () => {
    return {
      settingData: JSON.parse(JSON.stringify(defaultSettingData))
    }
  },
  actions: {
    updateSettingData(data) {
      this.settingData = {
        ...JSON.parse(JSON.stringify(defaultSettingData)),
        ...data
      }
    }
  }
})

export default UseSettingStore
