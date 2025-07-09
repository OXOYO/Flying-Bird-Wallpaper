/**
 * 工具函数
 * */
import os from 'node:os'
import fs from 'node:fs'
import path from 'node:path'
import net from 'node:net'
import crypto from 'node:crypto'
import sharp from 'sharp'
import forge from 'node-forge'
import fg from 'fast-glob'
import { allowedImageExtList, allowedVideoExtList } from '@common/publicData.js'

const OS_TYPES = {
  Linux: 'linux',
  Darwin: 'mac',
  Windows_NT: 'win'
}

export const osType = OS_TYPES[os.type()] || 'win'

export const isLinux = () => {
  return osType === 'linux'
}
export const isMac = () => {
  return osType === 'mac'
}
export const isWin = () => {
  return osType === 'win'
}

export const isDev = () => {
  return process.env.NODE_ENV === 'development'
}

export const isProd = () => {
  return process.env.NODE_ENV === 'production'
}

export const isFunc = (func) => {
  return typeof func === 'function'
}

export const echoDebugLog = (message) => {
  if (isDev() && message) {
    fs.appendFileSync('debug.log', message + '\n')
  }
}

// 获取应用相关目录地址
export const getDirPathByName = (userDataPath = '', dirName = '') => {
  let dirPath = ''
  const sysDirs = ['database', 'logs', 'download', 'temp', 'certs', 'plugins']
  if (sysDirs.includes(dirName)) {
    dirPath = path.join(userDataPath, dirName)
  } else {
    dirPath = path.join(userDataPath, 'temp', dirName)
  }

  if (dirPath && !fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true })
  }
  return dirPath
}

// 文件系统缓存
const fsCache = {
  directories: {},
  lastUpdate: Date.now(),
  // 缓存有效期（毫秒）
  ttl: 60000 // 1分钟
}

// 清除缓存
export const clearFsCache = () => {
  Object.keys(fsCache.directories).forEach((key) => {
    delete fsCache.directories[key]
  })
  fsCache.lastUpdate = Date.now()
}

