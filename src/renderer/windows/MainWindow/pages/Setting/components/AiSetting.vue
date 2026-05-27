<script setup>
import UseSettingStore from '@renderer/stores/settingStore.js'
import { useTranslation } from 'i18next-vue'
import { storeToRefs } from 'pinia'
import {
  AI_SERVICE_PRESETS,
  applyServicePreset,
  getPresetById,
  isLocalPreset,
  isRemotePreset
} from '@common/aiProviders.js'
import { resolveAiUserMessage } from '@common/aiErrorUtils.js'
import { useSettingAnchorScroll } from '../utils/useSettingAnchorScroll.js'

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

const isRemoteVision = computed(() => isRemotePreset(aiForm.visionPreset))
const isRemoteText = computed(() => isRemotePreset(aiForm.textPreset))
const isVisionCustom = computed(() => getPresetById(aiForm.visionPreset)?.custom)
const isTextCustom = computed(() => getPresetById(aiForm.textPreset)?.custom)
const showOpenRouterFields = computed(
  () => aiForm.visionPreset === 'openrouter' || aiForm.textPreset === 'openrouter'
)

const analysisStats = ref(null)
const loadingAnalysisStats = ref(false)
let statsTimer = null

const showAnalysisProgress = computed(
  () => aiForm.enabled && aiForm.analysisMode && aiForm.analysisMode !== 'off'
)

