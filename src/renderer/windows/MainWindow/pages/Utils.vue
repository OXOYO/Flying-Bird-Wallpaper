<script setup>
import UseSettingStore from '@renderer/stores/settingStore.js'
import { useTranslation } from 'i18next-vue'
import { computed } from 'vue'

const { t } = useTranslation()

const settingStore = UseSettingStore()
const { settingData } = storeToRefs(settingStore)

const onSetDynamicWallpaper = async () => {
  const selectFileRes = await window.FBW.selectFile('video')
  const videoPath = selectFileRes && !selectFileRes.canceled ? selectFileRes.filePaths[0] : null
  if (!videoPath) {
    ElMessage({
      type: 'error',
      message: t('messages.operationFail')
    })
    return
  }
  const setRes = await window.FBW.setDynamicWallpaper(videoPath)
  ElMessage({
    type: setRes.success ? 'success' : 'error',
    message: setRes.message
  })
}

const utilGroups = ref([
  {
    name: 'wallpaperUtils',
    text: '壁纸工具',
    locale: 'pages.Utils.wallpaperUtils',
    children: [
      {
        name: 'setWebWallpaper',
        text: '设置网页壁纸',
        locale: 'pages.Utils.setWebWallpaper',
        confirm: true
      },
      {
        name: 'setColorWallpaper',
        text: '设置颜色壁纸',
        locale: 'pages.Utils.setColorWallpaper',
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
      },
      {
        name: 'openRhythmWallpaperWindow',
        text: '打开律动壁纸',
        locale: 'pages.Utils.openRhythmWallpaperWindow',
        confirm: true
      },
      {
        name: 'closeRhythmWallpaperWindow',
        text: '关闭律动壁纸',
        locale: 'pages.Utils.closeRhythmWallpaperWindow',
        confirm: true
      }
    ]
  },
  {
    name: 'dataUtils',
    text: '数据工具',
    locale: 'pages.Utils.dataUtils',
    children: [
      {
        name: 'clearCurrentResourceDB',
        text: '清空当前资源数据',
        locale: 'pages.Utils.clearCurrentResourceDB',
        confirm: true
      },
      {
        name: 'clearWordsDB',
        value: 'words',
        text: '清空词库数据',
        locale: 'pages.Utils.clearWordsDB',
        confirm: true
      },
      {
        name: 'clearFavoritesDB',
        value: 'favorites',
        text: '清空收藏数据',
        locale: 'pages.Utils.clearFavoritesDB',
        confirm: true
      },
      {
        name: 'clearHistoryDB',
        value: 'history',
        text: '清空回忆数据',
        locale: 'pages.Utils.clearHistoryDB',
        confirm: true
      },
      {
        name: 'clearStatisticsDB',
        value: 'statistics',
        text: '清空统计数据',
        locale: 'pages.Utils.clearStatisticsDB',
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
      }
    ]
  },
  {
    name: 'fileUtils',
    text: '文件工具',
    locale: 'pages.Utils.fileUtils',
    children: [
      {
        name: 'refreshDirectory',
        text: '刷新资源目录数据',
        locale: 'pages.Utils.refreshDirectory',
        confirm: true
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
        name: 'openDownloadDir',
        value: 'download',
        text: '打开下载目录',
        locale: 'pages.Utils.openDownloadDir',
        confirm: false
      },
      {
        name: 'openPluginsDir',
        value: 'plugins',
        text: '打开自定义插件目录',
        locale: 'pages.Utils.openPluginsDir',
        confirm: false
      }
    ]
  }
])

const utilList = computed(() => {
  return utilGroups.value.flatMap((group) => group.children)
})

const onExec = (name) => {
  let funcName = name
  let args = []
  const util = utilList.value.find((item) => item.name === name)
  switch (name) {
    case 'clearCurrentResourceDB': {
      funcName = 'clearDB'
      const resourceName = settingData.value.resourceName
      if (['resources', 'favorites'].includes(resourceName)) {
        args = [resourceName]
      } else {
        args = ['resources', resourceName]
      }
      break
    }
    case 'clearWordsDB':
    case 'clearHistoryDB':
    case 'clearFavoritesDB':
    case 'clearStatisticsDB':
      funcName = 'clearDB'
      args = [util.value]
      break
    case 'openDatabaseDir':
    case 'openLogsDir':
    case 'openDownloadDir':
    case 'openPluginsDir':
      funcName = 'openDir'
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

  const handler = async () => {
    if (util.handle) {
      util.handle(...args)
      return
    } else {
      ElMessage({
        type: 'success',
        message: t('messages.operationInProgress')
      })
      const res = await window.FBW[funcName](...args)
      if (res) {
        ElMessage({
          type: res.success ? 'success' : 'error',
          message: res.message
        })
      }
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
      .catch(() => {})
  }
}
</script>

<template>
  <el-main class="page-utils">
    <el-scrollbar style="height: calc(100vh - 56px)">
      <div v-for="group in utilGroups" :key="group.name" class="utils-block form-card">
        <div class="divider">{{ t(group.locale) }}</div>
        <div
          v-for="(item, index) in group.children"
          :key="item.name"
          class="utils-item"
          @click="onExec(item.name)"
        >
          <div class="utils-item-text">{{ $t(item.locale) }}</div>
          <IconifyIcon class="utils-item-icon" icon="custom:arrow-forward-ios-rounded" />
        </div>
      </div>
    </el-scrollbar>
  </el-main>
</template>

<style scoped lang="scss">
.page-utils {
  display: inline-block;
  width: 100%;
  padding: 0 20px;
}
.utils-block {
  display: inline-block;
  width: 100%;
}
.utils-item {
  width: 100%;
  position: relative;
  overflow: hidden;
  border-radius: 6px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px;
  cursor: pointer;

  &:hover {
    background-color: #f2f2f2;
  }
  &:active {
    opacity: 0.8;
  }
}
.utils-item-text {
  display: inline-block;
  font-size: 14px;
  color: var(--el-text-color-regular);
  font-weight: 400;
  line-height: 1;
}
.utils-item-icon {
  font-size: 18px;
  color: var(--el-text-color-regular);
}
</style>
