<script setup>
import { useTranslation } from 'i18next-vue'
import InstantTooltip from '@renderer/components/InstantTooltip.vue'
import { buildResourceCardButtons } from '@renderer/composables/useResourceCardActions.js'
import { useHorizontalWheelScroll } from '@renderer/composables/useHorizontalWheelScroll.mjs'
import NsfwContentMask from '@renderer/components/NsfwContentMask.vue'

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
  /** useExploreCardVideo 返回值，与 ExploreCommon 内联视频行为一致 */
  videoApi: { type: Object, default: null },
  showTags: { type: Boolean, default: false },
  /** 是否显示「已 AI 分析」角标（合集页等内容已全部分析时可关闭） */
  showAiBadge: { type: Boolean, default: true },
  showCaption: { type: Boolean, default: true },
  fill: { type: Boolean, default: false },
  statusClass: { type: String, default: '' },
  nsfwMasked: { type: Boolean, default: false },
  actionsDisabled: { type: Boolean, default: false }
})

const emit = defineEmits(['action', 'dblclick-card', 'nsfw-mask-click'])

const { t } = useTranslation()
const { onHorizontalWheel } = useHorizontalWheelScroll()

const buttons = computed(() => buildResourceCardButtons(props.item, props.cardContext, t))

const cardStyle = computed(() => {
  const rgb = props.item.dominantColorRgb
  return {
    '--dominant-color': props.item.dominantColor || 'transparent',
    '--dominant-color-rgba': rgb
      ? `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.5)`
      : 'rgba(255, 255, 255, 0.5)'
  }
})

const isVideoPlaying = computed(() => !!props.item.isPlaying)

const onMouseEnter = () => {
  if (props.nsfwMasked || props.item.fileType !== 'video' || !props.videoApi) return
  props.videoApi.onVideoMouseEnter(props.item, props.index)
}

const onMouseLeave = () => {
  if (props.nsfwMasked || props.item.fileType !== 'video' || !props.videoApi) return
  props.videoApi.onVideoMouseLeave(props.item, props.index)
}

const onBtnClick = (action) => {
  if (props.actionsDisabled) return
  if (action === 'doViewVideoFullscreen' && props.videoApi) {
    props.videoApi.pauseInlineVideo(props.item, props.index)
  }
  emit('action', action, props.item, props.index)
}

