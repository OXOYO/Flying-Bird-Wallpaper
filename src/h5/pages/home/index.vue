<script setup>
import UseSettingStore from '@h5/stores/settingStore.js'
import * as api from '@h5/api/index.js'
import { vibrate } from '@h5/utils/index.js'
import { showImagePreview, showNotify } from 'vant'
import { useTranslation } from 'i18next-vue'

const { t } = useTranslation()
const settingStore = UseSettingStore()
// 直接使用 settingStore 中的数据
const settingData = ref(settingStore.settingData)

const imageSliderRef = ref(null)

// 图片列表
const imageList = ref([])

const pageInfo = {
  startPage: 1,
  pageSize: 10
}

// 在 script setup 部分修改状态变量
const flags = reactive({
  // 下拉刷新状态
  refreshing: false,
  // List 组件加载状态
  loading: false,
  // List 组件是否加载完成
  finished: false,
  // 是否正在动画
  isAnimating: false
})

// 当前偏移量（用于滑动）
const offsetY = ref(0)

// 触摸起始位置
const startY = ref(0)

// 当前显示的图片索引
const currentIndex = ref(0)

// 存储扩展后的间隔时间数组
const extendedIntervals = ref(null)
// 倒计时
const countdown = ref(settingData.value.h5SwitchIntervalTime)

// 用于处理双击事件
const lastClickTime = ref(0)
const clickTimer = ref(null)

// 定时器
let autoSwitchTimer = null
let countdownTimer = null

// 是否随机
const isRandom = computed(() => {
  // 1:随机 2:顺序
  return settingData.value.h5SwitchType === 1
})

// 是否收藏当前图片
const isFavorite = computed(() => {
  return imageList.value[currentIndex.value]?.isFavorite
})

const imageItemStyle = computed(() => {
  return {
    'background-size': settingData.value.h5ImageDisplaySize === 'cover' ? 'cover' : 'contain'
  }
})

const floatingButtonsStyle = computed(() => {
  let ret = {}
  if (settingData.value.h5FloatingButtonPosition === 'right') {
    ret = {
      right: '20px'
    }
  } else {
    ret = {
      left: '20px'
    }
  }
  return ret
})

watch(
  () => settingStore.settingData,
  (newVal) => {
    settingData.value = newVal
  }
)

const init = async () => {
  initFlag()
  initPageInfo()
  imageList.value = []
  currentIndex.value = 0
  offsetY.value = 0
  startY.value = 0
  // 重置倒计时
  countdown.value = settingData.value.h5SwitchIntervalTime
  // 重置扩展间隔时间数组
  extendedIntervals.value = null
  const h5AutoSwitch = settingData.value.h5AutoSwitch
  stopAutoSwitch()
  // 加载数据
  flags.loading = true
  await loadData()
  flags.loading = false
  // 处理默认自动播放
  if (h5AutoSwitch) {
    startAutoSwitch()
  }
}

const initFlag = () => {
  flags.refreshing = false
  flags.finished = false
  flags.loading = false
  flags.isAnimating = false
}

const initPageInfo = () => {
  pageInfo.startPage = 1
  pageInfo.pageSize = 10
}

// 加载更多图片
const onLoad = async () => {
  if (flags.finished || !imageList.value.length) return
  flags.loading = true
  pageInfo.startPage += 1
  await loadData()
  flags.loading = false
}

// 刷新数据
const onRefresh = async () => {
  flags.refreshing = true
  imageList.value = []
  currentIndex.value = 0
  pageInfo.startPage = 1
  offsetY.value = 0
  flags.finished = false
  await loadData(true)
  flags.refreshing = false
}

