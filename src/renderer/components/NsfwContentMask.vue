<script setup>
import { useTranslation } from 'i18next-vue'

defineProps({
  visible: { type: Boolean, default: false }
})

const emit = defineEmits(['click'])

const { t } = useTranslation()

const onClick = (e) => {
  emit('click', e)
}
</script>

<template>
  <div
    v-if="visible"
    class="nsfw-content-mask"
    role="button"
    tabindex="0"
    @click.stop="onClick"
    @keydown.enter.stop="onClick"
  >
    <IconifyIcon class="nsfw-content-mask__icon" icon="custom:hide" />
    <span class="nsfw-content-mask__text">{{ t('privacyNsfwMask.tapToUnlock') }}</span>
  </div>
</template>

<style scoped lang="scss">
.nsfw-content-mask {
  position: absolute;
  inset: 0;
  z-index: 25;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 12px;
  background: rgba(12, 14, 18, 0.72);
  backdrop-filter: blur(14px);
  cursor: pointer;
  user-select: none;

  &__icon {
    font-size: 36px;
    color: rgba(255, 255, 255, 0.92);
  }

  &__text {
    font-size: 13px;
    line-height: 1.4;
    text-align: center;
    color: rgba(255, 255, 255, 0.88);
    max-width: 90%;
  }
}
</style>
