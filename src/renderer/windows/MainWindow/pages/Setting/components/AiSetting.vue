<script setup>
import UseSettingStore from '@renderer/stores/settingStore.js'
import { useTranslation } from 'i18next-vue'
import { storeToRefs } from 'pinia'
import {
  AI_SERVICE_PRESETS,
  applyServicePreset,
  getPresetById,
  isLocalPreset,
  presetRequiresApiKey
} from '@common/aiProviders.js'
import { resolveAiUserMessage } from '@common/aiErrorUtils.js'
import { useSettingAnchorScroll } from '../utils/useSettingAnchorScroll.js'
import clipboard from 'clipboardy'
import AiAnalysisDashboardPanel from './AiAnalysisDashboardPanel.vue'

const { t } = useTranslation()
const settingStore = UseSettingStore()
const { settingData } = storeToRefs(settingStore)

const aiSettingsScrollbarRef = ref(null)
const { anchorContainer, onAnchorChange, restoreAnchorScroll } = useSettingAnchorScroll(
  aiSettingsScrollbarRef,
  { defaultHref: '#divider-ai-base' }
)
const flags = reactive({ saving: false })
const testingVision = ref(false)
const testingText = ref(false)
const loadingVisionModels = ref(false)
const loadingTextModels = ref(false)
const loadingEmbedModels = ref(false)
const testVisionResult = ref(null)
const testTextResult = ref(null)
const visionModels = ref([])
const textModels = ref([])
const embedModels = ref([])

const aiForm = reactive({
  ...JSON.parse(JSON.stringify(settingData.value.ai || {}))
})

const presetOptions = computed(() =>
  AI_SERVICE_PRESETS.map((item) => ({
    value: item.id,
    label: t(item.locale)
  }))
)

const analysisModeOptions = computed(() => [
  { label: t('pages.Setting.aiSetting.analysisModeOff'), value: 'off' },
  { label: t('pages.Setting.aiSetting.analysisModeOnDemand'), value: 'on_demand' },
  { label: t('pages.Setting.aiSetting.analysisModeBackground'), value: 'background_slow' },
  { label: t('pages.Setting.aiSetting.analysisModeNewOnly'), value: 'new_only' }
])

/** AI 功能开关：说明放 tooltip，避免表单项纵向堆叠过乱 */
const featureSwitches = [
  {
    key: 'enableNsfwCheck',
    labelKey: 'pages.Setting.aiSetting.enableNsfwCheck',
    hintKey: 'pages.Setting.aiSetting.enableNsfwCheckHint'
  },
  {
    key: 'expandDownloadKeywords',
    labelKey: 'pages.Setting.aiSetting.expandDownloadKeywords',
    hintKey: 'pages.Setting.aiSetting.expandDownloadKeywordsHint'
  },
  {
    key: 'legacyOnnxScore',
    labelKey: 'pages.Setting.aiSetting.legacyOnnxScore',
    hintKey: 'pages.Setting.aiSetting.legacyOnnxScoreHint'
  },
  {
    key: 'legacyJiebaTags',
    labelKey: 'pages.Setting.aiSetting.legacyJiebaTags',
    hintKey: 'pages.Setting.aiSetting.legacyJiebaTagsHint'
  }
]

const visionRequiresApiKey = computed(() =>
  presetRequiresApiKey(aiForm.visionPreset, aiForm.visionBaseUrl)
)
/** 云端视觉（非本机 OpenAI 兼容）时展示隐私说明 */
const showRemoteVisionPrivacyNote = computed(() => visionRequiresApiKey.value)
const textRequiresApiKey = computed(() =>
  presetRequiresApiKey(aiForm.textPreset, aiForm.textBaseUrl)
)

const localModelHintKey = (presetId) => {
  if (!isLocalPreset(presetId)) return ''
  if (presetId === 'ollama') return 'pages.Setting.aiSetting.ollamaModelHint'
  return `pages.Setting.aiSetting.presetHints.${presetId}`
}
const visionModelHintKey = computed(() => localModelHintKey(aiForm.visionPreset))
const textModelHintKey = computed(() => localModelHintKey(aiForm.textPreset))

const visionBaseUrlPlaceholder = computed(() => {
  const preset = getPresetById(aiForm.visionPreset)
  if (preset?.custom) return t('pages.Setting.aiSetting.customBaseUrlPlaceholder')
  return preset?.baseUrl || t('pages.Setting.aiSetting.customBaseUrlPlaceholder')
})
const textBaseUrlPlaceholder = computed(() => {
  const preset = getPresetById(aiForm.textPreset)
  if (preset?.custom) return t('pages.Setting.aiSetting.customBaseUrlPlaceholder')
  return preset?.baseUrl || t('pages.Setting.aiSetting.customBaseUrlPlaceholder')
})

const visionPresetPrev = ref(aiForm.visionPreset || 'ollama')
const textPresetPrev = ref(aiForm.textPreset || 'ollama')

const showOpenRouterFields = computed(
  () => aiForm.visionPreset === 'openrouter' || aiForm.textPreset === 'openrouter'
)

const analysisStats = ref(null)
const loadingAnalysisStats = ref(false)
let statsTimer = null

const showAnalysisProgress = computed(
  () => aiForm.enabled && aiForm.analysisMode && aiForm.analysisMode !== 'off'
)

const showBackgroundRetrySetting = computed(
  () =>
    aiForm.enabled &&
    (aiForm.analysisMode === 'background_slow' || aiForm.analysisMode === 'new_only')
)

