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
      top: options.topOffset ?? 'calc(12px + env(safe-area-inset-top, 0px))',
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
