<script setup>
import UseSettingStore from '@renderer/stores/settingStore.js'
import UseMenuStore from '@renderer/stores/menuStore.js'
import UseCommonStore from '@renderer/stores/commonStore.js'
import {
  scaleTypesByOS,
  intervalUnits,
  unitToValField,
  qualityList,
  orientationOptions,
  switchTypeOptions,
  sortFieldOptions,
  sortTypeOptions,
  allowedFileExtList,
  colorList,
  dynamicPerformanceModeOptions,
  dynamicScaleModeOptions,
  rhythmEffectOptions,
  rhythmAnimationOptions,
  rhythmDensityOptions,
  positionOptions
} from '@common/publicData.js'
import { localeOptions } from '@i18n/locale/index.js'
import { useTranslation } from 'i18next-vue'

const { t } = useTranslation()
const menuStore = UseMenuStore()
const commonStore = UseCommonStore()
const settingStore = UseSettingStore()
const { menuList } = storeToRefs(menuStore)
const { commonData, resourceMap } = storeToRefs(commonStore)
const { settingData } = storeToRefs(settingStore)

const activeTab = ref('baseSetting')
const baseSettingsScrollbarRef = ref(null)
const settingDataFormRef = ref(null)
const privacyPasswordFormRef = ref(null)
const settingDataForm = reactive({
  ...toRaw(settingStore.settingData)
})
const privacyPasswordForm = reactive({
  old: '',
  new: ''
})

const privacyPasswordView = reactive({
  new: false,
  old: false
})

// 最小时间
const minTimes = reactive({
  switchIntervalUnit: 1,
  refreshDirectoryIntervalUnit: 1,
  downloadIntervalUnit: 1,
  clearDownloadedExpiredUnit: 1,
  viewImageIntervalUnit: 1
})

const osType = commonData.value?.osType || 'win'
const scaleTypes = scaleTypesByOS[osType]

const maxFolderCount = 5

const maxColorCount = 20

const flags = reactive({
  saving: false,
  selectFolder: false,
  settingWebWallpaper: false,
  settingColorWallpaper: false,
  settingDynamicWallpaper: false,
  settingRhythmWallpaper: false
})

// 可以启用/停用的菜单列表
const canBeEnabledMenus = computed(() => {
  return menuList.value.filter((item) => item.canBeEnabled)
})

const anchorContainer = computed(() => {
  if (baseSettingsScrollbarRef.value) {
    return baseSettingsScrollbarRef.value.$el.querySelector('.el-scrollbar__wrap')
  } else {
    return null
  }
})

watch(
  () => settingData.value,
  (newValue) => {
    if (newValue) {
      Object.keys(newValue).forEach((key) => {
        settingDataForm[key] = newValue[key]
      })
    }
  }
)

// 初始化最小时间
const initMinTimes = () => {
  const unitFields = Object.keys(intervalUnits)
  unitFields.forEach((unitField) => {
    const unitValue = settingDataForm[unitField]
    handleMinTimesByUnit(unitField, unitValue)
  })
}

// 按单位更新最小时间
const handleMinTimesByUnit = (unitField, unitValue) => {
  const units = intervalUnits[unitField] || []
  const target = units.find((item) => item.value === unitValue)
  minTimes[unitField] = target ? target.min : 1
}

// 切换时间单位时处理最小时间与值
const onTimeUnitChange = (unitField, unitValue) => {
  handleMinTimesByUnit(unitField, unitValue)
  // 处理表单
  const valueField = unitToValField[unitField]
  if (settingDataForm[valueField] < minTimes[unitField]) {
    settingDataForm[valueField] = minTimes[unitField]
  }
  onSettingDataFormChange()
}

const onLocaleChange = () => {
  settingDataForm.isLocaleSet = true
  onSettingDataFormChange()
}

const onSettingDataFormChange = (field) => {
  // 处理互斥字段
  if (field === 'autoSwitchWallpaper') {
    settingDataForm.autoRefreshWebWallpaper = false
  } else if (field === 'autoRefreshWebWallpaper') {
    settingDataForm.autoSwitchWallpaper = false
  }
  onSettingDataFormConfirm()
}

const onSuspensionBallVisibleChange = async (val) => {
  const res = await onSettingDataFormConfirm()
  // 更新完设置数据后切换悬浮球显示隐藏，并且不再更新设置数据
  if (res) {
    if (val) {
      await window.FBW.openSuspensionBall(false)
    } else {
      await window.FBW.closeSuspensionBall(false)
    }
  }
}

const onSettingDataFormConfirm = () => {
  const formEl = settingDataFormRef.value
  if (!formEl || flags.saving) return false
  return formEl.validate(async (valid) => {
    if (valid) {
      flags.saving = true
      const res = await window.FBW.updateSettingData(toRaw(settingDataForm))
      flags.saving = false
      let options = {}
      let ret = false
      if (res && res.success) {
        options.type = 'success'
        options.message = res.message
        settingStore.updateSettingData(res.data)
        ret = true
      } else {
        options.type = 'error'
        options.message = res.message
      }
      ElMessage(options)
      return ret
    } else {
      return false
    }
  })
}

// const onSettingDataFormReset = (formEl) => {
//   if (!formEl) return
//   formEl.resetFields()
// }

const openSelectFolderDialog = async (field, index) => {
  if (flags.selectFolder) {
    return
  }
  flags.selectFolder = true
  const { canceled, filePaths } = await window.FBW.selectFolder(field)
  if (!field || canceled) {
    flags.selectFolder = false
    return
  }
  const folderPath = filePaths[0] || ''
  let flag = false
  if (index !== undefined) {
    if (Array.isArray(settingDataForm[field]) && !settingDataForm[field].includes(folderPath)) {
      flag = true
      settingDataForm[field][index] = folderPath
    } else {
      ElMessage({
        type: 'error',
        message: t('messages.folderAlreadyExist')
      })
    }
  } else {
    flag = true
    settingDataForm[field] = folderPath
  }
  flags.selectFolder = false
  if (flag) {
    onSettingDataFormChange()
  }
}

const onAddFolder = (field) => {
  openSelectFolderDialog(field, settingDataForm[field].length)
}

const onRemoveFolder = (field, index) => {
  if (field === 'localResourceFolders') {
    if (Array.isArray(settingDataForm[field])) {
      settingDataForm[field].splice(index, 1)
    }
    if (!settingDataForm[field].length) {
      settingDataForm.autoRefreshDirectory = false
    }
  } else if (field === 'downloadFolder') {
    settingDataForm[field] = ''
    settingDataForm.autoDownload = false
  }
  onSettingDataFormChange()
}

const onOpenFolder = (folderPath) => {
  if (folderPath) {
    window.FBW.showItemInFolder(folderPath)
  }
}

