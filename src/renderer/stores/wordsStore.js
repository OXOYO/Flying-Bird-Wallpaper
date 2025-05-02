import { defineStore } from 'pinia'

const UseWordsStore = defineStore('words', {
  state: () => {
    return {
      wordDrawerVisible: false,
      wordTypeList: [
        { label: '中文', value: 1, locale: 'wordTypeList.chinese', color: '#67c23a' },
        { label: '英文', value: 2, locale: 'wordTypeList.english', color: '#e6a23c' }
      ]
    }
  },
  actions: {
    toggleWordDrawerVisible(val) {
      this.wordDrawerVisible = val !== undefined ? val : !this.wordDrawerVisible
    }
  }
})

export default UseWordsStore
