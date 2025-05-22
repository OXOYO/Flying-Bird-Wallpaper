import fs from 'fs'
import path from 'path'
import cache from '../../../cache.mjs'
import { mimeTypes } from '../../../../common/publicData.js'

export const getImage = async (ctx) => {
  let T1, T2, T3, T4
  T1 = Date.now()

  const cacheKey = ctx.request.query.src
  let url = ctx.request.query.src
  // 处理 Windows 上的绝对路径（例如 'E:/xx/yy'）
  if (process.platform === 'win32') {
    url = url.replace(/\//g, '\\') // 将所有斜杠替换为反斜杠
    // 修复丢失的冒号（:），假设路径是 e\xx\yy 应该是 e:\xx\yy
    url = url.replace(/^([a-zA-Z])\\/, '$1:\\') // 在盘符后面补上冒号
  } else {
    // macOS 和 Linux 确保是绝对路径
    if (!url.startsWith('/')) {
      url = '/' + url
    }
  }

  const filePath = decodeURIComponent(url)

  // 检查文件是否存在
  try {
    // 检查缓存
    if (cache.has(cacheKey)) {
      const cacheData = cache.get(cacheKey)
      // 返回文件内容和 MIME 类型
      ctx.set({
        ...cacheData.headers,
        'Server-Timing': `cache-hit;dur=${Date.now() - T1}`
      })
      ctx.body = cacheData.data
      return
    }
    T2 = Date.now()

    const stats = await fs.promises.stat(filePath) // 获取文件大小
    const originalFileSize = stats.size
    const extension = path.extname(filePath).toLowerCase()
    const mimeType = mimeTypes[extension] || 'application/octet-stream'
    T3 = Date.now()

    // 读取文件
    const fileBuffer = await fs.promises.readFile(filePath)
    const fileSize = fileBuffer.length.toString()
    T4 = Date.now()

    const headers = {
      'Accept-Ranges': 'bytes',
      'Content-Type': mimeType,
      'Original-Size': originalFileSize,
      'Content-Length': fileSize,
      'Compressed-Size': fileSize,
      'Cache-Control': 'max-age=3600',
      ETag: `"${stats.mtimeMs}-${originalFileSize}"`,
      'Last-Modified': stats.mtime.toUTCString(),
      'Server-Timing': `file-check;dur=${T2 - T1}, file-stat;dur=${T3 - T2}, resize;dur=${T4 - T3}, total;dur=${T4 - T1}`,
      'X-File-Check-Time': T2 - T1 + 'ms',
      'X-File-Stat-Time': T3 - T2 + 'ms',
      'X-Resize-Time': T4 - T3 + 'ms',
      'X-Total-Time': T4 - T1 + 'ms'
    }
    // 缓存文件内容
    cache.set(cacheKey, {
      data: fileBuffer,
      headers
    })
    // 设置响应头
    ctx.set(headers)
    // 返回文件内容
    ctx.body = fileBuffer
  } catch (err) {
    ctx.body = {
      code: 400,
      msg: ctx.t('messages.operationFail')
    }
  }
}
