import fs from 'node:fs'
import path from 'node:path'
import { execSync } from 'node:child_process'

const root = path.resolve(import.meta.dirname, '..')
const langDir = path.join(root, 'src/i18n/locale/lang')
const locales = fs.readdirSync(langDir).filter((f) => f.endsWith('.json'))

function flatten(obj, prefix = '') {
  const out = {}
  for (const [k, v] of Object.entries(obj || {})) {
    const key = prefix ? `${prefix}.${k}` : k
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      Object.assign(out, flatten(v, key))
    } else {
      out[key] = v
    }
  }
  return out
}

const data = {}
for (const file of locales) {
  const loc = file.replace('.json', '')
  data[loc] = flatten(JSON.parse(fs.readFileSync(path.join(langDir, file), 'utf8')))
}

const base = 'zh-CN'
const baseKeys = Object.keys(data[base]).sort()

console.log('=== Locale key counts ===')
for (const file of locales) {
  const loc = file.replace('.json', '')
  console.log(`${loc}: ${Object.keys(data[loc]).length}`)
}

console.log('\n=== Missing vs zh-CN ===')
for (const loc of Object.keys(data)) {
  if (loc === base) continue
  const missing = baseKeys.filter((k) => !(k in data[loc]))
  const extra = Object.keys(data[loc]).filter((k) => !(k in data[base]))
  if (!missing.length && !extra.length) {
    console.log(`${loc}: OK`)
    continue
  }
  console.log(`\n${loc}: missing ${missing.length}, extra ${extra.length}`)
  const show = (arr, tag, max = 25) => {
    arr.slice(0, max).forEach((k) => console.log(`  ${tag} ${k}`))
    if (arr.length > max) console.log(`  ... +${arr.length - max} more`)
  }
  show(missing, '-M')
  show(extra, '+E')
}

const en = data['en-US']
const chineseInEn = baseKeys.filter((k) => {
  const v = en[k]
  return typeof v === 'string' && /[\u4e00-\u9fff]/.test(v)
})
console.log(`\n=== en-US still contains Chinese: ${chineseInEn.length} ===`)
chineseInEn.slice(0, 30).forEach((k) => console.log(`  ${k}`))

// Collect t() keys from source
const srcDir = path.join(root, 'src')
const exts = new Set(['.vue', '.js', '.mjs'])
const used = new Set()
const tRe = /\bt\s*\(\s*['"]([a-zA-Z][a-zA-Z0-9_.]*)/g
const i18nKeyRe = /i18nKey\s*\(\s*['"]([a-zA-Z][a-zA-Z0-9_.]*)/g
const opKeyRe = /opKey\s*\(\s*['"]([a-zA-Z][a-zA-Z0-9_.]*)/g

function walk(dir) {
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name)
    const st = fs.statSync(p)
    if (st.isDirectory()) {
      if (name === 'locale' || name === 'node_modules') continue
      walk(p)
      continue
    }
    const ext = path.extname(name)
    if (!exts.has(ext)) continue
    const text = fs.readFileSync(p, 'utf8')
    for (const re of [tRe, i18nKeyRe, opKeyRe]) {
      re.lastIndex = 0
      let m
      while ((m = re.exec(text))) used.add(m[1])
    }
  }
}
walk(srcDir)

console.log(`\n=== Used i18n keys in src: ${used.size} ===`)

const missingInZh = [...used].filter((k) => !(k in data[base])).sort()
console.log(`Used but NOT in zh-CN: ${missingInZh.length}`)
missingInZh.forEach((k) => console.log(`  ! ${k}`))

function isKeyUsed(k) {
  if (used.has(k)) return true
  for (const u of used) {
    if (u.startsWith(`${k}.`)) return true
    if (k.startsWith(`${u}.`)) return true
  }
  // dynamic suffix patterns
  const dynPrefixes = [
    'pages.Setting.aiSetting.presetHints.',
    'pages.Setting.pluginMarketplace.secretKey.hint.',
    'main.store.PluginManager.'
  ]
  for (const p of dynPrefixes) {
    if (k.startsWith(p) && used.has(p.slice(0, -1).replace(/\.$/, ''))) return true
    if (k.startsWith(p)) return true
  }
  return false
}

const unused = baseKeys.filter((k) => !isKeyUsed(k))
console.log(`\n=== Possibly unused in zh-CN: ${unused.length} ===`)
unused.forEach((k) => console.log(`  ? ${k}`))

// Recent plugin marketplace keys check
const pmKeys = baseKeys.filter((k) => k.includes('pluginMarketplace'))
console.log(`\n=== pluginMarketplace keys: ${pmKeys.length} ===`)
for (const loc of ['en-US', 'de-DE', 'ja-JP']) {
  const miss = pmKeys.filter((k) => !(k in data[loc]))
  if (miss.length) console.log(`${loc} missing PM keys: ${miss.length}`)
}

// Full missing list for de-DE
const deMissing = baseKeys.filter((k) => !(k in data['de-DE']))
console.log(`\n=== ALL ${deMissing.length} keys in zh-CN missing from de-DE ===`)
deMissing.forEach((k) => console.log(k))

const deExtra = Object.keys(data['de-DE']).filter((k) => !(k in data[base]))
console.log(`\n=== ALL ${deExtra.length} obsolete keys in de-DE (not in zh-CN) ===`)
deExtra.forEach((k) => console.log(k))

const twMissing = baseKeys.filter((k) => !(k in data['zh-TW']))
console.log(`\n=== zh-TW missing ${twMissing.length} vs zh-CN ===`)
twMissing.forEach((k) => console.log(k))

const twExtra = Object.keys(data['zh-TW']).filter((k) => !(k in data[base]))
console.log(`\n=== zh-TW extra ${twExtra.length} (not in zh-CN) ===`)
twExtra.forEach((k) => console.log(k))