const analysisProgressPercent = computed(() => {
  const s = analysisStats.value
  if (!s) return 0
  const total = s.total || 0
  if (!total) return s.done > 0 ? 100 : 0
  return Math.min(100, Math.round((s.done / total) * 100))
})

const analysisRunStatus = computed(() => {
  const s = analysisStats.value
  if (!s) return 'loading'
  if (s.running) return 'running'
  if (aiForm.analysisMode === 'on_demand') return 'onDemand'
  if (analysisProgressPercent.value >= 100 && (s.total ?? 0) > 0) return 'complete'
  if ((s.pending ?? 0) > 0) return 'queued'
  return 'idle'
})

const analysisStatusLabel = computed(() => {
  const map = {
    loading: 'runStatusLoading',
    running: 'runStatusRunning',
    queued: 'runStatusQueued',
    complete: 'runStatusComplete',
    idle: 'runStatusIdle',
    onDemand: 'runStatusOnDemand'
  }
  return t(`pages.Setting.aiSetting.${map[analysisRunStatus.value]}`)
})

const analysisStatusTooltip = computed(() => {
  const map = {
    queued: 'runStatusQueuedHint',
    running: 'statsRunning',
    onDemand: 'statsOnDemandHint',
    complete: 'statsComplete'
  }
  const key = map[analysisRunStatus.value]
  return key ? t(`pages.Setting.aiSetting.${key}`) : ''
})

const analysisStatusTagType = computed(() => {
  const map = {
    loading: 'info',
    running: 'primary',
    queued: 'warning',
    complete: 'success',
    idle: 'info',
    onDemand: 'info'
  }
  return map[analysisRunStatus.value]
})

const analysisProgressSummary = computed(() => {
  const s = analysisStats.value
  return t('pages.Setting.aiSetting.analysisProgressCount', {
    done: s?.done ?? 0,
    total: s?.total ?? 0
  })
})

/** 仅补充状态标签未说明的内容，避免与标签重复 */
const analysisFooterHint = computed(() => {
  if (analysisRunStatus.value === 'onDemand') {
    return t('pages.Setting.aiSetting.statsOnDemandHint')
  }
  return ''
})

const fetchAnalysisStats = async () => {
  if (!aiForm.enabled) return
  loadingAnalysisStats.value = true
  try {
    const res = await window.FBW.getAiAnalysisStats()
    if (res?.success) analysisStats.value = res.data
  } finally {
    loadingAnalysisStats.value = false
  }
}

const startStatsPolling = () => {
  stopStatsPolling()
  if (!showAnalysisProgress.value) {
    analysisStats.value = null
    return
  }
  fetchAnalysisStats()
  const fast =
    aiForm.analysisMode === 'background_slow' || aiForm.analysisMode === 'new_only'
  statsTimer = setInterval(fetchAnalysisStats, fast ? 10000 : 30000)
}

const stopStatsPolling = () => {
  if (statsTimer) {
    clearInterval(statsTimer)
    statsTimer = null
  }
}

const AI_TIMEOUT_MIN_SEC = 60
const AI_TIMEOUT_MAX_SEC = 1800
const AI_TIMEOUT_DEFAULT_SEC = 300

const AUTO_COLLECTION_COUNT_MIN = 3
const AUTO_COLLECTION_COUNT_ABSOLUTE_MAX = 50

const AI_ANALYSIS_MAX_RETRIES_MIN = 1
const AI_ANALYSIS_MAX_RETRIES_MAX = 20
const AI_ANALYSIS_MAX_RETRIES_DEFAULT = 5

const AI_VISION_LONG_EDGE_MIN = 1024
const AI_VISION_LONG_EDGE_MAX = 4096
const AI_VISION_PREPROCESS_MIN_MB_MAX = 20
const AI_VISION_JPEG_QUALITY_MIN = 75
const AI_VISION_JPEG_QUALITY_MAX = 95

const timeoutSeconds = computed({
  get() {
    const sec = Math.round(Number(aiForm.timeout || 0) / 1000)
    if (!sec) return AI_TIMEOUT_DEFAULT_SEC
    return Math.min(AI_TIMEOUT_MAX_SEC, Math.max(AI_TIMEOUT_MIN_SEC, sec))
  },
  set(value) {
    const sec = Math.min(AI_TIMEOUT_MAX_SEC, Math.max(AI_TIMEOUT_MIN_SEC, Number(value) || 0))
    aiForm.timeout = sec * 1000
  }
})

const aiSnapshot = () => ({ ...toRaw(aiForm) })

const onScoreMinFilterChange = () => {
  onAiFormChange()
}

const onAnalysisMaxRetriesChange = () => {
  onAiFormChange()
}

