import { app, ipcMain, BrowserWindow, screen, powerMonitor } from 'electron'
import path from 'node:path'
import fs from 'node:fs'
import { createFileServer, createH5Server } from '../child_server/index.mjs'
import { t, changeLanguage } from '../../i18n/server.js'
import { systemLocaleMap } from '../../i18n/locale/index.js'
import DatabaseManager from './DatabaseManager.mjs'
import ApiManager from './ApiManager.mjs'
import ResourcesManager from './ResourcesManager.mjs'
import WallpaperManager from './WallpaperManager.mjs'
import TaskScheduler from './TaskScheduler.mjs'
import FileManager from './FileManager.mjs'
import WordsManager from './WordsManager.mjs'
import SettingManager from './SettingManager.mjs'
import VersionManager from './VersionManager.mjs'
import ShortcutManager from './ShortcutManager.mjs'
import NotificationManager from './NotificationManager.mjs'
import PluginManager from './PluginManager.mjs'
import AiAnalysisManager from '../ai/AiAnalysisManager.mjs'
import EmbeddingManager from '../ai/EmbeddingManager.mjs'
import TextQueryParser from '../ai/TextQueryParser.mjs'
import CollectionsManager from './CollectionsManager.mjs'
import CollectionCurator from './CollectionCurator.mjs'
import RecommendManager from './RecommendManager.mjs'
import {
  buildAutoCurateLatchFields,
  buildClearAutoCurateLatchFields,
  buildCuratorFooterStats,
  isAiPipelineStable,
  isAnalysisQueueStable,
  isAutoCurateSettled,
  shouldRunScheduledAutoCurate
} from './collectionCurateGate.mjs'
import { handleTimeByUnit } from '../utils/utils.mjs'
import {
  normalizeSourceName,
  validateSourceName
} from '../../common/pluginResourceId.js'
import {
  applyPluginSourceRename,
  runPluginResourceIdMigration
} from './pluginResourceMigration.mjs'
import {
  AI_ANALYSIS_PUMP_START_DELAY_MS,
  AI_ANALYSIS_WATCHDOG_MS,
  VISUAL_EMBED_PUMP_START_DELAY_MS,
  VISUAL_EMBED_WATCHDOG_MS
} from '../ai/aiConstants.mjs'
import { normalizeDownloadMediaTypes } from '../../common/publicData.js'

const parsePositiveId = (value) => {
  const id = Number(value)
  return Number.isFinite(id) && id > 0 ? id : null
}

const buildResolveResourceError = (resolved) => ({
  success: false,
  message: resolved.message || t('messages.operationFail'),
  errorCode: resolved.errorCode
})

const attachResolvedResourceToResult = (resourcesManager, ret, resourceId, resourceRow) => {
  if (!ret?.success || !resourceRow) return ret
  const resource = resourcesManager.enrichResourceForClient(resourceRow)
  if (ret.data && typeof ret.data === 'object' && !Array.isArray(ret.data)) {
    ret.data = { ...ret.data, resourceId, resource }
  } else {
    ret.data = { ...(ret.data != null ? { result: ret.data } : {}), resourceId, resource }
  }
  return ret
}

async function resolveResourceFromParams(store, params, { downloadIfRemote = false } = {}) {
  if (params?.item) {
    const resolved = await store.resourcesManager.resolveResourceIdForClient(params.item, {
      downloadIfRemote
    })
    if (!resolved.ok) {
      return { error: buildResolveResourceError(resolved) }
    }
    return { resourceId: resolved.resourceId, resourceRow: resolved.resourceRow }
  }
  const resourceId = parsePositiveId(params?.id ?? params?.resourceId)
  if (!resourceId) {
    return { error: { success: false, message: t('messages.operationFail') } }
  }
  return {
    resourceId,
    resourceRow: store.resourcesManager.getResourceRowById(resourceId)
  }
}

export default class Store {
  constructor() {
    // 初始化完成标志
    this._initialized = false

    // 锁
    this.locks = {
      refreshDirectory: false,
      handleQuality: false,
      handleWords: false,
      aiAnalysis: false,
      collectionsRefresh: false,
      collectionCurator: false,
      visualEmbed: false
    }

    this.collectionCuratorTimer = null
    this._mainUiReady = false
    this._backgroundAiScheduled = false

    // 添加电源状态标志
    this.powerState = {
      isSystemIdle: false,
      wasAutoSwitchEnabled: false,
      wasAutoRefreshWebEnabled: false,
      isOnBattery: false,
      wasPausedByBattery: false
    }

    // 初始化时等待设置加载完成
    this._initPromise = this._init()
  }

  // 初始化方法
  async _init() {
    try {
      // 初始化数据库管理器
      this.dbManager = DatabaseManager.getInstance(global.logger)
      // 等待数据库管理器初始化完成
      await this.dbManager.waitForInitialization()
      this.db = this.dbManager.db

      // 初始化版本管理器
      this.versionManager = VersionManager.getInstance(global.logger, this.dbManager)
      await this.versionManager.waitForInitialization()

      // 初始化设置管理器
      this.settingManager = SettingManager.getInstance(global.logger, this.dbManager)
      // 等待设置管理器初始化完成
      await this.settingManager.waitForInitialization()

      // 初始化通知管理器
      this.notificationManager = NotificationManager.getInstance(global.logger, this.settingManager)
      // 等待通知管理器初始化完成
      await this.notificationManager.waitForInitialization()

      // 初始化插件管理器
      this.pluginManager = PluginManager.getInstance(global.logger, this.dbManager)

      // 初始化快捷键管理器
      this.shortcutManager = ShortcutManager.getInstance(global.logger, this.dbManager)
      // 等待快捷键管理器初始化完成
      await this.shortcutManager.waitForInitialization()

      // 检测是否已手动设置语言，未设置则使用系统语言
      const deviceLocale = this.getDeviceLocale()

      if (
        !this.settingData.isLocaleSet &&
        deviceLocale &&
        deviceLocale !== this.settingData.locale
      ) {
        global.logger.info(`应用初始化，更新应用语言为系统语言: ${deviceLocale}`)
        await this.updateSettingData({ locale: deviceLocale })
      } else {
        global.logger.info(`应用初始化，手动设置语言: ${this.settingData.locale}`)
        // 手动设置语言，应用语言变更
        await changeLanguage(this.settingData.locale)
      }
      // 初始化API管理器
      this.apiManager = ApiManager.getInstance(global.logger, this.dbManager)
      // 等待API管理器初始化完成
      await this.apiManager.waitForInitialization()

      // 文件服务子进程
      this.fileServer = createFileServer()

      // h5服务子进程
      this.h5Server = createH5Server()
      this.h5ServerUrl = null

      // 初始化其他管理器
      this.taskScheduler = TaskScheduler.getInstance(global.logger)
      this.wordsManager = WordsManager.getInstance(
        global.logger,
        this.dbManager,
        this.settingManager
      )
      this.fileManager = FileManager.getInstance(
        global.logger,
        this.dbManager,
        this.settingManager,
        this.fileServer,
        this.wordsManager
      )
      this.resourcesManager = ResourcesManager.getInstance(
        global.logger,
        this.dbManager,
        this.settingManager,
        this.apiManager
      )
      this.resourcesManager.setFileManager(this.fileManager)
      this.wallpaperManager = WallpaperManager.getInstance(
        global.logger,
        this.dbManager,
        this.settingManager,
        this.notificationManager,
        this.fileManager,
        this.apiManager
      )

      this.embeddingManager = EmbeddingManager.getInstance(
        global.logger,
        this.db,
        this.settingManager
      )
      this.aiAnalysisManager = AiAnalysisManager.getInstance(
        global.logger,
        this.dbManager,
        this.settingManager,
        this.wordsManager,
        this.embeddingManager
      )
      this.textQueryParser = TextQueryParser.getInstance(global.logger, this.settingManager)
      this.collectionsManager = CollectionsManager.getInstance(
        global.logger,
        this.dbManager,
        this.settingManager,
        this.resourcesManager,
        this.textQueryParser,
        this.embeddingManager,
        this.wordsManager
      )
      this.collectionCurator = CollectionCurator.getInstance(
        global.logger,
        this.dbManager,
        this.settingManager
      )
      this.aiAnalysisManager.onAnalysisDone = (resourceId) => {
        const ai = this.settingData?.ai || {}
        if (isAutoCurateSettled(ai)) {
          void this.collectionCurator.incrementalAddResource(resourceId)
          return
        }
        this.scheduleCollectionCurator()
        this.syncAutoCurateGateFromAnalysis()
      }
      this.aiAnalysisManager.onAnalysisBatchDone = () => this.syncAutoCurateGateFromAnalysis()
      setImmediate(() => {
        this.aiAnalysisManager.scheduleNormalizeReplay({
          reason: 'startup-version-check',
          profile: this.settingData?.ai?.promptProfile || 'default'
        })
      })
      this.embeddingManager.onEmbeddingDone = () => this.scheduleCollectionCurator(60 * 1000)
      this.embeddingManager.onVisualEmbeddingDone = () => this.scheduleCollectionCurator(60 * 1000)
      this.recommendManager = RecommendManager.getInstance(
        global.logger,
        this.dbManager,
        this.settingManager
      )
      this.wallpaperManager.textQueryParser = this.textQueryParser
      this.wallpaperManager.aiAnalysisManager = this.aiAnalysisManager

      await this.runPluginResourceIdBootstrap()

      // 处理IPC通信
      this.handleIpc()

      // 处理文件服务子进程启动
      this.handleFileServerStart()

      // 如果设置了自动启动H5服务，在初始化完成后启动
      if (this.settingData.startH5ServerOnStartup) {
        try {
          global.logger.info('初始化完成后启动H5服务...')
          // 添加延迟，给网络接口更多时间初始化
          setTimeout(() => {
            this.handleH5ServerStart(3, 2000)
          }, 5000) // 延迟5秒启动
        } catch (err) {
          global.logger.error(`初始化完成后启动H5服务失败: ${err.message}`)
        }
      }

      // 开启定时任务
      this.startScheduledTasks()
      this.ensurePostAnalysisCurateScheduled()
      this.syncAutoCurateGateFromAnalysis()

      // 处理开机自启动设置
      this.handleStartup()

      // 监听系统电源状态
      this.setupPowerMonitor()

      this._initialized = true
      global.logger.info('Store 初始化完成')
      return true
    } catch (err) {
      global.logger.error(`Store 初始化失败: ${err.message}`)
      return false
    }
  }

