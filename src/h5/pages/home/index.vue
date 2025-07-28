<script setup>
import UseCommonStore from '@h5/stores/commonStore.js'
import UseSettingStore from '@h5/stores/settingStore.js'
import * as api from '@h5/api/index.js'
import { showNotify, showConfirmDialog } from 'vant'
import { useTranslation } from 'i18next-vue'
import { infoKeys } from '@common/publicData.js'
import { handleInfoVal } from '@common/utils.js'

const { t } = useTranslation()
const commonStore = UseCommonStore()
const settingStore = UseSettingStore()
// 直接使用 settingStore 中的数据
const settingData = ref(settingStore.settingData)
const { tabbarVisible } = storeToRefs(commonStore)

const imageSliderRef = ref(null)

const flags = reactive({
  // 下拉刷新状态
  refreshing: false,
  // List 组件加载状态
  loading: false,
  // List 组件是否加载完成
  finished: false,
  // 是否正在动画
  isAnimating: false,
  // 是否正在长按收藏
  isFavoriteHolding: false,
  // 长按收藏显示提示动效
  showFavoriteToast: false,
  // 是否操作弹层
  showActionPopup: false,
  // 是否显示图片信息弹层
  showImageInfoPopup: false
})

const pageInfo = {
  startPage: 1,
  pageSize: 10
}

// 滑动位置
const touchPosition = reactive({
  // 触摸起始位置
  startY: 0,
  // 滑动偏移量
  offsetY: 0
})

// 自动切换相关状态
const autoSwitch = reactive({
  switchTimer: null,
  countdownTimer: null,
  countdown: settingData.value.h5SwitchIntervalTime,
  // 扩展的间隔时间数组
  intervals: null,
  // 当前显示的图片索引
  currentIndex: 0,
  // 图片列表
  imageList: [],
  // 总数
  total: 0
})

// 收藏双击相关状态
const favoriteClick = reactive({
  lastClickTime: 0,
  timer: null,
  startTime: 0,
  startX: 0,
  startY: 0
})

// 长按相关状态
const longPress = reactive({
  timer: null,
  selectedIndex: null
})

// 收藏长按相关状态
const favoriteHold = reactive({
  timer: null,
  count: 0,
  interval: null
})

// 标签栏切换相关状态
const tabbarBtnTouch = reactive({
  lastTapTime: 0,
  timer: null
})

// 是否随机
const isRandom = computed(() => {
  // 1:随机 2:顺序
  return settingData.value.h5SwitchType === 1
})

// 是否收藏当前图片
const isFavorite = computed(() => {
  return autoSwitch.imageList[autoSwitch.currentIndex]?.isFavorite
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
  const index = autoSwitch.currentIndex
  if (imageScales[index]?.scaling) {
    ret.display = 'none'
  }

  return ret
})

watch(
  () => settingStore.settingData,
  (newValue) => {
    settingData.value = newValue
    if (settingData.value.h5AutoSwitch) {
      stopAutoSwitch()
      startAutoSwitch()
    } else {
      stopAutoSwitch()
    }
  }
)

const init = async () => {
  initFlag()
  initPageInfo()
  initTouchPosition()
  initAutoSwitch()
  initFavoriteClick()
  initLongPress()
  initFavoriteHold()
  initImageTouch()

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
  flags.loading = false
  flags.finished = false
  flags.isAnimating = false
  flags.isFavoriteHolding = false
  flags.showFavoriteToast = false
  flags.showActionPopup = false
  flags.showImageInfoPopup = false
}

const initPageInfo = () => {
  pageInfo.startPage = 1
  pageInfo.pageSize = 10
}

const initTouchPosition = () => {
  touchPosition.startY = 0
  touchPosition.offsetY = 0
}

const initAutoSwitch = () => {
  autoSwitch.switchTimer = null
  autoSwitch.countdownTimer = null
  autoSwitch.countdown = settingData.value.h5SwitchIntervalTime
  autoSwitch.intervals = null
  autoSwitch.currentIndex = 0
  autoSwitch.imageList = []
  autoSwitch.total = 0
}

const initFavoriteClick = () => {
  favoriteClick.lastClickTime = 0
  favoriteClick.timer = null
}

const initLongPress = () => {
  longPress.timer = null
  longPress.selectedIndex = null
}

const initFavoriteHold = () => {
  favoriteHold.timer = null
  favoriteHold.count = 0
  favoriteHold.interval = null
}

// 初始化图片触摸状态
const initImageTouch = () => {
  imageTouch.lastTapTime = 0
  imageTouch.startX = 0
  imageTouch.startY = 0
  imageTouch.timer = null
}

