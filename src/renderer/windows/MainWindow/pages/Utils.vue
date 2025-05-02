<script setup>
import { storeToRefs } from 'pinia'
import UseSettingStore from '@renderer/stores/settingStore.js'
import UseMenuStore from '@renderer/stores/menuStore.js'
import { colorList } from '@common/publicData.js'
import { useTranslation } from 'i18next-vue'

const { t } = useTranslation()

const menuStore = UseMenuStore()
const settingStore = UseSettingStore()
const { settingData } = storeToRefs(settingStore)

const onSetDynamicWallpaper = async () => {
  const selectFileRes = await window.FBW.selectFile('video')
  const videoPath = selectFileRes && !selectFileRes.canceled ? selectFileRes.filePaths[0] : null
  console.log('videoPath', videoPath)
  if (!videoPath) {
    ElMessage({
      type: 'error',
      message: t('messages.operationFail')
    })
    return
  }
  const setRes = await window.FBW.setDynamicWallpaper(videoPath)
  console.log('setRes', setRes)
  ElMessage({
    type: setRes.success ? 'success' : 'error',
    message: setRes.message
  })
}

const openPage = (name) => {
  menuStore.setSelected(name)
}

const utilList = ref([
  {
    name: 'refreshDirectory',
    text: '刷新资源目录数据',
    locale: 'pages.Utils.refreshDirectory',
    confirm: true
  },
  {
    name: 'clearCurrentResourceDB',
    text: '清空当前资源数据',
    locale: 'pages.Utils.clearCurrentResourceDB',
    confirm: true
  },
  {
    name: 'clearWordsDB',
    text: '清空词库数据',
    locale: 'pages.Utils.clearWordsDB',
    confirm: true
  },
  {
    name: 'clearFavoritesDB',
    text: '清空收藏数据',
    locale: 'pages.Utils.clearFavoritesDB',
    confirm: true
  },
  {
    name: 'clearHistoryDB',
    text: '清空回忆数据',
    locale: 'pages.Utils.clearHistoryDB',
    confirm: true
  },
  {
    name: 'clearCache',
    text: '清空缓存数据',
    locale: 'pages.Utils.clearCache',
    confirm: true
  },
  {
    name: 'clearDownloadedAll',
    text: '清空所有下载数据',
    locale: 'pages.Utils.clearDownloadedAll',
    confirm: true
  },
  {
    name: 'clearDownloadedExpired',
    text: '清空过期下载数据',
    locale: 'pages.Utils.clearDownloadedExpired',
    confirm: true
  },
  {
    name: 'nextWallpaper',
    text: '下一个壁纸',
    locale: 'pages.Utils.nextWallpaper',
    confirm: false
  },
  {
    name: 'prevWallpaper',
    text: '上一个壁纸',
    locale: 'pages.Utils.prevWallpaper',
    confirm: false
  },
  {
    name: 'openDatabaseDir',
    value: 'database',
    text: '打开数据库目录',
    locale: 'pages.Utils.openDatabaseDir',
    confirm: false
  },
  {
    name: 'openLogsDir',
    value: 'logs',
    text: '打开日志目录',
    locale: 'pages.Utils.openLogsDir',
    confirm: false
  },
  {
    name: 'openPluginsDir',
    value: 'plugins',
    text: '打开自定义插件目录',
    locale: 'pages.Utils.openPluginsDir',
    confirm: false
  },
  {
    name: 'startH5Server',
    text: '启动H5服务器',
    locale: 'pages.Utils.startH5Server',
    confirm: true
  },
  {
    name: 'stopH5Server',
    text: '停止H5服务器',
    locale: 'pages.Utils.stopH5Server',
    confirm: true
  },
  {
    name: 'setWebWallpaper',
    text: '设置网页壁纸',
    locale: 'pages.Utils.setWebWallpaper',
    confirm: true
  },
  {
    name: 'setDynamicWallpaper',
    text: '设置动态壁纸',
    locale: 'pages.Utils.setDynamicWallpaper',
    handle: onSetDynamicWallpaper
  },
  {
    name: 'closeDynamicWallpaper',
    text: '关闭动态壁纸',
    locale: 'pages.Utils.closeDynamicWallpaper',
    confirm: true
  }
])