// 异步读取目录并返回所有文件（包括子目录中的文件）
// 使用 fast-glob 优化性能
export const readDirRecursive = async (
  resourceName,
  dirPath,
  allowedFileExt,
  existingFiles = []
) => {
  const cacheTime = {
    start: Date.now(),
    end: Date.now()
  }
  // 检查缓存是否存在且有效
  const cacheKey = `${dirPath}_${allowedFileExt.join('_')}`
  // 检查缓存是否存在且有效
  if (fsCache.directories[cacheKey] && Date.now() - fsCache.lastUpdate < fsCache.ttl) {
    // 使用缓存数据，但仍然进行增量更新检查
    const cachedFiles = fsCache.directories[cacheKey]

    // 如果没有现有文件信息，直接返回缓存
    if (!existingFiles || existingFiles.length === 0) {
      return cachedFiles
    }

    // 否则，过滤出需要更新的文件
    const existingFilesMap = new Map()
    for (const file of existingFiles) {
      if (file.filePath) {
        existingFilesMap.set(file.filePath, file)
      }
    }

    const ret = cachedFiles.filter((file) => {
      const existingFile = existingFilesMap.get(file.filePath)
      return !existingFile || file.mtimeMs > existingFile.mtimeMs
    })
    return ret
  }
  cacheTime.end = Date.now()

  const existingTime = {
    start: Date.now(),
    end: Date.now()
  }
  // 构建现有文件的映射，用于快速查找
  const existingFilesMap = new Map()
  for (const file of existingFiles) {
    if (file.filePath) {
      existingFilesMap.set(file.filePath, file)
    }
  }
  existingTime.end = Date.now()

  const patternsTime = {
    start: Date.now(),
    end: Date.now()
  }
  // 使用 fast-glob 快速获取所有匹配的文件
  const patterns = allowedFileExt.map((ext) => `**/*${ext}`)
  const entries = await fg(patterns, {
    cwd: dirPath,
    absolute: true,
    onlyFiles: true,
    stats: false,
    followSymbolicLinks: false
  })
  patternsTime.end = Date.now()

  const fileTime = {
    start: Date.now(),
    end: Date.now()
  }
  // 批量获取文件状态
  const fileStats = await Promise.all(
    entries.map(async (filePath) => {
      try {
        const stats = await fs.promises.stat(filePath)
        return {
          filePath,
          stats,
          fileName: path.basename(filePath),
          fileExt: path.extname(filePath).toLowerCase()
        }
      } catch (err) {
        return null
      }
    })
  )
  fileTime.end = Date.now()

  const filterTime = {
    start: Date.now(),
    end: Date.now()
  }
  // 过滤掉获取状态失败的文件
  const validFiles = fileStats.filter(Boolean)

  // 过滤需要处理的文件（不存在或已修改）
  const filesToProcess = validFiles.filter((file) => {
    const existingFile = existingFilesMap.get(file.filePath)
    return !existingFile || file.stats.mtimeMs > existingFile.mtimeMs
  })
  filterTime.end = Date.now()

  const imageTime = {
    start: Date.now(),
    end: Date.now()
  }
  // 批量处理文件元数据
  const rows = await Promise.all(
    filesToProcess.map(async (file) => {
      try {
        const fileExt = file.fileExt.toLowerCase()
        // const imgData = await calculateImageByPath(file.filePath)
        let fileType = ''
        if (allowedImageExtList.includes(fileExt)) {
          fileType = 'image'
        } else if (allowedVideoExtList.includes(fileExt)) {
          fileType = 'video'
        }
        return {
          resourceName,
          fileName: file.fileName,
          filePath: file.filePath,
          fileExt,
          fileType,
          fileSize: file.stats.size,
          // quality: imgData.quality,
          // width: imgData.width,
          // height: imgData.height,
          // isLandscape: imgData.isLandscape,
          // dominantColor: imgData.dominantColor,
          atimeMs: file.stats.atimeMs,
          mtimeMs: file.stats.mtimeMs,
          ctimeMs: file.stats.ctimeMs
        }
      } catch (err) {
        global.logger.error(`处理文件元数据失败: ${file.filePath} error => ${err}`)
        return null
      }
    })
  )
  imageTime.end = Date.now()

  // 过滤掉处理失败的文件
  const validRows = rows.filter(Boolean)

  // 更新缓存
  fsCache.directories[cacheKey] = validRows
  fsCache.lastUpdate = Date.now()

  return validRows
}

