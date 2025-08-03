<template>
  <div
    ref="virtualListRef"
    class="virtual-list"
    @scroll="debouncedScroll"
    @touchstart="onTouchStart"
    @touchmove="onTouchMove"
    @touchend="onTouchEnd"
  >
    <div class="virtual-list-container" :style="{ height: `${totalHeight}px` }">
      <div class="virtual-list-content" :style="{ transform: `translateY(${offsetY}px)` }">
        <div
          v-for="(item, index) in visibleItems"
          :key="`${startIndex + index}-${item.id || index}`"
          class="virtual-list-item"
          :style="{ height: `${itemHeight}px` }"
        >
          <slot :item="item" :index="startIndex + index" :is-visible="true" />
        </div>
      </div>
    </div>

    <!-- 初始加载指示器 -->
    <div v-if="loading && items.length === 0" class="loading-indicator">
      <van-loading size="24px" />
      <span>{{ $t('messages.loading') }}</span>
    </div>

    <!-- 无数据指示器 -->
    <div v-if="finished && !loading && items.length === 0" class="finished-indicator">
      {{ $t('messages.noData') }}
    </div>

    <!-- 加载更多指示器 -->
    <div v-if="loading && items.length > 0" class="loading-more-indicator">
      <van-loading size="24px" />
      <span>{{ $t('messages.loadingMore') }}</span>
    </div>

    <!-- 没有更多数据指示器 -->
    <div v-if="finished && !loading && items.length > 0" class="finished-indicator">
      {{ $t('messages.noMoreData') }}
    </div>
  </div>
</template>

<script setup>
import { Loading as VanLoading } from 'vant'

// Props
const props = defineProps({
  items: {
    type: Array,
    default: () => []
  },
  itemHeight: {
    type: Number,
    required: true
  },
  containerHeight: {
    type: Number,
    required: true
  },
  bufferSize: {
    type: Number,
    default: 2
  },
  loading: {
    type: Boolean,
    default: false
  },
  finished: {
    type: Boolean,
    default: false
  }
})

// Emits
const emit = defineEmits(['scroll', 'load-more'])

// Refs
const virtualListRef = ref(null)
const scrollTop = ref(0)
const containerHeight = ref(props.containerHeight)
const isSyncing = ref(false) // 同步标志，防止在同步时触发不必要的scroll事件

// 计算总高度
const totalHeight = computed(() => {
  return props.items.length * props.itemHeight
})

// 计算可见范围
const visibleRange = computed(() => {
  // 缓存计算结果，避免重复计算
  const itemHeight = props.itemHeight
  const itemsLength = props.items.length
  const bufferSize = props.bufferSize

  const start = Math.floor(scrollTop.value / itemHeight)
  const end = Math.ceil((scrollTop.value + containerHeight.value) / itemHeight)

  const bufferStart = Math.max(0, start - bufferSize)
  const bufferEnd = Math.min(itemsLength, end + bufferSize)

  return {
    start: bufferStart,
    end: bufferEnd,
    startIndex: bufferStart,
    endIndex: bufferEnd,
    // 添加实际可见范围（不包含缓冲区）
    visibleStart: Math.max(0, start),
    visibleEnd: Math.min(itemsLength, end)
  }
})

// 计算可见项目
const visibleItems = computed(() => {
  const { start, end } = visibleRange.value
  return props.items.slice(start, end)
})

// 强制刷新可见项目（用于同步）
const forceRefreshVisibleItems = () => {
  // 强制触发响应式更新
  const currentScrollTop = scrollTop.value
  scrollTop.value = 0
  nextTick(() => {
    scrollTop.value = currentScrollTop
    // 再次强制触发，确保visibleItems更新
    nextTick(() => {
      // 触发一个微小的滚动变化来强制更新
      scrollTop.value = currentScrollTop + 0.1
      nextTick(() => {
        scrollTop.value = currentScrollTop
      })
    })
  })
}

// 计算偏移量
const offsetY = computed(() => {
  return visibleRange.value.start * props.itemHeight
})

