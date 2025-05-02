import { defineStore } from 'pinia'
import { defaultResourceMap } from '@common/publicData.js'
import * as api from '@h5/api/index.js'

const UseCommonStore = defineStore('common', {
  state: () => {
    return {
      activeTabbar: 'home',
      resourceMap: JSON.parse(JSON.stringify(defaultResourceMap))
    }
  },
  actions: {
    setActiveTabbar(name) {
      this.activeTabbar = name
    },
    setResourceMap(resourceMap) {
      this.resourceMap = resourceMap
    },
    async getResourceMap() {
      const res = await api.getResourceMap()
      if (res.success) {
        this.resourceMap = Object.assign({}, this.resourceMap, res.data)
      }
      return res
    }
  }
})

export default UseCommonStore
