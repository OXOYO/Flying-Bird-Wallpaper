<script setup>
import { throttle } from '@common/utils.js'

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

const emit = defineEmits(['scroll', 'load-more'])

const virtualListRef = ref(null)
const containerHeight = ref(props.containerHeight)
const isSyncing = ref(false) // 同步标志，防止在同步时触发不必要的scroll事件

const virtualListScrollTop = ref(0)

// 滚动性能相关状态
const scrollPerformance = reactive({
  // 上次滚动时间
  lastScrollTime: 0,
  // 上次滚动位置
  lastScrollTop: 0,
  // 滚动速度 (px/ms)
  velocity: 0,
  // 动态防抖时间 (ms)
  debounceTime: 8,
  // 动态缓冲区大小
  dynamicBufferSize: props.bufferSize
})

// 计算总高度
const totalHeight = computed(() => {
  return props.items.length * props.itemHeight
})

// 计算可见范围
const visibleRange = computed(() => {
  // 缓存计算结果，避免重复计算
  const itemHeight = props.itemHeight
  const itemsLength = props.items.length
  const bufferSize = scrollPerformance.dynamicBufferSize

  const scrollTop = virtualListScrollTop.value || 0
  const containerHeightVal = containerHeight.value

  // 避免重复计算
  const start = Math.floor(scrollTop / itemHeight)
  const end = Math.ceil((scrollTop + containerHeightVal) / itemHeight)

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

// 判断项目是否在可视区域内（用于懒加载优化）
const isItemVisible = (index) => {
  const { visibleStart, visibleEnd } = visibleRange.value
  return index >= visibleStart && index < visibleEnd
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

// 定时器管理
const timers = reactive({
  scroll: null,
  animation: [],
  resize: null
})

// 清理所有定时器
const clearAllTimers = () => {
  // 清理滚动定时器
  if (timers.scroll) {
    clearTimeout(timers.scroll)
    timers.scroll = null
  }

  // 清理所有动画定时器
  timers.animation.forEach((timer) => {
    clearTimeout(timer)
  })
  timers.animation = []

  // 清理调整大小定时器
  if (timers.resize) {
    clearTimeout(timers.resize)
    timers.resize = null
  }
}

// 安全地设置定时器并添加到管理列表
const setSafeTimer = (type, callback, delay) => {
  // 先清理同类型的旧定时器
  if (type === 'scroll' || type === 'resize') {
    if (timers[type]) {
      clearTimeout(timers[type])
      timers[type] = null
    }
  }

  const timer = setTimeout(() => {
    callback()
    // 执行后清理引用
    if (type === 'scroll' || type === 'resize') {
      timers[type] = null
    } else if (type === 'animation') {
      const index = timers.animation.indexOf(timer)
      if (index > -1) {
        timers.animation.splice(index, 1)
      }
    }
  }, delay)

  // 添加到管理列表
  if (type === 'scroll' || type === 'resize') {
    timers[type] = timer
  } else if (type === 'animation') {
    timers.animation.push(timer)
  }

  return timer
}

// 动态计算防抖时间
const calculateDynamicDebounceTime = (newScrollTop) => {
  const now = Date.now()
  const timeDiff = now - scrollPerformance.lastScrollTime

  if (timeDiff > 0) {
    // 计算滚动速度 (px/ms)
    const distance = Math.abs(newScrollTop - scrollPerformance.lastScrollTop)
    scrollPerformance.velocity = distance / timeDiff

    // 根据滚动速度动态调整防抖时间 (4-16ms)
    // 速度越快，防抖时间越短，响应更及时
    scrollPerformance.debounceTime = Math.max(4, Math.min(16, 16 - scrollPerformance.velocity * 50))

    // 根据滚动速度动态调整缓冲区大小 (1-3项)
    // 速度越快，缓冲区越大，避免白屏
    scrollPerformance.dynamicBufferSize = Math.max(
      1,
      Math.min(3, Math.ceil(props.bufferSize * (1 + scrollPerformance.velocity)))
    )
  }

  // 更新上次滚动状态
  scrollPerformance.lastScrollTime = now
  scrollPerformance.lastScrollTop = newScrollTop

  return scrollPerformance.debounceTime
}

// 节流滚动处理
const throttledScroll = throttle((event) => {
  const newScrollTop = event.target.scrollTop
  // 动态计算性能参数
  calculateDynamicDebounceTime(newScrollTop)
  handleScroll(event)
}, 16) // 约60fps

// 滚动处理
const handleScroll = (event) => {
  // 如果正在同步，跳过scroll事件处理
  if (isSyncing.value) return

  const target = event.target
  const newScrollTop = target.scrollTop

  // 实时更新滚动位置，确保计算属性依赖正确
  virtualListScrollTop.value = newScrollTop

  // 检查是否需要加载更多
  const { end } = visibleRange.value
  if (end >= props.items.length - 3 && !props.loading && !props.finished) {
    emit('load-more')
  }

  // 触发滚动事件，传递更精确的数据
  emit('scroll', {
    scrollTop: newScrollTop,
    scrollHeight: target.scrollHeight,
    clientHeight: target.clientHeight,
    // 添加当前可见的索引范围，帮助父组件更准确地计算当前索引
    visibleStart: visibleRange.value.visibleStart,
    visibleEnd: visibleRange.value.visibleEnd,
    // 添加滚动性能数据
    velocity: scrollPerformance.velocity
  })
}

// 触摸开始
const onTouchStart = (event) => {
  touchState.startY = event.touches[0].clientY
  touchState.startScrollTop = virtualListRef.value.scrollTop
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

// 统一的滚动方法，支持索引和位置
const scrollTo = (options) => {
  if (!virtualListRef.value) return Promise.resolve()

  return new Promise((resolve) => {
    // 设置同步标志
    isSyncing.value = true

    // 计算目标滚动位置
    let targetScrollTop
    // 当前滚动位置
    const scrollTop = virtualListRef.value.scrollTop

    if ('index' in options) {
      // 通过索引滚动
      const index = Math.max(0, Math.min(options.index, props.items.length - 1))
      targetScrollTop = index * props.itemHeight
    } else if ('position' in options) {
      // 直接设置位置
      targetScrollTop = options.position
    } else {
      // 默认滚动到顶部
      targetScrollTop = 0
    }

    // 如果目标位置与当前位置相同，直接返回
    if (Math.abs(scrollTop - targetScrollTop) < 1) {
      isSyncing.value = false
      resolve()
      return
    }

    // 确定是否使用动画
    const useAnimation = options.animated !== false

    // 计算动画时间（基于滚动距离，50-300ms）
    const distance = Math.abs(scrollTop - targetScrollTop)
    const duration = useAnimation ? Math.min(300, Math.max(50, distance / 3)) : 0

    // 更新滚动位置状态
    virtualListScrollTop.value = targetScrollTop

    if (useAnimation && duration > 0) {
      // 使用 requestAnimationFrame 确保在下一帧执行，提高性能
      requestAnimationFrame(() => {
        // 临时设置滚动动画
        const element = virtualListRef.value
        if (element) {
          element.style.scrollBehavior = 'smooth'
          element.scrollTop = targetScrollTop

          // 动画完成后恢复默认设置
          setSafeTimer(
            'animation',
            () => {
              if (virtualListRef.value) {
                virtualListRef.value.style.scrollBehavior = ''

                // 清除同步标志
                isSyncing.value = false

                // 触发滚动事件，确保父组件能收到正确的滚动数据
                const scrollEvent = {
                  scrollTop: targetScrollTop,
                  scrollHeight: virtualListRef.value.scrollHeight,
                  clientHeight: virtualListRef.value.clientHeight,
                  visibleStart: visibleRange.value.visibleStart,
                  visibleEnd: visibleRange.value.visibleEnd
                }
                emit('scroll', scrollEvent)
              }

              resolve()
            },
            duration
          )
        } else {
          isSyncing.value = false
          resolve()
        }
      })
    } else {
      // 不使用动画，直接设置位置
      const element = virtualListRef.value
      if (element) {
        element.style.scrollBehavior = ''
        element.scrollTop = targetScrollTop

        // 使用nextTick确保DOM更新后再解除同步标志
        nextTick(() => {
          isSyncing.value = false

          // 触发滚动事件
          const scrollEvent = {
            scrollTop: targetScrollTop,
            scrollHeight: element.scrollHeight,
            clientHeight: element.clientHeight,
            visibleStart: visibleRange.value.visibleStart,
            visibleEnd: visibleRange.value.visibleEnd
          }
          emit('scroll', scrollEvent)

          resolve()
        })
      } else {
        isSyncing.value = false
        resolve()
      }
    }
  })
}

// 滚动到指定索引（兼容旧API）
const scrollToIndex = (index, animated = true) => {
  return scrollTo({ index, animated })
}

// 滚动到指定位置（兼容旧API）
const scrollToPosition = (position, animated = true) => {
  return scrollTo({ position, animated })
}

// 更新容器高度
const updateContainerHeight = (height) => {
  containerHeight.value = height
}

// 监听容器高度变化
const resizeObserver = ref(null)

onMounted(() => {
  // 创建 ResizeObserver 监听容器大小变化
  if (window.ResizeObserver) {
    resizeObserver.value = new ResizeObserver((entries) => {
      // 使用防抖处理尺寸变化，避免频繁更新
      setSafeTimer(
        'resize',
        () => {
          for (const entry of entries) {
            if (entry.target === virtualListRef.value) {
              const height = entry.contentRect.height
              updateContainerHeight(height)
            }
          }
        },
        100
      ) // 100ms防抖
    })

    if (virtualListRef.value) {
      resizeObserver.value.observe(virtualListRef.value)
    }
  }
})

onUnmounted(() => {
  // 清理所有定时器
  clearAllTimers()

  // 断开ResizeObserver连接并清理引用
  if (resizeObserver.value) {
    resizeObserver.value.disconnect()
    resizeObserver.value = null
  }

  // 清理组件引用
  if (virtualListRef.value) {
    // 移除所有事件监听器
    const element = virtualListRef.value
    const clonedElement = element.cloneNode(true)
    element.parentNode?.replaceChild(clonedElement, element)
    virtualListRef.value = null
  }

  // 清理响应式状态
  virtualListScrollTop.value = 0

  // 清理滚动性能状态
  Object.keys(scrollPerformance).forEach((key) => {
    if (typeof scrollPerformance[key] === 'number') {
      scrollPerformance[key] = 0
    } else if (Array.isArray(scrollPerformance[key])) {
      scrollPerformance[key] = []
    }
  })

  // 清理触摸状态
  Object.keys(touchState).forEach((key) => {
    touchState[key] = 0
  })
  touchState.isScrolling = false

  // 清理定时器引用
  Object.keys(timers).forEach((key) => {
    if (timers[key]) {
      if (Array.isArray(timers[key])) {
        timers[key].forEach((timer) => clearTimeout(timer))
        timers[key] = []
      } else {
        clearTimeout(timers[key])
        timers[key] = null
      }
    }
  })

  // 重置同步标志
  isSyncing.value = false
  containerHeight.value = 0
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
  scrollToPosition,
  updateContainerHeight,
  // 状态获取
  getScrollTop: () => virtualListRef.value.scrollTop,
  // 性能数据
  getScrollVelocity: () => scrollPerformance.velocity
})
</script>

<template>
  <div
    ref="virtualListRef"
    class="virtual-list"
    @scroll="throttledScroll"
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
          <slot
            :item="item"
            :index="startIndex + index"
            :is-visible="isItemVisible(startIndex + index)"
          />
        </div>
      </div>
    </div>

    <!-- 无数据指示器 -->
    <div v-if="finished && !loading && items.length === 0" class="finished-indicator">
      <van-empty image="default" :description="$t('messages.noData')" />
    </div>
  </div>
</template>

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
  --scroll-duration: 0.1s;
  /* 添加硬件加速，减少闪屏 */
  -webkit-transform: translateZ(0);
  -webkit-backface-visibility: hidden;
  -webkit-perspective: 1000px;
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
  /* 添加硬件加速，减少闪屏 */
  -webkit-transform: translateZ(0);
  -webkit-backface-visibility: hidden;
  -webkit-perspective: 1000px;
}

.virtual-list-item {
  width: 100%;
  position: relative;
  will-change: transform;
  transform: translateZ(0);
  /* 添加硬件加速，减少闪屏 */
  -webkit-transform: translateZ(0);
  -webkit-backface-visibility: hidden;
  -webkit-perspective: 1000px;
}

.finished-indicator {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  color: #999;
  font-size: 14px;
  gap: 8px;
  color: #999;
}
</style>
