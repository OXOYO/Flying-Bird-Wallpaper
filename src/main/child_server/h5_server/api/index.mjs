import { registerImageApi } from './images.mjs'
import { registerVideoApi } from './videos.mjs'
import { registerBusinessApi } from './business.mjs'

const useApi = (router, deps) => {
  registerImageApi(router)
  registerVideoApi(router)
  registerBusinessApi(router, deps)
}

export default useApi