const ensureAiFields = () => {
  if (!aiForm.visionApiKey) aiForm.visionApiKey = aiForm.apiKey || ''
  if (!aiForm.textApiKey) aiForm.textApiKey = aiForm.apiKey || ''
  if (!aiForm.remoteAppTitle) aiForm.remoteAppTitle = 'Flying Bird Wallpaper'
  if (aiForm.autoCollectionsEnabled === undefined) aiForm.autoCollectionsEnabled = true
  if (aiForm.autoCollectionsMaxCount == null || aiForm.autoCollectionsMaxCount === '') {
    aiForm.autoCollectionsMaxCount = 20
  }
  if (aiForm.scoreMinFilter == null || aiForm.scoreMinFilter === '') {
    aiForm.scoreMinFilter = 70
  }
  if (aiForm.analysisMaxRetries == null || aiForm.analysisMaxRetries === '') {
    aiForm.analysisMaxRetries = AI_ANALYSIS_MAX_RETRIES_DEFAULT
  }
  if (!aiForm.timeout || aiForm.timeout < AI_TIMEOUT_MIN_SEC * 1000) {
    aiForm.timeout = AI_TIMEOUT_DEFAULT_SEC * 1000
  }
  if (aiForm.visionPreprocess === undefined) aiForm.visionPreprocess = true
  if (aiForm.visionMaxLongEdge == null) aiForm.visionMaxLongEdge = 2048
  if (aiForm.visionPreprocessMinSizeMB == null) aiForm.visionPreprocessMinSizeMB = 1.5
  if (aiForm.visionJpegQuality == null) aiForm.visionJpegQuality = 88
}

const syncAiFormFromStore = () => {
  const ai = settingData.value?.ai
  if (!ai) return
  Object.keys(ai).forEach((key) => {
    aiForm[key] = ai[key]
  })
  ensureAiFields()
  visionPresetPrev.value = aiForm.visionPreset || 'ollama'
  textPresetPrev.value = aiForm.textPreset || 'ollama'
}

const onAiFormChange = async () => {
  ensureAiFields()
  if (flags.saving) return
  flags.saving = true
  try {
    const res = await window.FBW.updateSettingData({ ai: { ...toRaw(aiForm) } })
    if (res?.success) {
      settingStore.updateSettingData(res.data)
      ElMessage({
        type: 'success',
        message: t('pages.Setting.aiSetting.saveSuccess')
      })
    } else {
      ElMessage({
        type: 'error',
        message: res?.message || t('pages.Setting.aiSetting.saveFail')
      })
    }
  } catch {
    ElMessage({
      type: 'error',
      message: t('pages.Setting.aiSetting.saveFail')
    })
  } finally {
    flags.saving = false
  }
}

const fetchModels = async (kind, purpose, targetRef, loadingRef, silent = false) => {
  ensureAiFields()
  loadingRef.value = true
  try {
    const res = await window.FBW.listAiModels({
      kind,
      purpose,
      ai: aiSnapshot()
    })
    if (res.success) {
      targetRef.value = res.data || []
      if (!silent) {
        if (targetRef.value.length) {
          const purposeLabelKey =
            purpose === 'vision'
              ? 'pages.Setting.aiSetting.purposeVision'
              : purpose === 'embed'
                ? 'pages.Setting.aiSetting.purposeEmbed'
                : 'pages.Setting.aiSetting.purposeText'
          ElMessage.success(
            t('pages.Setting.aiSetting.listModelsSuccess', {
              purpose: t(purposeLabelKey),
              count: targetRef.value.length
            })
          )
        } else {
          const emptyKey =
            purpose === 'vision'
              ? 'pages.Setting.aiSetting.listEmptyVision'
              : purpose === 'embed'
                ? 'pages.Setting.aiSetting.listEmptyEmbed'
                : 'pages.Setting.aiSetting.listEmptyText'
          ElMessage.warning(t(emptyKey))
        }
      }
      return true
    }
    if (!silent) {
      ElMessage.error(resolveAiUserMessage(res, t) || t('pages.Setting.aiSetting.listModelsFail'))
    }
    return false
  } finally {
    loadingRef.value = false
  }
}

const refreshVisionModels = (silent = false) =>
  fetchModels('vision', 'vision', visionModels, loadingVisionModels, silent)

const refreshTextModels = async (silent = false, scope = 'all') => {
  if (scope === 'text') {
    return fetchModels('text', 'text', textModels, loadingTextModels, silent)
  }
  if (scope === 'embed') {
    return fetchModels('text', 'embed', embedModels, loadingEmbedModels, silent)
  }
  await fetchModels('text', 'text', textModels, loadingTextModels, silent)
  await fetchModels('text', 'embed', embedModels, loadingEmbedModels, silent)
}

const copyApiKey = (value) => {
  const text = String(value || '').trim()
  if (!text) {
    ElMessage.warning(t('pages.Setting.aiSetting.errors.apiKeyMissing'))
    return
  }
  clipboard
    .write(text)
    .then(() => {
      ElMessage.success(t('messages.copySuccess'))
    })
    .catch(() => {
      ElMessage.error(t('messages.copyFail'))
    })
}

const onVisionPresetChange = async () => {
  applyServicePreset(aiForm, 'vision', { previousPresetId: visionPresetPrev.value })
  visionPresetPrev.value = aiForm.visionPreset
  await onAiFormChange()
  await refreshVisionModels(true)
}

const onTextPresetChange = async () => {
  applyServicePreset(aiForm, 'text', { previousPresetId: textPresetPrev.value })
  textPresetPrev.value = aiForm.textPreset
  await onAiFormChange()
  await refreshTextModels(true)
}

const onTestVision = async () => {
  testingVision.value = true
  testVisionResult.value = null
  ensureAiFields()
  try {
    const res = await window.FBW.testAiConnection({ type: 'vision', ai: aiSnapshot() })
    testVisionResult.value = {
      success: res.success,
      message: res.success
        ? t('pages.Setting.aiSetting.testOk')
        : resolveAiUserMessage(res, t)
    }
  } finally {
    testingVision.value = false
  }
}

