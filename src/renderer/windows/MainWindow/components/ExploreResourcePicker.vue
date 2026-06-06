<script setup>
import { useTranslation } from 'i18next-vue'
import { resourceTypeIcons } from '@common/publicData.js'
import { scheduleDialogInputFocus } from '@common/focusDialogInput.mjs'
import {
  RESOURCE_PICKER_TAB_ALL,
  RESOURCE_PICKER_TAB_LOCAL,
  RESOURCE_PICKER_TAB_REMOTE,
  buildResourcePickerGroups
} from '@common/resourcePickerFilter.mjs'

const props = defineProps({
  modelValue: { type: Object, default: null },
  resourceGroupList: { type: Array, default: () => [] },
  loading: { type: Boolean, default: false },
  disabled: { type: Boolean, default: false },
  /** 筛选 Popover 内嵌，无触发器 */
  embedded: { type: Boolean, default: false },
  /** 顶栏触发器最小宽度（Popover 宽度同步） */
  minPopoverWidth: { type: Number, default: 260 },
  /** 内嵌模式（如筛选面板）列表最大高度 */
  embeddedMaxListHeight: { type: Number, default: 240 }
})

const emit = defineEmits(['update:modelValue', 'change'])

const { t } = useTranslation()

const pickerOpen = ref(false)
const pickerQuery = ref('')
const pickerTab = ref(RESOURCE_PICKER_TAB_ALL)
const pickerSearchRef = ref(null)
const pickerTriggerRef = ref(null)
const popoverWidth = ref(props.minPopoverWidth)

const resourceOptionLabel = (item) => t(item.locale) || item.value || ''

const pickerGroups = computed(() =>
  buildResourcePickerGroups(props.resourceGroupList, {
    query: pickerQuery.value,
    tab: pickerTab.value,
    getLabel: resourceOptionLabel,
    getGroupTitle: (group) => t(group.locale)
  })
)

const hasPickerFilter = computed(
  () => !!pickerQuery.value.trim() || pickerTab.value !== RESOURCE_PICKER_TAB_ALL
)

const selectedKey = computed(() => props.modelValue?.key ?? '')

const pickerDisabled = computed(
  () => props.disabled || props.loading || !props.resourceGroupList.length
)

const triggerIcon = computed(() => {
  const type = props.modelValue?.resourceType
  return type ? resourceTypeIcons[type] : 'custom:desktop'
})

const triggerLabel = computed(() => {
  if (!props.modelValue) {
    return props.loading
      ? t('messages.loading')
      : t('exploreCommon.searchForm.resourceName.placeholder')
  }
  for (const group of props.resourceGroupList) {
    const item = group.children?.find((c) => c.optionValue?.key === props.modelValue?.key)
    if (item) return resourceOptionLabel(item)
  }
  return props.modelValue.resourceName || t('exploreCommon.searchForm.resourceName.placeholder')
})

const resetPickerFilter = () => {
  pickerQuery.value = ''
  pickerTab.value = RESOURCE_PICKER_TAB_ALL
}

const syncPopoverWidth = () => {
  const w = pickerTriggerRef.value?.offsetWidth
  if (w > 0) {
    popoverWidth.value = Math.max(props.minPopoverWidth, Math.round(w))
  }
}

const onPickerShow = () => {
  resetPickerFilter()
  syncPopoverWidth()
  nextTick(() => scheduleDialogInputFocus(() => pickerSearchRef.value))
}

const selectResource = (item) => {
  const value = item?.optionValue
  if (!value) return
  pickerOpen.value = false
  emit('update:modelValue', { ...value })
  emit('change', { ...value })
}

const isItemActive = (item) => item?.optionValue?.key === selectedKey.value
</script>