  // 等待初始化完成的方法
  async waitForInitialization() {
    if (this._initialized) {
      return true
    }
    return this._initPromise
  }

  get settingData() {
    return this.settingManager.settingData
  }

  getPluginResourceMigrationContext() {
    return {
      db: this.db,
      dbManager: this.dbManager,
      logger: global.logger,
      settingManager: this.settingManager,
      runtimePluginsDir: this.pluginManager?.runtimePluginsDir
    }
  }

  async runPluginResourceIdBootstrap() {
    try {
      const res = await runPluginResourceIdMigration(this.getPluginResourceMigrationContext())
      if (res.success && !res.skipped) {
        await this.refreshApiPlugins()
        global.logger.info(
          `[pluginResourceId] 本地库已迁移 resources=${res.stats?.resources ?? 0}`
        )
      }
    } catch (err) {
      global.logger.error(`[pluginResourceId] 迁移失败: ${err}`)
    }
  }

  async waitForAnalysisPumpSettle(maxMs = 120000) {
    const started = Date.now()
    while (this.aiAnalysisManager?.isRunning && Date.now() - started < maxMs) {
      await new Promise((r) => setTimeout(r, 200))
    }
  }

  async enterResourceMaintenance() {
    this.aiAnalysisManager?.setMaintenancePaused(true)
    this.locks.aiAnalysis = true
    this.stopAiAnalysisTask()
    this.wallpaperManager.resourceMaintenance = true
    this.stopDownloadTask()
    await this.waitForAnalysisPumpSettle()
  }

  async exitResourceMaintenance() {
    this.wallpaperManager.resourceMaintenance = false
    this.aiAnalysisManager?.setMaintenancePaused(false)
    this.locks.aiAnalysis = false
    if (this.settingData?.ai?.enabled) {
      this.startAiAnalysisTask()
      this.triggerBackgroundAnalysisPump()
    }
    if (this.settingData?.autoDownload) {
      this.startDownloadTask()
    }
  }

  async requeueRetryableAiAnalysis() {
    try {
      const res = this.aiAnalysisManager.requeueRetryableAiAnalysis()
      if (res?.success && res.data?.autoPump) {
        this.triggerBackgroundAnalysisPump()
      }
      return res
    } catch (err) {
      global.logger.error(`requeueRetryableAiAnalysis: ${err}`)
      return { success: false, message: t('messages.operationFail') }
    }
  }

  async requeueAllAiAnalysisWithoutClear() {
    try {
      const res = this.aiAnalysisManager.requeueAllAiAnalysisWithoutClear()
      if (res?.success && res.data?.autoPump) {
        this.triggerBackgroundAnalysisPump()
      }
      return res
    } catch (err) {
      global.logger.error(`requeueAllAiAnalysisWithoutClear: ${err}`)
      return { success: false, message: t('messages.operationFail') }
    }
  }

  async resetAiAnalysis() {
    await this.enterResourceMaintenance()
    try {
      return this.aiAnalysisManager.clearAllAiAnalysisData()
    } catch (err) {
      global.logger.error(`resetAiAnalysis: ${err}`)
      return { success: false, message: t('messages.operationFail') }
    } finally {
      await this.exitResourceMaintenance()
    }
  }

  async clearResourcesLibrary() {
    await this.enterResourceMaintenance()
    try {
      const res = await this.dbManager.clearResourcesLibrary()
      if (res.success) {
        const ai = this.settingData?.ai || {}
        if (isAutoCurateSettled(ai)) {
          const cleared = buildClearAutoCurateLatchFields(ai)
          this.settingManager.settingData.ai = cleared
          await this.settingManager.updateSettingData({ ai: cleared }).catch((err) => {
            global.logger.warn(`[clearResourcesLibrary] clear autoCurate latch failed: ${err}`)
          })
        }
      }
      return res
    } catch (err) {
      global.logger.error(`clearResourcesLibrary: ${err}`)
      return { success: false, message: t('messages.operationFail') }
    } finally {
      await this.exitResourceMaintenance()
    }
  }

  async renamePluginSource(oldSourceName, newSourceName) {
    const oldNorm = normalizeSourceName(oldSourceName)
    const newNorm = normalizeSourceName(newSourceName)
    if (!oldNorm || !newNorm || oldNorm === newNorm) {
      return { success: false, message: t('messages.operationFail') }
    }
    const nameCheck = validateSourceName(newNorm)
    if (!nameCheck.valid) {
      return {
        success: false,
        message: t('pages.Setting.pluginMarketplace.ops.invalidSourceName')
      }
    }
    const listRes = await this.pluginManager.getPluginSources()
    const sources = listRes.data || []
    if (!sources.some((s) => s.name === oldNorm)) {
      return {
        success: false,
        message: t('pages.Setting.pluginMarketplace.ops.sourceNotFound')
      }
    }
    if (sources.some((s) => s.name === newNorm)) {
      return {
        success: false,
        message: t('pages.Setting.pluginMarketplace.ops.sourceNameExists')
      }
    }
    const target = sources.find((s) => s.name === oldNorm)
    if (target?.isOfficial) {
      return {
        success: false,
        message: t('pages.Setting.pluginMarketplace.ops.officialSourceCannotRename')
      }
    }

    await this.enterResourceMaintenance()
    try {
      const res = await applyPluginSourceRename(
        this.getPluginResourceMigrationContext(),
        oldNorm,
        newNorm
      )
      if (!res.success) {
        return { success: false, message: res.message || t('messages.operationFail') }
      }
      await this.refreshApiPlugins()
      return {
        success: true,
        message: t('pages.Setting.pluginMarketplace.feedback.updateSourceSuccess')
      }
    } catch (err) {
      global.logger.error(`renamePluginSource: ${err}`)
      return { success: false, message: t('messages.operationFail') }
    } finally {
      await this.exitResourceMaintenance()
    }
  }

  /** 主进程与 H5 子进程重新加载已安装 API 插件（安装/更新/卸载后调用） */
  async refreshApiPlugins() {
    await this.apiManager.loadApi()
    this.h5Server?.postMessage({ event: 'API_PLUGINS_RELOAD' })
  }

  // 获取设备当前语言
  getDeviceLocale() {
    const deviceLocale = app.getLocale()
    global.logger.info(`检测到系统语言: ${deviceLocale}`)

    // 映射系统语言到应用支持的语言
    return systemLocaleMap[deviceLocale] || systemLocaleMap[deviceLocale.split('-')[0]] || 'enUS'
  }

  // 更新开机自启动设置
  handleStartup() {
    if (app.isPackaged) {
      const exePath = process.execPath
      app.setLoginItemSettings({
        openAtLogin: this.settingData.startup,
        openAsHidden: !this.settingData.openMainWindowOnStartup,
        path: exePath,
        args: ['--autoStart']
      })
    }
  }

  // 开启定时任务
  startScheduledTasks() {
    this.initRefreshDirectoryTask()
    this.initHandleQualityTask()
    this.initHandleWordsTask()
    this.initCollectionsRefreshTask()
    this.initCollectionCuratorTask()
    this.initSwitchWallpaperTask()
    this.initRefreshWebWallpaperTask()
    this.initDownloadTask()
    this.initClearDownloadedTask()
    if (this._mainUiReady) {
      this.ensureBackgroundAiTasks()
    }
  }

  isMainWindowContentLoaded() {
    const wc = global.FBW?.mainWindow?.win?.webContents
    return !!(wc && !wc.isDestroyed() && !wc.isLoading())
  }

  /** 开发环境下 did-finish-load 可能早于 Vue 挂载或未触发，用 webContents / 渲染进程上报兜底 */
  tryMarkMainUiReady(source = 'probe') {
    if (this._mainUiReady) return true
    if (!this.isMainWindowContentLoaded()) return false
    this.onMainUiReady(source)
    return true
  }

  /** 主窗口首屏加载完成后再调度后台 AI，避免拖慢启动 */
  onMainUiReady(source = 'did-finish-load') {
    if (this._mainUiReady) return
    this._mainUiReady = true
    global.logger.info(
      `[Store] 主窗口已就绪(${source})，${Math.round(AI_ANALYSIS_PUMP_START_DELAY_MS / 1000)}s 后启动后台分析看门狗、${Math.round(VISUAL_EMBED_PUMP_START_DELAY_MS / 1000)}s 后启动画面向量补算；将立即尝试首轮分析`
    )
    this.ensureBackgroundAiTasks()
    setImmediate(() => {
      this.triggerBackgroundAnalysisPump()
      this.triggerVisualEmbedPump()
    })
  }

