import fs from 'node:fs'
import path from 'node:path'
import sharp from 'sharp'
import cache from '../cache.mjs'
import { mimeTypes } from '../../common/publicData.js'

// 处理视频响应的函数
export const handleVideoResponse = async ({ filePath, request }) => {
  const ret = {
    status: 500,
    headers: {},
    data: null
  }
  try {
    // 转换文件路径（包含URL解码）
    filePath = transFilePath(filePath)
    // 获取文件信息
    const stats = await fs.promises.stat(filePath)
    const extension = path.extname(filePath).toLowerCase()
    const mimeType = mimeTypes[extension] || 'video/mp4'
    const fileSize = stats.size

    // 处理范围请求
    let start = 0
    let end = fileSize - 1
    let statusCode = 200
    let contentRange = `bytes ${start}-${end}/${fileSize}`
    let contentLength = fileSize

    // 检查是否是范围请求
    if (request && request.headers && request.headers.get('range')) {
      const range = request.headers.get('range')
      const parts = range.replace(/bytes=/, '').split('-')
      const partialStart = parts[0]
      const partialEnd = parts[1]

      start = parseInt(partialStart, 10)
      end = partialEnd ? parseInt(partialEnd, 10) : fileSize - 1

      if (start >= fileSize) {
        // 范围无效，返回416状态码
        ret.status = 416
        ret.headers = {
          'Content-Range': contentRange
        }
        return ret
      }

      if (end >= fileSize) {
        end = fileSize - 1
      }

      contentLength = end - start + 1
      contentRange = `bytes ${start}-${end}/${fileSize}`
      statusCode = 206 // 部分内容
    }

    // 创建文件流，支持范围请求
    const streamData = fs.createReadStream(filePath, { start, end })

    // 设置响应头
    const headers = {
      'Content-Type': mimeType,
      'Content-Length': contentLength,
      'Accept-Ranges': 'bytes',
      'Content-Range': contentRange,
      'Cache-Control': 'max-age=3600',
      'Last-Modified': stats.mtime.toUTCString(),
      ETag: `"${stats.mtimeMs}-${stats.size}"`
    }

    ret.status = statusCode
    ret.headers = headers
    ret.data = streamData
    return ret
  } catch (err) {
    console.error('Video file error:', err)
    // 根据错误类型设置适当的状态码
    if (err.code === 'ENOENT') {
      // 文件不存在，设置为404
      ret.status = 404
    }
    return ret
  }
}

export const handleImageResponse = async (query) => {
  const ret = {
    status: 500,
    headers: {},
    data: null
  }
  try {
    let T1, T2, T3, T4
    T1 = Date.now()
    // 获取图片 URL 和尺寸
    let { filePath, w, compressStartSize } = query
    if (!filePath) {
      // 缺少文件路径参数，返回400错误
      ret.status = 400
      return ret
    }
    // 转换文件路径
    filePath = transFilePath(filePath)
    // 计算图片尺寸
    const width = w ? parseInt(w, 10) : null
    // 生成缓存键
    const cacheKey = `filePath=${filePath}&width=${width}`
    // 1. 先查缓存（只缓存小图/小文件）
    if (cache.has(cacheKey)) {
      const cacheData = cache.get(cacheKey)
      // 返回文件内容和 MIME 类型
      ret.status = 200
      ret.headers = {
        ...cacheData.headers,
        'Server-Timing': `cache-hit;dur=${Date.now() - T1}`
      }
      ret.data = cacheData.data
      return ret
    }
    T2 = Date.now()

    // 2. 未命中缓存，获取文件信息
    const stats = await fs.promises.stat(filePath)
    const originalFileSize = stats.size
    const extension = path.extname(filePath).toLowerCase()
    const mimeType = mimeTypes[extension] || 'application/octet-stream'
    const CACHE_LIMIT = 10 * 1024 * 1024 // 10MB
    T3 = Date.now()
    // 计算压缩起始大小（单位字节）
    const startSize = (compressStartSize ? parseInt(compressStartSize, 10) : 0) * 1024 * 1024
    // 判断是否需要 sharp 缩放（需满足格式、width、且大于compressStartSize）
    const canResize =
      ['.png', '.jpg', '.jpeg', '.avif', '.webp', '.gif'].includes(extension) && width
    const needResize = canResize && originalFileSize > startSize
    if (originalFileSize < CACHE_LIMIT) {
      // 小图缓存
      let fileBuffer
      if (needResize) {
        fileBuffer = await sharp(filePath)
          .resize({
            width,
            fit: 'inside',
            withoutEnlargement: true,
            kernel: 'lanczos3',
            fastShrinkOnLoad: true
          })
          .toBuffer()
      } else {
        fileBuffer = await fs.promises.readFile(filePath)
      }
      const fileSize = fileBuffer.length.toString()
      T4 = Date.now()
      const headers = {
        'Content-Type': mimeType,
        'Content-Length': fileSize,
        'Original-Size': originalFileSize,
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
      cache.set(cacheKey, {
        data: fileBuffer,
        headers
      })
      ret.status = 200
      ret.headers = headers
      ret.data = fileBuffer
      return ret
    } else {
      // 大图流式
      let streamData
      let headers = {
        'Content-Type': mimeType,
        'Cache-Control': 'max-age=3600',
        'Original-Size': originalFileSize,
        'Last-Modified': stats.mtime.toUTCString(),
        ETag: `"${stats.mtimeMs}-${originalFileSize}"`
      }
      if (needResize) {
        const inputStream = fs.createReadStream(filePath)
        const transformer = sharp().resize({
          width,
          fit: 'inside',
          withoutEnlargement: true,
          kernel: 'lanczos3',
          fastShrinkOnLoad: true
        })
        streamData = inputStream.pipe(transformer)
        headers['X-Resize-Stream'] = '1'
      } else {
        streamData = fs.createReadStream(filePath)
        headers['Content-Length'] = originalFileSize
      }
      T4 = Date.now()
      headers['Server-Timing'] =
        `file-check;dur=${T2 - T1}, file-stat;dur=${T3 - T2}, resize;dur=${T4 - T3}, total;dur=${T4 - T1}`
      headers['X-File-Check-Time'] = T2 - T1 + 'ms'
      headers['X-File-Stat-Time'] = T3 - T2 + 'ms'
      headers['X-Resize-Time'] = T4 - T3 + 'ms'
      headers['X-Total-Time'] = T4 - T1 + 'ms'

      ret.status = 200
      ret.headers = headers
      ret.data = streamData
      return ret
    }
  } catch (err) {
    console.error('Image file error:', err)
    // 根据错误类型设置适当的状态码
    if (err.code === 'ENOENT') {
      // 文件不存在，设置为404
      ret.status = 404
    }
    return ret
  }
}

export const transFilePath = (filePath) => {
  // 处理 Windows 上的绝对路径（例如 'E:/xx/yy'）
  if (process.platform === 'win32') {
    filePath = filePath.replace(/\//g, '\\') // 将所有斜杠替换为反斜杠
    // 修复丢失的冒号（:），假设路径是 e\xx\yy 应该是 e:\xx\yy
    filePath = filePath.replace(/^([a-zA-Z])\\/, '$1:\\') // 在盘符后面补上冒号
  } else {
    // macOS 和 Linux 确保是绝对路径
    if (!filePath.startsWith('/')) {
      filePath = '/' + filePath
    }
  }
  // 注意：这里不再需要 decodeURIComponent，因为 URL.searchParams.get() 已经自动解码了
  // filePath = decodeURIComponent(filePath)
  return filePath
}
