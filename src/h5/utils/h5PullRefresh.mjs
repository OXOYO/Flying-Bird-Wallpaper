import { ref } from 'vue'

/** 视为「已到顶」的最大 scrollTop（px） */
export const H5_PULL_REFRESH_TOP_EPS = 8

/** 滚动停止后多久才允许下拉刷新（避免惯性 / 回弹期间误判） */
export const H5_PULL_REFRESH_SCROLL_IDLE_MS = 180

/**
 * 滚动活跃检测：列表仍在惯性滑动时禁止 PullRefresh 接管手势
 */
export function createH5ScrollIdleGuard(idleMs = H5_PULL_REFRESH_SCROLL_IDLE_MS) {
  const active = ref(false)
  let timer = null

  const ping = () => {
    active.value = true
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => {
      active.value = false
      timer = null
    }, idleMs)
  }

  const dispose = () => {
    if (timer) {
      clearTimeout(timer)
      timer = null
    }
    active.value = false
  }

  return { active, ping, dispose }
}

/**
 * @param {{
 *   loading?: boolean
 *   displayMode: 'waterfall' | 'fullscreen'
 *   waterfallScrollTop?: number
 *   fullscreenScrollTop?: number
 *   fullscreenVisibleIndex?: number
 *   scrollIdleActive?: boolean
 * }} ctx
 */
export function computeH5PullRefreshDisabled(ctx) {
  if (ctx.loading || ctx.scrollIdleActive) {
    return true
  }

  if (ctx.displayMode !== 'fullscreen') {
    return Math.max(0, Number(ctx.waterfallScrollTop) || 0) > H5_PULL_REFRESH_TOP_EPS
  }

  const scrollTop = Math.max(0, Number(ctx.fullscreenScrollTop) || 0)
  const index = Math.max(0, Number(ctx.fullscreenVisibleIndex) || 0)

  if (index > 0) {
    return true
  }

  return scrollTop > H5_PULL_REFRESH_TOP_EPS
}

export function computeH5FullscreenPullAtTop(displayMode, pullRefreshDisabled) {
  return displayMode === 'fullscreen' && !pullRefreshDisabled
}
