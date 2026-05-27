import { reactive, ref, watch } from 'vue'

const GRID_SIZE_RANGE = { size: 4, wrapperWidth: 900 }

export function calculateOptimalBuffer(blockHeight, cardHeight) {
  const baseBuffer = cardHeight * 2
  const screenRows = Math.ceil(blockHeight / cardHeight)
  const performanceMultiplier =
    typeof navigator !== 'undefined' && navigator.hardwareConcurrency > 4 ? 1.5 : 1
  return parseInt(
    Math.min(
      Math.max(baseBuffer, screenRows * cardHeight * performanceMultiplier),
      blockHeight * 0.5
    ),
    10
  )
}

/**
 * 与 ExploreCommon 一致的卡片网格尺寸（读取设置里的 gridSize / gridHWRatio）
 */
export function useExploreCardGrid(settingDataRef, options = {}) {
  const { onLayout } = options
  const cardBlockRef = ref(null)
  const scrollRef = ref(null)
  let resizeObserver = null

  const cardForm = reactive({
    cardWidth: 225,
    cardHeight: Math.floor(225 * 0.618),
    gridSize: 4,
    gridGap: 4,
    buffer: 100
  })

  const applyGridSize = (blockWidth, blockHeight) => {
    if (!blockWidth || !blockHeight) return
    const gridSizeSetting = settingDataRef.value?.gridSize || 'auto'
    const gridHWRatio = settingDataRef.value?.gridHWRatio || 0.618
    const availableWidth = blockWidth - 20
    const updates = {}

    if (gridSizeSetting === 'auto') {
      for (let i = 0; i < 10; i++) {
        const size = GRID_SIZE_RANGE.size * Math.pow(1.5, i)
        const minWidth = GRID_SIZE_RANGE.wrapperWidth * Math.pow(1.5, i)
        const maxWidth = GRID_SIZE_RANGE.wrapperWidth * Math.pow(1.5, i + 1)
        if (availableWidth >= minWidth && availableWidth < maxWidth) {
          updates.gridSize = size
          const totalGap = (updates.gridSize - 1) * cardForm.gridGap
          updates.cardWidth = Math.round(((availableWidth - totalGap) / updates.gridSize) * 10) / 10
          updates.cardHeight = Math.round(updates.cardWidth * gridHWRatio * 10) / 10
          break
        }
      }
    } else {
      const fixedSize = Number(gridSizeSetting) || GRID_SIZE_RANGE.size
      updates.gridSize = fixedSize
      const totalGap = (updates.gridSize - 1) * cardForm.gridGap
      updates.cardWidth = Math.round(((availableWidth - totalGap) / updates.gridSize) * 10) / 10
      updates.cardHeight = Math.round(updates.cardWidth * gridHWRatio * 10) / 10
    }

    if (!updates.gridSize) {
      updates.gridSize = GRID_SIZE_RANGE.size
      const totalGap = (updates.gridSize - 1) * cardForm.gridGap
      updates.cardWidth = Math.round(((availableWidth - totalGap) / updates.gridSize) * 10) / 10
      updates.cardHeight = Math.round(updates.cardWidth * gridHWRatio * 10) / 10
    }

    updates.buffer = calculateOptimalBuffer(blockHeight, updates.cardHeight)
    Object.assign(cardForm, updates)
    onLayout?.(blockWidth, blockHeight)
  }

  const measureAndApply = () => {
    const el = cardBlockRef.value
    if (!el) return
    const rect = el.getBoundingClientRect()
    applyGridSize(rect.width, rect.height)
  }

  const bindResizeObserver = () => {
    if (!cardBlockRef.value || resizeObserver) return
    resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect
        applyGridSize(width, height)
      }
    })
    resizeObserver.observe(cardBlockRef.value)
    measureAndApply()
  }

  const unbindResizeObserver = () => {
    resizeObserver?.disconnect()
    resizeObserver = null
  }

  watch(
    () => [settingDataRef.value?.gridSize, settingDataRef.value?.gridHWRatio],
    () => measureAndApply()
  )

  return {
    cardBlockRef,
    scrollRef,
    cardForm,
    measureAndApply,
    bindResizeObserver,
    unbindResizeObserver
  }
}