const analysisProgressPercent = computed(() => {
  const s = analysisStats.value
  if (!s) return 0
  const total = s.total || 0
  if (!total) return s.done > 0 ? 100 : 0
  return Math.min(100, Math.round((s.done / total) * 100))
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

const AI_TIMEOUT_MIN_SEC = 30
const AI_TIMEOUT_MAX_SEC = 600
const AI_TIMEOUT_DEFAULT_SEC = 120

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

const ensureAiFields = () => {
  if (!aiForm.visionApiKey) aiForm.visionApiKey = aiForm.apiKey || ''
  if (!aiForm.textApiKey) aiForm.textApiKey = aiForm.apiKey || ''
  if (!aiForm.remoteAppTitle) aiForm.remoteAppTitle = 'Flying Bird Wallpaper'
  if (aiForm.autoCollectionsEnabled === undefined) aiForm.autoCollectionsEnabled = true
  if (!aiForm.timeout || aiForm.timeout < AI_TIMEOUT_MIN_SEC * 1000) {
    aiForm.timeout = AI_TIMEOUT_DEFAULT_SEC * 1000
  }
}

const syncAiFormFromStore = () => {
  const ai = settingData.value?.ai
  if (!ai) return
  Object.keys(ai).forEach((key) => {
    aiForm[key] = ai[key]
  })
  ensureAiFields()
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

const onVisionPresetChange = async () => {
  applyServicePreset(aiForm, 'vision')
  await onAiFormChange()
  await refreshVisionModels(true)
}

const onTextPresetChange = async () => {
  applyServicePreset(aiForm, 'text')
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
    if (!aiForm.enableEmbedding) {
      testTextResult.value = { success: true, message: t('pages.Setting.aiSetting.testOk') }
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
    <el-anchor
      class="anchor-block"
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

    <el-scrollbar ref="aiSettingsScrollbarRef" style="height: 100%; flex: 1">
      <el-form :model="aiForm" label-width="auto" class="ai-setting-form">
        <div class="form-card">
          <div id="divider-ai-base" class="divider">
            {{ t('pages.Setting.aiSetting.sectionBase') }}
          </div>
          <el-form-item :label="t('pages.Setting.aiSetting.enabled')">
            <el-switch v-model="aiForm.enabled" @change="onAiFormChange" />
          </el-form-item>
          <el-form-item :label="t('pages.Setting.aiSetting.analysisMode')">
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
          </el-form-item>
          <el-form-item
            v-if="showAnalysisProgress"
            :label="t('pages.Setting.aiSetting.analysisProgress')"
          >
            <div v-loading="loadingAnalysisStats && !analysisStats" class="analysis-progress">
              <el-progress
                :percentage="analysisProgressPercent"
                :status="
                  analysisStats?.running
                    ? undefined
                    : analysisProgressPercent >= 100 && analysisStats?.total
                      ? 'success'
                      : undefined
                "
              />
              <div class="analysis-stats-row">
                <el-tag type="success" size="small">
                  {{ t('pages.Setting.aiSetting.statsDone') }}: {{ analysisStats?.done ?? 0 }}
                </el-tag>
                <el-tag type="warning" size="small">
                  {{ t('pages.Setting.aiSetting.statsPending') }}: {{ analysisStats?.pending ?? 0 }}
                </el-tag>
                <el-tag type="danger" size="small">
                  {{ t('pages.Setting.aiSetting.statsFailed') }}: {{ analysisStats?.failed ?? 0 }}
                </el-tag>
                <el-tag v-if="(analysisStats?.skipped ?? 0) > 0" type="info" size="small">
                  {{ t('pages.Setting.aiSetting.statsSkipped') }}: {{ analysisStats?.skipped ?? 0 }}
                </el-tag>
                <el-tag v-if="aiForm.enableEmbedding" size="small">
                  {{ t('pages.Setting.aiSetting.statsEmbedding') }}:
                  {{ analysisStats?.embedding ?? 0 }}
                </el-tag>
              </div>
              <div v-if="analysisStats?.running" class="field-hint">
                {{ t('pages.Setting.aiSetting.statsRunning') }}
              </div>
              <div v-else-if="aiForm.analysisMode === 'on_demand'" class="field-hint">
                {{ t('pages.Setting.aiSetting.statsOnDemandHint') }}
              </div>
              <div
                v-else-if="analysisProgressPercent >= 100 && (analysisStats?.total ?? 0) > 0"
                class="field-hint"
              >
                {{ t('pages.Setting.aiSetting.statsComplete') }}
              </div>
            </div>
          </el-form-item>
          <el-form-item :label="t('pages.Setting.aiSetting.requestTimeout')">
            <el-input-number
              v-model="timeoutSeconds"
              :min="AI_TIMEOUT_MIN_SEC"
              :max="AI_TIMEOUT_MAX_SEC"
              :step="30"
              style="width: 290px"
              @change="onAiFormChange"
            />
            <span class="timeout-unit">{{ t('pages.Setting.aiSetting.requestTimeoutUnit') }}</span>
            <div class="field-hint">{{ t('pages.Setting.aiSetting.requestTimeoutHint') }}</div>
          </el-form-item>

          <div id="divider-ai-vision" class="divider-sub">
            {{ t('pages.Setting.aiSetting.visionSection') }}
          </div>
          <el-form-item :label="t('pages.Setting.aiSetting.serviceProvider')">
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
          </el-form-item>
          <el-form-item
            v-if="isVisionCustom"
            :label="t('pages.Setting.aiSetting.visionBaseUrl')"
          >
            <el-input
              v-model="aiForm.visionBaseUrl"
              style="width: 290px"
              :placeholder="t('pages.Setting.aiSetting.customBaseUrlPlaceholder')"
              @change="onAiFormChange"
            />
          </el-form-item>
          <el-form-item v-else-if="!isLocalPreset(aiForm.visionPreset)" label=" ">
            <el-text type="info">{{ aiForm.visionBaseUrl }}</el-text>
          </el-form-item>
          <el-form-item v-else :label="t('pages.Setting.aiSetting.visionBaseUrl')">
            <el-input
              v-model="aiForm.visionBaseUrl"
              style="width: 290px"
              @change="onAiFormChange"
            />
          </el-form-item>
          <el-form-item v-if="isRemoteVision" :label="t('pages.Setting.aiSetting.apiKey')">
            <el-input
              v-model="aiForm.visionApiKey"
              type="password"
              show-password
              style="width: 290px"
              :placeholder="t('pages.Setting.aiSetting.apiKeyPlaceholder')"
              @change="onAiFormChange"
            />
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
            <div v-if="isLocalPreset(aiForm.visionPreset)" class="field-hint">
              {{ t('pages.Setting.aiSetting.ollamaModelHint') }}
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
          <el-form-item v-if="isTextCustom" :label="t('pages.Setting.aiSetting.textBaseUrl')">
            <el-input
              v-model="aiForm.textBaseUrl"
              style="width: 290px"
              :placeholder="t('pages.Setting.aiSetting.customBaseUrlPlaceholder')"
              @change="onAiFormChange"
            />
          </el-form-item>
          <el-form-item v-else-if="!isLocalPreset(aiForm.textPreset)" label=" ">
            <el-text type="info">{{ aiForm.textBaseUrl }}</el-text>
          </el-form-item>
          <el-form-item v-else :label="t('pages.Setting.aiSetting.textBaseUrl')">
            <el-input
              v-model="aiForm.textBaseUrl"
              style="width: 290px"
              @change="onAiFormChange"
            />
          </el-form-item>
          <el-form-item v-if="isRemoteText" :label="t('pages.Setting.aiSetting.apiKey')">
            <el-input
              v-model="aiForm.textApiKey"
              type="password"
              show-password
              style="width: 290px"
              :placeholder="t('pages.Setting.aiSetting.apiKeyPlaceholder')"
              @change="onAiFormChange"
            />
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

          <div id="divider-ai-features" class="divider-sub">
            {{ t('pages.Setting.aiSetting.sectionFeatures') }}
          </div>
          <el-form-item :label="t('pages.Setting.aiSetting.enableEmbedding')">
            <el-switch v-model="aiForm.enableEmbedding" @change="onAiFormChange" />
          </el-form-item>
          <el-form-item :label="t('pages.Setting.aiSetting.autoCollectionsEnabled')">
            <el-switch v-model="aiForm.autoCollectionsEnabled" @change="onAiFormChange" />
            <div class="field-hint">{{ t('pages.Setting.aiSetting.autoCollectionsEnabledHint') }}</div>
          </el-form-item>
          <el-form-item :label="t('pages.Setting.aiSetting.enableNsfwCheck')">
            <el-switch v-model="aiForm.enableNsfwCheck" @change="onAiFormChange" />
          </el-form-item>
          <el-form-item :label="t('pages.Setting.aiSetting.smartSearch')">
            <el-switch v-model="aiForm.smartSearch" @change="onAiFormChange" />
          </el-form-item>
          <el-form-item :label="t('pages.Setting.aiSetting.expandDownloadKeywords')">
            <el-switch v-model="aiForm.expandDownloadKeywords" @change="onAiFormChange" />
          </el-form-item>
          <el-form-item :label="t('pages.Setting.aiSetting.runOnBattery')">
            <el-switch v-model="aiForm.runOnBattery" @change="onAiFormChange" />
          </el-form-item>
          <el-form-item :label="t('pages.Setting.aiSetting.allowRemoteImageUpload')">
            <el-switch v-model="aiForm.allowRemoteImageUpload" @change="onAiFormChange" />
          </el-form-item>
          <el-form-item :label="t('pages.Setting.aiSetting.legacyOnnxScore')">
            <el-switch v-model="aiForm.legacyOnnxScore" @change="onAiFormChange" />
          </el-form-item>
          <el-form-item :label="t('pages.Setting.aiSetting.legacyJiebaTags')">
            <el-switch v-model="aiForm.legacyJiebaTags" @change="onAiFormChange" />
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
  align-items: flex-start;
  gap: 20px;
  height: calc(100vh - 110px);
  overflow: hidden;
}

.model-row {
  display: flex;
  gap: 8px;
  align-items: center;
  flex-wrap: wrap;
}

.field-hint {
  margin-top: 6px;
  color: var(--el-text-color-secondary);
  font-size: 12px;
  line-height: 1.5;
}

.timeout-unit {
  margin-left: 8px;
  color: var(--el-text-color-secondary);
  font-size: 13px;
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

.analysis-progress {
  width: min(520px, 100%);
}

.analysis-stats-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 10px;
}
</style>
