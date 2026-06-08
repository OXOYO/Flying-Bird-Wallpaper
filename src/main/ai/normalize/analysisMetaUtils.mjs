/** 解析 fbw_resource_ai.analysisMeta JSON */
export function parseAnalysisMeta(text) {
  if (!text || typeof text !== 'string') return {}
  try {
    const obj = JSON.parse(text)
    return typeof obj === 'object' && obj ? obj : {}
  } catch {
    return {}
  }
}

/** 解析 fbw_resource_ai.rawLlmJson */
export function parseRawLlmJson(text) {
  if (!text || typeof text !== 'string') return null
  try {
    const obj = JSON.parse(text)
    return typeof obj === 'object' && obj ? obj : null
  } catch {
    return null
  }
}

/** @param {object} meta */
export function stringifyAnalysisMeta(meta) {
  return JSON.stringify(meta || {})
}
