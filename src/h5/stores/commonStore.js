import { defaultResourceMap } from '@common/publicData.js'
import * as api from '@h5/api/index.js'

const UseCommonStore = defineStore('common', {
  state: () => {
    return {
      activeTabbar: 'search',
      tabbarVisible: true,
      /** 沉浸模式：隐藏顶栏搜索行与底部 TabBar，仅保留右上迷你按钮 */
      immersiveMode: false,
      resourceMap: JSON.parse(JSON.stringify(defaultResourceMap))
    }
  },
  actions: {
    setActiveTabbar(name) {
      this.activeTabbar = name
    },
    syncTabbarHeightCss() {
      const tabbarHeight = this.tabbarVisible ? 'var(--van-tabbar-height)' : '0px'
      document.documentElement.style.setProperty('--fbw-tabbar-height', tabbarHeight)
    },
    setImmersiveMode(enabled) {
      this.immersiveMode = Boolean(enabled)
      this.tabbarVisible = !this.immersiveMode
      this.syncTabbarHeightCss()
    },
    toggleImmersiveMode() {
      this.setImmersiveMode(!this.immersiveMode)
    },
    /** @deprecated 使用 toggleImmersiveMode */
    toggleTabbarVisible() {
      this.toggleImmersiveMode()
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