  shouldScheduleBackgroundAi() {
    const ai = this.settingData?.ai
    return (
      !!ai?.enabled &&
      ai.analysisMode !== 'off' &&
      ai.analysisMode !== 'on_demand' &&
      !this.isPowerSaveOnBattery()
    )
  }

  ensureBackgroundAiTasks() {
    if (!this._mainUiReady) return
    if (!this._backgroundAiScheduled) {
      this._backgroundAiScheduled = true
    }
    if (!this.shouldScheduleBackgroundAi()) {
      this.stopAiAnalysisTask()
      this.stopVisualEmbedTask()
      return
    }
    this.initAiAnalysisTask()
    this.initVisualEmbedTask()
  }

  // 图片质量处理任务
  initHandleQualityTask() {
    const key = 'handleQuality'
    // 清理任务
    this.taskScheduler.clearTask(key)
    // 开启定时计算图片质量
    this.taskScheduler.scheduleTask(
      key,
      7 * 60 * 1000,
      () => {
        this.fileManager.intervalHandleQuality(this.locks)
      },
      10 * 60 * 1000
    )
  }

  // 处理分词任务
  initHandleWordsTask() {
    this.stopHandleWordsTask()
    this.startHandleWordsTask()
  }

  startHandleWordsTask() {
    // 检查是否启用词库处理任务
    if (this.settingData.enableSegmentationTask) {
      // 开启定时处理词库
      this.taskScheduler.scheduleTask(
        'handleWords',
        11 * 60 * 1000,
        () => {
          this.wordsManager.intervalHandleWords(this.locks)
        },
        10 * 60 * 1000
      )
    }
  }

  stopHandleWordsTask() {
    this.taskScheduler.clearTask('handleWords')
  }

  restartHandleWordsTask(oldData, newData) {
    if (oldData.enableSegmentationTask !== newData.enableSegmentationTask) {
      if (newData.enableSegmentationTask) {
        this.startHandleWordsTask()
      } else {
        this.stopHandleWordsTask()
      }
    }
  }

  initAiAnalysisTask() {
    this.stopAiAnalysisTask()
    this.startAiAnalysisTask()
  }

  isPowerSaveOnBattery() {
    return !!(this.settingData?.powerSaveMode && this.powerState?.isOnBattery)
  }

  triggerBackgroundAnalysisPump() {
    const ai = this.settingData?.ai
    if (!ai?.enabled || ai.analysisMode === 'off' || ai.analysisMode === 'on_demand') {
      return
    }
    if (this.isPowerSaveOnBattery()) return
    this.aiAnalysisManager.pumpBackgroundAnalysis(this.locks)
  }

  triggerVisualEmbedPump() {
    const ai = this.settingData?.ai
    if (!ai?.enabled) return
    if (this.isPowerSaveOnBattery()) return
    this.embeddingManager?.pumpVisualEmbedBackfill?.(this.locks)
  }

  startAiAnalysisTask() {
    const ai = this.settingData?.ai
    if (!ai?.enabled || ai.analysisMode === 'off' || ai.analysisMode === 'on_demand') {
      return
    }
    if (this.isPowerSaveOnBattery()) {
      return
    }
    this.taskScheduler.scheduleTask(
      'aiAnalysis',
      AI_ANALYSIS_WATCHDOG_MS,
      () => {
        if (this.isPowerSaveOnBattery()) return
        this.syncAutoCurateGateFromAnalysis()
        this.triggerBackgroundAnalysisPump()
      },
      AI_ANALYSIS_PUMP_START_DELAY_MS
    )
  }

  stopAiAnalysisTask() {
    this.taskScheduler.clearTask('aiAnalysis')
  }

  initVisualEmbedTask() {
    this.stopVisualEmbedTask()
    this.startVisualEmbedTask()
  }

  startVisualEmbedTask() {
    const ai = this.settingData?.ai
    if (!ai?.enabled) return
    if (this.isPowerSaveOnBattery()) return
    this.taskScheduler.scheduleTask(
      'visualEmbed',
      VISUAL_EMBED_WATCHDOG_MS,
      () => {
        if (this.isPowerSaveOnBattery()) return
        this.triggerVisualEmbedPump()
      },
      VISUAL_EMBED_PUMP_START_DELAY_MS
    )
  }

  stopVisualEmbedTask() {
    this.taskScheduler.clearTask('visualEmbed')
  }

  initCollectionsRefreshTask() {
    this.taskScheduler.clearTask('collectionsRefresh')
    this.taskScheduler.scheduleTask(
      'collectionsRefresh',
      15 * 60 * 1000,
      () => {
        this.collectionsManager.intervalRefresh(this.locks)
      },
      3 * 60 * 1000
    )
  }

  resolveAiPumpBlockReason() {
    this.tryMarkMainUiReady('stats-probe')
    const ai = this.settingData?.ai || {}
    if (!ai.enabled) return 'disabled'
    if (ai.analysisMode === 'off' || ai.analysisMode === 'on_demand') return 'mode'
    if (this.aiAnalysisManager?.maintenancePaused) return 'maintenance'
    if (this.locks?.aiAnalysis) return 'lock'
    if (this.isPowerSaveOnBattery()) return 'power_save_battery'
    if (!this._mainUiReady) return 'main_ui_not_ready'
    if (!this.taskScheduler?.hasActiveTask?.('aiAnalysis')) return 'scheduler_stopped'
    if (!this.aiAnalysisManager?.shouldRunBackground?.()) return 'config'
    return null
  }

  getAnalysisStatsData() {
    const data = this.aiAnalysisManager.getStats()?.data || {}
    return {
      ...data,
      pumpBlockReason: this.resolveAiPumpBlockReason()
    }
  }

  shouldAutoCurate() {
    const ai = this.settingData?.ai || {}
    return shouldRunScheduledAutoCurate(this.getAnalysisStatsData(), ai)
  }

  stopAutoCollectionCurator() {
    this.taskScheduler.clearTask('collectionCurator')
    if (this.collectionCuratorTimer) {
      clearTimeout(this.collectionCuratorTimer)
      this.collectionCuratorTimer = null
    }
  }

  clearAutoCurateLatchLocal() {
    const ai = this.settingData?.ai || {}
    if (!isAutoCurateSettled(ai)) return false
    this.settingData.ai = buildClearAutoCurateLatchFields(ai)
    return true
  }

  async clearAutoCurateLatch() {
    if (!this.clearAutoCurateLatchLocal()) return
    try {
      await this.settingManager.updateSettingData({ ai: this.settingData.ai })
    } catch (err) {
      global.logger.warn(`[CollectionCurator] 清除自动整理锁存失败: ${err.message}`)
    }
  }

  async persistAutoCurateLatch(stats) {
    const ai = { ...(this.settingData?.ai || {}), ...buildAutoCurateLatchFields(stats) }
    this.settingData.ai = ai
    try {
      await this.settingManager.updateSettingData({ ai })
    } catch (err) {
      global.logger.warn(`[CollectionCurator] 写入自动整理锁存失败: ${err.message}`)
    }
  }

  async maybeSettleAutoCurateAfterRun(ret) {
    const stats = this.getAnalysisStatsData()
    if (!isAiPipelineStable(stats)) return
    if (ret?.data?.skipped && ret.data.reason === 'busy') return
    if (ret?.data?.skipped && ret.data.reason === 'disabled') return
    if (ret?.data?.phase && ret.data.phase === 'progressive') return

    await this.persistAutoCurateLatch(stats)
    this.stopAutoCollectionCurator()
    global.logger.info(
      `[CollectionCurator] AI 管道已稳定，系统合集已定格（已分析 ${stats.done ?? 0} 张；新图将增量加入；手动整理可全量重建）`
    )
  }

  syncAutoCurateGateFromAnalysis() {
    const ai = this.settingData?.ai || {}

    if (isAutoCurateSettled(ai)) {
      this.stopAutoCollectionCurator()
      return
    }

    const stats = this.getAnalysisStatsData()
    if (!isAnalysisQueueStable(stats)) return

    if (this.shouldAutoCurate() && !this.collectionCuratorTimer && !this.locks.collectionCurator) {
      this.scheduleCollectionCurator(90 * 1000)
    }
  }

  ensurePostAnalysisCurateScheduled() {
    if (!this.shouldAutoCurate()) return
    const stats = this.getAnalysisStatsData()
    if (!isAnalysisQueueStable(stats)) return
    if (this.collectionCuratorTimer || this.locks.collectionCurator) return
    this.scheduleCollectionCurator(60 * 1000)
  }

  async runCollectionCurator({ manual = false } = {}) {
    if (!manual && !this.shouldAutoCurate()) {
      return { success: true, data: { skipped: true, reason: 'auto_curate_settled' } }
    }
    const stats = this.getAnalysisStatsData()
    const pipelineStable = isAiPipelineStable(stats)
    const ret = await this.collectionCurator.run(this.locks, {
      manual,
      pipelineStable: manual ? true : pipelineStable
    })
    if (!manual) {
      await this.maybeSettleAutoCurateAfterRun(ret)
    }
    return ret
  }

  initCollectionCuratorTask() {
    this.taskScheduler.clearTask('collectionCurator')
    if (!this.settingData?.ai?.enabled || this.settingData?.ai?.autoCollectionsEnabled === false) {
      return
    }
    if (!this.shouldAutoCurate()) {
      return
    }
    this.taskScheduler.scheduleTask(
      'collectionCurator',
      30 * 60 * 1000,
      () => {
        this.runCollectionCurator({ manual: false })
      },
      5 * 60 * 1000
    )
  }

