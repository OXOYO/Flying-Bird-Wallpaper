<script setup>
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
  gridItems: {
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

const emit = defineEmits(['scroll'])

const scrollbarRef = ref(null)
const wrapperRef = ref(null)

const scrollTop = ref(0)
const wrapperHeight = ref(0)

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
  const start = startBufferedRowIndex * props.gridItems

  // 计算可见行数
  const visibleRowCount = Math.ceil(currentWrapperHeight / props.itemHeight)
  const bufferedVisibleRowCount = visibleRowCount + bufferRows * 2

  // 计算结束索引
  const endRowIndex = startRowIndex + visibleRowCount
  const endBufferedRowIndex = endRowIndex + bufferRows
  const end = Math.min(props.items.length - 1, endBufferedRowIndex * props.gridItems - 1)

  return { start, end }
})

// 计算可见的项目
const visibleItems = computed(() => {
  const { start, end } = visibleRange.value
  console.log('visibleItems', start, end)
  const items = []

  // 确保 start 和 end 是有效索引
  const startIndex = Math.max(0, start)
  const endIndex = Math.min(props.items.length - 1, end)

  for (let i = startIndex; i <= endIndex; i++) {
    items.push({
      ...props.items[i],
      index: i
    })
  }

  return items
})

// 包装器样式
const wrapperStyle = computed(() => {
  return {
    height: `${Math.ceil(props.items.length / props.gridItems) * props.itemHeight}px`,
    position: 'relative'
  }
})

// 获取项目样式
const getItemStyle = (item) => {
  const row = Math.floor(item.index / props.gridItems)
  const col = item.index % props.gridItems

  const gap = props.gridGap

  // 计算每项的宽度百分比，考虑间距
  const itemWidthPercent = 100 / props.gridItems

  return {
    position: 'absolute',
    top: props.itemWidth
      ? `${row * props.itemHeight + gap}px`
      : `calc(${row * props.itemHeight}px + ${gap}px)`,
    left: props.itemWidth
      ? `${col * props.itemWidth + gap}px`
      : `calc(${col * itemWidthPercent}% + ${(col * 8) / props.gridItems}px + ${gap}px)`,
    width: props.itemWidth
      ? `${props.itemWidth}px`
      : `calc(${itemWidthPercent}% - ${props.gridItems > 1 ? 8 / props.gridItems : 0}px)`,
    height: `${props.itemHeight}px`
  }
}

// 处理滚动事件
const handleScroll = (event) => {
  const scrollElement = scrollbarRef.value?.wrapRef
  if (scrollElement) {
    scrollTop.value = scrollElement.scrollTop
    wrapperHeight.value = scrollElement.clientHeight
    // 传递滚动信息给父组件
    emit('scroll', {
      scrollTop: scrollElement.scrollTop,
      scrollHeight: scrollElement.scrollHeight,
      clientHeight: scrollElement.clientHeight
    })
  }
}

// 更新可见项目
const updateVisibleItems = () => {
  nextTick(() => {
    const scrollElement = scrollbarRef.value?.wrapRef
    if (scrollElement) {
      wrapperHeight.value = scrollElement.clientHeight
    }
  })
}

// 监听项目变化
watch(
  () => props.items,
  () => {
    updateVisibleItems()
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
})

defineExpose({
  updateVisibleItems,
  scrollTo: (top) => {
    const scrollElement = scrollbarRef.value?.wrapRef
    if (scrollElement) {
      scrollElement.scrollTop = top
    }
  }
})
</script>

<template>
  <el-scrollbar ref="scrollbarRef" class="virtual-list-scrollbar" @scroll="handleScroll">
    <div ref="wrapperRef" class="virtual-list-wrapper" :style="wrapperStyle">
      <div
        v-for="item in visibleItems"
        :key="item.uniqueKey"
        class="virtual-list-item"
        :style="getItemStyle(item)"
      >
        <slot :item="item" :index="item.index"></slot>
      </div>
    </div>
  </el-scrollbar>
</template>

<style scoped lang="scss">
.virtual-list-scrollbar {
  height: 100%;

  :deep(.el-scrollbar__wrap) {
    overflow-x: hidden;
  }
}

.virtual-list-wrapper {
  width: 100%;
}

.virtual-list-item {
  box-sizing: border-box;
}
</style>
