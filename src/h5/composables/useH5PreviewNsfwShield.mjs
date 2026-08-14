import { watch, onBeforeUnmount, unref } from 'vue'

const TAP_MOVE_THRESHOLD = 10
const TAP_DEBOUNCE_MS = 320

/**
 * 预览敏感遮罩：视觉层不拦截手势，捕获阶段区分 tap / swipe 后打开密码窗
 * 兼容 van-image-preview 与 h5-single-image-preview
 */
export function useH5PreviewNsfwShield(ctx) {
  let lastMaskTapAt = 0
  let tapStartX = 0
  let tapStartY = 0
  let tapMoved = false
  let listening = false

  const resolveShowPreview = () => !!unref(ctx.showPreview)
  const resolveShowsMask = () => !!unref(ctx.showsMask)

  const isPreviewChrome = (el) =>
    !!(
      el?.closest?.('.van-image-preview__close-icon') ||
      el?.closest?.('.van-image-preview__index') ||
      el?.closest?.('.van-image-preview__indicators') ||
      el?.closest?.('.h5-single-image-preview__close')
    )

  const isPreviewContent = (el) =>
    el instanceof Element &&
    !!(el.closest('.van-image-preview') || el.closest('.h5-single-image-preview')) &&
    !isPreviewChrome(el)

  const triggerMaskClick = (event) => {
    const now = Date.now()
    if (now - lastMaskTapAt < TAP_DEBOUNCE_MS) return
    lastMaskTapAt = now
    void ctx.onMaskClick?.(event)
  }

  const onTouchStart = (event) => {
    if (!resolveShowPreview() || !resolveShowsMask()) return
    if (!isPreviewContent(event.target)) return
    const touch = event.touches?.[0]
    if (!touch) return
    tapStartX = touch.clientX
    tapStartY = touch.clientY
    tapMoved = false
  }

  const onTouchMove = (event) => {
    if (!resolveShowsMask() || !event.touches?.length) return
    const touch = event.touches[0]
    const dx = touch.clientX - tapStartX
    const dy = touch.clientY - tapStartY
    if (Math.sqrt(dx * dx + dy * dy) > TAP_MOVE_THRESHOLD) {
      tapMoved = true
    }
  }

  const onTouchEnd = (event) => {
    if (!resolveShowPreview() || !resolveShowsMask()) return
    if (tapMoved) return
    if (!isPreviewContent(event.target)) return
    triggerMaskClick(event)
  }

  const onClick = (event) => {
    if (!resolveShowPreview() || !resolveShowsMask()) return
    if (!isPreviewContent(event.target)) return
    triggerMaskClick(event)
  }

  const bind = () => {
    if (listening) return
    listening = true
    document.addEventListener('touchstart', onTouchStart, true)
    document.addEventListener('touchmove', onTouchMove, true)
    document.addEventListener('touchend', onTouchEnd, true)
    document.addEventListener('click', onClick, true)
  }

  const unbind = () => {
    if (!listening) return
    listening = false
    document.removeEventListener('touchstart', onTouchStart, true)
    document.removeEventListener('touchmove', onTouchMove, true)
    document.removeEventListener('touchend', onTouchEnd, true)
    document.removeEventListener('click', onClick, true)
    tapMoved = false
  }

  const syncBinding = () => {
    if (resolveShowPreview() && resolveShowsMask()) bind()
    else unbind()
  }

  watch([() => unref(ctx.showPreview), () => unref(ctx.showsMask)], syncBinding, {
    immediate: true
  })

  onBeforeUnmount(unbind)

  return {}
}