// 计算开始索引
const startIndex = computed(() => {
  return visibleRange.value.start
})

// 触摸状态
const touchState = reactive({
  startY: 0,
  startScrollTop: 0,
  isScrolling: false
})

// 防抖滚动处理
let scrollTimer = null
// 动画定时器数组，用于清理
const scrollAnimationTimers = []
const debouncedScroll = (event) => {
  if (scrollTimer) {
    clearTimeout(scrollTimer)
  }
  scrollTimer = setTimeout(() => {
    handleScroll(event)
  }, 8) // 约120fps，更流畅的响应
}

// 滚动处理
const handleScroll = (event) => {
  // 如果正在同步，跳过scroll事件处理
  if (isSyncing.value) return

  const target = event.target
  const newScrollTop = target.scrollTop

  // 只有当滚动位置真正改变时才更新
  if (Math.abs(newScrollTop - scrollTop.value) > 1) {
    scrollTop.value = newScrollTop

    // 检查是否需要加载更多
    const { end } = visibleRange.value
    if (end >= props.items.length - 2 && !props.loading && !props.finished) {
      emit('load-more')
    }

    // 触发滚动事件，传递更精确的数据
    emit('scroll', {
      scrollTop: scrollTop.value,
      scrollHeight: target.scrollHeight,
      clientHeight: target.clientHeight,
      // 添加当前可见的索引范围，帮助父组件更准确地计算当前索引
      visibleStart: visibleRange.value.visibleStart,
      visibleEnd: visibleRange.value.visibleEnd
    })
  }
}

// 触摸开始
const onTouchStart = (event) => {
  touchState.startY = event.touches[0].clientY
  touchState.startScrollTop = scrollTop.value
  touchState.isScrolling = false
}

// 触摸移动
const onTouchMove = (event) => {
  const deltaY = event.touches[0].clientY - touchState.startY

  // 如果滚动距离足够大，标记为滚动状态
  if (Math.abs(deltaY) > 10) {
    touchState.isScrolling = true
  }

  // 只在必要时阻止默认行为，避免影响正常滚动
  if (touchState.isScrolling && Math.abs(deltaY) > 20) {
    event.preventDefault()
  }
}

// 触摸结束
const onTouchEnd = (event) => {
  touchState.isScrolling = false
}

// 滚动到指定索引
const scrollToIndex = (index) => {
  if (!virtualListRef.value) return

  const targetScrollTop = index * props.itemHeight

  // 如果目标位置与当前位置相同，直接返回
  if (Math.abs(scrollTop.value - targetScrollTop) < 1) {
    return
  }

  // 设置同步标志
  isSyncing.value = true

  // 使用 requestAnimationFrame 确保在下一帧执行，提高性能
  requestAnimationFrame(() => {
    // 临时设置更快的滚动动画
    virtualListRef.value.style.scrollBehavior = 'smooth'
    virtualListRef.value.scrollTop = targetScrollTop

    // 动画完成后恢复默认设置
    const animationTimer = setTimeout(() => {
      if (virtualListRef.value) {
        virtualListRef.value.style.scrollBehavior = ''
      }
      // 清除同步标志
      isSyncing.value = false
    }, 200) // 200ms 动画时间

    // 保存定时器引用以便清理
    scrollAnimationTimers.push(animationTimer)
  })
}

// 滚动到顶部
const scrollToTop = () => {
  if (!virtualListRef.value) return
  // 使用 requestAnimationFrame 确保在下一帧执行，提高性能
  requestAnimationFrame(() => {
    // 临时设置更快的滚动动画
    virtualListRef.value.style.scrollBehavior = 'smooth'
    virtualListRef.value.scrollTop = 0

    // 动画完成后恢复默认设置
    const animationTimer = setTimeout(() => {
      if (virtualListRef.value) {
        virtualListRef.value.style.scrollBehavior = ''
      }
    }, 200) // 200ms 动画时间

    // 保存定时器引用以便清理
    scrollAnimationTimers.push(animationTimer)
  })
}

