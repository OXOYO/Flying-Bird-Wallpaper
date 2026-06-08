import { buildOutputLocaleFooter } from './outputLocale.mjs'
import {
  getPackMeta,
  isSkillPackAvailable,
  loadSkillBody
} from './SkillPackLoader.mjs'

/**
 * @param {string} packId
 * @param {object} [ctx]
 * @param {string} [ctx.profile]
 * @param {string} [ctx.outputLocale]
 * @param {Record<string, string>} [ctx.vars] template vars e.g. query, prompt
 * @param {boolean} [ctx.appendOutputLocaleFooter]
 */
export function buildSkillPrompt(packId, ctx = {}) {
  if (!isSkillPackAvailable(packId)) {
    throw new Error(`Skill pack unavailable: ${packId}`)
  }

  let body = loadSkillBody(packId, ctx)
  const vars = ctx.vars || {}
  for (const [key, val] of Object.entries(vars)) {
    body = body.split(`{${key}}`).join(String(val ?? ''))
  }

  const meta = getPackMeta(packId, ctx)
  const shouldFooter =
    ctx.appendOutputLocaleFooter ?? meta.outputLocaleFooter ?? false
  if (shouldFooter) {
    const locale = ctx.outputLocale || 'enUS'
    const footer = buildOutputLocaleFooter(locale)
    if (footer && !body.includes(footer)) {
      body = `${body}\n\n${footer}`
    }
  }
  return body
}

export { getPackMeta, isSkillPackAvailable }
