import { nextTick } from 'vue'

/**
 * 弹窗动画结束后聚焦输入框（Vant Field / Element Input / 原生 input）
 * @param {() => unknown} getTarget 组件 ref 或 DOM 根节点
 * @param {{ retries?: number, interval?: number, selector?: string }} [options]
 */
export function scheduleDialogInputFocus(getTarget, options = {}) {
  const {
    retries = 5,
    interval = 50,
    selector = 'input:not([disabled]):not([readonly]), textarea:not([disabled]):not([readonly])'
  } = options

  const tryOnce = () => {
    const target = typeof getTarget === 'function' ? getTarget() : getTarget
    if (!target) return false

    if (typeof target.focus === 'function') {
      try {
        target.focus()
        return true
      } catch {
        /* ignore */
      }
    }

    const root = target.$el ?? target
    const input = root?.querySelector?.(selector)
    if (!input || typeof input.focus !== 'function') return false

    try {
      input.focus({ preventScroll: true })
      return document.activeElement === input || document.activeElement === input.parentElement
    } catch {
      return false
    }
  }

  let attempt = 0
  const run = () => {
    if (tryOnce()) return
    attempt += 1
    if (attempt < retries) setTimeout(run, interval)
  }

  nextTick(() => {
    requestAnimationFrame(run)
  })
}
