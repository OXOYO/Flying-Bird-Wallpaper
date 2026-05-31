<script setup>
import UseCommonStore from '@renderer/stores/commonStore.js'
import UseMenuStore from '@renderer/stores/menuStore.js'
import UseSettingStore from '@renderer/stores/settingStore.js'
import UseWordsStore from '@renderer/stores/wordsStore.js'
import InstantTooltip from '@renderer/components/InstantTooltip.vue'
import iconLogo from '@resources/icons/icon_64x64.png'
import QRCode from 'qrcode'
import clipboard from 'clipboardy'
import { useTranslation } from 'i18next-vue'

const menuStore = UseMenuStore()
const settingStore = UseSettingStore()
const wordsStore = UseWordsStore()
const commonStore = UseCommonStore()
const { selectedMenu, menuList } = storeToRefs(menuStore)
const { settingData } = storeToRefs(settingStore)
const { wordDrawerVisible } = storeToRefs(wordsStore)
const { toggleWordDrawerVisible } = wordsStore
const { commonData } = storeToRefs(commonStore)

const { t } = useTranslation()

/** 侧栏 tooltip 与触发元素间距（菜单 / 底部工具统一） */
const SIDE_TOOLTIP_OFFSET = 12
/** 二维码弹层与生成尺寸 */
const QR_POPOVER_WIDTH = 200
const QR_CODE_SIZE = 160

const hoverMenu = ref(null)

const qrCodeImg = ref(null)
const qrPopoverVisible = ref(false)

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    qrPopoverVisible.value = false
  })
}

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
        width: QR_CODE_SIZE,
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
  // 避免 link 按钮点击后残留 focus 描边（侧栏选中项出现方框）
  document.activeElement?.blur?.()
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

const toggleQrPopover = () => {
  qrPopoverVisible.value = !qrPopoverVisible.value
}

const onCopyH5ServerUrl = () => {
  const { h5ServerUrl } = commonData.value
  if (h5ServerUrl) {
    clipboard
      .write(h5ServerUrl)
      .then(() => {
        ElMessage({
          type: 'success',
          message: t('messages.copySuccess')
        })
      })
      .catch(() => {
        ElMessage({
          type: 'error',
          message: t('messages.copyFail')
        })
      })
  }
}
</script>