// 加载更多图片
const onLoad = async () => {
  if (flags.finished || !autoSwitch.imageList.length) return
  flags.loading = true
  pageInfo.startPage += 1
  await loadData()
  flags.loading = false
}

// 刷新数据
const onRefresh = async () => {
  flags.refreshing = true
  autoSwitch.imageList = []
  autoSwitch.currentIndex = 0
  pageInfo.startPage = 1
  touchPosition.offsetY = 0
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
    const width = imageSliderRef.value.clientWidth
    // 拼接后用 id 去重
    const newList = isRefresh ? res.data.list : [...autoSwitch.imageList, ...res.data.list]
    const uniqueList = []
    const idSet = new Set()
    for (const item of newList) {
      if (!idSet.has(item.id)) {
        const rawUrl = `/api/images/get?filePath=${encodeURIComponent(item.filePath)}`
        uniqueList.push({
          ...item,
          rawUrl,
          src: settingData.value.h5ImageCompress
            ? `${rawUrl}&w=${width}&compressStartSize=${settingData.value.h5ImageCompressStartSize}`
            : rawUrl
        })
        idSet.add(item.id)
      }
    }
    autoSwitch.imageList = uniqueList
    // 保存 total
    autoSwitch.total = res.data.total || autoSwitch.imageList.length
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
  const index = autoSwitch.currentIndex
  if (imageScales[index]?.scaling) return // 放大时禁止滑动
  touchPosition.startY = event.touches[0].clientY

  if (settingData.value.h5AutoSwitch) {
    stopAutoSwitch() // 直接调用停止函数，不改变状态
  }
}

// 触摸移动
const onTouchMove = (event) => {
  if (flags.isAnimating) return
  const index = autoSwitch.currentIndex
  if (imageScales[index]?.scaling) return
  const clientHeight = imageSliderRef.value.clientHeight
  const deltaY = event.touches[0].clientY - touchPosition.startY
  touchPosition.offsetY = -autoSwitch.currentIndex * clientHeight + deltaY
}

