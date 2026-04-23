import { registerImageApi } from './images.mjs'
import { registerBusinessApi } from './business.mjs'

const useApi = (router, deps) => {
  registerImageApi(router)
  registerBusinessApi(router, deps)
}

export default useApi
