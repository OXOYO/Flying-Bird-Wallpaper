import { utilityProcess, MessageChannelMain } from 'electron'

export default class ChildServer {
  #serverName
  #serverPath
  #child
  #port2

  constructor(serverName, serverPath) {
    global.logger.info(
      `ChildServer INIT:: serverName => ${serverName}, serverPath => ${serverPath}`
    )
    this.#serverName = serverName
    this.#serverPath = serverPath
    this.#child = null
    this.#port2 = null
  }

  start({ options, onMessage = () => {} } = {}) {
    const { port1, port2 } = new MessageChannelMain()
    this.#child = utilityProcess.fork(this.#serverPath, options)
    global.logger.info(`ChildServer START:: serverName => ${this.#serverName}`)
    this.#port2 = port2

    this.#child.on('exit', () => {
      global.logger.info(`ChildServer EXIT:: serverName => ${this.#serverName}`)
      this.#child = null
      this.#port2 = null
    })

    this.#port2.on('message', onMessage)
    // FIXME [???] 开始发送该端口中的消息队列，使用 onmessage 已隐含调用该方法
    this.#port2.start()
    // 初始消息
    this.#child.postMessage(
      {
        serverName: this.#serverName,
        event: 'SERVER_FORKED'
      },
      [port1]
    )
    // 服务启动消息
    this.postMessage({
      serverName: this.#serverName,
      event: 'SERVER_START'
    })
  }

  stop(callback) {
    global.logger.info(`ChildServer STOP:: serverName => ${this.#serverName}`)
    if (!this.#child) {
      global.logger.info(
        `ChildServer STOP FAILED:: SERVER NOT START, serverName => ${this.#serverName}`
      )
      return
    }
    const isSuccess = this.#child?.kill()
    typeof callback === 'function' && callback(isSuccess)
  }

  restart({ params, onMessage = () => {}, stopCallback = () => {} } = {}) {
    this.stop(stopCallback)
    this.start({ params, onMessage })
  }

  postMessage(data) {
    this.#port2?.postMessage(data)
  }
}
