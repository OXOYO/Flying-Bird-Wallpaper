<script setup>
import UseSettingStore from '@renderer/stores/settingStore.js'
import PrivacyPasswordDialog from '@renderer/components/PrivacyPasswordDialog.vue'
import { usePrivacyNsfwMask } from '@common/composables/usePrivacyNsfwMask.mjs'
import { resolveNsfwMaskVerifyFailMessage } from '@common/privacyNsfwMask.js'
import { useTranslation } from 'i18next-vue'

const { t } = useTranslation()
const settingStore = UseSettingStore()
const { settingData } = storeToRefs(settingStore)

const viewImageRef = ref(null)
const privacyPasswordDialogRef = ref(null)
const viewImageOptions = {
  button: false,
  backdrop: 'static'
}

const {
  shouldMaskItem,
  onMaskClick,
  lockPage,
  refreshHasPassword
} = usePrivacyNsfwMask({
  settingData,
  pageKey: 'desktop:ViewImage',
  hasPrivacyPassword: () => window.FBW.hasPrivacyPassword(),
  openPasswordDialog: () => privacyPasswordDialogRef.value?.open?.(),
  checkPrivacyPassword: (pwd) => window.FBW.checkPrivacyPassword(pwd),
  onVerifyFail: (res) => {
    ElMessage({
      type: 'error',
      message: resolveNsfwMaskVerifyFailMessage(res, t)
    })
  }
})

const doView = (activeIndex = -1, list = []) => {
  viewImageRef.value?.view(activeIndex, list)
}

const getPostData = async () => {
  const data = await window.FBW.getPostData()
  doView(data.activeIndex, data.list)
}

const onSendPostDataCallback = (event, data) => {
  doView(data.activeIndex, data.list)
}

onBeforeMount(() => {
  window.FBW.onSendPostData(onSendPostDataCallback)
})

onMounted(async () => {
  lockPage()
  await refreshHasPassword()
  await getPostData()
})

onBeforeUnmount(() => {
  lockPage()
  window.FBW.offSendPostData(onSendPostDataCallback)
})
</script>

<template>
  <div class="window-container">
    <custom-title-bar
      :resize-window="true"
      window-name="viewImageWindow"
      style="background-color: #efefef"
    />
    <div class="window-container-inner">
      <view-image
        ref="viewImageRef"
        :options="viewImageOptions"
        :should-mask-item="shouldMaskItem"
        :on-mask-click="onMaskClick"
      />
    </div>
    <PrivacyPasswordDialog ref="privacyPasswordDialogRef" />
  </div>
</template>

<style scoped lang="scss">
.window-container {
  width: 100%;
  height: 100%;
  display: inline-block;
}

.window-container-inner {
  width: 100%;
  height: 100%;
  display: inline-block;
  position: relative;
}
</style>
