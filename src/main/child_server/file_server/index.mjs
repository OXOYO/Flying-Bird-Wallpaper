/**
 * 文件服务子进程
 * */
import { readDirRecursive, calculateImageByPath } from '../../utils/utils.mjs'

process.parentPort.on('message', (e) => {
  const [port] = e.ports

  // 监听消息
  port.on('message', async (e) => {
    const { data } = e
    if (data.event === 'SERVER_START') {
      port.postMessage({
        event: 'SERVER_START::SUCCESS'
      })
    } else if (data.event === 'REFRESH_DIRECTORY') {
      try {
        const fileMap = new Map()
        for (let i = 0; i < data.folderPaths.length; i++) {
          const fileList = await readDirRecursive(
            data.resourceName,
            data.folderPaths[i],
            data.allowedFileExt
          )
          if (fileList.length) {
            for (let i = 0; i < fileList.length; i++) {
              const item = fileList[i]
              fileMap.set(item.filePath, item)
            }
          }
        }
        port.postMessage({
          event: 'REFRESH_DIRECTORY::SUCCESS',
          isManual: data.isManual,
          resourceName: data.resourceName,
          list: [...fileMap.values()]
        })
      } catch (err) {
        global.logger.error(`[FileServer] 刷新资源目录失败: ${err}`)
        port.postMessage({
          event: 'REFRESH_DIRECTORY::FAIL',
          isManual: data.isManual,
          resourceName: data.resourceName,
          list: []
        })
      }
    } else if (data.event === 'HANDLE_IMAGE_QUALITY') {
      try {
        const { list } = data
        const ret = []
        for (let i = 0; i < list.length; i++) {
          const imgData = await calculateImageByPath(list[i].filePath)
          ret.push({
            id: list[i].id,
            ...imgData
          })
        }
        port.postMessage({
          event: 'HANDLE_IMAGE_QUALITY::SUCCESS',
          resourceName: data.resourceName,
          list: ret
        })
      } catch (err) {
        global.logger.error(`[FileServer] 处理图片质量失败: ${err}`)
        port.postMessage({
          event: 'HANDLE_IMAGE_QUALITY::FAIL',
          resourceName: data.resourceName,
          list: []
        })
      }
    }
  })
  // FIXME [???] 开始发送该端口中的消息队列，使用 onmessage 已隐含调用该方法
  port.start()
})
