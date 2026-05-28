<script setup>
import { useTranslation } from 'i18next-vue'
import { buildResourceCardButtons } from '@renderer/composables/useResourceCardActions.js'

const props = defineProps({
  item: { type: Object, required: true },
  index: { type: Number, required: true },
  cardContext: {
    type: Object,
    default: () => ({
      inPrivacySpace: false,
      isFavoritesMenu: false,
      isSearchMenu: false,
      isLocalResource: true
    })
  },
  showTags: { type: Boolean, default: false },
  /** 是否显示「已 AI 分析」角标（合集页等内容已全部分析时可关闭） */
  showAiBadge: { type: Boolean, default: true },
  showCaption: { type: Boolean, default: true },
  fill: { type: Boolean, default: false },
  statusClass: { type: String, default: '' }
})

const emit = defineEmits(['action', 'dblclick-card'])

const { t } = useTranslation()
const videoRef = ref(null)
const isPlaying = ref(false)

const buttons = computed(() => buildResourceCardButtons(props.item, props.cardContext, t))

/** 与 ExploreCommon 卡片一致的主色占位 / 操作条背景 */
const cardStyle = computed(() => {
  const rgb = props.item.dominantColorRgb
  return {
    '--dominant-color': props.item.dominantColor || 'transparent',
    '--dominant-color-rgba': rgb
      ? `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.5)`
      : 'rgba(255, 255, 255, 0.5)'
  }
})

const onBtnClick = (action) => {
  emit('action', action, props.item, props.index)
}

const onDblClick = () => {
  emit('dblclick-card', props.item, props.index)
}

const toggleVideo = () => {
  const video = videoRef.value
  if (!video) return
  if (video.paused) {
    video
      .play()
      .then(() => {
        isPlaying.value = true
      })
      .catch(() => {})
  } else {
    video.pause()
    isPlaying.value = false
  }
}

const onVideoEnded = () => {
  isPlaying.value = false
}
</script>

<template>
  <article
    class="resource-explore-card"
    :class="[
      fill ? 'resource-explore-card--fill' : '',
      statusClass ? `resource-explore-card__${statusClass}` : ''
    ]"
    :style="cardStyle"
    @dblclick="onDblClick"
  >
    <div v-if="showTags" class="card-item-tags">
      <div
        v-if="item.resourceName"
        class="tag-item tag-item__disabled"
        :title="item.resourceName"
      >
        {{ item.resourceName }}
      </div>
      <div v-if="item.quality && item.quality !== 'unset'" class="tag-item tag-item__disabled" :title="item.quality">
        {{ item.quality }}
      </div>
      <div v-if="item.score" class="tag-item tag-item__disabled" :title="t('exploreCommon.tagItem.score')">
        {{ item.score }}
      </div>
      <div
        v-if="showAiBadge && item.aiAnalysisStatus === 'done'"
        class="tag-item tag-item__disabled tag-item--icon"
        :title="t('exploreCommon.tagItem.aiAnalyzed')"
      >
        <IconifyIcon class="tag-item-icon" icon="custom:ai-sparkles" />
      </div>
      <div v-if="item.isFavorite" class="tag-item tag-item__disabled" :title="t('exploreCommon.tagItem.favorited')">
        <IconifyIcon icon="custom:star-fill" />
      </div>
    </div>

    <div class="card-media">
      <div class="card-item-btns__trigger"></div>
      <div v-if="item.fileType === 'image'" class="card-item-image-wrapper">
        <el-image class="card-item-image-inner" :src="item.imageSrc" loading="lazy" lazy fit="cover">
          <template #error>
            <div class="image-error-inner">
              <IconifyIcon icon="custom:broken-image-sharp" />
            </div>
          </template>
        </el-image>
      </div>

      <div v-else-if="item.fileType === 'video'" class="card-item-video-wrapper">
        <video
          ref="videoRef"
          class="card-item-video-player"
          :src="item.videoSrc"
          :poster="item.imageSrc"
          preload="metadata"
          muted
          loop
          @ended="onVideoEnded"
        ></video>
        <IconifyIcon
          class="card-item-video-btn"
          :icon="isPlaying ? 'custom:pause-circle' : 'custom:play-circle'"
          @click.stop="toggleVideo"
        />
      </div>

      <div v-else class="card-item-image-wrapper card-item-image-wrapper--placeholder">
        <div class="image-error-inner">
          <IconifyIcon icon="custom:image" />
        </div>
      </div>

      <div class="card-item-btns" @dblclick.stop>
        <el-button
          v-for="btn in buttons"
          :key="btn.action"
          class="card-item-btn"
          type="primary"
          link
          :title="btn.title"
          @click="onBtnClick(btn.action)"
          @dblclick.stop
        >
          <IconifyIcon class="card-item-btn-icon" :icon="btn.icon" />
        </el-button>
      </div>
    </div>

    <div
      v-if="showCaption && (item.title || item.fileName)"
      class="resource-explore-card__caption"
      :title="item.title || item.fileName"
    >
      {{ item.title || item.fileName }}
    </div>
  </article>
