const readJsonBody = async (ctx) => {
  const req = ctx.req
  return await new Promise((resolve) => {
    let data = ''
    req.on('data', (chunk) => {
      data += chunk
    })
    req.on('end', () => {
      if (!data) {
        resolve({})
        return
      }
      try {
        resolve(JSON.parse(data))
      } catch (err) {
        resolve({})
      }
    })
    req.on('error', () => resolve({}))
  })
}

const sendJson = (ctx, payload) => {
  ctx.set('Content-Type', 'application/json; charset=utf-8')
  ctx.body = payload
}

const normalizeSearchPayload = (payload = {}) => {
  const rawPage = Number(payload.startPage ?? payload.page ?? 1)
  const startPage =
    Number.isFinite(rawPage) && rawPage >= 1 ? Math.min(Math.floor(rawPage), 1_000_000) : 1
  const rawSize = Number(payload.pageSize ?? 20)
  const pageSize =
    Number.isFinite(rawSize) && rawSize >= 1 ? Math.min(Math.floor(rawSize), 200) : 20
  return {
    ...payload,
    filterKeywords: payload.filterKeywords ?? payload.keywords ?? '',
    startPage,
    pageSize
  }
}

export const registerBusinessApi = (router, deps) => {
  const { t, dbManager, settingManager, resourcesManager, fileManager, postMessage, sseHub, logger } = deps

  router.get('/api/events', async (ctx) => {
    ctx.req.setTimeout(0)
    ctx.respond = false
    const res = ctx.res
    const isHttp2 = Number(ctx.req?.httpVersionMajor || 1) >= 2
    const sseHeaders = {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Access-Control-Allow-Origin': '*'
    }
    // HTTP/2 禁止 connection 头，否则可能触发协议错误
    if (!isHttp2) {
      sseHeaders.Connection = 'keep-alive'
    }
    res.writeHead(200, sseHeaders)
    res.write(': connected\n\n')
    const client = { id: `${Date.now()}_${Math.random()}`, res }
    sseHub.clients.add(client)
    const heartbeat = setInterval(() => {
      try {
        res.write(': heartbeat\n\n')
      } catch (err) {
        clearInterval(heartbeat)
      }
    }, 20000)
    reqCleanup(ctx.req, () => {
      clearInterval(heartbeat)
      sseHub.clients.delete(client)
    })
  })

  router.get('/api/setting/get', async (ctx) => {
    const ret = await settingManager.getSettingData()
    sendJson(ctx, ret)
  })

  router.post('/api/setting/update', async (ctx) => {
    const data = await readJsonBody(ctx)
    const ret = await settingManager.updateSettingData(data, true)
    if (ret.success && ret.data) {
      postMessage({
        event: 'H5_SETTING_UPDATED',
        data: ret.data
      })
      sseHub.broadcast('settingUpdated', ret)
    }
    sendJson(ctx, ret)
  })

  router.get('/api/resources/map', async (ctx) => {
    const ret = await dbManager.getResourceMap()
    sendJson(ctx, ret)
  })

  router.post('/api/search/images', async (ctx) => {
    const payload = await readJsonBody(ctx)
    const ret = await resourcesManager.search(normalizeSearchPayload(payload))
    sendJson(ctx, ret)
  })

  router.post('/api/favorites/toggle', async (ctx) => {
    const { id } = await readJsonBody(ctx)
    if (!id) {
      sendJson(ctx, { success: false, message: t('messages.operationFail') })
      return
    }
    const isFavorite = await resourcesManager.checkFavorite(id)
    const ret = isFavorite
      ? await resourcesManager.removeFavorites(id)
      : await resourcesManager.addToFavorites(id)
    sendJson(ctx, ret)
  })

  router.post('/api/favorites/add', async (ctx) => {
    const { id } = await readJsonBody(ctx)
    const ret = await resourcesManager.addToFavorites(id)
    sendJson(ctx, ret)
  })

  router.post('/api/favorites/remove', async (ctx) => {
    const { id } = await readJsonBody(ctx)
    const ret = await resourcesManager.removeFavorites(id)
    sendJson(ctx, ret)
  })

  router.post('/api/statistics/favorite', async (ctx) => {
    const { id, count = 1 } = await readJsonBody(ctx)
    const ret = await resourcesManager.updateStatistics({ resourceId: id, favorites: count })
    sendJson(ctx, ret)
  })

  router.post('/api/statistics/download', async (ctx) => {
    const { id, count = 1 } = await readJsonBody(ctx)
    const ret = await resourcesManager.updateStatistics({ resourceId: id, downloads: count })
    sendJson(ctx, ret)
  })

  router.post('/api/images/delete', async (ctx) => {
    const item = await readJsonBody(ctx)
    const ret = await fileManager.deleteFile(item)
    sendJson(ctx, ret)
  })

  router.get('/api/hot-tags', async (ctx) => {
    const resourceName = ctx.request.query?.resourceName || ''
    try {
      const ret = await resourcesManager.getHotTags({ resourceName })
      sendJson(ctx, ret)
    } catch (err) {
      logger.error(`[H5Server] ERROR => 获取热门标签失败: ${err}`)
      sendJson(ctx, { success: true, data: { tags: [] } })
    }
  })
}

const reqCleanup = (req, cb) => {
  const done = () => cb()
  req.on('close', done)
  req.on('error', done)
}
