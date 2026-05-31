/** 需要隐藏的最低敏感等级（2、3） */
export const NSFW_MASK_MIN_LEVEL = 2

export function isNsfwMaskableItem(item) {
  if (!item) return false
  const level = Number(item.nsfwLevel)
  if (Number.isFinite(level)) return level >= NSFW_MASK_MIN_LEVEL
  // 兼容仅有 safeForWork 的旧数据或未回填 nsfwLevel 的条目
  if (item.safeForWork === false || item.safeForWork === 0) return true
  return false
}

/** 「敏感内容隐藏」开关是否打开 */
export function isNsfwContentMaskSwitchOn(settingData) {
  return !!settingData?.privacy?.enableNsfwContentMask
}

/** 浏览页遮罩：开关打开且已设置隐私密码 */
export function isNsfwMaskFeatureActive(settingData, hasPrivacyPassword) {
  return isNsfwContentMaskSwitchOn(settingData) && !!hasPrivacyPassword
}

/** 壁纸上/下一张轮换：仅看开关（手动设为壁纸不经过此逻辑） */
export function shouldFilterSensitiveForWallpaper(settingData) {
  return isNsfwContentMaskSwitchOn(settingData)
}

/** @param {string} [tableAlias] 资源表别名，如 `r`；敏感等级在 fbw_resource_ai */
export function getNsfwSafeSqlClause(tableAlias = '') {
  const idCol = tableAlias ? `${tableAlias}.id` : 'fbw_resources.id'
  return `NOT EXISTS (
    SELECT 1 FROM fbw_resource_ai ai
    WHERE ai.resourceId = ${idCol} AND ai.nsfwLevel >= ${NSFW_MASK_MIN_LEVEL}
  )`
}

export function shouldApplyNsfwMask(item, { featureActive, pageUnlocked, inPrivacySpace }) {
  if (inPrivacySpace) return false
  return !!featureActive && !pageUnlocked && isNsfwMaskableItem(item)
}

export function resolveNsfwMaskVerifyFailMessage(res, t) {
  if (res?.errorCode === 'PRIVACY_PASSWORD_NOT_SET') {
    return t('messages.privacyPasswordNotSet')
  }
  return res?.message || t('messages.verifyPrivacyPasswordFail')
}
