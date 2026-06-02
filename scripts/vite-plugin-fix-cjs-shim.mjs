/**
 * electron-vite 的 esm-shim 会把 CJS 垫片插在「最后一个 import」之后；
 * 大 chunk 里若含 `// no: import "foo"` 等注释，会误匹配导致垫片出现在文件中部并触发语法错误。
 * 本插件在 writeBundle 阶段（晚于 esm-shim）将垫片统一挪到文件头部 import 区之后。
 */
const CJS_SHIM_BLOCK_RE =
  /\/\/ -- CommonJS Shims --\r?\n[\s\S]*?const require = __cjs_mod__\.createRequire\(import\.meta\.url\);\r?\n/g

function findTopImportBlockEnd(code) {
  let pos = 0
  const len = code.length

  while (pos < len) {
    if (pos === 0 && code.startsWith('#!')) {
      pos = code.indexOf('\n', pos) + 1
      continue
    }

    const lineEnd = code.indexOf('\n', pos)
    const end = lineEnd === -1 ? len : lineEnd
    const line = code.slice(pos, end).trim()

    if (!line) {
      pos = end + 1
      continue
    }

    if (line.startsWith('//')) {
      pos = end + 1
      continue
    }

    if (line.startsWith('/*')) {
      const blockEnd = code.indexOf('*/', pos)
      pos = blockEnd === -1 ? len : blockEnd + 2
      continue
    }

    if (line.startsWith('import ') || line.startsWith('import{') || line.startsWith('export ')) {
      const semi = code.indexOf(';', pos)
      if (semi === -1) return pos
      pos = semi + 1
      while (pos < len && (code[pos] === '\n' || code[pos] === '\r')) pos += 1
      continue
    }

    break
  }

  return pos
}

/** esm-shim 误插入后可能残留的 import attributes 片段 */
const ORPHAN_IMPORT_ASSERT_RE = /^\s*assert\s*\{[^}\n]+\}\s*\r?\n/gm

function removeOrphanImportAssertLines(code) {
  return code.replace(ORPHAN_IMPORT_ASSERT_RE, '')
}

function relocateCjsShim(code) {
  let next = code

  if (next.includes('// -- CommonJS Shims --')) {
    const blocks = next.match(CJS_SHIM_BLOCK_RE)
    if (blocks?.length) {
      const shimBlock = blocks[0]
      const stripped = next.replace(CJS_SHIM_BLOCK_RE, '')
      const insertAt = findTopImportBlockEnd(stripped)
      next = `${stripped.slice(0, insertAt)}${shimBlock}${stripped.slice(insertAt)}`
    }
  }

  return removeOrphanImportAssertLines(next)
}

export function fixCjsShimPlacementPlugin() {
  return {
    name: 'fbw-fix-cjs-shim-placement',
    apply: 'build',
    enforce: 'post',
    generateBundle(_outputOptions, bundle) {
      for (const item of Object.values(bundle)) {
        if (item.type !== 'chunk' || !item.fileName.endsWith('.js')) continue
        const fixed = relocateCjsShim(item.code)
        if (fixed !== item.code) item.code = fixed
      }
    }
  }
}
