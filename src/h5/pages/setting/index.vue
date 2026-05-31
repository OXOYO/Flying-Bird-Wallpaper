<script setup>
import {
  h5FloatingButtonPositionOptions,
  h5FloatingButtonsOptions,
  h5NumberIndicatorPositionOptions
} from '@common/publicData.js'
import { localeOptions } from '@i18n/locale/index.js'
import { appInfo } from '@common/config.js'
import UseSettingStore from '@h5/stores/settingStore.js'
import * as api from '@h5/api/index.js'
import { resolveApiUserMessage } from '@common/utils.js'
import { useTranslation } from 'i18next-vue'
import H5PrivacyPasswordDialog from '@h5/components/H5PrivacyPasswordDialog.vue'
import { useNsfwMaskSettingToggle } from '@common/composables/useNsfwMaskSettingToggle.mjs'

const { t } = useTranslation()

const settingStore = UseSettingStore()
const { settingData, localSetting, isVibrationSupported } = storeToRefs(settingStore)

const settingDataForm = reactive(settingData.value)
const localSettingForm = reactive(localSetting.value)

/** 设置分类折叠，默认展开「应用设置」 */
const expandedSections = ref(['application', 'privacy'])

const ensurePrivacyForm = () => {
  if (!settingDataForm.privacy || typeof settingDataForm.privacy !== 'object') {
    settingDataForm.privacy = {
      enableNsfwContentMask: !!settingData.value?.privacy?.enableNsfwContentMask
    }
  }
}
ensurePrivacyForm()

const privacyPasswordDialogRef = ref(null)

const syncNsfwMaskFromStore = () => {
  ensurePrivacyForm()
  settingDataForm.privacy.enableNsfwContentMask = !!settingData.value?.privacy?.enableNsfwContentMask
}

const { toggling: nsfwMaskToggling, onToggle: onNsfwMaskSwitchChange } = useNsfwMaskSettingToggle({
  t,
  getEnabled: () => !!settingDataForm.privacy?.enableNsfwContentMask,
  setEnabled: (v) => {
    ensurePrivacyForm()
    settingDataForm.privacy.enableNsfwContentMask = v
  },
  hasPrivacyPassword: () => api.hasPrivacyPassword(),
  openPasswordDialog: () => privacyPasswordDialogRef.value?.open(),
  checkPrivacyPassword: (pwd) => api.checkPrivacyPassword(pwd),
  persistEnabled: async (enabled) => {
    const res = await settingStore.h5UpdateSettingData({
      privacy: { enableNsfwContentMask: enabled }
    })
    if (res?.success) {
      showNotify({
        type: 'success',
        message: String(res.message ?? '').trim() || t('messages.operationSuccess')
      })
      return true
    }
    syncNsfwMaskFromStore()
    showNotify({
      type: 'danger',
      message: resolveApiUserMessage(res, t)
    })
    return false
  },
  onNotify: ({ type, message }) => {
    showNotify({
      type: type === 'warn' ? 'warning' : type === 'error' ? 'danger' : 'success',
      message
    })
  }
})

const showPickers = reactive({
  h5Locale: false,
  h5FloatingButtonPosition: false,
  h5EnabledFloatingButtons: false,
  h5NumberIndicatorPosition: false
})

// 选中的浮动按钮
const floatingButtonsChecked = reactive({})

const optionsToColumns = (options) => {
  return options.map((option) => ({
    value: option.value,
    text: option.locale ? t(option.locale) : option.label
  }))
}

const addEmptyOption = (options) => {
  return [
    {
      value: '',
      text: '-'
    },
    ...options
  ]
}

const pickerColumns = computed(() => {
  return {
    h5Locale: optionsToColumns(localeOptions),
    h5FloatingButtonPosition: optionsToColumns(h5FloatingButtonPositionOptions),
    h5EnabledFloatingButtons: optionsToColumns(h5FloatingButtonsOptions),
    h5NumberIndicatorPosition: addEmptyOption(optionsToColumns(h5NumberIndicatorPositionOptions))
  }
})

const fieldsData = computed(() => {
  let ret = {
    h5Locale: '',
    h5FloatingButtonPosition: '',
    h5NumberIndicatorPosition: ''
  }
  Object.keys(ret).forEach((key) => {
    const target = pickerColumns.value[key].find((item) => item.value === settingDataForm[key])
    ret[key] = target ? target.text : ''
  })

  return ret
})