const onTestText = async () => {
  testingText.value = true
  testTextResult.value = null
  ensureAiFields()
  try {
    const textRes = await window.FBW.testAiConnection({ type: 'text', ai: aiSnapshot() })
    if (!textRes.success) {
      testTextResult.value = {
        success: false,
        message: resolveAiUserMessage(textRes, t)
      }
      return
    }
    const embedRes = await window.FBW.testAiConnection({ type: 'embed', ai: aiSnapshot() })
    testTextResult.value = {
      success: embedRes.success,
      message: embedRes.success
        ? t('pages.Setting.aiSetting.testOkWithEmbed')
        : resolveAiUserMessage(embedRes, t)
    }
  } finally {
    testingText.value = false
  }
}

const resetForm = () => {
  syncAiFormFromStore()
  testVisionResult.value = null
  testTextResult.value = null
  visionModels.value = []
  textModels.value = []
  embedModels.value = []
}

watch(
  () => settingData.value?.ai,
  () => syncAiFormFromStore(),
  { deep: true }
)

watch(
  () => [aiForm.enabled, aiForm.analysisMode],
  () => startStatsPolling()
)

onMounted(async () => {
  syncAiFormFromStore()
  await Promise.all([refreshVisionModels(true), refreshTextModels(true)])
  startStatsPolling()
})

onUnmounted(() => stopStatsPolling())

defineExpose({ resetForm, restoreAnchorScroll })
</script>

