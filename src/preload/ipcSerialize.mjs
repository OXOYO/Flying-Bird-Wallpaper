/**
 * 与 renderer/utils/cloneForIpc.js 保持一致：IPC 入参序列化
 */
export function serializeForIpc(value) {
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

/** 对 invoke 的首个参数做序列化（单对象 IPC 调用） */
export function invokeWithObject(channel, ipcRenderer, arg) {
  return ipcRenderer.invoke(channel, serializeForIpc(arg))
}