const onExec = (name) => {
  let funcName
  let args = []
  const util = utilList.value.find((item) => item.name === name)
  switch (name) {
    case 'clearCurrentResourceDB':
      funcName = 'doClearDB'
      const resourceName = settingData.value.resourceName
      if (['resources', 'favorites'].includes(resourceName)) {
        args = [resourceName]
      } else {
        args = ['resources', resourceName]
      }
      break
    case 'clearWordsDB':
      funcName = 'doClearDB'
      args = ['words']
      break
    case 'clearHistoryDB':
      funcName = 'doClearDB'
      args = ['history']
      break
    case 'clearFavoritesDB':
      funcName = 'doClearDB'
      args = ['favorites']
      break
    case 'clearCache':
      funcName = 'clearCache'
      break
    case 'clearDownloadedAll':
      funcName = 'clearDownloadedAll'
      break
    case 'clearDownloadedExpired':
      funcName = 'clearDownloadedExpired'
      break
    case 'refreshDirectory':
      funcName = 'refreshDirectory'
      break
    case 'nextWallpaper':
      funcName = 'nextWallpaper'
      break
    case 'prevWallpaper':
      funcName = 'prevWallpaper'
      break
    case 'openDatabaseDir':
    case 'openLogsDir':
    case 'openPluginsDir':
      funcName = 'openDir'
      args = [util.value]
      break
    case 'startH5Server':
      funcName = 'startH5Server'
      break
    case 'stopH5Server':
      funcName = 'stopH5Server'
      break
    case 'setWebWallpaper':
      funcName = 'setWebWallpaper'
      break
    case 'setDynamicWallpaper':
      args = []
      break
    case 'closeDynamicWallpaper':
      funcName = 'closeDynamicWallpaper'
      break
    case 'openPage':
      args = [util.value]
      break
  }
  if (!util.handle && typeof window.FBW[funcName] !== 'function') {
    ElMessage({
      type: 'error',
      message: t('messages.operationIllegal')
    })
    return
  }

  const handler = () => {
    if (util.handle) {
      util.handle(...args)
      return
    } else {
      window.FBW[funcName](...args)
      ElMessage({
        type: 'success',
        message: t('messages.operationInProgress')
      })
    }
  }
  if (!util.confirm) {
    handler()
  } else {
    let text = util.locale
      ? t('messages.confirmMessageTemplate', { text: t(util.locale) })
      : t('messages.confirmMessageDanger')
    ElMessageBox.confirm(text, {
      type: 'warning',
      draggable: true,
      dangerouslyUseHTMLString: true
    })
      .then(() => {
        handler()
      })
      .catch(() => {
        ElMessage({
          type: 'info',
          message: t('messages.operationFail')
        })
      })
  }
}
</script>

<template>
  <el-main class="page-utils">
    <div class="utils-block form-card">
      <div
        v-for="(item, index) in utilList"
        :key="item.name"
        class="utils-item"
        :style="{ 'background-color': colorList[index] || '#FF8A80' }"
      >
        <div class="utils-item-text">
          <IconifyIcon icon="ep:warning-filled" style="vertical-align: middle; margin-right: 5px" />
          <span style="vertical-align: middle">{{ $t(item.locale) }}</span>
        </div>
        <div class="utils-item-action" @click="onExec(item.name)">
          <IconifyIcon icon="mdi:play" style="font-size: 50px; color: var(--el-color-primary)" />
        </div>
      </div>
    </div>
  </el-main>
</template>

<style scoped lang="scss">
.page-utils {
  padding: 0 20px;
}
.utils-block {
  display: grid;
  /* 使用 auto-fit 和 minmax 实现自动换行 */
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  /* 当元素在单行时水平垂直居中对齐 */
  justify-items: center;
  align-items: center;
  gap: 10px;
}
.utils-item {
  width: 100%;
  height: 120px;
  background-color: #ff8a80;
  border-radius: 6px;
  position: relative;
  overflow: hidden;

  &:hover {
    .utils-item-action {
      transform: translate(0, 0);
    }
  }
}
.utils-item-text {
  padding: 20px;
  font-size: 14px;
  font-weight: 800 !important;
  color: #ffffff;
  line-height: 1;
}

.utils-item-action {
  position: absolute;
  left: 0;
  bottom: 0;
  transform: translate(0, 100%);
  z-index: 10;
  width: 100%;
  height: 60%;
  line-height: 1;
  will-change: transform;
  transition: transform 0.2s ease-in-out;
  background-color: rgba(255, 255, 255, 0.5);
  display: flex;
  justify-content: center;
  align-items: center;
  cursor: pointer;

  &:active {
    opacity: 0.8;
  }
}
</style>
