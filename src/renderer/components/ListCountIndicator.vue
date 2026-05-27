<script setup>
import { useTranslation } from 'i18next-vue'

const props = defineProps({
  /** 已加载 / 已完成数量 */
  current: { type: Number, default: 0 },
  /** 总数量 */
  total: { type: Number, default: 0 },
  /**
   * fixed-br：搜索/收藏/回忆页右下角固定
   * page-footer：合集页底栏右侧（与列表分区，不遮挡）
   * anchor-bottom：设置页 AI 左侧锚点栏底部
   */
  placement: {
    type: String,
    default: 'fixed-br',
    validator: (v) => ['fixed-br', 'anchor-bottom', 'page-footer'].includes(v)
  },
})

const { t } = useTranslation()
</script>

<template>
  <div
    class="list-count-indicator"
    :class="`list-count-indicator--${placement}`"
    role="status"
  >
    {{ t('exploreCommon.totalText', { current: props.current, total: props.total }) }}
  </div>
</template>

<style scoped lang="scss">
.list-count-indicator {
  font-size: 12px;
  line-height: 1.4;
  white-space: nowrap;
  pointer-events: none;
  user-select: none;
  color: var(--el-text-color-secondary);

  &--fixed-br {
    position: fixed;
    bottom: 4px;
    right: 40px;
    z-index: 20;
  }

  &--anchor-bottom {
    flex-shrink: 0;
    width: 100%;
    padding: 10px 0 4px;
    border-top: 1px solid var(--el-border-color-lighter);
    text-align: left;
  }

  &--page-footer {
    flex-shrink: 0;
    position: static;
    pointer-events: none;
  }
}
</style>
