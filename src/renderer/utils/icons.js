import { Icon } from '@iconify/vue'

// 注册图标集
export default function useIconifyIcon(app) {
  // 注册 Iconify 组件
  app.component('IconifyIcon', Icon)

  return app
}
