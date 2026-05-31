<script setup>
import UseCommonStore from '@h5/stores/commonStore.js'
import { BROWSE_PAGE_KEYS, getBrowsePageMeta } from '@h5/stores/browseMeta.js'
import { useTranslation } from 'i18next-vue'

const { t } = useTranslation()
const commonStore = UseCommonStore()
const { drawerVisible, activeBrowsePage } = storeToRefs(commonStore)

const menuItems = computed(() =>
  BROWSE_PAGE_KEYS.map((key) => ({
    key,
    ...getBrowsePageMeta(key)
  }))
)

const onSelect = (key) => {
  commonStore.selectBrowsePage(key)
}
</script>

<template>
  <van-popup
    v-model:show="drawerVisible"
    position="left"
    :style="{ width: '72%', maxWidth: '280px', height: '100%' }"
    teleport="body"
    safe-area-inset-top
    safe-area-inset-bottom
  >
    <div class="h5-browse-drawer">
      <div class="h5-browse-drawer__title">{{ t('h5.drawer.title') }}</div>
      <van-cell-group inset>
        <van-cell
          v-for="item in menuItems"
          :key="item.key"
          :title="t(item.locale)"
          clickable
          :class="{ 'h5-browse-drawer__item--active': activeBrowsePage === item.key }"
          @click="onSelect(item.key)"
        >
          <template #icon>
            <IconifyIcon class="h5-browse-drawer__icon" :icon="item.icon" />
          </template>
        </van-cell>
      </van-cell-group>
    </div>
  </van-popup>
</template>

<style scoped lang="scss">
.h5-browse-drawer {
  padding: calc(12px + env(safe-area-inset-top, 0px)) 0 16px;
  min-height: 100%;
  box-sizing: border-box;
}
.h5-browse-drawer__title {
  font-size: 18px;
  font-weight: 600;
  padding: 8px 20px 16px;
}
.h5-browse-drawer__icon {
  font-size: 20px;
  margin-right: 10px;
  color: var(--van-text-color);
}
.h5-browse-drawer__item--active {
  :deep(.van-cell__title) {
    color: var(--van-primary-color);
    font-weight: 600;
  }
}
</style>
