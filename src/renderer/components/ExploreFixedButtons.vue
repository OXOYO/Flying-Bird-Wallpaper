<script setup>
import { nextTick, onMounted, ref, watch } from 'vue'

const props = defineProps({
  buttons: { type: Array, default: () => [] },
  show: { type: Boolean, default: true },
  loading: { type: Boolean, default: false },
  showBacktop: { type: Boolean, default: true },
  backtopTarget: {
    type: String,
    default: '.virtual-list-scrollbar .el-scrollbar__wrap'
  },
  backtopBottom: { type: Number, default: 100 }
})

const emit = defineEmits(['action'])

const backtopReady = ref(false)

const resolveBacktopTarget = () => {
  if (!props.backtopTarget) return null
  try {
    return document.querySelector(props.backtopTarget)
  } catch {
    return null
  }
}

const syncBacktopReady = async () => {
  await nextTick()
  backtopReady.value = !!(props.show && props.showBacktop && resolveBacktopTarget())
}

onMounted(syncBacktopReady)

watch(
  () => [props.show, props.showBacktop, props.backtopTarget],
  () => syncBacktopReady(),
  { flush: 'post' }
)

const onClick = (action, actionParams, childVal) => {
  emit('action', action, actionParams, childVal)
}
</script>

<template>
  <el-backtop
    v-if="backtopReady"
    class="explore-fixed-btn explore-fixed-btn--backtop"
    :right="40"
    :bottom="backtopBottom"
    :visibility-height="200"
    :target="backtopTarget"
  />
  <div
    v-for="item in buttons"
    :key="item.action"
    class="explore-fixed-btn"
    :style="item.style"
  >
    <div v-if="item.children?.length" class="explore-fixed-btn__children">
      <div
        v-for="child in item.children"
        :key="child.value"
        class="explore-fixed-btn__child"
        :title="child.alt || child.title || child.label"
        @click="onClick(item.action, item.actionParams, child.value)"
      >
        <IconifyIcon v-if="child.icon" :icon="child.icon" :style="child.iconStyle" />
        <span v-else class="explore-fixed-btn__child-text">{{ child.title || child.label }}</span>
      </div>
    </div>
    <el-button
      class="explore-fixed-btn__trigger"
      circle
      :disabled="loading"
      :title="item.alt || item.title"
      size="large"
      @click="onClick(item.action, item.actionParams)"
    >
      <IconifyIcon v-if="item.icon" :icon="item.icon" :style="item.iconStyle" />
      <span v-else class="explore-fixed-btn__child-text">{{ item.title }}</span>
    </el-button>
  </div>
</template>

<style scoped lang="scss">
.explore-fixed-btn {
  position: absolute;
  right: 40px;
  bottom: 0;
  z-index: 5;
  font-size: 20px;
  font-weight: bolder;
  background-color: rgba(50, 57, 65, 0.2);
  backdrop-filter: blur(10px);
  box-shadow: 0 0 6px rgba(0, 0, 0, 0.12);
  border: none;
  border-radius: 40px;
  color: #ffffff;
  display: flex;
  justify-content: center;
  align-items: center;
  overflow: hidden;
  transform: translateZ(0);
  will-change: transform, opacity;

  &:hover .explore-fixed-btn__children {
    transform: translateX(0);
    width: auto;
    padding: 0 10px;
  }

  &__children {
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 10px;
    padding: 0;
    transform: translateX(100%);
    width: 0;
    overflow: hidden;
    transition: all 0.3s ease-in-out;
  }

  &__child {
    min-width: 30px;
    min-height: 30px;
    display: flex;
    justify-content: center;
    align-items: center;
    cursor: pointer;
    color: #ffffff;

    &:hover {
      color: #95d475;
    }

    &:active {
      opacity: 0.8;
    }
  }

  &__trigger {
    position: relative;
    font-size: 20px;
    font-weight: bolder;
    background-color: transparent !important;
    border: none !important;
    color: #ffffff !important;

    &:hover {
      color: #95d475 !important;
    }

    &:active {
      transform: scale(0.8);
    }
  }

  &__child-text {
    font-size: 12px;
  }
}
</style>
