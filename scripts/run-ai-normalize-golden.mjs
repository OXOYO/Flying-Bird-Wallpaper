/**
 * 校验 normalize 与 legacy 行为一致（不调用 LLM）
 * 用法：FBW_RESOURCES_PATH=./resources node scripts/run-ai-normalize-golden.mjs
 */
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
process.env.FBW_RESOURCES_PATH = process.env.FBW_RESOURCES_PATH || path.join(__dirname, '../resources')

const { applyPackPipeline } = await import('../src/main/ai/normalize/NormalizeEngine.mjs')
const { applyNsfwConsistency } = await import('../src/main/ai/normalize/repairEngine.mjs')
const {
  normalizeSearchParamsShape,
  normalizeCollectionQueryShape
} = await import('../src/main/ai/normalize/schemaCoerce.mjs')

const clamp = (n, min, max) => Math.min(max, Math.max(min, n))

function legacyNormalizeAnalysis(raw) {
  const obj = typeof raw === 'object' && raw ? raw : {}
  const tags = Array.isArray(obj.tags)
    ? obj.tags.map((t) => String(t).trim()).filter(Boolean).slice(0, 12)
    : []
  const { nsfwLevel, safeForWork } = applyNsfwConsistency(obj)
  return {
    score: clamp(Math.round(Number(obj.score) || 0), 0, 100),
    tags,
    title: String(obj.title || '').trim().slice(0, 120),
    desc: String(obj.desc || '').trim().slice(0, 500),
    summary: String(obj.summary || '').trim().slice(0, 200),
    nsfwLevel,
    safeForWork
  }
}

const cases = [
  {
    packId: 'image-analysis',
    legacy: legacyNormalizeAnalysis,
    name: 'safe landscape',
    raw: {
      score: 82,
      tags: ['night', 'city', 'neon'],
      title: 'Rainy city',
      summary: 'Night cityscape',
      desc: 'A wide skyline with neon reflections on wet pavement under cool blue lighting.',
      nsfwLevel: 0,
      safeForWork: true
    }
  },
  {
    packId: 'image-analysis',
    legacy: legacyNormalizeAnalysis,
    name: 'safeForWork false lifts nsfw',
    raw: {
      score: 40,
      tags: ['portrait'],
      title: 'T',
      summary: 'S',
      desc: 'Desc',
      nsfwLevel: 0,
      safeForWork: false
    }
  },
  {
    packId: 'image-analysis',
    legacy: legacyNormalizeAnalysis,
    name: 'nsfw 3 forces sfw false',
    raw: {
      score: 10,
      tags: [],
      title: '',
      summary: '',
      desc: '',
      nsfwLevel: 3,
      safeForWork: true
    }
  },
  {
    packId: 'image-analysis',
    legacy: legacyNormalizeAnalysis,
    name: 'long fields clamp',
    raw: {
      score: 999,
      tags: Array.from({ length: 20 }, (_, i) => `tag${i}`),
      title: 'x'.repeat(200),
      summary: 'y'.repeat(300),
      desc: 'z'.repeat(800),
      nsfwLevel: 1,
      safeForWork: true
    }
  },
  {
    packId: 'search-parse',
    legacy: normalizeSearchParamsShape,
    name: 'search parse ocean',
    raw: {
      filterKeywords: 'ocean',
      tags: ['ocean', 'blue'],
      orientation: ['landscape'],
      quality: ['4k'],
      filterType: 'images',
      scoreMin: null,
      scoreMax: 90
    }
  },
  {
    packId: 'collection-query',
    legacy: normalizeCollectionQueryShape,
    name: 'collection query defaults',
    raw: {
      filterKeywords: 'neon city',
      tags: ['city'],
      tagsMode: 'any',
      quality: [],
      resourceName: 'favorites',
      isRandom: false,
      sortField: 'score',
      sortType: -1,
      semanticQuery: 'neon city night',
      useSemantic: true,
      limitCount: 99,
      scoreMin: 50,
      orientation: [1]
    }
  }
]

let failed = 0
for (const c of cases) {
  const legacy = c.legacy(c.raw)
  const pack = applyPackPipeline(c.packId, c.raw).data
  const same = JSON.stringify(legacy) === JSON.stringify(pack)
  if (!same) {
    failed += 1
    console.error(`FAIL ${c.packId} :: ${c.name}`)
    console.error(' legacy:', legacy)
    console.error(' pack  :', pack)
  } else {
    console.log(`OK   ${c.packId} :: ${c.name}`)
  }
}

if (failed > 0) {
  process.exitCode = 1
  console.error(`\n${failed} case(s) failed`)
} else {
  console.log(`\nAll ${cases.length} cases passed`)
}
