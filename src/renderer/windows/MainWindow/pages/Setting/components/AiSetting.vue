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
import { useAiAnalysisDashboard } from '../utils/useAiAnalysisDashboard.js'
import clipboard from 'clipboardy'
import AiAnalysisDashboardPanel from './AiAnalysisDashboardPanel.vue'
import SettingFormLabelTip from './SettingFormLabelTip.vue'
import AiIconCopyButton from './AiIconCopyButton.vue'

const props = defineProps({
  tabActive: { type: Boolean, default: true }
})

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
const testingVisualEmbed = ref(false)
const loadingVisionModels = ref(false)
const loadingTextModels = ref(false)
const loadingEmbedModels = ref(false)
const loadingVisualEmbedModels = ref(false)
const testVisionResult = ref(null)
const testTextResult = ref(null)
const testVisualEmbedResult = ref(null)
const visionModels = ref([])
const textModels = ref([])
const embedModels = ref([])
const visualEmbedModels = ref([])

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

/** AI 功能开关分组 */
const featureSwitchGroups = [
  {
    anchorId: 'divider-ai-features-search',
    titleKey: 'pages.Setting.aiSetting.sectionFeaturesSearch',
    items: [
      {
        key: 'expandDownloadKeywords',
        labelKey: 'pages.Setting.aiSetting.expandDownloadKeywords',
        hintKey: 'pages.Setting.aiSetting.expandDownloadKeywordsHint'
      }
    ]
  },
  {
    anchorId: 'divider-ai-features-legacy',
    titleKey: 'pages.Setting.aiSetting.sectionFeaturesLegacy',
    items: [
      {
        key: 'legacyOnnxScore',
        labelKey: 'pages.Setting.aiSetting.legacyOnnxScore',
        hintKey: 'pages.Setting.aiSetting.legacyOnnxScoreHint'
      },
      {
        key: 'legacyJiebaTags',
        labelKey: 'pages.Setting.aiSetting.legacyJiebaTags',
        hintKey: 'pages.Setting.aiSetting.legacyJiebaTagsHint'
      },
      {
        toggleField: 'visualEmbedSource',
        toggleOn: 'builtin',
        toggleOff: 'remote',
        labelKey: 'pages.Setting.aiSetting.legacyLocalVisualEmbed',
        hintKey: 'pages.Setting.aiSetting.legacyLocalVisualEmbedHint',
        changeHandler: 'visualEmbedSource'
      }
    ]
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
const visualEmbedRequiresApiKey = computed(() =>
  presetRequiresApiKey(aiForm.visualEmbedPreset, aiForm.visualEmbedBaseUrl)
)
const showRemoteVisualEmbedPrivacyNote = computed(() => visualEmbedRequiresApiKey.value)

const localModelHintKey = (presetId) => {
  if (!isLocalPreset(presetId)) return ''
  if (presetId === 'ollama') return 'pages.Setting.aiSetting.ollamaModelHint'
  return `pages.Setting.aiSetting.presetHints.${presetId}`
}
const visionModelHintKey = computed(() => localModelHintKey(aiForm.visionPreset))
const textModelHintKey = computed(() => localModelHintKey(aiForm.textPreset))
const visualEmbedModelHintKey = computed(() => localModelHintKey(aiForm.visualEmbedPreset))

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
const visualEmbedBaseUrlPlaceholder = computed(() => {
  const preset = getPresetById(aiForm.visualEmbedPreset)
  if (preset?.custom) return t('pages.Setting.aiSetting.customBaseUrlPlaceholder')
  return preset?.baseUrl || t('pages.Setting.aiSetting.customBaseUrlPlaceholder')
})

const visionPresetPrev = ref(aiForm.visionPreset || 'ollama')
const textPresetPrev = ref(aiForm.textPreset || 'ollama')
const visualEmbedPresetPrev = ref(aiForm.visualEmbedPreset || 'ollama')

const showOpenRouterFields = computed(
  () =>
    aiForm.visionPreset === 'openrouter' ||
    aiForm.textPreset === 'openrouter' ||
    aiForm.visualEmbedPreset === 'openrouter'
)

const {
  analysisStats,
  loadingAnalysisStats,
  showAnalysisProgress,
  analysisProgressPercent,
  analysisStatusLabel,
  analysisStatusTooltip,
  analysisStatusTagType,
  analysisProgressSummary,
  analysisFooterHint,
  analysisSpeedLine,
  analysisSpeedTooltip,
  requeueFailedAiAnalysis
} = useAiAnalysisDashboard(computed(() => aiForm), { tabActive: toRef(props, 'tabActive') })

const AI_TIMEOUT_MIN_SEC = 60
const AI_TIMEOUT_MAX_SEC = 1800
const AI_TIMEOUT_DEFAULT_SEC = 300

const AUTO_COLLECTION_COUNT_MIN = 3
const AUTO_COLLECTION_COUNT_ABSOLUTE_MAX = 100

const AI_ANALYSIS_MAX_RETRIES_DEFAULT = 1
const AI_ANALYSIS_CONCURRENCY_DEFAULT = 1

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
  if (!aiForm.visualEmbedSource) aiForm.visualEmbedSource = 'builtin'
  if (!aiForm.visualEmbedPreset) aiForm.visualEmbedPreset = 'ollama'
  if (!aiForm.visualEmbedProvider) aiForm.visualEmbedProvider = 'ollama'
  if (!aiForm.visualEmbedBaseUrl) aiForm.visualEmbedBaseUrl = 'http://127.0.0.1:11434'
  if (aiForm.visualEmbedApiKey == null) aiForm.visualEmbedApiKey = ''
  if (aiForm.visualEmbedModel == null) aiForm.visualEmbedModel = ''
  if (aiForm.analysisMaxRetries == null || aiForm.analysisMaxRetries === '') {
    aiForm.analysisMaxRetries = AI_ANALYSIS_MAX_RETRIES_DEFAULT
  }
  if (aiForm.concurrency == null || aiForm.concurrency === '') {
    aiForm.concurrency = AI_ANALYSIS_CONCURRENCY_DEFAULT
  } else {
    const c = Math.round(Number(aiForm.concurrency))
    aiForm.concurrency = Number.isFinite(c)
      ? Math.min(10, Math.max(1, c))
      : AI_ANALYSIS_CONCURRENCY_DEFAULT
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
  visualEmbedPresetPrev.value = aiForm.visualEmbedPreset || 'ollama'
}

const onAiFormChange = async () => {
  ensureAiFields()
  if (flags.saving) return
  flags.saving = true
  try {
    const aiPayload = { ...toRaw(aiForm) }
    delete aiPayload.visualEmbedEnabled
    const res = await window.FBW.updateSettingData({ ai: aiPayload })
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
                : purpose === 'visual-embed'
                  ? 'pages.Setting.aiSetting.purposeVisualEmbed'
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
                : purpose === 'visual-embed'
                  ? 'pages.Setting.aiSetting.listEmptyVisualEmbed'
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

const refreshVisualEmbedModels = (silent = false) =>
  fetchModels('visualEmbed', 'visual-embed', visualEmbedModels, loadingVisualEmbedModels, silent)

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

/** 展开模型下拉时静默拉取列表（替代手动刷新按钮） */
const onModelDropdownVisible = (visible, fetchFn, loadingRef) => {
  if (!visible || loadingRef?.value) return
  fetchFn(true)
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

const copyModelName = (value) => {
  const text = String(value || '').trim()
  if (!text) {
    ElMessage.warning(t('pages.Setting.aiSetting.errors.modelNameMissing'))
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

const onVisualEmbedPresetChange = async () => {
  applyServicePreset(aiForm, 'visualEmbed', { previousPresetId: visualEmbedPresetPrev.value })
  visualEmbedPresetPrev.value = aiForm.visualEmbedPreset
  await onAiFormChange()
  await refreshVisualEmbedModels(true)
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
        ? t('pages.Setting.aiSetting.testOk')
        : resolveAiUserMessage(embedRes, t)
    }
  } finally {
    testingText.value = false
  }
}

const onTestVisualEmbed = async () => {
  testingVisualEmbed.value = true
  testVisualEmbedResult.value = null
  ensureAiFields()
  try {
    const res = await window.FBW.testAiConnection({ type: 'visual-embed', ai: aiSnapshot() })
    testVisualEmbedResult.value = {
      success: res.success,
      message: res.success
        ? t('pages.Setting.aiSetting.testOk')
        : resolveAiUserMessage(res, t)
    }
  } finally {
    testingVisualEmbed.value = false
  }
}

const onVisualEmbedSourceChange = async () => {
  await onAiFormChange()
  if (aiForm.visualEmbedSource === 'remote') {
    await refreshVisualEmbedModels(true)
  }
}

const onFeatureToggleChange = async (item, enabled) => {
  if (!item.toggleField) return
  aiForm[item.toggleField] = enabled ? item.toggleOn : item.toggleOff
  if (item.changeHandler === 'visualEmbedSource') {
    await onVisualEmbedSourceChange()
  } else {
    await onAiFormChange()
  }
}

const resetForm = () => {
  syncAiFormFromStore()
  testVisionResult.value = null
  testTextResult.value = null
  visionModels.value = []
  textModels.value = []
  embedModels.value = []
  visualEmbedModels.value = []
}

watch(
  () => settingData.value?.ai,
  () => syncAiFormFromStore(),
  { deep: true }
)

onMounted(async () => {
  syncAiFormFromStore()
  const tasks = [refreshVisionModels(true), refreshTextModels(true)]
  if (aiForm.visualEmbedSource === 'remote') {
    tasks.push(refreshVisualEmbedModels(true))
  }
  await Promise.all(tasks)
})

defineExpose({ resetForm, restoreAnchorScroll })
</script>

<template>
  <div class="base-settings-wrapper">
    <aside class="ai-anchor-sidebar">
      <el-scrollbar class="ai-anchor-sidebar__scroll">
        <el-anchor
          class="anchor-block ai-sidebar-card"
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
        >
          <template #sub-link>
            <el-anchor-link
              class="anchor-sub-link"
              href="#divider-ai-vision-input"
              :title="t('pages.Setting.aiSetting.visionInputSection')"
            />
            <el-anchor-link
              class="anchor-sub-link"
              href="#divider-ai-vision"
              :title="t('pages.Setting.aiSetting.visionSection')"
            />
            <el-anchor-link
              class="anchor-sub-link"
              href="#divider-ai-text"
              :title="t('pages.Setting.aiSetting.textSection')"
            />
            <el-anchor-link
              class="anchor-sub-link"
              href="#divider-ai-visual-embed"
              :title="t('pages.Setting.aiSetting.visualEmbedSection')"
            />
          </template>
        </el-anchor-link>
        <el-anchor-link
          class="anchor-link"
          href="#divider-ai-features"
          :title="t('pages.Setting.aiSetting.sectionFeatures')"
        >
          <template #sub-link>
            <el-anchor-link
              class="anchor-sub-link"
              href="#divider-ai-features-collections"
              :title="t('pages.Setting.aiSetting.sectionFeaturesCollections')"
            />
            <el-anchor-link
              class="anchor-sub-link"
              href="#divider-ai-features-search"
              :title="t('pages.Setting.aiSetting.sectionFeaturesSearch')"
            />
            <el-anchor-link
              class="anchor-sub-link"
              href="#divider-ai-features-legacy"
              :title="t('pages.Setting.aiSetting.sectionFeaturesLegacy')"
            />
          </template>
        </el-anchor-link>
        </el-anchor>
      </el-scrollbar>
      <AiAnalysisDashboardPanel
        :loading="loadingAnalysisStats && !analysisStats"
        :stats="analysisStats"
        :percent="analysisProgressPercent"
        :status-label="analysisStatusLabel"
        :status-tooltip="analysisStatusTooltip"
        :status-tag-type="analysisStatusTagType"
        :summary="analysisProgressSummary"
        :footer-hint="analysisFooterHint"
        :speed-line="analysisSpeedLine"
        :speed-tooltip="analysisSpeedTooltip"
        :running="!!analysisStats?.running"
        @requeue-failed="requeueFailedAiAnalysis"
      />
    </aside>

    <el-scrollbar ref="aiSettingsScrollbarRef" style="height: 100%; flex: 1">
      <el-form :model="aiForm" label-width="auto" label-position="right" class="ai-setting-form">
        <div class="form-card">
          <div id="divider-ai-base" class="divider">
            {{ t('pages.Setting.aiSetting.sectionBase') }}
          </div>
          <el-form-item class="ai-form-item-labeled">
            <template #label>
              <SettingFormLabelTip
                :label="t('pages.Setting.aiSetting.enabled')"
                :hint="t('pages.Setting.aiSetting.enabledHint')"
              />
            </template>
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
          <div id="divider-ai-vision-input" class="divider-sub">
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

          <div id="divider-ai-vision" class="divider-sub">
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
              <AiIconCopyButton @copy="copyApiKey(aiForm.visionApiKey)" />
            </div>
          </el-form-item>
          <el-form-item class="ai-form-item-labeled">
            <template #label>
              <SettingFormLabelTip
                v-if="visionModelHintKey"
                :label="t('pages.Setting.aiSetting.visionModel')"
                :hint="t(visionModelHintKey)"
              />
              <span v-else>{{ t('pages.Setting.aiSetting.visionModel') }}</span>
            </template>
            <div class="model-row">
              <el-select
                v-model="aiForm.visionModel"
                filterable
                allow-create
                default-first-option
                class="model-row__select"
                :loading="loadingVisionModels"
                :placeholder="t('pages.Setting.aiSetting.modelPlaceholder')"
                @visible-change="(v) => onModelDropdownVisible(v, refreshVisionModels, loadingVisionModels)"
                @change="onAiFormChange"
              >
                <el-option v-for="item in visionModels" :key="item" :label="item" :value="item" />
              </el-select>
              <AiIconCopyButton @copy="copyModelName(aiForm.visionModel)" />
            </div>
          </el-form-item>
          <el-form-item label=" ">
            <el-button :loading="testingVision" @click="onTestVision">
              {{ t('pages.Setting.aiSetting.testConnection') }}
            </el-button>
            <el-text
              v-if="testVisionResult"
              class="test-result"
              :type="testVisionResult.success ? 'success' : 'danger'"
            >
              {{ testVisionResult.message }}
            </el-text>
          </el-form-item>

          <div id="divider-ai-text" class="divider-sub">
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
              <AiIconCopyButton @copy="copyApiKey(aiForm.textApiKey)" />
            </div>
          </el-form-item>
          <el-form-item class="ai-form-item-labeled">
            <template #label>
              <SettingFormLabelTip
                v-if="textModelHintKey"
                :label="t('pages.Setting.aiSetting.textModel')"
                :hint="t(textModelHintKey)"
              />
              <span v-else>{{ t('pages.Setting.aiSetting.textModel') }}</span>
            </template>
            <div class="model-row">
              <el-select
                v-model="aiForm.textModel"
                filterable
                allow-create
                default-first-option
                class="model-row__select"
                :loading="loadingTextModels"
                :placeholder="t('pages.Setting.aiSetting.modelPlaceholder')"
                @visible-change="
                  (v) => onModelDropdownVisible(v, () => refreshTextModels(true, 'text'), loadingTextModels)
                "
                @change="onAiFormChange"
              >
                <el-option v-for="item in textModels" :key="item" :label="item" :value="item" />
              </el-select>
              <AiIconCopyButton @copy="copyModelName(aiForm.textModel)" />
            </div>
          </el-form-item>
          <el-form-item class="ai-form-item-labeled">
            <template #label>
              <SettingFormLabelTip
                :label="t('pages.Setting.aiSetting.embeddingModel')"
                :hint="t('pages.Setting.aiSetting.textEmbedModelHint')"
              />
            </template>
            <div class="model-row">
              <el-select
                v-model="aiForm.embeddingModel"
                filterable
                allow-create
                default-first-option
                class="model-row__select"
                :loading="loadingEmbedModels"
                :placeholder="t('pages.Setting.aiSetting.modelPlaceholder')"
                @visible-change="
                  (v) => onModelDropdownVisible(v, () => refreshTextModels(true, 'embed'), loadingEmbedModels)
                "
                @change="onAiFormChange"
              >
                <el-option v-for="item in embedModels" :key="item" :label="item" :value="item" />
              </el-select>
              <AiIconCopyButton @copy="copyModelName(aiForm.embeddingModel)" />
            </div>
          </el-form-item>
          <el-form-item label=" ">
            <el-button :loading="testingText" @click="onTestText">
              {{ t('pages.Setting.aiSetting.testConnection') }}
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

          <div id="divider-ai-visual-embed" class="divider-sub">
            {{ t('pages.Setting.aiSetting.visualEmbedSection') }}
          </div>
          <el-form-item :label="t('pages.Setting.aiSetting.serviceProvider')">
            <div class="vision-provider-block">
              <el-select
                v-model="aiForm.visualEmbedPreset"
                style="width: 290px"
                @change="onVisualEmbedPresetChange"
              >
                <el-option
                  v-for="item in presetOptions"
                  :key="item.value"
                  :label="item.label"
                  :value="item.value"
                />
              </el-select>
              <div v-if="showRemoteVisualEmbedPrivacyNote" class="field-hint">
                {{ t('pages.Setting.aiSetting.remoteVisionPrivacyNote') }}
              </div>
            </div>
          </el-form-item>
          <el-form-item :label="t('pages.Setting.aiSetting.visualEmbedBaseUrl')">
            <el-input
              v-model="aiForm.visualEmbedBaseUrl"
              style="width: 290px"
              :placeholder="visualEmbedBaseUrlPlaceholder"
              @change="onAiFormChange"
            />
          </el-form-item>
          <el-form-item v-if="visualEmbedRequiresApiKey" :label="t('pages.Setting.aiSetting.apiKey')">
            <div class="api-key-row">
              <el-input
                v-model="aiForm.visualEmbedApiKey"
                type="password"
                show-password
                class="api-key-row__input"
                :placeholder="t('pages.Setting.aiSetting.apiKeyPlaceholder')"
                @change="onAiFormChange"
              />
              <AiIconCopyButton @copy="copyApiKey(aiForm.visualEmbedApiKey)" />
            </div>
          </el-form-item>
          <el-form-item class="ai-form-item-labeled">
            <template #label>
              <SettingFormLabelTip
                v-if="visualEmbedModelHintKey"
                :label="t('pages.Setting.aiSetting.visualEmbedModel')"
                :hint="t(visualEmbedModelHintKey)"
              />
              <span v-else>{{ t('pages.Setting.aiSetting.visualEmbedModel') }}</span>
            </template>
            <div class="model-row">
              <el-select
                v-model="aiForm.visualEmbedModel"
                filterable
                allow-create
                default-first-option
                class="model-row__select"
                :loading="loadingVisualEmbedModels"
                :placeholder="t('pages.Setting.aiSetting.modelPlaceholder')"
                @visible-change="
                  (v) =>
                    onModelDropdownVisible(v, refreshVisualEmbedModels, loadingVisualEmbedModels)
                "
                @change="onAiFormChange"
              >
                <el-option
                  v-for="item in visualEmbedModels"
                  :key="item"
                  :label="item"
                  :value="item"
                />
              </el-select>
              <AiIconCopyButton @copy="copyModelName(aiForm.visualEmbedModel)" />
            </div>
          </el-form-item>
          <el-form-item label=" ">
            <el-button :loading="testingVisualEmbed" @click="onTestVisualEmbed">
              {{ t('pages.Setting.aiSetting.testConnection') }}
            </el-button>
            <el-text
              v-if="testVisualEmbedResult"
              class="test-result"
              :type="testVisualEmbedResult.success ? 'success' : 'danger'"
            >
              {{ testVisualEmbedResult.message }}
            </el-text>
          </el-form-item>
        </div>

        <div class="form-card">
          <div id="divider-ai-features" class="divider">
            {{ t('pages.Setting.aiSetting.sectionFeatures') }}
          </div>

          <div id="divider-ai-features-collections" class="divider-sub">
            {{ t('pages.Setting.aiSetting.sectionFeaturesCollections') }}
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

          <template v-if="aiForm.enabled">
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
                  controls-position="right"
                  @change="onScoreMinFilterChange"
                />
              </div>
            </el-form-item>

            <template v-for="group in featureSwitchGroups" :key="group.titleKey">
              <div :id="group.anchorId" class="divider-sub">
                {{ t(group.titleKey) }}
              </div>
              <el-form-item
                v-for="item in group.items"
                :key="item.key || item.toggleField"
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
                  v-if="item.toggleField"
                  :model-value="aiForm[item.toggleField] === item.toggleOn"
                  @change="(val) => onFeatureToggleChange(item, val)"
                />
                <el-switch v-else v-model="aiForm[item.key]" @change="onAiFormChange" />
              </el-form-item>
            </template>
          </template>
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

  &__scroll {
    flex: 1 1 0;
    min-height: 0;
    align-self: stretch;
    overflow: hidden;

    :deep(.el-scrollbar__wrap) {
      height: 100%;
      overflow-x: hidden;
    }

    :deep(.el-scrollbar__view) {
      min-height: 100%;
      display: flex;
      flex-direction: column;
    }
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
  flex-wrap: nowrap;
  max-width: 100%;

  &__select {
    flex: 0 0 290px;
    width: 290px;
  }
}

.api-key-row {
  display: flex;
  gap: 8px;
  align-items: center;
  flex-wrap: nowrap;
  width: 100%;
  max-width: 360px;

  &__input {
    flex: 1;
    min-width: 200px;
    max-width: 290px;
  }
}

.ai-form-hint-text {
  font-size: 13px;
  line-height: 1.5;
  color: var(--el-text-color-secondary);
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
.ai-anchor-sidebar__scroll .anchor-block {
  flex: 1 1 auto;
  width: 100%;
  min-height: 100%;
  height: auto;
  overflow: visible;
  box-sizing: border-box;

  .anchor-link {
    .el-anchor__link {
      font-size: 14px !important;
      font-weight: bolder !important;
    }
  }

  .anchor-sub-link {
    .el-anchor__link {
      font-size: 14px !important;
      font-weight: normal !important;
    }
  }
}

</style>
