/**
 * 一次性将插件资源名迁为 源_插件（仅改 resourceName，不改 fileName）
 * 用法: node scripts/migrate-plugin-resource-id.mjs [--force]
 */
import path from 'node:path'
import os from 'node:os'
import Database from 'better-sqlite3'
import { runPluginResourceIdMigration } from '../src/main/store/pluginResourceMigration.mjs'

const force = process.argv.includes('--force')

function defaultDbPath() {
  if (process.env.FBW_DATABASE_FILE_PATH) {
    return process.env.FBW_DATABASE_FILE_PATH
  }
  const appData =
    process.platform === 'win32'
      ? path.join(process.env.APPDATA || '', 'Flying Bird Wallpaper')
      : path.join(os.homedir(), '.config', 'Flying Bird Wallpaper')
  return path.join(appData, 'database', 'fbw.db')
}

const dbPath = defaultDbPath()
console.log('DB:', dbPath)

const db = new Database(dbPath)

const dbManager = {
  async getSysRecord(storeKey) {
    const row = db.prepare('SELECT storeData, storeType FROM fbw_sys WHERE storeKey = ?').get(storeKey)
    if (!row) return { success: false, data: null }
    let storeData = row.storeData
    if (row.storeType === 'object' || row.storeType === 'array') {
      try {
        storeData = JSON.parse(storeData)
      } catch {
        // keep string
      }
    }
    return { success: true, data: { storeData, storeType: row.storeType } }
  },
  async setSysRecord(storeKey, storeData, storeType = 'string') {
    let storeDataStr = storeData
    if (['array', 'object'].includes(storeType)) {
      storeDataStr = JSON.stringify(storeData)
    } else {
      storeDataStr = String(storeData)
    }
    db.prepare(
      `INSERT INTO fbw_sys (storeKey, storeData, storeType, updated_at) VALUES (?, ?, ?, datetime('now', 'localtime'))
       ON CONFLICT(storeKey) DO UPDATE SET storeData=excluded.storeData, storeType=excluded.storeType, updated_at=datetime('now', 'localtime')`
    ).run(storeKey, storeDataStr, storeType)
    return { success: true }
  },
  async removeSysRecord(storeKey) {
    db.prepare('DELETE FROM fbw_sys WHERE storeKey = ?').run(storeKey)
    return { success: true }
  },
  async getAllKeys() {
    const rows = db.prepare('SELECT storeKey FROM fbw_sys').all()
    return { success: true, data: rows.map((r) => r.storeKey) }
  }
}

const settingManager = {
  settingData: null,
  async updateSettingData(patch) {
    const res = await dbManager.getSysRecord('settingData')
    let data = {}
    if (res.success && res.data?.storeData && typeof res.data.storeData === 'object') {
      data = res.data.storeData
    }
    const next = { ...data, ...patch }
    await dbManager.setSysRecord('settingData', next, 'object')
    settingManager.settingData = next
    return { success: true, data: next }
  }
}

const settingRes = await dbManager.getSysRecord('settingData')
if (settingRes.success && settingRes.data?.storeData) {
  settingManager.settingData = settingRes.data.storeData
}

if (force) {
  await dbManager.removeSysRecord('pluginResourceIdFormatV1')
}

const runtimePluginsDir = path.join(
  process.env.FBW_PLUGINS_PATH ||
    path.join(
      process.platform === 'win32'
        ? path.join(process.env.APPDATA || '', 'Flying Bird Wallpaper')
        : path.join(os.homedir(), '.config', 'Flying Bird Wallpaper'),
      'plugins'
    ),
  'installed'
)

const result = await runPluginResourceIdMigration(
  {
    db,
    dbManager,
    logger: console,
    settingManager,
    runtimePluginsDir
  },
  { force }
)

console.log('Migration result:', JSON.stringify(result, null, 2))

const sample = db
  .prepare(
    `SELECT resourceName, COUNT(*) as c FROM fbw_resources
     WHERE resourceName NOT IN ('local','resources','favorites','history','privacy_space')
     GROUP BY resourceName ORDER BY c DESC LIMIT 10`
  )
  .all()
console.log('Top plugin resourceName counts:', sample)

db.close()
