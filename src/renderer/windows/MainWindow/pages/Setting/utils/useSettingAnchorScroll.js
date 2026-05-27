import { ref, computed, nextTick } from 'vue'

function getScrollContainer(scrollbarRef) {
  return scrollbarRef.value?.$el?.querySelector('.el-scrollbar__wrap') || null
}

function resolveTarget(container, href) {
  if (!container || !href) return null
  const id = href.replace(/^#/, '')
  return container.querySelector(`#${CSS.escape(id)}`) || document.getElementById(id)
}

function waitUntilVisible(container, maxFrames = 40) {
  return new Promise((resolve) => {
    let frames = 0
    const tick = () => {
      if (container.clientHeight > 0) {
        resolve(true)
        return
      }
      if (frames++ >= maxFrames) {
        resolve(false)
        return
      }
      requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  })
}

function afterLayout() {
  return new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(resolve))
  })
}

/**
 * 设置页锚点滚动：Tab 用 v-show 隐藏后 scrollTop 会归零，但 el-anchor 高亮仍保留。
 * 切回 Tab 时在容器可见且布局稳定后，恢复右侧滚动位置。
 */
export function useSettingAnchorScroll(scrollbarRef, { defaultHref = '', offset = 20 } = {}) {
  const activeAnchorHref = ref(defaultHref)

  const anchorContainer = computed(() => getScrollContainer(scrollbarRef))

  const onAnchorChange = (href) => {
    if (href) activeAnchorHref.value = href
  }

  const scrollToAnchor = (href = activeAnchorHref.value) => {
    const container = anchorContainer.value
    if (!container || !href) return false

    const target = resolveTarget(container, href)
    if (!target) return false

    const targetRect = target.getBoundingClientRect()
    const containerRect = container.getBoundingClientRect()
    const top = Math.max(0, container.scrollTop + targetRect.top - containerRect.top - offset)

    container.scrollTop = top
    container.dispatchEvent(new Event('scroll', { bubbles: true }))
    return true
  }

  const restoreAnchorScroll = async () => {
    const href = activeAnchorHref.value
    if (!href) return

    await nextTick()
    const container = anchorContainer.value
    if (!container) return

    await waitUntilVisible(container)
    await afterLayout()
    scrollToAnchor(href)
  }

  return {
    activeAnchorHref,
    anchorContainer,
    onAnchorChange,
    restoreAnchorScroll,
    scrollToAnchor
  }
}