const onAllowedFileExtChange = () => {
  // 如果没有勾选任何文件类型，则默认勾选所有类型
  if (!settingDataForm.allowedFileExt.length) {
    settingDataForm.allowedFileExt = [...allowedFileExtList]
  }
  onSettingDataFormChange()
}

const onSetWebWallpaper = async () => {
  flags.settingWebWallpaper = true
  const res = await window.FBW.setWebWallpaper()
  flags.settingWebWallpaper = false
  ElMessage({
    type: res.success ? 'success' : 'error',
    message: res.message
  })
}

const onSetColorWallpaper = async () => {
  flags.settingColorWallpaper = true
  const res = await window.FBW.setColorWallpaper()
  flags.settingColorWallpaper = false
  ElMessage({
    type: res.success ? 'success' : 'error',
    message: res.message
  })
}

const onSelectDynamicVideo = async () => {
  const selectFileRes = await window.FBW.selectFile('video')
  const videoPath = selectFileRes && !selectFileRes.canceled ? selectFileRes.filePaths[0] : null
  if (videoPath) {
    settingDataForm.dynamicLastVideoPath = videoPath
    onSettingDataFormChange()
  }
}

const onSetDynamicWallpaper = async () => {
  flags.settingDynamicWallpaper = true
  const res = await window.FBW.setDynamicWallpaper(settingData.value.dynamicLastVideoPath)
  flags.settingDynamicWallpaper = false
  ElMessage({
    type: res.success ? 'success' : 'error',
    message: res.message
  })
}

const onDynamicSettingChange = (field, value) => {
  onSettingDataFormChange()

  switch (field) {
    case 'dynamicBackgroundColor':
      window.FBW.setDynamicWallpaperBackgroundColor(value)
      break
    case 'dynamicOpacity':
      window.FBW.setDynamicWallpaperOpacity(value)
      break
    case 'dynamicBrightness':
      window.FBW.setDynamicWallpaperBrightness(value)
      break
    case 'dynamicContrast':
      window.FBW.setDynamicWallpaperContrast(value)
      break
    case 'dynamicPerformanceMode':
      window.FBW.setDynamicWallpaperPerformanceMode(value)
      break
    case 'dynamicScaleMode':
      window.FBW.setDynamicWallpaperScaleMode(value)
      break
  }
}

const onSetRhythmWallpaper = async () => {
  flags.settingRhythmWallpaper = true
  const res = await window.FBW.setRhythmWallpaper()
  flags.settingRhythmWallpaper = false
  ElMessage({
    type: res.success ? 'success' : 'error',
    message: res.message
  })
}

const onRhythmColorsChange = (index, val) => {
  if (!val) {
    onDeleteRhythmColors(index)
  } else {
    onSettingDataFormChange()
  }
}

const onDeleteRhythmColors = (index) => {
  settingDataForm.rhythmColors.splice(index, 1)
  onSettingDataFormChange()
}

const onAddRhythmColors = (index) => {
  settingDataForm.rhythmColors.push(colorList[0])
  onSettingDataFormChange()
}

const onThemeColorChange = (val) => {
  if (!val) {
    settingDataForm.themes.primary = colorList[0]
  }
  onSettingDataFormChange()
}

const onEnableExpandSideMenuChange = () => {
  settingDataForm.expandSideMenu = true
  onSettingDataFormChange()
}

const handlePasswordInput = (field, val) => {
  // 过滤非数值字符
  privacyPasswordForm[field] = val.replace(/[^\d]/g, '')
}

const togglePasswordView = (field) => {
  privacyPasswordView[field] = !privacyPasswordView[field]
}

// 处理下载关键词变化
const onDownloadKeywordsChange = (val) => {
  if (Array.isArray(val)) {
    // 去左右空格并去重
    const processed = val
      .map((item) => (typeof item === 'string' ? item.trim() : String(item)))
      .filter((item) => item.length > 0)
      .filter((item, index, self) => self.indexOf(item) === index)

    // 限制最多5个关键词
    const limited = processed.slice(0, 5)

    // 更新数据
    settingDataForm.downloadKeywords = limited
  }
  onSettingDataFormChange()
}

const onTabChange = (tab) => {
  let formEl
  switch (tab.paneName) {
    case 'baseSetting':
      formEl = settingDataFormRef.value
      break
    case 'privacySpace':
      formEl = privacyPasswordFormRef.value
      break
  }
  if (!formEl) return
  formEl.resetFields()
}
const onPrivacyPasswordFormConfirm = (formEl) => {
  if (!formEl) return
  formEl.validate(async (valid) => {
    if (valid) {
      const res = await window.FBW.updatePrivacyPassword(toRaw(privacyPasswordForm))
      let options = {
        type: 'success',
        message: t('messages.operationSuccess')
      }
      if (res && res.success) {
        options.type = 'success'
        options.message = res.message
        // 成功后清除表单数据
        formEl.resetFields()
      } else {
        options.type = 'error'
        options.message = res.message || t('messages.operationFail')
      }
      ElMessage(options)
    } else {
      return false
    }
  })
}

onMounted(() => {
  initMinTimes()
})

onBeforeUnmount(() => {
  settingDataFormRef.value.resetFields()
  privacyPasswordFormRef.value.resetFields()
})
</script>