  scheduleCollectionCurator(delayMs = 90 * 1000) {
    if (!this.settingData?.ai?.enabled || this.settingData?.ai?.autoCollectionsEnabled === false) {
      return
    }
    if (!this.shouldAutoCurate()) {
      return
    }
    if (this.collectionCuratorTimer) {
      clearTimeout(this.collectionCuratorTimer)
    }
    this.collectionCuratorTimer = setTimeout(() => {
      this.collectionCuratorTimer = null
      this.runCollectionCurator({ manual: false })
    }, delayMs)
  }

  restartCollectionCuratorTask(oldData, newData) {
    const o = oldData?.ai || {}
    const n = newData?.ai || {}
    if (
      o.enabled !== n.enabled ||
      o.autoCollectionsEnabled !== n.autoCollectionsEnabled ||
      o.autoCollectionsMaxCount !== n.autoCollectionsMaxCount ||
      o.scoreMinFilter !== n.scoreMinFilter
    ) {
      if (n.enabled && n.autoCollectionsEnabled !== false && isAutoCurateSettled(n)) {
        this.settingData.ai = buildClearAutoCurateLatchFields(n)
        void this.settingManager.updateSettingData({ ai: this.settingData.ai })
      }
      this.initCollectionCuratorTask()
      if (n.enabled && n.autoCollectionsEnabled !== false) {
        this.scheduleCollectionCurator(15 * 1000)
      }
    }
  }

  restartAiAnalysisTask(oldData, newData) {
    const o = oldData?.ai || {}
    const n = newData?.ai || {}
    const oldProfile = o.promptProfile || 'default'
    const newProfile = n.promptProfile || 'default'
    if (oldProfile !== newProfile && this.aiAnalysisManager) {
      global.logger.info(
        `[Store] promptProfile ${oldProfile} → ${newProfile}，调度 normalize 重放`
      )
      this.aiAnalysisManager.scheduleNormalizeReplay({
        reason: 'profile-change',
        profile: newProfile
      })
    }
    if (JSON.stringify(o) !== JSON.stringify(n)) {
      this.initAiAnalysisTask()
      this.initVisualEmbedTask()
      setImmediate(() => {
        this.triggerBackgroundAnalysisPump()
        this.triggerVisualEmbedPump()
      })
    }
  }

  /** 省电限制解除后恢复后台 AI 调度（不依赖 _backgroundAiScheduled 一次性标记） */
  resumeBackgroundAiTasksIfAllowed() {
    if (!this._mainUiReady) return
    if (this.isPowerSaveOnBattery()) return
    this.initAiAnalysisTask()
    this.initVisualEmbedTask()
    setImmediate(() => {
      this.triggerBackgroundAnalysisPump()
      this.triggerVisualEmbedPump()
    })
  }

  /** 省电模式开关变更：关闭且可运行时恢复后台 AI；开启且用电池时暂停定时任务 */
  restartPowerSaveDependentTasks(oldData, newData) {
    if (oldData?.powerSaveMode === newData?.powerSaveMode) return

    if (this.isPowerSaveOnBattery()) {
      if (this.powerState?.isOnBattery && newData?.powerSaveMode) {
        global.logger.info('[Store] 省电模式已开启（电池），暂停定时任务')
        this.taskScheduler.clearAllTasks()
        this.powerState.wasPausedByBattery = true
      }
      return
    }

    global.logger.info('[Store] 省电限制已解除，恢复后台 AI 与相关定时任务')
    this.powerState.wasPausedByBattery = false
    this.startScheduledTasks()
    this.resumeBackgroundAiTasksIfAllowed()
  }

  // 设置电源监控
  setupPowerMonitor() {
    // 监听系统挂起事件
    powerMonitor.on('suspend', () => {
      global.logger.info('系统挂起')
      this.handleSystemIdle(true)
    })

    // 监听系统恢复事件
    powerMonitor.on('resume', () => {
      global.logger.info('系统恢复')
      this.handleSystemIdle(false)
    })

    // 监听锁屏事件
    powerMonitor.on('lock-screen', () => {
      global.logger.info('系统锁屏')
      this.handleSystemIdle(true)
    })

    // 监听解锁事件
    powerMonitor.on('unlock-screen', () => {
      global.logger.info('系统解锁')
      this.handleSystemIdle(false)
    })

    // 监听系统空闲状态
    if (powerMonitor.getSystemIdleState) {
      // 每分钟检查一次系统空闲状态
      setInterval(() => {
        // 系统空闲阈值，单位为秒，默认5分钟
        const idleState = powerMonitor.getSystemIdleState(300)
        if (idleState === 'idle' && !this.powerState.isSystemIdle) {
          global.logger.info('系统空闲')
          this.handleSystemIdle(true)
        } else if (idleState === 'active' && this.powerState.isSystemIdle) {
          global.logger.info('系统活跃')
          this.handleSystemIdle(false)
        }
      }, 60000)
    }

    // 新增：监听电池模式
    powerMonitor.on('on-battery', () => {
      global.logger.info('进入电池模式')
      this.powerState.isOnBattery = true
      if (this.settingData.powerSaveMode) {
        global.logger.info('省电模式下自动暂停所有定时任务')
        this.taskScheduler.clearAllTasks()
        this.powerState.wasPausedByBattery = true
      }
    })
    powerMonitor.on('on-ac', () => {
      global.logger.info('恢复交流电')
      const wasPausedByBattery = this.powerState.wasPausedByBattery
      this.powerState.isOnBattery = false
      if (wasPausedByBattery) {
        global.logger.info('恢复所有定时任务')
        this.powerState.wasPausedByBattery = false
        this.startScheduledTasks()
      }
      this.resumeBackgroundAiTasksIfAllowed()
    })
  }

  // 处理系统空闲状态
  handleSystemIdle(isIdle) {
    if (isIdle && !this.powerState.isSystemIdle) {
      // 系统进入空闲状态，记录当前自动切换状态并暂停
      this.powerState.isSystemIdle = true
      this.powerState.wasAutoSwitchEnabled = this.settingData.autoSwitchWallpaper
      this.settingData.wasAutoRefreshWebEnabled = this.settingData.autoRefreshWebWallpaper

      if (this.powerState.wasAutoSwitchEnabled) {
        // 暂停自动切换壁纸，但不更新设置
        this.stopSwitchWallpaperTask()
      }
      if (this.powerState.wasAutoRefreshWebEnabled) {
        // 暂停自动刷新壁纸，但不更新设置
        this.stopRefreshWebWallpaperTask()
      }
      global.logger.info('系统空闲，暂停壁纸更新任务')
    } else if (!isIdle && this.powerState.isSystemIdle) {
      // 系统恢复活跃状态，恢复之前的自动切换状态
      this.powerState.isSystemIdle = false

      // 新增：如果当前处于电池模式且设置了自动暂停，则不恢复定时任务
      if (this.powerState.isOnBattery && this.settingData.powerSaveMode) {
        global.logger.info('系统恢复活跃，但处于省电模式，不恢复定时任务')
        return
      }

      if (this.powerState.wasAutoSwitchEnabled) {
        // 恢复自动切换壁纸，先停止当前任务，然后重新启动
        this.stopSwitchWallpaperTask()
        this.startSwitchWallpaperTask()
      }
      if (this.powerState.wasAutoRefreshWebEnabled) {
        // 恢复自动刷新壁纸，先停止当前任务，然后重新启动
        this.stopRefreshWebWallpaperTask()
        this.startRefreshWebWallpaperTask()
      }
      global.logger.info('系统恢复活跃，恢复壁纸更新任务')
    }
  }

  // 处理文件服务子进程启动
  handleFileServerStart() {
    try {
      // 准备环境变量，确保所有值都是字符串
      const env = {}
      for (const key in process.env) {
        // 确保所有环境变量值都是字符串
        env[key] = String(process.env[key])
      }

      // 启动子进程
      this.fileServer?.start({
        options: {
          env
        },
        onMessage: ({ data }) => {
          switch (data.event) {
            case 'REFRESH_DIRECTORY::SUCCESS':
              // 添加接收时间戳
              data.receiveMsgTime = Date.now()
              this.onRefreshDirectorySuccess(data)
              break
            case 'REFRESH_DIRECTORY::FAIL':
              // 添加接收时间戳
              data.receiveMsgTime = Date.now()
              this.onRefreshDirectoryFail(data)
              break
            case 'SERVER_LOG': {
              const type = data.level
              if (type && typeof global.logger[type] === 'function') {
                global.logger[type](data.message)
              } else {
                global.logger.info(`[FileServer] INFO => ${data.message}`)
              }
              break
            }
            case 'HANDLE_IMAGE_QUALITY::SUCCESS':
              this.fileManager.onHandleImageQualitySuccess(data, this.locks)
              break
            case 'HANDLE_IMAGE_QUALITY::FAIL':
              this.fileManager.onHandleImageQualityFail(this.locks)
              break
          }
        }
      })
    } catch (err) {
      global.logger.error(`启动文件服务器失败: ${err}`)
    }
  }

