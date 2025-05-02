import { getImage } from './images.mjs'

const useApi = (router) => {
  // 图片相关接口
  router.get('/api/images/get', getImage)
}

export default useApi
