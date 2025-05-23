import { defaultResourceMap } from '@common/publicData.js'
import * as api from '@h5/api/index.js'

const UseCommonStore = defineStore('common', {
  state: () => {
    return {
      activeTabbar: 'home',
      tabbarVisible: true,
      resourceMap: JSON.parse(JSON.stringify(defaultResourceMap))
    }
  },
  actions: {
    setActiveTabbar(name) {
      this.activeTabbar = name
    },
    toggleTabbarVisible() {
      this.tabbarVisible = !this.tabbarVisible
      // 设置根元素的css变量
      const tabbarHeight = this.tabbarVisible ? 'var(--van-tabbar-height)' : '0px'
      document.documentElement.style.setProperty('--fbw-tabbar-height', tabbarHeight)
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