  // 文件服务子进程-遍历目录完成
  onRefreshDirectorySuccess(data) {
    // 获取开始时间和接收时间，使用当前时间作为默认值而不是0
    const startTime = data.refreshDirStartTime
    // 父进程向子进程发送消息耗时
    const parentToChildCoast = data.readDirTime.start - startTime
    // 子进程向父进程发送消息耗时
    const childToParentCoast = data.receiveMsgTime - data.readDirTime.end
    // 遍历目录耗时
    const readDirCoast = data.readDirTime.end - data.readDirTime.start
    // 记录开始处理数据库的时间
    const processDataStartTime = Date.now()
    const res = this.fileManager.processDirectoryData(data)

    // 记录结束时间
    const endTime = Date.now()

    // 计算各阶段耗时
    const totalCoast = endTime - startTime
    const processDataCost = endTime - processDataStartTime

    // 转换成YYYY-MM-DD HH:mm:ss格式
    const timeNow = new Date().toLocaleString()
    // 打印耗时信息
    global.logger.info(
      `刷新目录完成 - 时间: ${timeNow}  总耗时: ${totalCoast}ms, 父=>子: ${parentToChildCoast}ms, 遍历目录耗时: ${readDirCoast}ms, 子=>父: ${childToParentCoast}ms, 插入数据库耗时: ${processDataCost}ms`
    )

    // 清除锁
    this.locks.refreshDirectory = false
    // 手动刷新完成后发送消息
    if (data.isManual) {
      global.FBW.sendMsg(global.FBW.mainWindow.win, {
        type: res.success
          ? res.data.insertedCount > 0 || res.data.updatedCount > 0 || res.data.prunedCount > 0
            ? 'success'
            : 'info'
          : 'error',
        message: res.message
      })
      if (
        res.success &&
        (res.data.insertedCount > 0 || res.data.updatedCount > 0 || res.data.prunedCount > 0)
      ) {
        // 触发刷新动作
        this.triggerAction('refreshSearchList')
      }
    }
  }

  // 文件服务子进程-遍历目录失败
  onRefreshDirectoryFail(data) {
    // 清除锁
    this.locks.refreshDirectory = false
    // 手动刷新完成后发送消息
    if (data.isManual) {
      global.FBW.sendMsg(global.FBW.mainWindow.win, {
        type: 'error',
        message: t('messages.refreshDirectoryFail')
      })
    }
  }

  // 带重试机制的H5服务启动方法
  handleH5ServerStart(maxRetries = 3, retryInterval = 2000) {
    let retryCount = 0

    const attemptStart = () => {
      try {
        // 准备环境变量，确保所有值都是字符串
        const env = {}
        for (const key in process.env) {
          // 确保所有环境变量值都是字符串
          env[key] = String(process.env[key])
        }

        this.h5Server?.start({
          options: {
            env
          },
          onMessage: async ({ data }) => {
            switch (data.event) {
              case 'SERVER_START::SUCCESS': {
                this.h5ServerUrl = data.url

                // 检查IP是否有效
                const urlObj = new URL(data.url)
                const ip = urlObj.hostname

                if (ip === '0.0.0.0' || ip === '127.0.0.1') {
                  global.logger.warn(`H5服务器IP无效: ${ip}，尝试重启服务`)
                  // 停止当前服务
                  this.h5Server?.stop(() => {
                    if (retryCount < maxRetries) {
                      retryCount++
                      global.logger.info(`重试启动H5服务 (${retryCount}/${maxRetries})...`)
                      setTimeout(attemptStart, retryInterval)
                    } else {
                      global.logger.error(`H5服务器无法获取有效IP，已达到最大重试次数`)
                    }
                  })
                  return
                }

                global.logger.info(`H5服务器启动成功: ${this.h5ServerUrl}`)

                // 发送消息到主窗口
                if (global.FBW.mainWindow.win) {
                  global.FBW.sendCommonData(global.FBW.mainWindow.win)
                  global.FBW.sendMsg(global.FBW.mainWindow.win, {
                    type: 'success',
                    message: t('messages.h5ServerStartSuccess')
                  })
                } else {
                  global.logger.warn('主窗口未初始化，无法发送H5服务器URL')
                }
                break
              }
              case 'SERVER_START::FAIL': {
                global.logger.error(`H5服务器启动失败: ${data.message || data}`)
                break
              }
              case 'SERVER_LOG': {
                const type = data.level
                if (type && typeof global.logger[type] === 'function') {
                  global.logger[type](data.message)
                } else {
                  global.logger.info(`[H5Server] INFO => ${data.message}`)
                }
                break
              }
              case 'H5_SETTING_UPDATED': {
                // 获取最新设置数据
                await this.settingManager.getSettingData()
                // 发送更新消息
                this.sendSettingDataUpdate()
                break
              }
            }
          }
        })
      } catch (err) {
        global.logger.error(`启动H5服务器失败: ${err}`)
        if (retryCount < maxRetries) {
          retryCount++
          global.logger.info(`重试启动H5服务 (${retryCount}/${maxRetries})...`)
          setTimeout(attemptStart, retryInterval)
        } else {
          // 发送错误消息
          if (global.FBW.mainWindow.win) {
            global.FBW.sendMsg(global.FBW.mainWindow.win, {
              type: 'error',
              message: t('messages.h5ServerStartFail')
            })
          }
        }
      }
    }

    // 开始第一次尝试
    attemptStart()
  }

  // 处理H5服务子进程停止
  handleH5ServerStop() {
    try {
      this.h5Server?.stop((isSuccess) => {
        if (isSuccess) {
          this.h5ServerUrl = null
          global.FBW.sendCommonData(global.FBW.mainWindow.win)
          global.FBW.sendMsg(global.FBW.mainWindow.win, {
            type: 'success',
            message: t('messages.h5ServerStopSuccess')
          })
        } else {
          // 发送错误消息
          global.FBW.sendMsg(global.FBW.mainWindow.win, {
            type: 'error',
            message: t('messages.h5ServerStopFail')
          })
        }
      })
    } catch (err) {
      global.logger.error(err)
    }
  }

  // 触发动作
  triggerAction(action, data) {
    global.FBW.mainWindow.win.webContents.send('main:triggerAction', action, data)
  }

  // 发送设置数据更新
  sendSettingDataUpdate() {
    if (global.FBW.mainWindow.win) {
      global.FBW.mainWindow.win.webContents.send('main:settingDataUpdate', this.settingData)
    }
    if (global.FBW.viewImageWindow.win) {
      global.FBW.viewImageWindow.win.webContents.send('main:settingDataUpdate', this.settingData)
    }
    if (global.FBW.suspensionBall.win) {
      global.FBW.suspensionBall.win.webContents.send('main:settingDataUpdate', this.settingData)
    }
    if (global.FBW.dynamicWallpaperWindow.win) {
      global.FBW.dynamicWallpaperWindow.win.webContents.send(
        'main:settingDataUpdate',
        this.settingData
      )
    }
    if (global.FBW.rhythmWallpaperWindow.win) {
      global.FBW.rhythmWallpaperWindow.win.webContents.send(
        'main:settingDataUpdate',
        this.settingData
      )
    }
  }