<template>
  <div class="base-settings-wrapper">
    <aside class="ai-anchor-sidebar">
      <el-anchor
        class="anchor-block ai-sidebar-card ai-anchor-sidebar__nav"
        :container="anchorContainer"
        direction="vertical"
        :offset="20"
        type="default"
        @change="onAnchorChange"
      >
        <el-anchor-link
          class="anchor-link"
          href="#divider-ai-base"
          :title="t('pages.Setting.aiSetting.sectionBase')"
        />
        <el-anchor-link
          class="anchor-link"
          href="#divider-ai-vision"
          :title="t('pages.Setting.aiSetting.visionSection')"
        />
        <el-anchor-link
          class="anchor-link"
          href="#divider-ai-text"
          :title="t('pages.Setting.aiSetting.textSection')"
        />
        <el-anchor-link
          class="anchor-link"
          href="#divider-ai-features"
          :title="t('pages.Setting.aiSetting.sectionFeatures')"
        />
      </el-anchor>
      <AiAnalysisDashboardPanel
        v-if="showAnalysisProgress"
        :loading="loadingAnalysisStats && !analysisStats"
        :stats="analysisStats"
        :percent="analysisProgressPercent"
        :status-label="analysisStatusLabel"
        :status-tooltip="analysisStatusTooltip"
        :status-tag-type="analysisStatusTagType"
        :summary="analysisProgressSummary"
        :footer-hint="analysisFooterHint"
        :running="!!analysisStats?.running"
      />
    </aside>

    <el-scrollbar ref="aiSettingsScrollbarRef" style="height: 100%; flex: 1">
      <el-form :model="aiForm" label-width="auto" label-position="right" class="ai-setting-form">
        <div class="form-card">
          <div id="divider-ai-base" class="divider">
            {{ t('pages.Setting.aiSetting.sectionBase') }}
          </div>
          <el-form-item :label="t('pages.Setting.aiSetting.enabled')">
            <el-switch v-model="aiForm.enabled" @change="onAiFormChange" />
          </el-form-item>
          <el-form-item class="ai-form-item-labeled">
            <template #label>
              <span class="form-item-label-with-tip">
                <span class="form-item-label-with-tip__text">{{
                  t('pages.Setting.aiSetting.analysisMode')
                }}</span>
                <el-tooltip
                  :content="t('pages.Setting.aiSetting.analysisModeHint')"
                  placement="top"
                  :show-after="300"
                  popper-class="ai-setting-feature-tip"
                >
                  <span
                    class="form-item-tip-trigger"
                    tabindex="0"
                    role="button"
                    :aria-label="t('pages.Setting.aiSetting.analysisModeHint')"
                    @click.stop
                  >
                    <IconifyIcon icon="custom:info-outline-rounded" />
                  </span>
                </el-tooltip>
              </span>
            </template>
            <div class="ai-form-control-row">
              <el-select
                v-model="aiForm.analysisMode"
                style="width: 290px"
                @change="onAiFormChange"
              >
                <el-option
                  v-for="item in analysisModeOptions"
                  :key="item.value"
                  :label="item.label"
                  :value="item.value"
                />
              </el-select>
            </div>
          </el-form-item>
          <el-form-item v-if="showBackgroundRetrySetting" class="ai-form-item-labeled">
            <template #label>
              <span class="form-item-label-with-tip">
                <span class="form-item-label-with-tip__text">{{
                  t('pages.Setting.aiSetting.analysisMaxRetries')
                }}</span>
                <el-tooltip
                  :content="t('pages.Setting.aiSetting.analysisMaxRetriesHint')"
                  placement="top"
                  :show-after="300"
                  popper-class="ai-setting-feature-tip"
                >
                  <span
                    class="form-item-tip-trigger"
                    tabindex="0"
                    role="button"
                    :aria-label="t('pages.Setting.aiSetting.analysisMaxRetriesHint')"
                    @click.stop
                  >
                    <IconifyIcon icon="custom:info-outline-rounded" />
                  </span>
                </el-tooltip>
              </span>
            </template>
            <div class="ai-form-control-row">
              <el-input-number
                v-model="aiForm.analysisMaxRetries"
                :min="AI_ANALYSIS_MAX_RETRIES_MIN"
                :max="AI_ANALYSIS_MAX_RETRIES_MAX"
                :step="1"
                style="width: 290px"
                @change="onAnalysisMaxRetriesChange"
              />
            </div>
          </el-form-item>
          <el-form-item class="ai-form-item-labeled">
            <template #label>
              <span class="form-item-label-with-tip">
                <span class="form-item-label-with-tip__text">{{
                  t('pages.Setting.aiSetting.requestTimeout')
                }}</span>
                <el-tooltip
                  :content="t('pages.Setting.aiSetting.requestTimeoutHint')"
                  placement="top"
                  :show-after="300"
                  popper-class="ai-setting-feature-tip"
                >
                  <span
                    class="form-item-tip-trigger"
                    tabindex="0"
                    role="button"
                    :aria-label="t('pages.Setting.aiSetting.requestTimeoutHint')"
                    @click.stop
                  >
                    <IconifyIcon icon="custom:info-outline-rounded" />
                  </span>
                </el-tooltip>
              </span>
            </template>
            <div class="ai-form-control-row">
              <el-input-number
                v-model="timeoutSeconds"
                :min="AI_TIMEOUT_MIN_SEC"
                :max="AI_TIMEOUT_MAX_SEC"
                :step="30"
                style="width: 290px"
                @change="onAiFormChange"
              />
              <span class="timeout-unit">{{ t('pages.Setting.aiSetting.requestTimeoutUnit') }}</span>
            </div>
          </el-form-item>
          <div id="divider-ai-vision-input" class="ai-form-section-divider">
            {{ t('pages.Setting.aiSetting.visionInputSection') }}
          </div>
          <el-form-item class="ai-form-item-labeled">
            <template #label>
              <span class="form-item-label-with-tip">
                <span class="form-item-label-with-tip__text">{{
                  t('pages.Setting.aiSetting.visionPreprocess')
                }}</span>
                <el-tooltip
                  :content="t('pages.Setting.aiSetting.visionPreprocessHint')"
                  placement="top"
                  :show-after="300"
                  popper-class="ai-setting-feature-tip"
                >
                  <span
                    class="form-item-tip-trigger"
                    tabindex="0"
                    role="button"
                    :aria-label="t('pages.Setting.aiSetting.visionPreprocessHint')"
                    @click.stop
                  >
                    <IconifyIcon icon="custom:info-outline-rounded" />
                  </span>
                </el-tooltip>
              </span>
            </template>
            <el-switch v-model="aiForm.visionPreprocess" @change="onAiFormChange" />
          </el-form-item>
          <el-form-item v-if="aiForm.visionPreprocess" class="ai-form-item-labeled">
            <template #label>
              <span class="form-item-label-with-tip">
                <span class="form-item-label-with-tip__text">{{
                  t('pages.Setting.aiSetting.visionMaxLongEdge')
                }}</span>
                <el-tooltip
                  :content="t('pages.Setting.aiSetting.visionMaxLongEdgeHint')"
                  placement="top"
                  :show-after="300"
                  popper-class="ai-setting-feature-tip"
                >
                  <span
                    class="form-item-tip-trigger"
                    tabindex="0"
                    role="button"
                    :aria-label="t('pages.Setting.aiSetting.visionMaxLongEdgeHint')"
                    @click.stop
                  >
                    <IconifyIcon icon="custom:info-outline-rounded" />
                  </span>
                </el-tooltip>
              </span>
            </template>
            <div class="ai-form-control-row">
              <el-input-number
                v-model="aiForm.visionMaxLongEdge"
                :min="AI_VISION_LONG_EDGE_MIN"
                :max="AI_VISION_LONG_EDGE_MAX"
                :step="256"
                style="width: 290px"
                @change="onAiFormChange"
              />
              <span class="timeout-unit">px</span>
            </div>
          </el-form-item>
          <el-form-item v-if="aiForm.visionPreprocess" class="ai-form-item-labeled">
            <template #label>
              <span class="form-item-label-with-tip">
                <span class="form-item-label-with-tip__text">{{
                  t('pages.Setting.aiSetting.visionPreprocessMinSizeMB')
                }}</span>
                <el-tooltip
                  :content="t('pages.Setting.aiSetting.visionPreprocessMinSizeMBHint')"
                  placement="top"
                  :show-after="300"
                  popper-class="ai-setting-feature-tip"
                >
                  <span
                    class="form-item-tip-trigger"
                    tabindex="0"
                    role="button"
                    :aria-label="t('pages.Setting.aiSetting.visionPreprocessMinSizeMBHint')"
                    @click.stop
                  >
                    <IconifyIcon icon="custom:info-outline-rounded" />
                  </span>
                </el-tooltip>
              </span>
            </template>
            <div class="ai-form-control-row">
              <el-input-number
                v-model="aiForm.visionPreprocessMinSizeMB"
                :min="0"
                :max="AI_VISION_PREPROCESS_MIN_MB_MAX"
                :step="0.5"
                :precision="1"
                style="width: 290px"
                @change="onAiFormChange"
              />
              <span class="timeout-unit">MB</span>
            </div>
          </el-form-item>
          <el-form-item v-if="aiForm.visionPreprocess" class="ai-form-item-labeled">
            <template #label>
              <span class="form-item-label-with-tip">
                <span class="form-item-label-with-tip__text">{{
                  t('pages.Setting.aiSetting.visionJpegQuality')
                }}</span>
                <el-tooltip
                  :content="t('pages.Setting.aiSetting.visionJpegQualityHint')"
                  placement="top"
                  :show-after="300"
                  popper-class="ai-setting-feature-tip"
                >
                  <span
                    class="form-item-tip-trigger"
                    tabindex="0"
                    role="button"
                    :aria-label="t('pages.Setting.aiSetting.visionJpegQualityHint')"
                    @click.stop
                  >
                    <IconifyIcon icon="custom:info-outline-rounded" />
                  </span>
                </el-tooltip>
              </span>
            </template>
            <div class="ai-form-control-row">
              <el-input-number
                v-model="aiForm.visionJpegQuality"
                :min="AI_VISION_JPEG_QUALITY_MIN"
                :max="AI_VISION_JPEG_QUALITY_MAX"
                :step="1"
                style="width: 290px"
                @change="onAiFormChange"
              />
            </div>
          </el-form-item>
        </div>

        <div class="form-card">
          <div id="divider-ai-vision" class="divider">
            {{ t('pages.Setting.aiSetting.visionSection') }}
          </div>
          <el-form-item :label="t('pages.Setting.aiSetting.serviceProvider')">
            <div class="vision-provider-block">
              <el-select
                v-model="aiForm.visionPreset"
                style="width: 290px"
                @change="onVisionPresetChange"
              >
                <el-option
                  v-for="item in presetOptions"
                  :key="item.value"
                  :label="item.label"
                  :value="item.value"
                />
              </el-select>
              <div v-if="showRemoteVisionPrivacyNote" class="field-hint">
                {{ t('pages.Setting.aiSetting.remoteVisionPrivacyNote') }}
              </div>
            </div>
          </el-form-item>
          <el-form-item :label="t('pages.Setting.aiSetting.visionBaseUrl')">
            <el-input
              v-model="aiForm.visionBaseUrl"
              style="width: 290px"
              :placeholder="visionBaseUrlPlaceholder"
              @change="onAiFormChange"
            />
          </el-form-item>
          <el-form-item v-if="visionRequiresApiKey" :label="t('pages.Setting.aiSetting.apiKey')">
            <div class="api-key-row">
              <el-input
                v-model="aiForm.visionApiKey"
                type="password"
                show-password
                class="api-key-row__input"
                :placeholder="t('pages.Setting.aiSetting.apiKeyPlaceholder')"
                @change="onAiFormChange"
              />
              <el-button @click="copyApiKey(aiForm.visionApiKey)">
                {{ t('pages.Setting.aiSetting.copyApiKey') }}
              </el-button>
            </div>
          </el-form-item>
          <el-form-item :label="t('pages.Setting.aiSetting.visionModel')">
            <div class="model-row">
              <el-select
                v-model="aiForm.visionModel"
                filterable
                allow-create
                default-first-option
                style="width: 290px"
                :placeholder="t('pages.Setting.aiSetting.modelPlaceholder')"
                @change="onAiFormChange"
              >
                <el-option v-for="item in visionModels" :key="item" :label="item" :value="item" />
              </el-select>
              <el-button :loading="loadingVisionModels" @click="refreshVisionModels()">
                {{ t('pages.Setting.aiSetting.refreshModels') }}
              </el-button>
            </div>
            <div v-if="visionModelHintKey" class="field-hint">
              {{ t(visionModelHintKey) }}
            </div>
          </el-form-item>
          <el-form-item label=" ">
            <el-button :loading="testingVision" @click="onTestVision">
              {{ t('pages.Setting.aiSetting.testVision') }}
            </el-button>
            <el-text
              v-if="testVisionResult"
              class="test-result"
              :type="testVisionResult.success ? 'success' : 'danger'"
            >
              {{ testVisionResult.message }}
            </el-text>
          </el-form-item>
        </div>

        <div class="form-card">
          <div id="divider-ai-text" class="divider">
            {{ t('pages.Setting.aiSetting.textSection') }}
          </div>
          <el-form-item :label="t('pages.Setting.aiSetting.serviceProvider')">
            <el-select
              v-model="aiForm.textPreset"
              style="width: 290px"
              @change="onTextPresetChange"
            >
              <el-option
                v-for="item in presetOptions"
                :key="item.value"
                :label="item.label"
                :value="item.value"
              />
            </el-select>
          </el-form-item>
          <el-form-item :label="t('pages.Setting.aiSetting.textBaseUrl')">
            <el-input
              v-model="aiForm.textBaseUrl"
              style="width: 290px"
              :placeholder="textBaseUrlPlaceholder"
              @change="onAiFormChange"
            />
          </el-form-item>
          <el-form-item v-if="textRequiresApiKey" :label="t('pages.Setting.aiSetting.apiKey')">
            <div class="api-key-row">
              <el-input
                v-model="aiForm.textApiKey"
                type="password"
                show-password
                class="api-key-row__input"
                :placeholder="t('pages.Setting.aiSetting.apiKeyPlaceholder')"
                @change="onAiFormChange"
              />
              <el-button @click="copyApiKey(aiForm.textApiKey)">
                {{ t('pages.Setting.aiSetting.copyApiKey') }}
              </el-button>
            </div>
          </el-form-item>
          <el-form-item :label="t('pages.Setting.aiSetting.textModel')">
            <div class="model-row">
              <el-select
                v-model="aiForm.textModel"
                filterable
                allow-create
                default-first-option
                style="width: 290px"
                :placeholder="t('pages.Setting.aiSetting.modelPlaceholder')"
                @change="onAiFormChange"
              >
                <el-option v-for="item in textModels" :key="item" :label="item" :value="item" />
              </el-select>
              <el-button :loading="loadingTextModels" @click="refreshTextModels(false, 'text')">
                {{ t('pages.Setting.aiSetting.refreshModels') }}
              </el-button>
            </div>
            <div v-if="textModelHintKey" class="field-hint">
              {{ t(textModelHintKey) }}
            </div>
          </el-form-item>
          <el-form-item :label="t('pages.Setting.aiSetting.embeddingModel')">
            <div class="model-row">
              <el-select
                v-model="aiForm.embeddingModel"
                filterable
                allow-create
                default-first-option
                style="width: 290px"
                :placeholder="t('pages.Setting.aiSetting.modelPlaceholder')"
                @change="onAiFormChange"
              >
                <el-option v-for="item in embedModels" :key="item" :label="item" :value="item" />
              </el-select>
              <el-button :loading="loadingEmbedModels" @click="refreshTextModels(false, 'embed')">
                {{ t('pages.Setting.aiSetting.refreshModels') }}
              </el-button>
            </div>
          </el-form-item>
          <el-form-item label=" ">
            <el-button :loading="testingText" @click="onTestText">
              {{ t('pages.Setting.aiSetting.testText') }}
            </el-button>
            <el-text
              v-if="testTextResult"
              class="test-result"
              :type="testTextResult.success ? 'success' : 'danger'"
            >
              {{ testTextResult.message }}
            </el-text>
          </el-form-item>

          <template v-if="showOpenRouterFields">
            <el-form-item :label="t('pages.Setting.aiSetting.remoteReferer')">
              <el-input
                v-model="aiForm.remoteReferer"
                style="width: 290px"
                :placeholder="t('pages.Setting.aiSetting.remoteRefererPlaceholder')"
                @change="onAiFormChange"
              />
            </el-form-item>
            <el-form-item :label="t('pages.Setting.aiSetting.remoteAppTitle')">
              <el-input
                v-model="aiForm.remoteAppTitle"
                style="width: 290px"
                @change="onAiFormChange"
              />
            </el-form-item>
          </template>
        </div>

        <div class="form-card">
          <div id="divider-ai-features" class="divider">
            {{ t('pages.Setting.aiSetting.sectionFeatures') }}
          </div>

          <el-form-item class="ai-form-item-labeled">
            <template #label>
              <span class="form-item-label-with-tip">
                <span class="form-item-label-with-tip__text">{{
                  t('pages.Setting.aiSetting.autoCollectionsEnabled')
                }}</span>
                <el-tooltip
                  :content="t('pages.Setting.aiSetting.autoCollectionsEnabledHint')"
                  placement="top"
                  :show-after="300"
                  popper-class="ai-setting-feature-tip"
                >
                  <span
                    class="form-item-tip-trigger"
                    tabindex="0"
                    role="button"
                    :aria-label="t('pages.Setting.aiSetting.autoCollectionsEnabledHint')"
                    @click.stop
                  >
                    <IconifyIcon icon="custom:info-outline-rounded" />
                  </span>
                </el-tooltip>
              </span>
            </template>
            <el-switch
              v-model="aiForm.autoCollectionsEnabled"
              :disabled="!aiForm.enabled"
              @change="onAiFormChange"
            />
          </el-form-item>

          <div v-if="aiForm.enabled" class="ai-curate-sub-options">
            <el-form-item
              v-if="aiForm.autoCollectionsEnabled !== false"
              class="ai-form-item-labeled"
            >
              <template #label>
                <span class="form-item-label-with-tip">
                  <span class="form-item-label-with-tip__text">{{
                    t('pages.Setting.aiSetting.autoCollectionsMaxCount')
                  }}</span>
                  <el-tooltip
                    :content="t('pages.Setting.aiSetting.autoCollectionsMaxCountHint')"
                    placement="top"
                    :show-after="300"
                    popper-class="ai-setting-feature-tip"
                  >
                    <span
                      class="form-item-tip-trigger"
                      tabindex="0"
                      role="button"
                      :aria-label="t('pages.Setting.aiSetting.autoCollectionsMaxCountHint')"
                      @click.stop
                    >
                      <IconifyIcon icon="custom:info-outline-rounded" />
                    </span>
                  </el-tooltip>
                </span>
              </template>
              <div class="ai-form-control-row">
                <el-input-number
                  v-model="aiForm.autoCollectionsMaxCount"
                  :min="AUTO_COLLECTION_COUNT_MIN"
                  :max="AUTO_COLLECTION_COUNT_ABSOLUTE_MAX"
                  :step="1"
                  :disabled="!aiForm.enabled"
                  controls-position="right"
                  @change="onAiFormChange"
                />
              </div>
            </el-form-item>

            <el-form-item class="ai-form-item-labeled">
              <template #label>
                <span class="form-item-label-with-tip">
                  <span class="form-item-label-with-tip__text">{{
                    t('pages.Setting.aiSetting.scoreMinFilter')
                  }}</span>
                  <el-tooltip
                    :content="t('pages.Setting.aiSetting.scoreMinFilterHint')"
                    placement="top"
                    :show-after="300"
                    popper-class="ai-setting-feature-tip"
                  >
                    <span
                      class="form-item-tip-trigger"
                      tabindex="0"
                      role="button"
                      :aria-label="t('pages.Setting.aiSetting.scoreMinFilterHint')"
                      @click.stop
                    >
                      <IconifyIcon icon="custom:info-outline-rounded" />
                    </span>
                  </el-tooltip>
                </span>
              </template>
              <div class="ai-form-control-row ai-form-control-row--score-min">
                <el-input-number
                  v-model="aiForm.scoreMinFilter"
                  :min="0"
                  :max="100"
                  :step="1"
                  :disabled="!aiForm.enabled"
                  controls-position="right"
                  @change="onScoreMinFilterChange"
                />
              </div>
            </el-form-item>
          </div>

          <el-form-item
            v-for="item in featureSwitches"
            :key="item.key"
            class="ai-form-item-labeled"
          >
            <template #label>
              <span class="form-item-label-with-tip">
                <span class="form-item-label-with-tip__text">{{ t(item.labelKey) }}</span>
                <el-tooltip
                  :content="t(item.hintKey)"
                  placement="top"
                  :show-after="300"
                  popper-class="ai-setting-feature-tip"
                >
                  <span
                    class="form-item-tip-trigger"
                    tabindex="0"
                    role="button"
                    :aria-label="t(item.hintKey)"
                    @click.stop
                  >
                    <IconifyIcon icon="custom:info-outline-rounded" />
                  </span>
                </el-tooltip>
              </span>
            </template>
            <el-switch
              v-model="aiForm[item.key]"
              :disabled="!aiForm.enabled"
              @change="onAiFormChange"
            />
          </el-form-item>
        </div>
      </el-form>
    </el-scrollbar>
  </div>
