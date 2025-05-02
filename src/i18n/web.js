import I18NextVue from 'i18next-vue'
import i18next from './i18next.js'

export default function (app) {
  app.use(I18NextVue, { i18next })
  return app
}
