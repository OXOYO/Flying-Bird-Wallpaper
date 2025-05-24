import { handleFileRsponse } from '../../../utils/file.mjs'

export const getImage = async (ctx) => {
  const { filePath, w, h } = ctx.request.query

  const res = await handleFileRsponse({ filePath, w, h })
  ctx.set(res.headers)
  ctx.status = res.status
  ctx.body = res.data
}