const onDblClick = () => {
  if (props.actionsDisabled) return
  emit('dblclick-card', props.item, props.index)
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
    @mouseenter="onMouseEnter"
    @mouseleave="onMouseLeave"
    @dblclick="onDblClick"
  >
    <NsfwContentMask :visible="nsfwMasked" @click="emit('nsfw-mask-click', $event)" />
    <div v-if="showTags && !nsfwMasked" class="card-item-tags">
      <InstantTooltip v-if="item.resourceName" :content="item.resourceName">
        <div class="tag-item tag-item__disabled">
          {{ item.resourceName }}
        </div>
      </InstantTooltip>
      <InstantTooltip
        v-if="item.quality && item.quality !== 'unset'"
        :content="item.quality"
      >
        <div class="tag-item tag-item__disabled">
          {{ item.quality }}
        </div>
      </InstantTooltip>
      <InstantTooltip v-if="item.score" :content="t('exploreCommon.tagItem.score')">
        <div class="tag-item tag-item__disabled">
          {{ item.score }}
        </div>
      </InstantTooltip>
      <InstantTooltip
        v-if="showAiBadge && item.aiAnalysisStatus === 'done'"
        :content="t('exploreCommon.tagItem.aiAnalyzed')"
      >
        <div class="tag-item tag-item__disabled tag-item--icon">
          <IconifyIcon class="tag-item-icon" icon="custom:ai-sparkles" />
        </div>
      </InstantTooltip>
      <InstantTooltip
        v-if="item.isLandscape === 1"
        :content="t('orientationOptions.landscape')"
      >
        <div class="tag-item tag-item__disabled">
          <IconifyIcon icon="custom:landscape-outline" />
        </div>
      </InstantTooltip>
      <InstantTooltip
        v-else-if="item.isLandscape === 0"
        :content="t('orientationOptions.portrait')"
      >
        <div class="tag-item tag-item__disabled">
          <IconifyIcon icon="custom:portrait-outline" />
        </div>
      </InstantTooltip>
      <InstantTooltip v-if="item.isFavorite" :content="t('exploreCommon.tagItem.favorited')">
        <div class="tag-item tag-item__disabled">
          <IconifyIcon icon="custom:star-fill" />
        </div>
      </InstantTooltip>
    </div>

    <div class="card-media" :class="{ 'card-media--nsfw-masked': nsfwMasked }">
      <div v-if="!nsfwMasked" class="card-item-btns__trigger"></div>
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
          :ref="videoApi ? videoApi.bindVideoRef(index) : undefined"
          class="card-item-video-player"
          :src="item.videoSrc"
          :poster="item.imageSrc"
          preload="metadata"
          loop
          @playing="videoApi?.onVideoPlaying(index)"
          @ended="videoApi?.onVideoEnded(item, index)"
          @error="videoApi?.onVideoError(item, index, $event)"
        ></video>
        <InstantTooltip
          v-if="!nsfwMasked && isVideoPlaying && videoApi"
          :content="
            videoApi.isVideoMutedAt(index)
              ? t('exploreCommon.videoUnmute')
              : t('exploreCommon.videoMute')
          "
        >
          <button
            type="button"
            class="card-item-video-mute-btn"
            @click.stop="videoApi.toggleVideoMute(item, index)"
          >
            <IconifyIcon
              :icon="
                videoApi.isVideoMutedAt(index) ? 'custom:volume-mute' : 'custom:volume-on'
              "
            />
          </button>
        </InstantTooltip>
        <IconifyIcon
          v-if="!nsfwMasked && videoApi"
          class="card-item-video-btn"
          :icon="isVideoPlaying ? 'custom:pause-circle' : 'custom:play-circle'"
          @click="videoApi.toggleVideo(item, index)"
        />
      </div>

      <div v-else class="card-item-image-wrapper card-item-image-wrapper--placeholder">
        <div class="image-error-inner">
          <IconifyIcon icon="custom:image" />
        </div>
      </div>

      <el-scrollbar
        v-if="!nsfwMasked"
        class="card-item-btns"
        @dblclick.stop
        @wheel.capture="onHorizontalWheel"
      >
        <div class="card-item-btns-track" @wheel.capture="onHorizontalWheel">
          <InstantTooltip
            v-for="btn in buttons"
            :key="btn.action"
            :content="btn.title"
          >
            <el-button
              class="card-item-btn"
              type="primary"
              link
              @click="onBtnClick(btn.action)"
              @dblclick.stop
            >
              <IconifyIcon class="card-item-btn-icon" :icon="btn.icon" />
            </el-button>
          </InstantTooltip>
        </div>
      </el-scrollbar>
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
  will-change: transform;
  transform: translateZ(0);
  backface-visibility: hidden;

  :deep(.nsfw-content-mask) {
    z-index: 30;
    border-radius: inherit;
  }

  &:active {
    opacity: 0.8;
  }

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
    background-color: rgba(149, 212, 117, 0.8);
  }

  &__error::after {
    background-color: rgba(248, 152, 152, 0.8);
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

  &--nsfw-masked {
    .card-item-btns__trigger,
    .card-item-btns {
      pointer-events: none;
    }
  }
}

.card-item-image-wrapper {
  position: relative;
  aspect-ratio: 16 / 10;
  overflow: hidden;
  transition: all 0.3s ease-in-out;
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
}