// 触摸结束
const onTouchEnd = (event) => {
  if (flags.isAnimating) return
  const index = autoSwitch.currentIndex
  if (imageScales[index]?.scaling) return
  const deltaY = event.changedTouches[0].clientY - touchPosition.startY

  // 判断滑动方向
  if (Math.abs(deltaY) > 50) {
    if (deltaY > 0 && autoSwitch.currentIndex === 0) {
      showNotify({
        type: 'warning',
        message: t('messages.noMoreData')
      })
    } else if (deltaY > 0 && autoSwitch.currentIndex > 0) {
      // 向下滑动，显示上一张
      autoSwitch.currentIndex -= 1
    } else if (deltaY < 0 && autoSwitch.currentIndex < autoSwitch.imageList.length - 1) {
      // 向上滑动，显示下一张
      autoSwitch.currentIndex += 1

      // 如果滑动到倒数第3张，且还有更多数据，则提前加载更多
      if (
        autoSwitch.currentIndex >= autoSwitch.imageList.length - 3 &&
        !flags.finished &&
        !flags.loading
      ) {
        onLoad()
      }
    }
  }

  // 滑动到目标位置
  flags.isAnimating = true
  const clientHeight = imageSliderRef.value.clientHeight
  touchPosition.offsetY = -autoSwitch.currentIndex * clientHeight
  setTimeout(() => {
    flags.isAnimating = false
  }, 200)

  // 检查是否已经到达最后一张且已加载完所有数据
  if (
    autoSwitch.currentIndex === autoSwitch.imageList.length - 1 &&
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
  if (autoSwitch.currentIndex === autoSwitch.imageList.length - 1 && flags.finished) {
    stopAutoSwitch()
    showNotify({
      type: 'warning',
      message: t('messages.noMoreData')
    })
    return
  }

  autoSwitch.countdown = settingData.value.h5SwitchIntervalTime // 重置倒计时
  startCountdown() // 启动倒计时

  autoSwitch.switchTimer = setInterval(async () => {
    const clientHeight = imageSliderRef.value.clientHeight
    if (autoSwitch.currentIndex < autoSwitch.imageList.length - 1) {
      autoSwitch.currentIndex += 1
      touchPosition.offsetY = -autoSwitch.currentIndex * clientHeight
      autoSwitch.countdown = settingData.value.h5SwitchIntervalTime // 重置倒计时
      startCountdown() // 重新启动倒计时

      // 如果滑动到倒数第3张，且还有更多数据，则提前加载更多
      if (
        autoSwitch.currentIndex >= autoSwitch.imageList.length - 3 &&
        !flags.finished &&
        !flags.loading
      ) {
        stopCountdown() // 暂停倒计时
        await onLoad() // 等待加载完成
        startCountdown() // 恢复倒计时
      }
    } else if (!flags.finished) {
      // 如果当前是最后一张且未加载完成，则触发加载更多
      stopCountdown() // 暂停倒计时
      await onLoad()
      if (autoSwitch.currentIndex < autoSwitch.imageList.length - 1) {
        autoSwitch.currentIndex += 1
        touchPosition.offsetY = -autoSwitch.currentIndex * clientHeight
        autoSwitch.countdown = settingData.value.h5SwitchIntervalTime // 重置倒计时
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
  if (autoSwitch.switchTimer) {
    clearInterval(autoSwitch.switchTimer)
    autoSwitch.switchTimer = null
  }
  stopCountdown()
}

// 开始倒计时
const startCountdown = () => {
  if (autoSwitch.countdownTimer) {
    clearInterval(autoSwitch.countdownTimer) // 清除之前的倒计时
  }
  autoSwitch.countdownTimer = setInterval(() => {
    if (autoSwitch.countdown > 0) {
      autoSwitch.countdown -= 1
    } else {
      clearInterval(autoSwitch.countdownTimer)
      autoSwitch.countdownTimer = null
    }
  }, 1000)
}

// 停止倒计时
const stopCountdown = () => {
  if (autoSwitch.countdownTimer) {
    clearInterval(autoSwitch.countdownTimer)
    autoSwitch.countdownTimer = null
  }
}

// 切换翻页等待时长
const changeSwitchIntervalTime = async () => {
  // 固定的间隔时间数组
  const fixedIntervals = [3, 6, 9, 12]

  // 获取当前设置的间隔时间
  const currentTime = settingData.value.h5SwitchIntervalTime

  // 初始化扩展间隔数组
  if (!autoSwitch.intervals) {
    // 第一次初始化扩展间隔数组
    autoSwitch.intervals = [...fixedIntervals]

    // 如果当前值不在固定数组中，则添加到扩展数组
    if (!fixedIntervals.includes(currentTime)) {
      autoSwitch.intervals.push(currentTime)
      autoSwitch.intervals.sort((a, b) => a - b) // 按数值大小排序
    }
  }

  // 找到当前值的索引
  const currentIndex = autoSwitch.intervals.indexOf(currentTime)

  // 计算下一个值的索引（循环）
  const nextIndex = (currentIndex + 1) % autoSwitch.intervals.length

  // 获取下一个间隔时间
  const h5SwitchIntervalTime = autoSwitch.intervals[nextIndex]

  // 重置倒计时
  autoSwitch.countdown = h5SwitchIntervalTime

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

// 处理收藏按钮触摸事件
const handleFavoriteTouchStart = (event) => {
  // 记录触摸开始时间和位置
  favoriteClick.startTime = new Date().getTime()
  favoriteClick.startX = event.touches[0].clientX
  favoriteClick.startY = event.touches[0].clientY

  // 设置长按定时器
  favoriteHold.timer = setTimeout(() => {
    // 标记为长按状态
    flags.isFavoriteHolding = true
    // 重置计数
    favoriteHold.count = 0
    // 长按开始后，启动计数间隔
    favoriteHold.interval = setInterval(() => {
      // 添加最大值限制
      if (favoriteHold.count < 100) {
        favoriteHold.count++
        flags.showFavoriteToast = true
        settingStore.vibrate(Math.min(Math.max(10, favoriteHold.count), 100))
      } else {
        // 达到最大值时停止计数并提示用户
        clearInterval(favoriteHold.interval)
        favoriteHold.interval = null
        flags.showFavoriteToast = false
        showNotify({
          type: 'warning',
          message: t('messages.maxFavoriteCountReached')
        })
      }
    }, 200) // 每200毫秒增加一次计数
  }, 800) // 800毫秒后开始计数
}

const handleFavoriteTouchMove = (event) => {
  // 如果手指移动超过一定距离，取消所有操作
  const moveX = event.touches[0].clientX - favoriteClick.startX
  const moveY = event.touches[0].clientY - favoriteClick.startY
  const moveDistance = Math.sqrt(moveX * moveX + moveY * moveY)

  if (moveDistance > 10) {
    // 10像素的移动阈值
    // 清除长按定时器
    if (favoriteHold.timer) {
      clearTimeout(favoriteHold.timer)
      favoriteHold.timer = null
    }

    // 清除长按计数间隔
    if (favoriteHold.interval) {
      clearInterval(favoriteHold.interval)
      favoriteHold.interval = null
    }

    // 重置状态
    flags.isFavoriteHolding = false
    flags.showFavoriteToast = false
    favoriteHold.count = 0
  }
}

const handleFavoriteTouchEnd = async () => {
  // 计算触摸持续时间
  const touchDuration = new Date().getTime() - favoriteClick.startTime

  // 清除长按定时器
  if (favoriteHold.timer) {
    clearTimeout(favoriteHold.timer)
    favoriteHold.timer = null
  }

  // 如果是长按状态且计数大于0，则更新收藏数据
  if (flags.isFavoriteHolding && favoriteHold.count > 0) {
    const currentImage = autoSwitch.imageList[autoSwitch.currentIndex]
    if (!currentImage) return
    const res = await api.updateFavoriteCount(currentImage.id, favoriteHold.count)
    if (res.success) {
      // 更新本地数据
      currentImage.favoriteCount = (currentImage.favoriteCount || 0) + favoriteHold.count
      currentImage.isFavorite = true
    }

    // 清除长按计数间隔
    if (favoriteHold.interval) {
      clearInterval(favoriteHold.interval)
      favoriteHold.interval = null
    }

    // 重置状态
    flags.isFavoriteHolding = false
    flags.showFavoriteToast = false
    favoriteHold.count = 0
    return
  }

  // 如果不是长按，且触摸时间小于300ms，则处理点击
  if (touchDuration < 300) {
    const currentTime = new Date().getTime()
    const timeDiff = currentTime - favoriteClick.lastClickTime

    // 清除任何现有的定时器
    if (favoriteClick.timer) {
      clearTimeout(favoriteClick.timer)
      favoriteClick.timer = null
    }

    if (timeDiff < 300) {
      // 双击 - 取消收藏
      await onRemoveFavorites()
      favoriteClick.lastClickTime = 0 // 重置点击时间
    } else {
      // 第一次点击 - 设置定时器等待可能的第二次点击
      favoriteClick.lastClickTime = currentTime
      favoriteClick.timer = setTimeout(async () => {
        // 如果没有第二次点击，执行单击操作（添加收藏）
        await onAddToFavorites()
        favoriteClick.timer = null
      }, 300)
    }
  }
}

// 单击加入收藏
const onAddToFavorites = async () => {
  const currentImage = autoSwitch.imageList[autoSwitch.currentIndex]
  if (!currentImage) {
    return
  }
  const res = await api.addToFavorites(currentImage.id)
  if (res.success) {
    currentImage.isFavorite = true
    flags.showFavoriteToast = true
    settingStore.vibrate(() => {
      flags.showFavoriteToast = false
    })
  }
}

// 双击取消收藏
const onRemoveFavorites = async () => {
  const currentImage = autoSwitch.imageList[autoSwitch.currentIndex]
  if (!currentImage) {
    return
  }
  const res = await api.removeFavorites(currentImage.id)
  if (res.success) {
    currentImage.isFavorite = false
    settingStore.vibrate()
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

// 图片项触摸相关状态
const imageTouch = reactive({
  lastTapTime: 0,
  startX: 0,
  startY: 0,
  timer: null
})

// 记录每个图片的缩放状态、中心点和拖动偏移
// 新增 pinchScale、pinchStartDist、pinchLastScale
const imageScales = reactive({}) // { [index]: { count, origin, offsetX, offsetY, lastX, lastY, dragging, pinchScale, pinchStartDist, pinchLastScale } }

// 图片项触摸开始 - 统一处理函数
const handleImageTouchStart = (index, event) => {
  const touches = event.touches
  // 放大状态下
  if (imageScales[index]?.scaling) {
    if (touches.length === 2) {
      // 双指缩放
      const dx = touches[0].clientX - touches[1].clientX
      const dy = touches[0].clientY - touches[1].clientY
      imageScales[index].pinchStartDist = Math.sqrt(dx * dx + dy * dy)
      imageScales[index].pinchLastScale =
        imageScales[index].pinchScale || 1 + imageScales[index].count
    } else {
      // 单指拖动
      const touch = touches[0]
      imageScales[index].dragging = true
      imageScales[index].lastX = touch.clientX
      imageScales[index].lastY = touch.clientY
      imageTouch.startX = touch.clientX
      imageTouch.startY = touch.clientY
    }
    return
  }
  // 设置长按定时器
  if (touches.length === 1) {
    // 普通点击
    imageTouch.startX = event.touches[0].clientX
    imageTouch.startY = event.touches[0].clientY
    longPress.timer = setTimeout(() => {
      longPress.selectedIndex = index
      flags.showActionPopup = true
      settingStore.vibrate()
    }, 500)
  }
}

// 图片项触摸移动 - 统一处理函数
const handleImageTouchMove = (index, event) => {
  const touches = event.touches
  if (imageScales[index]?.scaling) {
    if (touches.length === 2) {
      // 双指缩放
      const dx = touches[0].clientX - touches[1].clientX
      const dy = touches[0].clientY - touches[1].clientY
      const dist = Math.sqrt(dx * dx + dy * dy)
      const startDist = imageScales[index].pinchStartDist || dist
      let scale =
        (dist / startDist) * (imageScales[index].pinchLastScale || 1 + imageScales[index].count)
      // 限制缩放范围
      scale = Math.max(0.5, Math.min(10, scale))
      imageScales[index].pinchScale = scale
      event.preventDefault()
      return
    } else if (imageScales[index].dragging) {
      // 单指拖动
      const touch = touches[0]
      const dx = touch.clientX - imageScales[index].lastX
      const dy = touch.clientY - imageScales[index].lastY
      imageScales[index].offsetX = (imageScales[index].offsetX || 0) + dx
      imageScales[index].offsetY = (imageScales[index].offsetY || 0) + dy
      imageScales[index].lastX = touch.clientX
      imageScales[index].lastY = touch.clientY
      event.preventDefault()
      return
    }
  }
  // 计算移动距离
  const moveX = event.touches[0].clientX - imageTouch.startX
  const moveY = event.touches[0].clientY - imageTouch.startY
  const moveDistance = Math.sqrt(moveX * moveX + moveY * moveY)
  // 如果移动距离超过阈值，取消长按和双击操作
  if (moveDistance > 10) {
    // 清除长按定时器
    if (longPress.timer) {
      clearTimeout(longPress.timer)
      longPress.timer = null
    }
    // 清除双击定时器
    if (imageTouch.timer) {
      clearTimeout(imageTouch.timer)
      imageTouch.timer = null
    }
  }
}

// 图片项触摸结束 - 统一处理函数
const handleImageTouchEnd = (index, event) => {
  if (imageScales[index]?.scaling) {
    imageScales[index].dragging = false
    imageScales[index].pinchStartDist = undefined
    imageScales[index].pinchLastScale = undefined
  }
  if (longPress.timer) {
    clearTimeout(longPress.timer)
    longPress.timer = null
  }
  const moveX = event.changedTouches[0].clientX - imageTouch.startX
  const moveY = event.changedTouches[0].clientY - imageTouch.startY
  const moveDistance = Math.sqrt(moveX * moveX + moveY * moveY)
  if (moveDistance < 30) {
    const currentTime = new Date().getTime()
    const timeDiff = currentTime - imageTouch.lastTapTime
    if (timeDiff < 300) {
      // 双击 - 缩放
      const el = event.currentTarget
      const rect = el.getBoundingClientRect()
      const touch = event.changedTouches[0]
      const x = touch.clientX - rect.left
      const y = touch.clientY - rect.top
      const xPercent = ((x / rect.width) * 100).toFixed(2)
      const yPercent = ((y / rect.height) * 100).toFixed(2)
      let prevCount = imageScales[index]?.count || 0
      let nextCount = prevCount + 1
      if (nextCount > 1) {
        imageScales[index] = {
          scaling: true,
          count: 0,
          origin: '50% 50%',
          offsetX: 0,
          offsetY: 0,
          pinchScale: undefined
        }
        setTimeout(() => {
          imageScales[index].scaling = false
        }, 300)
      } else {
        imageScales[index] = {
          scaling: true,
          count: nextCount,
          origin: prevCount === 0 ? `${xPercent}% ${yPercent}%` : imageScales[index].origin,
          offsetX: imageScales[index]?.offsetX || 0,
          offsetY: imageScales[index]?.offsetY || 0,
          pinchScale: undefined
        }
        if (prevCount === 0) stopAutoSwitch()
      }
      imageTouch.lastTapTime = 0
    } else {
      imageTouch.lastTapTime = currentTime
    }
  }
}

// 显示图片信息
const showImageInfo = () => {
  if (longPress.selectedIndex === null) return
  const currentImage = autoSwitch.imageList[longPress.selectedIndex]
  if (!currentImage) return
  flags.showActionPopup = false
  flags.showImageInfoPopup = true
}

// 保存图片
const saveImage = async () => {
  if (longPress.selectedIndex === null) return

  try {
    const currentImage = autoSwitch.imageList[longPress.selectedIndex]
    // 创建一个隐藏的a标签
    const link = document.createElement('a')

    // 设置下载链接为图片URL
    // 注意：如果图片URL是相对路径，需要转换为绝对路径
    link.href = currentImage.rawUrl

    // 从URL中提取文件名，或者使用自定义文件名
    const fileName = currentImage.filePath.split('/').pop() || `image-${Date.now()}.jpg`
    link.download = fileName

    // 将链接添加到文档中
    document.body.appendChild(link)

    // 模拟点击下载
    link.click()

    // 移除链接
    document.body.removeChild(link)
    // 更新下载数量
    await api.updateDownloadCount(currentImage.id, 1)
    showNotify({
      type: 'success',
      message: t('messages.saveSuccess')
    })
    settingStore.vibrate()
  } catch (error) {
    showNotify({
      type: 'danger',
      message: t('messages.saveFail')
    })
  } finally {
    flags.showActionPopup = false
  }
}

// 删除图片
const deleteImage = async () => {
  if (longPress.selectedIndex === null) return

  // 关闭操作弹层
  flags.showActionPopup = false

  // 显示确认对话框
  try {
    await showConfirmDialog({
      title: t('h5.pages.home.actions.confirmDelete'),
      message: t('h5.pages.home.actions.confirmDeleteMessage'),
      confirmButtonText: t('h5.pages.home.actions.confirmDeleteBtn'),
      cancelButtonText: t('h5.pages.home.actions.cancelDeleteBtn'),
      confirmButtonColor: '#ee0a24',
      closeOnClickOverlay: true
    })

    // 用户点击确认后执行删除操作
    const currentImage = autoSwitch.imageList[longPress.selectedIndex]
    const res = await api.deleteImage(toRaw(currentImage))
    if (res.success) {
      // 从列表中移除该图片
      autoSwitch.imageList.splice(longPress.selectedIndex, 1)

      // 如果删除的是当前显示的图片，需要调整当前索引
      if (longPress.selectedIndex === autoSwitch.currentIndex) {
        if (autoSwitch.currentIndex >= autoSwitch.imageList.length) {
          autoSwitch.currentIndex = Math.max(0, autoSwitch.imageList.length - 1)
        }
        // 更新偏移量
        const clientHeight = imageSliderRef.value.clientHeight
        touchPosition.offsetY = -autoSwitch.currentIndex * clientHeight
      } else if (longPress.selectedIndex < autoSwitch.currentIndex) {
        // 如果删除的是当前图片之前的图片，当前索引需要减1
        autoSwitch.currentIndex--
        // 更新偏移量
        const clientHeight = imageSliderRef.value.clientHeight
        touchPosition.offsetY = -autoSwitch.currentIndex * clientHeight
      }

      showNotify({
        type: 'success',
        message: t('messages.deleteSuccess')
      })
      settingStore.vibrate()
    } else {
      showNotify({
        type: 'danger',
        message: t('messages.deleteFail')
      })
    }
  } catch (error) {
    // 用户取消删除或发生错误
    if (error !== 'cancel') {
      showNotify({
        type: 'danger',
        message: t('messages.deleteFail')
      })
    }
  } finally {
    longPress.selectedIndex = null
  }
}

const onSettingDataChange = async (payload) => {
  if (!payload) {
    return
  }
  await settingStore.h5UpdateSettingData(payload)
}

const handleTabbarButtonTouchEnd = (e) => {
  const now = Date.now()
  const timeDiff = now - tabbarBtnTouch.lastTapTime
  if (tabbarBtnTouch.timer) {
    clearTimeout(tabbarBtnTouch.timer)
    tabbarBtnTouch.timer = null
  }
  if (timeDiff < 300) {
    // 双击
    tabbarBtnTouch.lastTapTime = 0
    onRefresh()
  } else {
    // 单击，等待是否有第二次点击
    tabbarBtnTouch.lastTapTime = now
    tabbarBtnTouch.timer = setTimeout(() => {
      commonStore.toggleTabbarVisible()
      tabbarBtnTouch.timer = null
      tabbarBtnTouch.lastTapTime = 0
    }, 300)
  }
}

const onBackTop = () => {
  autoSwitch.currentIndex = 0
  touchPosition.offsetY = 0
}

defineExpose({
  init
})

// 初始化加载数据
onMounted(() => {
  // 禁用下拉刷新
  disablePullToRefresh()

  // 监听页面可见性变化
  document.addEventListener('visibilitychange', handleVisibilityChange)

  // 监听设备锁屏/解锁事件（iOS和Android）
  window.addEventListener('pagehide', handlePageHide)
  window.addEventListener('pageshow', handlePageShow)
})

// 禁用下拉刷新功能
const disablePullToRefresh = () => {
  // 阻止双击缩放
  let lastTouchEnd = 0
  document.addEventListener(
    'touchend',
    (e) => {
      const now = new Date().getTime()
      if (now - lastTouchEnd <= 300) {
        e.preventDefault()
      }
      lastTouchEnd = now
    },
    { passive: false }
  )
}

// 组件卸载时停止自动翻页并移除事件监听
onUnmounted(() => {
  // 确保清除所有定时器
  if (autoSwitch.switchTimer) {
    clearInterval(autoSwitch.switchTimer)
    autoSwitch.switchTimer = null
  }
  if (autoSwitch.countdownTimer) {
    clearInterval(autoSwitch.countdownTimer)
    autoSwitch.countdownTimer = null
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
      <div class="image-container" :style="{ transform: `translateY(${touchPosition.offsetY}px)` }">
        <!-- 使用 List 组件加载更多 -->
        <van-list
          v-model:loading="flags.loading"
          :finished="flags.finished"
          :finished-text="t('messages.noMoreData')"
          @load="onLoad"
        >
          <!-- 每张图片 -->
          <div
            v-for="(item, index) in autoSwitch.imageList"
            :key="item.id"
            v-lazy:background-image="item.src"
            class="image-item"
            :style="{
              ...imageItemStyle,
              transform: imageScales[index]?.count
                ? `scale(${imageScales[index]?.pinchScale || 1 + imageScales[index].count}) translate(${imageScales[index]?.offsetX || 0}px, ${imageScales[index]?.offsetY || 0}px)`
                : 'scale(1) translate(0,0)',
              transformOrigin: imageScales[index]?.origin || '50% 50%'
            }"
            @touchstart="(e) => handleImageTouchStart(index, e)"
            @touchmove="(e) => handleImageTouchMove(index, e)"
            @touchend="(e) => handleImageTouchEnd(index, e)"
          ></div>
        </van-list>
      </div>
    </div>
    <!-- 指示器 -->
    <div v-if="autoSwitch.total" class="number-indicator">
      {{ autoSwitch.currentIndex + 1 }} / {{ autoSwitch.total }}
    </div>
  </div>

  <!-- 浮动按钮 -->
  <div class="floating-buttons" :style="floatingButtonsStyle">
    <!-- 启停自动翻页 -->
    <div
      v-if="settingData.h5EnabledFloatingButtons.includes('autoSwitch')"
      class="floating-button"
      :class="{ 'progress-button': settingData.h5AutoSwitch }"
      :style="{ '--animation-duration': settingData.h5SwitchIntervalTime + 's' }"
      @click="toggleAutoSwitch"
    >
      <IconifyIcon
        class="floating-button-icon"
        :icon="settingData.h5AutoSwitch ? 'ri:pause-large-fill' : 'ri:play-large-fill'"
      />
    </div>

    <!-- 切换翻页等待时长 -->
    <div
      v-if="settingData.h5EnabledFloatingButtons.includes('intervalTime')"
      class="floating-button"
      @click="changeSwitchIntervalTime"
    >
      {{ settingData.h5AutoSwitch ? autoSwitch.countdown : settingData.h5SwitchIntervalTime }}s
    </div>

    <!-- 切换随机模式 -->
    <div
      v-if="settingData.h5EnabledFloatingButtons.includes('switchType')"
      class="floating-button"
      @click="toggleRandom"
    >
      <IconifyIcon
        class="floating-button-icon"
        :icon="isRandom ? 'ri:shuffle-line' : 'ri:repeat-line'"
        style="transform: scale(0.9)"
      />
    </div>

    <!-- 收藏图片 -->
    <div
      v-if="settingData.h5EnabledFloatingButtons.includes('favorites')"
      class="floating-button"
      @touchstart="handleFavoriteTouchStart"
      @touchmove="handleFavoriteTouchMove"
      @touchend="handleFavoriteTouchEnd"
    >
      <IconifyIcon
        class="floating-button-icon"
        :icon="isFavorite ? 'ri:star-fill' : 'ri:star-line'"
        :style="{ color: isFavorite ? 'gold' : '' }"
      />
      <span v-if="flags.isFavoriteHolding && favoriteHold.count > 0" class="favorite-count"
        >+{{ favoriteHold.count }}</span
      >
    </div>

    <!-- 切换背景大小 -->
    <div
      v-if="settingData.h5EnabledFloatingButtons.includes('displaySize')"
      class="floating-button"
      @click="toggleImageDisplaySize"
    >
      <IconifyIcon
        class="floating-button-icon"
        :icon="
          settingData.h5ImageDisplaySize === 'cover'
            ? 'ri:collapse-diagonal-line'
            : 'ri:expand-diagonal-line'
        "
      />
    </div>

    <!-- 切换标签栏显示 -->
    <div
      v-if="settingData.h5EnabledFloatingButtons.includes('toggleTabbar')"
      class="floating-button"
      @touchend="handleTabbarButtonTouchEnd"
    >
      <IconifyIcon
        class="floating-button-icon"
        :icon="tabbarVisible ? 'ri:home-3-line' : 'ri:home-2-line'"
      />
    </div>

    <!-- 返回顶部 -->
    <div
      v-if="settingData.h5EnabledFloatingButtons.includes('backtop') && autoSwitch.currentIndex > 5"
      class="floating-button"
      @click="onBackTop"
    >
      <IconifyIcon class="floating-button-icon" icon="tdesign:backtop" />
    </div>
  </div>

  <!-- 长按操作弹层 -->
  <van-popup
    v-model:show="flags.showActionPopup"
    destroy-on-close
    position="bottom"
    :style="{ padding: '16px' }"
  >
    <div class="action-popup-content">
      <div class="action-item" @click="showImageInfo">
        <div class="action-icon-wrapper">
          <IconifyIcon class="action-icon-inner" icon="ri:information-line" />
        </div>
        <span class="action-label">{{ t('h5.pages.home.actions.imageInfo') }}</span>
      </div>
      <div class="action-item" @click="saveImage">
        <div class="action-icon-wrapper">
          <IconifyIcon class="action-icon-inner" icon="ri:download-line" />
        </div>
        <span class="action-label">{{ t('h5.pages.home.actions.saveImage') }}</span>
      </div>
      <div class="action-item delete-action" @click="deleteImage">
        <div class="action-icon-wrapper">
          <IconifyIcon class="action-icon-inner" icon="ri:delete-bin-line" />
        </div>
        <span class="action-label">{{ t('h5.pages.home.actions.deleteImage') }}</span>
      </div>
    </div>
  </van-popup>

  <!-- 图片信息弹层 -->
  <van-popup
    v-model:show="flags.showImageInfoPopup"
    position="bottom"
    :style="{ padding: '16px', height: '50%' }"
  >
    <div class="image-info-content">
      <van-cell-group
        v-if="longPress.selectedIndex !== null && autoSwitch.imageList[longPress.selectedIndex]"
      >
        <van-cell
          v-for="key in infoKeys"
          :key="key"
          :title="t(`h5.pages.home.imageInfo.${key}`)"
          :value="handleInfoVal(autoSwitch.imageList[longPress.selectedIndex], key)"
        />
      </van-cell-group>
    </div>
  </van-popup>

  <!-- 收藏提示 -->
  <van-toast
    v-model:show="flags.showFavoriteToast"
    :overlay="false"
    style="background-color: transparent"
  >
    <template #message>
      <img src="@h5/assets/images/star.gif" style="width: 50vw; max-width: 200px; padding: 0" />
    </template>
  </van-toast>
</template>

<style scoped lang="scss">
.page-home {
  background-color: #333;
}
.image-slider {
  width: 100%;
  height: calc(100vh - var(--fbw-tabbar-height));
  overflow: hidden;
  position: relative;
}

.image-container {
  transition: transform 0.2s ease-in;
  will-change: transform;
  transform: translateZ(0);
}

.image-item {
  width: 100%;
  height: calc(100vh - var(--fbw-tabbar-height));
  background-size: cover;
  background-position: center;
  background-repeat: no-repeat;
  will-change: transform;
}

.floating-buttons {
  position: fixed;
  bottom: 100px;
  display: flex;
  flex-direction: column;
  gap: 25px;
}

.floating-button {
  width: 46px;
  height: 46px;
  line-height: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: rgba(0, 0, 0, 0.5);
  color: white;
  border: none;
  border-radius: 50%;
  position: relative;
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
  font-size: 30px;
  will-change: transform;
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
  will-change: transform;
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

.favorite-count {
  position: absolute;
  top: -10px;
  right: -10px;
  background-color: #ff4d4f;
  color: white;
  border-radius: 50%;
  min-width: 20px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  padding: 0;
}

/* 操作弹层样式 */
.action-popup-content {
  display: flex;
  flex-direction: row;
  gap: 16px;
}

.action-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  font-size: 16px;

  &:active {
    .action-icon-inner {
      transform: scale(1.2);
    }
  }
}

.action-icon-wrapper {
  display: flex;
  justify-content: center;
  align-items: center;
  background-color: #eee;
  border-radius: 10px;
  padding: 14px;
  font-size: 24px;
}

.action-icon-inner {
  transition: transform 0.3s ease-out;
}

.action-label {
  font-size: 12px;
}

.delete-action {
  color: #ff4d4f;
}

.cancel-action {
  border-top: 1px solid #eee;
  padding-top: 16px;
}

.number-indicator {
  display: inline-block;
  position: absolute;
  left: 50%;
  top: 12px;
  transform: translateX(-50%);
  background: rgba(0, 0, 0, 0.5);
  color: #fff;
  padding: 4px 8px;
  border-radius: 16px;
  font-size: 14px;
  letter-spacing: 1px;
  z-index: 20;
  pointer-events: none;
}

/* 深色模式 */
.van-theme-dark {
  .action-icon-wrapper {
    background-color: black;
  }
}
</style>
