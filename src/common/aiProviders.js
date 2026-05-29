/** AI 服务预设（渲染进程 / 主进程共用） */
export const AI_SERVICE_PRESETS = [
  {
    id: 'ollama',
    provider: 'ollama',
    baseUrl: 'http://127.0.0.1:11434',
    local: true,
    locale: 'pages.Setting.aiSetting.presets.ollama'
  },
  {
    id: 'lmstudio',
    provider: 'openai-compatible',
    baseUrl: 'http://127.0.0.1:1234',
    local: true,
    locale: 'pages.Setting.aiSetting.presets.lmstudio'
  },
  {
    id: 'localai',
    provider: 'openai-compatible',
    baseUrl: 'http://127.0.0.1:8080',
    local: true,
    locale: 'pages.Setting.aiSetting.presets.localai'
  },
  {
    id: 'llamacpp',
    provider: 'openai-compatible',
    baseUrl: 'http://127.0.0.1:8081',
    local: true,
    locale: 'pages.Setting.aiSetting.presets.llamacpp'
  },
  {
    id: 'openrouter',
    provider: 'openai-compatible',
    baseUrl: 'https://openrouter.ai/api',
    locale: 'pages.Setting.aiSetting.presets.openrouter',
    openRouter: true
  },
  {
    id: 'openai',
    provider: 'openai-compatible',
    baseUrl: 'https://api.openai.com',
    locale: 'pages.Setting.aiSetting.presets.openai'
  },
  {
    id: 'deepseek',
    provider: 'openai-compatible',
    baseUrl: 'https://api.deepseek.com',
    locale: 'pages.Setting.aiSetting.presets.deepseek'
  },
  {
    id: 'siliconflow',
    provider: 'openai-compatible',
    baseUrl: 'https://api.siliconflow.cn',
    locale: 'pages.Setting.aiSetting.presets.siliconflow'
  },
  {
    id: 'groq',
    provider: 'openai-compatible',
    baseUrl: 'https://api.groq.com/openai',
    locale: 'pages.Setting.aiSetting.presets.groq'
  },
  {
    id: 'together',
    provider: 'openai-compatible',
    baseUrl: 'https://api.together.xyz',
    locale: 'pages.Setting.aiSetting.presets.together'
  },
  {
    id: 'moonshot',
    provider: 'openai-compatible',
    baseUrl: 'https://api.moonshot.cn',
    locale: 'pages.Setting.aiSetting.presets.moonshot'
  },
  {
    id: 'custom',
    provider: 'openai-compatible',
    baseUrl: '',
    locale: 'pages.Setting.aiSetting.presets.custom',
    custom: true
  }
]

export const getPresetById = (id) =>
  AI_SERVICE_PRESETS.find((item) => item.id === id) ||
  AI_SERVICE_PRESETS.find((item) => item.id === 'custom')

/** 是否为本地推理预设（Ollama 或本机 OpenAI 兼容服务） */
export const isLocalPreset = (presetId) => !!getPresetById(presetId)?.local

export const isRemotePreset = (presetId) => !isLocalPreset(presetId)

export const isLocalhostBaseUrl = (baseUrl = '') => {
  try {
    const raw = String(baseUrl).trim()
    if (!raw) return false
    const u = new URL(raw.includes('://') ? raw : `http://${raw}`)
    return ['localhost', '127.0.0.1', '::1'].includes(u.hostname)
  } catch {
    return false
  }
}

/** OpenAI 兼容远程服务是否需要 API Key（本地预设与本机自定义地址不需要） */
export const presetRequiresApiKey = (presetId, baseUrl = '') => {
  const preset = getPresetById(presetId)
  if (!preset) return true
  if (preset.local) return false
  if (preset.custom && isLocalhostBaseUrl(baseUrl)) return false
  return preset.provider === 'openai-compatible'
}

export const inferPresetFromAi = (provider, baseUrl = '') => {
  if (provider === 'ollama') return 'ollama'
  const url = String(baseUrl).replace(/\/$/, '')
  const matched = AI_SERVICE_PRESETS.filter((item) => !item.custom && item.baseUrl)
    .sort((a, b) => b.baseUrl.length - a.baseUrl.length)
    .find((item) => url.startsWith(item.baseUrl.replace(/\/$/, '')))
  return matched?.id || 'custom'
}

/**
 * @param {object} ai
 * @param {'vision'|'text'|'visualEmbed'} kind
 * @param {{ previousPresetId?: string }} [options] 切换前预设 id，用于从 Ollama 等切到 custom 时清空旧地址
 */
export const applyServicePreset = (ai, kind, options = {}) => {
  const { previousPresetId } = options
  const fields =
    kind === 'vision'
      ? { preset: 'visionPreset', provider: 'visionProvider', url: 'visionBaseUrl' }
      : kind === 'visualEmbed'
        ? {
            preset: 'visualEmbedPreset',
            provider: 'visualEmbedProvider',
            url: 'visualEmbedBaseUrl'
          }
        : { preset: 'textPreset', provider: 'textProvider', url: 'textBaseUrl' }
  const preset = getPresetById(ai[fields.preset])
  ai[fields.provider] = preset.provider
  if (preset.custom) {
    if (previousPresetId && previousPresetId !== 'custom') {
      ai[fields.url] = ''
    }
  } else if (preset.baseUrl) {
    ai[fields.url] = preset.baseUrl
  }
}

export const buildRemoteExtraHeaders = (ai = {}, baseUrl = '') => {
  const headers = {}
  const url = String(baseUrl || '')
  if (url.includes('openrouter.ai')) {
    headers['HTTP-Referer'] =
      ai.remoteReferer || 'https://github.com/OXOYO/Flying-Bird-Wallpaper'
    headers['X-Title'] = ai.remoteAppTitle || 'Flying Bird Wallpaper'
  }
  return headers
}
