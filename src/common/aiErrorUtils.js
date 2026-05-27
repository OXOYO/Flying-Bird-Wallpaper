import { resolveApiUserMessage } from './utils.js'

export const AI_ERROR_CODE = {
  API_KEY_MISSING: 'AI_API_KEY_MISSING',
  OLLAMA_UNREACHABLE: 'AI_OLLAMA_UNREACHABLE',
  NETWORK: 'AI_NETWORK',
  TIMEOUT: 'AI_TIMEOUT',
  RATE_LIMITED: 'AI_RATE_LIMITED',
  UNAUTHORIZED: 'AI_UNAUTHORIZED',
  MODEL_NOT_FOUND: 'AI_MODEL_NOT_FOUND',
  MODEL_PURPOSE_MISMATCH: 'AI_MODEL_PURPOSE_MISMATCH',
  SERVER_ERROR: 'AI_SERVER_ERROR',
  PROVIDER_ERROR: 'AI_PROVIDER_ERROR'
}

const shorten = (text, max = 140) => {
  const value = String(text || '')
    .replace(/\s+/g, ' ')
    .trim()
  if (!value) return ''
  return value.length > max ? `${value.slice(0, max)}…` : value
}

const looksLikeJson = (text) => {
  const s = String(text || '').trim()
  return s.startsWith('{') || s.startsWith('[')
}

const unwrapJsonString = (value) => {
  const s = String(value || '').trim()
  if (!s) return ''
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
    try {
      return String(JSON.parse(s)).trim()
    } catch {
      return s.replace(/^["']|["']$/g, '').replace(/\\"/g, '"').trim()
    }
  }
  return s
}

const stripErrorPrefix = (raw) =>
  String(raw || '')
    .replace(/^Ollama \w+ \d+: /, '')
    .replace(/^OpenAI-compatible \w+ \d+: /, '')
    .trim()

const extractRawMetaFromText = (text) => {
  const match = String(text || '').match(/"raw"\s*:\s*"((?:\\.|[^"\\])*)"/)
  if (!match) return ''
  try {
    return unwrapJsonString(`"${match[1]}"`)
  } catch {
    return match[1].replace(/\\"/g, '"').replace(/\\n/g, ' ').trim()
  }
}

const extractProviderDetail = (raw) => {
  const text = stripErrorPrefix(raw)
  if (!text) return ''

  const payload = extractJsonPayload(text)
  const err = payload?.error

  if (err) {
    const rawMeta = unwrapJsonString(err.metadata?.raw)
    if (rawMeta && !looksLikeJson(rawMeta)) return shorten(rawMeta)

    if (typeof err === 'string' && err !== 'Provider returned error') return shorten(err)

    const message = unwrapJsonString(err.message)
    if (message && message !== 'Provider returned error' && !looksLikeJson(message)) {
      return shorten(message)
    }
  }

  const rawMeta = extractRawMetaFromText(text)
  if (rawMeta && !looksLikeJson(rawMeta)) return shorten(rawMeta)

  const rateHint = text.match(
    /([a-z0-9][a-z0-9._/-]*:free)\s+is\s+temporarily\s+rate-limited[^.]*\.?/i
  )
  if (rateHint) return shorten(rateHint[0])

  if (looksLikeJson(text)) return ''
  return shorten(text)
}

const localizeProviderDetail = (detail, t) => {
  const value = sanitizeUserDetail(detail)
  if (!value) return ''

  const upstreamRateLimit = value.match(/^(\S+)\s+is temporarily rate-limited upstream/i)
  if (upstreamRateLimit) {
    return t('pages.Setting.aiSetting.errors.rateLimitedUpstream', {
      model: upstreamRateLimit[1]
    })
  }

  return shorten(value)
}

const sanitizeUserDetail = (detail) => {
  const value = unwrapJsonString(detail)
  if (!value || looksLikeJson(value)) return ''
  if (value === 'Provider returned error') return ''
  return shorten(value)
}

const extractHttpStatus = (raw) => {
  const matched = String(raw || '').match(/(?:Ollama|OpenAI-compatible) \w+ (\d{3}):/)
  return matched ? Number(matched[1]) : undefined
}

const extractJsonPayload = (raw) => {
  const jsonStart = String(raw || '').indexOf('{')
  if (jsonStart < 0) return null
  try {
    return JSON.parse(String(raw).slice(jsonStart))
  } catch {
    return null
  }
}

const isNetworkError = (raw) =>
  /fetch failed|failed to fetch|network error|networkerror|econnrefused|enotfound|etimedout|socket hang up|load failed/i.test(
    raw
  )

const isTimeoutError = (raw) => /aborterror|timed out|timeout|超时/i.test(raw)

const isOllamaContext = (context = {}) =>
  context.providerType === 'ollama' ||
  /11434|ollama/i.test(String(context.baseUrl || ''))

/**
 * 解析 AI 请求错误，输出 errorCode 供 i18n 映射。
 * @param {Error|string|object} err
 * @param {{ providerType?: string, baseUrl?: string, raw?: string }} [context]
 */