</template>

<style scoped lang="scss">
.base-settings-wrapper {
  display: flex;
  flex-direction: row;
  justify-content: space-between;
  align-items: stretch;
  gap: 20px;
  height: calc(100vh - 110px);
  overflow: hidden;
}

.ai-anchor-sidebar {
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
  width: 200px;
  min-width: 200px;
  height: 100%;
  min-height: 0;
  gap: 10px;

  &__nav {
    flex: 1 1 auto;
    min-height: 0;
    height: auto !important;
    width: 100% !important;
    overflow: auto;
    padding: 14px 16px;
  }
}

.ai-sidebar-card {
  box-sizing: border-box;
  width: 100%;
  padding: 14px 16px;
  border-radius: 6px;
  border: 1px solid var(--el-border-color-lighter);
  background-color: #ffffff;
  box-shadow: none;
}

.model-row {
  display: flex;
  gap: 8px;
  align-items: center;
  flex-wrap: wrap;
}

.api-key-row {
  display: flex;
  gap: 8px;
  align-items: center;
  flex-wrap: wrap;
  width: 100%;
  max-width: 360px;

  &__input {
    flex: 1;
    min-width: 200px;
    max-width: 290px;
  }
}

.ai-setting-form {
  :deep(.el-form-item) {
    align-items: center;
    margin-bottom: 18px;
  }

  :deep(.el-form-item__label) {
    display: inline-flex;
    align-items: center;
    justify-content: flex-end;
    height: 32px;
    line-height: 32px;
    padding-right: 12px;
    white-space: nowrap;
  }

  :deep(.el-form-item__content) {
    display: flex;
    align-items: center;
    min-height: 32px;
    line-height: 32px;
  }
}

