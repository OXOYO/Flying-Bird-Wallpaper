<script setup>
import UseCommonStore from '@renderer/stores/commonStore.js'
import { keyboardShortcuts } from '@common/publicData.js'
import { useTranslation } from 'i18next-vue'

const { t } = useTranslation()
const commonStore = UseCommonStore()
const { commonData } = storeToRefs(commonStore)

const shortcuts = ref({})
const shortcutsConflicts = ref([])
const editingShortcut = ref('')
const editingShortcutName = ref(null)
const isShortcutRecording = ref(false)
const inputRefs = ref({})

const shortcutCategories = computed(() => {
  const cats = new Set()
  Object.values(shortcuts.value).forEach((item) => {
    if (item.visible === true) {
      cats.add(item.category)
    }
  })
  return Array.from(cats)
})

const getShortcutsByCategory = (category) => {
  return Object.values(shortcuts.value).filter(
    (item) => item.category === category && item.visible === true
  )
}

const isEditing = (name) => {
  return editingShortcutName.value === name
}

const getDefaultShortcut = (name) => {
  const shortcutItem = keyboardShortcuts.find((item) => item.name === name)
  if (!shortcutItem) return ''

  const platform = commonData.value?.isMac ? 'mac' : commonData.value?.isWin ? 'win' : 'linux'
  return shortcutItem.shortcuts[platform] || ''
}

const isShortcutModified = (name, currentShortcut) => {
  const defaultShortcut = getDefaultShortcut(name)
  return currentShortcut !== defaultShortcut
}

const startEdit = async (name) => {
  editingShortcutName.value = name
  editingShortcut.value = ''

  await window.FBW.disableShortcuts()

  setTimeout(() => {
    if (inputRefs.value[name]) {
      inputRefs.value[name].focus()
    }
  }, 100)
}

const stopEditing = async () => {
  editingShortcutName.value = null
  editingShortcut.value = ''

  await window.FBW.enableShortcuts()
}

const startRecording = async (name) => {
  const shortcutItem = shortcuts.value[name]
  if (shortcutItem && !shortcutItem.editable) {
    return
  }

  await window.FBW.disableShortcuts()

  isShortcutRecording.value = true
  editingShortcutName.value = name
  editingShortcut.value = ''
}

const stopRecording = async () => {
  isShortcutRecording.value = false
  editingShortcutName.value = null
  editingShortcut.value = ''

  await window.FBW.enableShortcuts()
}

const handleBlur = async (name) => {
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

  const shortcutItem = shortcuts.value[name]
  if (shortcutItem && !shortcutItem.editable) {
    return
  }

  event.preventDefault()
  event.stopPropagation()

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

  let key = event.key
  if (key.startsWith('Arrow')) {
    key = key.replace('Arrow', '')
  }
  if (key.length === 1 && /[a-zA-Z]/.test(key)) {
    key = key.toUpperCase()
  }
  if (key && !['Meta', 'Control', 'Shift', 'Alt'].includes(key)) {
    keys.push(key)
  }

  const modifierOrder = ['Command', 'Ctrl', 'Shift', 'Alt']
  const sortedKeys = []
  modifierOrder.forEach((modifier) => {
    if (keys.includes(modifier)) {
      sortedKeys.push(modifier)
    }
  })
  keys.forEach((k) => {
    if (!modifierOrder.includes(k)) {
      sortedKeys.push(k)
    }
  })
  keys.splice(0, keys.length, ...sortedKeys)

  if (keys.length > 0) {
    const shortcut = keys.join('+')
    editingShortcut.value = shortcut
  }
}

