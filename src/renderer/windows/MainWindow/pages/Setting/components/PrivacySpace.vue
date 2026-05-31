<script setup>
import { useTranslation } from 'i18next-vue'
import { storeToRefs } from 'pinia'
import UseSettingStore from '@renderer/stores/settingStore.js'
import PrivacyPasswordDialog from '@renderer/components/PrivacyPasswordDialog.vue'
import { useNsfwMaskSettingToggle } from '@common/composables/useNsfwMaskSettingToggle.mjs'

const { t } = useTranslation()
const settingStore = UseSettingStore()
const { settingData } = storeToRefs(settingStore)

const privacyPasswordFormRef = ref(null)
const privacyPasswordForm = reactive({
  old: '',
  new: '',
  hint: ''
})

const privacyPasswordView = reactive({
  new: false,
  old: false
})

const privacyForm = reactive({
  enableNsfwContentMask: !!settingData.value?.privacy?.enableNsfwContentMask
})

const flags = reactive({ saving: false })
const privacyPasswordDialogRef = ref(null)

const { toggling: nsfwMaskToggling, onToggle: onNsfwMaskSwitchChange } = useNsfwMaskSettingToggle({
  t,
  getEnabled: () => privacyForm.enableNsfwContentMask,
  setEnabled: (v) => {
    privacyForm.enableNsfwContentMask = v
  },
  hasPrivacyPassword: () => window.FBW.hasPrivacyPassword(),
  openPasswordDialog: () => privacyPasswordDialogRef.value?.open(),
  checkPrivacyPassword: (pwd) => window.FBW.checkPrivacyPassword(pwd),
  persistEnabled: async (enabled) => {
    if (flags.saving) return false
    flags.saving = true
    try {
      const res = await window.FBW.updateSettingData({
        privacy: { enableNsfwContentMask: enabled }
      })
      if (res?.success) {
        settingStore.updateSettingData(res.data)
        ElMessage({
          type: 'success',
          message: t('messages.operationSuccess')
        })
        return true
      }
      syncPrivacyFormFromStore()
      ElMessage({
        type: 'error',
        message: res?.message || t('messages.operationFail')
      })
      return false
    } catch {
      syncPrivacyFormFromStore()
      ElMessage({
        type: 'error',
        message: t('messages.operationFail')
      })
      return false
    } finally {
      flags.saving = false
    }
  },
  onNotify: ({ type, message }) => {
    ElMessage({
      type: type === 'warn' ? 'warning' : type,
      message
    })
  }
})

watch(
  () => settingData.value?.privacy?.enableNsfwContentMask,
  (v) => {
    privacyForm.enableNsfwContentMask = !!v
  }
)

const syncPrivacyFormFromStore = () => {
  privacyForm.enableNsfwContentMask = !!settingData.value?.privacy?.enableNsfwContentMask
}

const loadPrivacyPasswordHint = async () => {
  try {
    const res = await window.FBW.getPrivacyPasswordHint()
    if (res?.success && res.data?.hint) {
      privacyPasswordForm.hint = res.data.hint
    }
  } catch {
    /* ignore */
  }
}

onMounted(() => {
  void loadPrivacyPasswordHint()
})

const handlePasswordInput = (field, val) => {
  privacyPasswordForm[field] = val.replace(/[^\d]/g, '')
}

const togglePasswordView = (field) => {
  privacyPasswordView[field] = !privacyPasswordView[field]
}