const loadData = async (isRefresh) => {
  const payload = {
    ...pageInfo,
    resourceType: 'localResource',
    resourceName: settingData.value.h5Resource,
    // 是否随机
    isRandom: isRandom.value,
    orientation: settingData.value.h5Orientation.toString(),
    quality: settingData.value.h5Quality.toString(),
    sortField: settingData.value.h5SortField,
    sortType: settingData.value.h5SortType
  }

  const res = await api.searchImages(payload)
  if (res?.success && res?.data?.list.length > 0) {
    imageList.value = (isRefresh ? res.data.list : [...imageList.value, ...res.data.list]).map(
      (item) => {
        return {
          ...item,
          url: `/api/images/get?src=${encodeURIComponent(item.filePath)}`
        }
      }
    )
    if (res.data.list.length < pageInfo.pageSize) {
      flags.finished = true
    }
  } else {
    flags.finished = true
  }
  if (flags.finished) {
    stopAutoSwitch()
    showNotify({
      type: 'warning',
      message: t('messages.noMoreData')
    })
    return
  }
}

// 触摸开始
const onTouchStart = (event) => {
  if (flags.isAnimating) return
  startY.value = event.touches[0].clientY

  if (settingData.value.h5AutoSwitch) {
    stopAutoSwitch() // 直接调用停止函数，不改变状态
  }
}

// 触摸移动
const onTouchMove = (event) => {
  if (flags.isAnimating) return
  const clientHeight = imageSliderRef.value.clientHeight
  const deltaY = event.touches[0].clientY - startY.value
  offsetY.value = -currentIndex.value * clientHeight + deltaY
}

// 触摸结束
const onTouchEnd = (event) => {
  if (flags.isAnimating) return
  const deltaY = event.changedTouches[0].clientY - startY.value

  // 判断滑动方向
  if (Math.abs(deltaY) > 50) {
    if (deltaY > 0 && currentIndex.value > 0) {
      // 向下滑动，显示上一张
      currentIndex.value -= 1
    } else if (deltaY < 0 && currentIndex.value < imageList.value.length - 1) {
      // 向上滑动，显示下一张
      currentIndex.value += 1

      // 如果滑动到倒数第3张，且还有更多数据，则提前加载更多
      if (currentIndex.value >= imageList.value.length - 3 && !flags.finished && !flags.loading) {
        onLoad()
      }
    }
  }

  // 滑动到目标位置
  flags.isAnimating = true
  const clientHeight = imageSliderRef.value.clientHeight
  offsetY.value = -currentIndex.value * clientHeight
  setTimeout(() => {
    flags.isAnimating = false
  }, 300)

  // 检查是否已经到达最后一张且已加载完所有数据
  if (
    currentIndex.value === imageList.value.length - 1 &&
    flags.finished &&
    settingData.value.h5AutoSwitch
  ) {
    stopAutoSwitch()
    showNotify({
      type: 'warning',
      message: t('messages.noMoreData')
    })
    return
  }
}

// 启停自动翻页
const toggleAutoSwitch = async () => {
  // 确保在设置状态后再启动自动翻页
  if (settingData.value.h5AutoSwitch) {
    stopAutoSwitch()
  } else {
    startAutoSwitch()
  }
  await onSettingDataChange({
    h5AutoSwitch: settingData.value.h5AutoSwitch
  })
}

