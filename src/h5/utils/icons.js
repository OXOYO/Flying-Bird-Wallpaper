import { Icon, addCollection } from '@iconify/vue'

// 导入需要的图标集
import ri from '@iconify-json/ri/icons.json'

// 注册图标集
export default function useIconifyIcon(app) {
  // 注册 Iconify 组件
  app.component('IconifyIcon', Icon)

  // 注册图标集
  addCollection(ri)

  return app
}
