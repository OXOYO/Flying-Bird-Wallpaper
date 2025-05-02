import { Icon, addCollection } from '@iconify/vue'

// 导入需要的图标集
import epIcons from '@iconify-json/ep/icons.json'
import materialSymbols from '@iconify-json/material-symbols/icons.json'
import materialSymbolsLight from '@iconify-json/material-symbols-light/icons.json'
import iconParkSolid from '@iconify-json/icon-park-solid/icons.json'
import lucide from '@iconify-json/lucide/icons.json'
import mdi from '@iconify-json/mdi/icons.json'
import stash from '@iconify-json/stash/icons.json'

// 注册图标集
export default function useIconifyIcon(app) {
  // 注册 Iconify 组件
  app.component('IconifyIcon', Icon)

  // 注册图标集
  addCollection(epIcons)
  addCollection(materialSymbols)
  addCollection(materialSymbolsLight)
  addCollection(iconParkSolid)
  addCollection(lucide)
  addCollection(mdi)
  addCollection(stash)

  return app
}
