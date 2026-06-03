<script setup>
/**
 * 全屏逐张翻页列表（与搜索页铺满模式同一套逻辑）
 * - ResizeObserver 测量可视高度，item-height === container-height
 * - VirtualList page-snap + 原生跟手滚动，无外层 touch 翻页拦截
 */
import VirtualList from '@h5/components/VirtualList.vue'

const props = defineProps({
  items: {
    type: Array,
    default: () => []
  },
  loading: {
    type: Boolean,
    default: false
  },
  finished: {
    type: Boolean,
    default: false
  },
  suppressLoadMore: {
    type: Boolean,
    default: false
  },
  /** 双指缩放等场景下关闭 scroll-snap */
  snapDisabled: {
    type: Boolean,
    default: false
  },
  /** 首张顶部允许下拉刷新（overscroll 传递到 PullRefresh） */
  allowTopPull: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['scroll', 'load-more', 'index-change'])

const sliderRef = ref(null)
const listRef = ref(null)
const measuredHeight = ref(0)
let resizeObserver = null

const itemHeight = computed(() => {
  const measured = measuredHeight.value
  if (measured > 0) return measured
  return Math.max(240, Math.floor((typeof window !== 'undefined' ? window.innerHeight : 800) * 0.72))
})

const getFallbackViewportHeight = () => {
  if (typeof window === 'undefined') return 800
  const tabbarVar = getComputedStyle(document.documentElement)
    .getPropertyValue('--fbw-tabbar-height')
    .trim()
  const tabbar = tabbarVar.endsWith('px') ? parseFloat(tabbarVar) : 50
  return Math.max(240, Math.round(window.innerHeight - tabbar))
}

const measureHeight = () => {
  const el = sliderRef.value
  const h = el?.clientHeight
    ? Math.round(el.clientHeight)
    : getFallbackViewportHeight()
  if (h > 0) measuredHeight.value = h
}

watch(
  () => props.items.length,
  () => {
    nextTick(() => measureHeight())
  }
)

const bindResizeObserver = () => {
  resizeObserver?.disconnect()
  const el = sliderRef.value
  if (!el || typeof ResizeObserver === 'undefined') return
  resizeObserver = new ResizeObserver((entries) => {
    const h = entries[0]?.contentRect?.height
    if (h) {
      measuredHeight.value = Math.round(h)
    }
  })
  resizeObserver.observe(el)
}

const resolveIndexFromScroll = (payload) => {
  const len = props.items.length
  if (!len) return 0
  const ih = Math.max(1, itemHeight.value)
  const scrollTop = Math.max(0, Number(payload.scrollTop) || 0)
  // 按页顶对齐计算当前张，避免在两张之间过早判为 index 0 导致下拉刷新误触
  return Math.min(Math.max(0, Math.floor((scrollTop + ih * 0.35) / ih)), len - 1)
}

const onListScroll = (payload) => {
  emit('scroll', payload)
  emit('index-change', resolveIndexFromScroll(payload))
}

onMounted(() => {
  nextTick(() => {
    measureHeight()
    bindResizeObserver()
  })
})

onBeforeUnmount(() => {
  resizeObserver?.disconnect()
  resizeObserver = null
})

defineExpose({
  scrollToIndex: (index, animated = true) => listRef.value?.scrollToIndex(index, animated),
  scrollToPosition: (position, animated = true) => listRef.value?.scrollToPosition(position, animated),
  getScrollTop: () => listRef.value?.getScrollTop?.() ?? 0,
  updateContainerHeight: (height) => listRef.value?.updateContainerHeight(height),
  measureHeight,
  getItemHeight: () => itemHeight.value,
  getSliderEl: () => sliderRef.value,
  getScrollElement: () => listRef.value?.$el ?? sliderRef.value
})
</script>

<template>
  <div
    ref="sliderRef"
    class="h5-fullscreen-pager"
    :class="{ 'h5-fullscreen-pager--snap-off': snapDisabled }"
  >
    <VirtualList
      ref="listRef"
      page-snap
      :allow-top-pull="allowTopPull"
      :items="items"
      :item-height="itemHeight"
      :container-height="itemHeight"
      :loading="loading"
      :finished="finished"
      :suppress-load-more="suppressLoadMore"
      @scroll="onListScroll"
      @load-more="emit('load-more')"
    >
      <template #default="slotProps">
        <slot v-bind="slotProps" />
      </template>
    </VirtualList>
  </div>
</template>

<style scoped lang="scss">
.h5-fullscreen-pager {
  flex: 1;
  min-height: 0;
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
}

.h5-fullscreen-pager :deep(.virtual-list) {
  flex: 1;
  min-height: 0;
  height: 100%;
}

.h5-fullscreen-pager--snap-off :deep(.virtual-list) {
  scroll-snap-type: none !important;
  overflow: hidden;
}
</style>
