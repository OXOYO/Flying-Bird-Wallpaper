import { defaultResourceMap } from '@common/publicData.js'
import * as api from '@h5/api/index.js'
import { readH5ImmersiveMode, writeH5ImmersiveMode } from '@h5/utils/h5BrowsePreferences.mjs'

const initialImmersiveMode = readH5ImmersiveMode()

const UseCommonStore = defineStore('common', {
  state: () => {
    return {
      /** 底部 Tab：browse | setting */
      activeTabbar: 'browse',
      /** 浏览子页：search | collections | favorites | history */
      activeBrowsePage: 'search',
      drawerVisible: false,
      tabbarVisible: !initialImmersiveMode,
      /** 沉浸模式：隐藏顶栏与底部 TabBar（浏览各子页共享） */
      immersiveMode: initialImmersiveMode,
      resourceMap: JSON.parse(JSON.stringify(defaultResourceMap))
    }
  },
  getters: {
    isBrowseTab: (state) => state.activeTabbar === 'browse'
  },
  actions: {
    setActiveTabbar(name) {
      const next = name === 'setting' ? 'setting' : 'browse'
      this.activeTabbar = next
    },
    setActiveBrowsePage(page) {
      if (!page) return
      this.activeBrowsePage = page
      this.activeTabbar = 'browse'
    },
    selectBrowsePage(page) {
      this.setActiveBrowsePage(page)
      this.drawerVisible = false
    },
    openDrawer() {
      this.drawerVisible = true
    },
    closeDrawer() {
      this.drawerVisible = false
    },
    /** @deprecated 兼容旧 activeTabbar='search' */
    migrateLegacyTab(name) {
      if (name === 'search' || name === 'collections' || name === 'favorites' || name === 'history') {
        this.activeBrowsePage = name
        this.activeTabbar = 'browse'
        return
      }
      if (name === 'setting') {
        this.activeTabbar = 'setting'
      }
    },
    syncTabbarHeightCss() {
      const tabbarHeight = this.tabbarVisible ? 'var(--van-tabbar-height)' : '0px'
      document.documentElement.style.setProperty('--fbw-tabbar-height', tabbarHeight)
    },
    setImmersiveMode(enabled) {
      this.immersiveMode = Boolean(enabled)
      this.tabbarVisible = !this.immersiveMode
      writeH5ImmersiveMode(this.immersiveMode)
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
