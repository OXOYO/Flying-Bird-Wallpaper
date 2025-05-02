import fs from 'fs'
import path from 'path'
import sharp from 'sharp'

// 缓存单例
// const cache = new Cache()

export const getImage = async (ctx) => {
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

  // 获取宽高参数，例如 "w=800&h=600"
  const query = ctx.request.query
  const { w, h } = query
  // 定义默认图片尺寸
  const width = w ? parseInt(w, 10) : null
  const height = h ? parseInt(h, 10) : null

  // 检查文件是否存在
  try {
    // 检查缓存
    // if (cache.has(url)) {
    //   const cacheData = cache.get(url)
    //   // 返回文件内容和 MIME 类型
    //   return new Response(cacheData.data, {
    //     headers: cacheData.headers
    //   })
    // }

    const stats = await fs.promises.stat(filePath) // 获取文件大小
    let originalFileSize = stats.size
    const extension = path.extname(filePath).toLowerCase()
    let mimeType = ''

    // 设置文件的 MIME 类型
    switch (extension) {
      case '.png':
        mimeType = 'image/png'
        break
      case '.jpg':
      case '.jpeg':
        mimeType = 'image/jpeg'
        break
      default:
        mimeType = 'application/octet-stream'
    }

    const headers = {
      'Content-Type': mimeType,
      'Original-Size': originalFileSize,
      'Cache-Control': 'max-age=3600',
      ETag: `"${stats.mtimeMs}-${originalFileSize}"`,
      'Last-Modified': stats.mtime.toUTCString()
    }

    // 方式一：直接读取文件
    // 读取文件并调整大小
    // let compressedBuffer
    // if (width || height) {
    //   compressedBuffer = await sharp(filePath).resize(width, height).toBuffer()
    // } else {
    //   compressedBuffer = await fs.promises.readFile(filePath)
    // }
    //
    // const compressedFileSize = compressedBuffer.length // 压缩后的文件大小
    // headers['Content-Length'] = compressedFileSize // 设置响应头的内容长度
    // headers['Compressed-Size'] = compressedFileSize // 可选：自定义头记录压缩后大小
    // 缓存文件内容
    // cache.add(
    //   url,
    //   {
    //     data: compressedBuffer,
    //     headers
    //   },
    //   compressedFileSize
    // )
    // 设置响应头
    // ctx.set(headers)
    // 返回 Buffer 数据
    // ctx.body = compressedBuffer

    // 方式二：使用流式读取
    // 设置响应头
    ctx.set(headers)
    // 创建可读流
    const readStream = fs.createReadStream(filePath)
    // 如果需要调整图片大小
    if (width || height) {
      const transform = sharp().resize(width, height)
      ctx.body = readStream.pipe(transform) // 将流传递给响应
    } else {
      ctx.body = readStream // 直接返回文件流
    }
  } catch (err) {
    ctx.body = {
      code: 400,
      msg: ctx.t('messages.operationFail')
    }
  }
}
