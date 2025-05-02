import i18next from 'i18next'
import { resources } from './locale/index.js'

i18next.init({
  lng: 'zhCN',
  fallbackLng: 'enUS',
  resources,
  // 设置占位符与vue-i18n保持一致
  interpolation: {
    prefix: '{', // 设置前缀为单花括号
    suffix: '}', // 设置后缀为单花括号
    escapeValue: false // 禁用字符转义
  }
})

export default i18next
