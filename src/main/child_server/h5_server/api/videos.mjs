import { handleVideoResponse } from '../../../utils/file.mjs'

/**
 * 本地视频文件流（支持 Range，便于移动端与桌面浏览器拖动进度）
 */
const getVideo = async (ctx) => {
  const { filePath } = ctx.request.query
  if (!filePath) {
    ctx.status = 400
    ctx.body = 'missing filePath'
    return
  }

  const requestLike = {
    headers: {
      get: (name) => {
        const key = String(name).toLowerCase()
        const h = ctx.request.headers
        const v = h[key]
        if (Array.isArray(v)) return v[0]
        return v ?? ''
      }
    }
  }

  const res = await handleVideoResponse({ filePath, request: requestLike })
  ctx.set(res.headers)
  ctx.status = res.status
  ctx.body = res.data
}

export const registerVideoApi = (router) => {
  router.get('/api/videos/get', getVideo)
}
