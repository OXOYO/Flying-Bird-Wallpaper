import fs from 'node:fs'
import path from 'node:path'
import https from 'node:https'
import { pathToFileURL } from 'node:url'
import { app } from 'electron'
import { t } from '../../i18n/server.js'
import {
  createCodedError,
  PLUGIN_APP_VERSION_MIN,
  PLUGIN_LOAD_ERROR_CODE,
  resolvePluginAppVersion
} from '../../common/utils.js'
import {
  buildCompositeId,
  normalizeSourceName,
  validateSourceName
} from '../../common/pluginResourceId.js'

export default class PluginManager {
  static _instance = null

  static getInstance(logger, dbManager) {
    if (!PluginManager._instance) {
      PluginManager._instance = new PluginManager(logger, dbManager)
    }
    return PluginManager._instance
  }

  constructor(logger, dbManager) {
    if (PluginManager._instance) {
      return PluginManager._instance
    }

    this.logger = logger
    this.dbManager = dbManager
    this.pluginDir = process.env.FBW_PLUGINS_PATH
    this.runtimePluginsDir = path.join(this.pluginDir, 'installed')
    this.cacheDir = path.join(this.pluginDir, 'cache')
    this.ensureDirectories()
    this.centralRepo = 'OXOYO/Flying-Bird-Wallpaper-Plugins'
    this.appVersion = app.getVersion() || '1.0.0'
    this.cdnProviders = [
      {
        name: 'jsdelivr',
        baseUrl: 'https://cdn.jsdelivr.net/gh',
        enabled: true
      },
      {
        name: 'github',
        baseUrl: 'https://raw.githubusercontent.com',
        enabled: true
      }
    ]
    this.currentCdnIndex = 0

    PluginManager._instance = this
  }

  pmKey(suffix) {
    return `pages.Setting.pluginMarketplace.${suffix}`
  }

  opKey(suffix) {
    return this.pmKey(`operationErrors.${suffix}`)
  }

  loadErrorsKey(suffix) {
    return this.pmKey(`loadErrors.${suffix}`)
  }

  joinSourceLoadErrors(errors) {
    return errors.join(t(this.loadErrorsKey('errorsSeparator')))
  }

  /** 解析插件源加载错误类型（供渲染进程按当前语言展示） */
  parseSourceLoadErrorItem(sourceName, error) {
    if (error?.errorCode === PLUGIN_LOAD_ERROR_CODE.FETCH_TIMEOUT) {
      return { sourceName, hintKey: 'network' }
    }
    const raw = String(error?.message || error || '')
      .replace(/\s*\|\s*url:\s*https?:\/\/\S+/gi, '')
      .replace(/\bhttps?:\/\/\S+/gi, '')
      .trim()
    let hintKey = 'generic'
    if (
      raw === PLUGIN_LOAD_ERROR_CODE.FETCH_TIMEOUT ||
      /ECONNRESET|ETIMEDOUT|ENOTFOUND|ECONNREFUSED|ENETUNREACH|EAI_AGAIN|socket hang up/i.test(
        raw
      ) ||
      error?.code === 'ETIMEDOUT' ||
      error?.code === 'ECONNRESET'
    ) {
      hintKey = 'network'
    } else if (/HTTP\s*5\d{2}/i.test(raw)) {
      hintKey = 'server5xx'
    } else if (/HTTP\s*404/i.test(raw)) {
      hintKey = 'notFound'
    } else if (/ENOENT|no such file|ENOTDIR/i.test(raw)) {
      hintKey = 'localPath'
    } else if (/JSON|Unexpected token|plugins\.json/i.test(raw)) {
      hintKey = 'jsonInvalid'
    }
    return { sourceName, hintKey }
  }

  buildLoadNotice(kind, errors = [], extra = {}) {
    const summaries = Array.isArray(extra.summaries) ? extra.summaries : []
    if (
      kind === 'partialFailed' ||
      kind === 'partialFailedWithCache' ||
      kind === 'allFailed' ||
      kind === 'versionMismatch'
    ) {
      if (!errors.length && !summaries.length) return null
      return {
        kind,
        errors,
        summaries,
        appVersion: extra.appVersion || this.appVersion
      }
    }
    if (kind === 'exceptionWithCache' || kind === 'getAvailableFail') {
      return { kind, errorMessage: extra.errorMessage || '' }
    }
    return null
  }

