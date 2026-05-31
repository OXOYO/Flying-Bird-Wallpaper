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

const createCollectionsManager = async (deps) => {
  const { logger, dbManager, settingManager, resourcesManager } = deps
  const CollectionsManager = (await import('../../../store/CollectionsManager.mjs')).default
  const TextQueryParser = (await import('../../../ai/TextQueryParser.mjs')).default
  const EmbeddingManager = (await import('../../../ai/EmbeddingManager.mjs')).default
  const parser = TextQueryParser.getInstance(logger, settingManager)
  const embeddingManager = EmbeddingManager.getInstance(logger, dbManager.db, settingManager)
  const cm = CollectionsManager.getInstance(
    logger,
    dbManager,
    settingManager,
    resourcesManager,
    parser,
    embeddingManager
  )
  return { cm, embeddingManager, parser }
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
    const normalized = normalizeSearchPayload(payload)
    const useSemanticSearch = !!settingManager.settingData?.search?.useSemanticSearch
    const resourceName = String(normalized.resourceName || '')
    const skipSemanticSearch =
      resourceName === 'favorites' ||
      resourceName === 'history' ||
      resourceName === 'privacy_space'
    if (useSemanticSearch && normalized.filterKeywords && !skipSemanticSearch) {
      const EmbeddingManager = (await import('../../../ai/EmbeddingManager.mjs')).default
      const embeddingManager = EmbeddingManager.getInstance(logger, dbManager.db, settingManager)
      const ret = await resourcesManager.semanticSearch({
        ...normalized,
        embeddingManager
      })
      sendJson(ctx, ret)
      return
    }
    const ret = await resourcesManager.search({
      ...normalized
    })
    sendJson(ctx, ret)
  })

  router.post('/api/ai/parse-search', async (ctx) => {
    const { query } = await readJsonBody(ctx)
    const TextQueryParser = (await import('../../../ai/TextQueryParser.mjs')).default
    const parser = TextQueryParser.getInstance(logger, settingManager)
    sendJson(ctx, await parser.parseSearchQuery(query))
  })

  router.post('/api/ai/analyze', async (ctx) => {
    const { id } = await readJsonBody(ctx)
    const AiAnalysisManager = (await import('../../../ai/AiAnalysisManager.mjs')).default
    const WordsManager = (await import('../../../store/WordsManager.mjs')).default
    const EmbeddingManager = (await import('../../../ai/EmbeddingManager.mjs')).default
    const wordsManager = WordsManager.getInstance(logger, dbManager, settingManager)
    const embeddingManager = EmbeddingManager.getInstance(logger, dbManager.db, settingManager)
    const aiMgr = AiAnalysisManager.getInstance(
      logger,
      dbManager,
      settingManager,
      wordsManager,
      embeddingManager
    )
    sendJson(ctx, await aiMgr.analyzeResourceById(id))
  })

  router.get('/api/collections/list', async (ctx) => {
    const { cm } = await createCollectionsManager({ logger, dbManager, settingManager, resourcesManager })
    sendJson(ctx, cm.list())
  })

  router.get('/api/collections/get', async (ctx) => {
    const id = ctx.request.query?.id
    if (!id) {
      sendJson(ctx, { success: false, message: t('messages.operationFail') })
      return
    }
    const rawPage = Number(ctx.request.query?.startPage ?? 1)
    const startPage =
      Number.isFinite(rawPage) && rawPage >= 1 ? Math.min(Math.floor(rawPage), 1_000_000) : 1
    const rawSize = Number(ctx.request.query?.pageSize ?? 20)
    const pageSize =
      Number.isFinite(rawSize) && rawSize >= 1 ? Math.min(Math.floor(rawSize), 200) : 20
    const { cm } = await createCollectionsManager({ logger, dbManager, settingManager, resourcesManager })
    sendJson(ctx, cm.get(id, { startPage, pageSize }))
  })

  router.post('/api/collections/create', async (ctx) => {
    const body = await readJsonBody(ctx)
    const { cm } = await createCollectionsManager({ logger, dbManager, settingManager, resourcesManager })
    if (body.prompt) {
      sendJson(ctx, await cm.createFromPrompt(body.prompt))
    } else {
      sendJson(ctx, cm.create(body))
    }
  })

  router.post('/api/collections/update', async (ctx) => {
    const body = await readJsonBody(ctx)
    const { cm } = await createCollectionsManager({ logger, dbManager, settingManager, resourcesManager })
    sendJson(ctx, cm.update(body?.id, body))
  })

  router.post('/api/collections/generate', async (ctx) => {
    const { id, queryJson } = await readJsonBody(ctx)
    if (!id) {
      sendJson(ctx, { success: false, message: t('messages.operationFail') })
      return
    }
    const { cm } = await createCollectionsManager({ logger, dbManager, settingManager, resourcesManager })
    sendJson(ctx, await cm.generate(id, queryJson))
  })

  router.post('/api/collections/delete', async (ctx) => {
    const { id } = await readJsonBody(ctx)
    const { cm } = await createCollectionsManager({ logger, dbManager, settingManager, resourcesManager })
    sendJson(ctx, cm.delete(id))
  })

  router.post('/api/collections/add-all-favorites', async (ctx) => {
    const { id } = await readJsonBody(ctx)
    const { cm } = await createCollectionsManager({ logger, dbManager, settingManager, resourcesManager })
    sendJson(ctx, await cm.addAllToFavorites(id))
  })

  router.post('/api/collections/curate', async (ctx) => {
    const CollectionCurator = (await import('../../../store/CollectionCurator.mjs')).default
    const curator = CollectionCurator.getInstance(logger, dbManager, settingManager)
    const locks = { collectionCurator: false }
    const ret = await curator.run(locks, { manual: true, pipelineStable: true })
    sendJson(ctx, ret)
  })

  router.get('/api/collections/curator-stats', async (ctx) => {
    const CollectionCurator = (await import('../../../store/CollectionCurator.mjs')).default
    const AiAnalysisManager = (await import('../../../ai/AiAnalysisManager.mjs')).default
    const WordsManager = (await import('../../../store/WordsManager.mjs')).default
    const EmbeddingManager = (await import('../../../ai/EmbeddingManager.mjs')).default
    const { buildCuratorFooterStats } = await import('../../../store/collectionCurateGate.mjs')
    const wordsManager = WordsManager.getInstance(logger, dbManager, settingManager)
    const embeddingManager = EmbeddingManager.getInstance(logger, dbManager.db, settingManager)
    const aiMgr = AiAnalysisManager.getInstance(
      logger,
      dbManager,
      settingManager,
      wordsManager,
      embeddingManager
    )
    const curator = CollectionCurator.getInstance(logger, dbManager, settingManager).getStats()
    const analysis = aiMgr.getStats()?.data || {}
    const ai = settingManager.settingData?.ai || {}
    sendJson(ctx, { success: true, data: buildCuratorFooterStats(curator, analysis, ai) })
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
    const { id, isPrivacySpace } = await readJsonBody(ctx)
    const ret = await resourcesManager.addToFavorites(id, !!isPrivacySpace)
    sendJson(ctx, ret)
  })

  router.post('/api/favorites/remove', async (ctx) => {
    const { id, isPrivacySpace } = await readJsonBody(ctx)
    const ret = await resourcesManager.removeFavorites(id, !!isPrivacySpace)
    sendJson(ctx, ret)
  })

  router.get('/api/privacy/has-password', async (ctx) => {
    const ret = await settingManager.hasPrivacyPassword()
    sendJson(ctx, ret)
  })

  router.get('/api/privacy/password-hint', async (ctx) => {
    const ret = await settingManager.getPrivacyPasswordHint()
    sendJson(ctx, ret)
  })

  router.post('/api/privacy/check-password', async (ctx) => {
    const { password } = await readJsonBody(ctx)
    const ret = await settingManager.checkPrivacyPassword(password)
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

  router.get('/api/resources/tags', async (ctx) => {
    const resourceId = Number(ctx.request.query?.resourceId)
    try {
      const WordsManager = (await import('../../../store/WordsManager.mjs')).default
      const wm = WordsManager.getInstance(logger, dbManager, settingManager)
      sendJson(ctx, wm.getResourceTags(resourceId))
    } catch (err) {
      logger.error(`[H5Server] ERROR => 获取资源标签失败: ${err}`)
      sendJson(ctx, { success: false, data: [] })
    }
  })
}

const reqCleanup = (req, cb) => {
  const done = () => cb()
  req.on('close', done)
  req.on('error', done)
}
