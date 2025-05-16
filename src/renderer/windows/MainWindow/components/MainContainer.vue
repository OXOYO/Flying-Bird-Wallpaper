<script setup>
import UseMenuStore from '@renderer/stores/menuStore.js'
import Explore from '../pages/Explore.vue'
import Search from '../pages/Search.vue'
import Favorites from '../pages/Favorites.vue'
import History from '../pages/History.vue'
import Words from '../pages/Words.vue'
import Setting from '../pages/Setting.vue'
import Utils from '../pages/Utils.vue'
import About from '../pages/About.vue'

const menuStore = UseMenuStore()
const { selectedMenu } = storeToRefs(menuStore)

const componentDict = {
  Explore,
  Search,
  Favorites,
  History,
  Words,
  Setting,
  Utils,
  About
}
</script>

<template>
  <div class="main-container">
    <custom-title-bar :resize-window="true" window-name="mainWindow" />
    <el-scrollbar style="height: calc(100% - 35px)">
      <Transition name="fade" mode="out-in">
        <template v-if="selectedMenu && selectedMenu.name">
          <component
            :is="componentDict[selectedMenu.name]"
            :key="selectedMenu.key"
            :menu-params="selectedMenu.params"
          />
        </template>
      </Transition>
    </el-scrollbar>
  </div>
</template>

<style scoped lang="scss">
.main-container {
  height: 100%;
}
</style>
