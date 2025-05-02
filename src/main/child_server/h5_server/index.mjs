/**
 * h5服务子进程
 * */
import server from './server.mjs'

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
        msg: ''
      }
      if (typeof data === 'string') {
        postData.msg = data
      } else if (typeof data === 'object') {
        postData.msg = JSON.stringify(data)
      }
      port.postMessage(postData)
    }
  }
  // 监听消息
  port.on('message', async (e) => {
    const { data } = e
    // 启动h5服务
    if (data.event === 'SERVER_START') {
      server({
        onStartSuccess: (url) => {
          port.postMessage({
            event: 'SERVER_START::SUCCESS',
            url
          })
        },
        onStartFail: (data) => {
          port.postMessage({
            event: 'SERVER_START::FAIL',
            ...data
          })
        },
        logger: {
          info: handleLogger('info'),
          warn: handleLogger('warn'),
          error: handleLogger('error')
        },
        postMessage: (data) => {
          if (!data) {
            return
          }
          port.postMessage(data)
        }
      })
    }
  })
  // FIXME [???] 开始发送该端口中的消息队列，使用 onmessage 已隐含调用该方法
  port.start()
})