  // 处理IPC通信
  handleIpc() {
    // 获取设置数据
    ipcMain.handle('main:getSettingData', () => {
      return this.settingManager.getSettingData()
    })

    ipcMain.handle('main:notifyMainUiReady', () => {
      this.onMainUiReady('renderer')
      return { success: true }
    })

    // 合并更新设置数据
    ipcMain.handle('main:updateSettingData', async (event, formData) => {
      return await this.updateSettingData(formData)
    })

    // 获取资源数据
    ipcMain.handle('main:getResourceMap', () => {
      return this.dbManager.getResourceMap()
    })

    // 验证隐私空间密码
    ipcMain.handle('main:checkPrivacyPassword', async (event, password) => {
      return await this.settingManager.checkPrivacyPassword(password)
    })

    // 检查是否设置了隐私密码
    ipcMain.handle('main:hasPrivacyPassword', async () => {
      return await this.settingManager.hasPrivacyPassword()
    })

    ipcMain.handle('main:getPrivacyPasswordHint', async () => {
      return await this.settingManager.getPrivacyPasswordHint()
    })

    ipcMain.handle('main:updatePrivacyPassword', async (event, formData) => {
      return await this.settingManager.updatePrivacyPassword(formData)
    })

    // 加入收藏夹（id 或完整 item）
    ipcMain.handle('main:addToFavorites', async (event, resourceIdOrItem, isPrivacySpace = false) => {
      return await this.resourcesManager.addToFavorites(resourceIdOrItem, isPrivacySpace)
    })

    // 移出收藏夹（id 或完整 item）
    ipcMain.handle('main:removeFavorites', async (event, resourceIdOrItem, isPrivacySpace = false) => {
      return await this.resourcesManager.removeFavorites(resourceIdOrItem, isPrivacySpace)
    })

    ipcMain.handle('main:recordResourceView', async (event, resourceIdOrItem) => {
      return await this.resourcesManager.recordResourceView(resourceIdOrItem)
    })

    // 删除文件
    ipcMain.handle('main:deleteFile', async (event, item) => {
      await this.enterResourceMaintenance()
      try {
        return await this.fileManager.deleteFile(item)
      } finally {
        await this.exitResourceMaintenance()
      }
    })

    // 下载文件
    ipcMain.handle('main:downloadFile', async (event, item) => {
      return await this.fileManager.downloadFile(item)
    })

    // 搜索资源数据
    ipcMain.handle('main:search', async (event, params) => {
      return await this.resourcesManager.search(params)
    })

    // 获取热门标签
    ipcMain.handle('main:getHotTags', async (event, params) => {
      return await this.resourcesManager.getHotTags(params)
    })

    // 设置为壁纸
    ipcMain.handle('main:setAsWallpaperWithDownload', async (event, item) => {
      return await this.wallpaperManager.setAsWallpaperWithDownload(item)
    })

    // 切换壁纸
    ipcMain.handle('main:nextWallpaper', async () => {
      return this.doManualSwitchWallpaper('next')
    })

    // 切换至上一个壁纸
    ipcMain.handle('main:prevWallpaper', async () => {
      return this.doManualSwitchWallpaper('prev')
    })

    // 设置网页壁纸
    ipcMain.handle('main:setWebWallpaper', (event, url) => {
      return this.setWebWallpaper(url)
    })

    // 启停定时刷新网页壁纸任务
    ipcMain.handle('main:toggleRefreshWebWallpaperTask', async () => {
      return this.toggleRefreshWebWallpaperTask()
    })

    // 设置颜色壁纸
    ipcMain.handle('main:setColorWallpaper', (event, color) => {
      return this.setColorWallpaper(color)
    })

    // 启停定时切换壁纸
    ipcMain.handle('main:toggleAutoSwitchWallpaper', async () => {
      return this.toggleAutoSwitchWallpaper()
    })

    // 清空当前资源DB
    ipcMain.handle('main:clearDB', async (event, tableName, resourceName) => {
      if (!tableName || typeof tableName !== 'string') {
        return { success: false, message: t('messages.operationFail') }
      }
      return await this.dbManager.clearDB(tableName, resourceName)
    })

    ipcMain.handle('main:clearResourcesLibrary', async () => {
      return await this.clearResourcesLibrary()
    })

    // 刷新当前资源目录
    ipcMain.handle('main:refreshDirectory', async () => {
      return this.fileManager.refreshDirectory(this.locks, true)
    })

    // 查找词库
    ipcMain.handle('main:getWords', async (event, params) => {
      return this.wordsManager.getWords(params)
    })

    ipcMain.handle('main:getResourceTags', async (event, resourceIdOrItem) => {
      let resourceId = parsePositiveId(resourceIdOrItem)
      if (resourceIdOrItem && typeof resourceIdOrItem === 'object') {
        resourceId = this.resourcesManager.resolveResourceIdForTags(resourceIdOrItem).resourceId
      }
      if (!resourceId) {
        return { success: true, message: t('messages.queryEmpty'), data: [] }
      }
      return this.wordsManager.getResourceTags(resourceId)
    })

    ipcMain.handle('main:analyzeResource', async (event, params) => {
      const resolved = await resolveResourceFromParams(this, params, { downloadIfRemote: true })
      if (resolved.error) return resolved.error
      const { resourceId, resourceRow } = resolved
      const ret = await this.aiAnalysisManager.analyzeResourceById(resourceId, params?.options)
      const rowAfter = this.resourcesManager.getResourceRowById(resourceId) || resourceRow
      return attachResolvedResourceToResult(this.resourcesManager, ret, resourceId, rowAfter)
    })

    ipcMain.handle('main:resetAiAnalysis', async (event, params) => {
      return await this.resetAiAnalysis(params)
    })

    ipcMain.handle('main:requeueRetryableAiAnalysis', async () => {
      return await this.requeueRetryableAiAnalysis()
    })

    ipcMain.handle('main:requeueAllAiAnalysisWithoutClear', async () => {
      return await this.requeueAllAiAnalysisWithoutClear()
    })

    ipcMain.handle('main:testAiConnection', async (event, params) => {
      const type = params?.type || 'vision'
      const AiAnalysisProvider = (await import('../ai/AiAnalysisProvider.mjs')).default
      const provider = AiAnalysisProvider.getInstance(global.logger, this.settingManager)
      const result = await provider.testConnection(type, params?.ai)
      return {
        success: !!result.success,
        data: result,
        errorCode: result.errorCode,
        errorParams: result.errorParams,
        message: result.message || ''
      }
    })

    ipcMain.handle('main:listAiModels', async (event, params) => {
      const AiAnalysisProvider = (await import('../ai/AiAnalysisProvider.mjs')).default
      const provider = AiAnalysisProvider.getInstance(global.logger, this.settingManager)
      const result = await provider.listModels(
        params?.kind || 'vision',
        params?.purpose || 'text',
        params?.ai
      )
      return result
    })

    ipcMain.handle('main:getAiAnalysisStats', () => {
      const base = this.aiAnalysisManager.getStats()
      if (!base?.success) return base
      return { ...base, data: this.getAnalysisStatsData() }
    })

    ipcMain.handle('main:parseSearchQuery', async (event, params) => {
      return await this.textQueryParser.parseSearchQuery(params?.query || '')
    })

    ipcMain.handle('main:findSimilar', async (event, params) => {
      const resolved = await resolveResourceFromParams(this, params, { downloadIfRemote: true })
      if (resolved.error) return resolved.error
      const { resourceId, resourceRow } = resolved
      const limit = params?.limit || 20
      try {
        const candidateIds = Array.isArray(params?.candidateIds)
          ? params.candidateIds
          : params?.scope
            ? this.resourcesManager.getSimilarScopeCandidateIds(params.scope)
            : null
        const excludeIds = Array.isArray(params?.excludeIds) ? params.excludeIds : []
        const similar = await this.resourcesManager.runFindSimilar(this.embeddingManager, {
          resourceId,
          limit,
          candidateIds,
          excludeIds
        })
        const list = this.resourcesManager.getResourcesByIds(similar.resourceIds)
        const ret = {
          success: true,
          data: {
            list,
            total: similar.total,
            signals: similar.signals || [],
            emptyReason: similar.emptyReason || null
          }
        }
        return attachResolvedResourceToResult(this.resourcesManager, ret, resourceId, resourceRow)
      } catch (err) {
        return { success: false, message: String(err.message || err) }
      }
    })

    ipcMain.handle('main:semanticSearch', async (event, params) => {
      return await this.resourcesManager.semanticSearch({
        ...params,
        embeddingManager: this.embeddingManager
      })
    })

    ipcMain.handle('main:recommend', async (event, params) => {
      return this.recommendManager.recommend(params)
    })

    ipcMain.handle('main:recommend:addAllToFavorites', async (event, params) => {
      return this.recommendManager.addAllToFavorites(params || {})
    })

    ipcMain.handle('main:collections:list', () => this.collectionsManager.list())

    ipcMain.handle('main:collections:get', (event, params) => {
      const id = parsePositiveId(params?.id)
      if (!id) {
        return { success: false, message: t('messages.operationFail') }
      }
      return this.collectionsManager.get(id, {
        startPage: params?.startPage,
        pageSize: params?.pageSize
      })
    })

    ipcMain.handle('main:collections:create', async (event, params) => {
      if (params?.prompt && !params?.queryJson) {
        return await this.collectionsManager.createFromPrompt(params.prompt)
      }
      return this.collectionsManager.create(params)
    })

    ipcMain.handle('main:collections:update', async (event, params) => {
      const id = parsePositiveId(params?.id)
      if (!id) {
        return { success: false, message: t('messages.operationFail') }
      }
      if (params?.fromPrompt && params?.prompt) {
        return await this.collectionsManager.updateFromPrompt(id, params.prompt)
      }
      return this.collectionsManager.update(id, params)
    })

    ipcMain.handle('main:collections:delete', (event, params) => {
      const id = parsePositiveId(params?.id)
      if (!id) {
        return { success: false, message: t('messages.operationFail') }
      }
      return this.collectionsManager.delete(id)
    })

    ipcMain.handle('main:collections:generate', async (event, params) => {
      const id = parsePositiveId(params?.id)
      if (!id) {
        return { success: false, message: t('messages.operationFail') }
      }
      return this.collectionsManager.generate(id, params?.queryJson)
    })

    ipcMain.handle('main:collections:addAllToFavorites', (event, params) => {
      const id = parsePositiveId(params?.id)
      if (!id) {
        return { success: false, message: t('messages.operationFail') }
      }
      return this.collectionsManager.addAllToFavorites(id)
    })

    ipcMain.handle('main:collections:curate', async () => {
      return await this.runCollectionCurator({ manual: true })
    })

    ipcMain.handle('main:collections:curatorStats', () => {
      const curator = this.collectionCurator.getStats()
      const analysis = this.getAnalysisStatsData()
      const ai = this.settingData?.ai || {}
      return {
        success: true,
        data: buildCuratorFooterStats(curator, analysis, ai)
      }
    })

    // H5服务相关
    ipcMain.handle('main:startH5Server', () => {
      this.handleH5ServerStart(3, 2000)
    })

    ipcMain.handle('main:stopH5Server', () => {
      this.handleH5ServerStop()
    })

    ipcMain.handle('main:clearDownloadedAll', async () => {
      return await this.wallpaperManager.clearDownloadedAll()
    })

    ipcMain.handle('main:clearDownloadedExpired', async () => {
      return await this.wallpaperManager.clearDownloadedExpired()
    })

    // 快捷键相关IPC处理器
    ipcMain.handle('main:getShortcuts', () => {
      return this.shortcutManager.getPlatformShortcuts()
    })

    ipcMain.handle('main:getShortcutConflicts', () => {
      return this.shortcutManager.getShortcutConflicts()
    })

    ipcMain.handle('main:updateShortcut', async (event, name, newShortcut) => {
      return await this.shortcutManager.updateShortcut(name, newShortcut)
    })

    ipcMain.handle('main:resetShortcut', async (event, name) => {
      return await this.shortcutManager.resetShortcut(name)
    })

    ipcMain.handle('main:checkShortcutConflict', (event, shortcut, excludeName) => {
      return this.shortcutManager.checkShortcutConflict(shortcut, excludeName)
    })

    ipcMain.handle('main:disableShortcuts', () => {
      this.shortcutManager.suspendShortcutsForRecording()
      return { success: true }
    })

    ipcMain.handle('main:enableShortcuts', () => {
      this.shortcutManager.resumeShortcutsAfterRecording()
      return { success: true }
    })

    // 插件管理相关IPC处理器
    ipcMain.handle('main:getAvailablePlugins', () => {
      return this.pluginManager.getAvailablePlugins()
    })

    ipcMain.handle('main:getInstalledPlugins', () => {
      return this.pluginManager.getInstalledPlugins()
    })

    ipcMain.handle('main:getPluginSources', async () => {
      return await this.pluginManager.getPluginSources()
    })

    ipcMain.handle('main:addPluginSource', async (event, source) => {
      return await this.pluginManager.addPluginSource(source)
    })

    ipcMain.handle('main:updatePluginSource', async (event, sourceName, patch) => {
      const nextName = patch?.name != null ? normalizeSourceName(patch.name) : ''
      const currentName = normalizeSourceName(sourceName)
      if (nextName && nextName !== currentName) {
        return await this.renamePluginSource(currentName, nextName)
      }
      return await this.pluginManager.updatePluginSource(sourceName, patch)
    })

    ipcMain.handle('main:removePluginSource', async (event, sourceName) => {
      return await this.pluginManager.removePluginSource(sourceName)
    })

    ipcMain.handle(
      'main:installPlugin',
      async (event, sourceName, pluginName, version = 'main') => {
        const ret = await this.pluginManager.installPlugin(sourceName, pluginName, version)
        if (ret.success) {
          try {
            await this.refreshApiPlugins()
          } catch (err) {
            this.logger.error(`安装插件后刷新资源插件映射失败: ${err}`)
            return {
              ...ret,
              message: t('messages.pluginOperationSuccessButRefreshFailed', {
                message: ret.message
              })
            }
          }
        }
        return ret
      }
    )

    ipcMain.handle('main:uninstallPlugin', async (event, sourceName, pluginName) => {
      const ret = await this.pluginManager.uninstallPlugin(sourceName, pluginName)
      if (ret.success) {
        try {
          await this.refreshApiPlugins()
        } catch (err) {
          this.logger.error(`卸载插件后刷新资源插件映射失败: ${err}`)
          return {
            ...ret,
            message: t('messages.pluginOperationSuccessButRefreshFailed', {
              message: ret.message
            })
          }
        }
      }
      return ret
    })

    ipcMain.handle('main:updatePlugin', async (event, sourceName, pluginName) => {
      const ret = await this.pluginManager.updatePlugin(sourceName, pluginName)
      if (ret.success) {
        try {
          await this.refreshApiPlugins()
        } catch (err) {
          this.logger.error(`更新插件后刷新资源插件映射失败: ${err}`)
          return {
            ...ret,
            message: t('messages.pluginOperationSuccessButRefreshFailed', {
              message: ret.message
            })
          }
        }
      }
      return ret
    })
  }

