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
  positionOptions,
  defaultMenuList,
  keyboardShortcuts
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

// 快捷键设置相关数据
const shortcuts = ref({})
const shortcutsConflicts = ref([])
const editingShortcut = ref('')
const editingShortcutName = ref(null)
const isShortcutRecording = ref(false)

// 计算属性
const shortcutCategories = computed(() => {
  const cats = new Set()
  Object.values(shortcuts.value).forEach((item) => {
    if (item.visible === true) {
      cats.add(item.category)
    }
  })
  return Array.from(cats)
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
    case 'shortcutSetting':
      stopEditing()
      break
  }
  if (!formEl) return
  formEl.resetFields()
}

// 快捷键设置相关方法
const getShortcutsByCategory = (category) => {
  return Object.values(shortcuts.value).filter(
    (item) => item.category === category && item.visible === true
  )
}

const isEditing = (name) => {
  return editingShortcutName.value === name
}

// 获取默认快捷键
const getDefaultShortcut = (name) => {
  const shortcutItem = keyboardShortcuts.find((item) => item.name === name)
  if (!shortcutItem) return ''

  const platform = commonData.value?.isMac ? 'mac' : commonData.value?.isWin ? 'win' : 'linux'
  return shortcutItem.shortcuts[platform] || ''
}

// 检查快捷键是否被修改
const isShortcutModified = (name, currentShortcut) => {
  const defaultShortcut = getDefaultShortcut(name)
  return currentShortcut !== defaultShortcut
}

// 输入框refs
const inputRefs = ref({})

const startEdit = async (name) => {
  editingShortcutName.value = name
  editingShortcut.value = ''

  // 禁用所有快捷键，防止在编辑时触发已注册的快捷键
  await window.FBW.disableShortcuts()

  // 延迟一下让DOM更新，然后自动focus输入框
  setTimeout(() => {
    if (inputRefs.value[name]) {
      inputRefs.value[name].focus()
    }
  }, 100)
}

const stopEditing = async () => {
  editingShortcutName.value = null
  editingShortcut.value = ''

  // 重新启用所有快捷键
  await window.FBW.enableShortcuts()
}

const startRecording = async (name) => {
  // 检查是否可编辑
  const shortcutItem = shortcuts.value[name]
  if (shortcutItem && !shortcutItem.editable) {
    return
  }

  // 禁用所有快捷键，防止在编辑时触发已注册的快捷键
  await window.FBW.disableShortcuts()

  isShortcutRecording.value = true
  editingShortcutName.value = name
  editingShortcut.value = ''
}

const stopRecording = async () => {
  isShortcutRecording.value = false
  editingShortcutName.value = null
  editingShortcut.value = ''

  // 重新启用所有快捷键
  await window.FBW.enableShortcuts()
}

const handleBlur = async (name) => {
  // 检查是否可编辑
  const shortcutItem = shortcuts.value[name]
  if (shortcutItem && !shortcutItem.editable) {
    return
  }

  if (editingShortcutName.value === name && editingShortcut.value) {
    await updateShortcut(name, editingShortcut.value)
  }
  await stopRecording()
}

const handleKeydown = (event, name) => {
  if (!isShortcutRecording.value) return

  // 检查是否可编辑
  const shortcutItem = shortcuts.value[name]
  if (shortcutItem && !shortcutItem.editable) {
    return
  }

  // 阻止默认行为
  event.preventDefault()
  event.stopPropagation()

  // 构建快捷键字符串
  const keys = []
  if (event.metaKey || event.ctrlKey) {
    keys.push(commonData.value?.isMac ? 'Command' : 'Ctrl')
  }
  if (event.shiftKey) {
    keys.push('Shift')
  }
  if (event.altKey) {
    keys.push('Alt')
  }

  // 只处理字母、数字和功能键
  let key = event.key
  // 转换箭头键名格式
  if (key.startsWith('Arrow')) {
    key = key.replace('Arrow', '')
  }
  // 将单字母键转换为大写
  if (key.length === 1 && /[a-zA-Z]/.test(key)) {
    key = key.toUpperCase()
  }
  // 过滤掉修饰键
  if (key && !['Meta', 'Control', 'Shift', 'Alt'].includes(key)) {
    keys.push(key)
  }

  // 确保修饰键顺序一致，与主进程保持统一
  const modifierOrder = ['Command', 'Ctrl', 'Shift', 'Alt']
  const sortedKeys = []
  // 先添加修饰键，按照统一顺序
  modifierOrder.forEach((modifier) => {
    if (keys.includes(modifier)) {
      sortedKeys.push(modifier)
    }
  })
  // 再添加非修饰键
  keys.forEach((k) => {
    if (!modifierOrder.includes(k)) {
      sortedKeys.push(k)
    }
  })
  // 使用排序后的键数组
  keys.splice(0, keys.length, ...sortedKeys)

  if (keys.length > 0) {
    const shortcut = keys.join('+')
    editingShortcut.value = shortcut
  }
}

