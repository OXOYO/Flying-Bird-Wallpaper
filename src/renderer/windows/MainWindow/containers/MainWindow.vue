<script setup>
import { storeToRefs } from 'pinia'
import UseSettingStore from '@renderer/stores/settingStore.js'
import UseMenuStore from '@renderer/stores/menuStore.js'
import SideMenu from '../components/SideMenu.vue'
import MainContainer from '../components/MainContainer.vue'

const settingStore = UseSettingStore()
const menuStore = UseMenuStore()
const { settingData } = storeToRefs(settingStore)

const toggleExpandSideMenu = async () => {
  const expandSideMenu = !settingData.value.expandSideMenu

  const res = await window.FBW.updateSettingData({
    expandSideMenu
  })
  if (res && res.success) {
    settingStore.updateSettingData(res.data)
  }
}

onMounted(() => {
  // 设置菜单默认选中
  menuStore.setSelected('Search')
})
</script>

<template>
  <el-container class="window-container">
    <el-aside class="window-side-wrapper" :width="settingData.expandSideMenu ? '70px' : '0'">
      <SideMenu v-if="settingData.expandSideMenu" />
      <div
        v-if="settingData.enableExpandSideMenu"
        class="side-expand-btn"
        @click="toggleExpandSideMenu"
      >
        <IconifyIcon
          class="expand-btn-icon"
          :icon="settingData.expandSideMenu ? 'ep:caret-left' : 'ep:caret-right'"
        />
      </div>
    </el-aside>
    <el-main class="window-main-wrapper">
      <MainContainer />
    </el-main>
  </el-container>
</template>

<style scoped lang="scss">
.window-container {
  width: 100%;
  height: 100%;
}
.window-side-wrapper {
  position: relative;
  height: 100%;
  overflow: unset;
  transition: all 0.3s ease-in-out;
}
.window-main-wrapper {
  height: 100%;
  padding: 0;
  background-color: #efefef;
}

.side-expand-btn {
  display: flex;
  justify-content: center;
  align-items: center;
  position: absolute;
  z-index: 10;
  top: 50%;
  right: -18px;
  width: 18px;
  transform: translate(0, -50%);
  color: var(--primary-color);
  backdrop-filter: blur(4px);
  background-color: rgba(255, 255, 255, 0.5);
  border-top-right-radius: 50%;
  border-bottom-right-radius: 50%;
  padding: 5px 0;
  margin: 0;
  overflow: hidden;

  &:hover {
    background-color: rgba(255, 255, 255, 0.6);
  }

  &:active {
    background-color: rgba(255, 255, 255, 0.8);
  }

  .expand-btn-icon {
    cursor: pointer;
    font-size: 30px;
  }
}
</style>