<template>
  <div
    class="resource-picker"
    :class="{ 'resource-picker--embedded': embedded }"
  >
    <el-popover
      v-if="!embedded"
      v-model:visible="pickerOpen"
      trigger="click"
      placement="bottom-start"
      :width="popoverWidth"
      popper-class="resource-picker-popper"
      :disabled="pickerDisabled"
      @show="onPickerShow"
    >
      <template #reference>
        <button
          ref="pickerTriggerRef"
          type="button"
          class="resource-select-trigger"
          :disabled="pickerDisabled"
          :aria-label="t('exploreCommon.searchForm.resourceName.placeholder')"
        >
          <IconifyIcon :icon="triggerIcon" class="resource-select-trigger__icon" aria-hidden="true" />
          <span class="resource-select-trigger__name">{{ triggerLabel }}</span>
          <IconifyIcon
            icon="custom:arrow-right"
            class="resource-select-trigger__arrow"
            aria-hidden="true"
          />
        </button>
      </template>
      <div class="resource-picker-panel">
        <div class="resource-picker-panel__filter">
          <el-input
            ref="pickerSearchRef"
            v-model="pickerQuery"
            clearable
            :placeholder="t('exploreCommon.searchForm.resourceName.listSearchPlaceholder')"
          >
            <template #prefix>
              <IconifyIcon icon="custom:search" />
            </template>
          </el-input>
          <el-tabs v-model="pickerTab" class="resource-picker-panel__tabs">
            <el-tab-pane
              :label="t('exploreCommon.searchForm.resourceName.listTabAll')"
              :name="RESOURCE_PICKER_TAB_ALL"
            />
            <el-tab-pane
              :label="t('resourceTypeList.localResource')"
              :name="RESOURCE_PICKER_TAB_LOCAL"
            />
            <el-tab-pane
              :label="t('resourceTypeList.remoteResource')"
              :name="RESOURCE_PICKER_TAB_REMOTE"
            />
          </el-tabs>
        </div>
        <el-scrollbar :max-height="300" class="resource-picker-panel__list">
          <template v-if="pickerGroups.length">
            <div
              v-for="group in pickerGroups"
              :key="group.key"
              class="resource-picker-panel__group"
            >
              <div
                v-if="group.title && !group.hideTitle"
                class="resource-picker-panel__group-title"
              >
                {{ group.title }}
              </div>
              <button
                v-for="item in group.items"
                :key="item.optionValue.key"
                type="button"
                class="resource-picker-panel__item"
                :class="{ 'resource-picker-panel__item--active': isItemActive(item) }"
                @click="selectResource(item)"
              >
                <span class="resource-picker-panel__item-main">
                  <IconifyIcon :icon="group.icon" class="resource-picker-panel__item-icon" />
                  <span class="resource-picker-panel__item-name">{{
                    resourceOptionLabel(item)
                  }}</span>
                </span>
                <span
                  v-if="isItemActive(item)"
                  class="resource-picker-panel__item-check"
                  aria-hidden="true"
                >✓</span>
              </button>
            </div>
          </template>
          <div v-else class="resource-picker-panel__empty">
            {{
              hasPickerFilter
                ? t('exploreCommon.searchForm.resourceName.listNoMatch')
                : t('messages.noData')
            }}
          </div>
        </el-scrollbar>
      </div>
    </el-popover>

    <div v-else class="resource-picker-panel resource-picker-panel--embedded">
      <div class="resource-picker-panel__filter">
        <el-input
          v-model="pickerQuery"
          clearable
          :disabled="loading"
          :placeholder="t('exploreCommon.searchForm.resourceName.listSearchPlaceholder')"
        >
          <template #prefix>
            <IconifyIcon icon="custom:search" />
          </template>
        </el-input>
        <el-tabs v-model="pickerTab" class="resource-picker-panel__tabs">
          <el-tab-pane
            :label="t('exploreCommon.searchForm.resourceName.listTabAll')"
            :name="RESOURCE_PICKER_TAB_ALL"
          />
          <el-tab-pane
            :label="t('resourceTypeList.localResource')"
            :name="RESOURCE_PICKER_TAB_LOCAL"
          />
          <el-tab-pane
            :label="t('resourceTypeList.remoteResource')"
            :name="RESOURCE_PICKER_TAB_REMOTE"
          />
        </el-tabs>
      </div>
      <el-scrollbar
        :max-height="embeddedMaxListHeight"
        class="resource-picker-panel__list resource-picker-panel__list--embedded"
      >
        <template v-if="pickerGroups.length">
          <div v-for="group in pickerGroups" :key="group.key" class="resource-picker-panel__group">
            <div
              v-if="group.title && !group.hideTitle"
              class="resource-picker-panel__group-title"
            >
              {{ group.title }}
            </div>
            <button
              v-for="item in group.items"
              :key="item.optionValue.key"
              type="button"
              class="resource-picker-panel__item"
              :class="{ 'resource-picker-panel__item--active': isItemActive(item) }"
              @click="selectResource(item)"
            >
              <span class="resource-picker-panel__item-main">
                <IconifyIcon :icon="group.icon" class="resource-picker-panel__item-icon" />
                <span class="resource-picker-panel__item-name">{{ resourceOptionLabel(item) }}</span>
              </span>
              <span
                v-if="isItemActive(item)"
                class="resource-picker-panel__item-check"
                aria-hidden="true"
              >✓</span>
            </button>
          </div>
        </template>
        <div v-else class="resource-picker-panel__empty">
          {{
            hasPickerFilter
              ? t('exploreCommon.searchForm.resourceName.listNoMatch')
              : t('messages.noData')
          }}
        </div>
      </el-scrollbar>
    </div>
  </div>
