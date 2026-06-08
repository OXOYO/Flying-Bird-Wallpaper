/**
 * 合并 profile 级 normalize.patch.json
 * @param {object} base
 * @param {object} patch
 */
export function mergeNormalizeConfig(base, patch) {
  if (!patch || typeof patch !== 'object') return base
  return {
    ...base,
    ...patch,
    version: patch.version || base.version,
    defaults: { ...(base.defaults || {}), ...(patch.defaults || {}) },
    repairs: [...(base.repairs || []), ...(patch.repairs || [])],
    hooks: [...new Set([...(base.hooks || []), ...(patch.hooks || [])])],
    ignoreFromModel: [
      ...new Set([...(base.ignoreFromModel || []), ...(patch.ignoreFromModel || [])])
    ]
  }
}
