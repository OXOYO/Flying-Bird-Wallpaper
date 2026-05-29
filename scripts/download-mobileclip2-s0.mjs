/**
 * 下载 MobileCLIP2-S0 视觉 ONNX（国内可用 hf-mirror）
 * 用法: node scripts/download-mobileclip2-s0.mjs
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const outDir = path.join(__dirname, '../resources/models')
const base = 'https://hf-mirror.com/plhery/mobileclip2-onnx/resolve/main/onnx/s0'
const files = [
  { url: `${base}/vision_model.onnx`, name: 'mobileclip2_s0_vision.onnx' },
  { url: `${base}/preprocessor_config.json`, name: 'mobileclip2_s0_preprocessor.json' }
]

fs.mkdirSync(outDir, { recursive: true })

for (const { url, name } of files) {
  const dest = path.join(outDir, name)
  process.stdout.write(`下载 ${name} ...\n`)
  const res = await fetch(url)
  if (!res.ok) throw new Error(`HTTP ${res.status} ${url}`)
  const buf = Buffer.from(await res.arrayBuffer())
  fs.writeFileSync(dest, buf)
  process.stdout.write(`  -> ${(buf.length / 1024 / 1024).toFixed(2)} MB\n`)
}

console.log('完成:', outDir)
