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
    class="h5-nsfw-content-mask"
    role="button"
    tabindex="0"
    @click.stop="onClick"
    @contextmenu.stop.prevent
  >
    <IconifyIcon class="h5-nsfw-content-mask__icon" icon="custom:hide" />
    <span class="h5-nsfw-content-mask__text">{{ t('privacyNsfwMask.tapToUnlock') }}</span>
  </div>
</template>

<style scoped>
.h5-nsfw-content-mask {
  position: absolute;
  inset: 0;
  z-index: 50;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--fbw-nsfw-mask-content-gap, 5px);
  padding: var(--fbw-nsfw-mask-content-padding, 8px);
  background: var(--fbw-nsfw-mask-bg, rgba(12, 14, 18, 0.76));
  backdrop-filter: blur(var(--fbw-nsfw-mask-blur, 24px));
  -webkit-backdrop-filter: blur(var(--fbw-nsfw-mask-blur, 24px));
  cursor: pointer;
  user-select: none;
  touch-action: pan-y;
}

.h5-nsfw-content-mask__icon {
  font-size: var(--fbw-nsfw-mask-icon-size, 22px);
  color: rgba(255, 255, 255, 0.92);
}

.h5-nsfw-content-mask__text {
  font-size: var(--fbw-nsfw-mask-text-size, 11px);
  line-height: 1.35;
  text-align: center;
  color: rgba(255, 255, 255, 0.85);
  max-width: 88%;
}
</style>
