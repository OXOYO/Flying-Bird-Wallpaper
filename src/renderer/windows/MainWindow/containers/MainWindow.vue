<script setup>
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

const onJumpToPageCallback = (event, key) => {
  menuStore.setSelected(key)
}

onBeforeMount(() => {
  window.FBW.onJumpToPage(onJumpToPageCallback)
})

onMounted(() => {
  void window.FBW?.notifyMainUiReady?.()
  const menu =
    settingData.value.defaultMenu === 'LastMenu'
      ? settingData.value.selectedMenu
      : settingData.value.defaultMenu
  menuStore.setSelected(menu || 'Search')
})

onBeforeUnmount(() => {
  window.FBW.offJumpToPage(onJumpToPageCallback)
})
</script>

<template>
  <el-container class="window-container">
    <el-aside class="window-side-wrapper" :width="settingData.expandSideMenu ? '70px' : '0'">
      <SideMenu v-if="settingData.expandSideMenu" />
      <button
        v-if="settingData.enableExpandSideMenu"
        type="button"
        class="side-expand-btn"
        :class="{ 'is-collapsed': !settingData.expandSideMenu }"
        :aria-expanded="settingData.expandSideMenu"
        @click="toggleExpandSideMenu"
      >
        <IconifyIcon
          class="expand-btn-icon"
          :icon="settingData.expandSideMenu ? 'custom:caret-left' : 'custom:caret-right'"
        />
      </button>
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

  &:hover .side-expand-btn {
    visibility: visible;
    opacity: 1;
  }
}

.window-side-wrapper {
  position: relative;
  z-index: 25;
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
  visibility: hidden;
  opacity: 0;
  display: flex;
  justify-content: center;
  align-items: center;
  position: absolute;
  z-index: 10;
  top: 50%;
  right: -18px;
  width: 18px;
  min-height: 44px;
  padding: 8px 0;
  margin: 0;
  transform: translate(0, -50%);
  border: none;
  border-top-right-radius: 50%;
  border-bottom-right-radius: 50%;
  color: var(--el-text-color-secondary);
  background-color: #f6f7f9;
  cursor: pointer;
  outline: none;
  overflow: visible;
  transition:
    visibility 0.2s ease,
    opacity 0.2s ease,
    color 0.2s ease;

  &::before {
    content: '';
    position: absolute;
    inset: -6px -8px -6px -4px;
  }

  &:hover {
    color: var(--el-color-primary);
    background-color: #f6f7f9;
  }

  &:active {
    color: var(--el-color-primary);
  }

  &:focus-visible {
    opacity: 1;
    visibility: visible;
    color: var(--el-color-primary);
    background-color: #f6f7f9;
    outline: 2px solid var(--el-color-primary-light-7);
    outline-offset: 1px;
  }

  &.is-collapsed {
    color: var(--el-color-primary);
    background-color: #f6f7f9;
  }

  .expand-btn-icon {
    position: relative;
    z-index: 1;
    font-size: 13px;
    pointer-events: none;
  }
}
</style>