  // 更新设置数据并触发变更
  async updateSettingData(data) {
    const oldData = JSON.parse(JSON.stringify(this.settingData))
    // 更新设置
    const res = await this.settingManager.updateSettingData(data)
    if (res.success) {
      const newData = JSON.parse(JSON.stringify(this.settingData))
      // 向H5子进程发送设置更新
      this.h5Server?.postMessage({
        event: 'APP_SETTING_UPDATED',
        data: this.settingData
      })
      // 发送更新消息
      this.sendSettingDataUpdate()

      // 重启相关定时任务，仅当设置项发生变化时触发
      this.restartRefreshDirectoryTask(oldData, newData)
      this.restartHandleWordsTask(oldData, newData)
      this.restartPowerSaveDependentTasks(oldData, newData)
      this.restartAiAnalysisTask(oldData, newData)
      this.restartCollectionCuratorTask(oldData, newData)
      this.restartSwitchWallpaperTask(oldData, newData)
      this.restartRefreshWebWallpaperTask(oldData, newData)
      this.restartDownloadTask(oldData, newData)
      this.restartClearDownloadedTask(oldData, newData)
      // 处理应用打包后开机自启
      this.handleStartup()
    }
    return res
  }

  // 手动切换壁纸
  async doManualSwitchWallpaper(direction) {
    // 先关闭自动切换
    await this.toggleAutoSwitchWallpaper(false)
    await this.toggleRefreshWebWallpaperTask(false)
    let ret = {
      success: false,
      message: t('messages.operationFail')
    }
    if (direction === 'next') {
      ret = await this.wallpaperManager.doSwitchToNextWallpaper()
    } else if (direction === 'prev') {
      ret = await this.wallpaperManager.doSwitchToPrevWallpaper()
    }
    // 触发动作
    this.triggerAction('setWallpaper', ret)
    return ret
  }

  // 定时切换壁纸任务
  initSwitchWallpaperTask() {
    this.stopSwitchWallpaperTask()
    this.startSwitchWallpaperTask()
  }

  startSwitchWallpaperTask() {
    const key = 'autoSwitchWallpaper'
    // 如果开启了自动切换壁纸
    if (this.settingData[key] && !this.powerState.isSystemIdle) {
      // 设置定时切换壁纸
      this.taskScheduler.scheduleTask(key, this.handleInterval(key), async () => {
        const res = await this.wallpaperManager.doSwitchToNextWallpaper()
        // 触发动作
        this.triggerAction('setWallpaper', res)
      })
    }
  }

  stopSwitchWallpaperTask() {
    this.taskScheduler.clearTask('autoSwitchWallpaper')
  }

  restartSwitchWallpaperTask(oldData, newData) {
    if (
      oldData.autoSwitchWallpaper !== newData.autoSwitchWallpaper ||
      oldData.switchIntervalUnit !== newData.switchIntervalUnit ||
      oldData.switchIntervalTime !== newData.switchIntervalTime
    ) {
      this.stopSwitchWallpaperTask()
      if (newData.autoSwitchWallpaper) {
        this.startSwitchWallpaperTask()
      }
    }
  }

  // 创建网页图片
  async getWebImage(url) {
    let tempWindow = null
    try {
      const { width, height } = screen.getPrimaryDisplay().workAreaSize
      // 创建一个隐藏的窗口来加载网页
      tempWindow = new BrowserWindow({
        width,
        height,
        show: false,
        webPreferences: {
          offscreen: true // 使用离屏渲染
        }
      })

      // 创建一个Promise来等待页面加载完成
      const loadPromise = new Promise((resolve) => {
        tempWindow.webContents.once('did-finish-load', () => {
          // console.log('Successfully loaded page:', url)
          // 可以添加一个小延迟确保所有资源加载完成
          setTimeout(resolve, 500)
        })
        tempWindow.webContents.once('did-fail-load', () => {
          // console.error('Failed to load URL:', url)
          resolve()
        })
      })

      // 加载URL
      await tempWindow.loadURL(url)

      // 等待页面完全加载
      await loadPromise

      // 捕获页面截图
      const image = await tempWindow.webContents.capturePage()
      const pngData = image.toPNG()

      // 保存截图到文件
      const downloadFilePath = path.join(process.env.FBW_TEMP_PATH, 'fbw-web-wallpaper.png')
      const tempFilePath = path.join(process.env.FBW_TEMP_PATH, 'fbw-web-wallpaper_temp.png')
      fs.writeFileSync(tempFilePath, pngData)
      fs.renameSync(tempFilePath, downloadFilePath)

      return downloadFilePath
    } catch (err) {
      global.logger.error(`获取网页图片失败: error => ${err}`)
      return null
    } finally {
      // 确保在任何情况下都销毁临时窗口
      if (tempWindow) {
        tempWindow.destroy()
        tempWindow = null
      }
    }
  }

  // 设置网页壁纸
  async setWebWallpaper(url) {
    try {
      // 先关闭自动切换
      await this.toggleAutoSwitchWallpaper(false)
      // 关闭视频壁纸
      this.wallpaperManager.closeDynamicWallpaper()
      url = url || this.settingData.webWallpaperUrl
      if (!url) {
        return {
          success: false,
          message: t('messages.urlEmpty')
        }
      }
      try {
        const urlObj = new URL(url)
        if (!['http:', 'https:'].includes(urlObj.protocol)) {
          return {
            success: false,
            message: t('messages.invalidUrl')
          }
        }
      } catch (err) {
        return {
          success: false,
          message: t('messages.invalidUrl')
        }
      }
      const imgPath = await this.getWebImage(url)
      if (imgPath) {
        return await this.wallpaperManager.setImageWallpaper(imgPath, 'web')
      } else {
        return {
          success: false,
          message: t('messages.operationFail')
        }
      }
    } catch (err) {
      global.logger.error(err)
      return {
        success: false,
        message: t('messages.operationFail')
      }
    }
  }

  // 设置颜色壁纸
  async setColorWallpaper(color) {
    await this.toggleAutoSwitchWallpaper(false)
    await this.toggleRefreshWebWallpaperTask(false)
    // 关闭视频壁纸
    this.wallpaperManager.closeDynamicWallpaper()
    return await this.wallpaperManager.setColorWallpaper(
      color || this.settingData.colorWallpaperVal
    )
  }

  // 启停定时切换壁纸
  async toggleAutoSwitchWallpaper(val) {
    const newValue = val === undefined ? !this.settingData.autoSwitchWallpaper : val
    await this.updateSettingData({
      autoSwitchWallpaper: newValue
    })
    if (newValue) {
      await this.toggleRefreshWebWallpaperTask(false)
    }
    // 更新当前电源状态记录
    if (!this.powerState.isSystemIdle) {
      this.powerState.wasAutoSwitchEnabled = newValue
    }
  }

  // 切换悬浮球可见性
  async toggleSuspensionBallVisible(val) {
    this.updateSettingData({
      suspensionBallVisible: val == undefined ? !this.settingData.suspensionBallVisible : val
    })
  }

