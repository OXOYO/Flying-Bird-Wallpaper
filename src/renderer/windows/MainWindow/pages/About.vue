<script setup>
import { appInfo } from '@common/config.js'

const openUrl = (url) => {
  window.FBW.openUrl(url)
}
</script>

<template>
  <el-main class="page-about">
    <el-form label-width="auto" label-suffix=":">
      <div class="form-card">
        <el-form-item :label="$t('pages.About.name')">
          <el-link
            type="primary"
            :herf="appInfo.homepage"
            target="_blank"
            @click="openUrl(appInfo.homepage)"
          >
            {{ appInfo.appName }}
          </el-link>
        </el-form-item>
        <el-form-item :label="$t('pages.About.description')">
          <span>{{ $t('appInfo.description') }}</span>
        </el-form-item>
        <el-form-item :label="$t('pages.About.author')">
          <el-link
            type="primary"
            :herf="appInfo.authorLink"
            target="_blank"
            @click="openUrl(appInfo.authorLink)"
          >
            {{ appInfo.author }}
          </el-link>
        </el-form-item>
        <el-form-item :label="$t('pages.About.version')">
          <el-link
            type="primary"
            :herf="appInfo.releases"
            target="_blank"
            @click="openUrl(appInfo.releases)"
          >
            {{ appInfo.version }}
          </el-link>
        </el-form-item>
        <el-form-item :label="$t('pages.About.github')">
          <el-link
            type="primary"
            :herf="appInfo.github"
            target="_blank"
            @click="openUrl(appInfo.github)"
          >
            {{ appInfo.repository }}
          </el-link>
        </el-form-item>
        <el-form-item :label="$t('pages.About.email')">
          <el-link type="primary" target="_blank" :href="`mailto:${appInfo.email}`">
            {{ appInfo.email }}
          </el-link>
        </el-form-item>
      </div>
    </el-form>
  </el-main>
</template>

<style scoped lang="scss">
.page-about {
  padding: 0 20px;
}
</style>
