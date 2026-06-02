<script setup>
import { ref } from 'vue'
import { showToast } from 'vant/es'
import { useTranslation } from 'i18next-vue'
import { scheduleDialogInputFocus } from '@common/focusDialogInput.mjs'
import * as api from '@h5/api/index.js'

const { t } = useTranslation()

const visible = ref(false)
const passwordFieldRef = ref(null)
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
    const res = await api.getPrivacyPasswordHint()
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
    showToast(t('messages.inputPrivacySpacePasswordErrorMessage'))
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

const onOpened = () => {
  scheduleDialogInputFocus(() => passwordFieldRef.value)
}

defineExpose({ open })
</script>

<template>
  <van-dialog
    v-model:show="visible"
    :title="t('messages.inputPrivacySpacePassword')"
    :show-confirm-button="false"
    :show-cancel-button="false"
    :close-on-click-overlay="false"
    @closed="onClosed"
  >
    <div class="privacy-password-body">
      <p v-if="passwordHint" class="privacy-password-hint">
        <span class="privacy-password-hint__label">{{ t('pages.Setting.privacyPasswordHintLabel') }}：</span>
        {{ passwordHint }}
      </p>
      <van-field
        ref="passwordFieldRef"
        :model-value="password"
        class="privacy-password-field"
        :type="showPassword ? 'text' : 'password'"
        maxlength="6"
        inputmode="numeric"
        autocomplete="off"
        :placeholder="t('messages.inputPrivacySpacePassword')"
        @update:model-value="onInput"
        @keyup.enter="onConfirm"
      >
        <template #right-icon>
          <van-icon
            :name="showPassword ? 'eye-o' : 'closed-eye'"
            class="privacy-password-toggle"
            @click="showPassword = !showPassword"
          />
        </template>
      </van-field>
    </div>
    <template #footer>
      <div class="privacy-password-footer">
        <van-button size="small" @click="onCancel">{{ t('pages.Collections.dialogCancel') }}</van-button>
        <van-button size="small" type="primary" @click="onConfirm">{{ t('messages.dialogOk') }}</van-button>
      </div>
    </template>
  </van-dialog>
</template>

<style scoped lang="scss">
.privacy-password-body {
  padding: 12px 16px 4px;
}

.privacy-password-hint {
  margin: 0 0 10px;
  padding: 8px 10px;
  font-size: 13px;
  line-height: 1.45;
  color: var(--van-text-color-2);
  background: var(--van-background-2);
  border-radius: 6px;
  word-break: break-word;

  &__label {
    font-weight: 600;
    color: var(--van-text-color);
  }
}

.privacy-password-toggle {
  font-size: 18px;
  color: var(--van-text-color-3);
  cursor: pointer;
}

.privacy-password-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding: 8px 16px 12px;
}
</style>