</template>

<style scoped lang="scss">
.resource-picker {
  flex: 1;
  min-width: 0;
  width: 100%;

  &--embedded {
    flex: none;
    width: 100%;
  }
}

.resource-select-trigger {
  width: 100%;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 6px;
  height: 40px;
  padding: 0 16px;
  border: none;
  border-radius: 0;
  background: transparent;
  color: #fff;
  cursor: pointer;
  box-sizing: border-box;
  text-align: left;

  &:disabled {
    opacity: 0.55;
    cursor: not-allowed;
  }

  &__icon {
    flex-shrink: 0;
    width: 16px;
    height: 16px;
    font-size: 16px;
  }

  &__name {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 15px;
    font-weight: 600;
    line-height: 1.2;
  }

  &__arrow {
    flex-shrink: 0;
    width: 14px;
    height: 14px;
    font-size: 14px;
    color: rgba(255, 255, 255, 0.85);
    transform: rotate(90deg);
  }
}

.resource-picker-panel {
  display: flex;
  flex-direction: column;
  min-width: 0;

  &--embedded {
    width: 100%;
  }

  &__filter {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding-bottom: 10px;
  }

  &__tabs {
    width: 100%;

    :deep(.el-tabs__header) {
      margin: 0 0 8px;
    }

    :deep(.el-tabs__nav-wrap) {
      &::after {
        display: none;
      }
    }

    :deep(.el-tabs__nav-scroll) {
      justify-content: flex-start;
    }

    :deep(.el-tabs__nav) {
      justify-content: flex-start;
    }

    :deep(.el-tabs__item) {
      padding: 0 16px 0 0;
      height: 28px;
      line-height: 28px;
      font-size: 13px;

      &:last-child {
        padding-right: 0;
      }
    }

    :deep(.el-tabs__content) {
      display: none;
    }
  }

  &__list {
    min-height: 64px;
    padding-top: 4px;
  }

  &__group {
    margin-bottom: 6px;
  }

  &__group-title {
    padding: 10px 8px 4px;
    font-size: 12px;
    font-weight: 600;
    color: var(--el-text-color-secondary);
  }

  &__item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    width: 100%;
    min-width: 0;
    padding: 8px 12px;
    border: none;
    border-radius: 6px;
    background: transparent;
    color: var(--el-text-color-primary);
    cursor: pointer;
    text-align: left;
    box-sizing: border-box;

    &:hover {
      background: var(--el-fill-color-light);
    }

    &--active {
      background: var(--el-color-primary-light-9);
      color: var(--el-color-primary);

      .resource-picker-panel__item-icon {
        color: var(--el-color-primary);
      }
    }
  }

  &__item-main {
    flex: 1;
    min-width: 0;
    display: flex;
    align-items: center;
    gap: 8px;
  }

  &__item-icon {
    flex-shrink: 0;
    font-size: 16px;
    color: var(--el-text-color-secondary);
  }

  &__item-name {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 14px;
  }

  &__item-check {
    flex-shrink: 0;
    font-size: 14px;
    font-weight: 700;
    color: var(--el-color-primary);
  }

  &__empty {
    padding: 24px 12px;
    text-align: center;
    font-size: 13px;
    color: var(--el-text-color-secondary);
  }
}
</style>

<style lang="scss">
.resource-picker-popper.el-popover.el-popper {
  padding: 10px;
  box-sizing: border-box;

  .el-input__wrapper {
    border-radius: 6px;
  }
}
</style>
