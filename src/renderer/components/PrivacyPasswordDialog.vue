<script setup>
import { useTranslation } from 'i18next-vue'

const { t } = useTranslation()

const visible = ref(false)
const password = ref('')
const passwordHint = ref('')
const showPassword = ref(false)
let pendingResolve = null

const PATTERN = /^[0-9]{3,6}$/

const reset = () => {
  password.value = ''
  passwordHint.value = ''
  showPassword.value = false
}

const closeWith = (value) => {
  visible.value = false
  const resolve = pendingResolve
  pendingResolve = null
  resolve?.(value)
}

const open = async () => {
  reset()
  try {
    const res = await window.FBW.getPrivacyPasswordHint()
    if (res?.success && res.data?.hint) {
      passwordHint.value = res.data.hint
    }
  } catch {
    /* ignore */
  }
  visible.value = true
  return new Promise((resolve) => {
    pendingResolve = resolve
  })
}

const onInput = (val) => {
  password.value = String(val || '').replace(/[^\d]/g, '')
}

const onConfirm = () => {
  if (!PATTERN.test(password.value)) {
    ElMessage({
      type: 'warning',
      message: t('messages.inputPrivacySpacePasswordErrorMessage')
    })
    return
  }
  closeWith(password.value)
}

const onCancel = () => {
  closeWith(null)
}

const onClosed = () => {
  if (pendingResolve) {
    closeWith(null)
  } else {
    reset()
  }
}

defineExpose({ open })
</script>

<template>
  <el-dialog
    v-model="visible"
    :title="t('messages.inputPrivacySpacePassword')"
    width="420px"
    draggable
    destroy-on-close
    :close-on-click-modal="false"
    @closed="onClosed"
  >
    <p v-if="passwordHint" class="privacy-password-hint">
      <span class="privacy-password-hint__label">{{ t('pages.Setting.privacyPasswordHintLabel') }}：</span>
      {{ passwordHint }}
    </p>
    <el-input
      :model-value="password"
      :type="showPassword ? 'text' : 'password'"
      minlength="3"
      maxlength="6"
      autofocus
      inputmode="numeric"
      autocomplete="off"
      @update:model-value="onInput"
      @keyup.enter="onConfirm"
    >
      <template #suffix>
        <IconifyIcon
          :icon="showPassword ? 'custom:view' : 'custom:hide'"
          class="privacy-password-toggle"
          @click="showPassword = !showPassword"
        />
      </template>
    </el-input>
    <template #footer>
      <el-button @click="onCancel">{{ t('pages.Collections.dialogCancel') }}</el-button>
      <el-button type="primary" @click="onConfirm">{{ t('messages.dialogOk') }}</el-button>
    </template>
  </el-dialog>
</template>

<style scoped lang="scss">
.privacy-password-hint {
  margin: 0 0 12px;
  padding: 8px 10px;
  font-size: 13px;
  line-height: 1.5;
  color: var(--el-text-color-regular);
  background: var(--el-fill-color-light);
  border-radius: 6px;
  word-break: break-word;

  &__label {
    font-weight: 600;
    color: var(--el-text-color-primary);
  }
}

.privacy-password-toggle {
  cursor: pointer;
  font-size: 16px;
  color: var(--el-text-color-secondary);

  &:hover {
    color: var(--el-text-color-primary);
  }
}
</style>
