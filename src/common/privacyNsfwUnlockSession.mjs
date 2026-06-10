/** 浏览页 NSFW 遮罩：按页面维度记录「本页已解锁」，切页/进后台后清除 */

const unlockedPageKeys = new Set()

/**
 * @param {string} pageKey
 * @returns {boolean}
 */
export function isNsfwPageUnlocked(pageKey) {
  if (!pageKey) return false
  return unlockedPageKeys.has(pageKey)
}

/**
 * @param {string} pageKey
 */
export function unlockNsfwPage(pageKey) {
  if (!pageKey) return
  unlockedPageKeys.add(pageKey)
}

/**
 * @param {string} [pageKey] 不传则清除全部
 */
export function lockNsfwPage(pageKey) {
  if (!pageKey) {
    unlockedPageKeys.clear()
    return
  }
  unlockedPageKeys.delete(pageKey)
}

export function lockAllNsfwPages() {
  unlockedPageKeys.clear()
}
