const clamp = (n, min, max) => Math.min(max, Math.max(min, n))

/**
 * @param {object} obj
 * @param {object} when
 */
export function matchRepairWhen(obj, when) {
  if (!when || typeof when !== 'object') return true

  for (const [key, expected] of Object.entries(when)) {
    if (key === 'nsfwLevelLt') {
      const v = clamp(Math.round(Number(obj.nsfwLevel) || 0), 0, 3)
      if (!(v < Number(expected))) return false
      continue
    }
    if (key === 'nsfwLevelLte') {
      const v = clamp(Math.round(Number(obj.nsfwLevel) || 0), 0, 3)
      if (!(v <= Number(expected))) return false
      continue
    }
    if (key === 'nsfwLevelGt') {
      const v = clamp(Math.round(Number(obj.nsfwLevel) || 0), 0, 3)
      if (!(v > Number(expected))) return false
      continue
    }
    if (key === 'nsfwLevelGte') {
      const v = clamp(Math.round(Number(obj.nsfwLevel) || 0), 0, 3)
      if (!(v >= Number(expected))) return false
      continue
    }
    if (key === 'nsfwLevelEq') {
      const v = clamp(Math.round(Number(obj.nsfwLevel) || 0), 0, 3)
      if (v !== Number(expected)) return false
      continue
    }
    if (obj[key] !== expected) return false
  }
  return true
}

/**
 * @param {object} obj mutable
 * @param {object[]} repairGroups from normalize.json
 */
export function applyRepairGroups(obj, repairGroups = []) {
  for (const group of repairGroups) {
    const rules = Array.isArray(group?.rules) ? group.rules : []
    for (const rule of rules) {
      if (!matchRepairWhen(obj, rule.when)) continue
      const set = rule.set || {}
      for (const [k, v] of Object.entries(set)) {
        obj[k] = v
      }
    }
  }
  return obj
}

/** @deprecated 兼容导出；逻辑由 normalize.json repairs 驱动 */
export function applyNsfwConsistency(obj = {}) {
  const draft = {
    ...obj,
    nsfwLevel: clamp(Math.round(Number(obj.nsfwLevel) || 0), 0, 3),
    safeForWork: obj.safeForWork !== false
  }
  applyRepairGroups(draft, [
    {
      id: 'nsfw-safeForWork',
      rules: [
        { when: { safeForWork: false, nsfwLevelLt: 2 }, set: { nsfwLevel: 2 } },
        { when: { nsfwLevelGte: 2 }, set: { safeForWork: false } },
        { when: { nsfwLevelEq: 0 }, set: { safeForWork: true } },
        { when: { nsfwLevelEq: 1, safeForWork: false }, set: { nsfwLevel: 2 } }
      ]
    }
  ])
  return { nsfwLevel: draft.nsfwLevel, safeForWork: draft.safeForWork }
}
