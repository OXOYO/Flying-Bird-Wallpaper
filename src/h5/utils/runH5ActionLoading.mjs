import { closeToast, showLoadingToast } from 'vant/es'

/**
 * 长按操作面板等耗时 API：全屏 loading，禁止重复点击
 * @param {() => void | Promise<void>} task
 */
export async function runH5ActionLoading(task) {
  showLoadingToast({
    forbidClick: true,
    duration: 0
  })
  try {
    await task()
  } finally {
    closeToast()
  }
}
