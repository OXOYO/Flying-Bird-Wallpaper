<script setup>
import {
  intervalUnits,
  qualityList,
  orientationOptions,
  switchTypeOptions,
  sortFieldOptions,
  sortTypeOptions,
  imageDisplaySizeOptions,
  h5FloatingButtonPositionOptions,
  h5FloatingButtonsOptions
} from '@common/publicData.js'
import { localeOptions } from '@i18n/locale/index.js'
import { appInfo } from '@common/config.js'
import UseCommonStore from '@h5/stores/commonStore.js'
import UseSettingStore from '@h5/stores/settingStore.js'
import { showNotify } from 'vant'
import { useTranslation } from 'i18next-vue'

const { t } = useTranslation()

const commonStore = UseCommonStore()
const settingStore = UseSettingStore()
const { settingData } = storeToRefs(settingStore)

const settingDataForm = reactive(settingData.value)

const showPickers = reactive({
  locale: false,
  h5SwitchType: false,
  h5Resource: false,
  h5Orientation: false,
  h5Quality: false,
  h5SortField: false,
  h5SortType: false,
  h5ImageDisplaySize: false,
  h5FloatingButtonPosition: false,
  h5EnabledFloatingButtons: false
})

// 选中的浮动按钮
const floatingButtonsChecked = reactive({})

const optionsToColumns = (options) => {
  return options.map((option) => ({
    value: option.value,
    text: option.locale ? t(option.locale) : option.label
  }))
}