// 更新容器高度
const updateContainerHeight = (height) => {
  containerHeight.value = height
}

// 直接设置滚动位置（用于同步，不触发scroll事件）
const setScrollTop = (top) => {
  if (!virtualListRef.value) return Promise.resolve()

  return new Promise((resolve) => {
    isSyncing.value = true
    scrollTop.value = top
    virtualListRef.value.scrollTop = top

    // 强制重新计算可见范围并触发重新渲染
    nextTick(() => {
      // 强制触发响应式更新
      scrollTop.value = top

      // 强制触发DOM更新
      virtualListRef.value.style.transform = 'translateZ(0)'

      // 强制刷新可见项目
      forceRefreshVisibleItems()

      // 使用 requestAnimationFrame 确保渲染完成后再触发事件
      requestAnimationFrame(() => {
        // 再次确保可见项目更新
        nextTick(() => {
          isSyncing.value = false

          // 触发滚动事件，确保父组件能收到正确的滚动数据
          if (virtualListRef.value) {
            const scrollEvent = {
              scrollTop: scrollTop.value,
              scrollHeight: virtualListRef.value.scrollHeight,
              clientHeight: virtualListRef.value.clientHeight,
              visibleStart: visibleRange.value.visibleStart,
              visibleEnd: visibleRange.value.visibleEnd
            }
            emit('scroll', scrollEvent)
          }
          resolve()
        })
      })
    })
  })
}

// 监听容器高度变化
const resizeObserver = ref(null)

onMounted(() => {
  // 创建 ResizeObserver 监听容器大小变化
  if (window.ResizeObserver) {
    resizeObserver.value = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.target === virtualListRef.value) {
          const height = entry.contentRect.height
          updateContainerHeight(height)
        }
      }
    })

    if (virtualListRef.value) {
      resizeObserver.value.observe(virtualListRef.value)
    }
  }
})

onUnmounted(() => {
  if (scrollTimer) {
    clearTimeout(scrollTimer)
  }

  // 清理所有动画定时器
  scrollAnimationTimers.forEach((timer) => {
    clearTimeout(timer)
  })
  scrollAnimationTimers.length = 0

  if (resizeObserver.value) {
    resizeObserver.value.disconnect()
  }
})

// 监听 props 变化
watch(
  () => props.containerHeight,
  (newHeight) => {
    containerHeight.value = newHeight
  }
)

// 暴露方法
defineExpose({
  scrollToIndex,
  scrollToTop,
  updateContainerHeight,
  setScrollTop,
  forceRefreshVisibleItems,
  scrollTop: readonly(scrollTop),
  // 添加获取当前滚动位置的方法
  getScrollTop: () => scrollTop.value
})
</script>

<style scoped>
.virtual-list {
  width: 100%;
  height: 100%;
  overflow-y: auto;
  overflow-x: hidden;
  -webkit-overflow-scrolling: touch;
  scroll-behavior: smooth;
  position: relative;
  /* 性能优化 */
  will-change: scroll-position;
  transform: translateZ(0);
  /* 自定义滚动动画时间，让动画更快更流畅 */
  scroll-timeline: auto;
  scroll-timeline-axis: block;
  /* 使用CSS自定义属性控制动画时间 */
  --scroll-duration: 0.2s;
}

.virtual-list-container {
  position: relative;
  width: 100%;
}

.virtual-list-content {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  will-change: transform;
  transform: translateZ(0);
  /* 性能优化：减少重绘 */
  contain: layout style paint;
}

.virtual-list-item {
  width: 100%;
  position: relative;
  will-change: transform;
  transform: translateZ(0);
}

.loading-indicator,
.loading-more-indicator,
.finished-indicator {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  color: #999;
  font-size: 14px;
  gap: 8px;
}

.loading-indicator {
  color: #666;
}

.loading-more-indicator {
  color: #666;
  padding: 10px 20px;
}

.finished-indicator {
  color: #999;
}
</style>
