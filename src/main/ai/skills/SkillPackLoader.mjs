import fs from 'node:fs'
import path from 'node:path'
import { getSkillPackDir } from './skillPackPaths.mjs'
import { mergeNormalizeConfig } from './skillProfileMerge.mjs'

/** @type {Map<string, object>} */
const packMetaCache = new Map()
/** @type {Map<string, object>} */
const schemaCache = new Map()
/** @type {Map<string, object>} */
const normalizeCache = new Map()
/** @type {Map<string, string>} */
const skillBodyCache = new Map()

function readJsonFile(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'))
}

function readTextFile(filePath) {
  return fs.readFileSync(filePath, 'utf8')
}

function resolveProfileName(ctx = {}) {
  return String(ctx.profile || 'default').trim() || 'default'
}

function cacheKey(packId, ctx = {}) {
  return `${packId}:${resolveProfileName(ctx)}`
}

function getProfileDir(packId, profileName) {
  return path.join(getSkillPackDir(packId), 'profiles', profileName)
}

function applySkillPatch(body, packId, profileName) {
  if (!profileName || profileName === 'default') {
    const defaultPatch = path.join(getProfileDir(packId, 'default'), 'SKILL.patch.md')
    if (fs.existsSync(defaultPatch)) {
      return `${body}\n\n${readTextFile(defaultPatch).trim()}`
    }
    return body
  }
  const patchPath = path.join(getProfileDir(packId, profileName), 'SKILL.patch.md')
  if (!fs.existsSync(patchPath)) return body
  return `${body}\n\n${readTextFile(patchPath).trim()}`
}

function applyNormalizePatch(config, packId, profileName) {
  const profiles = profileName === 'default' ? ['default'] : ['default', profileName]
  let merged = config
  for (const name of profiles) {
    const patchPath = path.join(getProfileDir(packId, name), 'normalize.patch.json')
    if (fs.existsSync(patchPath)) {
      merged = mergeNormalizeConfig(merged, readJsonFile(patchPath))
    }
  }
  return merged
}

/**
 * @param {string} packId
 * @param {object} [ctx]
 * @returns {boolean}
 */
export function isSkillPackAvailable(packId) {
  try {
    loadPackMeta(packId)
    return true
  } catch {
    return false
  }
}

/**
 * @param {string} packId
 */
export function loadPackMeta(packId) {
  const cached = packMetaCache.get(packId)
  if (cached) return cached

  const dir = getSkillPackDir(packId)
  const metaPath = path.join(dir, 'pack.json')
  if (!fs.existsSync(metaPath)) {
    throw new Error(`Skill pack not found: ${packId}`)
  }
  const meta = readJsonFile(metaPath)
  packMetaCache.set(packId, meta)
  return meta
}

/**
 * @param {string} packId
 */
export function loadPackSchema(packId) {
  const cached = schemaCache.get(packId)
  if (cached) return cached

  const meta = loadPackMeta(packId)
  const dir = getSkillPackDir(packId)
  const schemaFile = meta.schemaFile || 'schema.json'
  const schemaPath = path.join(dir, schemaFile)
  if (!fs.existsSync(schemaPath)) {
    throw new Error(`Schema not found for pack: ${packId}`)
  }
  const schema = readJsonFile(schemaPath)
  schemaCache.set(packId, schema)
  return schema
}

/**
 * 解析 normalize 配置；支持 normalizePackId 复用与 profile patch
 * @param {string} packId
 * @param {object} [ctx]
 */
export function loadPackNormalize(packId, ctx = {}) {
  const key = cacheKey(packId, ctx)
  const cached = normalizeCache.get(key)
  if (cached) return cached

  const meta = loadPackMeta(packId)
  const normalizeTarget = meta.normalizePackId || packId
  const profileName = resolveProfileName(ctx)
  const targetMeta = normalizeTarget === packId ? meta : loadPackMeta(normalizeTarget)
  const dir = getSkillPackDir(normalizeTarget)
  const normalizeFile = targetMeta.normalizeFile || 'normalize.json'
  const normalizePath = path.join(dir, normalizeFile)
  if (!fs.existsSync(normalizePath)) {
    throw new Error(`Normalize config not found for pack: ${normalizeTarget}`)
  }

  let config = readJsonFile(normalizePath)
  config = applyNormalizePatch(config, normalizeTarget, profileName)
  if (packId !== normalizeTarget) {
    config = applyNormalizePatch(config, packId, profileName)
  }

  normalizeCache.set(key, config)
  return config
}

/**
 * @param {string} packId
 * @param {object} [ctx]
 */
export function loadSkillBody(packId, ctx = {}) {
  const key = cacheKey(packId, ctx)
  const cached = skillBodyCache.get(key)
  if (cached) return cached

  const meta = loadPackMeta(packId)
  const dir = getSkillPackDir(packId)
  const skillFile = meta.skillFile || 'SKILL.md'
  const skillPath = path.join(dir, skillFile)
  if (!fs.existsSync(skillPath)) {
    throw new Error(`SKILL file not found for pack: ${packId}`)
  }
  let body = readTextFile(skillPath).trim()
  body = applySkillPatch(body, packId, resolveProfileName(ctx))
  skillBodyCache.set(key, body)
  return body
}

/** 测试或热更新时清缓存 */
export function clearSkillPackCache() {
  packMetaCache.clear()
  schemaCache.clear()
  normalizeCache.clear()
  skillBodyCache.clear()
}

/**
 * @param {string} packId
 * @param {object} [ctx]
 */
export function getPackMeta(packId, ctx = {}) {
  const meta = loadPackMeta(packId)
  const normalize = loadPackNormalize(packId, ctx)
  return {
    packId,
    packVersion: meta.version || '1.0.0',
    normalizeVersion: normalize.version || '1.0.0',
    modelKind: meta.modelKind || 'text',
    profile: resolveProfileName(ctx),
    outputLocaleFooter: !!meta.outputLocaleFooter
  }
}
