import fs from 'node:fs'
import path from 'node:path'

const dir = path.join(process.cwd(), 'src/i18n/locale/lang')
const files = fs.readdirSync(dir).filter((f) => f.endsWith('.json'))

function flatten(obj, prefix = '') {
  const out = {}
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k
    if (v && typeof v === 'object' && !Array.isArray(v)) Object.assign(out, flatten(v, key))
    else out[key] = v
  }
  return out
}

const data = Object.fromEntries(
  files.map((f) => [f, flatten(JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')))])
)

const zh = 'zh-CN.json'
const en = 'en-US.json'
const zhKeys = new Set(Object.keys(data[zh]))
const enKeys = new Set(Object.keys(data[en]))

console.log('=== Key counts ===')
for (const f of files.sort()) console.log(`${f}\t${Object.keys(data[f]).length}`)

console.log('\n=== Missing vs zh-CN ===')
for (const f of files.sort()) {
  if (f === zh) continue
  const missing = [...zhKeys].filter((k) => !(k in data[f]))
  if (missing.length) {
    console.log(`\n${f}: ${missing.length} missing`)
    missing.forEach((k) => console.log(`  - ${k}`))
  }
}

console.log('\n=== Missing vs en-US ===')
for (const f of files.sort()) {
  if (f === en) continue
  const missing = [...enKeys].filter((k) => !(k in data[f]))
  if (missing.length) {
    console.log(`\n${f}: ${missing.length} missing (vs en-US)`)
    missing.forEach((k) => console.log(`  - ${k}`))
  }
}

console.log('\n=== zh-CN / en-US key mismatch ===')
const onlyZh = [...zhKeys].filter((k) => !enKeys.has(k))
const onlyEn = [...enKeys].filter((k) => !zhKeys.has(k))
if (onlyZh.length) {
  console.log('only in zh-CN:', onlyZh.length)
  onlyZh.forEach((k) => console.log(`  - ${k}`))
}
if (onlyEn.length) {
  console.log('only in en-US:', onlyEn.length)
  onlyEn.forEach((k) => console.log(`  - ${k}`))
}

console.log('\n=== Empty values ===')
for (const f of files.sort()) {
  const empty = Object.entries(data[f]).filter(([, v]) => v === '' || v == null)
  if (empty.length) console.log(`${f}: ${empty.map(([k]) => k).join(', ')}`)
}

console.log('\n=== Identical to en-US (length>=15, non-en) ===')
const enFlat = data[en]
for (const f of files.sort()) {
  if (f === en) continue
  const same = Object.keys(enFlat).filter(
    (k) =>
      k in data[f] &&
      data[f][k] === enFlat[k] &&
      typeof enFlat[k] === 'string' &&
      enFlat[k].length >= 15
  )
  if (same.length) console.log(`${f}: ${same.length} strings still English`)
}

console.log('\n=== Placeholder / count issues in zh-CN ===')
for (const [k, v] of Object.entries(data[zh])) {
  if (typeof v === 'string' && (v.includes('{{') || /\{count\}/.test(v) !== /\{count\}/.test(v))) {
    // skip
  }
  if (typeof v === 'string' && v.includes('{{')) console.log(`zh-CN mustache: ${k}`)
}

console.log('\n=== Suspect: Chinese locale with ASCII-only long UI strings ===')
for (const f of ['zh-TW.json']) {
  const suspects = Object.entries(data[f]).filter(([k, v]) => {
    if (typeof v !== 'string' || v.length < 30) return false
    if (k.includes('collectionNaming') || k.includes('prompts.')) return false
    return /^[\x00-\x7F]+$/.test(v) && data[zh][k] && !/^[\x00-\x7F]+$/.test(data[zh][k])
  })
  if (suspects.length) {
    console.log(`${f}: ${suspects.length} likely untranslated UI strings`)
    suspects.slice(0, 20).forEach(([k]) => console.log(`  - ${k}`))
  }
}
