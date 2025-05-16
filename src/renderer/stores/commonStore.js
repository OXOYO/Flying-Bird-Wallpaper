import { defaultResourceMap } from '@common/publicData.js'

const UseCommonStore = defineStore('common', {
  state: () => {
    return {
      commonData: null,
      resourceMap: JSON.parse(JSON.stringify(defaultResourceMap))
    }
  },
  actions: {
    setCommonData(commonData) {
      this.commonData = commonData
    },
    setResourceMap(resourceMap) {
      this.resourceMap = resourceMap
    }
  }
})

export default UseCommonStore
