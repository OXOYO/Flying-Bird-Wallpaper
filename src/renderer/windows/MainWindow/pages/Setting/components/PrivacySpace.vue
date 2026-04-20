<script setup>
import { useTranslation } from 'i18next-vue'

const { t } = useTranslation()

const privacyPasswordFormRef = ref(null)
const privacyPasswordForm = reactive({
  old: '',
  new: ''
})

const privacyPasswordView = reactive({
  new: false,
  old: false
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
      const res = await window.FBW.updatePrivacyPassword(toRaw(privacyPasswordForm))
      let options = {
        type: 'success',
        message: t('messages.operationSuccess')
      }
      if (res && res.success) {
        options.type = 'success'
        options.message = res.message
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

defineExpose({
  resetForm: () => {
    const formEl = privacyPasswordFormRef.value
    if (formEl) {
      formEl.resetFields()
    }
  }
})
</script>

<template>
  <div class="privacy-space-wrapper">
    <el-scrollbar style="height: 100%">
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
</template>

<style scoped lang="scss">
.privacy-space-wrapper {
  height: calc(100vh - 110px);
  position: relative;
}
</style>