const onPrivacyPasswordFormConfirm = (formEl) => {
  if (!formEl) return
  formEl.validate(async (valid) => {
    if (valid) {
      const res = await window.FBW.updatePrivacyPassword({
        old: privacyPasswordForm.old,
        new: privacyPasswordForm.new,
        hint: privacyPasswordForm.hint
      })
      let options = {
        type: 'success',
        message: t('messages.operationSuccess')
      }
      if (res && res.success) {
        options.type = 'success'
        options.message = res.message
        privacyPasswordForm.old = ''
        privacyPasswordForm.new = ''
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

defineExpose({
  resetForm: () => {
    const formEl = privacyPasswordFormRef.value
    if (formEl) {
      formEl.resetFields()
    }
    syncPrivacyFormFromStore()
    void loadPrivacyPasswordHint()
  }
})
</script>

<template>
  <div class="privacy-space-wrapper">
    <el-scrollbar style="height: 100%">
      <el-form
        ref="privacyPasswordFormRef"
        :model="privacyPasswordForm"
        label-width="auto"
        label-position="right"
        class="ai-setting-form"
      >
        <div class="form-card">
          <div class="divider">{{ t('pages.Setting.divider.privacySpaceOptions') }}</div>
          <el-form-item class="ai-form-item-labeled">
            <template #label>
              <span class="form-item-label-with-tip">
                <span class="form-item-label-with-tip__text">{{
                  t('pages.Setting.privacySpace.enableNsfwContentMask')
                }}</span>
                <el-tooltip
                  :content="t('pages.Setting.privacySpace.enableNsfwContentMaskHint')"
                  placement="top"
                  :show-after="300"
                  popper-class="ai-setting-feature-tip"
                >
                  <span
                    class="form-item-tip-trigger"
                    tabindex="0"
                    role="button"
                    :aria-label="t('pages.Setting.privacySpace.enableNsfwContentMaskHint')"
                    @click.stop
                  >
                    <IconifyIcon icon="custom:info-outline-rounded" />
                  </span>
                </el-tooltip>
              </span>
            </template>
            <el-switch
              :model-value="privacyForm.enableNsfwContentMask"
              :disabled="flags.saving || nsfwMaskToggling"
              @change="onNsfwMaskSwitchChange"
            />
          </el-form-item>
        </div>
        <div class="form-card">
          <div class="divider">{{ t('pages.Setting.divider.privacyPassword') }}</div>
          <el-form-item prop="old" class="ai-form-item-labeled">
            <template #label>
              <span class="form-item-label-with-tip">
                <span class="form-item-label-with-tip__text">{{
                  t('pages.Setting.privacyPasswordForm.old.label')
                }}</span>
                <el-tooltip
                  :content="t('pages.Setting.privacyPasswordForm.old.tooltip')"
                  placement="top"
                  :show-after="300"
                  popper-class="ai-setting-feature-tip"
                >
                  <span
                    class="form-item-tip-trigger"
                    tabindex="0"
                    role="button"
                    :aria-label="t('pages.Setting.privacyPasswordForm.old.tooltip')"
                    @click.stop
                  >
                    <IconifyIcon icon="custom:info-outline-rounded" />
                  </span>
                </el-tooltip>
              </span>
            </template>
            <el-input
              v-model="privacyPasswordForm.old"
              :type="privacyPasswordView.old ? 'text' : 'password'"
              minlength="3"
              maxlength="6"
              :placeholder="t('pages.Setting.privacyPasswordForm.old.placeholder')"
              style="width: 290px"
              @input="(val) => handlePasswordInput('old', val)"
            >
              <template #suffix>
                <IconifyIcon
                  :icon="privacyPasswordView.old ? 'custom:view' : 'custom:hide'"
                  style="cursor: pointer"
                  @click.prevent="togglePasswordView('old')"
                />
              </template>
            </el-input>
          </el-form-item>
          <el-form-item prop="new" class="ai-form-item-labeled">
            <template #label>
              <span class="form-item-label-with-tip">
                <span class="form-item-label-with-tip__text">{{
                  t('pages.Setting.privacyPasswordForm.new.label')
                }}</span>
                <el-tooltip
                  :content="t('pages.Setting.privacyPasswordForm.new.tooltip')"
                  placement="top"
                  :show-after="300"
                  popper-class="ai-setting-feature-tip"
                >
                  <span
                    class="form-item-tip-trigger"
                    tabindex="0"
                    role="button"
                    :aria-label="t('pages.Setting.privacyPasswordForm.new.tooltip')"
                    @click.stop
                  >
                    <IconifyIcon icon="custom:info-outline-rounded" />
                  </span>
                </el-tooltip>
              </span>
            </template>
            <el-input
              v-model="privacyPasswordForm.new"
              :type="privacyPasswordView.new ? 'text' : 'password'"
              minlength="3"
              maxlength="6"
              :placeholder="t('pages.Setting.privacyPasswordForm.new.placeholder')"
              style="width: 290px"
              @input="(val) => handlePasswordInput('new', val)"
            >
              <template #suffix>
                <IconifyIcon
                  :icon="privacyPasswordView.new ? 'custom:view' : 'custom:hide'"
                  style="cursor: pointer"
                  @click.prevent="togglePasswordView('new')"
                />
              </template>
            </el-input>
          </el-form-item>
          <el-form-item prop="hint" class="ai-form-item-labeled ai-form-item-labeled--top">
            <template #label>
              <span class="form-item-label-with-tip">
                <span class="form-item-label-with-tip__text">{{
                  t('pages.Setting.privacyPasswordForm.hint.label')
                }}</span>
                <el-tooltip
                  :content="t('pages.Setting.privacyPasswordForm.hint.tooltip')"
                  placement="top"
                  :show-after="300"
                  popper-class="ai-setting-feature-tip"
                >
                  <span
                    class="form-item-tip-trigger"
                    tabindex="0"
                    role="button"
                    :aria-label="t('pages.Setting.privacyPasswordForm.hint.tooltip')"
                    @click.stop
                  >
                    <IconifyIcon icon="custom:info-outline-rounded" />
                  </span>
                </el-tooltip>
              </span>
            </template>
            <el-input
              v-model="privacyPasswordForm.hint"
              type="textarea"
              :rows="2"
              maxlength="64"
              show-word-limit
              :placeholder="t('pages.Setting.privacyPasswordForm.hint.placeholder')"
              style="width: 290px"
            />
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
    <PrivacyPasswordDialog ref="privacyPasswordDialogRef" />
  </div>
</template>

<style scoped lang="scss">
.privacy-space-wrapper {
  height: calc(100vh - 110px);
  position: relative;
}
</style>
