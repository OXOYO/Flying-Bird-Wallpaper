import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import {
  isNsfwMaskFeatureActive,
  shouldApplyNsfwMask
} from '../privacyNsfwMask.js'
import {
  isNsfwPageUnlocked,
  unlockNsfwPage,
  lockNsfwPage as lockNsfwPageSession,
  lockAllNsfwPages
} from '../privacyNsfwUnlockSession.mjs'

/**
 * 隐私空间设置：NSFW 内容隐藏（页内解锁，切页/切后台后恢复；已进入隐私空间时不隐藏）
 * @param {{
 *   settingData: import('vue').Ref|import('vue').ComputedRef,
 *   pageKey?: string,
 *   inPrivacySpace?: import('vue').Ref|import('vue').ComputedRef|boolean|(() => boolean),
 *   hasPrivacyPassword: () => Promise<{ success?: boolean, data?: boolean }>,
 *   openPasswordDialog: () => Promise<string|null>,
 *   checkPrivacyPassword: (pwd: string) => Promise<{ success?: boolean, message?: string }>,
 *   onVerifyFail?: (res: object) => void,
 *   onUnlockSuccess?: () => void
 * }} ctx
 */
export function usePrivacyNsfwMask(ctx) {
  const pageKey = ctx.pageKey || ''
  const pageUnlockedLocal = ref(false)
  const unlockVersion = ref(0)
  const hasPassword = ref(false)

  const isPageUnlocked = () => {
    void unlockVersion.value
    if (pageKey) return isNsfwPageUnlocked(pageKey)
    return pageUnlockedLocal.value
  }

  const setPageUnlocked = (value) => {
    if (pageKey) {
      if (value) unlockNsfwPage(pageKey)
      else lockNsfwPageSession(pageKey)
    } else {
      pageUnlockedLocal.value = value
    }
    unlockVersion.value += 1
  }

  const resolveSetting = () => {
    const raw = ctx.settingData
    return raw?.value != null ? raw.value : raw
  }

  const resolveInPrivacySpace = () => {
    const raw = ctx.inPrivacySpace
    if (raw == null) return false
    if (typeof raw === 'function') return !!raw()
    return !!(raw?.value != null ? raw.value : raw)
  }

  const featureActive = computed(() =>
    isNsfwMaskFeatureActive(resolveSetting(), hasPassword.value)
  )

  /** 供模板顶层绑定，确保 setting / 密码状态变化时重新渲染 */
  const shouldMaskItem = computed(() => {
    const fa = featureActive.value
    void unlockVersion.value
    const ips = resolveInPrivacySpace()
    const pu = isPageUnlocked()
    return (item) =>
      shouldApplyNsfwMask(item, {
        featureActive: fa,
        pageUnlocked: pu,
        inPrivacySpace: ips
      })
  })

  const lockPage = () => {
    setPageUnlocked(false)
  }

  const refreshHasPassword = async () => {
    try {
      const res = await ctx.hasPrivacyPassword?.()
      hasPassword.value = !!(res?.success && res?.data)
    } catch {
      hasPassword.value = false
    }
  }

  const onVisibilityChange = () => {
    if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
      lockAllNsfwPages()
      pageUnlockedLocal.value = false
      unlockVersion.value += 1
    }
  }

  onMounted(() => {
    void refreshHasPassword()
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', onVisibilityChange)
    }
  })

  onBeforeUnmount(() => {
    if (typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }
  })

  const unlockWithPassword = async () => {
    if (!featureActive.value) return true
    if (isPageUnlocked()) return true
    if (!hasPassword.value) {
      ctx.onVerifyFail?.({ errorCode: 'PRIVACY_PASSWORD_NOT_SET' })
      return false
    }

    const pwd = await ctx.openPasswordDialog?.()
    if (!pwd) return false

    const res = await ctx.checkPrivacyPassword?.(pwd)
    if (res?.success) {
      setPageUnlocked(true)
      ctx.onUnlockSuccess?.()
      return true
    }
    ctx.onVerifyFail?.(res)
    return false
  }

  const onMaskClick = async (event) => {
    event?.stopPropagation?.()
    event?.preventDefault?.()
    return unlockWithPassword()
  }

  const isActionBlocked = (item) => shouldMaskItem.value(item)

  return {
    pageUnlocked: computed(() => isPageUnlocked()),
    featureActive,
    hasPassword,
    shouldMaskItem,
    lockPage,
    refreshHasPassword,
    unlockWithPassword,
    onMaskClick,
    isActionBlocked
  }
}
