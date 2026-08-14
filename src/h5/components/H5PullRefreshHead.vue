<script setup>
/**
 * 对齐鸿蒙 pullRefreshRefreshingContent：
 * pulling/loosing：箭头 + 文案；loading：仅圆环，无文案
 */
import { computed } from 'vue'
import { useTranslation } from 'i18next-vue'

const props = defineProps({
  /** pulling | loosing | loading */
  mode: { type: String, default: 'pulling' }
})

const { t } = useTranslation()

const tipText = computed(() => {
  if (props.mode === 'loosing') return t('messages.pullRefreshLoosing')
  return t('messages.pullRefreshPulling')
})
</script>

<template>
  <div class="fbw-pull-head">
    <!-- circular 对齐鸿蒙 LoadingProgress -->
    <van-loading
      v-if="mode === 'loading'"
      type="circular"
      size="22px"
      color="var(--van-text-color-3, #969799)"
    />
    <template v-else>
      <IconifyIcon
        icon="custom:arrow-down"
        class="fbw-pull-head__arrow"
        :class="{ 'fbw-pull-head__arrow--up': mode === 'loosing' }"
      />
      <span>{{ tipText }}</span>
    </template>
  </div>
</template>

<style scoped lang="scss">
.fbw-pull-head {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  height: 50px;
  color: var(--van-text-color-3);
  font-size: 14px;
}

.fbw-pull-head__arrow {
  display: inline-flex;
  font-size: 18px;
  width: 18px;
  height: 18px;
  color: inherit;
  transition: transform 0.2s ease;
}

.fbw-pull-head__arrow--up {
  transform: rotate(180deg);
}
</style>
