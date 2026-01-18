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
      // 验证菜单名称是否有效，确保是menuList中的一个
      const validMenuNames = this.menuList.map((item) => item.name)
      const validName = validMenuNames.includes(name) ? name : 'Search'

      this.selectedMenu = {
        name: validName,
        key: new Date().getTime(),
        params
      }
    }
  }
})

export default UseMenuStore
