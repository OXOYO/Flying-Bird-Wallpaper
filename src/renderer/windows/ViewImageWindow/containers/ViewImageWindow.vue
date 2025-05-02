<script setup>
const viewImageRef = ref(null)
const viewImageOptions = {
  button: false,
  backdrop: 'static'
}

const doView = (activeIndex = -1, list = []) => {
  viewImageRef.value.view(activeIndex, list)
}

const getPostData = async () => {
  const data = await window.FBW.getPostData()
  doView(data.activeIndex, data.list)
}

const onSendPostDataCallback = (event, data) => {
  doView(data.activeIndex, data.list)
}

onBeforeMount(() => {
  // 监听主进程的发送数据事件
  window.FBW.onSendPostData(onSendPostDataCallback)
})

onMounted(async () => {
  await getPostData()
})

onBeforeUnmount(() => {
  // 取消监听主进程的发送数据事件
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
      <view-image ref="viewImageRef" :options="viewImageOptions" />
    </div>
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