const handleKeyup = async (event, name) => {
  if (!isShortcutRecording.value) return

  const shortcutItem = shortcuts.value[name]
  if (shortcutItem && !shortcutItem.editable) {
    return
  }

  event.preventDefault()
  event.stopPropagation()

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

  let key = event.key
  if (key.startsWith('Arrow')) {
    key = key.replace('Arrow', '')
  }
  if (key.length === 1 && /[a-zA-Z]/.test(key)) {
    key = key.toUpperCase()
  }
  if (key && !['Meta', 'Control', 'Shift', 'Alt'].includes(key)) {
    keys.push(key)
  }

  const modifierOrder = ['Command', 'Ctrl', 'Shift', 'Alt']
  const sortedKeys = []
  modifierOrder.forEach((modifier) => {
    if (keys.includes(modifier)) {
      sortedKeys.push(modifier)
    }
  })
  keys.forEach((k) => {
    if (!modifierOrder.includes(k)) {
      sortedKeys.push(k)
    }
  })
  keys.splice(0, keys.length, ...sortedKeys)

  if (keys.length > 1) {
    const shortcut = keys.join('+')
    editingShortcut.value = shortcut

    const modifiers = ['Command', 'Ctrl', 'Shift', 'Alt']
    const nonModifierKeys = keys.filter((key) => !modifiers.includes(key))
    if (nonModifierKeys.length === 0) {
      ElMessage.warning(t('messages.invalidShortcutOnlyModifiers'))
      stopRecording()
      return
    }

    const isValidFormat = /^([A-Za-z]+([+][A-Za-z0-9]+)*)$/.test(shortcut)
    if (!isValidFormat) {
      ElMessage.warning(t('messages.invalidShortcutFormat'))
      stopRecording()
      return
    }

    const conflictRes = await window.FBW.checkShortcutConflict(shortcut, name)
    if (!conflictRes.success) {
      ElMessage.warning(conflictRes.message)
      stopRecording()
      return
    }

    await updateShortcut(name, shortcut)
    await stopRecording()
  }
}

const hasConflict = (shortcutName) => {
  return shortcutsConflicts.value.some((conflict) => conflict.name === shortcutName)
}

const tableRowClassName = ({ row }) => {
  if (hasConflict(row.name)) {
    return 'conflict-row'
  }
  return ''
}

const getConflictMessage = (shortcutName) => {
  const conflict = shortcutsConflicts.value.find((conflict) => conflict.name === shortcutName)
  return conflict ? conflict.message : ''
}

const updateShortcut = async (name, shortcut, successMessage = '') => {
  const shortcutItem = shortcuts.value[name]
  if (shortcutItem && !shortcutItem.editable) {
    ElMessage.warning(t('messages.notEditableShortcut'))
    stopRecording()
    return
  }

  try {
    const res = await window.FBW.updateShortcut(name, shortcut)
    if (res.success) {
      ElMessage.success(successMessage || res.message)
      await loadShortcuts()
      await loadConflicts()
    } else {
      ElMessage.error(res.message)
      await stopRecording()
    }
  } catch (error) {
    ElMessage.error(t('messages.shortcutUpdateFailed'))
    console.error('更新快捷键失败:', error)
    await stopRecording()
  }
}

const resetShortcut = async (name) => {
  try {
    if (editingShortcutName.value === name) {
      editingShortcutName.value = null
      editingShortcut.value = ''
    }

    const res = await window.FBW.resetShortcut(name)
    if (res.success) {
      ElMessage.success(res.message)
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

const emptyShortcut = async (name) => {
  if (editingShortcutName.value === name) {
    editingShortcutName.value = null
    editingShortcut.value = ''
  }

  if (shortcuts.value[name]) {
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

onMounted(async () => {
  await loadShortcuts()
  await loadConflicts()
})

onBeforeUnmount(() => {
  stopEditing()
})

defineExpose({
  resetForm: () => {
    stopEditing()
  }
})
</script>

<template>
  <div class="shortcut-settings-wrapper">
    <el-scrollbar style="height: 100%">
      <div class="shortcut-settings">
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
                    :value="
                      isEditing(scope.row.name) ? editingShortcut : scope.row.displayShortcut
                    "
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
</template>

<style scoped lang="scss">
.shortcut-settings-wrapper {
  height: calc(100vh - 110px);
  position: relative;
}

.shortcut-settings {
  margin: 0 auto;
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
</style>

<style lang="scss">
:deep(.conflict-row) {
  background-color: rgba(245, 108, 108, 0.1) !important;
}

:deep(.conflict-row:hover) {
  background-color: rgba(245, 108, 108, 0.2) !important;
}
</style>
