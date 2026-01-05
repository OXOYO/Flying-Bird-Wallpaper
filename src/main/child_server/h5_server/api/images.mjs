import { handleImageResponse } from '../../../utils/file.mjs'

export const getImage = async (ctx) => {
  const { filePath, w, h, compressStartSize } = ctx.request.query
  const res = await handleImageResponse({ filePath, w, h, compressStartSize })
  ctx.set(res.headers)
  ctx.status = res.status
  ctx.body = res.data
}
