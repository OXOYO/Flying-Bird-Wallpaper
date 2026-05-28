<script setup>
import { throttle } from '@common/utils.js'

defineOptions({
  name: 'VirtualList'
})

const props = defineProps({
  items: {
    type: Array,
    required: true
  },
  itemHeight: {
    type: Number,
    required: true
  },
  itemWidth: {
    type: Number,
    default: 0
  },
  gridSize: {
    type: Number,
    default: 1
  },
  gridGap: {
    type: Number,
    default: 0
  },
  buffer: {
    type: Number,
    default: 0
  }
})

const emit = defineEmits(['scroll', 'close-bottom'])

const scrollbarRef = ref(null)
const wrapperRef = ref(null)

const scrollTop = ref(0)
const wrapperHeight = ref(0)
/** resetScroll 期间禁止从 DOM 回读滚动位置，并抑制误触发 close-bottom */
let scrollResetLock = false
let scrollResetLockUntil = 0

// 计算可见区域的起始和结束索引
const visibleRange = computed(() => {
  // 确保 scrollTop.value 和 wrapperHeight.value 是有效的数值
  const currentScrollTop = Math.max(0, scrollTop.value)
  const currentWrapperHeight = Math.max(0, wrapperHeight.value)

  // 将 buffer 从高度转换为行数
  const bufferRows = Math.ceil(props.buffer / props.itemHeight)

  // 计算起始索引
  const startRowIndex = Math.floor(currentScrollTop / props.itemHeight)
  const startBufferedRowIndex = Math.max(0, startRowIndex - bufferRows)
  const start = Math.max(0, startBufferedRowIndex * props.gridSize)

  // 计算可见行数
  const visibleRowCount = Math.ceil(currentWrapperHeight / props.itemHeight)
  const bufferedVisibleRowCount = visibleRowCount + bufferRows * 2

  // 计算结束索引
  const endRowIndex = startRowIndex + visibleRowCount
  const endBufferedRowIndex = endRowIndex + bufferRows
  // 确保 end 不会是负数
  const end = Math.max(
    0,
    Math.min(props.items.length - 1, endBufferedRowIndex * props.gridSize - 1)
  )

  return { start, end }
})

// 计算可见的项目（必须传 props.items 中的原始引用，避免浅拷贝导致子组件改不动源数据）
const visibleItems = computed(() => {
  const { start, end } = visibleRange.value

  // 确保 start 和 end 是有效索引
  const startIndex = Math.max(0, start)
  const endIndex = Math.min(props.items.length - 1, end)

  return props.items.slice(startIndex, endIndex + 1).map((item, offset) => ({
    item,
    index: startIndex + offset
  }))
})

// 包装器样式
const wrapperStyle = computed(() => {
  return {
    height: `${Math.ceil(props.items.length / props.gridSize) * props.itemHeight}px`
  }
})

const styleCache = new Map()

// 获取项目样式（row: { item, index }）
const getItemStyle = (row) => {
  const cacheKey = `${row.index}_${props.gridSize}_${props.itemHeight}_${props.gridGap}_${props.itemWidth}`

  if (styleCache.has(cacheKey)) {
    return styleCache.get(cacheKey)
  }

  const gridRow = Math.floor(row.index / props.gridSize)
  const col = row.index % props.gridSize

  const gridGap = props.gridGap

  // 计算总可用宽度和单个项目宽度百分比
  const totalGap = (props.gridSize - 1) * gridGap
  const itemWidthPercent = 100 / props.gridSize

  // 计算左侧偏移和宽度，使用更精确的计算方式
  const left = props.itemWidth
    ? `${col * (props.itemWidth + gridGap)}px`
    : `calc(${itemWidthPercent * col}% + ${col * gridGap}px)`

  const width = props.itemWidth
    ? `${props.itemWidth}px`
    : `calc(${itemWidthPercent}% - ${(totalGap / props.gridSize).toFixed(4)}px)` // 使用toFixed提高精度

  const style = {
    top: `${gridRow * (props.itemHeight + gridGap)}px`,
    left,
    width,
    height: `${props.itemHeight}px`
  }

  styleCache.set(cacheKey, style)
  return style
}

