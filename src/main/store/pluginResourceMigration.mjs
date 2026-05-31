import fs from 'node:fs'
import path from 'node:path'
import {
  buildCompositeId,
  buildDownloadParamStoreKey,
  isReservedResourceName,
  parseDownloadParamStoreKey,
  parseLegacyDownloadParamStoreKey,
  replaceSourcePrefix
} from '../../common/pluginResourceId.js'

const MIGRATION_SYS_KEY = 'pluginResourceIdFormatV1'

/**
 * 将历史 resourceName（短名、源:插件）与相关 sys 键迁为 源_插件。
 * 仅更新 resourceName，不改 fileName。
 */
export async function runPluginResourceIdMigration(ctx, options = {}) {
  const { force = false } = options
  const { db, dbManager, logger, settingManager, runtimePluginsDir } = ctx
  if (!db) return { success: false, message: 'no db' }

  if (!force) {
    const flagRes = await dbManager.getSysRecord(MIGRATION_SYS_KEY)
    if (flagRes.success && flagRes.data?.storeData === 'done') {
      return { success: true, skipped: true, message: 'already migrated' }
    }
  }

  const installedPlugins = await readSysObject(dbManager, 'plugins')
  const compositeByShort = new Map()
  const compositeByColon = new Map()

  for (const entry of Object.values(installedPlugins || {})) {
    if (!entry?.sourceName || !entry?.name) continue
    const composite = buildCompositeId(entry.sourceName, entry.name)
    compositeByShort.set(entry.name, composite)
    compositeByColon.set(`${entry.sourceName}:${entry.name}`, composite)
    if (entry.pluginKey) {
      compositeByColon.set(entry.pluginKey, composite)
    }
  }

  const stats = {
    resources: 0,
    secretKeys: 0,
    downloadSources: 0,
    downloadParamKeys: 0,
    plugins: 0
  }

  const rows = db
    .prepare(
      `SELECT DISTINCT resourceName FROM fbw_resources WHERE resourceName IS NOT NULL AND resourceName != ''`
    )
    .all()

  const updateStmt = db.prepare(`UPDATE fbw_resources SET resourceName = ? WHERE resourceName = ?`)

  for (const row of rows) {
    const oldName = row.resourceName
    if (!oldName || isReservedResourceName(oldName)) continue
    if (oldName.includes('_') && !oldName.includes(':')) {
      const parts = oldName.split('_')
      if (parts.length >= 2 && compositeByShort.has(parts[parts.length - 1])) {
        continue
      }
      if (isCompositeResourceIdSimple(oldName)) continue
    }

    let newName = null
    if (oldName.includes(':')) {
      newName = compositeByColon.get(oldName) || colonToUnderscore(oldName)
    } else {
      newName = compositeByShort.get(oldName)
    }

    if (!newName || newName === oldName) continue
    const r = updateStmt.run(newName, oldName)
    stats.resources += r.changes || 0
  }

  const setting = settingManager?.settingData || {}
  const secretKeys = { ...(setting.remoteResourceSecretKeys || {}) }
  let secretChanged = false
  for (const [key, val] of Object.entries(secretKeys)) {
    let newKey = null
    if (key.includes(':')) {
      newKey = compositeByColon.get(key) || colonToUnderscore(key)
    } else if (compositeByShort.has(key)) {
      newKey = compositeByShort.get(key)
    }
    if (newKey && newKey !== key) {
      if (!(newKey in secretKeys)) secretKeys[newKey] = val
      delete secretKeys[key]
      secretChanged = true
      stats.secretKeys += 1
    }
  }
  if (secretChanged && settingManager) {
    await settingManager.updateSettingData({ remoteResourceSecretKeys: secretKeys })
  }

  const downloadSources = Array.isArray(setting.downloadSources)
    ? [...setting.downloadSources]
    : []
  let dsChanged = false
  for (let i = 0; i < downloadSources.length; i++) {
    const v = downloadSources[i]
    let nv = null
    if (typeof v === 'string' && v.includes(':')) {
      nv = compositeByColon.get(v) || colonToUnderscore(v)
    } else if (compositeByShort.has(v)) {
      nv = compositeByShort.get(v)
    }
    if (nv && nv !== v) {
      downloadSources[i] = nv
      dsChanged = true
      stats.downloadSources += 1
    }
  }
  if (dsChanged && settingManager) {
    await settingManager.updateSettingData({ downloadSources })
  }

  const keysRes = await dbManager.getAllKeys()
  if (keysRes.success && Array.isArray(keysRes.data)) {
    for (const key of keysRes.data) {
      if (key.startsWith('download_params')) {
        const migrated = await migrateDownloadParamKey(dbManager, key, compositeByColon, compositeByShort)
        if (migrated) stats.downloadParamKeys += 1
      }
    }
  }

  const pluginsNext = {}
  for (const [k, entry] of Object.entries(installedPlugins || {})) {
    if (!entry?.sourceName || !entry?.name) {
      pluginsNext[k] = entry
      continue
    }
    const composite = buildCompositeId(entry.sourceName, entry.name)
    pluginsNext[composite] = {
      ...entry,
      pluginKey: composite,
      value: composite,
      label: composite,
      displayName: composite
    }
    stats.plugins += 1
  }
  await dbManager.setSysRecord('plugins', pluginsNext, 'object')

  if (runtimePluginsDir && fs.existsSync(runtimePluginsDir)) {
    // 目录已是 源名/插件名，无需因迁移重命名
  }

  await dbManager.setSysRecord(MIGRATION_SYS_KEY, 'done', 'string')
  logger?.info?.(
    `[pluginResourceMigration] done resources=${stats.resources} secretKeys=${stats.secretKeys} downloadSources=${stats.downloadSources} downloadParamKeys=${stats.downloadParamKeys} plugins=${stats.plugins}`
  )

  return { success: true, stats }
}