<template>
  <div class="side-menu">
    <custom-title-bar />
    <div class="side-logo">
      <img :src="iconLogo" alt="logo" />
    </div>
    <el-scrollbar style="height: auto; flex: 1">
      <InstantTooltip
        v-for="item in enabledMenus"
        :key="item.name"
        :content="$t(item.locale)"
        placement="right"
        :offset="SIDE_TOOLTIP_OFFSET"
        :disabled="settingData.showSideMenuLabel"
      >
        <el-button
          class="side-menu-btn"
          :class="{
            active: selectedMenu && selectedMenu.name === item.name,
            'side-menu-btn--icon-only': !settingData.showSideMenuLabel
          }"
          size="large"
          :type="
            (selectedMenu && selectedMenu.name === item.name) || item.name === hoverMenu
              ? 'primary'
              : ''
          "
          link
          :aria-label="$t(item.locale)"
          @click="onSelect(item.name)"
          @mouseenter="onOverMenu(item.name)"
          @mouseleave="onOutMenu()"
        >
          <div class="side-menu-btn__inner">
            <IconifyIcon
              class="side-menu-btn-icon"
              :class="{ 'side-menu-btn-icon_large': !settingData.showSideMenuLabel }"
              :icon="item.icon"
            />
            <div v-if="settingData.showSideMenuLabel" class="side-menu-btn-text">
              {{ $t(item.locale) }}
            </div>
          </div>
        </el-button>
      </InstantTooltip>
    </el-scrollbar>
    <div class="side-footer">
      <el-button
        v-if="enabledWordDraw"
        class="side-footer-btn"
        link
        :aria-label="$t('actions.wordDrawer')"
        @click="toggleWordDrawerVisible()"
      >
        <InstantTooltip
          :content="$t('actions.wordDrawer')"
          placement="right"
          :offset="SIDE_TOOLTIP_OFFSET"
        >
          <span class="side-footer-btn__hit">
            <IconifyIcon
              class="footer-btn-icon"
              :class="{ active: wordDrawerVisible }"
              icon="custom:cloud"
            />
          </span>
        </InstantTooltip>
      </el-button>
      <el-popover
        v-model:visible="qrPopoverVisible"
        placement="right"
        :width="QR_POPOVER_WIDTH"
        :offset="20"
        trigger="manual"
        popper-class="side-qr-popover"
      >
        <template #reference>
          <el-button
            class="side-footer-btn"
            link
            :aria-label="$t('actions.qrCode')"
            :aria-expanded="qrPopoverVisible"
            @click="toggleQrPopover"
          >
            <InstantTooltip
              :content="$t('actions.qrCode')"
              placement="right"
              :offset="SIDE_TOOLTIP_OFFSET"
              :disabled="qrPopoverVisible"
            >
              <span class="side-footer-btn__hit">
                <IconifyIcon
                  class="footer-btn-icon"
                  :class="{ active: commonData?.h5ServerUrl }"
                  icon="custom:qrcode"
                />
              </span>
            </InstantTooltip>
          </el-button>
        </template>
        <div class="qr-code-wrapper" @mousedown.stop @click.stop>
          <el-image
            :src="qrCodeImg"
            class="qr-code-image"
            :style="{ width: `${QR_CODE_SIZE}px`, height: `${QR_CODE_SIZE}px` }"
          >
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
          <div class="qr-code-link">
            <el-link :href="commonData.h5ServerUrl" target="_blank" class="qr-code-url">
              {{ commonData.h5ServerUrl }}
            </el-link>
            <IconifyIcon
              v-if="commonData.h5ServerUrl"
              class="qr-code-copy"
              icon="custom:copy"
              @click="onCopyH5ServerUrl"
            />
          </div>
          <div class="qr-code-title">{{ $t('qrCode.notice') }}</div>
          <el-button
            v-if="commonData.h5ServerUrl"
            class="qr-code-btn"
            type="danger"
            plain
            @click="onToolClick('stopH5Server')"
          >
            {{ $t('qrCode.stopH5Server') }}
          </el-button>
          <el-button
            v-else
            class="qr-code-btn"
            plain
            @click="onToolClick('startH5Server')"
          >
            {{ $t('qrCode.startH5Server') }}
          </el-button>
        </div>
      </el-popover>
      <el-button
        v-if="settingData.wallpaperType === 'dynamic'"
        class="side-footer-btn btn-close"
        link
        :aria-label="$t('actions.closeDynamicWallpaper')"
        @click="onToolClick('closeDynamicWallpaper')"
      >
        <InstantTooltip
          :content="$t('actions.closeDynamicWallpaper')"
          placement="right"
          :offset="SIDE_TOOLTIP_OFFSET"
        >
          <span class="side-footer-btn__hit">
            <IconifyIcon class="footer-btn-icon" icon="custom:close-circle" />
          </span>
        </InstantTooltip>
      </el-button>
      <el-button
        v-if="settingData.wallpaperType === 'rhythm'"
        class="side-footer-btn btn-close"
        link
        :aria-label="$t('actions.closeRhythmWallpaper')"
        @click="onToolClick('closeRhythmWallpaper')"
      >
        <InstantTooltip
          :content="$t('actions.closeRhythmWallpaper')"
          placement="right"
          :offset="SIDE_TOOLTIP_OFFSET"
        >
          <span class="side-footer-btn__hit">
            <IconifyIcon class="footer-btn-icon" icon="custom:close-circle" />
          </span>
        </InstantTooltip>
      </el-button>
      <el-button
        class="side-footer-btn"
        link
        :aria-label="
          settingData.autoSwitchWallpaper
            ? $t('actions.autoSwitchWallpaper.stop')
            : $t('actions.autoSwitchWallpaper.start')
        "
        @click="onToolClick('toggleAutoSwitchWallpaper')"
      >
        <InstantTooltip
          :content="
            settingData.autoSwitchWallpaper
              ? $t('actions.autoSwitchWallpaper.stop')
              : $t('actions.autoSwitchWallpaper.start')
          "
          placement="right"
          :offset="SIDE_TOOLTIP_OFFSET"
        >
          <span class="side-footer-btn__hit">
            <IconifyIcon
              class="footer-btn-icon"
              :class="{ active: settingData.autoSwitchWallpaper }"
              :icon="
                settingData.autoSwitchWallpaper
                  ? 'custom:pause-circle-outline-rounded'
                  : 'custom:play-circle-outline-rounded'
              "
            />
          </span>
        </InstantTooltip>
      </el-button>
      <el-button
        class="side-footer-btn"
        link
        :aria-label="$t('actions.nextWallpaper')"
        @click="onToolClick('nextWallpaper')"
      >
        <InstantTooltip
          :content="$t('actions.nextWallpaper')"
          placement="right"
          :offset="SIDE_TOOLTIP_OFFSET"
        >
          <span class="side-footer-btn__hit">
            <IconifyIcon class="footer-btn-icon" icon="custom:skip-next-outline-rounded" />
          </span>
        </InstantTooltip>
      </el-button>
      <el-button
        class="side-footer-btn"
        link
        :aria-label="$t('actions.prevWallpaper')"
        @click="onToolClick('prevWallpaper')"
      >
        <InstantTooltip
          :content="$t('actions.prevWallpaper')"
          placement="right"
          :offset="SIDE_TOOLTIP_OFFSET"
        >
          <span class="side-footer-btn__hit">
            <IconifyIcon class="footer-btn-icon" icon="custom:skip-previous-outline-rounded" />
          </span>
        </InstantTooltip>
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

  :deep(.instant-tooltip-trigger) {
    display: flex;
    width: 100%;
    justify-content: center;
  }
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
    will-change: transform;
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
  outline: none;

  &:focus,
  &:focus-visible {
    outline: none;
    box-shadow: none;
  }

  + .side-menu-btn {
    margin-left: 0;
  }

  &:hover {
    :deep(.side-menu-btn-icon),
    .side-menu-btn-text {
      color: var(--el-color-primary);
    }
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
  justify-content: flex-start;
  align-items: center;
  min-height: 46px;
}

