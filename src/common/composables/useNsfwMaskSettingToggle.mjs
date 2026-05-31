import { ref } from 'vue'

/**
 * 「敏感内容隐藏」：开启前须已设置隐私密码；关闭前须验证隐私密码。
 * @param {{
 *   t: (key: string, opts?: object) => string,
 *   getEnabled: () => boolean,
 *   setEnabled: (v: boolean) => void,
 *   hasPrivacyPassword: () => Promise<{ success?: boolean, data?: boolean }>,
 *   openPasswordDialog: () => Promise<string|null>,
 *   checkPrivacyPassword: (pwd: string) => Promise<{ success?: boolean, message?: string }>,
 *   persistEnabled: (enabled: boolean) => Promise<boolean>,
 *   onNotify?: (payload: { type: 'warn'|'error'|'success', message: string }) => void
 * }} ctx
 */
export function useNsfwMaskSettingToggle(ctx) {
  const toggling = ref(false)

  const onToggle = async (nextEnabled) => {
    if (toggling.value) return

    const next = !!nextEnabled
    const wasOn = !!ctx.getEnabled()
    if (next === wasOn) return

    if (next) {
      const hasRes = await ctx.hasPrivacyPassword()
      if (!hasRes?.success || !hasRes?.data) {
        ctx.onNotify?.({
          type: 'warn',
          message: ctx.t('messages.privacyPasswordNotSet')
        })
        return
      }

      ctx.setEnabled(true)
      toggling.value = true
      try {
        await ctx.persistEnabled(true)
      } finally {
        toggling.value = false
      }
      return
    }

    toggling.value = true
    ctx.setEnabled(true)

    try {
      const hasRes = await ctx.hasPrivacyPassword()
      if (!hasRes?.success || !hasRes?.data) {
        ctx.onNotify?.({
          type: 'warn',
          message: ctx.t('messages.privacyPasswordNotSet')
        })
        return
      }

      const pwd = await ctx.openPasswordDialog()
      if (!pwd) return

      const checkRes = await ctx.checkPrivacyPassword(pwd)
      if (!checkRes?.success) {
        ctx.onNotify?.({
          type: 'error',
          message: checkRes?.message || ctx.t('messages.verifyPrivacyPasswordFail')
        })
        return
      }

      ctx.setEnabled(false)
      await ctx.persistEnabled(false)
    } finally {
      toggling.value = false
    }
  }

  return { toggling, onToggle }
}