  collectSourceLoadSummaries(sourceStats) {
    const summaries = []
    if (!Array.isArray(sourceStats)) return summaries
    for (const stat of sourceStats) {
      if (stat.error) continue
      const scanned = stat.scanned || 0
      if (scanned > 0 && (stat.listed || 0) === 0) {
        summaries.push({
          sourceName: stat.sourceName,
          scanned,
          incompatible: stat.incompatible || 0,
          invisible: stat.invisible || 0
        })
      }
    }
    return summaries
  }

  isVersionOnlyMismatch(sourceStats, sourceErrorItems, plugins) {
    if (plugins.length > 0 || sourceErrorItems.length > 0) {
      return false
    }
    const stats = Array.isArray(sourceStats) ? sourceStats : []
    if (stats.length === 0) return false
    return stats.every(
      (item) => !item.error && (item.scanned || 0) > 0 && (item.listed || 0) === 0
    )
  }

  resolveAvailablePluginsLoadNotice({ plugins, sourceErrorItems, sourceStats, fromCache }) {
    const summaries = this.collectSourceLoadSummaries(sourceStats)
    const hasErrors = sourceErrorItems.length > 0
    const hasSummaries = summaries.length > 0
    if (!hasErrors && !hasSummaries) return null

    let kind = 'partialFailed'
    if (plugins.length === 0) {
      kind = hasErrors ? 'allFailed' : 'versionMismatch'
    } else if (fromCache) {
      kind = 'partialFailedWithCache'
    }

    return this.buildLoadNotice(kind, sourceErrorItems, {
      summaries,
      appVersion: this.appVersion
    })
  }

  /** 将插件源加载错误转为用户可读文案（不含 URL） */
  toUserFacingLoadError(sourceName, error) {
    const { sourceName: name, hintKey } = this.parseSourceLoadErrorItem(sourceName, error)
    const hint = t(this.loadErrorsKey(hintKey))
    return t(this.loadErrorsKey('sourceItem'), { sourceName: name, hint })
  }

  compareVersions(version1, version2) {
    const v1 = version1.split('.').map(Number)
    const v2 = version2.split('.').map(Number)

    for (let i = 0; i < Math.max(v1.length, v2.length); i++) {
      const num1 = v1[i] || 0
      const num2 = v2[i] || 0

      if (num1 > num2) return 1
      if (num1 < num2) return -1
    }

    return 0
  }

  isAppBelowPluginMinVersion(minVersion = PLUGIN_APP_VERSION_MIN) {
    return this.compareVersions(this.appVersion, minVersion) < 0
  }

  isVersionCompatible(pluginVersionRange) {
    const { min, max } = pluginVersionRange

    if (min && min !== '*') {
      if (this.compareVersions(this.appVersion, min) < 0) {
        return false
      }
    }

    if (max && max !== '*') {
      if (this.compareVersions(this.appVersion, max) > 0) {
        return false
      }
    }

    return true
  }

  getCurrentCdn() {
    return this.cdnProviders[this.currentCdnIndex]
  }

  switchToNextCdn() {
    this.currentCdnIndex = (this.currentCdnIndex + 1) % this.cdnProviders.length
  }

  ensureDirectories() {
    if (!fs.existsSync(this.pluginDir)) {
      fs.mkdirSync(this.pluginDir, { recursive: true })
    }
    if (!fs.existsSync(this.runtimePluginsDir)) {
      fs.mkdirSync(this.runtimePluginsDir, { recursive: true })
    }
    if (!fs.existsSync(this.cacheDir)) {
      fs.mkdirSync(this.cacheDir, { recursive: true })
    }
  }

  createPluginKey(sourceName, pluginName) {
    return buildCompositeId(sourceName, pluginName)
  }