// 开始自动翻页
const startAutoSwitch = () => {
  settingData.value.h5AutoSwitch = true
  // 如果已经到达最后一张且已加载完所有数据，则不启动自动翻页
  if (currentIndex.value === imageList.value.length - 1 && flags.finished) {
    stopAutoSwitch()
    showNotify({
      type: 'warning',
      message: t('messages.noMoreData')
    })
    return
  }

  countdown.value = settingData.value.h5SwitchIntervalTime // 重置倒计时
  startCountdown() // 启动倒计时

  autoSwitchTimer = setInterval(async () => {
    const clientHeight = imageSliderRef.value.clientHeight
    if (currentIndex.value < imageList.value.length - 1) {
      currentIndex.value += 1
      offsetY.value = -currentIndex.value * clientHeight
      countdown.value = settingData.value.h5SwitchIntervalTime // 重置倒计时
      startCountdown() // 重新启动倒计时

      // 如果滑动到倒数第3张，且还有更多数据，则提前加载更多
      if (currentIndex.value >= imageList.value.length - 3 && !flags.finished && !flags.loading) {
        stopCountdown() // 暂停倒计时
        await onLoad() // 等待加载完成
        startCountdown() // 恢复倒计时
      }
    } else if (!flags.finished) {
      // 如果当前是最后一张且未加载完成，则触发加载更多
      stopCountdown() // 暂停倒计时
      await onLoad()
      if (currentIndex.value < imageList.value.length - 1) {
        currentIndex.value += 1
        offsetY.value = -currentIndex.value * clientHeight
        countdown.value = settingData.value.h5SwitchIntervalTime // 重置倒计时
        startCountdown() // 重新启动倒计时
      } else {
        startCountdown() // 如果没有新图片，也要恢复倒计时
      }
    } else {
      stopAutoSwitch() // 如果已经加载完成，则停止自动翻页
      showNotify({
        type: 'warning',
        message: t('messages.noMoreData')
      })
    }
  }, settingData.value.h5SwitchIntervalTime * 1000)
}

// 停止自动翻页
const stopAutoSwitch = () => {
  settingData.value.h5AutoSwitch = false
  if (autoSwitchTimer) {
    clearInterval(autoSwitchTimer)
    autoSwitchTimer = null
  }
  stopCountdown()
}

// 开始倒计时
const startCountdown = () => {
  if (countdownTimer) {
    clearInterval(countdownTimer) // 清除之前的倒计时
  }
  countdownTimer = setInterval(() => {
    if (countdown.value > 0) {
      countdown.value -= 1
    } else {
      clearInterval(countdownTimer)
      countdownTimer = null
    }
  }, 1000)
}

// 停止倒计时
const stopCountdown = () => {
  if (countdownTimer) {
    clearInterval(countdownTimer)
    countdownTimer = null
  }
}

// 切换翻页等待时长
const changeSwitchIntervalTime = async () => {
  // 固定的间隔时间数组
  const fixedIntervals = [3, 6, 9, 12]

  // 获取当前设置的间隔时间
  const currentTime = settingData.value.h5SwitchIntervalTime

  // 初始化扩展间隔数组
  if (!extendedIntervals.value) {
    // 第一次初始化扩展间隔数组
    extendedIntervals.value = [...fixedIntervals]

    // 如果当前值不在固定数组中，则添加到扩展数组
    if (!fixedIntervals.includes(currentTime)) {
      extendedIntervals.value.push(currentTime)
      extendedIntervals.value.sort((a, b) => a - b) // 按数值大小排序
    }
  }

  // 找到当前值的索引
  const currentIndex = extendedIntervals.value.indexOf(currentTime)

  // 计算下一个值的索引（循环）
  const nextIndex = (currentIndex + 1) % extendedIntervals.value.length

  // 获取下一个间隔时间
  const h5SwitchIntervalTime = extendedIntervals.value[nextIndex]

  // 重置倒计时
  countdown.value = h5SwitchIntervalTime

  settingData.value.h5SwitchIntervalTime = h5SwitchIntervalTime

  await onSettingDataChange({
    h5SwitchIntervalTime
  })

  // 如果自动翻页已开启，则重新启动
  if (settingData.value.h5AutoSwitch) {
    stopAutoSwitch()
    startAutoSwitch()
  }
}

// 处理收藏按钮点击
const handleFavoriteClick = async () => {
  const currentTime = new Date().getTime()
  const timeDiff = currentTime - lastClickTime.value

  // 清除任何现有的定时器
  if (clickTimer.value) {
    clearTimeout(clickTimer.value)
    clickTimer.value = null
  }

  if (timeDiff < 300) {
    // 双击 - 取消收藏
    await onRemoveFavorites()
    lastClickTime.value = 0 // 重置点击时间
  } else {
    // 第一次点击 - 设置定时器等待可能的第二次点击
    lastClickTime.value = currentTime
    clickTimer.value = setTimeout(async () => {
      // 如果没有第二次点击，执行单击操作（添加收藏）
      await onAddToFavorites()
      clickTimer.value = null
    }, 300)
  }
}

