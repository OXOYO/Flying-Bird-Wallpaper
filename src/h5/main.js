import './assets/main.css'
import App from './App.vue'
import useIconifyIcon from './utils/icons.js'
import useI18n from '@i18n/web.js'

const app = createApp(App)
const pinia = createPinia()

app.use(pinia)

useIconifyIcon(app)

useI18n(app).mount('#app')