const handleKeyup = async (event, name) => {
  if (!isShortcutRecording.value) return

  // 检查是否可编辑
  const shortcutItem = shortcuts.value[name]
  if (shortcutItem && !shortcutItem.editable) {
    return
  }

  // 阻止默认行为
  event.preventDefault()
  event.stopPropagation()

  // 构建快捷键字符串
  const keys = []
  if (event.metaKey || event.ctrlKey) {
    keys.push(commonData.value?.isMac ? 'Command' : 'Ctrl')
  }
  if (event.shiftKey) {
    keys.push('Shift')
  }
  if (event.altKey) {
    keys.push('Alt')
  }

  // 只处理字母、数字和功能键
  let key = event.key
  // 转换箭头键名格式
  if (key.startsWith('Arrow')) {
    key = key.replace('Arrow', '')
  }
  // 将单字母键转换为大写
  if (key.length === 1 && /[a-zA-Z]/.test(key)) {
    key = key.toUpperCase()
  }
  // 过滤掉修饰键
  if (key && !['Meta', 'Control', 'Shift', 'Alt'].includes(key)) {
    keys.push(key)
  }

  // 确保修饰键顺序一致，与主进程保持统一
  const modifierOrder = ['Command', 'Ctrl', 'Shift', 'Alt']
  const sortedKeys = []
  // 先添加修饰键，按照统一顺序
  modifierOrder.forEach((modifier) => {
    if (keys.includes(modifier)) {
      sortedKeys.push(modifier)
    }
  })
  // 再添加非修饰键
  keys.forEach((k) => {
    if (!modifierOrder.includes(k)) {
      sortedKeys.push(k)
    }
  })
  // 使用排序后的键数组
  keys.splice(0, keys.length, ...sortedKeys)

  if (keys.length > 1) {
    const shortcut = keys.join('+')
    editingShortcut.value = shortcut

    // 检查是否只包含修饰键
    const modifiers = ['Command', 'Ctrl', 'Shift', 'Alt']
    const nonModifierKeys = keys.filter((key) => !modifiers.includes(key))
    if (nonModifierKeys.length === 0) {
      ElMessage.warning(t('messages.invalidShortcutOnlyModifiers'))
      // 重置编辑状态，允许用户重新输入
      stopRecording()
      return
    }

    // 检查快捷键格式是否有效
    const isValidFormat = /^([A-Za-z]+([+][A-Za-z0-9]+)*)$/.test(shortcut)
    if (!isValidFormat) {
      ElMessage.warning(t('messages.invalidShortcutFormat'))
      // 重置编辑状态，允许用户重新输入
      stopRecording()
      return
    }

    // 检查冲突
    const conflictRes = await window.FBW.checkShortcutConflict(shortcut, name)
    if (!conflictRes.success) {
      ElMessage.warning(conflictRes.message)
      // 重置编辑状态，允许用户重新输入
      stopRecording()
      return
    }

    // 保存快捷键
    await updateShortcut(name, shortcut)
    await stopRecording()
  }
}

// 检查快捷键是否有冲突
const hasConflict = (shortcutName) => {
  return shortcutsConflicts.value.some((conflict) => conflict.name === shortcutName)
}

// 表格行样式
const tableRowClassName = ({ row }) => {
  if (hasConflict(row.name)) {
    return 'conflict-row'
  }
  return ''
}

// 获取冲突信息
const getConflictMessage = (shortcutName) => {
  const conflict = shortcutsConflicts.value.find((conflict) => conflict.name === shortcutName)
  return conflict ? conflict.message : ''
}

