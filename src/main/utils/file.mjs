import fs from 'fs'
import path from 'path'
import sharp from 'sharp'
import cache from '../cache.mjs'
import { mimeTypes } from '../../common/publicData'

export const handleFileRsponse = async (query) => {
  const ret = {
    status: 404,
    headers: {},
    data: null
  }
  try {
    let T1, T2, T3, T4
    T1 = Date.now()
    // 获取图片 URL 和尺寸
    let { filePath, w, compressStartSize } = query
    if (!filePath) {
      return ret
    }
    // 转换文件路径
    filePath = transFilePath(filePath)
    // 定义默认图片尺寸
    const width = w ? parseInt(w, 10) : null
    // 生成缓存键
    const cacheKey = `filePath=${filePath}&width=${width}`
    // 检查缓存
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

    // 获取文件信息
    const stats = await fs.promises.stat(filePath)
    const originalFileSize = stats.size
    const extension = path.extname(filePath).toLowerCase()
    let mimeType = mimeTypes[extension] || 'application/octet-stream'
    T3 = Date.now()

    // 读取文件并处理
    let fileBuffer
    // 只对图片进行调整大小，视频文件直接读取
    // 文件大小超过指定大小才进行调整，单位bytes
    const startSize = (compressStartSize ? parseInt(compressStartSize, 10) : 0) * 1024 * 1024
    if (
      ['.png', '.jpg', '.jpeg', '.avif', '.webp', '.gif'].includes(extension) &&
      width &&
      originalFileSize > startSize
    ) {
      fileBuffer = await sharp(filePath)
        .resize({
          width,
          fit: 'inside', // 保持宽高比
          withoutEnlargement: true, // 避免放大小图片
          kernel: 'lanczos3', // 使用最好的缩放算法
          fastShrinkOnLoad: true // 启用快速缩小
        })
        .avif({
          quality: 80,
          lossless: true
        })
        .toBuffer()
      mimeType = 'image/avif'
    } else {
      fileBuffer = await fs.promises.readFile(filePath)
    }
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
    // 返回文件内容
    ret.status = 200
    ret.headers = headers
    ret.data = fileBuffer
    return ret
  } catch (err) {
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
  filePath = decodeURIComponent(filePath)
  return filePath
}