.ai-form-control-row {
  display: inline-flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0;
  min-height: 32px;

  &--score-min {
    gap: 8px;
  }
}

.ai-curate-sub-options {
  margin: 4px 0 12px;
  padding: 0;
}

.ai-form-section-divider {
  margin: 12px 0 14px;
  padding-top: 10px;
  border-top: 1px solid var(--el-border-color-lighter);
  font-size: 14px;
  font-weight: 600;
  line-height: 1.4;
  color: var(--el-text-color-primary);
}

.form-item-label-with-tip {
  display: inline-flex;
  align-items: center;
  justify-content: flex-end;
  flex-wrap: nowrap;
  gap: 6px;
  white-space: nowrap;

  &__text {
    line-height: 1.4;
    white-space: nowrap;
  }
}

.form-item-tip-trigger {
  display: inline-flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  font-size: 16px;
  color: var(--el-text-color-secondary);
  cursor: help;
  outline: none;

  &:hover,
  &:focus-visible {
    color: var(--el-color-primary);
  }
}

.vision-provider-block {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  max-width: 360px;
}

.field-hint {
  margin-top: 6px;
  color: var(--el-text-color-secondary);
  font-size: 12px;
  line-height: 1.5;
}

.timeout-unit {
  display: inline-flex;
  align-items: center;
  height: 32px;
  margin-left: 8px;
  color: var(--el-text-color-secondary);
  font-size: 13px;
  line-height: 1;
}

.test-result {
  display: inline-block;
  max-width: min(520px, 100%);
  margin-left: 12px;
  font-size: 13px;
  line-height: 1.5;
  vertical-align: top;
  word-break: break-word;
}

</style>

<style lang="scss">
.ai-setting-feature-tip {
  max-width: min(320px, 90vw) !important;
  width: max-content;

  &,
  .el-tooltip__content {
    line-height: 1.5;
    white-space: normal !important;
    word-break: break-word;
  }
}
</style>