.card-item-video-wrapper {
  position: relative;
  aspect-ratio: 16 / 10;
  overflow: hidden;

  .card-item-video-player {
    width: 100%;
    height: 100%;
    position: absolute;
    top: 0;
    left: 0;
    object-fit: cover;
    background-color: var(--dominant-color, #000);
    will-change: transform;
    transform: translateZ(0);
    backface-visibility: hidden;
    z-index: 5;
    cursor: pointer;
  }

  .card-item-video-btn {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%) scale(0.8);
    z-index: 20;
    display: inline-block;
    opacity: 0;
    transition: all 0.2s ease-in-out;
    font-size: 50px;
    cursor: pointer;
    color: white;
    text-shadow: 0 0 10px rgba(0, 0, 0, 0.5);
  }

  &:hover .card-item-video-btn {
    opacity: 1;
    transform: translate(-50%, -50%) scale(1);
  }

  &:hover .card-item-video-btn:hover {
    transform: translate(-50%, -50%) scale(1.1);
  }

  .card-item-video-mute-btn {
    position: absolute;
    top: 8px;
    right: 8px;
    z-index: 21;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    padding: 0;
    border: none;
    border-radius: 50%;
    font-size: 18px;
    color: #fff;
    background: rgba(0, 0, 0, 0.4);
    opacity: 0;
    transition: opacity 0.2s, background-color 0.2s;
    cursor: pointer;
    text-shadow: 0 0 8px rgba(0, 0, 0, 0.5);

    &:hover {
      background: rgba(0, 0, 0, 0.58);
    }
  }

  &:hover .card-item-video-mute-btn {
    opacity: 1;
  }
}

.card-item-tags {
  position: absolute;
  top: 4px;
  left: 4px;
  z-index: 10;
  font-size: 12px;
  color: #ffffff;
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  justify-content: flex-start;
  align-items: center;
  pointer-events: none;

  :deep(.instant-tooltip-trigger) {
    pointer-events: auto;
    max-width: 100%;
  }

  .tag-item {
    background-color: rgba(0, 0, 0, 0.5);
    backdrop-filter: blur(10px);
    padding: 2px 4px;
    border-radius: 2px;
    line-height: 1;
    max-width: 100%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .tag-item__disabled {
    cursor: default;

    &:hover {
      background-color: rgba(0, 0, 0, 0.5);
    }
  }

  .tag-item--icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 3px 5px;
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

.card-item-btns__trigger:hover ~ .card-item-btns,
.card-item-btns:hover {
  transform: translate(0, 0);
}

.card-item-btns {
  position: absolute;
  right: 0;
  bottom: 0;
  left: 0;
  transform: translate(0, 100%);
  z-index: 10;
  box-sizing: border-box;
  width: 100%;
  height: 38px;
  line-height: 1;
  padding: 0 6px;
  transition: all 0.3s ease-in-out;
  backdrop-filter: blur(10px);
  background-color: var(--dominant-color-rgba, rgba(0, 0, 0, 0.55));

  :deep(.el-scrollbar) {
    height: 100%;
  }

  :deep(.el-scrollbar__wrap) {
    height: 100%;
    display: flex;
    align-items: center;
    overflow-x: auto;
    overflow-y: hidden;
    overscroll-behavior-x: contain;
  }

  :deep(.el-scrollbar__view) {
    display: flex;
    justify-content: center;
    align-items: center;
    min-width: 100%;
    height: 100%;
    line-height: 1;
  }

  :deep(.el-scrollbar__bar.is-vertical) {
    display: none;
  }

  :deep(.el-scrollbar__bar.is-horizontal) {
    height: 3px;

    .el-scrollbar__thumb {
      background: rgba(255, 255, 255, 0.35);
      opacity: 1;
    }
  }
}

.card-item-btns-track {
  display: inline-flex;
  flex-wrap: nowrap;
  align-items: center;
  gap: 2px;
  max-width: 100%;

  :deep(.el-tooltip__trigger),
  :deep(.instant-tooltip-trigger) {
    flex: 0 0 auto;
    display: inline-flex;
    align-items: center;
    line-height: 0;
  }

  .card-item-btn {
    flex: 0 0 auto;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    margin: 0;
    padding: 0 4px;
    height: 28px;
    min-height: 28px;
    line-height: 1;

    + .card-item-btn {
      margin: 0;
    }

    &:hover {
      background-color: rgba(0, 0, 0, 0.3);
    }
  }
}

.card-item-btn-icon {
  font-size: 22px;
  line-height: 1;
  display: block;
}
</style>
