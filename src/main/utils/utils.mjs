/**
 * 工具函数
 * */
import os from 'os'
import fs from 'fs'
import fsp from 'fs/promises'
import path from 'path'
import net from 'net'
import crypto from 'crypto'
import sharp from 'sharp'
import forge from 'node-forge'

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

// 异步读取目录并返回所有文件（包括子目录中的文件）
export const readDirRecursive = async (resourceName, dirPath, allowedFileExt) => {
  let files = await fsp.readdir(dirPath, { withFileTypes: true })
  let imageFiles = []

  for (const file of files) {
    const fullPath = path.join(dirPath, file.name)

    if (file.isDirectory()) {
      // 如果是目录，递归读取
      const dirData = await readDirRecursive(resourceName, fullPath, allowedFileExt)
      imageFiles = imageFiles.concat(dirData)
    } else if (file.isFile()) {
      // 如果是文件，检查是否为图片
      const fileExt = path.extname(file.name).toLowerCase()
      if (allowedFileExt.includes(fileExt)) {
        // 同步读取文件信息
        const fileStat = fs.statSync(fullPath)
        const imgData = await calculateImageByPath(fullPath)
        imageFiles.push({
          resourceName: resourceName,
          fileName: file.name,
          filePath: fullPath,
          fileExt: fileExt,
          fileSize: fileStat.size,
          quality: imgData.quality,
          width: imgData.width,
          height: imgData.height,
          isLandscape: imgData.isLandscape,
          atimeMs: fileStat.atimeMs,
          mtimeMs: fileStat.mtimeMs,
          ctimeMs: fileStat.ctimeMs
        })
      }
    }
  }

  return imageFiles
}

export const formatFileSize = (bytes = 0) => {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

export const calculateImageQuality = (width, height) => {
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
export const calculateImageOrientation = (width, height) => {
  return width > height ? 1 : 0
}

export const calculateImageByPath = async (filePath) => {
  let ret = {
    quality: '',
    isLandscape: -1,
    width: 0,
    height: 0
  }
  try {
    const { width, height } = await sharp(filePath).metadata()
    ret.width = width
    ret.height = height
    ret.quality = calculateImageQuality(width, height)
    ret.isLandscape = calculateImageOrientation(width, height)
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