watch(
  () => settingStore.settingData,
  (newValue) => {
    Object.keys(newValue).forEach((key) => {
      settingDataForm[key] = newValue[key]
    })
    ensurePrivacyForm()
  }
)

const init = () => {
  initFloatingButtonsChecked()
}

const initFloatingButtonsChecked = () => {
  pickerColumns.value.h5EnabledFloatingButtons.forEach((item) => {
    floatingButtonsChecked[item.value] = settingData.value.h5EnabledFloatingButtons.includes(
      item.value
    )
      ? true
      : false
  })
}

const onShowPicker = (field) => {
  showPickers[field] = true
  if (field === 'h5EnabledFloatingButtons') {
    initFloatingButtonsChecked()
  }
}

const onConfirmPicker = (field, { selectedValues }) => {
  showPickers[field] = false
  switch (field) {
    case 'h5Locale':
      settingDataForm.h5Locale = selectedValues[0]
      settingDataForm.isH5LocaleSet = true
      break
    case 'h5FloatingButtonPosition':
    case 'h5NumberIndicatorPosition':
      settingDataForm[field] = selectedValues[0]
      break
    case 'h5EnabledFloatingButtons':
      settingDataForm.h5EnabledFloatingButtons = Object.keys(floatingButtonsChecked).filter(
        (key) => {
          return floatingButtonsChecked[key]
        }
      )
      break
  }

  onSettingDataChange(field)
}
const onCancelPicker = (field) => {
  showPickers[field] = false
}

const onVibrationSwitchChange = async () => {
  if (settingDataForm.h5Vibration) {
    const ok = settingStore.vibrate(30)
    if (!ok) {
      showToast({
        message: t('h5.pages.setting.form.h5VibrationUnsupported'),
        position: 'bottom',
        duration: 2800
      })
    }
  }
  await onSettingDataChange('h5Vibration')
}

const onSettingDataChange = async (field) => {
  let payload = {}
  if (field === 'h5Themes.primary' || field === 'h5Themes.dark') {
    payload = {
      h5Themes: {
        primary: settingDataForm.h5Themes.primary,
        dark: settingDataForm.h5Themes.dark
      }
    }
  } else if (field === 'h5Locale') {
    payload = {
      h5Locale: settingDataForm.h5Locale,
      isH5LocaleSet: true
    }
  } else {
    payload[field] = settingDataForm[field]
  }

  const res = await settingStore.h5UpdateSettingData(payload)
  showNotify({
    type: res.success ? 'success' : 'danger',
    message: res.success
      ? String(res.message ?? '').trim() || t('messages.operationSuccess')
      : resolveApiUserMessage(res, t)
  })
}

const onH5ImageCompressStartSizeUpdate = (value) => {
  const message = value + 'MB'
  showToast({
    message,
    position: 'top'
  })
}

const onLocalSettingChange = (field) => {
  const payload = {}
  payload[field] = localSettingForm[field]

  const success = settingStore.updateLocalSetting(payload)
  showNotify({
    type: success ? 'success' : 'danger',
    message: t(success ? 'messages.operationSuccess' : 'messages.operationFail')
  })
}

const onOpenLink = (url) => {
  window.open(url, '_blank')
}

onMounted(() => {
  init()
})
</script>