  getDefaultSources() {
    return [
      {
        id: 'source_official',
        name: 'official',
        type: 'github',
        location: this.centralRepo,
        enabled: true,
        priority: 1,
        isOfficial: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    ]
  }

  normalizeSources(sources) {
    const list = Array.isArray(sources) ? [...sources] : []
    const officialRepo = this.centralRepo
    const now = new Date().toISOString()

    let officialIndex = list.findIndex((item) => item?.name === 'official' || item?.isOfficial === true)
    if (officialIndex < 0) {
      list.unshift(this.getDefaultSources()[0])
      return { changed: true, sources: list }
    }

    const official = { ...list[officialIndex] }
    let changed = false
    if (official.name !== 'official') {
      official.name = 'official'
      changed = true
    }
    if (official.type !== 'github') {
      official.type = 'github'
      changed = true
    }
    const normalizedLocation = this.normalizeGithubRepo(official.location)
    if (normalizedLocation !== officialRepo) {
      official.location = officialRepo
      changed = true
    }
    if (official.enabled !== true) {
      official.enabled = true
      changed = true
    }
    if (official.isOfficial !== true) {
      official.isOfficial = true
      changed = true
    }
    if (!official.id) {
      official.id = 'source_official'
      changed = true
    }
    if (!official.createdAt) {
      official.createdAt = now
      changed = true
    }
    if (changed) {
      official.updatedAt = now
      list[officialIndex] = official
    }

    // 移除重复 official 源，保留第一条
    const deduped = []
    let seenOfficial = false
    for (const item of list) {
      const isOfficial = item?.name === 'official' || item?.isOfficial === true
      if (isOfficial) {
        if (seenOfficial) {
          changed = true
          continue
        }
        seenOfficial = true
      }
      deduped.push(item)
    }

    return { changed, sources: deduped }
  }

  async getSysRecordData(key, defaultValue) {
    const res = await this.dbManager.getSysRecord(key)
    if (res?.success && res.data?.storeData !== undefined) {
      return res.data.storeData
    }
    return defaultValue
  }

  async setSysRecordData(key, data, type = 'object') {
    return await this.dbManager.setSysRecord(key, data, type)
  }

  normalizeGithubRepo(location) {
    if (!location) return null
    const str = String(location).trim().replace(/\.git$/, '')
    const sshMatch = str.match(/^git@github\.com:([^/]+)\/([^/]+)$/i)
    if (sshMatch) return `${sshMatch[1]}/${sshMatch[2]}`
    const httpsMatch = str.match(/^https?:\/\/github\.com\/([^/]+)\/([^/]+)$/i)
    if (httpsMatch) return `${httpsMatch[1]}/${httpsMatch[2]}`
    const shortMatch = str.match(/^([^/]+)\/([^/]+)$/)
    if (shortMatch) return `${shortMatch[1]}/${shortMatch[2]}`
    return null
  }

  async getPluginSources() {
    let sources = await this.getSysRecordData('pluginSources', [])
    if (!Array.isArray(sources) || sources.length === 0) {
      sources = this.getDefaultSources()
      await this.setSysRecordData('pluginSources', sources, 'array')
    } else {
      const normalized = this.normalizeSources(sources)
      sources = normalized.sources
      if (normalized.changed) {
        await this.setSysRecordData('pluginSources', sources, 'array')
      }
    }
    return { success: true, data: sources, message: '' }
  }

  async addPluginSource(source) {
    try {
      const name = normalizeSourceName(source?.name)
      const nameCheck = validateSourceName(name)
      if (!nameCheck.valid) {
        return { success: false, message: t(this.opKey('invalidSourceName')) }
      }
      if (!source?.type || !['github', 'local'].includes(source.type)) {
        return { success: false, message: t(this.opKey('invalidSourceType')) }
      }
      if (!source?.location) {
        return { success: false, message: t(this.opKey('locationRequired')) }
      }

      const listRes = await this.getPluginSources()
      const sources = listRes.data || []
      if (sources.some((item) => item.name === name)) {
        return { success: false, message: t(this.opKey('sourceNameExists')) }
      }

      const newSource = {
        id: `source_${Date.now()}`,
        name,
        type: source.type,
        location: String(source.location).trim(),
        enabled: source.enabled !== false,
        priority: Number.isInteger(source.priority) ? source.priority : sources.length + 1,
        isOfficial: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }

      const validation = await this.validateSourceStructure(newSource)
      if (!validation.success) return validation

      sources.push(newSource)
      await this.setSysRecordData('pluginSources', sources, 'array')
      return { success: true, data: newSource, message: t(this.pmKey('feedback.addSourceSuccess')) }
    } catch (error) {
      this.logger.error('添加插件源失败:', error)
      return {
        success: false,
        message: t(this.opKey('addSourceFailDetail'), { error: error.message })
      }
    }
  }

  async removePluginSource(sourceName) {
    const name = normalizeSourceName(sourceName)
    const listRes = await this.getPluginSources()
    const sources = listRes.data || []
    const target = sources.find((item) => item.name === name)
    if (!target) return { success: false, message: t(this.opKey('sourceNotFound')) }
    if (target.isOfficial) return { success: false, message: t(this.opKey('officialSourceCannotDelete')) }

    const installedPlugins = await this.getSysRecordData('plugins', {})
    const relatedInstalledCount = Object.values(installedPlugins).filter(
      (item) => item && item.sourceName === name
    ).length
    if (relatedInstalledCount > 0) {
      return {
        success: false,
        message: t(this.opKey('installedPluginsBlockDelete'), { count: relatedInstalledCount })
      }
    }

    const next = sources.filter((item) => item.name !== name)
    await this.setSysRecordData('pluginSources', next, 'array')
    return { success: true, message: t(this.pmKey('feedback.removeSourceSuccess')) }
  }

  async updatePluginSource(sourceName, patch) {
    const name = normalizeSourceName(sourceName)
    const listRes = await this.getPluginSources()
    const sources = listRes.data || []
    const idx = sources.findIndex((item) => item.name === name)
    if (idx < 0) return { success: false, message: t(this.opKey('sourceNotFound')) }
    if (sources[idx].isOfficial && patch?.name && patch.name !== name) {
      return { success: false, message: t(this.opKey('officialSourceCannotRename')) }
    }
    const next = {
      ...sources[idx],
      ...patch,
      name: patch?.name ? normalizeSourceName(patch.name) : sources[idx].name,
      updatedAt: new Date().toISOString()
    }
    const nameCheck = validateSourceName(next.name)
    if (!nameCheck.valid) {
      return { success: false, message: t(this.opKey('invalidSourceName')) }
    }
    if (sources.some((item, i) => i !== idx && item.name === next.name)) {
      return { success: false, message: t(this.opKey('sourceNameExists')) }
    }

    const validation = await this.validateSourceStructure(next)
    if (!validation.success) return validation
    sources[idx] = next
    await this.setSysRecordData('pluginSources', sources, 'array')
    return { success: true, data: next, message: t(this.pmKey('feedback.updateSourceSuccess')) }
  }

  async validateSourceStructure(source) {
    try {
      const pluginsList = await this.readPluginsList(source)
      const pluginList = pluginsList?.plugins
      if (!Array.isArray(pluginList)) {
        return {
          success: false,
          message: t(this.opKey('pluginsJsonMissingArray'), { sourceName: source.name })
        }
      }
      const invalidEntry = pluginList.find((entry) => typeof entry !== 'string' || !entry.trim())
      if (invalidEntry) {
        return {
          success: false,
          message: t(this.opKey('pluginsJsonInvalidPlugins'), { sourceName: source.name })
        }
      }
      return { success: true, message: '' }
    } catch (error) {
      return {
        success: false,
        message: t(this.opKey('sourceValidateFail'), { sourceName: source.name, error: error.message })
      }
    }
  }

  async readPluginsList(source) {
    if (source.type === 'local') {
      const filePath = path.join(source.location, 'plugins.json')
      const data = fs.readFileSync(filePath, 'utf8')
      return JSON.parse(data)
    }
    const repo = this.normalizeGithubRepo(source.location)
    if (!repo) throw new Error(t(this.opKey('invalidGithubRepo')))
    const url = `https://raw.githubusercontent.com/${repo}/main/plugins.json`
    return await this.fetchUrl(url)
  }

  async readPluginManifest(source, pluginName, version = 'main') {
    if (source.type === 'local') {
      const filePath = path.join(source.location, 'plugins', pluginName, 'manifest.json')
      const data = fs.readFileSync(filePath, 'utf8')
      return JSON.parse(data)
    }
    const repo = this.normalizeGithubRepo(source.location)
    if (!repo) throw new Error(t(this.opKey('invalidGithubRepo')))
    const url = `https://raw.githubusercontent.com/${repo}/${version}/plugins/${pluginName}/manifest.json`
    return await this.fetchUrl(url)
  }

  async readPluginMain(source, pluginName, version = 'main') {
    if (source.type === 'local') {
      return fs.readFileSync(path.join(source.location, 'plugins', pluginName, 'main.mjs'), 'utf8')
    }
    const repo = this.normalizeGithubRepo(source.location)
    if (!repo) throw new Error(t(this.opKey('invalidGithubRepo')))
    const url = `https://raw.githubusercontent.com/${repo}/${version}/plugins/${pluginName}/main.mjs`
    return await this.fetchUrl(url, false)
  }

  resolveLogoUrl(source, pluginName, logo, version = 'main') {
    if (!logo) return ''
    const logoStr = String(logo).trim()
    if (!logoStr) return ''
    if (/^https?:\/\//i.test(logoStr)) return logoStr
    if (source.type === 'github') {
      const repo = this.normalizeGithubRepo(source.location)
      if (!repo) return ''
      const relativePath = logoStr.replace(/^\.?\//, '')
      return `https://raw.githubusercontent.com/${repo}/${version}/plugins/${pluginName}/${relativePath}`
    }
    const logoPath = path.join(source.location, 'plugins', pluginName, logoStr.replace(/^\.?\//, ''))
    return pathToFileURL(logoPath).toString()
  }

  resolveInstalledLogoUrl(pluginDir, logo) {
    if (!logo) return ''
    const logoStr = String(logo).trim()
    if (!logoStr) return ''
    if (/^https?:\/\//i.test(logoStr)) return logoStr
    return pathToFileURL(path.join(pluginDir, logoStr.replace(/^\.?\//, ''))).toString()
  }

  async getAvailablePlugins() {
    try {
      const listRes = await this.getPluginSources()
      const sources = (listRes.data || [])
        .filter((item) => item.enabled !== false)
        .sort((a, b) => (a.priority || 999) - (b.priority || 999))
      if (sources.length === 0) {
        return { success: false, data: [], message: t(this.opKey('noSourceEnabled')) }
      }
      const plugins = []
      const sourceErrorItems = []
      const sourceStats = []
      const appBelowPluginMin = this.isAppBelowPluginMinVersion()
      for (const source of sources) {
        const stat = {
          sourceName: source.name,
          scanned: 0,
          listed: 0,
          incompatible: 0,
          invisible: 0,
          failed: 0,
          error: null
        }
        try {
          const pluginsData = await this.readPluginsList(source)
          const pluginList = pluginsData?.plugins
          if (!Array.isArray(pluginList)) {
            throw new Error(t(this.opKey('pluginsJsonMissingArrayShort')))
          }
          for (const entry of pluginList) {
            try {
              if (typeof entry !== 'string' || !entry.trim()) {
                throw new Error(t(this.opKey('pluginsJsonInvalidPluginsShort')))
              }
              const pluginName = entry.trim()
              stat.scanned += 1
              if (appBelowPluginMin) {
                stat.incompatible += 1
                continue
              }
              const manifest = await this.readPluginManifest(source, pluginName)
              const compatible = this.isVersionCompatible(resolvePluginAppVersion(manifest.appVersion))
              const visible = manifest.visible === true
              if (!compatible) {
                stat.incompatible += 1
                continue
              }
              if (!visible) {
                stat.invisible += 1
                continue
              }
              stat.listed += 1
              plugins.push({
                name: manifest.name,
                sourceName: source.name,
                pluginKey: this.createPluginKey(source.name, manifest.name),
                version: manifest.version,
                displayName: manifest.displayName,
                description: manifest.description,
                author: manifest.author,
                site: manifest.site,
                logo: manifest.logo,
                logoUrl: this.resolveLogoUrl(source, pluginName, manifest.logo),
                compatible,
                appVersion: resolvePluginAppVersion(manifest.appVersion),
                requireSecretKey: manifest.requireSecretKey || false,
                supportSearch: manifest.supportSearch === true,
                supportDownload: manifest.supportDownload === true,
                supportSearchTypes: Array.isArray(manifest.supportSearchTypes)
                  ? manifest.supportSearchTypes
                  : []
              })
            } catch (error) {
              stat.failed += 1
              this.logger.error(`获取插件 ${source.name}:${String(entry || 'unknown')} 信息失败:`, error)
            }
          }
        } catch (error) {
          const reason = error?.message || String(error)
          stat.error = error
          this.logger.error(`读取插件源 ${source.name} 失败: ${reason}`)
          sourceErrorItems.push(this.parseSourceLoadErrorItem(source.name, error))
        }
        sourceStats.push(stat)
      }

      const loadNoticeExtra = { sourceErrorItems, sourceStats }

      if (plugins.length > 0) {
        this.cachePluginsList(plugins)
        return {
          success: true,
          data: plugins,
          message: '',
          loadNotice: this.resolveAvailablePluginsLoadNotice({
            plugins,
            ...loadNoticeExtra,
            fromCache: false
          })
        }
      }

      const cached = this.getCachedPluginsList()
      const versionOnlyMismatch = this.isVersionOnlyMismatch(
        sourceStats,
        sourceErrorItems,
        plugins
      )
      if (cached.length > 0 && !versionOnlyMismatch) {
        return {
          success: true,
          data: cached,
          message: '',
          fromCache: true,
          loadNotice: this.resolveAvailablePluginsLoadNotice({
            plugins,
            ...loadNoticeExtra,
            fromCache: true
          })
        }
      }

      return {
        success: false,
        data: [],
        message: sourceErrorItems.length > 0 ? '' : t(this.loadErrorsKey('noPlugins')),
        loadNotice: this.resolveAvailablePluginsLoadNotice({
          plugins,
          ...loadNoticeExtra,
          fromCache: false
        })
      }
    } catch (error) {
      this.logger.error('获取可用插件列表失败:', error)
      const cached = this.getCachedPluginsList()
      if (cached.length > 0) {
        return {
          success: true,
          data: cached,
          message: '',
          loadNotice: this.buildLoadNotice('exceptionWithCache', [], {
            errorMessage: error.message
          })
        }
      }
      return {
        success: false,
        data: [],
        message: '',
        loadNotice: this.buildLoadNotice('getAvailableFail', [], { errorMessage: error.message })
      }
    }
  }

  async installPlugin(sourceName, pluginName, version = 'main') {
    try {
      const listRes = await this.getPluginSources()
      const source = (listRes.data || []).find((item) => item.name === sourceName)
      if (!source) return { success: false, message: t(this.opKey('sourceNotFound')) }
      const pluginDir = path.join(this.runtimePluginsDir, sourceName, pluginName)
      if (!fs.existsSync(pluginDir)) {
        fs.mkdirSync(pluginDir, { recursive: true })
      }

      const manifest = await this.readPluginManifest(source, pluginName, version)

      if (!this.isVersionCompatible(resolvePluginAppVersion(manifest.appVersion))) {
        this.logger.error(`插件 ${pluginName} 与当前应用版本 ${this.appVersion} 不兼容`)
        return { success: false, message: t(this.opKey('pluginIncompatible')) }
      }

      fs.writeFileSync(path.join(pluginDir, 'manifest.json'), JSON.stringify(manifest, null, 2))

      const mainContent = await this.readPluginMain(source, pluginName, version)
      fs.writeFileSync(path.join(pluginDir, 'main.mjs'), mainContent)

      const plugins = await this.getSysRecordData('plugins', {})
      const pluginKey = this.createPluginKey(sourceName, pluginName)
      plugins[pluginKey] = {
        pluginKey,
        sourceName,
        name: manifest.name,
        value: pluginKey,
        label: pluginKey,
        logo: manifest.logo,
        logoUrl: this.resolveLogoUrl(source, pluginName, manifest.logo, version),
        version: manifest.version,
        displayName: pluginKey,
        description: manifest.description,
        author: manifest.author,
        site: manifest.site,
        enabled: manifest.enabled !== undefined ? manifest.enabled : true,
        requireSecretKey: manifest.requireSecretKey || false,
        supportSearch: manifest.supportSearch === true,
        supportDownload: manifest.supportDownload === true,
        supportSearchTypes: Array.isArray(manifest.supportSearchTypes)
          ? manifest.supportSearchTypes
          : [],
        appVersion: resolvePluginAppVersion(manifest.appVersion),
        installedAt: new Date().toISOString()
      }

      const res = await this.setSysRecordData('plugins', plugins, 'object')
      if (res.success) {
        this.logger.info(`插件 ${pluginName} 安装信息已写入数据库`)
      } else {
        this.logger.error(`插件 ${pluginName} 安装信息写入数据库失败: ${res.message}`)
      }

      return { success: true, message: t(this.pmKey('feedback.installSuccess')) }
    } catch (error) {
      this.logger.error('安装插件失败:', error)
      return {
        success: false,
        message: t(this.opKey('installFailDetail'), { error: error.message })
      }
    }
  }

  async uninstallPlugin(sourceName, pluginName) {
    try {
      const pluginDir = path.join(this.runtimePluginsDir, sourceName, pluginName)
      if (!fs.existsSync(pluginDir)) {
        return { success: false, message: t(this.opKey('pluginNotFound')) }
      }

      const manifestPath = path.join(pluginDir, 'manifest.json')
      const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'))

      if (manifest.type === 'system') {
        this.logger.error(`系统插件 ${pluginName} 不允许卸载`)
        return { success: false, message: t(this.opKey('systemPluginCannotUninstall')) }
      }

      fs.rmSync(pluginDir, { recursive: true, force: true })

      const plugins = await this.getSysRecordData('plugins', {})
      const pluginKey = this.createPluginKey(sourceName, pluginName)

      if (plugins[pluginKey]) {
        delete plugins[pluginKey]
        const res = await this.setSysRecordData('plugins', plugins, 'object')
        if (res.success) {
          this.logger.info(`插件 ${pluginName} 信息已从数据库移除`)
        } else {
          this.logger.error(`插件 ${pluginName} 信息从数据库移除失败: ${res.message}`)
        }
      }

      return { success: true, message: t(this.pmKey('feedback.uninstallSuccess')) }
    } catch (error) {
      this.logger.error('卸载插件失败:', error)
      return {
        success: false,
        message: t(this.opKey('uninstallFailDetail'), { error: error.message })
      }
    }
  }

  async updatePlugin(sourceName, pluginName) {
    try {
      const pluginDir = path.join(this.runtimePluginsDir, sourceName, pluginName)
      const backupDir = path.join(this.cacheDir, `backup-${sourceName}-${pluginName}`)
      if (fs.existsSync(backupDir)) fs.rmSync(backupDir, { recursive: true, force: true })
      if (fs.existsSync(pluginDir)) fs.cpSync(pluginDir, backupDir, { recursive: true })
      const uninstallRes = await this.uninstallPlugin(sourceName, pluginName)
      if (!uninstallRes.success) return uninstallRes
      const installRes = await this.installPlugin(sourceName, pluginName)
      if (installRes.success) {
        if (fs.existsSync(backupDir)) fs.rmSync(backupDir, { recursive: true, force: true })
        return installRes
      }
      if (fs.existsSync(backupDir)) {
        fs.mkdirSync(path.dirname(pluginDir), { recursive: true })
        fs.cpSync(backupDir, pluginDir, { recursive: true })
        const manifestPath = path.join(pluginDir, 'manifest.json')
        if (fs.existsSync(manifestPath)) {
          const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'))
          const plugins = await this.getSysRecordData('plugins', {})
          const pluginKey = this.createPluginKey(sourceName, pluginName)
          plugins[pluginKey] = {
            pluginKey,
            sourceName,
            name: manifest.name,
            value: pluginKey,
            label: pluginKey,
            logo: manifest.logo,
            logoUrl: this.resolveInstalledLogoUrl(pluginDir, manifest.logo),
            version: manifest.version,
            displayName: pluginKey,
            description: manifest.description,
            author: manifest.author,
            site: manifest.site,
            enabled: manifest.enabled !== undefined ? manifest.enabled : true,
            requireSecretKey: manifest.requireSecretKey || false,
            supportSearch: manifest.supportSearch === true,
            supportDownload: manifest.supportDownload === true,
            supportSearchTypes: Array.isArray(manifest.supportSearchTypes)
              ? manifest.supportSearchTypes
              : [],
            appVersion: resolvePluginAppVersion(manifest.appVersion),
            installedAt: new Date().toISOString()
          }
          await this.setSysRecordData('plugins', plugins, 'object')
        }
      }
      return installRes
    } catch (error) {
      this.logger.error('更新插件失败:', error)
      return {
        success: false,
        message: t(this.opKey('updateFailDetail'), { error: error.message })
      }
    }
  }

  async getInstalledPlugins() {
    try {
      const plugins = await this.getSysRecordData('plugins', {})
      if (!plugins || Object.keys(plugins).length === 0) {
        return { success: true, data: [], message: '' }
      }

      const list = []
      const nextRecords = { ...plugins }
      const sourcesRes = await this.getPluginSources()
      const sources = sourcesRes.success ? sourcesRes.data || [] : []
      const sourceMap = Object.fromEntries(sources.map((item) => [item.name, item]))
      for (const [key, item] of Object.entries(plugins)) {
        const sourceName = item?.sourceName
        const pluginName = item?.name
        const pluginKey = item?.pluginKey || key
        if (!sourceName || !pluginName) {
          delete nextRecords[key]
          continue
        }
        const pluginDir = path.join(this.runtimePluginsDir, sourceName, pluginName)
        const manifestPath = path.join(pluginDir, 'manifest.json')
        if (fs.existsSync(manifestPath) && fs.existsSync(path.join(pluginDir, 'main.mjs'))) {
          try {
            const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'))
            const source = sourceMap[sourceName] || {
              name: sourceName,
              type: 'local',
              location: this.runtimePluginsDir
            }
            list.push({
              pluginKey,
              sourceName,
              name: manifest.name,
              logo: manifest.logo,
              logoUrl:
                source.type === 'github'
                  ? this.resolveLogoUrl(source, pluginName, manifest.logo)
                  : this.resolveInstalledLogoUrl(pluginDir, manifest.logo),
              version: manifest.version,
              displayName: manifest.displayName,
              description: manifest.description,
              author: manifest.author,
              site: manifest.site,
              enabled: manifest.enabled !== undefined ? manifest.enabled : true,
              requireSecretKey: manifest.requireSecretKey || false,
              supportSearch: manifest.supportSearch === true,
              supportDownload: manifest.supportDownload === true,
              supportSearchTypes: Array.isArray(manifest.supportSearchTypes)
                ? manifest.supportSearchTypes
                : [],
              appVersion: resolvePluginAppVersion(manifest.appVersion)
            })
          } catch (error) {
            this.logger.error(`读取插件 ${sourceName}:${pluginName} 配置失败:`, error)
          }
        }
      }
      await this.setSysRecordData('plugins', nextRecords, 'object')
      return { success: true, data: list, message: '' }
    } catch (error) {
      const errorMessage = error.message || error.toString() || t(this.opKey('unknownError'))
      this.logger.error('获取已安装插件列表失败:', errorMessage)
      return {
        success: false,
        data: [],
        message: t(this.opKey('getInstalledFailDetail'), { error: errorMessage })
      }
    }
  }

  getCachedPluginsList() {
    const cachePath = path.join(this.pluginDir, 'plugins-cache.json')
    if (fs.existsSync(cachePath)) {
      try {
        const cacheData = fs.readFileSync(cachePath, 'utf8')
        return JSON.parse(cacheData)
      } catch (error) {
        this.logger.error('读取插件缓存失败:', error)
      }
    }
    return []
  }

  cachePluginsList(plugins) {
    const cachePath = path.join(this.pluginDir, 'plugins-cache.json')
    try {
      fs.writeFileSync(cachePath, JSON.stringify(plugins, null, 2))
    } catch (error) {
      this.logger.error('缓存插件列表失败:', error)
    }
  }

  async fetchUrl(url, parseJson = true, timeoutMs = 20000) {
    return new Promise((resolve, reject) => {
      let settled = false
      const finish = (handler, value) => {
        if (settled) return
        settled = true
        clearTimeout(timer)
        handler(value)
      }

      const timer = setTimeout(() => {
        finish(
          reject,
          createCodedError(PLUGIN_LOAD_ERROR_CODE.FETCH_TIMEOUT, { timeoutMs })
        )
      }, timeoutMs)

      const req = https.get(url, (res) => {
        let data = ''
        res.on('data', (chunk) => {
          data += chunk
        })
        res.on('end', () => {
          try {
            const statusCode = Number(res.statusCode || 0)
            if (statusCode < 200 || statusCode >= 300) {
              const message = `HTTP ${statusCode} ${res.statusMessage || ''}`.trim()
              this.logger.warn(`fetchUrl 失败: ${message}, url: ${url}`)
              finish(reject, new Error(message))
              return
            }
            if (parseJson) {
              finish(resolve, JSON.parse(data))
            } else {
              finish(resolve, data)
            }
          } catch (error) {
            this.logger.warn(`fetchUrl 解析失败: ${error.message}, url: ${url}`)
            finish(reject, error)
          }
        })
      })
      req.on('error', (error) => {
        this.logger.warn(`fetchUrl 请求失败: ${error.message}, url: ${url}`)
        finish(reject, error)
      })
      req.setTimeout(timeoutMs, () => {
        req.destroy(createCodedError(PLUGIN_LOAD_ERROR_CODE.FETCH_TIMEOUT, { timeoutMs }))
      })
    })
  }
}
