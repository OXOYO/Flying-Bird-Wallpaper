#!/usr/bin/env node
/**
 * 校验全部 Skill Pack prompt 可加载
 */
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
process.env.FBW_RESOURCES_PATH = process.env.FBW_RESOURCES_PATH || path.join(__dirname, '../resources')

const { buildSkillPrompt } = await import('../src/main/ai/skills/SkillPackRegistry.mjs')

const packs = [
  { id: 'image-analysis', minLen: 500, check: (p) => p.includes('Simplified Chinese') },
  { id: 'video-poster-analysis', minLen: 500, check: (p) => p.includes('Simplified Chinese') },
  { id: 'search-parse', minLen: 200, vars: { query: 'ocean sunset' } },
  { id: 'collection-query', minLen: 200, vars: { prompt: 'cyberpunk city at night' } },
  { id: 'collection-tag-expand', minLen: 80, vars: { keyword: 'forest' } },
  { id: 'keyword-expand', minLen: 80, vars: { keywords: '["cat"]' } },
  {
    id: 'collection-naming',
    minLen: 200,
    vars: {
      targetCount: 2,
      nameMinLen: 2,
      nameMaxLen: 24,
      uiLocale: 'enUS',
      candidates: '[]'
    }
  },
  { id: 'auto-collection-storage', minLen: 1, vars: { detail: 'Alpine mood' } }
]

let failed = 0
for (const spec of packs) {
  const ctx = { outputLocale: spec.id.includes('analysis') ? 'zhCN' : 'enUS', vars: spec.vars }
  const prompt = buildSkillPrompt(spec.id, ctx)
  if (!prompt || prompt.length < spec.minLen) {
    console.error(`FAIL ${spec.id}: prompt too short (${prompt?.length || 0})`)
    failed += 1
  } else if (spec.check && !spec.check(prompt)) {
    console.error(`FAIL ${spec.id}: check failed`)
    failed += 1
  } else {
    console.log(`OK   ${spec.id} prompt length=${prompt.length}`)
  }
}

if (failed > 0) process.exitCode = 1