function isCompositeResourceIdSimple(name) {
  if (!name || isReservedResourceName(name) || name.includes(':')) return false
  const idx = name.indexOf('_')
  return idx > 0 && idx < name.length - 1
}

function colonToUnderscore(id) {
  return String(id || '').replace(':', '_')
}

async function readSysObject(dbManager, key) {
  const res = await dbManager.getSysRecord(key)
  if (res.success && res.data?.storeData && typeof res.data.storeData === 'object') {
    return res.data.storeData
  }
  return {}
}

async function migrateDownloadParamKey(dbManager, key, compositeByColon, compositeByShort) {
  let parsed = parseDownloadParamStoreKey(key)
  if (!parsed) parsed = parseLegacyDownloadParamStoreKey(key)
  if (!parsed) return false

  let source = parsed.source
  if (source.includes(':')) {
    source = compositeByColon.get(source) || colonToUnderscore(source)
  } else if (compositeByShort.has(source)) {
    source = compositeByShort.get(source)
  }

  const newKey = buildDownloadParamStoreKey(source, parsed.keyword)
  if (newKey === key) return false

  const res = await dbManager.getSysRecord(key)
  if (!res.success || res.data?.storeData == null) return false

  await dbManager.setSysRecord(newKey, res.data.storeData, res.data.storeType || 'object')
  await dbManager.removeSysRecord(key)
  return true
}

/**
 * 改源名：刷新 resourceName 前缀、plugins、密钥、downloadSources、download_params 键。
 */
