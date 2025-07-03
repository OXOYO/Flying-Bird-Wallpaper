/**
 * 文件服务子进程
 * */
import { readDirRecursive, calculateImageByPath } from '../../utils/utils.mjs'

process.parentPort.on('message', (e) => {
  const [port] = e.ports

  const handleLogger = (type = 'info') => {
    return (data) => {
      if (!data) {
        return
      }
      const postData = {
        event: 'SERVER_LOG',
        level: type,
        message: ''
      }
      if (typeof data === 'string') {
        postData.message = data
      } else if (typeof data === 'object') {
        postData.message = JSON.stringify(data)
      }
      port.postMessage(postData)
    }
  }
  const logger = {
    info: handleLogger('info'),
    warn: handleLogger('warn'),
    error: handleLogger('error')
  }
  // 监听消息
  port.on('message', async (e) => {
    const { data } = e

    // 分批处理大量文件
    const processBatch = async (files, batchSize = 1000) => {
      const results = []
      for (let i = 0; i < files.length; i += batchSize) {
        const batch = files.slice(i, i + batchSize)
        results.push(...batch)

        // 允许事件循环处理其他任务
        await new Promise((resolve) => setTimeout(resolve, 0))
      }
      return results
    }

    if (data.event === 'SERVER_START') {
      port.postMessage({
        event: 'SERVER_START::SUCCESS'
      })
    } else if (data.event === 'REFRESH_DIRECTORY') {
      const readDirTime = {
        start: Date.now(),
        end: Date.now()
      }
      try {
        // 获取现有文件列表（如果有）
        const existingFiles = data.existingFiles || []

        const fileMap = new Map()

        // 并行处理多个目录
        const dirPromises = data.folderPaths.map((folderPath) =>
          readDirRecursive(data.resourceName, folderPath, data.allowedFileExt, existingFiles)
        )
        // 等待所有目录处理完成
        const results = await Promise.all(dirPromises)

        // 合并结果
        for (const fileList of results) {
          if (fileList && fileList.length) {
            for (const item of fileList) {
              fileMap.set(item.filePath, item)
            }
          }
        }

        readDirTime.end = Date.now()

        // 添加统计信息
        const stats = {
          newFiles: fileMap.size,
          modifiedFiles: 0,
          totalProcessed: fileMap.size
        }

        // 对于大量文件，使用批量处理
        if (fileMap.size > 5000) {
          // 先发送一个处理中的消息
          port.postMessage({
            event: 'REFRESH_DIRECTORY::PROCESSING',
            isManual: data.isManual,
            resourceName: data.resourceName,
            totalFiles: fileMap.size,
            refreshDirStartTime: data.refreshDirStartTime,
            readDirTime
          })

          // 分批处理文件
          const batchedList = await processBatch([...fileMap.values()], 1000)

          // 发送最终结果
          port.postMessage({
            event: 'REFRESH_DIRECTORY::SUCCESS',
            isManual: data.isManual,
            resourceName: data.resourceName,
            list: batchedList,
            stats,
            refreshDirStartTime: data.refreshDirStartTime,
            readDirTime
          })
        } else {
          // 对于少量文件，直接发送
          port.postMessage({
            event: 'REFRESH_DIRECTORY::SUCCESS',
            isManual: data.isManual,
            resourceName: data.resourceName,
            list: [...fileMap.values()],
            stats,
            refreshDirStartTime: data.refreshDirStartTime,
            readDirTime
          })
        }
      } catch (err) {
        logger.error(`[FileServer] ERROR => 刷新资源目录失败: ${err}`)
        readDirTime.end = Date.now()
        port.postMessage({
          event: 'REFRESH_DIRECTORY::FAIL',
          isManual: data.isManual,
          resourceName: data.resourceName,
          list: [],
          refreshDirStartTime: data.refreshDirStartTime,
          readDirTime
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
        logger.error(`[FileServer] ERROR => 处理图片质量失败: ${err}`)
        port.postMessage({
          event: 'HANDLE_IMAGE_QUALITY::FAIL',
          resourceName: data.resourceName,
          list: []
        })
      }
    }
  })

  port.start()
})
