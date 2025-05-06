<script setup>
import { storeToRefs } from 'pinia'
import UseSettingStore from '@renderer/stores/settingStore.js'
import UseMenuStore from '@renderer/stores/menuStore.js'
import UseWordsStore from '@renderer/stores/wordsStore.js'
import UseCommonStore from '@renderer/stores/commonStore.js'
import iconLogo from '@resources/icons/icon_64x64.png'
import QRCode from 'qrcode'

const menuStore = UseMenuStore()
const settingStore = UseSettingStore()
const wordsStore = UseWordsStore()
const commonStore = UseCommonStore()
const { selectedMenu, menuList } = storeToRefs(menuStore)
const { settingData } = storeToRefs(settingStore)
const { wordDrawerVisible } = storeToRefs(wordsStore)
const { toggleWordDrawerVisible } = wordsStore
const { commonData } = storeToRefs(commonStore)

const hoverMenu = ref(null)

const qrCodeImg = ref(null)

// 启用的菜单列表
const enabledMenus = computed(() => {
  const list = menuList.value.filter((item) => item.placement.includes('sideMenu'))
  if (
    !settingData.value ||
    !Array.isArray(settingData.value?.enabledMenus) ||
    !settingData.value?.enabledMenus?.length
  ) {
    return list
  }
  return list.filter((item) => {
    if (item.canBeEnabled) {
      return settingData.value.enabledMenus.includes(item.name)
    }
    return true
  })
})

// 是否启用WordDraw
const enabledWordDraw = computed(() => {
  // 词云菜单
  const WordsMenu = enabledMenus.value.find((item) => item.name === 'Words')
  return WordsMenu && selectedMenu.value && selectedMenu.value.name === 'Search'
})

watch(
  commonData,
  () => {
    if (commonData.value && commonData.value.h5ServerUrl) {
      QRCode.toDataURL(commonData.value.h5ServerUrl, {
        errorCorrectionLevel: 'H', // 高容错级别
        margin: 4, // 边距
        width: 200, // 确保生成的图像足够大
        color: {
          dark: '#000000', // 二维码颜色
          light: '#ffffff' // 背景色
        }
      })
        .then((url) => {
          qrCodeImg.value = url
        })
        .catch((err) => {
          console.error(err)
        })
    } else {
      qrCodeImg.value = null
    }
  },
  { deep: true, immediate: true }
)

const onSelect = (key) => {
  if (!key) {
    return
  }
  menuStore.setSelected(key)
}

const onOverMenu = (key) => {
  hoverMenu.value = key
}
const onOutMenu = () => {
  hoverMenu.value = null
}

const onToolClick = async (funcName) => {
  if (typeof window.FBW[funcName] === 'function') {
    await window.FBW[funcName]()
  }
}

const onJumpToPageCallback = (event, key) => {
  onSelect(key)
}
onBeforeMount(() => {
  // 监听主进程的页面跳转事件
  window.FBW.onJumpToPage(onJumpToPageCallback)
})

onBeforeUnmount(() => {
  // 取消监听主进程的页面跳转事件
  window.FBW.offJumpToPage(onJumpToPageCallback)
})
</script>

