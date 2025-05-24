<script setup>
import UseCommonStore from '@h5/stores/commonStore.js'
import UseSettingStore from '@h5/stores/settingStore.js'
import * as api from '@h5/api/index.js'
import { vibrate } from '@h5/utils/index.js'
import { showImagePreview, showNotify, showConfirmDialog } from 'vant'
import { useTranslation } from 'i18next-vue'

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
  // 是否操作弹层
  showActionPopup: false
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
  imageList: []
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
  flags.showActionPopup = false
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
    autoSwitch.imageList = (
      isRefresh ? res.data.list : [...autoSwitch.imageList, ...res.data.list]
    ).map((item) => {
      const rawUrl = `/api/images/get?filePath=${encodeURIComponent(item.filePath)}`
      return {
        ...item,
        rawUrl,
        src: `${rawUrl}&w=${width}`
      }
    })
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
  touchPosition.startY = event.touches[0].clientY

  if (settingData.value.h5AutoSwitch) {
    stopAutoSwitch() // 直接调用停止函数，不改变状态
  }
}

// 触摸移动
const onTouchMove = (event) => {
  if (flags.isAnimating) return
  const clientHeight = imageSliderRef.value.clientHeight
  const deltaY = event.touches[0].clientY - touchPosition.startY
  touchPosition.offsetY = -autoSwitch.currentIndex * clientHeight + deltaY
}

// 触摸结束
const onTouchEnd = (event) => {
  if (flags.isAnimating) return
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
  }, 300)

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
        vibrate() // 每次计数增加时震动反馈
      } else {
        // 达到最大值时停止计数并提示用户
        clearInterval(favoriteHold.interval)
        favoriteHold.interval = null
        showNotify({
          type: 'warning',
          message: t('messages.maxFavoriteCountReached')
        })
      }
    }, 500) // 每500毫秒增加一次计数
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
    vibrate()
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
    images: autoSwitch.imageList.map((item) => item.rawUrl),
    startPosition: index,
    maxZoom: 100,
    minZoom: 1 / 3
  })
  vibrate()
}

// 图片项触摸相关状态
const imageTouch = reactive({
  lastTapTime: 0,
  startX: 0,
  startY: 0,
  timer: null
})

// 图片项触摸开始 - 统一处理函数
const handleImageTouchStart = (index, event) => {
  // 记录触摸开始时间和位置
  imageTouch.startX = event.touches[0].clientX
  imageTouch.startY = event.touches[0].clientY

  // 设置长按定时器
  longPress.timer = setTimeout(() => {
    longPress.selectedIndex = index
    flags.showActionPopup = true
    vibrate() // 触发震动反馈
  }, 500) // 500毫秒长按触发
}

// 图片项触摸移动 - 统一处理函数
const handleImageTouchMove = (event) => {
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
  // 清除长按定时器
  if (longPress.timer) {
    clearTimeout(longPress.timer)
    longPress.timer = null
  }

  // 计算移动距离
  const moveX = event.changedTouches[0].clientX - imageTouch.startX
  const moveY = event.changedTouches[0].clientY - imageTouch.startY
  const moveDistance = Math.sqrt(moveX * moveX + moveY * moveY)

  // 只有在移动距离很小的情况下才处理点击/双击事件
  if (moveDistance < 10) {
    // 计算触摸持续时间
    const currentTime = new Date().getTime()
    const timeDiff = currentTime - imageTouch.lastTapTime

    // 检查是否是双击（两次点击间隔小于300ms）
    if (timeDiff < 300) {
      // 双击 - 预览图片
      onPreviewImage(index)
      imageTouch.lastTapTime = 0 // 重置点击时间

      // 清除任何现有的定时器
      if (imageTouch.timer) {
        clearTimeout(imageTouch.timer)
        imageTouch.timer = null
      }

      // 注意：不要阻止事件冒泡，这样滑动容器也能接收到事件
      // event.stopPropagation()
    } else {
      // 第一次点击 - 记录时间，等待可能的第二次点击
      imageTouch.lastTapTime = currentTime
    }
  }
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
    showNotify({
      type: 'success',
      message: t('messages.saveSuccess')
    })
    vibrate()
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
      vibrate()
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

const onToggleTabbar = () => {
  commonStore.toggleTabbarVisible()
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
  // 监听页面可见性变化
  document.addEventListener('visibilitychange', handleVisibilityChange)

  // 监听设备锁屏/解锁事件（iOS和Android）
  window.addEventListener('pagehide', handlePageHide)
  window.addEventListener('pageshow', handlePageShow)
})

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
            :style="imageItemStyle"
            @touchstart="(e) => handleImageTouchStart(index, e)"
            @touchmove="handleImageTouchMove"
            @touchend="(e) => handleImageTouchEnd(index, e)"
          ></div>
        </van-list>
      </div>
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
        :icon="settingData.h5AutoSwitch ? 'ri:pause-fill' : 'ri:play-fill'"
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
      @click="onToggleTabbar"
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
      <div class="action-item" @click="saveImage">
        <IconifyIcon class="action-icon" icon="ri:download-line" />
        <span>{{ t('h5.pages.home.actions.saveImage') }}</span>
      </div>
      <div class="action-item delete-action" @click="deleteImage">
        <IconifyIcon class="action-icon" icon="ri:delete-bin-line" />
        <span>{{ t('h5.pages.home.actions.deleteImage') }}</span>
      </div>
    </div>
  </van-popup>
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
  transition: transform 0.3s ease;
}

.image-item {
  width: 100%;
  height: calc(100vh - var(--fbw-tabbar-height));
  background-size: cover;
  background-position: center;
  background-repeat: no-repeat;
}

.floating-buttons {
  position: fixed;
  bottom: calc(50px + var(--fbw-tabbar-height));
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
  flex-direction: column;
  gap: 16px;
}

.action-item {
  display: flex;
  align-items: center;
  padding: 12px 0;
  font-size: 16px;

  &:active {
    background-color: rgba(0, 0, 0, 0.05);
  }
}

.action-icon {
  margin-right: 12px;
  font-size: 24px;
}

.delete-action {
  color: #ff4d4f;
}

.cancel-action {
  border-top: 1px solid #eee;
  padding-top: 16px;
}
</style>