export const formatFileSize = (bytes = 0) => {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

export const calculateImageQuality = (width = 0, height = 0) => {
  if (width > 7680 && height > 4320) {
    return '8K'
  } else if (width > 5120 && height > 2880) {
    return '5K'
  } else if ((width > 4096 && height > 2160) || (width > 3840 && height > 2160)) {
    return '4K'
  } else if (width > 2560 && height > 1440) {
    return '2K'
  } else {
    return ''
  }
}

// 计算图片是否横屏 横屏: 1 竖屏: 0
export const calculateImageOrientation = (width = 0, height = 0) => {
  return width > height ? 1 : 0
}

export const extractDominantColor = async (filePath) => {
  try {
    // 将图片缩小到 1x1 像素以获取平均颜色
    const { data } = await sharp(filePath)
      .resize(1, 1, { fit: 'cover' })
      .raw()
      .toBuffer({ resolveWithObject: true })

    // 根据图片通道数获取颜色值
    const r = data[0]
    const g = data[1]
    const b = data[2]

    // 返回十六进制颜色值
    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`
  } catch (err) {
    global.logger.error(`提取图片主色调失败: ${filePath} error => ${err}`)
    // 默认透明色
    return '#00000000'
  }
}

export const calculateImageByPath = async (filePath) => {
  let ret = {
    quality: '',
    isLandscape: -1,
    width: 0,
    height: 0,
    dominantColor: '#00000000'
  }
  try {
    const { width, height } = await sharp(filePath).metadata()
    ret.width = width
    ret.height = height
    ret.quality = calculateImageQuality(width, height)
    ret.isLandscape = calculateImageOrientation(width, height)
    // 提取主色调
    ret.dominantColor = await extractDominantColor(filePath)
    return ret
  } catch (err) {
    return ret
  }
}

// 获取本机 IP 地址
export const getLocalIP = () => {
  const interfaces = os.networkInterfaces()
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address
      }
    }
  }
  return '0.0.0.0' // 如果没有找到，默认监听所有网络接口
}

// 动态选择一个可用端口
export const findAvailablePort = (startPort = 8888) => {
  return new Promise((resolve, reject) => {
    const server = net.createServer()
    server.on('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        resolve(findAvailablePort(startPort + 1)) // 尝试下一个端口
      } else {
        reject(err)
      }
    })
    server.listen(startPort, () => {
      const port = server.address().port
      server.close(() => resolve(port)) // 关闭临时服务器并返回端口
    })
  })
}

/**
 * 获取目录路径，如果目录不存在则创建
 * @param {string} basePath - 基础路径
 * @param {string} dirName - 目录名
 * @returns {string} 完整的目录路径
 */
export const getOrCreateDirPath = (basePath, dirName) => {
  const dirPath = path.join(basePath, dirName)

  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true })
  }

  return dirPath
}

/**
 * 确保目录存在，如果不存在则创建
 * @param {string} dirPath - 目录路径
 */
export const ensureDir = (dirPath) => {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true })
  }
}

/**
 * 获取图标路径
 * @param {string} iconName - 图标文件名
 * @returns {string} - 图标的绝对路径
 */
export const getIconPath = (iconName) => {
  if (!iconName) {
    return ''
  }
  // 开发环境下使用项目根目录下的资源
  return path.resolve(path.join(process.env.FBW_RESOURCES_PATH, 'icons', iconName))
}

/**
 * 处理时间单位
 * @param {number} time - 时间值
 * @param {string} unit - 时间单位，s: 秒，m: 分钟，h: 小时，d: 天
 * @returns {number} - 处理后的时间值（毫秒）
 */
export const handleTimeByUnit = (time, unit) => {
  let ret = 0
  if (unit && time) {
    switch (unit) {
      case 's':
        ret = time
        break
      case 'm':
        ret = time * 60
        break
      case 'h':
        ret = time * 60 * 60
        break
      case 'd':
        ret = time * 24 * 60 * 60
    }
    ret *= 1000
  }
  return ret
}

// 生成盐值
export const generateSalt = () => {
  return crypto.randomBytes(16).toString('hex')
}

// 哈希密码
export const hashPassword = (password, salt) => {
  const hash = crypto.createHmac('sha256', salt)
  hash.update(password)
  return hash.digest('hex')
}

// 验证密码
export const verifyPassword = (inputPassword, storedHash, salt) => {
  const inputHash = hashPassword(inputPassword, salt)
  return inputHash === storedHash
}

// 生成自签名SSL证书
export const generateSelfSignedCert = (hostname) => {
  // 生成RSA密钥对
  const keys = forge.pki.rsa.generateKeyPair(2048)

  // 创建证书
  const cert = forge.pki.createCertificate()
  cert.publicKey = keys.publicKey
  cert.serialNumber = '01'
  cert.validity.notBefore = new Date()
  cert.validity.notAfter = new Date()
  cert.validity.notAfter.setFullYear(cert.validity.notBefore.getFullYear() + 1)

  // 设置证书主体和颁发者
  const attrs = [
    { name: 'commonName', value: hostname },
    { name: 'countryName', value: 'CN' },
    { name: 'organizationName', value: 'Flying Bird Wallpaper' },
    { name: 'organizationalUnitName', value: 'Development' }
  ]

  cert.setSubject(attrs)
  cert.setIssuer(attrs)

  // 设置扩展
  cert.setExtensions([
    {
      name: 'basicConstraints',
      cA: true
    },
    {
      name: 'keyUsage',
      keyCertSign: true,
      digitalSignature: true,
      nonRepudiation: true,
      keyEncipherment: true,
      dataEncipherment: true
    },
    {
      name: 'subjectAltName',
      altNames: [
        { type: 2, value: hostname },
        { type: 2, value: 'localhost' }
      ]
    }
  ])

  // 使用私钥签名证书
  cert.sign(keys.privateKey, forge.md.sha256.create())

  // 转换为PEM格式
  const privateKeyPem = forge.pki.privateKeyToPem(keys.privateKey)
  const certPem = forge.pki.certificateToPem(cert)

  return {
    key: privateKeyPem,
    cert: certPem
  }
}

// 创建纯色图片
export const createSolidColorBMP = (color = '#000000', width = 100, height = 100) => {
  // 解析颜色
  const r = parseInt(color.slice(1, 3), 16)
  const g = parseInt(color.slice(3, 5), 16)
  const b = parseInt(color.slice(5, 7), 16)

  // BMP 文件头和信息头
  const fileHeaderSize = 14
  const infoHeaderSize = 40
  const rowSize = Math.ceil((24 * width) / 32) * 4
  const pixelArraySize = rowSize * height
  const fileSize = fileHeaderSize + infoHeaderSize + pixelArraySize

  const buffer = Buffer.alloc(fileSize)

  // BMP 文件头
  buffer.write('BM') // Signature
  buffer.writeUInt32LE(fileSize, 2) // File size
  buffer.writeUInt32LE(0, 6) // Reserved
  buffer.writeUInt32LE(fileHeaderSize + infoHeaderSize, 10) // Pixel data offset

  // BMP 信息头
  buffer.writeUInt32LE(infoHeaderSize, 14) // Info header size
  buffer.writeInt32LE(width, 18) // Width
  buffer.writeInt32LE(-height, 22) // Height (负数表示自上而下)
  buffer.writeUInt16LE(1, 26) // Planes
  buffer.writeUInt16LE(24, 28) // Bits per pixel
  buffer.writeUInt32LE(0, 30) // Compression
  buffer.writeUInt32LE(pixelArraySize, 34) // Image size
  buffer.writeInt32LE(0, 38) // X pixels per meter
  buffer.writeInt32LE(0, 42) // Y pixels per meter
  buffer.writeUInt32LE(0, 46) // Colors used
  buffer.writeUInt32LE(0, 50) // Important colors

  // 填充像素数据
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const pos = fileHeaderSize + infoHeaderSize + y * rowSize + x * 3
      buffer[pos] = b
      buffer[pos + 1] = g
      buffer[pos + 2] = r
    }
  }

  return buffer
}

// 加载动画页面地址
export const getWindowURL = (name) => {
  let url = isDev()
    ? `${process.env['ELECTRON_RENDERER_URL']}/windows/${name}/index.html`
    : `${path.join(__dirname, `../renderer/windows/${name}/index.html`)}`
  return url
}

// 阻止窗口右键菜单事件
export const preventContextMenu = (win) => {
  if (!win) {
    return
  }
  win.webContents.on('context-menu', (event) => {
    event.preventDefault() // 阻止默认右键菜单行为
  })
  if (isWin()) {
    // 监听 278 消息，关闭因为css: -webkit-app-region: drag 引起的默认右键菜单
    win.hookWindowMessage(278, () => {
      // 阻止默认的窗口关闭行为
      win.setEnabled(false)
      setTimeout(() => {
        win.setEnabled(true)
      }, 100)
      return true
    })
  }
}