// 单击加入收藏
const onAddToFavorites = async () => {
  const currentImage = imageList.value[currentIndex.value]
  if (!currentImage) {
    return
  }
  const res = await api.addToFavorites(currentImage.id)
  if (res.success) {
    currentImage.isFavorite = true
    vibrate()
  }
}

// 双击取消收藏
const onRemoveFavorites = async () => {
  const currentImage = imageList.value[currentIndex.value]
  if (!currentImage) {
    return
  }
  const res = await api.removeFavorites(currentImage.id)
  if (res.success) {
    currentImage.isFavorite = false
    vibrate()
  }
}

// 切换图片大小
const toggleImageDisplaySize = () => {
  stopAutoSwitch()

  settingData.value.h5ImageDisplaySize =
    settingData.value.h5ImageDisplaySize === 'cover' ? 'contain' : 'cover'

  onSettingDataChange({
    h5ImageDisplaySize: settingData.value.h5ImageDisplaySize,
    h5AutoSwitch: settingData.value.h5AutoSwitch
  })
}

// 切换随机模式
const toggleRandom = async () => {
  // 切换随机模式时关闭自动翻页
  stopAutoSwitch()
  // 切换随机模式
  settingData.value.h5SwitchType = settingData.value.h5SwitchType === 1 ? 2 : 1
  await onSettingDataChange({
    h5SwitchType: settingData.value.h5SwitchType,
    h5AutoSwitch: settingData.value.h5AutoSwitch
  })
  await onRefresh()
}

// 双击预览图片
const onPreviewImage = async (index) => {
  // 关闭自动翻页
  stopAutoSwitch()
  showImagePreview({
    images: imageList.value.map((item) => item.url),
    startPosition: index,
    maxZoom: 100,
    minZoom: 1 / 3
  })
}

const onSettingDataChange = async (payload) => {
  if (!payload) {
    return
  }
  await settingStore.h5UpdateSettingData(payload)
}

defineExpose({
  init
})

// 初始化加载数据
onMounted(() => {
  // 监听页面可见性变化
  document.addEventListener('visibilitychange', handleVisibilityChange)

  // 监听设备锁屏/解锁事件（iOS和Android）
  window.addEventListener('pagehide', handlePageHide)
  window.addEventListener('pageshow', handlePageShow)
})

// 组件卸载时停止自动翻页并移除事件监听
onUnmounted(() => {
  // 确保清除所有定时器
  if (autoSwitchTimer) {
    clearInterval(autoSwitchTimer)
    autoSwitchTimer = null
  }
  if (countdownTimer) {
    clearInterval(countdownTimer)
    countdownTimer = null
  }

  // 移除事件监听
  document.removeEventListener('visibilitychange', handleVisibilityChange)
  window.removeEventListener('pagehide', handlePageHide)
  window.removeEventListener('pageshow', handlePageShow)
})

// 处理页面可见性变化
const handleVisibilityChange = () => {
  if (document.hidden) {
    // 页面不可见，暂停自动翻页
    if (settingData.value.h5AutoSwitch) {
      stopAutoSwitch()
    }
  }
}

// 处理页面隐藏事件（可能是锁屏或切换应用）
const handlePageHide = () => {
  if (settingData.value.h5AutoSwitch) {
    stopAutoSwitch()
  }
}

// 处理页面显示事件（可能是解锁或切回应用）
const handlePageShow = () => {}
</script>