<template>
  <div class="page-wrapper page-setting">
    <van-nav-bar :title="t('h5.pages.setting.title')" fixed safe-area-inset-top />

    <div class="page-setting-inner">
      <van-collapse v-model="expandedSections" class="setting-collapse" :border="false">
        <van-collapse-item name="application" :title="t('h5.pages.setting.form.h5ApplicationSettings')">
          <van-cell-group inset :border="false">
        <van-field
          v-model="fieldsData.h5Locale"
          is-link
          readonly
          name="h5Locale"
          :label="t('h5.pages.setting.form.h5Locale.label')"
          :placeholder="t('h5.pages.setting.form.h5Locale.placeholder')"
          @click="onShowPicker('h5Locale')"
        />
        <van-popup v-model:show="showPickers.h5Locale" destroy-on-close position="bottom">
          <van-picker
            :columns="pickerColumns.h5Locale"
            :model-value="[settingDataForm.h5Locale]"
            @confirm="(...args) => onConfirmPicker('h5Locale', ...args)"
            @cancel="(...args) => onCancelPicker('h5Locale', ...args)"
          />
        </van-popup>

        <van-field
          v-model="settingDataForm.h5Themes.primary"
          name="h5Themes.primary"
          type="color"
          :label="t('h5.pages.setting.form.h5Themes.primary.label')"
          :placeholder="t('h5.pages.setting.form.h5Themes.primary.placeholder')"
          @update:model-value="onSettingDataChange('h5Themes.primary')"
        />

        <van-cell :title="t('h5.pages.setting.form.h5Themes.dark.label')">
          <template #right-icon>
            <van-switch
              v-model="settingDataForm.h5Themes.dark"
              size="20px"
              @change="onSettingDataChange('h5Themes.dark')"
            />
          </template>
        </van-cell>

        <van-cell :title="t('h5.pages.setting.localSetting.multiDeviceSync')">
          <template #right-icon>
            <van-switch
              v-model="localSettingForm.multiDeviceSync"
              size="20px"
              @change="onLocalSettingChange('multiDeviceSync')"
            />
          </template>
        </van-cell>
          </van-cell-group>
        </van-collapse-item>

        <van-collapse-item name="privacy" :title="t('pages.Setting.tabs.privacySpace')">
          <van-cell-group inset :border="false">
            <van-cell :title="t('pages.Setting.privacySpace.enableNsfwContentMask')">
              <template #label>
                <span class="setting-cell-hint">{{
                  t('pages.Setting.privacySpace.enableNsfwContentMaskHint')
                }}</span>
              </template>
              <template #right-icon>
                <van-switch
                  :model-value="!!settingDataForm.privacy.enableNsfwContentMask"
                  size="20px"
                  :disabled="nsfwMaskToggling"
                  @update:model-value="onNsfwMaskSwitchChange"
                />
              </template>
            </van-cell>
          </van-cell-group>
        </van-collapse-item>

        <van-collapse-item name="general" :title="t('h5.pages.setting.form.h5GeneralSettings')">
          <van-cell-group inset :border="false">
            <van-field
              v-model="fieldsData.h5FloatingButtonPosition"
              is-link
              readonly
              name="h5FloatingButtonPosition"
              :label="t('h5.pages.setting.form.h5FloatingButtonPosition.label')"
              :placeholder="t('h5.pages.setting.form.h5FloatingButtonPosition.placeholder')"
              @click="onShowPicker('h5FloatingButtonPosition')"
            />
            <van-popup
              v-model:show="showPickers.h5FloatingButtonPosition"
              destroy-on-close
              position="bottom"
            >
              <van-picker
                :columns="pickerColumns.h5FloatingButtonPosition"
                :model-value="[settingDataForm.h5FloatingButtonPosition]"
                @confirm="(...args) => onConfirmPicker('h5FloatingButtonPosition', ...args)"
                @cancel="(...args) => onCancelPicker('h5FloatingButtonPosition', ...args)"
              />
            </van-popup>

            <van-field
              is-link
              readonly
              name="h5EnabledFloatingButtons"
              :label="t('h5.pages.setting.form.h5EnabledFloatingButtons.label')"
              :placeholder="t('h5.pages.setting.form.h5EnabledFloatingButtons.placeholder')"
              @click="onShowPicker('h5EnabledFloatingButtons')"
            />
            <van-popup
              v-model:show="showPickers.h5EnabledFloatingButtons"
              destroy-on-close
              position="bottom"
            >
              <van-picker
                :columns="pickerColumns.h5EnabledFloatingButtons"
                @confirm="(...args) => onConfirmPicker('h5EnabledFloatingButtons', ...args)"
                @cancel="(...args) => onCancelPicker('h5EnabledFloatingButtons', ...args)"
              >
                <template #option="option">
                  <van-checkbox
                    v-model="floatingButtonsChecked[option.value]"
                    :name="option.value"
                    shape="square"
                  >
                    <div style="display: inline-block; min-width: 100px">{{ option.text }}</div>
                  </van-checkbox>
                </template>
              </van-picker>
            </van-popup>

            <van-cell
              :title="t('h5.pages.setting.form.h5FullscreenImageCompress')"
              :label="t('h5.pages.setting.form.h5FullscreenImageCompressHint')"
            >
              <template #right-icon>
                <van-switch
                  v-model="settingDataForm.h5FullscreenImageCompress"
                  size="20px"
                  @change="onSettingDataChange('h5FullscreenImageCompress')"
                />
              </template>
            </van-cell>

            <van-field
              name="h5ImageCompressStartSize"
              :label="t('h5.pages.setting.form.h5ImageCompressStartSize')"
            >
              <template #input>
                <van-slider
                  v-model="settingDataForm.h5ImageCompressStartSize"
                  min="1"
                  max="10"
                  @update:model-value="onH5ImageCompressStartSizeUpdate"
                  @change="onSettingDataChange('h5ImageCompressStartSize')"
                >
                  <template #button>
                    <div class="slider-button">{{ settingDataForm.h5ImageCompressStartSize }}MB</div>
                  </template>
                </van-slider>
              </template>
            </van-field>

            <van-field
              v-model="fieldsData.h5NumberIndicatorPosition"
              is-link
              readonly
              name="h5NumberIndicatorPosition"
              :label="t('h5.pages.setting.form.h5NumberIndicatorPosition.label')"
              :placeholder="t('h5.pages.setting.form.h5NumberIndicatorPosition.placeholder')"
              @click="onShowPicker('h5NumberIndicatorPosition')"
            />
            <van-popup
              v-model:show="showPickers.h5NumberIndicatorPosition"
              destroy-on-close
              position="bottom"
            >
              <van-picker
                :columns="pickerColumns.h5NumberIndicatorPosition"
                :model-value="[settingDataForm.h5NumberIndicatorPosition]"
                @confirm="(...args) => onConfirmPicker('h5NumberIndicatorPosition', ...args)"
                @cancel="(...args) => onCancelPicker('h5NumberIndicatorPosition', ...args)"
              />
            </van-popup>

            <van-cell :title="t('h5.pages.setting.form.h5Vibration')">
              <template #right-icon>
                <van-switch
                  v-model="settingDataForm.h5Vibration"
                  size="20px"
                  @change="onVibrationSwitchChange"
                />
              </template>
              <template v-if="!isVibrationSupported" #label>
                <span class="setting-vibration-hint">
                  {{ t('h5.pages.setting.form.h5VibrationUnsupported') }}
                </span>
              </template>
            </van-cell>

            <van-cell :title="t('h5.pages.setting.form.h5WeekScreen')">
              <template #right-icon>
                <van-switch
                  v-model="settingDataForm.h5WeekScreen"
                  size="20px"
                  @change="onSettingDataChange('h5WeekScreen')"
                />
              </template>
            </van-cell>
          </van-cell-group>
        </van-collapse-item>

        <van-collapse-item name="about" :title="t('h5.pages.setting.about')">
          <van-cell-group inset :border="false">
            <van-cell :title="t('h5.pages.setting.version')" :value="appInfo.version" />
            <van-cell
              :title="t('h5.pages.setting.sponsor')"
              is-link
              @click="onOpenLink(appInfo.afdian)"
            />
          </van-cell-group>
        </van-collapse-item>
      </van-collapse>
    </div>
    <H5PrivacyPasswordDialog ref="privacyPasswordDialogRef" />
  </div>
