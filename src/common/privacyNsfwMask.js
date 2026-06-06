/** 需要隐藏的最低敏感等级（2、3） */
export const NSFW_MASK_MIN_LEVEL = 2

/** 1×1 透明图：遮罩未解锁时不向预览/查看器提供真实 URL */
export const NSFW_MASKED_MEDIA_PLACEHOLDER =
  'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'

/**
 * 未解锁遮罩时返回占位图，避免预览/查看器加载原图
 * @param {object|null|undefined} item
 * @param {string} src
 * @param {(item: object) => boolean} [shouldMask]
 */
export function resolveNsfwGatedMediaSrc(item, src, shouldMask) {
  if (src && typeof shouldMask === 'function' && shouldMask(item)) {
    return NSFW_MASKED_MEDIA_PLACEHOLDER
  }
  return src || ''
}

/**
 * 窗口内/独立预览查看器：遮罩时不加载任何真实图片 URL（含缩略图）
 * @param {object|null|undefined} item
 * @param {(item: object) => boolean} [shouldMask]
 */
export function resolveNsfwGatedViewerMediaSrc(item, shouldMask) {
  if (typeof shouldMask === 'function' && shouldMask(item)) {
    return NSFW_MASKED_MEDIA_PLACEHOLDER
  }
  return item?.rawImageUrl || ''
}

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
