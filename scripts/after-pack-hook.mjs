/**
 * 打包后hooks
 */
import fs from 'node:fs'
import path from 'node:path'

export default async function (context) {
  // 清理打包后的.lproj目录
  const resourcesDir = path.join(
    context.appOutDir,
    'Flying Bird Wallpaper.app',
    'Contents',
    'Resources'
  )
  fs.readdir(resourcesDir, function (err, files) {
    if (err) {
      console.error('读取Resources目录失败:', err)
      return
    }
    if (!(files && files.length)) {
      console.error('Resources目录为空')
      return
    }
    for (let i = 0, len = files.length; i < len; i++) {
      // 检查.lproj目录是否为空
      if (files[i].endsWith('.lproj')) {
        const dirPath = path.join(resourcesDir, files[i])
        const dirFiles = fs.readdirSync(dirPath)
        if (dirFiles.length === 0) {
          fs.rmSync(dirPath, { recursive: true })
          console.log(`删除空目录: ${files[i]}`)
        }
      }
    }
    console.log('Resources目录清理完成')
  })
}
