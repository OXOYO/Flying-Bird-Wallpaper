<script setup>
import { computed, ref, watch } from 'vue'
import AnalysisScopeCard from './AnalysisScopeCard.vue'
import {
  REANALYZE_MODE,
  hasActionableReanalyzeMode,
  resolveDefaultReanalyzeMode
} from '../utils/reanalyzeScope.mjs'

const props = defineProps({
  failed: { type: Number, default: 0 },
  skipped: { type: Number, default: 0 },
  done: { type: Number, default: 0 },
  total: { type: Number, default: 0 },
  state: { type: Object, required: true },
  t: { type: Function, required: true }
})

const retryableCount = computed(() => Math.max(0, props.failed) + Math.max(0, props.skipped))
const fullNoClearCount = computed(
  () => retryableCount.value + Math.max(0, props.done)
)

const options = computed(() => [
  {
    value: REANALYZE_MODE.RETRYABLE,
    title: props.t('pages.Setting.aiSetting.reanalyzeModeRetryableTitle'),
    desc: props.t('pages.Setting.aiSetting.reanalyzeModeRetryableDesc'),
    count: retryableCount.value,
    meta:
      props.failed > 0 || props.skipped > 0
        ? props.t('pages.Setting.aiSetting.reanalyzeModeRetryableMeta', {
            failed: props.failed,
            skipped: props.skipped
          })
        : '',
    enabled: retryableCount.value > 0
  },
  {
    value: REANALYZE_MODE.FULL_NO_CLEAR,
    title: props.t('pages.Setting.aiSetting.reanalyzeModeFullNoClearTitle'),
    desc: props.t('pages.Setting.aiSetting.reanalyzeModeFullNoClearDesc'),
    count: fullNoClearCount.value,
    meta: '',
    enabled: fullNoClearCount.value > 0
  },
  {
    value: REANALYZE_MODE.FULL_CLEAR,
    title: props.t('pages.Setting.aiSetting.reanalyzeModeFullClearTitle'),
    desc: props.t('pages.Setting.aiSetting.reanalyzeModeFullClearDesc'),
    count: props.total,
    meta: '',
    enabled: props.total > 0
  }
])

const mode = ref(
  resolveDefaultReanalyzeMode({
    failed: props.failed,
    skipped: props.skipped,
    done: props.done,
    total: props.total
  })
)

const syncState = () => {
  props.state.mode = mode.value
  props.state.hasActionable = hasActionableReanalyzeMode({
    failed: props.failed,
    skipped: props.skipped,
    done: props.done,
    total: props.total
  })
}

const selectMode = (value, enabled) => {
  if (!enabled) return
  mode.value = value
}

watch(mode, syncState)
watch(
  () => [props.failed, props.skipped, props.done, props.total],
  () => {
    mode.value = resolveDefaultReanalyzeMode({
      failed: props.failed,
      skipped: props.skipped,
      done: props.done,
      total: props.total
    })
    syncState()
  }
)

syncState()
</script>

<template>
  <div class="reanalyze-scope-picker">
    <div class="reanalyze-scope-picker__section-label">
      {{ props.t('pages.Setting.aiSetting.reanalyzeSectionLabel') }}
    </div>

    <div class="reanalyze-scope-picker__cards" role="radiogroup">
      <AnalysisScopeCard
        v-for="item in options"
        :key="item.value"
        :title="item.title"
        :count="item.count"
        :meta="item.meta"
        :desc="item.desc"
        :selected="mode === item.value"
        :disabled="!item.enabled"
        role="radio"
        :aria-checked="mode === item.value"
        :tabindex="item.enabled ? 0 : -1"
        @click="selectMode(item.value, item.enabled)"
        @keydown.enter.prevent="selectMode(item.value, item.enabled)"
        @keydown.space.prevent="selectMode(item.value, item.enabled)"
      />
    </div>
  </div>
</template>
