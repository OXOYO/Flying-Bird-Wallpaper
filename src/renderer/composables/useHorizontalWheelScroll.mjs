/** 将垂直滚轮转为横向滚动（用于卡片底部工具条） */
export function useHorizontalWheelScroll() {
  const onHorizontalWheel = (e) => {
    const root = e.currentTarget?.closest?.('.card-item-btns') || e.currentTarget
    const wrap = root?.querySelector?.('.el-scrollbar__wrap')
    if (!wrap || wrap.scrollWidth <= wrap.clientWidth + 1) return

    e.preventDefault()
    e.stopPropagation()
    wrap.scrollLeft += e.deltaY + e.deltaX
  }

  return { onHorizontalWheel }
}