<template>
  <div class="side-menu">
    <custom-title-bar />
    <div class="side-logo">
      <img :src="iconLogo" alt="logo" />
    </div>
    <el-scrollbar style="height: auto; flex: 1">
      <el-button
        v-for="item in enabledMenus"
        :key="item.name"
        class="side-menu-btn"
        :class="{ active: selectedMenu && selectedMenu.name === item.name }"
        size="large"
        :type="
          (selectedMenu && selectedMenu.name === item.name) || item.name === hoverMenu
            ? 'primary'
            : ''
        "
        link
        @click="onSelect(item.name)"
        @mouseenter="onOverMenu(item.name)"
        @mouseleave="onOutMenu()"
      >
        <div class="side-menu-btn__inner">
          <IconifyIcon class="side-menu-btn-icon" :icon="item.icon" />
          <div class="side-menu-btn-text" :class="{ 'show-text': settingData.showSideMenuLabel }">
            {{ $t(item.locale) }}
          </div>
        </div>
      </el-button>
    </el-scrollbar>
    <div class="side-footer">
      <el-button
        v-if="enabledWordDraw"
        class="side-footer-btn"
        :title="$t('actions.wordDrawer')"
        size="large"
        link
        @click="toggleWordDrawerVisible()"
      >
        <IconifyIcon
          class="footer-btn-icon"
          :class="{ active: wordDrawerVisible }"
          icon="ep:mostly-cloudy"
        />
      </el-button>
      <el-tooltip effect="light" placement="right" :offset="20" trigger="click">
        <el-button class="side-footer-btn" size="large" link :title="$t('actions.qrCode')">
          <IconifyIcon
            class="footer-btn-icon"
            :class="{ active: commonData?.h5ServerUrl }"
            icon="mdi:qrcode"
          />
        </el-button>
        <template #content>
          <div class="qr-code-wrapper">
            <el-image :src="qrCodeImg" style="width: 200px; height: 200px">
              <template #placeholder>
                <div class="qr-code-placeholder">
                  {{ $t('qrCode.imgPlaceholder') }}
                </div>
              </template>
              <template #error>
                <div class="qr-code-error">
                  {{ $t('qrCode.imgError') }}
                </div>
              </template>
            </el-image>
            <el-link :href="commonData.h5ServerUrl" target="_blank" style="height: 20px">
              {{ commonData.h5ServerUrl }}
            </el-link>
            <div class="qr-code-title">{{ $t('qrCode.notice') }}</div>
            <el-button
              v-if="commonData.h5ServerUrl"
              class="qr-code-btn"
              :title="$t('qrCode.stopH5Server')"
              size="large"
              type="danger"
              plain
              @click="onToolClick('stopH5Server')"
            >
              {{ $t('qrCode.stopH5Server') }}
            </el-button>
            <el-button
              v-else
              class="qr-code-btn"
              :title="$t('qrCode.startH5Server')"
              size="large"
              plain
              @click="onToolClick('startH5Server')"
            >
              {{ $t('qrCode.startH5Server') }}
            </el-button>
          </div>
        </template>
      </el-tooltip>
      <el-button
        class="side-footer-btn"
        :title="
          settingData.autoSwitchWallpaper
            ? $t('actions.autoSwitchWallpaper.stop')
            : $t('actions.autoSwitchWallpaper.start')
        "
        size="large"
        link
        @click="onToolClick('toggleAutoSwitchWallpaper')"
      >
        <IconifyIcon
          class="footer-btn-icon"
          :class="{ active: settingData.autoSwitchWallpaper }"
          :icon="
            settingData.autoSwitchWallpaper
              ? 'material-symbols:pause-circle-outline-rounded'
              : 'material-symbols:play-circle-outline-rounded'
          "
        />
      </el-button>
      <el-button
        class="side-footer-btn"
        :title="$t('actions.nextWallpaper')"
        link
        @click="onToolClick('nextWallpaper')"
      >
        <IconifyIcon class="footer-btn-icon" icon="material-symbols:skip-next-outline-rounded" />
      </el-button>
      <el-button
        class="side-footer-btn"
        :title="$t('actions.prevWallpaper')"
        link
        @click="onToolClick('prevWallpaper')"
      >
        <IconifyIcon
          class="footer-btn-icon"
          icon="material-symbols:skip-previous-outline-rounded"
        />
      </el-button>
    </div>
  </div>
</template>

<style scoped lang="scss">
.side-menu {
  display: flex;
  justify-content: flex-start;
  align-items: center;
  flex-direction: column;
  height: 100%;
  background-color: #f6f7f9;
}
.side-logo {
  display: flex;
  justify-content: center;
  align-items: center;
  width: 100%;
  height: 50px;
  margin-bottom: 15px;

  img {
    width: 40px;
    height: 40px;
    transition: all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
  }

  &:hover {
    img {
      transform: scale(1.15) rotate(5deg);
    }
  }
}
.side-menu-btn {
  width: 100%;
  margin: 0;
  padding: 5px 0;

  + .side-menu-btn {
    margin-left: 0;
  }

  &.active {
    .side-menu-btn-icon {
      font-weight: bolder;
    }
    .side-menu-btn-text {
      font-weight: bolder;
    }
  }
}
.side-menu-btn__inner {
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
}
.side-menu-btn-icon {
  font-size: 20px;
}
.side-menu-btn-text {
  margin: 6px 0;
  visibility: hidden;
}

.show-text {
  visibility: visible;
}

.side-footer {
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  align-items: center;
  width: 100%;
  padding-bottom: 15px;

  .side-footer-btn {
    margin: 0;

    &:hover {
      opacity: 0.8;
    }

    &:active {
      opacity: 0.6;
      .footer-btn-icon {
        color: #67c23a;
      }
    }

    .footer-btn-icon {
      font-size: 30px;
      color: inherit;

      &.active {
        color: #67c23a;
      }
    }
  }
}
</style>

<style lang="scss">
.qr-code-wrapper {
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  padding: 0;
  margin: 0;

  .qr-code-placeholder,
  .qr-code-error {
    width: 100%;
    height: 100%;
    display: flex;
    justify-content: center;
    align-items: center;
    background-color: #f6f7f9;
    font-size: 12px;
    color: #909399;
    text-align: center;
    padding: 0;
    margin: 0;
  }
  .qr-code-error {
    color: #f56c6c;
  }

  .qr-code-title {
    width: 100%;
    text-align: center;
    padding: 0;
    margin: 0;
  }

  .qr-code-btn {
    width: 100%;
    margin-top: 10px;
  }
}
</style>