<template>
  <div class="page-wrapper page-home">
    <!-- 图片滑动容器 -->
    <div
      ref="imageSliderRef"
      class="image-slider"
      @touchstart="onTouchStart"
      @touchmove="onTouchMove"
      @touchend="onTouchEnd"
    >
      <!-- 图片列表 -->
      <div class="image-container" :style="{ transform: `translateY(${offsetY}px)` }">
        <!-- 使用 List 组件加载更多 -->
        <van-list
          v-model:loading="flags.loading"
          :finished="flags.finished"
          :finished-text="t('messages.noMoreData')"
          @load="onLoad"
        >
          <!-- 每张图片 -->
          <div
            v-for="(item, index) in imageList"
            :key="item.id"
            v-lazy:background-image="item.url"
            class="image-item"
            :style="imageItemStyle"
            @dblclick="onPreviewImage(index)"
          ></div>
        </van-list>
      </div>
    </div>
  </div>

  <!-- 浮动按钮 -->
  <div class="floating-buttons" :style="floatingButtonsStyle">
    <!-- 启停自动翻页 -->
    <div
      class="floating-button"
      :class="{ 'progress-button': settingData.h5AutoSwitch }"
      :style="{ '--animation-duration': settingData.h5SwitchIntervalTime + 's' }"
      @click="toggleAutoSwitch"
    >
      <IconifyIcon
        class="floating-button-icon"
        :icon="settingData.h5AutoSwitch ? 'ri:pause-fill' : 'ri:play-fill'"
      />
    </div>

    <!-- 切换翻页等待时长 -->
    <div class="floating-button" @click="changeSwitchIntervalTime">
      {{ settingData.h5AutoSwitch ? countdown : settingData.h5SwitchIntervalTime }}s
    </div>

    <!-- 切换随机模式 -->
    <div class="floating-button" @click="toggleRandom">
      <IconifyIcon
        class="floating-button-icon"
        :icon="isRandom ? 'ri:shuffle-line' : 'ri:repeat-line'"
      />
    </div>

    <!-- 收藏图片 -->
    <div class="floating-button" @click="handleFavoriteClick">
      <IconifyIcon
        class="floating-button-icon"
        :icon="currentImage?.isFavorite ? 'ri:star-fill' : 'ri:star-line'"
        :style="{ color: isFavorite ? 'gold' : '' }"
      />
    </div>

    <!-- 切换背景大小 -->
    <div class="floating-button" @click="toggleImageDisplaySize">
      <IconifyIcon
        class="floating-button-icon"
        :icon="
          settingData.h5ImageDisplaySize === 'cover'
            ? 'ri:collapse-diagonal-line'
            : 'ri:expand-diagonal-line'
        "
      />
    </div>
  </div>
</template>

<style scoped lang="scss">
.page-home {
  background-color: #333;
}
.image-slider {
  width: 100%;
  height: calc(100vh - var(--van-tabbar-height));
  overflow: hidden;
  position: relative;
}

.image-container {
  transition: transform 0.3s ease;
}

.image-item {
  width: 100%;
  height: calc(100vh - var(--van-tabbar-height));
  background-size: cover;
  background-position: center;
  background-repeat: no-repeat;
}

.floating-buttons {
  position: fixed;
  bottom: calc(50px + var(--van-tabbar-height));
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.floating-button {
  width: 40px;
  height: 40px;
  line-height: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: rgba(0, 0, 0, 0.5);
  color: white;
  border: none;
  border-radius: 50%;
  position: relative;
  overflow: hidden;
  cursor: pointer;

  &:active {
    .floating-button-icon {
      transform: scale(1.2);
    }
  }
}

.floating-button-icon {
  transition: transform 0.3s ease-out;
  color: white;
  font-size: 24px;
}

/* 自定义按钮样式 */
.progress-button {
}

/* 进度条遮罩 */
.progress-button::before {
  content: '';
  position: absolute;
  width: 100%;
  height: 100%;
  background: conic-gradient(transparent 0%, #007bff 100%);
  border-radius: 50%;
  mask: radial-gradient(transparent 50%, black 80%); /* 使用 mask 实现遮罩 */
  top: 0;
  left: 0;
  opacity: 1;
  transform: translate(0, 0);
  animation: rotate var(--animation-duration, 3s) linear infinite;
}

/* 动画类 */
@keyframes rotate {
  0% {
    transform: rotate(0deg);
  }
  100% {
    transform: rotate(360deg);
  }
}
</style>