<template>
  <el-main class="page-setting">
    <!-- tab页 -->
    <el-tabs v-model="activeTab" @tab-click="onTabChange">
      <el-tab-pane :label="t('pages.Setting.tabs.baseSetting')" name="baseSetting"></el-tab-pane>
      <el-tab-pane :label="t('pages.Setting.tabs.privacySpace')" name="privacySpace"></el-tab-pane>
    </el-tabs>
    <!-- 内容区域 -->
    <div v-show="activeTab === 'baseSetting'" class="base-settings-wrapper">
      <el-anchor
        class="anchor-block"
        :container="anchorContainer"
        direction="vertical"
        :offset="20"
        type="default"
      >
        <el-anchor-link
          class="anchor-link"
          href="#divider-base"
          :title="t('pages.Setting.divider.base')"
        >
          <template #sub-link>
            <el-anchor-link
              class="anchor-sub-link"
              href="#divider-app"
              :title="t('pages.Setting.divider.application')"
            />
            <el-anchor-link
              class="anchor-sub-link"
              href="#divider-function"
              :title="t('pages.Setting.divider.function')"
            />
            <el-anchor-link
              class="anchor-sub-link"
              href="#divider-explore"
              :title="t('pages.Setting.divider.explore')"
            />
          </template>
        </el-anchor-link>
        <el-anchor-link
          class="anchor-link"
          href="#divider-wallpaper"
          :title="t('pages.Setting.divider.wallpaper')"
        >
          <template #sub-link>
            <el-anchor-link
              class="anchor-sub-link"
              href="#divider-switch"
              :title="t('pages.Setting.divider.switch')"
            />
            <el-anchor-link
              class="anchor-sub-link"
              href="#divider-localResource"
              :title="t('pages.Setting.divider.localResource')"
            />
            <el-anchor-link
              class="anchor-sub-link"
              href="#divider-remoteResource"
              :title="t('pages.Setting.divider.remoteResource')"
            />
            <el-anchor-link class="anchor-sub-link" href="#divider-webWallpaper">
              <span style="vertical-align: middle">{{
                t('pages.Setting.divider.webWallpaper')
              }}</span>
              <IconifyIcon icon="custom:experiment-outline-sharp" style="vertical-align: middle" />
            </el-anchor-link>
            <el-anchor-link class="anchor-sub-link" href="#divider-colorWallpaper">
              <span style="vertical-align: middle">{{
                t('pages.Setting.divider.colorWallpaper')
              }}</span>
              <IconifyIcon icon="custom:experiment-outline-sharp" style="vertical-align: middle" />
            </el-anchor-link>
            <el-anchor-link class="anchor-sub-link" href="#divider-dynamicWallpaper">
              <span style="vertical-align: middle">{{
                t('pages.Setting.divider.dynamicWallpaper')
              }}</span>
              <IconifyIcon icon="custom:experiment-outline-sharp" style="vertical-align: middle" />
            </el-anchor-link>
            <el-anchor-link class="anchor-sub-link" href="#divider-rhythmWallpaper">
              <span style="vertical-align: middle">{{
                t('pages.Setting.divider.rhythmWallpaper')
              }}</span>
              <IconifyIcon icon="custom:experiment-outline-sharp" style="vertical-align: middle" />
            </el-anchor-link>
          </template>
        </el-anchor-link>
      </el-anchor>
      <el-scrollbar ref="baseSettingsScrollbarRef" style="height: 100%; flex: 1">
        <!-- 基础设置 -->
        <el-form ref="settingDataFormRef" :model="settingDataForm" label-width="auto">
          <div class="form-card">
            <div id="divider-base" class="divider">{{ t('pages.Setting.divider.base') }}</div>
            <div id="divider-app" class="divider-sub">
              {{ t('pages.Setting.divider.application') }}
            </div>
            <el-form-item :label="t('pages.Setting.settingDataForm.locale')" prop="locale">
              <el-select
                v-model="settingDataForm.locale"
                style="width: 140px"
                @change="onLocaleChange"
              >
                <el-option
                  v-for="item in localeOptions"
                  :key="item.value"
                  :label="item.label"
                  :value="item.value"
                />
              </el-select>
            </el-form-item>
            <el-form-item :label="t('pages.Setting.settingDataForm.themeColor')">
              <el-color-picker
                v-model="settingDataForm.themes.primary"
                :predefine="colorList"
                @change="onThemeColorChange"
              />
            </el-form-item>
            <el-form-item
              :label="t('pages.Setting.settingDataForm.defaultMenu')"
              prop="defaultMenu"
            >
              <el-select
                v-model="settingDataForm.defaultMenu"
                style="width: 140px"
                @change="onSettingDataFormChange"
              >
                <el-option
                  v-for="item in menuList"
                  :key="item.name"
                  :label="t(item.locale)"
                  :value="item.name"
                />
              </el-select>
            </el-form-item>
            <el-form-item
              :label="t('pages.Setting.settingDataForm.enabledMenus')"
              prop="enabledMenus"
            >
              <el-checkbox-group
                v-model="settingDataForm.enabledMenus"
                style="max-width: 450px"
                @change="onSettingDataFormChange"
              >
                <el-checkbox
                  v-for="item in canBeEnabledMenus"
                  :key="item.name"
                  :label="t(item.locale)"
                  :value="item.name"
                  style="width: 100px"
                >
                  <span class="checkbox-label">{{ t(item.locale) }}</span>
                </el-checkbox>
              </el-checkbox-group>
            </el-form-item>
            <el-form-item
              :label="t('pages.Setting.settingDataForm.enableExpandSideMenu')"
              prop="enableExpandSideMenu"
            >
              <el-checkbox
                v-model="settingDataForm.enableExpandSideMenu"
                @change="onEnableExpandSideMenuChange"
              />
            </el-form-item>
            <el-form-item
              :label="t('pages.Setting.settingDataForm.showSideMenuLabel')"
              prop="showSideMenuLabel"
            >
              <el-checkbox
                v-model="settingDataForm.showSideMenuLabel"
                @change="onSettingDataFormChange"
              />
            </el-form-item>
            <el-form-item
              :label="t('pages.Setting.settingDataForm.suspensionBallVisible')"
              prop="suspensionBallVisible"
            >
              <el-checkbox
                v-model="settingDataForm.suspensionBallVisible"
                @change="onSuspensionBallVisibleChange"
              />
            </el-form-item>

            <div id="divider-function" class="divider-sub">
              {{ t('pages.Setting.divider.function') }}
            </div>
            <el-form-item :label="t('pages.Setting.settingDataForm.startup')" prop="startup">
              <el-checkbox v-model="settingDataForm.startup" @change="onSettingDataFormChange" />
            </el-form-item>
            <el-form-item
              :label="t('pages.Setting.settingDataForm.openMainWindowOnStartup')"
              prop="openMainWindowOnStartup"
            >
              <el-checkbox
                v-model="settingDataForm.openMainWindowOnStartup"
                @change="onSettingDataFormChange"
              />
            </el-form-item>
            <el-form-item
              :label="t('pages.Setting.settingDataForm.startH5ServerOnStartup')"
              prop="startH5ServerOnStartup"
            >
              <el-checkbox
                v-model="settingDataForm.startH5ServerOnStartup"
                @change="onSettingDataFormChange"
              />
            </el-form-item>
            <el-form-item
              :label="t('pages.Setting.settingDataForm.enableSegmentationTask')"
              prop="enableSegmentationTask"
            >
              <el-checkbox
                v-model="settingDataForm.enableSegmentationTask"
                @change="onSettingDataFormChange"
              />
            </el-form-item>
            <el-form-item
              :label="t('pages.Setting.settingDataForm.powerSaveMode')"
              prop="powerSaveMode"
            >
              <el-checkbox
                v-model="settingDataForm.powerSaveMode"
                @change="onSettingDataFormChange"
              />
            </el-form-item>

            <div id="divider-explore" class="divider-sub">
              {{ t('pages.Setting.divider.explore') }}
            </div>
            <el-form-item :label="t('pages.Setting.settingDataForm.sortField')" prop="sortField">
              <el-select
                v-model="settingDataForm.sortField"
                style="width: 290px"
                @change="onSettingDataFormChange"
              >
                <el-option
                  v-for="item in sortFieldOptions"
                  :key="item.value"
                  :label="t(item.locale)"
                  :value="item.value"
                />
              </el-select>
            </el-form-item>
            <el-form-item :label="t('pages.Setting.settingDataForm.sortType')" prop="sortType">
              <el-select
                v-model="settingDataForm.sortType"
                style="width: 140px"
                @change="onSettingDataFormChange"
              >
                <el-option
                  v-for="item in sortTypeOptions"
                  :key="item.value"
                  :label="t(item.locale)"
                  :value="item.value"
                />
              </el-select>
            </el-form-item>
            <el-form-item :label="t('pages.Setting.settingDataForm.showTag')" prop="showTag">
              <el-checkbox v-model="settingDataForm.showTag" @change="onSettingDataFormChange" />
            </el-form-item>
            <el-form-item
              :label="t('pages.Setting.settingDataForm.confirmOnDeleteFile')"
              prop="confirmOnDeleteFile"
            >
              <el-checkbox
                v-model="settingDataForm.confirmOnDeleteFile"
                @change="onSettingDataFormChange"
              />
            </el-form-item>
            <el-form-item :label="t('pages.Setting.settingDataForm.viewImageIntervalTime')">
              <el-form-item prop="viewImageIntervalTime">
                <el-input-number
                  v-model="settingDataForm.viewImageIntervalTime"
                  :min="minTimes.viewImageIntervalUnit"
                  :max="999"
                  controls-position="right"
                  style="width: 140px"
                  @change="onSettingDataFormChange"
                />
              </el-form-item>
              <el-form-item prop="viewImageIntervalUnit">
                <el-select
                  v-model="settingDataForm.viewImageIntervalUnit"
                  style="width: 140px; margin-left: 10px"
                  @change="(val) => onTimeUnitChange('viewImageIntervalUnit', val)"
                >
                  <el-option
                    v-for="item in intervalUnits.viewImageIntervalUnit"
                    :key="item.value"
                    :label="t(item.locale)"
                    :value="item.value"
                  />
                </el-select>
              </el-form-item>
            </el-form-item>
          </div>

          <div class="form-card">
            <div id="divider-wallpaper" class="divider">
              {{ t('pages.Setting.divider.wallpaper') }}
            </div>
            <div id="divider-switch" class="divider-sub">
              {{ t('pages.Setting.divider.switch') }}
            </div>
            <el-form-item
              :label="t('pages.Setting.settingDataForm.autoSwitchWallpaper')"
              prop="autoSwitchWallpaper"
            >
              <el-checkbox
                v-model="settingDataForm.autoSwitchWallpaper"
                @change="onSettingDataFormChange('autoSwitchWallpaper')"
              />
            </el-form-item>
            <el-form-item :label="t('pages.Setting.settingDataForm.switchType')" prop="switchType">
              <el-radio-group
                v-model="settingDataForm.switchType"
                @change="onSettingDataFormChange"
              >
                <el-radio
                  v-for="item in switchTypeOptions"
                  :key="item.value"
                  :value="item.value"
                  style="width: 100px"
                >
                  <span class="radio-label">{{ t(item.locale) }}</span>
                </el-radio>
              </el-radio-group>
            </el-form-item>
            <el-form-item :label="t('pages.Setting.settingDataForm.switchIntervalTime')">
              <el-form-item prop="switchIntervalTime">
                <el-input-number
                  v-model="settingDataForm.switchIntervalTime"
                  :min="minTimes.switchIntervalUnit"
                  :max="999"
                  controls-position="right"
                  style="width: 140px"
                  @change="onSettingDataFormChange"
                />
              </el-form-item>
              <el-form-item prop="switchIntervalUnit">
                <el-select
                  v-model="settingDataForm.switchIntervalUnit"
                  style="width: 140px; margin-left: 10px"
                  @change="(val) => onTimeUnitChange('switchIntervalUnit', val)"
                >
                  <el-option
                    v-for="item in intervalUnits.switchIntervalUnit"
                    :key="item.value"
                    :label="t(item.locale)"
                    :value="item.value"
                  />
                </el-select>
              </el-form-item>
            </el-form-item>
            <el-form-item :label="t('pages.Setting.settingDataForm.allScreen')" prop="allScreen">
              <el-checkbox v-model="settingDataForm.allScreen" @change="onSettingDataFormChange" />
            </el-form-item>
            <el-form-item :label="t('pages.Setting.settingDataForm.scaleType')" prop="scaleType">
              <el-select
                v-model="settingDataForm.scaleType"
                style="width: 140px"
                @change="onSettingDataFormChange"
              >
                <el-option
                  v-for="item in scaleTypes"
                  :key="item.value"
                  :label="t(item.locale)"
                  :value="item.value"
                />
              </el-select>
            </el-form-item>

            <el-form-item
              :label="t('pages.Setting.settingDataForm.wallpaperResource')"
              prop="wallpaperResource"
            >
              <el-select
                v-model="settingDataForm.wallpaperResource"
                style="width: 290px"
                @change="onSettingDataFormChange"
              >
                <el-option
                  v-for="item in resourceMap.wallpaperResourceList"
                  :key="item.value"
                  :label="t(item.locale) || item.value"
                  :value="item.value"
                />
              </el-select>
            </el-form-item>
            <el-form-item
              :label="t('pages.Setting.settingDataForm.orientation')"
              prop="orientation"
            >
              <el-checkbox-group
                v-model="settingDataForm.orientation"
                @change="onSettingDataFormChange"
              >
                <el-checkbox
                  v-for="item in orientationOptions"
                  :key="item.value"
                  :label="t(item.locale)"
                  :value="item.value"
                  style="width: 100px"
                >
                  <span class="checkbox-label">{{ t(item.locale) }}</span>
                </el-checkbox>
              </el-checkbox-group>
            </el-form-item>
            <el-form-item :label="t('pages.Setting.settingDataForm.quality')" prop="quality">
              <el-checkbox-group
                v-model="settingDataForm.quality"
                @change="onSettingDataFormChange"
              >
                <el-checkbox
                  v-for="text in qualityList"
                  :key="text"
                  :label="text"
                  :value="text"
                  style="width: 100px"
                >
                  <span class="checkbox-label">{{ text }}</span>
                </el-checkbox>
              </el-checkbox-group>
            </el-form-item>
            <el-form-item
              :label="t('pages.Setting.settingDataForm.filterKeywords.label')"
              prop="filterKeywords"
            >
              <el-input
                v-model="settingDataForm.filterKeywords"
                :placeholder="t('pages.Setting.settingDataForm.filterKeywords.placeholder')"
                clearable
                style="max-width: 450px"
                @change="onSettingDataFormChange"
              />
            </el-form-item>

            <div id="divider-localResource" class="divider-sub">
              {{ t('pages.Setting.divider.localResource') }}
            </div>
            <el-form-item :label="t('pages.Setting.settingDataForm.localResourceFolders.label')">
              <template v-if="settingDataForm.localResourceFolders.length">
                <el-input
                  v-for="(folderPath, index) in settingDataForm.localResourceFolders"
                  :key="index"
                  v-model="settingDataForm.localResourceFolders[index]"
                  readonly
                  :placeholder="t('pages.Setting.settingDataForm.localResourceFolders.placeholder')"
                  style="max-width: 450px; margin: 0 10px 10px 0"
                  @click="openSelectFolderDialog('localResourceFolders', index)"
                >
                  <template #append>
                    <el-button @click="onRemoveFolder('localResourceFolders', index)">
                      <IconifyIcon icon="custom:minus" />
                    </el-button>
                    <el-button style="margin-left: 20px" @click="onOpenFolder(folderPath)">
                      <IconifyIcon icon="custom:folder-opened" />
                    </el-button>
                  </template>
                </el-input>
              </template>
              <div
                v-if="settingDataForm.localResourceFolders.length < maxFolderCount"
                style="width: 100%"
              >
                <el-button @click="onAddFolder('localResourceFolders')">
                  <IconifyIcon icon="custom:plus" />
                </el-button>
              </div>
            </el-form-item>
            <el-form-item
              :label="t('pages.Setting.settingDataForm.allowedFileExt.label')"
              prop="allowedFileExt"
            >
              <el-select
                v-model="settingDataForm.allowedFileExt"
                multiple
                collapse-tags
                :placeholder="t('pages.Setting.settingDataForm.allowedFileExt.placeholder')"
                style="width: 290px"
                @change="onAllowedFileExtChange"
              >
                <el-option
                  v-for="item in allowedFileExtList"
                  :key="item"
                  :label="item"
                  :value="item"
                />
              </el-select>
            </el-form-item>
            <el-form-item :label="t('pages.Setting.settingDataForm.refreshDirectoryIntervalTime')">
              <el-form-item prop="refreshDirectoryIntervalTime">
                <el-input-number
                  v-model="settingDataForm.refreshDirectoryIntervalTime"
                  :min="minTimes.refreshDirectoryIntervalUnit"
                  :max="999"
                  controls-position="right"
                  style="width: 140px"
                  @change="onSettingDataFormChange"
                />
              </el-form-item>
              <el-form-item prop="refreshDirectoryIntervalUnit">
                <el-select
                  v-model="settingDataForm.refreshDirectoryIntervalUnit"
                  style="width: 140px; margin-left: 10px"
                  @change="(val) => onTimeUnitChange('refreshDirectoryIntervalUnit', val)"
                >
                  <el-option
                    v-for="item in intervalUnits.refreshDirectoryIntervalUnit"
                    :key="item.value"
                    :label="t(item.locale)"
                    :value="item.value"
                  />
                </el-select>
              </el-form-item>
            </el-form-item>
            <el-form-item
              :label="t('pages.Setting.settingDataForm.autoRefreshDirectory')"
              prop="autoRefreshDirectory"
            >
              <el-checkbox
                v-model="settingDataForm.autoRefreshDirectory"
                :disabled="!settingDataForm.localResourceFolders.length"
                @change="onSettingDataFormChange"
              />
            </el-form-item>

            <div id="divider-remoteResource" class="divider-sub">
              {{ t('pages.Setting.divider.remoteResource') }}
            </div>
            <el-form-item
              :label="t('pages.Setting.settingDataForm.remoteResourceSecretKeys.label')"
            >
              <el-input
                v-for="resourceName in resourceMap.remoteResourceKeyNames"
                :key="resourceName"
                v-model="settingDataForm.remoteResourceSecretKeys[resourceName]"
                clearable
                :placeholder="
                  t('pages.Setting.settingDataForm.remoteResourceSecretKeys.placeholder')
                "
                style="max-width: 450px; margin: 0 10px 10px 0"
                @change="onSettingDataFormChange"
              >
                <template #prepend>
                  <span style="width: 67px">{{ resourceName }}</span>
                </template>
                <template #append>
                  <el-link :href="resourceMap.remoteResourceMap[resourceName].site" target="_blank">
                    <IconifyIcon icon="custom:link" />
                  </el-link>
                </template>
              </el-input>
            </el-form-item>
            <el-form-item
              :label="t('pages.Setting.settingDataForm.downloadSources')"
              prop="downloadSources"
            >
              <el-select
                v-model="settingDataForm.downloadSources"
                multiple
                collapse-tags
                style="width: 290px"
                @change="onSettingDataFormChange"
              >
                <el-option
                  v-for="item in resourceMap.supportDownloadRemoteResourceList"
                  :key="item.value"
                  :label="t(item.locale) || item.value"
                  :value="item.value"
                />
              </el-select>
            </el-form-item>
            <el-form-item
              :label="t('pages.Setting.settingDataForm.downloadOrientation')"
              prop="downloadOrientation"
            >
              <el-checkbox-group
                v-model="settingDataForm.downloadOrientation"
                :disabled="!settingDataForm.downloadSources.length"
                style="max-width: 450px"
                @change="onSettingDataFormChange"
              >
                <el-checkbox
                  v-for="item in orientationOptions"
                  :key="item.value"
                  :label="t(item.locale)"
                  :value="item.value"
                  style="width: 100px"
                >
                  <span class="checkbox-label">{{ t(item.locale) }}</span>
                </el-checkbox>
              </el-checkbox-group>
            </el-form-item>
            <el-form-item
              :label="t('pages.Setting.settingDataForm.downloadKeywords.label')"
              prop="downloadKeywords"
            >
              <el-input-tag
                v-model="settingDataForm.downloadKeywords"
                :disabled="!settingDataForm.downloadSources.length"
                clearable
                :placeholder="t('pages.Setting.settingDataForm.downloadKeywords.placeholder')"
                style="max-width: 450px"
                :max="5"
                @change="onDownloadKeywordsChange"
              />
            </el-form-item>
            <el-form-item
              :label="t('pages.Setting.settingDataForm.downloadFolder.label')"
              prop="downloadFolder"
            >
              <el-input
                v-model="settingDataForm.downloadFolder"
                :disabled="!settingDataForm.downloadSources.length"
                readonly
                :placeholder="t('pages.Setting.settingDataForm.downloadFolder.placeholder')"
                style="max-width: 450px"
                @click="openSelectFolderDialog('downloadFolder')"
              >
                <template #append>
                  <el-button
                    :disabled="!settingDataForm.downloadFolder"
                    @click="onRemoveFolder('downloadFolder')"
                  >
                    <IconifyIcon icon="custom:close-rounded" />
                  </el-button>
                  <el-button
                    :disabled="!settingDataForm.downloadFolder"
                    style="margin-left: 20px"
                    @click="onOpenFolder(settingDataForm.downloadFolder)"
                  >
                    <IconifyIcon icon="custom:folder-opened" />
                  </el-button>
                </template>
              </el-input>
            </el-form-item>
            <el-form-item :label="t('pages.Setting.settingDataForm.downloadIntervalTime')">
              <el-form-item prop="downloadIntervalTime">
                <el-input-number
                  v-model="settingDataForm.downloadIntervalTime"
                  :disabled="!settingDataForm.downloadSources.length"
                  :min="minTimes.downloadIntervalUnit"
                  :max="999"
                  controls-position="right"
                  style="width: 140px"
                  @change="onSettingDataFormChange"
                />
              </el-form-item>
              <el-form-item prop="switchIntervalUnit">
                <el-select
                  v-model="settingDataForm.downloadIntervalUnit"
                  :disabled="!settingDataForm.downloadSources.length"
                  style="width: 140px; margin-left: 10px"
                  @change="(val) => onTimeUnitChange('downloadIntervalUnit', val)"
                >
                  <el-option
                    v-for="item in intervalUnits.downloadIntervalUnit"
                    :key="item.value"
                    :label="t(item.locale)"
                    :value="item.value"
                  />
                </el-select>
              </el-form-item>
            </el-form-item>
            <el-form-item
              :label="t('pages.Setting.settingDataForm.autoDownload')"
              prop="autoDownload"
            >
              <el-checkbox
                v-model="settingDataForm.autoDownload"
                :disabled="
                  !settingDataForm.downloadSources.length || !settingDataForm.downloadFolder
                "
                @change="onSettingDataFormChange"
              />
            </el-form-item>
            <el-form-item :label="t('pages.Setting.settingDataForm.clearDownloadedExpiredTime')">
              <el-form-item prop="clearDownloadedExpiredTime">
                <el-input-number
                  v-model="settingDataForm.clearDownloadedExpiredTime"
                  :min="minTimes.clearDownloadedExpiredUnit"
                  :max="999"
                  controls-position="right"
                  style="width: 140px"
                  @change="onSettingDataFormChange"
                />
              </el-form-item>
              <el-form-item prop="clearDownloadedExpiredUnit">
                <el-select
                  v-model="settingDataForm.clearDownloadedExpiredUnit"
                  style="width: 140px; margin-left: 10px"
                  @change="(val) => onTimeUnitChange('clearDownloadedExpiredUnit', val)"
                >
                  <el-option
                    v-for="item in intervalUnits.clearDownloadedExpiredUnit"
                    :key="item.value"
                    :label="t(item.locale)"
                    :value="item.value"
                  />
                </el-select>
              </el-form-item>
            </el-form-item>
            <el-form-item
              :label="t('pages.Setting.settingDataForm.autoClearDownloaded')"
              prop="autoClearDownloaded"
            >
              <el-checkbox
                v-model="settingDataForm.autoClearDownloaded"
                :disabled="!settingDataForm.downloadFolder"
                @change="onSettingDataFormChange"
              />
            </el-form-item>

            <div id="divider-webWallpaper" class="divider-sub">
              <span style="vertical-align: middle">{{
                t('pages.Setting.divider.webWallpaper')
              }}</span>
              <IconifyIcon icon="custom:experiment-outline-sharp" style="vertical-align: middle" />
            </div>
            <el-form-item
              :label="t('pages.Setting.settingDataForm.webWallpaperUrl.label')"
              prop="webWallpaperUrl"
            >
              <el-input
                v-model="settingDataForm.webWallpaperUrl"
                :disabled="flags.settingWebWallpaper"
                clearable
                :placeholder="t('pages.Setting.settingDataForm.webWallpaperUrl.placeholder')"
                style="flex: 1"
                @change="onSettingDataFormChange"
              />
              <el-button
                :disabled="!settingDataForm.webWallpaperUrl"
                :loading="flags.settingWebWallpaper"
                @click="onSetWebWallpaper"
                style="margin-left: 10px"
              >
                <IconifyIcon icon="custom:wallpaper" />
              </el-button>
            </el-form-item>
            <el-form-item
              :label="t('pages.Setting.settingDataForm.refreshWebWallpaperIntervalTime')"
            >
              <el-form-item prop="refreshWebWallpaperIntervalTime">
                <el-input-number
                  v-model="settingDataForm.refreshWebWallpaperIntervalTime"
                  :min="minTimes.refreshWebWallpaperIntervalUnit"
                  :max="999"
                  controls-position="right"
                  style="width: 140px"
                  @change="onSettingDataFormChange"
                />
              </el-form-item>
              <el-form-item prop="refreshWebWallpaperIntervalUnit">
                <el-select
                  v-model="settingDataForm.refreshWebWallpaperIntervalUnit"
                  style="width: 140px; margin-left: 10px"
                  @change="(val) => onTimeUnitChange('refreshWebWallpaperIntervalUnit', val)"
                >
                  <el-option
                    v-for="item in intervalUnits.refreshWebWallpaperIntervalUnit"
                    :key="item.value"
                    :label="t(item.locale)"
                    :value="item.value"
                  />
                </el-select>
              </el-form-item>
            </el-form-item>
            <el-form-item
              :label="t('pages.Setting.settingDataForm.autoRefreshWebWallpaper')"
              prop="autoRefreshWebWallpaper"
            >
              <el-checkbox
                v-model="settingDataForm.autoRefreshWebWallpaper"
                :disabled="!settingDataForm.webWallpaperUrl"
                @change="onSettingDataFormChange('autoRefreshWebWallpaper')"
              />
            </el-form-item>

            <div id="divider-colorWallpaper" class="divider-sub">
              <span style="vertical-align: middle">{{
                t('pages.Setting.divider.colorWallpaper')
              }}</span>
              <IconifyIcon icon="custom:experiment-outline-sharp" style="vertical-align: middle" />
            </div>
            <el-form-item
              :label="t('pages.Setting.settingDataForm.colorWallpaperVal.label')"
              prop="colorWallpaperVal"
            >
              <el-color-picker
                v-model="settingDataForm.colorWallpaperVal"
                :disabled="flags.settingColorWallpaper"
                :predefine="colorList"
                @change="onSettingDataFormChange"
              />
              <el-button
                :disabled="!settingDataForm.colorWallpaperVal"
                :loading="flags.settingColorWallpaper"
                @click="onSetColorWallpaper"
                style="margin-left: 10px"
              >
                <IconifyIcon icon="custom:wallpaper" />
              </el-button>
            </el-form-item>

            <div id="divider-dynamicWallpaper" class="divider-sub">
              <span style="vertical-align: middle">{{
                t('pages.Setting.divider.dynamicWallpaper')
              }}</span>
              <IconifyIcon icon="custom:experiment-outline-sharp" style="vertical-align: middle" />
            </div>
            <el-form-item
              :label="t('pages.Setting.settingDataForm.dynamicLastVideoPath.label')"
              prop="dynamicLastVideoPath"
            >
              <el-input
                v-model="settingDataForm.dynamicLastVideoPath"
                clearable
                :placeholder="t('pages.Setting.settingDataForm.dynamicLastVideoPath.placeholder')"
                style="flex: 1"
                @click="onSelectDynamicVideo"
                @change="onSettingDataFormChange"
              />
              <el-button
                :disabled="!settingDataForm.dynamicLastVideoPath"
                :loading="flags.settingDynamicWallpaper"
                @click="onSetDynamicWallpaper"
                style="margin-left: 10px"
              >
                <IconifyIcon icon="custom:wallpaper" />
              </el-button>
            </el-form-item>
            <el-form-item
              :label="t('pages.Setting.settingDataForm.dynamicMuteAudio')"
              prop="dynamicMuteAudio"
            >
              <el-checkbox
                v-model="settingDataForm.dynamicMuteAudio"
                @change="onSettingDataFormChange"
              />
            </el-form-item>
            <el-form-item
              :label="t('pages.Setting.settingDataForm.dynamicBackgroundColor')"
              prop="dynamicBackgroundColor"
            >
              <el-color-picker
                v-model="settingDataForm.dynamicBackgroundColor"
                :predefine="colorList"
                @change="(val) => onDynamicSettingChange('dynamicBackgroundColor', val)"
              />
            </el-form-item>
            <el-form-item
              :label="t('pages.Setting.settingDataForm.dynamicOpacity')"
              prop="dynamicOpacity"
            >
              <el-slider
                v-model="settingDataForm.dynamicOpacity"
                :min="0"
                :max="100"
                :step="1"
                show-input
                show-input-controls
                style="width: 450px"
                @change="(val) => onDynamicSettingChange('dynamicOpacity', val)"
              />
            </el-form-item>
            <el-form-item
              :label="t('pages.Setting.settingDataForm.dynamicBrightness')"
              prop="dynamicBrightness"
            >
              <el-slider
                v-model="settingDataForm.dynamicBrightness"
                :min="0"
                :max="100"
                :step="1"
                show-input
                show-input-controls
                style="width: 450px"
                @change="(val) => onDynamicSettingChange('dynamicBrightness', val)"
              />
            </el-form-item>
            <el-form-item
              :label="t('pages.Setting.settingDataForm.dynamicContrast')"
              prop="dynamicContrast"
            >
              <el-slider
                v-model="settingDataForm.dynamicContrast"
                :min="0"
                :max="100"
                :step="1"
                show-input
                show-input-controls
                style="width: 450px"
                @change="(val) => onDynamicSettingChange('dynamicContrast', val)"
              />
            </el-form-item>
            <el-form-item
              :label="t('pages.Setting.settingDataForm.dynamicPerformanceMode.label')"
              prop="dynamicPerformanceMode"
            >
              <el-select
                v-model="settingDataForm.dynamicPerformanceMode"
                :placeholder="t('pages.Setting.settingDataForm.dynamicPerformanceMode.placeholder')"
                style="width: 290px"
                @change="(val) => onDynamicSettingChange('dynamicPerformanceMode', val)"
              >
                <el-option
                  v-for="item in dynamicPerformanceModeOptions"
                  :key="item.value"
                  :label="t(item.locale)"
                  :value="item.value"
                />
              </el-select>
            </el-form-item>
            <el-form-item
              :label="t('pages.Setting.settingDataForm.dynamicScaleMode.label')"
              prop="dynamicScaleMode"
            >
              <el-select
                v-model="settingDataForm.dynamicScaleMode"
                :placeholder="t('pages.Setting.settingDataForm.dynamicScaleMode.placeholder')"
                style="width: 290px"
                @change="(val) => onDynamicSettingChange('dynamicScaleMode', val)"
              >
                <el-option
                  v-for="item in dynamicScaleModeOptions"
                  :key="item.value"
                  :label="t(item.locale)"
                  :value="item.value"
                />
              </el-select>
            </el-form-item>

            <div id="divider-rhythmWallpaper" class="divider-sub">
              <span style="vertical-align: middle">{{
                t('pages.Setting.divider.rhythmWallpaper')
              }}</span>
              <IconifyIcon icon="custom:experiment-outline-sharp" style="vertical-align: middle" />
            </div>
            <el-form-item
              :label="t('pages.Setting.settingDataForm.rhythmEffect.label')"
              prop="rhythmEffect"
            >
              <el-select
                v-model="settingDataForm.rhythmEffect"
                :placeholder="t('pages.Setting.settingDataForm.rhythmEffect.placeholder')"
                style="width: 290px"
                @change="onSettingDataFormChange"
              >
                <el-option
                  v-for="item in rhythmEffectOptions"
                  :key="item.value"
                  :label="t(item.locale)"
                  :value="item.value"
                />
              </el-select>
              <el-button
                :loading="flags.settingRhythmWallpaper"
                @click="onSetRhythmWallpaper"
                style="margin-left: 10px"
              >
                <IconifyIcon icon="custom:wallpaper" />
              </el-button>
            </el-form-item>
            <el-form-item
              :label="t('pages.Setting.settingDataForm.rhythmWidthRatio')"
              prop="rhythmWidthRatio"
            >
              <el-slider
                v-model="settingDataForm.rhythmWidthRatio"
                :min="1"
                :max="100"
                :step="1"
                show-input
                show-input-controls
                style="width: 450px"
                @change="onSettingDataFormChange"
              />
            </el-form-item>
            <el-form-item
              :label="t('pages.Setting.settingDataForm.rhythmHeightRatio')"
              prop="rhythmHeightRatio"
            >
              <el-slider
                v-model="settingDataForm.rhythmHeightRatio"
                :min="1"
                :max="100"
                :step="1"
                show-input
                show-input-controls
                style="width: 450px"
                @change="onSettingDataFormChange"
              />
            </el-form-item>
            <el-form-item
              :label="t('pages.Setting.settingDataForm.rhythmColors')"
              prop="rhythmColors"
            >
              <div class="color-picker-block">
                <el-color-picker
                  v-for="(color, index) in settingDataForm.rhythmColors"
                  :key="index"
                  class="color-picker-inner"
                  v-model="settingDataForm.rhythmColors[index]"
                  :predefine="colorList"
                  @change="(val) => onRhythmColorsChange(index, val)"
                />
                <el-button
                  v-if="settingDataForm.rhythmColors.length < maxColorCount"
                  class="color-picker-btn"
                  @click="onAddRhythmColors"
                >
                  <IconifyIcon icon="custom:plus" />
                </el-button>
              </div>
            </el-form-item>
            <el-form-item
              :label="t('pages.Setting.settingDataForm.rhythmAnimation.label')"
              prop="rhythmAnimation"
            >
              <el-select
                v-model="settingDataForm.rhythmAnimation"
                :placeholder="t('pages.Setting.settingDataForm.rhythmAnimation.placeholder')"
                style="width: 290px"
                @change="onSettingDataFormChange"
              >
                <el-option
                  v-for="item in rhythmAnimationOptions"
                  :key="item.value"
                  :label="t(item.locale)"
                  :value="item.value"
                />
              </el-select>
            </el-form-item>
            <el-form-item
              :label="t('pages.Setting.settingDataForm.rhythmDensity.label')"
              prop="rhythmDensity"
            >
              <el-select
                v-model="settingDataForm.rhythmDensity"
                :placeholder="t('pages.Setting.settingDataForm.rhythmDensity.placeholder')"
                style="width: 290px"
                @change="onSettingDataFormChange"
              >
                <el-option
                  v-for="item in rhythmDensityOptions"
                  :key="item.value"
                  :label="t(item.locale)"
                  :value="item.value"
                />
              </el-select>
            </el-form-item>
            <el-form-item
              :label="t('pages.Setting.settingDataForm.rhythmPosition.label')"
              prop="rhythmPosition"
            >
              <el-select
                v-model="settingDataForm.rhythmPosition"
                :placeholder="t('pages.Setting.settingDataForm.rhythmPosition.placeholder')"
                style="width: 290px"
                @change="onSettingDataFormChange"
              >
                <el-option
                  v-for="item in positionOptions"
                  :key="item.value"
                  :label="t(item.locale)"
                  :value="item.value"
                />
              </el-select>
            </el-form-item>
            <el-form-item
              :label="t('pages.Setting.settingDataForm.rhythmSampleRange')"
              prop="rhythmSampleRange"
            >
              <el-slider
                v-model="settingDataForm.rhythmSampleRange"
                range
                :min="0"
                :max="100"
                :step="1"
                style="width: 290px"
                @change="onSettingDataFormChange"
              />
            </el-form-item>
          </div>
        </el-form>
      </el-scrollbar>
    </div>
    <el-scrollbar v-show="activeTab === 'privacySpace'" style="height: calc(100vh - 110px)">
      <!-- 隐私空间 -->
      <el-form ref="privacyPasswordFormRef" :model="privacyPasswordForm" label-width="auto">
        <div class="form-card">
          <div class="divider">{{ t('pages.Setting.divider.privacyPassword') }}</div>
          <el-form-item :label="t('pages.Setting.privacyPasswordForm.old.label')" prop="old">
            <el-input
              v-model="privacyPasswordForm.old"
              :type="privacyPasswordView.old ? 'text' : 'password'"
              minlength="3"
              maxlength="6"
              clearable
              :placeholder="t('pages.Setting.privacyPasswordForm.old.placeholder')"
              style="width: 290px"
              @input="(val) => handlePasswordInput('old', val)"
            >
              <template #suffix>
                <IconifyIcon
                  :icon="privacyPasswordView.old ? 'custom:view' : 'custom:hide'"
                  style="cursor: pointer"
                  @mousedown="togglePasswordView('old')"
                  @mouseup="togglePasswordView('old')"
                />
              </template>
            </el-input>
            <el-tooltip effect="light">
              <template #content>
                <div style="max-width: 300px; word-break: break-word; white-space: break-spaces">
                  {{ t('pages.Setting.privacyPasswordForm.old.tooltip') }}
                </div>
              </template>
              <IconifyIcon
                icon="custom:info-filled"
                style="color: var(--el-text-color-regular); margin-left: 10px"
              />
            </el-tooltip>
          </el-form-item>
          <el-form-item :label="t('pages.Setting.privacyPasswordForm.new.label')" prop="new">
            <el-input
              v-model="privacyPasswordForm.new"
              :type="privacyPasswordView.new ? 'text' : 'password'"
              minlength="3"
              maxlength="6"
              clearable
              :placeholder="t('pages.Setting.privacyPasswordForm.new.placeholder')"
              style="width: 290px"
              @input="(val) => handlePasswordInput('new', val)"
            >
              <template #suffix>
                <IconifyIcon
                  :icon="privacyPasswordView.new ? 'custom:view' : 'custom:hide'"
                  style="cursor: pointer"
                  @mousedown="togglePasswordView('new')"
                  @mouseup="togglePasswordView('new')"
                />
              </template>
            </el-input>
            <el-tooltip effect="light">
              <template #content>
                <div style="max-width: 300px; word-break: break-word; white-space: break-spaces">
                  {{ t('pages.Setting.privacyPasswordForm.new.tooltip') }}
                </div>
              </template>
              <IconifyIcon
                icon="custom:info-filled"
                style="color: var(--el-text-color-regular); margin-left: 10px"
              />
            </el-tooltip>
          </el-form-item>
          <el-form-item label="&nbsp;&nbsp;" style="margin-top: 40px">
            <el-button
              type="primary"
              style="width: 140px"
              @click="onPrivacyPasswordFormConfirm(privacyPasswordFormRef)"
            >
              {{ t('pages.Setting.privacyPasswordForm.confirm') }}
            </el-button>
          </el-form-item>
        </div>
      </el-form>
    </el-scrollbar>
  </el-main>
</template>

<style scoped lang="scss">
.page-setting {
  padding: 0 20px;
  margin-bottom: 20px;
}

.base-settings-wrapper {
  display: flex;
  flex-direction: row;
  justify-content: space-between;
  align-items: flex-start;
  gap: 20px;
  height: calc(100vh - 110px);
  overflow: hidden;
}

.color-picker-block {
  display: inline-flex;
  justify-content: flex-start;
  align-items: center;
  flex-wrap: wrap;
  gap: 10px;
}
</style>

<style lang="scss">
.anchor-block {
  width: 200px;
  height: 100%;
  border-radius: 6px;
  padding: 20px;
  overflow: auto;

  .anchor-link {
    .el-anchor__link {
      font-size: 14px !important;
      font-weight: bolder !important;
    }
  }
  .anchor-sub-link {
    .el-anchor__link {
      font-size: 14px !important;
      font-weight: normal !important;
    }
  }
}

.radio-label {
  color: var(--el-text-color-regular);
}
.checkbox-label {
  color: var(--el-text-color-regular);
}
</style>
