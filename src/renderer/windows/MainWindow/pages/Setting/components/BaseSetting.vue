<script setup>
import UseSettingStore from '@renderer/stores/settingStore.js'
import UseCommonStore from '@renderer/stores/commonStore.js'
import {
  scaleTypesByOS,
  intervalUnits,
  unitToValField,
  qualityList,
  orientationOptions,
  switchTypeOptions,
  allowedFileExtList,
  colorList,
  dynamicPerformanceModeOptions,
  dynamicScaleModeOptions,
  rhythmEffectOptions,
  rhythmAnimationOptions,
  rhythmDensityOptions,
  positionOptions,
  filterTypeOptions,
  normalizeDownloadMediaTypes,
  defaultMenuList,
  menuList,
  notificationsOptions
} from '@common/publicData.js'
import { localeOptions } from '@i18n/locale/index.js'
import { useTranslation } from 'i18next-vue'
import { useSettingAnchorScroll } from '../utils/useSettingAnchorScroll.js'
import { useAiAnalysisDashboard } from '../utils/useAiAnalysisDashboard.js'
import AiAnalysisDashboardPanel from './AiAnalysisDashboardPanel.vue'
import SettingFormLabelTip from './SettingFormLabelTip.vue'

const props = defineProps({
  tabActive: { type: Boolean, default: true }
})

const { t } = useTranslation()
const commonStore = UseCommonStore()
const settingStore = UseSettingStore()
const { commonData, resourceMap } = storeToRefs(commonStore)
const { settingData } = storeToRefs(settingStore)

const {
  analysisStats,
  loadingAnalysisStats,
  showAnalysisProgress,
  analysisProgressPercent,
  analysisStatusLabel,
  analysisStatusTooltip,
  analysisStatusTagType,
  analysisProgressSummary,
  analysisFooterHint,
  analysisSpeedLine,
  analysisSpeedTooltip,
  requeueRetryableAiAnalysis
} = useAiAnalysisDashboard(computed(() => settingData.value?.ai || {}), {
  tabActive: toRef(props, 'tabActive')
})

const baseSettingsScrollbarRef = ref(null)
const settingDataFormRef = ref(null)
const { anchorContainer, onAnchorChange, restoreAnchorScroll } = useSettingAnchorScroll(
  baseSettingsScrollbarRef,
  { defaultHref: '#divider-base' }
)
const settingDataForm = reactive({
  ...toRaw(settingStore.settingData)
})

const ensureAiForm = () => {
  if (!settingDataForm.ai || typeof settingDataForm.ai !== 'object') {
    settingDataForm.ai = {}
  }
  if (settingDataForm.ai.expandDownloadKeywords === undefined) {
    settingDataForm.ai.expandDownloadKeywords = false
  }
}
ensureAiForm()

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
const maxDownloadKeywordsCount = 20

const aiEnabled = computed(() => !!settingDataForm.ai?.enabled)
const expandDownloadKeywordsDisabled = computed(
  () => !settingDataForm.downloadSources?.length || !aiEnabled.value
)

const flags = reactive({
  saving: false,
  selectFolder: false,
  settingWebWallpaper: false,
  settingColorWallpaper: false,
  settingDynamicWallpaper: false,
  settingRhythmWallpaper: false
})

const canBeEnabledMenus = computed(() => menuList.filter((item) => item.canBeEnabled))

watch(
  () => settingData.value,
  (newValue) => {
    if (newValue) {
      Object.keys(newValue).forEach((key) => {
        settingDataForm[key] = newValue[key]
      })
      ensureAiForm()
    }
  }
)

const initMinTimes = () => {
  const unitFields = Object.keys(intervalUnits)
  unitFields.forEach((unitField) => {
    const unitValue = settingDataForm[unitField]
    handleMinTimesByUnit(unitField, unitValue)
  })
}

const handleMinTimesByUnit = (unitField, unitValue) => {
  const units = intervalUnits[unitField] || []
  const target = units.find((item) => item.value === unitValue)
  minTimes[unitField] = target ? target.min : 1
}

const onTimeUnitChange = (unitField, unitValue) => {
  handleMinTimesByUnit(unitField, unitValue)
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
  if (field === 'autoSwitchWallpaper') {
    settingDataForm.autoRefreshWebWallpaper = false
  } else if (field === 'autoRefreshWebWallpaper') {
    settingDataForm.autoSwitchWallpaper = false
  }
  onSettingDataFormConfirm()
}