.side-menu-btn--icon-only .side-menu-btn__inner {
  justify-content: center;
}
.side-menu-btn-icon {
  font-size: 20px;
  transition: all 0.3s ease-in-out;
  will-change: transform;

  &_large {
    font-size: 24px;
  }
}
.side-menu-btn-text {
  margin: 6px 0;
}

.side-footer {
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  align-items: center;
  width: 100%;
  padding-bottom: 18px;

  .side-footer-btn {
    display: flex;
    width: 100%;
    margin: 0;
    padding: 8px 0;
    justify-content: center;
    align-items: center;
    outline: none;

    &__hit {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      line-height: 1;
    }

    &:focus,
    &:focus-visible {
      outline: none;
      box-shadow: none;
    }

    &:hover {
      .footer-btn-icon {
        color: var(--el-color-primary);
      }
    }

    &:active {
      .footer-btn-icon {
        color: var(--el-color-primary);
      }
    }

    .footer-btn-icon {
      font-size: 30px;
      color: var(--el-text-color-regular);
      transition: color 0.2s ease;

      &.active {
        color: var(--el-color-success);
      }
    }

    &.btn-close {
      &:active {
        .footer-btn-icon {
          color: red;
        }
      }
    }
  }
}
</style>

<style lang="scss">
.side-qr-popover.el-popover {
  padding: 10px 12px !important;
}

.qr-code-wrapper {
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  gap: 6px;
  padding: 0;
  margin: 0;

  .qr-code-image {
    display: block;
  }

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

  .qr-code-link {
    display: flex;
    flex-direction: row;
    justify-content: center;
    align-items: center;
    width: 100%;
    max-width: 100%;
    padding: 0;
    margin: 0;
  }

  .qr-code-url {
    font-size: 12px;
    line-height: 1.3;
    word-break: break-all;
  }

  .qr-code-copy {
    margin-left: 5px;
    cursor: pointer;

    &:hover {
      color: var(--el-color-primary);
    }
    &:active {
      opacity: 0.6;
    }
  }

  .qr-code-title {
    width: 100%;
    text-align: center;
    font-size: 12px;
    line-height: 1.35;
    color: #909399;
    padding: 0;
    margin: 0;
  }

  .qr-code-btn {
    width: 100%;
    margin-top: 2px;
  }
}
</style>
