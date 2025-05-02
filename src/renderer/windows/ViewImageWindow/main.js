import { createApp } from 'vue'
import { createPinia } from 'pinia'
import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'
import 'viewerjs/dist/viewer.css'
import '@renderer/assets/main.scss'

import App from './App.vue'
import useIconifyIcon from '@renderer/utils/icons.js'
import useI18n from '@src/i18n/web.js'

const app = createApp(App)
const pinia = createPinia()

app.use(pinia)
app.use(ElementPlus)

useIconifyIcon(app)

useI18n(app).mount('#app')