</template>

<style scoped lang="scss">
.page-setting {
  .page-setting-inner {
    width: 100%;
    max-width: none;
    box-sizing: border-box;
    padding-top: var(--van-nav-bar-height);
    padding-bottom: var(--fbw-tabbar-height);
  }
}

.setting-collapse {
  margin: 0 0 8px;

  :deep(.van-collapse-item__title) {
    font-weight: 600;
    font-size: 15px;
  }

  :deep(.van-collapse-item__content) {
    padding: 0;
    background: transparent;
  }

  :deep(.van-cell-group--inset) {
    margin: 0 0 12px;
  }
}

.interval-setting {
  width: 100%;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 10px;
}

.slider-button {
  width: 26px;
  color: #fff;
  font-size: 10px;
  line-height: 18px;
  text-align: center;
  background-color: var(--van-primary-color);
  border-radius: 100px;
}

:deep(.van-dropdown-menu__bar) {
  height: 24px;
  box-shadow: none;
}

:deep(.van-dropdown-menu__title) {
  font-size: 14px;
}

:deep(.van-radio-group) {
  display: flex;
  flex-wrap: wrap;
}

:deep(.van-radio) {
  margin-right: 12px;
}

.setting-vibration-hint {
  display: block;
  margin-top: 4px;
  font-size: 12px;
  line-height: 1.4;
  color: var(--van-text-color-3);
}
</style>
