/** 与 main.css --fbw-browse-toolbar-height 一致 */
export const FBW_BROWSE_TOOLBAR_HEIGHT_PX = 46

/** 沉浸迷你顶栏：上留白 8 + 按钮 40 + 与指示器间距 8 */
export const FBW_IMMERSIVE_MINI_CHROME_TOP_OFFSET_PX = 56

/**
 * 顶部页码指示器的 top 偏移（需避开顶栏 / 相似栏）
 * @param {object} options
 * @param {'top'|string} [options.position]
 * @param {boolean} [options.immersiveMode]
 * @param {boolean} [options.similarMode]
 * @param {'waterfall'|'fullscreen'} [options.displayMode]
 * @param {number} [options.toolbarHeightPx] 实测顶栏高度，0 时回退默认值
 * @param {number} [options.waterfallContentGapPx]
 * @param {number} [options.indicatorTopCardGapPx]
 * @param {number} [options.gapBelowToolbarPx]
 */
export function resolveH5TopIndicatorOffset(options = {}) {
  const {
    position = 'top',
    immersiveMode = false,
    similarMode = false,
    displayMode = 'waterfall',
    toolbarHeightPx = FBW_BROWSE_TOOLBAR_HEIGHT_PX,
    waterfallContentGapPx = 10,
    indicatorTopCardGapPx = 8,
    gapBelowToolbarPx = 4
  } = options

  if (position !== 'top') return undefined

  const safe = 'env(safe-area-inset-top, 0px)'
  const measuredToolbar =
    Number(toolbarHeightPx) > 0 ? Number(toolbarHeightPx) : FBW_BROWSE_TOOLBAR_HEIGHT_PX

  if (immersiveMode) {
    if (similarMode) {
      // fixed 相似栏实测高度常已含 safe-area，避免重复叠加
      const measured = Number(toolbarHeightPx)
      if (measured > FBW_BROWSE_TOOLBAR_HEIGHT_PX) {
        return `calc(${measured}px + ${gapBelowToolbarPx}px)`
      }
      return `calc(${FBW_BROWSE_TOOLBAR_HEIGHT_PX}px + ${safe} + ${gapBelowToolbarPx}px)`
    }
    return `calc(${FBW_IMMERSIVE_MINI_CHROME_TOP_OFFSET_PX}px + ${safe})`
  }

  if (displayMode === 'waterfall') {
    return `calc(${measuredToolbar}px + ${waterfallContentGapPx}px + ${indicatorTopCardGapPx}px + ${safe})`
  }

  return `calc(${measuredToolbar}px + ${safe} + ${gapBelowToolbarPx}px)`
}

/** H5 页码指示器位置（top / bottom / 空=隐藏） */
export function getH5NumberIndicatorStyle(position, options = {}) {
  if (!position) {
    return { display: 'none' }
  }

  const base = {
    display: 'inline-block',
    position: options.position || 'fixed',
    left: '50%',
    right: 'auto',
    transform: 'translateX(-50%)',
    zIndex: options.zIndex ?? 200
  }

  if (position === 'top') {
    return {
      ...base,
      top:
        options.topOffset ??
        `calc(${FBW_BROWSE_TOOLBAR_HEIGHT_PX}px + env(safe-area-inset-top, 0px) + 4px)`,
      bottom: 'auto'
    }
  }

  return {
    ...base,
    top: 'auto',
    bottom:
      options.bottomOffset ?? 'calc(var(--fbw-tabbar-height, 50px) + 12px)'
  }
}