const listToColumns = (list) => {
  return list.map((value) => ({
    value,
    text: value
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

const resourceMap = computed(() => {
  return commonStore.resourceMap
})

const pickerColumns = computed(() => {
  return {
    locale: optionsToColumns(localeOptions),
    h5SwitchType: optionsToColumns(switchTypeOptions),
    h5SwitchIntervalUnit: optionsToColumns(intervalUnits.h5SwitchIntervalUnit),
    h5Resource: optionsToColumns(toRaw(resourceMap.value.wallpaperResourceList)),
    h5Orientation: addEmptyOption(optionsToColumns(orientationOptions)),
    h5Quality: addEmptyOption(listToColumns(qualityList)),
    h5SortField: optionsToColumns(sortFieldOptions),
    h5SortType: optionsToColumns(sortTypeOptions),
    h5ImageDisplaySize: optionsToColumns(imageDisplaySizeOptions),
    h5FloatingButtonPosition: optionsToColumns(h5FloatingButtonPositionOptions),
    h5EnabledFloatingButtons: optionsToColumns(h5FloatingButtonsOptions)
  }
})

const fieldsData = computed(() => {
  let ret = {
    locale: '',
    h5SwitchType: '',
    h5Resource: '',
    h5Orientation: '',
    h5Quality: '',
    h5SortField: '',
    h5SortType: '',
    h5ImageDisplaySize: '',
    h5FloatingButtonPosition: ''
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
    case 'locale':
    case 'h5SwitchType':
    case 'h5SwitchIntervalUnit':
    case 'h5Resource':
    case 'h5Orientation':
    case 'h5Quality':
    case 'h5SortField':
    case 'h5SortType':
    case 'h5ImageDisplaySize':
    case 'h5FloatingButtonPosition':
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

const onSettingDataChange = async (field) => {
  let payload = {}
  if (field === 'themes.primary') {
    payload = {
      themes: {
        primary: settingDataForm.themes.primary
      }
    }
  } else {
    payload[field] = settingDataForm[field]
  }

  const res = await settingStore.h5UpdateSettingData(payload)
  showNotify({
    type: res.success ? 'success' : 'danger',
    message: res.msg
  })
}

onMounted(() => {
  init()
})
</script>

<template>
  <div class="setting-container">
    <van-nav-bar :title="t('h5.pages.setting.title')" left-arrow @click-left="goBack" />

    <van-cell-group inset :title="t('h5.pages.setting.form.appSettings')">
      <van-field
        v-model="fieldsData.locale"
        is-link
        readonly
        name="locale"
        :label="t('h5.pages.setting.form.locale.label')"
        :placeholder="t('h5.pages.setting.form.locale.placeholder')"
        @click="onShowPicker('locale')"
      />
      <van-popup v-model:show="showPickers.locale" destroy-on-close position="bottom">
        <van-picker
          :columns="pickerColumns.locale"
          :model-value="[settingDataForm.locale]"
          @confirm="(...args) => onConfirmPicker('locale', ...args)"
          @cancel="(...args) => onCancelPicker('locale', ...args)"
        />
      </van-popup>

      <van-field
        v-model="settingDataForm.themes.primary"
        name="themes.primary"
        type="color"
        :label="t('h5.pages.setting.form.themes.primary.label')"
        :placeholder="t('h5.pages.setting.form.themes.primary.placeholder')"
        @update:model-value="onSettingDataChange('themes.primary')"
      />
    </van-cell-group>

    <van-cell-group inset :title="t('h5.pages.setting.form.switchSettings')">
      <van-cell :title="t('h5.pages.setting.form.h5AutoSwitch')">
        <template #right-icon>
          <van-switch
            v-model="settingDataForm.h5AutoSwitch"
            size="20px"
            @change="onSettingDataChange('h5AutoSwitch')"
          />
        </template>
      </van-cell>

      <van-field
        v-model="fieldsData.h5SwitchType"
        is-link
        readonly
        name="h5SwitchType"
        :label="t('h5.pages.setting.form.h5SwitchType.label')"
        :placeholder="t('h5.pages.setting.form.h5SwitchType.placeholder')"
        @click="onShowPicker('h5SwitchType')"
      />
      <van-popup v-model:show="showPickers.h5SwitchType" destroy-on-close position="bottom">
        <van-picker
          :columns="pickerColumns.h5SwitchType"
          :model-value="[settingDataForm.h5SwitchType]"
          @confirm="(...args) => onConfirmPicker('h5SwitchType', ...args)"
          @cancel="(...args) => onCancelPicker('h5SwitchType', ...args)"
        />
      </van-popup>

      <van-field
        name="h5SwitchIntervalTime"
        :label="t('h5.pages.setting.form.h5SwitchIntervalTime')"
      >
        <template #input>
          <div class="interval-setting">
            <van-slider
              v-model="settingDataForm.h5SwitchIntervalTime"
              min="2"
              max="60"
              @change="onSettingDataChange('h5SwitchIntervalTime')"
            >
              <template #button>
                <div class="slider-button">{{ settingDataForm.h5SwitchIntervalTime }}</div>
              </template>
            </van-slider>
            <van-dropdown-menu style="width: 100px">
              <van-dropdown-item
                v-model="settingDataForm.h5SwitchIntervalUnit"
                :options="pickerColumns.h5SwitchIntervalUnit"
                @change="onSettingDataChange('h5SwitchIntervalUnit')"
              />
            </van-dropdown-menu>
          </div>
        </template>
      </van-field>
    </van-cell-group>

    <van-cell-group inset :title="t('h5.pages.setting.form.resourcesSettings')">
      <van-field
        v-model="fieldsData.h5Resource"
        is-link
        readonly
        name="h5Resource"
        :label="t('h5.pages.setting.form.h5Resource.label')"
        :placeholder="t('h5.pages.setting.form.h5Resource.placeholder')"
        @click="onShowPicker('h5Resource')"
      />
      <van-popup v-model:show="showPickers.h5Resource" destroy-on-close position="bottom">
        <van-picker
          :columns="pickerColumns.h5Resource"
          :model-value="[settingDataForm.h5Resource]"
          @confirm="(...args) => onConfirmPicker('h5Resource', ...args)"
          @cancel="(...args) => onCancelPicker('h5Resource', ...args)"
        />
      </van-popup>

      <van-field
        v-model="fieldsData.h5Orientation"
        is-link
        readonly
        name="h5Orientation"
        :label="t('h5.pages.setting.form.h5Orientation.label')"
        :placeholder="t('h5.pages.setting.form.h5Orientation.placeholder')"
        @click="onShowPicker('h5Orientation')"
      />
      <van-popup v-model:show="showPickers.h5Orientation" destroy-on-close position="bottom">
        <van-picker
          :columns="pickerColumns.h5Orientation"
          :model-value="[settingDataForm.h5Orientation]"
          @confirm="(...args) => onConfirmPicker('h5Orientation', ...args)"
          @cancel="(...args) => onCancelPicker('h5Orientation', ...args)"
        />
      </van-popup>

      <van-field
        v-model="fieldsData.h5Quality"
        is-link
        readonly
        name="h5Quality"
        :label="t('h5.pages.setting.form.h5Quality.label')"
        :placeholder="t('h5.pages.setting.form.h5Quality.placeholder')"
        @click="onShowPicker('h5Quality')"
      />
      <van-popup v-model:show="showPickers.h5Quality" destroy-on-close position="bottom">
        <van-picker
          :columns="pickerColumns.h5Quality"
          :model-value="[settingDataForm.h5Quality]"
          @confirm="(...args) => onConfirmPicker('h5Quality', ...args)"
          @cancel="(...args) => onCancelPicker('h5Quality', ...args)"
        />
      </van-popup>

      <van-field
        v-model="fieldsData.h5SortField"
        is-link
        readonly
        name="h5SortField"
        :label="t('h5.pages.setting.form.h5SortField.label')"
        :placeholder="t('h5.pages.setting.form.h5SortField.placeholder')"
        @click="onShowPicker('h5SortField')"
      />
      <van-popup v-model:show="showPickers.h5SortField" destroy-on-close position="bottom">
        <van-picker
          :columns="pickerColumns.h5SortField"
          :model-value="[settingDataForm.h5SortField]"
          @confirm="(...args) => onConfirmPicker('h5SortField', ...args)"
          @cancel="(...args) => onCancelPicker('h5SortField', ...args)"
        />
      </van-popup>

      <van-field
        v-model="fieldsData.h5SortType"
        is-link
        readonly
        name="h5SortType"
        :label="t('h5.pages.setting.form.h5SortType.label')"
        :placeholder="t('h5.pages.setting.form.h5SortType.placeholder')"
        @click="onShowPicker('h5SortType')"
      />
      <van-popup v-model:show="showPickers.h5SortType" destroy-on-close position="bottom">
        <van-picker
          :columns="pickerColumns.h5SortType"
          :model-value="[settingDataForm.h5SortType]"
          @confirm="(...args) => onConfirmPicker('h5SortType', ...args)"
          @cancel="(...args) => onCancelPicker('h5SortType', ...args)"
        />
      </van-popup>
    </van-cell-group>

    <van-cell-group inset :title="t('h5.pages.setting.form.displaySettings')">
      <van-field
        v-model="fieldsData.h5ImageDisplaySize"
        is-link
        readonly
        name="h5ImageDisplaySize"
        :label="t('h5.pages.setting.form.h5ImageDisplaySize.label')"
        :placeholder="t('h5.pages.setting.form.h5ImageDisplaySize.placeholder')"
        @click="onShowPicker('h5ImageDisplaySize')"
      />
      <van-popup v-model:show="showPickers.h5ImageDisplaySize" destroy-on-close position="bottom">
        <van-picker
          :columns="pickerColumns.h5ImageDisplaySize"
          :model-value="[settingDataForm.h5ImageDisplaySize]"
          @confirm="(...args) => onConfirmPicker('h5ImageDisplaySize', ...args)"
          @cancel="(...args) => onCancelPicker('h5ImageDisplaySize', ...args)"
        />
      </van-popup>

      <van-cell :title="t('h5.pages.setting.form.h5ImageCompress')">
        <template #right-icon>
          <van-switch
            v-model="settingDataForm.h5ImageCompress"
            size="20px"
            @change="onSettingDataChange('h5ImageCompress')"
          />
        </template>
      </van-cell>
    </van-cell-group>

    <van-cell-group inset :title="t('h5.pages.setting.form.actionSettings')">
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
    </van-cell-group>

    <van-cell-group inset :title="t('h5.pages.setting.about')">
      <van-cell :title="t('h5.pages.setting.version')" :value="appInfo.version" />
    </van-cell-group>
  </div>
</template>

<style scoped>
.setting-container {
  padding-bottom: 20px;
}

.van-cell-group {
  margin: 12px 0;
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
</style>
