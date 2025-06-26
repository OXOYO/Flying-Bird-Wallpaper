import Koa from 'koa'
import KoaRouter from '@koa/router'
import staticServe from 'koa-static'
import compress from 'koa-compress'
import { bodyParser } from '@koa/bodyparser'
import { Server } from 'socket.io'
import http from 'http'
import http2 from 'http2'
import fs from 'fs' // 添加fs模块用于读取证书文件
import path from 'path'
import zlib from 'zlib'
import { fileURLToPath } from 'url'
import { getLocalIP, findAvailablePort, generateSelfSignedCert } from '../../utils/utils.mjs' // 添加证书生成函数
import useApi from './api/index.mjs'
import { t } from '../../../i18n/server.js'
import setupSocketIO from './socket/index.mjs'

// 创建 Koa 服务器
export default async ({
  port = 8888,
  host = '0.0.0.0',
  useHttps = true, // 添加HTTPS选项
  dbManager,
  settingManager,
  resourcesManager,
  fileManager,
  logger = () => {},
  postMessage = () => {},
  onStartSuccess = () => {},
  onStartFail = () => {}
} = {}) => {
  let httpServer
  let ioServer
  try {
    const __dirname = path.dirname(fileURLToPath(import.meta.url))
    const isProduction = process.env.NODE_ENV === 'production'
    port = await findAvailablePort(port)
    host = getLocalIP()

    // 创建 Koa 服务器
    const app = new Koa()

    // 创建服务器 (HTTP 或 HTTPS)
    if (useHttps) {
      // 证书路径
      const certPath = process.env.FBW_CERTS_PATH
      let sslOptions

      // 检查证书文件是否存在
      try {
        sslOptions = {
          key: fs.readFileSync(path.join(certPath, 'private.key')),
          cert: fs.readFileSync(path.join(certPath, 'certificate.crt'))
        }
      } catch (err) {
        // 证书不存在，生成自签名证书
        logger.info('[H5Server] INFO => 未找到SSL证书，正在生成自签名证书...')

        // 确保证书目录存在
        if (!fs.existsSync(certPath)) {
          fs.mkdirSync(certPath, { recursive: true })
        }

        // 生成自签名证书
        const { key, cert } = generateSelfSignedCert(host)

        // 保存证书
        fs.writeFileSync(path.join(certPath, 'private.key'), key)
        fs.writeFileSync(path.join(certPath, 'certificate.crt'), cert)

        sslOptions = { key, cert }
      }

      // 创建HTTPS服务器
      httpServer = http2.createSecureServer(sslOptions, app.callback())
      logger.info('[H5Server] INFO => 已创建HTTPS服务器')
    } else {
      // 创建HTTP服务器
      httpServer = http.createServer(app.callback())
    }

    // 创建 Socket.IO 服务器
    ioServer = new Server(httpServer, {
      cors: {
        origin: '*',
        methods: ['GET', 'POST']
      },
      // 添加性能优化配置
      transports: ['websocket', 'polling'], // 优先使用websocket
      pingTimeout: 30000,
      pingInterval: 25000,
      upgradeTimeout: 10000,
      maxHttpBufferSize: 1e6 // 1MB
    })

    // 包装 postMessage 函数，确保它能正常工作
    const safePostMessage = (data) => {
      try {
        return postMessage(data)
      } catch (err) {
        logger.error(`[H5Server] ERROR => postMessage 错误: ${err}`)
        return false
      }
    }

    // 使用中间件方式挂载方法
    app.use(async (ctx, next) => {
      // 绑定方法到 ctx 对象
      ctx.t = t
      ctx.logger = logger
      ctx.postMessage = safePostMessage
      ctx.ioServer = ioServer // 将 Socket.IO 实例添加到上下文

      await next()
    })
    app.use(
      compress({
        filter(content_type) {
          return /text|javascript|css/i.test(content_type)
        },
        threshold: 2048,
        gzip: {
          flush: zlib.constants.Z_SYNC_FLUSH
        },
        deflate: {
          flush: zlib.constants.Z_SYNC_FLUSH
        },
        br: {
          flush: zlib.constants.Z_SYNC_FLUSH
        }
      })
    )

    // 解析请求体
    app.use(bodyParser())
    const staticPath = isProduction
      ? path.resolve(process.env.FBW_RESOURCES_PATH, './h5')
      : path.resolve(__dirname, '../h5')
    logger.info(`[H5Server] INFO => H5静态资源路径: ${staticPath}`)
    // 提供静态资源服务
    app.use(
      staticServe(staticPath, {
        // 添加静态资源服务配置，提高性能
        maxage: 86400000, // 缓存一天
        gzip: true, // 启用gzip压缩
        br: true, // 启用brotli压缩(如果可用)
        setHeaders: (res) => {
          res.setHeader('Access-Control-Allow-Origin', '*')
          res.setHeader('Cache-Control', 'public, max-age=86400')
        }
      })
    )

    // 创建路由 - 仅保留 getImage 接口
    const router = new KoaRouter()

    // 注册 http 接口
    useApi(router)

    // 注册路由中间件
    app.use(router.routes()).use(router.allowedMethods())
    try {
      // 设置 Socket.IO - 等待初始化完成
      await setupSocketIO(ioServer, {
        t,
        dbManager,
        settingManager,
        resourcesManager,
        fileManager,
        logger,
        postMessage: safePostMessage
      })
    } catch (err) {
      typeof onStartFail === 'function' &&
        onStartFail({
          msg: `Socket.IO 初始化失败: ${err}`
        })
    }

    logger.info('[H5Server] INFO => Socket.IO 初始化完成，准备启动服务器')

    // 添加性能优化中间件
    app.use(async (ctx, next) => {
      // 设置缓存控制头
      ctx.set('Cache-Control', 'public, max-age=86400')
      ctx.set('X-Content-Type-Options', 'nosniff')
      await next()
    })

    // 启动服务器
    httpServer.listen(port, host, () => {
      const protocol = useHttps ? 'https' : 'http'
      const serverUrl = `${protocol}://${host}:${port}`
      typeof onStartSuccess === 'function' && onStartSuccess(serverUrl)
    })

    // 处理端口被占用的情况
    httpServer.on('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        logger.error(`[H5Server] ERROR => 端口 ${port} 已被占用，尝试使用其他端口...`)
        // 关闭当前服务器
        httpServer.close()

        // 尝试使用新端口重新启动
        findAvailablePort(port + 1)
          .then((newPort) => {
            logger.info(`[H5Server] INFO => 尝试使用新端口: ${newPort}`)
            httpServer.listen(newPort, host)
          })
          .catch((err) => {
            typeof onStartFail === 'function' &&
              onStartFail({
                msg: `查找可用端口失败: ${err}`
              })
          })
      } else {
        typeof onStartFail === 'function' &&
          onStartFail({
            msg: `服务器错误: ${err}`
          })
      }
    })
  } catch (err) {
    typeof onStartFail === 'function' &&
      onStartFail({
        msg: `服务器启动失败: ${err}`
      })
  }
  return {
    httpServer,
    ioServer
  }
}