export function parseAiError(err, context = {}) {
  if (err?.errorCode) {
    return {
      errorCode: err.errorCode,
      errorParams: err.errorParams || {},
      httpStatus: err.httpStatus
    }
  }

  const raw = String(err?.message || err || context.raw || '').trim()
  const httpStatus = err?.httpStatus || extractHttpStatus(raw)
  const detail = extractProviderDetail(raw)

  if (/请先填写 API Key|please fill.*api key|api key.*required/i.test(raw)) {
    return { errorCode: AI_ERROR_CODE.API_KEY_MISSING, errorParams: {}, httpStatus }
  }

  if (isTimeoutError(raw)) {
    return { errorCode: AI_ERROR_CODE.TIMEOUT, errorParams: {}, httpStatus }
  }

  if (isNetworkError(raw)) {
    if (isOllamaContext({ ...context, raw })) {
      return { errorCode: AI_ERROR_CODE.OLLAMA_UNREACHABLE, errorParams: {}, httpStatus }
    }
    return { errorCode: AI_ERROR_CODE.NETWORK, errorParams: {}, httpStatus }
  }

  if (httpStatus === 401 || /invalid.*api.*key|unauthorized|authentication/i.test(detail)) {
    return { errorCode: AI_ERROR_CODE.UNAUTHORIZED, errorParams: {}, httpStatus }
  }

  if (httpStatus === 429 || /rate[- ]?limit|too many requests|temporarily rate-limited/i.test(detail)) {
    return {
      errorCode: AI_ERROR_CODE.RATE_LIMITED,
      errorParams: detail ? { detail: sanitizeUserDetail(detail) } : {},
      httpStatus
    }
  }

  if (
    httpStatus === 404 ||
    /model.*not found|not found|does not exist|unknown model|pull.*model/i.test(detail)
  ) {
    return {
      errorCode: AI_ERROR_CODE.MODEL_NOT_FOUND,
      errorParams: detail ? { detail: sanitizeUserDetail(detail) } : {},
      httpStatus
    }
  }

  if (httpStatus && httpStatus >= 500) {
    return {
      errorCode: AI_ERROR_CODE.SERVER_ERROR,
      errorParams: { status: httpStatus, detail: sanitizeUserDetail(detail) },
      httpStatus
    }
  }

  if (detail) {
    const safeDetail = sanitizeUserDetail(detail)
    return {
      errorCode: AI_ERROR_CODE.PROVIDER_ERROR,
      errorParams: safeDetail ? { detail: safeDetail } : {},
      httpStatus
    }
  }

  return { errorCode: AI_ERROR_CODE.NETWORK, errorParams: {}, httpStatus }
}

/** @deprecated 请使用 parseAiError + resolveAiUserMessage */
export function formatAiErrorMessage(err, context) {
  const parsed = parseAiError(err, context)
  return parsed.errorParams?.detail || parsed.errorCode || String(err?.message || err || '')
}

/**
 * 将 AI 接口错误映射为用户可见的多语言文案。
 * @param {string|object|null|undefined} input
 * @param {function} t
 */
export function resolveAiUserMessage(input, t) {
  const res =
    input != null && typeof input === 'object' && !Array.isArray(input)
      ? input
      : { message: input }

  if (res.success) return ''

  const parsed = parseAiError(
    { message: res.message, errorCode: res.errorCode, errorParams: res.errorParams },
    res.context || {}
  )
  const code = res.errorCode || parsed.errorCode
  const params = res.errorParams || parsed.errorParams || {}

  switch (code) {
    case AI_ERROR_CODE.API_KEY_MISSING:
      return t('pages.Setting.aiSetting.errors.apiKeyMissing')
    case AI_ERROR_CODE.OLLAMA_UNREACHABLE:
      return t('pages.Setting.aiSetting.errors.ollamaUnreachable')
    case AI_ERROR_CODE.NETWORK:
      return t('pages.Setting.aiSetting.errors.networkError')
    case AI_ERROR_CODE.TIMEOUT:
      return t('pages.Setting.aiSetting.errors.timeout')
    case AI_ERROR_CODE.RATE_LIMITED: {
      const detail = localizeProviderDetail(params.detail, t)
      return detail
        ? t('pages.Setting.aiSetting.errors.rateLimitedDetail', { detail })
        : t('pages.Setting.aiSetting.errors.rateLimited')
    }
    case AI_ERROR_CODE.UNAUTHORIZED:
      return t('pages.Setting.aiSetting.errors.unauthorized')
    case AI_ERROR_CODE.MODEL_NOT_FOUND: {
      const detail = sanitizeUserDetail(params.detail)
      return detail
        ? t('pages.Setting.aiSetting.errors.modelNotFoundDetail', { detail })
        : t('pages.Setting.aiSetting.errors.modelNotFound')
    }
    case AI_ERROR_CODE.MODEL_PURPOSE_MISMATCH: {
      const purposeLabels = {
        vision: 'pages.Setting.aiSetting.purposeVision',
        text: 'pages.Setting.aiSetting.purposeText',
        embed: 'pages.Setting.aiSetting.purposeEmbed'
      }
      const purposeKey = purposeLabels[params.purpose]
      return t('pages.Setting.aiSetting.errors.modelPurposeMismatch', {
        model: params.model || '',
        purpose: purposeKey ? t(purposeKey) : params.purposeLabel || params.purpose || ''
      })
    }
    case AI_ERROR_CODE.SERVER_ERROR:
      return t('pages.Setting.aiSetting.errors.serverError', {
        status: params.status || parsed.httpStatus || ''
      })
    case AI_ERROR_CODE.PROVIDER_ERROR: {
      const detail = sanitizeUserDetail(params.detail)
      return detail
        ? t('pages.Setting.aiSetting.errors.providerError', { detail })
        : t('pages.Setting.aiSetting.errors.providerErrorGeneric')
    }
    default:
      break
  }

  return resolveApiUserMessage(res, t) || t('messages.operationFail')
}