// 处理滚动事件
const handleScroll = throttle((event) => {
  const scrollElement = scrollbarRef.value?.wrapRef
  if (scrollElement) {
    const { scrollHeight, clientHeight, scrollTop: scrollTopValue } = scrollElement
    scrollTop.value = scrollTopValue
    wrapperHeight.value = clientHeight
    // 传递滚动信息给父组件
    emit('scroll', {
      scrollTop: scrollTopValue,
      scrollHeight,
      clientHeight
    })
    const distanceFromBottom = scrollHeight - scrollTopValue - clientHeight
    const isScrollable = scrollHeight > clientHeight + 1
    const isCloseBottom = isScrollable && distanceFromBottom < props.buffer
    if (isCloseBottom && !scrollResetLock && Date.now() >= scrollResetLockUntil) {
      emit('close-bottom')
    }
  }
}, 16) // 约60fps

// 更新可见项目
const updateVisibleItems = (resetScrollTop = false) => {
  nextTick(() => {
    const scrollElement = scrollbarRef.value?.wrapRef
    if (scrollElement) {
      if (resetScrollTop || scrollResetLock) {
        scrollTop.value = 0
        if (scrollResetLock && scrollElement.scrollTop !== 0) {
          scrollElement.scrollTop = 0
        }
      } else {
        scrollTop.value = scrollElement.scrollTop
      }
      wrapperHeight.value = scrollElement.clientHeight
    }
  })
}

// 监听项目变化
watch(
  () => props.items,
  () => {
    updateVisibleItems(scrollResetLock)
  },
  { deep: true }
)

// 监听窗口大小变化
const handleResize = () => {
  updateVisibleItems()
}

onMounted(() => {
  updateVisibleItems()
  window.addEventListener('resize', handleResize)
})

onUnmounted(() => {
  window.removeEventListener('resize', handleResize)
  styleCache.clear()
})

// 滚动到指定位置（同步内部 scrollTop，供虚拟列表计算可见区）
const scrollToTop = (top = 0) => {
  const scrollElement = scrollbarRef.value?.wrapRef
  if (!scrollElement) return
  scrollElement.scrollTop = top
  scrollTop.value = top
  wrapperHeight.value = scrollElement.clientHeight
}

/** 列表数据整体替换后滚回顶部（等 DOM / 高度更新后再执行） */
const resetScroll = () => {
  scrollResetLock = true
  scrollResetLockUntil = Date.now() + 600
  const apply = () => scrollToTop(0)
  apply()
  nextTick(() => {
    apply()
    requestAnimationFrame(() => {
      apply()
      updateVisibleItems(true)
      requestAnimationFrame(() => {
        apply()
        scrollResetLock = false
      })
    })
  })
}

// 滚动到指定索引
const scrollToIndex = (index) => {
  // 确保索引有效
  const validIndex = Math.max(0, Math.min(index, props.items.length - 1))
  // 计算行号
  const row = Math.floor(validIndex / props.gridSize)
  // 计算滚动位置
  const top = row * (props.itemHeight + props.gridGap)
  // 调用 scrollToTop 方法
  scrollToTop(top)
}

defineExpose({
  updateVisibleItems,
  scrollToTop,
  scrollToIndex,
  resetScroll
})
</script>

<template>
  <el-scrollbar ref="scrollbarRef" class="virtual-list-scrollbar" @scroll="handleScroll">
    <div ref="wrapperRef" class="virtual-list-wrapper" :style="wrapperStyle">
      <div
        v-for="row in visibleItems"
        :key="row.item.uniqueKey"
        class="virtual-list-item"
        :style="getItemStyle(row)"
      >
        <slot :item="row.item" :index="row.index"></slot>
      </div>
    </div>
  </el-scrollbar>
</template>

<style scoped lang="scss">
.virtual-list-scrollbar {
  height: 100%;

  :deep(.el-scrollbar__wrap) {
    overflow-x: hidden;
    scroll-behavior: smooth;
  }
}

.virtual-list-wrapper {
  position: relative;
  box-sizing: border-box;
  width: 100%;
}

.virtual-list-item {
  position: absolute;
  box-sizing: border-box;
  transform: translateZ(0);
  will-change: transform;
}
</style>
