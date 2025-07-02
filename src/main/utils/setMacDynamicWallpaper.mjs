import { app } from 'electron'
import path from 'node:path'

export default function setMacDynamicWallpaper(handles) {
  if (process.platform !== 'darwin') return false

  const Koffi = require('koffi')
  let dllPath

  if (app.isPackaged) {
    dllPath = path.join(
      __dirname,
      '..',
      '..',
      '..',
      'app.asar.unpacked',
      'resources',
      'lib',
      'test.dylib'
    )
  } else {
    dllPath = path.join(app.getAppPath(), 'resources', 'lib', 'test.dylib')
  }

  try {
    const myLibrary = Koffi.load(dllPath)
    // 修改函数定义，使用 long long 类型
    const setWindowLevelToDesktop = myLibrary.func('setWindowLevelToDesktop', 'void', ['long long'])
    setWindowLevelToDesktop(handles)
    return true
  } catch (err) {
    console.error('加载动态壁纸库失败:', err)
    global.logger.error(`加载动态壁纸库失败: ${err}`)
    return false
  }
}
