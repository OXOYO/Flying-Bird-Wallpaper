<script setup>
import UseMenuStore from '@renderer/stores/menuStore.js'
import UseWordsStore from '@renderer/stores/wordsStore.js'
import { useTranslation } from 'i18next-vue'

const { t } = useTranslation()

const menuStore = UseMenuStore()
const wordsStore = UseWordsStore()
const { wordTypeList } = storeToRefs(wordsStore)

const words = ref({
  1: [],
  2: []
})

const activeWordTab = ref(1)

const onWordClick = (item) => {
  menuStore.setSelected('Search', {
    word: item.word
  })
}

const getWords = () => {
  window.FBW.getWords({
    types: [1, 2],
    size: 10000
  }).then((res) => {
    if (res && res.success && res.data) {
      words.value = res.data
    }
  })
}

onMounted(() => {
  getWords()
})
</script>

<template>
  <el-main class="page-words">
    <el-tabs v-model="activeWordTab" class="words-tabs">
      <el-tab-pane
        v-for="tabItem in wordTypeList"
        :key="tabItem.value"
        :label="t(tabItem.locale)"
        :name="tabItem.value"
      >
        <div
          v-if="Array.isArray(words[tabItem.value]) && words[tabItem.value].length"
          class="word-list"
        >
          <el-button
            v-for="item in words[tabItem.value]"
            :key="item.word"
            class="word-item"
            :color="tabItem.color"
            size="small"
            plain
            @click="onWordClick(item)"
          >
            <span>{{ item.word }}</span
            ><span>{{ item.count }}</span></el-button
          >
        </div>
        <div v-else class="empty-wrapper">
          <EmptyHelp />
        </div>
      </el-tab-pane>
    </el-tabs>
  </el-main>
</template>

<style lang="scss">
.page-words {
  .word-list {
    display: flex;
    flex-wrap: wrap;
    justify-content: flex-start;
    align-items: center;
    gap: 10px;
  }

  .word-item {
    margin: 0;
    min-width: 140px;

    > span {
      width: 100%;
      display: inline-flex;
      justify-content: space-between;
      align-items: center;
    }
  }
  .empty-wrapper {
    width: 100%;
    height: calc(100vh - 140px);
    position: relative;
  }
}
</style>
