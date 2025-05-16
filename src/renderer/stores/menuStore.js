import { menuList } from '@common/publicData.js'

const UseMenuStore = defineStore('menu', {
  state: () => {
    return {
      selectedMenu: null,
      menuList
    }
  },
  actions: {
    setSelected(name = 'Search', params = null) {
      this.selectedMenu = {
        name,
        key: new Date().getTime(),
        params
      }
    }
  }
})

export default UseMenuStore
