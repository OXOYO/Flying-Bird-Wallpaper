/**
 * Phase D：normalize 重放逻辑验收（不连真实 DB、不调用 LLM）
 * 用法：FBW_RESOURCES_PATH=./resources node scripts/run-ai-normalize-replay.mjs [--dry-run]
 */
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
process.env.FBW_RESOURCES_PATH = process.env.FBW_RESOURCES_PATH || path.join(__dirname, '../resources')

const dryRun = process.argv.includes('--dry-run')

const {
  shouldReplayNormalizeRow,
  replayNormalizeRaw
} = await import('../src/main/ai/AiNormalizeReplay.mjs')
const { stringifyAnalysisMeta } = await import('../src/main/ai/normalize/analysisMetaUtils.mjs')

const mildSwimwearRaw = {
  score: 75,
  tags: ['swimwear', 'beach'],
  title: 'Beach day',
  summary: 'Sunny beach',
  desc: 'Person in swimwear on a sunny beach with calm waves.',
  nsfwLevel: 1,
  safeForWork: true
}

const baseRow = {
  id: 1,
  fileType: 'image',
  rawLlmJson: JSON.stringify(mildSwimwearRaw),
  analysisMeta: stringifyAnalysisMeta({
    packId: 'image-analysis',
    packVersion: '1.0.0',
    normalizeVersion: '1.0.0',
    profile: 'default',
    outputLocale: 'zhCN'
  })
}

let failed = 0

function assert(name, cond, detail = '') {
  if (!cond) {
    failed += 1
    console.error(`FAIL ${name}${detail ? `: ${detail}` : ''}`)
  } else {
    console.log(`OK   ${name}`)
  }
}

// profile 切换：有 raw 即应重放
assert(
  'profile-change triggers replay',
  shouldReplayNormalizeRow(baseRow, { reason: 'profile-change', profile: 'strict-nsfw' })
)

// 同 profile + 同版本：不应重放
assert(
  'same profile skips replay',
  !shouldReplayNormalizeRow(baseRow, { reason: 'startup-version-check', profile: 'default' })
)

// 无 raw：不重放
assert(
  'missing raw skips replay',
  !shouldReplayNormalizeRow({ ...baseRow, rawLlmJson: '' }, { reason: 'profile-change', profile: 'strict-nsfw' })
)

// strict-nsfw 重放：level 1 应变为 unsafe for work
const replayed = replayNormalizeRaw(mildSwimwearRaw, baseRow, {
  reason: 'profile-change',
  profile: 'strict-nsfw'
})
assert(
  'strict-nsfw replay unsafe for level 1',
  replayed.data.safeForWork === false && replayed.data.nsfwLevel >= 1,
  JSON.stringify({ sfw: replayed.data.safeForWork, nsfw: replayed.data.nsfwLevel })
)
assert(
  'replay meta records reason',
  replayed.analysisMeta.replayReason === 'profile-change' &&
    replayed.analysisMeta.profile === 'strict-nsfw' &&
    replayed.analysisMeta.replayedFromProfile === 'default'
)

if (dryRun) {
  console.log('\n--dry-run: logic checks only (no DB write)')
} else {
  console.log('\nReplay logic checks passed (use app profile switch for full DB batch)')
}

if (failed > 0) {
  process.exitCode = 1
  console.error(`\n${failed} case(s) failed`)
} else {
  console.log(`\nAll replay checks passed`)
}
