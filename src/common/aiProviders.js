/** AI 服务预设（渲染进程 / 主进程共用） */
export const AI_SERVICE_PRESETS = [
  {
    id: 'ollama',
    provider: 'ollama',
    baseUrl: 'http://127.0.0.1:11434',
    locale: 'pages.Setting.aiSetting.presets.ollama'
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

export const isLocalPreset = (presetId) => getPresetById(presetId)?.provider === 'ollama'

export const isRemotePreset = (presetId) => !isLocalPreset(presetId)

export const inferPresetFromAi = (provider, baseUrl = '') => {
  if (provider === 'ollama') return 'ollama'
  const url = String(baseUrl).replace(/\/$/, '')
  const matched = AI_SERVICE_PRESETS.find(
    (item) => !item.custom && item.baseUrl && url.startsWith(item.baseUrl.replace(/\/$/, ''))
  )
  return matched?.id || 'custom'
}

export const applyServicePreset = (ai, kind) => {
  const presetField = kind === 'vision' ? 'visionPreset' : 'textPreset'
  const providerField = kind === 'vision' ? 'visionProvider' : 'textProvider'
  const urlField = kind === 'vision' ? 'visionBaseUrl' : 'textBaseUrl'
  const preset = getPresetById(ai[presetField])
  ai[providerField] = preset.provider
  if (!preset.custom && preset.baseUrl) {
    ai[urlField] = preset.baseUrl
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