const onSuspensionBallVisibleChange = async (val) => {
  const res = await onSettingDataFormConfirm()
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
      window.FBW.setDynamicWallpaperPerformance(value)
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

const onDownloadKeywordsChange = (val) => {
  if (Array.isArray(val)) {
    const processed = val
      .map((item) => (typeof item === 'string' ? item.trim() : String(item)))
      .filter((item) => item.length > 0)
      .filter((item, index, self) => self.indexOf(item) === index)

    const limited = processed.slice(0, maxDownloadKeywordsCount)

    settingDataForm.downloadKeywords = limited
  }
  onSettingDataFormChange()
}

const onDownloadMediaTypesChange = (val) => {
  settingDataForm.downloadMediaTypes = normalizeDownloadMediaTypes(val)
  onSettingDataFormChange()
}

onMounted(() => {
  ensureAiForm()
  initMinTimes()
})

onBeforeUnmount(() => {
  settingDataFormRef.value.resetFields()
})

const syncFormFromSettingData = () => {
  const data = settingData.value
  if (!data) return
  Object.keys(data).forEach((key) => {
    settingDataForm[key] = data[key]
  })
  settingDataForm.downloadMediaTypes = normalizeDownloadMediaTypes(
    settingDataForm.downloadMediaTypes
  )
  ensureAiForm()
  initMinTimes()
}

defineExpose({
  resetForm: syncFormFromSettingData,
  restoreAnchorScroll
})
</script>

<template>
  <div class="base-settings-wrapper">
    <aside class="setting-anchor-sidebar">
      <el-scrollbar class="setting-anchor-sidebar__scroll">
        <el-anchor
          class="anchor-block ai-sidebar-card"
          :container="anchorContainer"
          direction="vertical"
          :offset="20"
          type="default"
          @change="onAnchorChange"
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
            href="#divider-notifications"
            :title="t('pages.Setting.divider.notifications')"
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
      </el-scrollbar>
      <AiAnalysisDashboardPanel
        :loading="loadingAnalysisStats && !analysisStats"
        :stats="analysisStats"
        :percent="analysisProgressPercent"
        :status-label="analysisStatusLabel"
        :status-tooltip="analysisStatusTooltip"
        :status-tag-type="analysisStatusTagType"
        :summary="analysisProgressSummary"
        :footer-hint="analysisFooterHint"
        :speed-line="analysisSpeedLine"
        :speed-tooltip="analysisSpeedTooltip"
        :running="!!analysisStats?.running"
        @requeue-retryable="requeueRetryableAiAnalysis"
      />
    </aside>
    <el-scrollbar ref="baseSettingsScrollbarRef" style="height: 100%; flex: 1">
      <el-form
        ref="settingDataFormRef"
        :model="settingDataForm"
        label-width="auto"
        label-position="right"
        class="ai-setting-form"
      >
        <div class="form-card">
          <div id="divider-base" class="divider">{{ t('pages.Setting.divider.base') }}</div>
          <div id="divider-app" class="divider-sub">
            {{ t('pages.Setting.divider.application') }}
          </div>
          <el-form-item prop="locale">
            <template #label>
              <IconifyIcon icon="custom:language" style="align-self: center; margin-right: 10px" />
              <span>{{ t('pages.Setting.settingDataForm.locale') }}</span>
            </template>
            <el-select
              v-model="settingDataForm.locale"
              style="width: 290px"
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
          <el-form-item :label="t('pages.Setting.settingDataForm.defaultMenu')" prop="defaultMenu">
            <el-select
              v-model="settingDataForm.defaultMenu"
              style="width: 290px"
              @change="onSettingDataFormChange"
            >
              <el-option
                v-for="item in defaultMenuList"
                :key="item.name"
                :label="t(item.locale)"
                :value="item.name"
              >
                <IconifyIcon :icon="item.icon" style="vertical-align: middle; margin-right: 10px" />
                <span style="vertical-align: middle">{{ t(item.locale) }}</span>
              </el-option>
            </el-select>
          </el-form-item>
          <el-form-item
            :label="t('pages.Setting.settingDataForm.enabledMenus')"
            prop="enabledMenus"
          >
            <el-checkbox-group
              v-model="settingDataForm.enabledMenus"
              class="setting-checkbox-group--menus"
              @change="onSettingDataFormChange"
            >
              <el-checkbox v-for="item in canBeEnabledMenus" :key="item.name" :label="item.name">
                <span class="setting-checkbox__content">
                  <IconifyIcon :icon="item.icon" class="setting-checkbox__icon" />
                  <span class="checkbox-label">{{ t(item.locale) }}</span>
                </span>
              </el-checkbox>
            </el-checkbox-group>
          </el-form-item>
          <el-form-item prop="enableExpandSideMenu" class="ai-form-item-labeled">
            <template #label>
              <SettingFormLabelTip
                :label="t('pages.Setting.settingDataForm.enableExpandSideMenu')"
                :hint="t('pages.Setting.settingDataForm.enableExpandSideMenuHint')"
              />
            </template>
            <el-switch
              v-model="settingDataForm.enableExpandSideMenu"
              @change="onEnableExpandSideMenuChange"
            />
          </el-form-item>
          <el-form-item prop="showSideMenuLabel" class="ai-form-item-labeled">
            <template #label>
              <SettingFormLabelTip
                :label="t('pages.Setting.settingDataForm.showSideMenuLabel')"
                :hint="t('pages.Setting.settingDataForm.showSideMenuLabelHint')"
              />
            </template>
            <el-switch
              v-model="settingDataForm.showSideMenuLabel"
              @change="onSettingDataFormChange"
            />
          </el-form-item>
          <el-form-item prop="suspensionBallVisible" class="ai-form-item-labeled">
            <template #label>
              <SettingFormLabelTip
                :label="t('pages.Setting.settingDataForm.suspensionBallVisible')"
                :hint="t('pages.Setting.settingDataForm.suspensionBallVisibleHint')"
              />
            </template>
            <el-switch
              v-model="settingDataForm.suspensionBallVisible"
              @change="onSuspensionBallVisibleChange"
            />
          </el-form-item>

          <div id="divider-function" class="divider-sub">
            {{ t('pages.Setting.divider.function') }}
          </div>
          <el-form-item :label="t('pages.Setting.settingDataForm.startup')" prop="startup">
            <el-switch v-model="settingDataForm.startup" @change="onSettingDataFormChange" />
          </el-form-item>
          <el-form-item
            :label="t('pages.Setting.settingDataForm.openMainWindowOnStartup')"
            prop="openMainWindowOnStartup"
          >
            <el-switch
              v-model="settingDataForm.openMainWindowOnStartup"
              @change="onSettingDataFormChange"
            />
          </el-form-item>
          <el-form-item prop="startH5ServerOnStartup" class="ai-form-item-labeled">
            <template #label>
              <SettingFormLabelTip
                :label="t('pages.Setting.settingDataForm.startH5ServerOnStartup')"
                :hint="t('pages.Setting.settingDataForm.startH5ServerOnStartupHint')"
              />
            </template>
            <el-switch
              v-model="settingDataForm.startH5ServerOnStartup"
              @change="onSettingDataFormChange"
            />
          </el-form-item>
          <el-form-item prop="enableSegmentationTask" class="ai-form-item-labeled">
            <template #label>
              <SettingFormLabelTip
                :label="t('pages.Setting.settingDataForm.enableSegmentationTask')"
                :hint="t('pages.Setting.settingDataForm.enableSegmentationTaskHint')"
              />
            </template>
            <el-switch
              v-model="settingDataForm.enableSegmentationTask"
              @change="onSettingDataFormChange"
            />
          </el-form-item>
          <el-form-item prop="powerSaveMode" class="ai-form-item-labeled">
            <template #label>
              <SettingFormLabelTip
                :label="t('pages.Setting.settingDataForm.powerSaveMode')"
                :hint="t('pages.Setting.settingDataForm.powerSaveModeHint')"
              />
            </template>
            <el-switch
              v-model="settingDataForm.powerSaveMode"
              @change="onSettingDataFormChange"
            />
          </el-form-item>

          <div id="divider-notifications" class="divider-sub">
            {{ t('pages.Setting.divider.notifications') }}
          </div>
          <el-form-item
            v-for="group in notificationsOptions"
            :key="group.name"
            class="notification-form-item"
            :label="t(group.locale)"
          >
            <el-checkbox-group
              v-model="settingDataForm.notifications"
              class="notification-settings__options"
              @change="onSettingDataFormChange"
            >
              <el-checkbox v-for="item in group.children" :key="item.value" :label="item.value">
                <span class="checkbox-label">{{ t(item.locale) }}</span>
              </el-checkbox>
            </el-checkbox-group>
          </el-form-item>

          <div id="divider-explore" class="divider-sub">
            {{ t('pages.Setting.divider.explore') }}
          </div>
          <el-form-item prop="showTag" class="ai-form-item-labeled">
            <template #label>
              <SettingFormLabelTip
                :label="t('pages.Setting.settingDataForm.showTag')"
                :hint="t('pages.Setting.settingDataForm.showTagHint')"
              />
            </template>
            <el-switch v-model="settingDataForm.showTag" @change="onSettingDataFormChange" />
          </el-form-item>
          <el-form-item prop="confirmOnDeleteFile" class="ai-form-item-labeled">
            <template #label>
              <SettingFormLabelTip
                :label="t('pages.Setting.settingDataForm.confirmOnDeleteFile')"
                :hint="t('pages.Setting.settingDataForm.confirmOnDeleteFileHint')"
              />
            </template>
            <el-switch
              v-model="settingDataForm.confirmOnDeleteFile"
              @change="onSettingDataFormChange"
            />
          </el-form-item>
          <el-form-item prop="videoDefaultMuted" class="ai-form-item-labeled">
            <template #label>
              <SettingFormLabelTip
                :label="t('pages.Setting.settingDataForm.videoDefaultMuted')"
                :hint="t('pages.Setting.settingDataForm.videoDefaultMutedHint')"
              />
            </template>
            <el-switch
              v-model="settingDataForm.videoDefaultMuted"
              @change="onSettingDataFormChange"
            />
          </el-form-item>
          <el-form-item class="ai-form-item-labeled">
            <template #label>
              <SettingFormLabelTip
                :label="t('pages.Setting.settingDataForm.viewImageIntervalTime')"
                :hint="t('pages.Setting.settingDataForm.viewImageIntervalTimeHint')"
              />
            </template>
            <div class="setting-form-control-row">
              <el-input-number
                v-model="settingDataForm.viewImageIntervalTime"
                :min="minTimes.viewImageIntervalUnit"
                :max="999"
                controls-position="right"
                style="width: 140px"
                @change="onSettingDataFormChange"
              />
              <el-select
                v-model="settingDataForm.viewImageIntervalUnit"
                style="width: 140px"
                @change="(val) => onTimeUnitChange('viewImageIntervalUnit', val)"
              >
                <el-option
                  v-for="item in intervalUnits.viewImageIntervalUnit"
                  :key="item.value"
                  :label="t(item.locale)"
                  :value="item.value"
                />
              </el-select>
            </div>
          </el-form-item>
        </div>

        <div class="form-card">
          <div id="divider-wallpaper" class="divider">
            {{ t('pages.Setting.divider.wallpaper') }}
          </div>
          <div id="divider-switch" class="divider-sub">
            {{ t('pages.Setting.divider.switch') }}
          </div>
          <el-form-item prop="autoSwitchWallpaper" class="ai-form-item-labeled">
            <template #label>
              <SettingFormLabelTip
                :label="t('pages.Setting.settingDataForm.autoSwitchWallpaper')"
                :hint="t('pages.Setting.settingDataForm.autoSwitchWallpaperHint')"
              />
            </template>
            <el-switch
              v-model="settingDataForm.autoSwitchWallpaper"
              @change="onSettingDataFormChange('autoSwitchWallpaper')"
            />
          </el-form-item>
          <el-form-item prop="switchType" class="ai-form-item-labeled">
            <template #label>
              <SettingFormLabelTip
                :label="t('pages.Setting.settingDataForm.switchType')"
                :hint="t('pages.Setting.settingDataForm.switchTypeHint')"
              />
            </template>
            <el-radio-group
              v-model="settingDataForm.switchType"
              class="setting-radio-group--2"
              @change="onSettingDataFormChange"
            >
              <el-radio v-for="item in switchTypeOptions" :key="item.value" :label="item.value">
                <span class="radio-label">{{ t(item.locale) }}</span>
              </el-radio>
            </el-radio-group>
          </el-form-item>
          <el-form-item class="ai-form-item-labeled">
            <template #label>
              <span class="form-item-label-with-tip__text">{{
                t('pages.Setting.settingDataForm.switchIntervalTime')
              }}</span>
            </template>
            <div class="setting-form-control-row">
              <el-input-number
                v-model="settingDataForm.switchIntervalTime"
                :min="minTimes.switchIntervalUnit"
                :max="999"
                controls-position="right"
                style="width: 140px"
                @change="onSettingDataFormChange"
              />
              <el-select
                v-model="settingDataForm.switchIntervalUnit"
                style="width: 140px"
                @change="(val) => onTimeUnitChange('switchIntervalUnit', val)"
              >
                <el-option
                  v-for="item in intervalUnits.switchIntervalUnit"
                  :key="item.value"
                  :label="t(item.locale)"
                  :value="item.value"
                />
              </el-select>
            </div>
          </el-form-item>
          <el-form-item prop="allScreen" class="ai-form-item-labeled">
            <template #label>
              <SettingFormLabelTip
                :label="t('pages.Setting.settingDataForm.allScreen')"
                :hint="t('pages.Setting.settingDataForm.allScreenHint')"
              />
            </template>
            <el-switch v-model="settingDataForm.allScreen" @change="onSettingDataFormChange" />
          </el-form-item>
          <el-form-item prop="scaleType" class="ai-form-item-labeled">
            <template #label>
              <SettingFormLabelTip
                :label="t('pages.Setting.settingDataForm.scaleType')"
                :hint="t('pages.Setting.settingDataForm.scaleTypeHint')"
              />
            </template>
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
          <el-form-item :label="t('pages.Setting.settingDataForm.orientation')" prop="orientation">
            <el-checkbox-group
              v-model="settingDataForm.orientation"
              class="setting-checkbox-group--2"
              @change="onSettingDataFormChange"
            >
              <el-checkbox v-for="item in orientationOptions" :key="item.value" :label="item.value">
                <span class="setting-checkbox__content">
                  <IconifyIcon :icon="item.icon" class="setting-checkbox__icon" />
                  <span class="checkbox-label">{{ t(item.locale) }}</span>
                </span>
              </el-checkbox>
            </el-checkbox-group>
          </el-form-item>
          <el-form-item :label="t('pages.Setting.settingDataForm.quality')" prop="quality">
            <el-checkbox-group
              v-model="settingDataForm.quality"
              class="setting-checkbox-group--4"
              @change="onSettingDataFormChange"
            >
              <el-checkbox v-for="text in qualityList" :key="text" :label="text">
                <span class="checkbox-label">{{ text }}</span>
              </el-checkbox>
            </el-checkbox-group>
          </el-form-item>
          <el-form-item prop="filterKeywords" class="ai-form-item-labeled">
            <template #label>
              <SettingFormLabelTip
                :label="t('pages.Setting.settingDataForm.filterKeywords.label')"
                :hint="t('pages.Setting.settingDataForm.filterKeywordsHint')"
              />
            </template>
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
          <el-form-item class="ai-form-item-labeled">
            <template #label>
              <SettingFormLabelTip
                :label="t('pages.Setting.settingDataForm.localResourceFolders.label')"
                :hint="t('pages.Setting.settingDataForm.localResourceFoldersHint')"
              />
            </template>
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
          <el-form-item prop="allowedFileExt" class="ai-form-item-labeled">
            <template #label>
              <SettingFormLabelTip
                :label="t('pages.Setting.settingDataForm.allowedFileExt.label')"
                :hint="t('pages.Setting.settingDataForm.allowedFileExtHint')"
              />
            </template>
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
          <el-form-item class="ai-form-item-labeled">
            <template #label>
              <span class="form-item-label-with-tip__text">{{
                t('pages.Setting.settingDataForm.refreshDirectoryIntervalTime')
              }}</span>
            </template>
            <div class="setting-form-control-row">
              <el-input-number
                v-model="settingDataForm.refreshDirectoryIntervalTime"
                :min="minTimes.refreshDirectoryIntervalUnit"
                :max="999"
                controls-position="right"
                style="width: 140px"
                @change="onSettingDataFormChange"
              />
              <el-select
                v-model="settingDataForm.refreshDirectoryIntervalUnit"
                style="width: 140px"
                @change="(val) => onTimeUnitChange('refreshDirectoryIntervalUnit', val)"
              >
                <el-option
                  v-for="item in intervalUnits.refreshDirectoryIntervalUnit"
                  :key="item.value"
                  :label="t(item.locale)"
                  :value="item.value"
                />
              </el-select>
            </div>
          </el-form-item>
          <el-form-item prop="autoRefreshDirectory" class="ai-form-item-labeled">
            <template #label>
              <SettingFormLabelTip
                :label="t('pages.Setting.settingDataForm.autoRefreshDirectory')"
                :hint="t('pages.Setting.settingDataForm.autoRefreshDirectoryHint')"
              />
            </template>
            <el-switch
              v-model="settingDataForm.autoRefreshDirectory"
              :disabled="!settingDataForm.localResourceFolders.length"
              @change="onSettingDataFormChange"
            />
          </el-form-item>

          <div id="divider-remoteResource" class="divider-sub">
            {{ t('pages.Setting.divider.remoteResource') }}
          </div>
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
              class="setting-checkbox-group--2"
              :disabled="!settingDataForm.downloadSources.length"
              @change="onSettingDataFormChange"
            >
              <el-checkbox v-for="item in orientationOptions" :key="item.value" :label="item.value">
                <span class="setting-checkbox__content">
                  <IconifyIcon :icon="item.icon" class="setting-checkbox__icon" />
                  <span class="checkbox-label">{{ t(item.locale) }}</span>
                </span>
              </el-checkbox>
            </el-checkbox-group>
          </el-form-item>
          <el-form-item
            :label="t('pages.Setting.settingDataForm.downloadMediaTypes')"
            prop="downloadMediaTypes"
          >
            <el-checkbox-group
              v-model="settingDataForm.downloadMediaTypes"
              class="setting-checkbox-group--2"
              :disabled="!settingDataForm.downloadSources.length"
              @change="onDownloadMediaTypesChange"
            >
              <el-checkbox
                v-for="item in filterTypeOptions"
                :key="item.value"
                :label="item.value"
              >
                <span class="setting-checkbox__content">
                  <IconifyIcon :icon="item.icon" class="setting-checkbox__icon" />
                  <span class="checkbox-label">{{ t(item.locale) }}</span>
                </span>
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
              :max="maxDownloadKeywordsCount"
              @change="onDownloadKeywordsChange"
            />
          </el-form-item>
          <el-form-item class="ai-form-item-labeled">
            <template #label>
              <SettingFormLabelTip
                :label="t('pages.Setting.aiSetting.expandDownloadKeywords')"
                :hint="t('pages.Setting.aiSetting.expandDownloadKeywordsHint')"
              />
            </template>
            <el-switch
              v-model="settingDataForm.ai.expandDownloadKeywords"
              :disabled="expandDownloadKeywordsDisabled"
              @change="onSettingDataFormChange"
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
          <el-form-item class="ai-form-item-labeled">
            <template #label>
              <span class="form-item-label-with-tip__text">{{
                t('pages.Setting.settingDataForm.downloadIntervalTime')
              }}</span>
            </template>
            <div class="setting-form-control-row">
              <el-input-number
                v-model="settingDataForm.downloadIntervalTime"
                :disabled="!settingDataForm.downloadSources.length"
                :min="minTimes.downloadIntervalUnit"
                :max="999"
                controls-position="right"
                style="width: 140px"
                @change="onSettingDataFormChange"
              />
              <el-select
                v-model="settingDataForm.downloadIntervalUnit"
                :disabled="!settingDataForm.downloadSources.length"
                style="width: 140px"
                @change="(val) => onTimeUnitChange('downloadIntervalUnit', val)"
              >
                <el-option
                  v-for="item in intervalUnits.downloadIntervalUnit"
                  :key="item.value"
                  :label="t(item.locale)"
                  :value="item.value"
                />
              </el-select>
            </div>
          </el-form-item>
          <el-form-item prop="autoDownload" class="ai-form-item-labeled">
            <template #label>
              <SettingFormLabelTip
                :label="t('pages.Setting.settingDataForm.autoDownload')"
                :hint="t('pages.Setting.settingDataForm.autoDownloadHint')"
              />
            </template>
            <el-switch
              v-model="settingDataForm.autoDownload"
              :disabled="!settingDataForm.downloadSources.length || !settingDataForm.downloadFolder"
              @change="onSettingDataFormChange"
            />
          </el-form-item>
          <el-form-item class="ai-form-item-labeled">
            <template #label>
              <span class="form-item-label-with-tip__text">{{
                t('pages.Setting.settingDataForm.clearDownloadedExpiredTime')
              }}</span>
            </template>
            <div class="setting-form-control-row">
              <el-input-number
                v-model="settingDataForm.clearDownloadedExpiredTime"
                :min="minTimes.clearDownloadedExpiredUnit"
                :max="999"
                controls-position="right"
                style="width: 140px"
                @change="onSettingDataFormChange"
              />
              <el-select
                v-model="settingDataForm.clearDownloadedExpiredUnit"
                style="width: 140px"
                @change="(val) => onTimeUnitChange('clearDownloadedExpiredUnit', val)"
              >
                <el-option
                  v-for="item in intervalUnits.clearDownloadedExpiredUnit"
                  :key="item.value"
                  :label="t(item.locale)"
                  :value="item.value"
                />
              </el-select>
            </div>
          </el-form-item>
          <el-form-item
            :label="t('pages.Setting.settingDataForm.autoClearDownloaded')"
            prop="autoClearDownloaded"
          >
            <el-switch
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
          <el-form-item class="ai-form-item-labeled">
            <template #label>
              <span class="form-item-label-with-tip__text">{{
                t('pages.Setting.settingDataForm.refreshWebWallpaperIntervalTime')
              }}</span>
            </template>
            <div class="setting-form-control-row">
              <el-input-number
                v-model="settingDataForm.refreshWebWallpaperIntervalTime"
                :min="minTimes.refreshWebWallpaperIntervalUnit"
                :max="999"
                controls-position="right"
                style="width: 140px"
                @change="onSettingDataFormChange"
              />
              <el-select
                v-model="settingDataForm.refreshWebWallpaperIntervalUnit"
                style="width: 140px"
                @change="(val) => onTimeUnitChange('refreshWebWallpaperIntervalUnit', val)"
              >
                <el-option
                  v-for="item in intervalUnits.refreshWebWallpaperIntervalUnit"
                  :key="item.value"
                  :label="t(item.locale)"
                  :value="item.value"
                />
              </el-select>
            </div>
          </el-form-item>
          <el-form-item
            :label="t('pages.Setting.settingDataForm.autoRefreshWebWallpaper')"
            prop="autoRefreshWebWallpaper"
          >
            <el-switch
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
            <el-switch
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
          <el-form-item prop="dynamicPerformanceMode" class="ai-form-item-labeled">
            <template #label>
              <SettingFormLabelTip
                :label="t('pages.Setting.settingDataForm.dynamicPerformanceMode.label')"
                :hint="t('pages.Setting.settingDataForm.dynamicPerformanceModeHint')"
              />
            </template>
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
</template>

<style scoped lang="scss">
.base-settings-wrapper {
  display: flex;
  flex-direction: row;
  justify-content: space-between;
  align-items: stretch;
  gap: 20px;
  height: calc(100vh - 110px);
  overflow: hidden;
}

.setting-anchor-sidebar {
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
  width: 200px;
  min-width: 200px;
  height: 100%;
  min-height: 0;
  gap: 10px;

  &__scroll {
    flex: 1 1 0;
    min-height: 0;
    align-self: stretch;
    overflow: hidden;

    :deep(.el-scrollbar__wrap) {
      height: 100%;
      overflow-x: hidden;
    }

    :deep(.el-scrollbar__view) {
      min-height: 100%;
      display: flex;
      flex-direction: column;
    }
  }
}

.ai-sidebar-card {
  box-sizing: border-box;
  width: 100%;
  padding: 14px 16px;
  border-radius: 6px;
  border: 1px solid var(--el-border-color-lighter);
  background-color: #ffffff;
  box-shadow: none;
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
.setting-anchor-sidebar__scroll .anchor-block {
  flex: 1 1 auto;
  width: 100%;
  min-height: 100%;
  height: auto;
  overflow: visible;
  box-sizing: border-box;
}

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
