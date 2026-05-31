/**
 * 以 zh-CN / en-US 为基准同步翻译，并删除废弃键
 * 运行: node scripts/sync-i18n.mjs
 */
import fs from 'node:fs'
import path from 'node:path'

const root = path.resolve(import.meta.dirname, '..')
const langDir = path.join(root, 'src/i18n/locale/lang')

const OBSOLETE_KEYS = [
  'pages.Setting.aiSetting.testVision',
  'pages.Setting.aiSetting.testText',
  'pages.Setting.aiSetting.testOkWithEmbed',
  'pages.Setting.aiSetting.similarMinCosine',
  'pages.Setting.aiSetting.similarMinCosineHint',
  'pages.Setting.aiSetting.findSimilarMode',
  'pages.Setting.aiSetting.findSimilarModeVisual',
  'pages.Setting.aiSetting.findSimilarModeText',
  'pages.Setting.aiSetting.findSimilarModeHint',
  'pages.Setting.aiSetting.similarMinCosineVisual',
  'pages.Setting.aiSetting.similarMinCosineVisualHint',
  'pages.Setting.aiSetting.refreshModels',
  'messages.autoRefreshDirectoryTaskSuccess',
  'messages.autoRefreshDirectoryTaskFailed'
]

const COPY_MODEL_NAME = {
  'zh-CN': '复制模型名',
  'zh-TW': '複製模型名',
  'en-US': 'Copy model name',
  'de-DE': 'Modellname kopieren',
  'fr-FR': 'Copier le nom du modèle',
  'es-ES': 'Copiar nombre del modelo',
  'it-IT': 'Copia nome modello',
  'pt-BR': 'Copiar nome do modelo',
  'ru-RU': 'Копировать имя модели',
  'ja-JP': 'モデル名をコピー',
  'ko-KR': '모델 이름 복사',
  'ar-SA': 'نسخ اسم النموذج'
}

/** 简体 → 繁体（常见 UI 用字） */
function toTraditional(text) {
  if (typeof text !== 'string') return text
  const pairs = [
    ['确定', '確定'],
    ['标签', '標籤'],
    ['浏览', '瀏覽'],
    ['设置', '設置'],
    ['隐私', '隱私'],
    ['密码', '密碼'],
    ['提示', '提示'],
    ['空间', '空間'],
    ['内容', '內容'],
    ['显示', '顯示'],
    ['敏感', '敏感'],
    ['解锁', '解鎖'],
    ['点击', '點擊'],
    ['查看', '查看'],
    ['摘要', '摘要'],
    ['分析', '分析'],
    ['状态', '狀態'],
    ['等级', '等級'],
    ['合集', '合集'],
    ['推荐', '推薦'],
    ['进度', '進度'],
    ['排队', '排隊'],
    ['运行', '運行'],
    ['完成', '完成'],
    ['关闭', '關閉'],
    ['开启', '開啟'],
    ['任务', '任務'],
    ['失败', '失敗'],
    ['跳过', '跳過'],
    ['待处理', '待處理'],
    ['已', '已'],
    ['未', '未'],
    ['请', '請'],
    ['后', '後'],
    ['为', '為'],
    ['时', '時'],
    ['这', '這'],
    ['个', '個'],
    ['来', '來'],
    ['发', '發'],
    ['现', '現'],
    ['门', '門'],
    ['页', '頁'],
    ['图', '圖'],
    ['库', '庫'],
    ['资源', '資源'],
    ['目录', '目錄'],
    ['确认', '確認'],
    ['手动', '手動'],
    ['继续', '繼續'],
    ['策展', '策展']
  ]
  let s = text
  for (const [a, b] of pairs) s = s.split(a).join(b)
  return s
}

function getByPath(obj, dotPath) {
  return dotPath.split('.').reduce((o, k) => (o != null ? o[k] : undefined), obj)
}

function deleteByPath(obj, dotPath) {
  const parts = dotPath.split('.')
  const last = parts.pop()
  let cur = obj
  for (const p of parts) {
    if (!cur || typeof cur !== 'object') return
    cur = cur[p]
  }
  if (cur && typeof cur === 'object') delete cur[last]
}

function setByPath(obj, dotPath, value) {
  const parts = dotPath.split('.')
  const last = parts.pop()
  let cur = obj
  for (const p of parts) {
    if (!cur[p] || typeof cur[p] !== 'object') cur[p] = {}
    cur = cur[p]
  }
  cur[last] = value
}

function flatten(obj, prefix = '') {
  const out = {}
  for (const [k, v] of Object.entries(obj || {})) {
    const key = prefix ? `${prefix}.${k}` : k
    if (v && typeof v === 'object' && !Array.isArray(v)) Object.assign(out, flatten(v, key))
    else out[key] = v
  }
  return out
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(path.join(langDir, file), 'utf8'))
}

function writeJson(file, data) {
  fs.writeFileSync(path.join(langDir, file), `${JSON.stringify(data, null, 2)}\n`, 'utf8')
}

const zhCN = readJson('zh-CN.json')
const enUS = readJson('en-US.json')
const flatZh = flatten(zhCN)
const flatEn = flatten(enUS)

const westernLocales = [
  'de-DE',
  'fr-FR',
  'es-ES',
  'it-IT',
  'pt-BR',
  'ru-RU',
  'ja-JP',
  'ko-KR',
  'ar-SA'
]

let stats = { synced: 0, removed: 0, copyModel: 0 }

for (const file of fs.readdirSync(langDir).filter((f) => f.endsWith('.json'))) {
  const loc = file.replace('.json', '')
  const data = readJson(file)
  let flat = flatten(data)
  const sourceFlat =
    loc === 'zh-TW' ? flatZh : loc === 'zh-CN' || loc === 'en-US' ? null : flatEn

  if (sourceFlat) {
    for (const key of Object.keys(flatZh)) {
      if (!(key in flat) && sourceFlat[key] !== undefined) {
        let val = sourceFlat[key]
        if (loc === 'zh-TW') val = toTraditional(val)
        setByPath(data, key, val)
        stats.synced++
      }
    }
    flat = flatten(data)
  }

  for (const key of OBSOLETE_KEYS) {
    if (key in flat || getByPath(data, key) !== undefined) {
      deleteByPath(data, key)
      stats.removed++
    }
  }

  const copyPath = 'pages.Setting.aiSetting.copyModelName'
  if (COPY_MODEL_NAME[loc]) {
    setByPath(data, copyPath, COPY_MODEL_NAME[loc])
    stats.copyModel++
  }

  writeJson(file, data)
  console.log(`Updated ${file}`)
}

console.log('\nDone:', stats)
