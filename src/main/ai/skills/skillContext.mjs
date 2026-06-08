import i18next from '../../../i18n/i18next.js'

/**
 * @param {object} [settingManager]
 * @param {object} [overrides]
 */
export function resolveSkillContext(settingManager, overrides = {}) {
  const ai = settingManager?.settingData?.ai || {}
  return {
    profile: overrides.profile || ai.promptProfile || 'default',
    outputLocale: overrides.outputLocale || i18next.language || 'enUS',
    packOverrides: overrides.packOverrides || ai.packOverrides || {},
    ...overrides
  }
}
