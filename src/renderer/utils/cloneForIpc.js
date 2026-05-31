/**
 * 深拷贝为可经 Electron IPC（structured clone）安全传递的纯 JSON 数据。
 * 去除 Vue Proxy、函数、DOM 等不可克隆字段，避免 "An object could not be cloned"。
 */
export function cloneForIpc(value) {
  if (value === undefined) return undefined
  if (value === null) return null
  const type = typeof value
  if (type !== 'object') return value
  return JSON.parse(
    JSON.stringify(value, (_key, v) => {
      if (typeof v === 'bigint') return v.toString()
      if (typeof v === 'function' || typeof v === 'symbol') return undefined
      return v
    })
  )
}