export async function applyPluginSourceRename(ctx, oldSource, newSource) {
  const { db, dbManager, settingManager, runtimePluginsDir, logger } = ctx
  const oldNorm = String(oldSource || '').trim()
  const newNorm = String(newSource || '').trim()
  if (!oldNorm || !newNorm || oldNorm === newNorm) {
    return { success: true }
  }

  const oldPrefix = `${oldNorm}_`
  const newPrefix = `${newNorm}_`

  if (runtimePluginsDir) {
    const oldDir = path.join(runtimePluginsDir, oldNorm)
    const newDir = path.join(runtimePluginsDir, newNorm)
    if (fs.existsSync(oldDir)) {
      if (fs.existsSync(newDir)) {
        return { success: false, message: 'target source directory exists' }
      }
      fs.renameSync(oldDir, newDir)
    }
  }

  const rows = db
    .prepare(`SELECT id, resourceName FROM fbw_resources WHERE resourceName LIKE ?`)
    .all(`${oldPrefix}%`)

  const updateStmt = db.prepare(`UPDATE fbw_resources SET resourceName = ? WHERE id = ?`)
  for (const row of rows) {
    const next = replaceSourcePrefix(row.resourceName, oldNorm, newNorm)
    if (next !== row.resourceName) updateStmt.run(next, row.id)
  }

  const installedPlugins = await readSysObject(dbManager, 'plugins')
  const pluginsNext = {}
  for (const entry of Object.values(installedPlugins || {})) {
    if (!entry) continue
    let sourceName = entry.sourceName
    if (sourceName === oldNorm) sourceName = newNorm
    const pluginName = entry.name || entry.pluginName
    const composite = buildCompositeId(sourceName, pluginName)
    pluginsNext[composite] = {
      ...entry,
      sourceName,
      pluginKey: composite,
      value: composite,
      label: composite,
      displayName: composite
    }
  }
  await dbManager.setSysRecord('plugins', pluginsNext, 'object')

  const setting = settingManager?.settingData || {}
  const secretKeys = { ...(setting.remoteResourceSecretKeys || {}) }
  let secretChanged = false
  for (const [key, val] of Object.entries(secretKeys)) {
    const nextKey = replaceSourcePrefix(key, oldNorm, newNorm)
    if (nextKey !== key) {
      secretKeys[nextKey] = val
      delete secretKeys[key]
      secretChanged = true
    }
  }

  const downloadSources = Array.isArray(setting.downloadSources)
    ? setting.downloadSources.map((v) => replaceSourcePrefix(v, oldNorm, newNorm))
    : []
  const dsChanged = JSON.stringify(downloadSources) !== JSON.stringify(setting.downloadSources)

  if (secretChanged || dsChanged) {
    await settingManager.updateSettingData({
      ...(secretChanged ? { remoteResourceSecretKeys: secretKeys } : {}),
      ...(dsChanged ? { downloadSources } : {})
    })
  }

  const keysRes = await dbManager.getAllKeys()
  if (keysRes.success && Array.isArray(keysRes.data)) {
    for (const key of keysRes.data) {
      const parsed = parseDownloadParamStoreKey(key) || parseLegacyDownloadParamStoreKey(key)
      if (!parsed || !parsed.source.startsWith(oldPrefix)) continue
      const nextSource = replaceSourcePrefix(parsed.source, oldNorm, newNorm)
      const newKey = buildDownloadParamStoreKey(nextSource, parsed.keyword)
      if (newKey === key) continue
      const res = await dbManager.getSysRecord(key)
      if (res.success && res.data?.storeData != null) {
        await dbManager.setSysRecord(newKey, res.data.storeData, res.data.storeType || 'object')
        await dbManager.removeSysRecord(key)
      }
    }
  }

  const downloadParamsRes = await dbManager.getSysRecord('downloadParams')
  if (downloadParamsRes.success && downloadParamsRes.data?.storeData) {
    const dp = { ...downloadParamsRes.data.storeData }
    if (Array.isArray(dp.downloadSources)) {
      dp.downloadSources = dp.downloadSources.map((v) => replaceSourcePrefix(v, oldNorm, newNorm))
      await dbManager.setSysRecord('downloadParams', dp, 'object')
    }
  }

  const sourcesRes = await dbManager.getSysRecord('pluginSources')
  if (sourcesRes.success && Array.isArray(sourcesRes.data?.storeData)) {
    const sources = sourcesRes.data.storeData.map((item) => {
      if (item?.name === oldNorm) {
        return { ...item, name: newNorm, updatedAt: new Date().toISOString() }
      }
      return item
    })
    await dbManager.setSysRecord('pluginSources', sources, 'array')
  }

  logger?.info?.(`[pluginResourceMigration] source renamed ${oldNorm} -> ${newNorm}`)
  return { success: true }
}