</template>

<style scoped lang="scss">
.resource-explore-card {
  position: relative;
  border-radius: 10px;
  overflow: hidden;
  background: var(--el-fill-color-light);
  cursor: pointer;

  &--fill {
    width: 100%;
    height: 100%;
    border-radius: 0;
    display: flex;
    flex-direction: column;
    background-color: rgba(0, 0, 0, 0.2);

    .card-media {
      flex: 1;
      min-height: 0;
      display: flex;
      flex-direction: column;
    }

    .card-item-image-wrapper,
    .card-item-video-wrapper {
      flex: 1;
      min-height: 0;
      aspect-ratio: unset;
      height: 100%;
    }
  }

  &__caption {
    padding: 8px 10px;
    font-size: 12px;
    color: var(--el-text-color-regular);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    background: var(--el-fill-color-blank);
  }

  &__success::after,
  &__error::after {
    content: '';
    position: absolute;
    inset: 0;
    z-index: 20;
    pointer-events: none;
    animation: resource-card-fade 0.3s forwards;
  }

  &__success::after {
    background-color: rgba(149, 212, 117, 0.75);
  }

  &__error::after {
    background-color: rgba(248, 152, 152, 0.75);
  }
}

@keyframes resource-card-fade {
  to {
    opacity: 0;
  }
}

.card-media {
  position: relative;
  overflow: hidden;
}

.card-item-image-wrapper {
  position: relative;
  aspect-ratio: 16 / 10;
  overflow: hidden;
  transition: transform 0.3s ease-in-out;
  will-change: transform;
  transform: translateZ(0);

  &--placeholder .image-error-inner {
    min-height: 120px;
  }

  .card-item-image-inner {
    width: 100%;
    height: 100%;
    position: absolute;
    top: 0;
    left: 0;
    display: block;
    color: rgba(255, 255, 255, 0.7);
    font-size: 12px;
    background-color: var(--dominant-color, transparent);
    will-change: transform;
    transform: translateZ(0);
    backface-visibility: hidden;

    :deep(.el-image__placeholder) {
      background-color: transparent !important;
    }
  }

  :deep(.el-image) {
    width: 100%;
    height: 100%;
  }

  .image-error-inner {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    height: 100%;
    min-height: 100px;
    font-size: 50px;
    color: #ffffff;
  }
}

.resource-explore-card:hover .card-item-image-wrapper:not(.card-item-image-wrapper--placeholder) {
  transform: scale(1.05);

  :deep(.el-image__inner) {
    transform: scale(1.03);
    transition: transform 0.25s ease;
  }
}

.card-item-video-wrapper {
  position: relative;
  aspect-ratio: 16 / 10;
  overflow: hidden;

  .card-item-video-player {
    width: 100%;
    height: 100%;
    object-fit: cover;
    background-color: var(--dominant-color, #000);
    will-change: transform;
    transform: translateZ(0);
    backface-visibility: hidden;
  }

  .card-item-video-btn {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    font-size: 44px;
    color: #fff;
    opacity: 0;
    transition: opacity 0.2s;
    cursor: pointer;
    z-index: 6;
  }

  &:hover .card-item-video-btn {
    opacity: 1;
  }
}

.card-item-tags {
  position: absolute;
  top: 6px;
  left: 6px;
  right: 6px;
  z-index: 8;
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  pointer-events: none;

  .tag-item {
    padding: 2px 6px;
    font-size: 11px;
    border-radius: 4px;
    background: rgba(0, 0, 0, 0.45);
    color: #fff;
    max-width: 100%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;

    &--icon {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: 3px 5px;
    }
  }

  .tag-item-icon {
    font-size: 14px;
    line-height: 1;
  }
}

.card-item-btns__trigger {
  position: absolute;
  bottom: 0;
  left: 0;
  width: 100%;
  height: 50%;
  z-index: 9;
}

.card-item-btns {
  position: absolute;
  right: 0;
  bottom: 0;
  left: 0;
  z-index: 10;
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(28px, 1fr));
  gap: 2px;
  padding: 4px;
  backdrop-filter: blur(8px);
  background-color: var(--dominant-color-rgba, rgba(0, 0, 0, 0.55));
  transform: translate3d(0, 100%, 0);
  opacity: 0;
  visibility: hidden;
  pointer-events: none;
  transition:
    transform 0.25s ease,
    opacity 0.2s ease,
    visibility 0.2s ease;

  .card-item-btn {
    margin: 0;
    padding: 4px;
    height: auto;
    color: #fff;

    &:hover {
      color: var(--el-color-primary-light-3);
    }
  }

  .card-item-btn-icon {
    font-size: 18px;
  }
}

.resource-explore-card:hover .card-item-btns,
.card-item-btns__trigger:hover ~ .card-item-btns,
.card-item-btns:hover {
  transform: translate3d(0, 0, 0);
  opacity: 1;
  visibility: visible;
  pointer-events: auto;
}

</style>