const updateShortcut = async (name, shortcut, successMessage = '') => {
  // 检查是否可编辑
  const shortcutItem = shortcuts.value[name]
  if (shortcutItem && !shortcutItem.editable) {
    ElMessage.warning(t('messages.notEditableShortcut'))
    // 重置编辑状态
    stopRecording()
    return
  }

  try {
    const res = await window.FBW.updateShortcut(name, shortcut)
    if (res.success) {
      ElMessage.success(successMessage || res.message)
      // 重新加载快捷键
      await loadShortcuts()
      await loadConflicts()
    } else {
      ElMessage.error(res.message)
      // 重置编辑状态
      await stopRecording()
    }
  } catch (error) {
    ElMessage.error(t('messages.shortcutUpdateFailed'))
    console.error('更新快捷键失败:', error)
    // 重置编辑状态
    await stopRecording()
  }
}

// 重置快捷键到默认值
const resetShortcut = async (name) => {
  try {
    // 如果当前正在编辑这个快捷键，清除编辑状态
    if (editingShortcutName.value === name) {
      editingShortcutName.value = null
      editingShortcut.value = ''
    }

    const res = await window.FBW.resetShortcut(name)
    if (res.success) {
      ElMessage.success(res.message)
      // 重新加载快捷键
      await loadShortcuts()
      await loadConflicts()
    } else {
      ElMessage.error(res.message)
    }
  } catch (error) {
    ElMessage.error(t('messages.shortcutResetFailed'))
    console.error('重置快捷键失败:', error)
  }
}

// 清空快捷键
const emptyShortcut = async (name) => {
  // 如果当前正在编辑这个快捷键，清除编辑状态
  if (editingShortcutName.value === name) {
    editingShortcutName.value = null
    editingShortcut.value = ''
  }
  // 立即更新本地数据，确保输入框立即显示为空
  if (shortcuts.value[name]) {
    // 使用展开运算符创建新对象，确保Vue能够检测到变化
    shortcuts.value = {
      ...shortcuts.value,
      [name]: {
        ...shortcuts.value[name],
        shortcut: ''
      }
    }
  }
  await updateShortcut(name, '', t('messages.shortcutEmptySuccess'))
}

const loadShortcuts = async () => {
  try {
    const data = await window.FBW.getShortcuts()
    shortcuts.value = data
  } catch (error) {
    console.error('加载快捷键失败:', error)
  }
}

const loadConflicts = async () => {
  try {
    const res = await window.FBW.getShortcutConflicts()

    if (res.success && res.data) {
      shortcutsConflicts.value = res.data
    }
  } catch (error) {
    console.error('加载冲突信息失败:', error)
  }
}

// 辅助函数
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

onMounted(async () => {
  initMinTimes()
  // 加载快捷键数据
  if (activeTab.value === 'shortcutSetting') {
    await loadShortcuts()
    await loadConflicts()
  }
})