  // 定时刷新目录任务
  initRefreshDirectoryTask() {
    this.stopRefreshDirectoryTask()
    this.startRefreshDirectoryTask()
  }

  startRefreshDirectoryTask() {
    const key = 'autoRefreshDirectory'
    // 如果开启了自动刷新目录
    if (this.settingData[key]) {
      // 设置定时刷新目录
      this.taskScheduler.scheduleTask(key, this.handleInterval(key), () => {
        const res = this.fileManager.refreshDirectory(this.locks)
        // 发送系统通知
        const notice = this.notificationManager.send(
          {
            title: t('messages.autoRefreshDirectoryTask'),
            body: res.message
          },
          res.success ? 'autoRefreshDirectoryTaskSuccess' : 'autoRefreshDirectoryTaskFailed'
        )
        notice?.show()
      })
    }
  }

  stopRefreshDirectoryTask() {
    this.taskScheduler.clearTask('autoRefreshDirectory')
  }

  restartRefreshDirectoryTask(oldData, newData) {
    if (
      oldData.autoRefreshDirectory !== newData.autoRefreshDirectory ||
      oldData.refreshDirectoryIntervalUnit !== newData.refreshDirectoryIntervalUnit ||
      oldData.refreshDirectoryIntervalTime !== newData.refreshDirectoryIntervalTime
    ) {
      this.stopRefreshDirectoryTask()
      if (newData.autoRefreshDirectory) {
        this.startRefreshDirectoryTask()
      }
    }
  }

  // 定时刷新网页壁纸任务
  initRefreshWebWallpaperTask() {
    this.stopRefreshWebWallpaperTask()
    if (this.settingData.autoRefreshWebWallpaper) {
      this.startRefreshWebWallpaperTask()
    }
  }

  startRefreshWebWallpaperTask() {
    const key = 'autoRefreshWebWallpaper'
    // 如果开启了自动刷新网页壁纸
    if (this.settingData[key]) {
      // 设置定时刷新网页壁纸
      this.taskScheduler.scheduleTask(key, this.handleInterval(key), async () => {
        await this.setWebWallpaper()
      })
    }
  }

  stopRefreshWebWallpaperTask() {
    this.taskScheduler.clearTask('autoRefreshWebWallpaper')
  }

  restartRefreshWebWallpaperTask(oldData, newData) {
    if (
      oldData.autoRefreshWebWallpaper !== newData.autoRefreshWebWallpaper ||
      oldData.refreshWebWallpaperIntervalUnit !== newData.refreshWebWallpaperIntervalUnit ||
      oldData.refreshWebWallpaperIntervalTime !== newData.refreshWebWallpaperIntervalTime
    ) {
      this.stopRefreshWebWallpaperTask()
      if (newData.autoRefreshWebWallpaper) {
        this.startRefreshWebWallpaperTask()
      }
    }
  }

  async toggleRefreshWebWallpaperTask(val) {
    const newValue = val === undefined ? !this.settingData.autoRefreshWebWallpaper : val
    await this.updateSettingData({
      autoRefreshWebWallpaper: newValue
    })
    if (newValue) {
      await this.toggleAutoSwitchWallpaper(false)
    }
    // 更新当前电源状态记录
    if (!this.powerState.isSystemIdle) {
      this.powerState.wasAutoRefreshWebEnabled = newValue
    }
  }

  // 定时下载壁纸任务
  initDownloadTask() {
    this.stopDownloadTask()
    this.startDownloadTask()
  }

  startDownloadTask() {
    const key = 'autoDownload'
    // 如果开启了自动下载壁纸
    if (this.settingData[key]) {
      // 设置定时下载壁纸
      this.taskScheduler.scheduleTask(key, this.handleInterval(key), async () => {
        await this.wallpaperManager.downloadWallpaper(() => {
          this.stopDownloadTask()
        })
      })
    }
  }

  stopDownloadTask() {
    this.taskScheduler.clearTask('autoDownload')
  }

  restartDownloadTask(oldData, newData) {
    const normalizeMediaTypes = (data) =>
      JSON.stringify(normalizeDownloadMediaTypes(data?.downloadMediaTypes))
    // 检查是否需要重启下载任务
    const shouldRestart =
      oldData.autoDownload !== newData.autoDownload ||
      oldData.downloadIntervalUnit !== newData.downloadIntervalUnit ||
      oldData.downloadIntervalTime !== newData.downloadIntervalTime ||
      JSON.stringify(oldData.downloadSources || []) !==
        JSON.stringify(newData.downloadSources || []) ||
      JSON.stringify(oldData.downloadKeywords || []) !==
        JSON.stringify(newData.downloadKeywords || []) ||
      normalizeMediaTypes(oldData) !== normalizeMediaTypes(newData)

    if (shouldRestart) {
      this.stopDownloadTask()
      // 如果下载源或关键词发生变化，通知WallpaperManager重置任务状态
      if (
        JSON.stringify(oldData.downloadSources || []) !==
          JSON.stringify(newData.downloadSources || []) ||
        JSON.stringify(oldData.downloadKeywords || []) !==
          JSON.stringify(newData.downloadKeywords || []) ||
        normalizeMediaTypes(oldData) !== normalizeMediaTypes(newData)
      ) {
        // 通知WallpaperManager重置下载参数
        if (this.wallpaperManager) {
          this.wallpaperManager.resetDownloadTaskCompletedStatus()
        }
      }
      if (newData.autoDownload) {
        this.startDownloadTask()
      }
    }
  }

  // 定时清理下载资源任务
  initClearDownloadedTask() {
    this.stopClearDownloadedTask()
    this.startClearDownloadedTask()
  }

  startClearDownloadedTask() {
    const key = 'autoClearDownloaded'
    // 如果开启了自动清理下载资源
    if (this.settingData[key]) {
      // 设置定时清理过期的下载的壁纸，每小时执行一次
      this.taskScheduler.scheduleTask(key, 60 * 60 * 1000, async () => {
        const res = await this.wallpaperManager.clearDownloadedExpired({ excludeProtected: true })
        // 发送系统通知
        const notice = this.notificationManager.send(
          {
            title: t('messages.autoClearDownloadedTask'),
            body: res.success
              ? t('messages.autoClearDownloadedTaskSuccess')
              : t('messages.autoClearDownloadedTaskFailed')
          },
          res.success ? 'autoClearDownloadedTaskSuccess' : 'autoClearDownloadedTaskFailed'
        )
        notice?.show()
      })
    }
  }

  stopClearDownloadedTask() {
    this.taskScheduler.clearTask('autoClearDownloaded')
  }

  restartClearDownloadedTask(oldData, newData) {
    if (oldData.autoClearDownloaded !== newData.autoClearDownloaded) {
      this.stopClearDownloadedTask()
      if (newData.autoClearDownloaded) {
        this.startClearDownloadedTask()
      }
    }
  }

  // 处理延时时间，单位毫秒
  handleInterval(key, defaultMsVal = 15 * 60 * 1000) {
    const {
      switchIntervalUnit,
      switchIntervalTime,
      refreshDirectoryIntervalUnit,
      refreshDirectoryIntervalTime,
      refreshWebWallpaperIntervalTime,
      refreshWebWallpaperIntervalUnit,
      downloadIntervalUnit,
      downloadIntervalTime,
      clearDownloadedExpiredTime,
      clearDownloadedExpiredUnit
    } = this.settingData

    const data = {
      autoSwitchWallpaper: {
        unit: switchIntervalUnit,
        intervalTime: switchIntervalTime
      },
      autoRefreshDirectory: {
        unit: refreshDirectoryIntervalUnit,
        intervalTime: refreshDirectoryIntervalTime
      },
      autoRefreshWebWallpaper: {
        unit: refreshWebWallpaperIntervalUnit,
        intervalTime: refreshWebWallpaperIntervalTime
      },
      autoDownload: {
        unit: downloadIntervalUnit,
        intervalTime: downloadIntervalTime
      },
      autoClearDownloaded: {
        unit: clearDownloadedExpiredUnit,
        intervalTime: clearDownloadedExpiredTime
      }
    }

    const { unit, intervalTime } = data[key] || {}

    return handleTimeByUnit(intervalTime, unit) || defaultMsVal
  }

  // 关闭应用前清理
  cleanup() {
    try {
      // 取消所有定时任务
      this.taskScheduler?.clearAllTasks()

      // 停止文件服务子进程
      if (this.fileServer) {
        try {
          this.fileServer.stop()
          this.fileServer = null
        } catch (err) {
          global.logger.error(`停止文件服务子进程失败: ${err}`)
        }
      }

      // 停止H5服务子进程
      if (this.h5Server) {
        try {
          this.h5Server.stop()
          this.h5Server = null
          this.h5ServerUrl = null
        } catch (err) {
          global.logger.error(`停止H5服务子进程失败: ${err}`)
        }
      }

      // 关闭数据库连接
      if (this.db) {
        try {
          this.db.close()
          this.db = null
        } catch (err) {
          global.logger.error(`关闭数据库连接失败: ${err}`)
        }
      }

      // 移除电源监听器
      if (powerMonitor.removeAllListeners) {
        powerMonitor.removeAllListeners('suspend')
        powerMonitor.removeAllListeners('resume')
        powerMonitor.removeAllListeners('lock-screen')
        powerMonitor.removeAllListeners('unlock-screen')
      }

      global.logger.info('应用资源已清理完毕')
    } catch (err) {
      global.logger.error(`清理资源失败: ${err}`)
    } finally {
      this.db = null
    }
  }
}
