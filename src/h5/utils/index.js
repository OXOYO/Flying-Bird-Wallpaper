// 处理震动反馈
export const vibrate = (duration = 50) => {
  if (navigator.vibrate) {
    navigator.vibrate(duration)
  }
}
