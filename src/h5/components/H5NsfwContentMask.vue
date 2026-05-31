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

/** 阻止触摸/鼠标事件冒泡到卡片，避免触发长按菜单等 */
const onShieldPointer = (e) => {
  e.stopPropagation()
}
</script>

<template>
  <div
    v-if="visible"
    class="h5-nsfw-content-mask"
    role="button"
    tabindex="0"
    @click.stop="onClick"
    @touchstart.stop="onShieldPointer"
    @touchmove.stop="onShieldPointer"
    @touchend.stop="onShieldPointer"
    @touchcancel.stop="onShieldPointer"
    @mousedown.stop="onShieldPointer"
    @contextmenu.stop.prevent="onShieldPointer"
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
  gap: 8px;
  padding: 12px;
  background: rgba(12, 14, 18, 0.78);
  backdrop-filter: blur(12px);
  cursor: pointer;
  user-select: none;
}

.h5-nsfw-content-mask__icon {
  font-size: 32px;
  color: rgba(255, 255, 255, 0.92);
}

.h5-nsfw-content-mask__text {
  font-size: 12px;
  line-height: 1.45;
  text-align: center;
  color: rgba(255, 255, 255, 0.88);
  max-width: 88%;
}
</style>
