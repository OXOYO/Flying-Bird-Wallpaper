import path from 'node:path'

/** @returns {string} */
export function getSkillPacksRoot() {
  const base = process.env.FBW_RESOURCES_PATH || path.join(process.cwd(), 'resources')
  return path.join(base, 'ai', 'skills')
}

/** @param {string} packId */
export function getSkillPackDir(packId) {
  return path.join(getSkillPacksRoot(), packId)
}
