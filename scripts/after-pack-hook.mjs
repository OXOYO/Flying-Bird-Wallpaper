/**
 * 打包后hooks
 */
import fs from 'node:fs'
import path from 'node:path'

export default async function (context) {
  // 在 macOS 和 Windows 平台上都清理 .lproj 目录
  let resourcesDir;
  
  if (context.packager.platform.nodeName === 'darwin') {
    // macOS 平台路径
    resourcesDir = path.join(
      context.appOutDir,
      'Flying Bird Wallpaper.app',
      'Contents',
      'Resources'
    )
  } else if (context.packager.platform.nodeName === 'win32') {
    // Windows 平台路径
    resourcesDir = path.join(context.appOutDir, 'resources')
  } else {
    // 其他平台不处理
    return
  }

  // 检查目录是否存在
  if (!fs.existsSync(resourcesDir)) {
    console.warn(`Resources目录不存在: ${resourcesDir}`)
    return
  }

  fs.readdir(resourcesDir, function (err, files) {
    if (err) {
      console.error('读取Resources目录失败:', err)
      return
    }
    if (!(files && files.length)) {
      console.warn('Resources目录为空')
      return
    }
    for (let i = 0, len = files.length; i < len; i++) {
      // 检查.lproj目录是否为空
      if (files[i].endsWith('.lproj')) {
        const dirPath = path.join(resourcesDir, files[i])
        try {
          const dirFiles = fs.readdirSync(dirPath)
          if (dirFiles.length === 0) {
            fs.rmSync(dirPath, { recursive: true })
            console.log(`删除空目录: ${files[i]}`)
          }
        } catch (error) {
          console.error(`处理目录 ${files[i]} 时出错:`, error)
        }
      }
    }
    console.log('Resources目录清理完成')
  })
}