// 监听标签页变化
watch(activeTab, async (newTab) => {
  if (newTab === 'shortcutSetting') {
    await loadShortcuts()
    await loadConflicts()
  }
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
      <el-tab-pane
        :label="t('pages.Setting.tabs.shortcutSetting')"
        name="shortcutSetting"
      ></el-tab-pane>
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
            <el-form-item prop="locale">
              <template #label>
                <IconifyIcon
                  icon="custom:language"
                  style="align-self: center; margin-right: 10px"
                />
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
            <el-form-item
              :label="t('pages.Setting.settingDataForm.defaultMenu')"
              prop="defaultMenu"
            >
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
                  <IconifyIcon
                    :icon="item.icon"
                    style="vertical-align: middle; margin-right: 10px"
                  />
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
                  <IconifyIcon
                    :icon="item.icon"
                    style="
                      vertical-align: middle;
                      margin-right: 10px;
                      color: var(--el-text-color-regular);
                    "
                  />
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
                  <IconifyIcon
                    :icon="item.icon"
                    style="
                      vertical-align: middle;
                      margin-right: 10px;
                      color: var(--el-text-color-regular);
                    "
                  />
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
                  <IconifyIcon
                    :icon="item.icon"
                    style="
                      vertical-align: middle;
                      margin-right: 10px;
                      color: var(--el-text-color-regular);
                    "
                  />
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
    <div v-show="activeTab === 'privacySpace'" class="privacy-space-wrapper">
      <el-scrollbar style="height: 100%">
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
    </div>

    <div v-show="activeTab === 'shortcutSetting'" class="shortcut-settings-wrapper">
      <el-scrollbar style="height: 100%">
        <div class="shortcut-settings">
          <!-- 快捷键列表 -->
          <div v-for="category in shortcutCategories" :key="category" class="form-card">
            <h4 class="category-title">
              {{ t('pages.Setting.shortcutSetting.categories.' + category) }}
            </h4>
            <el-table
              :data="getShortcutsByCategory(category)"
              style="width: 100%"
              border
              :row-class-name="tableRowClassName"
            >
              <el-table-column
                prop="description"
                :label="t('pages.Setting.shortcutSetting.function')"
                width="200"
              >
                <template #default="scope">
                  {{ t(scope.row.locale) }}
                  <el-tooltip
                    v-if="hasConflict(scope.row.name)"
                    effect="dark"
                    :content="getConflictMessage(scope.row.name)"
                    placement="top"
                  >
                    <el-tag size="small" type="danger" style="margin-left: 10px">
                      {{ t('pages.Setting.shortcutSetting.conflict') }}
                    </el-tag>
                  </el-tooltip>
                </template>
              </el-table-column>
              <el-table-column prop="shortcut" :label="t('pages.Setting.shortcutSetting.shortcut')">
                <template #default="scope">
                  <div class="shortcut-input">
                    <el-input
                      :value="isEditing(scope.row.name) ? editingShortcut : scope.row.shortcut"
                      :placeholder="
                        isEditing(scope.row.name)
                          ? t('pages.Setting.shortcutSetting.pressShortcut')
                          : t('pages.Setting.shortcutSetting.notSet')
                      "
                      @focus="startRecording(scope.row.name)"
                      @blur="handleBlur(scope.row.name)"
                      @keydown="handleKeydown($event, scope.row.name)"
                      @keyup="handleKeyup($event, scope.row.name)"
                      :disabled="!scope.row.editable"
                      :class="{ 'shortcut-input-editing': isEditing(scope.row.name) }"
                      :ref="
                        (el) => {
                          if (el) {
                            inputRefs[scope.row.name] = el
                          } else {
                            delete inputRefs[scope.row.name]
                          }
                        }
                      "
                    />
                  </div>
                </template>
              </el-table-column>
              <el-table-column
                :label="t('pages.Setting.shortcutSetting.operation')"
                width="180"
                fixed="right"
              >
                <template #default="scope">
                  <el-button
                    size="small"
                    :disabled="!scope.row.editable"
                    @click="resetShortcut(scope.row.name)"
                    v-if="
                      scope.row.editable && isShortcutModified(scope.row.name, scope.row.shortcut)
                    "
                  >
                    {{ t('pages.Setting.shortcutSetting.reset') }}
                  </el-button>
                  <el-button
                    size="small"
                    type="danger"
                    :disabled="!scope.row.editable"
                    @click="emptyShortcut(scope.row.name)"
                    v-if="scope.row.editable && scope.row.shortcut"
                  >
                    {{ t('pages.Setting.shortcutSetting.empty') }}
                  </el-button>
                </template>
              </el-table-column>
            </el-table>
          </div>
        </div>
      </el-scrollbar>
    </div>
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

.privacy-space-wrapper {
  height: calc(100vh - 110px);
  position: relative;
}

.shortcut-settings-wrapper {
  height: calc(100vh - 110px);
  position: relative;
}

.shortcut-settings {
  margin: 0 auto;
}

.conflict-warning {
  padding: 0;
  position: sticky;
  top: 0;
  z-index: 100;
}

.conflict-item {
  margin-top: 5px;
  font-size: 14px;
}

.conflict-shortcut {
  font-weight: bold;
  margin-right: 10px;
}

.shortcut-input {
  position: relative;
}

.shortcut-input-editing {
  border-color: var(--el-color-primary) !important;
  box-shadow: 0 0 0 2px rgba(144, 147, 153, 0.1) !important;
}

.shortcut-input-editing:hover {
  border-color: var(--el-color-primary) !important;
}

.shortcut-input-editing:focus-within {
  border-color: var(--el-color-primary) !important;
  box-shadow: 0 0 0 2px rgba(144, 147, 153, 0.2) !important;
}

.category-title {
  margin-top: 0;
  margin-bottom: 15px;
  font-size: 16px;
  font-weight: bold;
  color: var(--el-text-color-primary);
  border-bottom: 1px solid var(--el-border-color);
  padding-bottom: 8px;
}

/* 冲突行样式 */
:deep(.conflict-row) {
  background-color: rgba(245, 108, 108, 0.1) !important;
}

:deep(.conflict-row:hover) {
  background-color: rgba(245, 108, 108, 0.2) !important;
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
