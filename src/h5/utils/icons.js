import { Icon } from '@iconify/vue'
import { addCollection } from '@iconify/vue'

// 导入自定义图标集
import customIcons from '../../assets/icons/custom/icons.json'

// 注册图标集
export default function useIconifyIcon(app) {
  // 添加自定义图标集，避免网络请求
  addCollection(customIcons)

  // 注册 Iconify 组件
  app.component('IconifyIcon', Icon)

  return app
}
