import { handleImageResponse } from '../../../utils/file.mjs'

const getImage = async (ctx) => {
  const { filePath, w, h, compressStartSize } = ctx.request.query
  const res = await handleImageResponse({
    filePath,
    w,
    h,
    compressStartSize,
    requestHeaders: ctx.request.headers
  })
  ctx.set(res.headers)
  ctx.status = res.status
  ctx.body = res.data
}

export const registerImageApi = (router) => {
  router.get('/api/images/get', getImage)
}
