<script setup>
import { computed, ref, toRef, watch } from 'vue'
import { showNotify, showToast } from 'vant/es'
import * as api from '@h5/api/index.js'
import H5BrowseChrome from '@h5/components/H5BrowseChrome.vue'
import H5SimilarModeBanner from '@h5/components/H5SimilarModeBanner.vue'
import H5FullscreenPager from '@h5/components/H5FullscreenPager.vue'
import H5FloatingButtons from '@h5/components/H5FloatingButtons.vue'
import H5ListEmpty from '@h5/components/H5ListEmpty.vue'
import H5PrivacyPasswordDialog from '@h5/components/H5PrivacyPasswordDialog.vue'
import H5NsfwContentMask from '@h5/components/H5NsfwContentMask.vue'
import { useH5ResourceBrowse } from '@h5/composables/useH5ResourceBrowse.mjs'
import { resolveApiUserMessage } from '@common/utils.js'
import { scheduleDialogInputFocus } from '@common/focusDialogInput.mjs'

const H5_SEARCH_FIELD_NAME = 'fbw-h5-browse-keywords'

const props = defineProps({
  browseType: {
    type: String,
    required: true,
    validator: (v) => ['favorites', 'history', 'collection'].includes(v)
  },
  collectionId: {
    type: [Number, String],
    default: null
  },
  displayModeStorageKey: {
    type: String,
    required: true
  },
  removeOnUnfavorite: {
    type: Boolean,
    default: false
  },
  title: {
    type: String,
    default: ''
  },
  showBack: {
    type: Boolean,
    default: false
  },
  hideChrome: {
    type: Boolean,
    default: false
  },
  externalToolbarRef: {
    type: Object,
    default: null
  }
})

const emit = defineEmits(['back', 'similar-change'])

const collectionIdRef = toRef(props, 'collectionId')

const privacyPasswordDialogRef = ref(null)
const jumpFieldRef = ref(null)

const browse = useH5ResourceBrowse({
  browseType: props.browseType,
  collectionId: collectionIdRef,
  displayModeStorageKey: props.displayModeStorageKey,
  removeOnUnfavorite: props.removeOnUnfavorite,
  openPrivacyPasswordDialog: () => privacyPasswordDialogRef.value?.open()
})

const {
  pageClass,
  H5_OVERLAY_Z,
  infoKeys,
  handleInfoVal,
  t,
  settingData,
  immersiveMode,
  form,
  state,
  list,
  displayMode,
  pageWrapperRef,
  browseToolbarRef,
  fullscreenPagerRef,
  fullscreenVisibleIndex,
  imageInfoPanelAnchors,
  imageInfoPanelHeight,
  cardPressIndex,
  previewCurrentIndex,
  previewImageErrorAt,
  favoriteHold,
  jumpIndex,
  imageErrorState,
  gridColumns,
  virtualColumns,
  browseResultTotal,
  waterfallIndicatorText,
  fullscreenIndicatorText,
  mediaObjectFit,
  isCurrentFullscreenFavorite,
  showImagePlaybackFloats,
  fullscreenAutoPlayOn,
  fullscreenAutoPlayCountdown,
  fullscreenAutoPlayIntervalSec,
  layoutToggleTitle,
  isPullRefreshDisabled,
  isFullscreenPullAtTop,
  isImageInfoPanelOpen,
  browsePageIndicatorStyle,
  showIndicatorInBrowseChrome,
  immersiveIndicatorChromeInsetClass,
  previewImages,
  previewStartPosition,
  selectedItem,
  canFindSimilarSelected,
  similarMode,
  similarSourceImageSrc,
  exitSimilarMode,
  onFindSimilarSelected,
  imageInfoItem,
  selectedFavoriteActionLabel,
  imageLoadFailText,
  showBrowseSearch,
  enablePrivacySpaceToolbar,
  showPrivacySpaceActions,
  searchForm,
  inPrivacySpace,
  filterTypeDropdownOptions,
  orientationOptions,
  qualityList,
  listModeRadioOptions,
  sortFieldRadioOptions,
  sortTypeRadioOptions,
  showBrowseQualityFilter,
  onSearch,
  onResetBrowseFilters,
  onApplyBrowseFilters,
  enterPrivacySpace,
  exitPrivacySpace,
  addSelectedToPrivacySpace,
  removeSelectedFromPrivacySpace,
  shouldMaskNsfwItem,
  onNsfwMaskClick,
  getItemKey,
  getDisplayImageSrc,
  getDisplayPosterSrc,
  getFullscreenListImageSrc,
  shouldLoadFullscreenImage,
  isSlideImageLoaded,
  onImageLoadError,
  onPosterLoadError,
  onSlideImageLoad,
  retryLoadImage,
  retryLoadPoster,
  setInlineVideoRef,
  isInlineVideoPlaying,
  onInlineVideoSurfaceClick,
  toggleInlineVideo,
  onInlineVideoPaused,
  onInlineVideoError,
  onRefresh,
  onLoadMore,
  init,
  toggleDisplayMode,
  toggleDisplaySize,
  onFullscreenPagerScroll,
  onFullscreenPagerIndexChange,
  openJumpPopup,
  jumpToIndex,
  onJumpDialogViewportChange,
  handleFavoriteTouchStart,
  handleFavoriteTouchMove,
  handleFavoriteTouchEnd,
  onToggleFullscreenAutoPlay,
  onCycleFullscreenInterval,
  onToggleImmersiveMode,
  onFloatingBackTop,
  openPreview,
  onPreviewIndexChange,
  retryPreviewImage,
  onImageTouchStart,
  onImageTouchMove,
  onImageTouchEnd,
  onCardMouseDown,
  onCardMouseMove,
  onCardMouseUp,
  onMediaContextMenu,
  showImageInfo,
  toggleSelectedFavorite,
  saveSelectedMedia,
  deleteSelectedMedia,
  closeImageInfoPanel,
  onImageInfoHeightChange,
  onPageScroll
} = browse

const onJumpDialogOpened = () => {
  onJumpDialogViewportChange()
  scheduleDialogInputFocus(() => jumpFieldRef.value)
}

const isPrivacySpaceUi = computed(() => enablePrivacySpaceToolbar && inPrivacySpace.value)

const showBrowseListEmpty = computed(
  () => state.finished && !state.loading && !list.value.length
)

const privacySpaceToggleTitle = computed(() =>
  inPrivacySpace.value
    ? t('exploreCommon.onTogglePrivacySpace.quit')
    : t('exploreCommon.onTogglePrivacySpace.enter')
)

const onTogglePrivacySpace = async () => {
  if (!enablePrivacySpaceToolbar) return
  if (!inPrivacySpace.value) {
    const res = await api.hasPrivacyPassword()
    if (!res?.success || !res?.data) {
      showNotify({ type: 'danger', message: t('messages.privacyPasswordNotSet') })
      return
    }
    const value = await privacyPasswordDialogRef.value?.open()
    if (!value) return
    const checkRes = await api.checkPrivacyPassword(value)
    if (checkRes?.success) {
      showToast(t('messages.enterPrivacySpaceSuccess'))
      await enterPrivacySpace()
    } else {
      showNotify({
        type: 'danger',
        message: resolveApiUserMessage(checkRes, t) || t('messages.verifyPrivacyPasswordFail')
      })
    }
    return
  }
  showToast(t('messages.exitedPrivacySpaceSuccess'))
  await exitPrivacySpace()
}

watch(
  () => props.externalToolbarRef,
  (el) => {
    if (props.hideChrome && el) browseToolbarRef.value = el
  },
  { flush: 'post' }
)

const emitSimilarState = () => {
  emit('similar-change', {
    active: !!similarMode.value,
    sourceImageSrc: similarSourceImageSrc.value || ''
  })
}

watch([similarMode, similarSourceImageSrc], emitSimilarState, { immediate: true })

defineExpose({
  refresh: browse.refresh,
  init: browse.init,
  toggleDisplayMode: browse.toggleDisplayMode,
  displayMode,
  layoutToggleTitle,
  similarMode,
  similarSourceImageSrc,
  exitSimilarMode
})
</script>

<template>
  <div
    ref="pageWrapperRef"
    class="page-wrapper"
    :class="[
      pageClass,
      {
        [`${pageClass}--fullscreen`]: displayMode === 'fullscreen',
        [`${pageClass}--immersive`]: immersiveMode,
        [`${pageClass}--privacy-space`]: isPrivacySpaceUi
      }
    ]"
    @scroll.passive="onPageScroll"
  >
    <div :class="`${pageClass}-inner`">
      <div
        v-if="!hideChrome"
        ref="browseToolbarRef"
        class="browse-chrome-host"
        :class="{
          'browse-toolbar': !immersiveMode,
          'browse-toolbar--privacy': isPrivacySpaceUi && !immersiveMode,
          'browse-toolbar--similar': similarMode
        }"
      >
        <H5BrowseChrome :immersive-mode="immersiveMode" :privacy-mode="isPrivacySpaceUi">
          <div v-if="showBrowseSearch" class="browse-search-row">
            <form class="browse-search-form" autocomplete="off" @submit.prevent="onSearch">
              <van-search
                v-model="searchForm.filterKeywords"
                class="browse-search-input"
                :class="{ 'browse-search-input--privacy': isPrivacySpaceUi }"
                :name="H5_SEARCH_FIELD_NAME"
                autocomplete="off"
                autocorrect="off"
                autocapitalize="off"
                :spellcheck="false"
                :placeholder="t('h5.pages.search.keywordPlaceholder')"
                @search="onSearch"
              />
            </form>
            <van-button class="h5-chrome-icon-btn" plain @click="state.showFilters = true">
              <van-icon name="arrow-down" />
            </van-button>
          </div>
          <template v-if="!immersiveMode" #trailing>
            <van-button
              class="h5-chrome-icon-btn"
              plain
              :title="layoutToggleTitle"
              :aria-label="layoutToggleTitle"
              @click="toggleDisplayMode"
            >
              <van-icon :name="displayMode === 'waterfall' ? 'expand-o' : 'apps-o'" />
            </van-button>
            <van-button
              v-if="enablePrivacySpaceToolbar"
              class="h5-chrome-icon-btn"
              :class="{ 'h5-chrome-icon-btn--active': inPrivacySpace }"
              plain
              :title="privacySpaceToggleTitle"
              :aria-label="privacySpaceToggleTitle"
              @click="onTogglePrivacySpace"
            >
              <IconifyIcon
                :icon="inPrivacySpace ? 'custom:door-open-outline' : 'custom:door-front-outline'"
              />
            </van-button>
          </template>
          <template v-else #mini-trailing>
            <van-button
              v-if="showBrowseSearch"
              class="chrome-mini-btn filter-btn"
              plain
              @click="state.showFilters = true"
            >
              <van-icon name="arrow-down" />
            </van-button>
            <van-button
              class="chrome-mini-btn"
              plain
              :title="layoutToggleTitle"
              :aria-label="layoutToggleTitle"
              @click="toggleDisplayMode"
            >
              <van-icon :name="displayMode === 'waterfall' ? 'expand-o' : 'apps-o'" />
            </van-button>
            <van-button
              v-if="enablePrivacySpaceToolbar"
              class="chrome-mini-btn"
              :class="{ 'chrome-mini-btn--active': inPrivacySpace }"
              plain
              :title="privacySpaceToggleTitle"
              :aria-label="privacySpaceToggleTitle"
              @click="onTogglePrivacySpace"
            >
              <IconifyIcon
                :icon="inPrivacySpace ? 'custom:door-open-outline' : 'custom:door-front-outline'"
              />
            </van-button>
          </template>
        </H5BrowseChrome>
        <H5SimilarModeBanner
          v-if="similarMode"
          :message="t('exploreCommon.similarModeBanner')"
          :source-image-src="similarSourceImageSrc"
          :back-aria-label="t('exploreCommon.similarBack')"
          :bar-background="isPrivacySpaceUi ? 'rgba(0, 0, 0, 0.88)' : undefined"
          @back="exitSimilarMode"
        />
        <div
          v-if="showIndicatorInBrowseChrome && !hideChrome"
          class="browse-page-indicator h5-page-indicator--in-chrome"
          :class="[
            immersiveIndicatorChromeInsetClass,
            {
              'browse-page-indicator--clickable': displayMode === 'fullscreen',
              'h5-page-indicator--clickable': displayMode === 'fullscreen'
            }
          ]"
          @click="openJumpPopup"
        >
          <span class="h5-page-indicator__pill">{{
            displayMode === 'fullscreen' ? fullscreenIndicatorText : waterfallIndicatorText
          }}</span>
        </div>
      </div>

      <Teleport
        v-if="showIndicatorInBrowseChrome && hideChrome && externalToolbarRef"
        :to="externalToolbarRef"
      >
        <div
          class="browse-page-indicator h5-page-indicator--in-chrome"
          :class="[
            immersiveIndicatorChromeInsetClass,
            {
              'browse-page-indicator--clickable': displayMode === 'fullscreen',
              'h5-page-indicator--clickable': displayMode === 'fullscreen'
            }
          ]"
          @click="openJumpPopup"
        >
          <span class="h5-page-indicator__pill">{{
            displayMode === 'fullscreen' ? fullscreenIndicatorText : waterfallIndicatorText
          }}</span>
        </div>
      </Teleport>

      <van-pull-refresh v-model="state.refreshing" :disabled="isPullRefreshDisabled" @refresh="onRefresh">
        <div
          class="browse-pull-inner"
          :class="{
            'browse-pull-inner--fullscreen': displayMode === 'fullscreen',
            'h5-browse-empty-stage': showBrowseListEmpty
          }"
        >
          <div
            v-if="state.loading && !list.length"
            class="browse-skeleton"
            :class="{ 'browse-skeleton--fullscreen': displayMode === 'fullscreen' }"
          >
            <template v-if="displayMode === 'fullscreen'">
              <div class="fullscreen-skeleton-slide">
                <van-skeleton title :row="3" />
              </div>
            </template>
            <div
              v-else
              class="result-list result-list-skeleton"
              :style="{ gridTemplateColumns: `repeat(${gridColumns}, minmax(0, 1fr))` }"
            >
              <van-skeleton
                v-for="i in gridColumns * 2"
                :key="`sk-${i}`"
                avatar
                :row="2"
              />
            </div>
          </div>
          <template v-else-if="displayMode === 'waterfall'">
            <div v-if="list.length" class="result-list-wrap">
              <div class="result-list">
                <div
                  v-for="(column, columnIndex) in virtualColumns"
                  :key="`col-${columnIndex}`"
                  class="result-column"
                >
                  <div class="virtual-spacer" :style="{ height: `${column.topSpacer}px` }"></div>
                  <div
                    v-for="row in column.items"
                    :key="`wf-${row.globalIndex}-${getItemKey(row.item)}`"
                    class="result-item"
                    :class="{ 'result-item--pressing': cardPressIndex === row.globalIndex }"
                    @touchstart="(e) => onImageTouchStart(row.globalIndex, e)"
                    @touchmove="onImageTouchMove"
                    @touchend="onImageTouchEnd"
                    @touchcancel="onImageTouchEnd"
                    @mousedown="(e) => onCardMouseDown(row.globalIndex, e)"
                    @mousemove="onCardMouseMove"
                    @mouseup="onCardMouseUp"
                    @mouseleave="onCardMouseUp"
                    @contextmenu="onMediaContextMenu(row.globalIndex, $event)"
                  >
                    <div
                      class="preview-wrap"
                      :class="{ 'preview-wrap--video': row.item.fileType === 'video' }"
                      :style="{ height: `${row.height}px` }"
                      role="button"
                      tabindex="0"
                      @click="openPreview(row.globalIndex)"
                      @keydown.enter.prevent="openPreview(row.globalIndex)"
                    >
                      <template v-if="row.item.fileType === 'video'">
                        <video
                          v-if="row.item.videoSrc"
                          :ref="(el) => setInlineVideoRef(row.item, el)"
                          class="preview preview--inline-video"
                          :style="{ objectFit: mediaObjectFit }"
                          :src="row.item.videoSrc"
                          :poster="getDisplayPosterSrc(row.item)"
                          loop
                          playsinline
                          webkit-playsinline
                          x5-playsinline
                          x5-video-player-type="h5"
                          preload="metadata"
                          @click.stop="onInlineVideoSurfaceClick(row.item)"
                          @pause="onInlineVideoPaused(row.item)"
                          @error="onInlineVideoError(row.item)"
                        />
                        <template v-if="!isInlineVideoPlaying(row.item)">
                          <div
                            v-if="row.item.posterSrc && imageErrorState[getItemKey(row.item)]"
                            class="preview-fallback preview-fallback--overlay"
                            @click.stop="retryLoadPoster(row.item)"
                          >
                            <van-icon name="photo-fail" size="22" />
                            <div class="preview-fallback-text">{{ imageLoadFailText }}</div>
                          </div>
                          <img
                            v-else-if="row.item.posterSrc"
                            class="preview preview--poster preview--poster-overlay"
                            :style="{ objectFit: mediaObjectFit }"
                            :src="getDisplayPosterSrc(row.item)"
                            alt=""
                            draggable="false"
                            loading="lazy"
                            decoding="async"
                            @error="onPosterLoadError(row.item)"
                          />
                          <div
                            v-if="row.item.posterSrc && !imageErrorState[getItemKey(row.item)]"
                            class="media-touch-shield"
                            aria-hidden="true"
                          />
                          <div
                            v-else-if="!row.item.videoSrc"
                            class="preview-video-placeholder"
                            :style="{ minHeight: `${row.height}px` }"
                          >
                            <IconifyIcon class="preview-video-ph-icon" icon="custom:video" />
                          </div>
                        </template>
                        <button
                          v-if="
                            row.item.videoSrc &&
                            !isInlineVideoPlaying(row.item) &&
                            !shouldMaskNsfwItem(row.item)
                          "
                          type="button"
                          class="video-play-badge"
                          :aria-label="t('h5.pages.search.videoPreview.play')"
                          @click.stop="toggleInlineVideo(row.item, row.globalIndex)"
                        >
                          <IconifyIcon
                            class="video-play-badge-icon"
                            icon="custom:play-circle"
                          />
                        </button>
                      </template>
                      <template v-else>
                        <div
                          v-if="imageErrorState[getItemKey(row.item)]"
                          class="preview-fallback"
                          @click.stop="retryLoadImage(row.item)"
                        >
                          <van-icon name="photo-fail" size="22" />
                          <div class="preview-fallback-text">{{ imageLoadFailText }}</div>
                        </div>
                        <img
                          v-else
                          class="preview"
                          :style="{ objectFit: mediaObjectFit }"
                          :src="getDisplayImageSrc(row.item)"
                          alt="preview"
                          draggable="false"
                          loading="lazy"
                          decoding="async"
                          @error="onImageLoadError(row.item, $event)"
                        />
                        <div class="media-touch-shield" aria-hidden="true" />
                      </template>
                      <H5NsfwContentMask
                        :visible="shouldMaskNsfwItem(row.item)"
                        @click="onNsfwMaskClick"
                      />
                    </div>
                  </div>
                  <div class="virtual-spacer" :style="{ height: `${column.bottomSpacer}px` }"></div>
                </div>
              </div>
            </div>
            <H5ListEmpty v-else-if="state.finished && !state.loading" :description="t('messages.noData')" />
            <div v-if="state.loading && list.length" class="load-more-text">{{ t('messages.loading') }}</div>
          </template>
          <template v-else>
            <div class="fullscreen-slider">
              <H5FullscreenPager
                v-if="list.length"
                ref="fullscreenPagerRef"
                :items="list"
                :loading="state.loading"
                :finished="state.finished"
                :suppress-load-more="state.jumpScrollLock"
                :allow-top-pull="isFullscreenPullAtTop"
                @scroll="onFullscreenPagerScroll"
                @index-change="onFullscreenPagerIndexChange"
                @load-more="onLoadMore"
              >
                <template #default="{ item, index }">
                  <div
                    class="fullscreen-slide"
                    :class="{ 'fullscreen-slide--video': item.fileType === 'video' }"
                    :style="item.fileType === 'video' ? { backgroundColor: '#000' } : undefined"
                    @touchstart="(e) => onImageTouchStart(index, e)"
                    @touchmove="onImageTouchMove"
                    @touchend="onImageTouchEnd"
                    @touchcancel="onImageTouchEnd"
                    @mousedown="(e) => onCardMouseDown(index, e)"
                    @mousemove="onCardMouseMove"
                    @mouseup="onCardMouseUp"
                    @mouseleave="onCardMouseUp"
                    @contextmenu="onMediaContextMenu(index, $event)"
                    @click="openPreview(index)"
                  >
                    <div
                      v-if="item.fileType !== 'video' && shouldLoadFullscreenImage(index)"
                      class="fullscreen-slide-media"
                    >
                      <div
                        v-if="imageErrorState[getItemKey(item)]"
                        class="preview-fallback fullscreen-slide-fallback"
                        @click.stop="retryLoadImage(item)"
                      >
                        <van-icon name="photo-fail" size="28" />
                        <div class="preview-fallback-text">{{ imageLoadFailText }}</div>
                      </div>
                      <template v-else>
                        <van-loading
                          v-if="!isSlideImageLoaded(item)"
                          class="fullscreen-slide-loading"
                          type="spinner"
                          color="var(--van-gray-5)"
                        />
                        <img
                          class="fullscreen-slide-img"
                          :class="{ 'fullscreen-slide-img--ready': isSlideImageLoaded(item) }"
                          :style="{ objectFit: mediaObjectFit }"
                          :src="getFullscreenListImageSrc(item)"
                          alt=""
                          draggable="false"
                          decoding="async"
                          :loading="index === fullscreenVisibleIndex ? 'eager' : 'lazy'"
                          @load="onSlideImageLoad(item)"
                          @error="onImageLoadError(item, $event)"
                        />
                        <div class="media-touch-shield" aria-hidden="true" />
                      </template>
                    </div>
                    <div
                      v-else-if="item.fileType !== 'video'"
                      class="fullscreen-slide-placeholder"
                      aria-hidden="true"
                    />
                    <template v-if="item.fileType === 'video' && item.videoSrc">
                      <video
                        :ref="(el) => setInlineVideoRef(item, el)"
                        class="fullscreen-slide-video"
                        :style="{ objectFit: mediaObjectFit }"
                        :src="item.videoSrc"
                        :poster="getDisplayPosterSrc(item)"
                        loop
                        playsinline
                        webkit-playsinline
                        x5-playsinline
                        preload="metadata"
                        @click.stop="onInlineVideoSurfaceClick(item)"
                        @pause="onInlineVideoPaused(item)"
                        @error="onInlineVideoError(item)"
                      />
                      <button
                        v-if="!isInlineVideoPlaying(item) && !shouldMaskNsfwItem(item)"
                        type="button"
                        class="fullscreen-slide-video-btn"
                        :aria-label="t('h5.pages.search.videoPreview.play')"
                        @click.stop="toggleInlineVideo(item, index)"
                      >
                        <IconifyIcon
                          class="fullscreen-slide-play-icon"
                          icon="custom:play-circle"
                        />
                      </button>
                    </template>
                    <div
                      v-else-if="item.fileType === 'video'"
                      class="fullscreen-slide-video-hint"
                      aria-hidden="true"
                    >
                      <IconifyIcon class="fullscreen-slide-play-icon" icon="custom:play-circle" />
                    </div>
                    <H5NsfwContentMask
                      :visible="shouldMaskNsfwItem(item)"
                      @click="onNsfwMaskClick"
                    />
                  </div>
                </template>
              </H5FullscreenPager>
              <H5ListEmpty
                v-else-if="state.finished && !state.loading"
                :description="t('messages.noData')"
              />
              <div v-if="state.loading && list.length" class="load-more-text">{{ t('messages.loading') }}</div>
            </div>
          </template>
        </div>
      </van-pull-refresh>
    </div>

    <van-image-preview
      v-model:show="state.showPreview"
      :images="previewImages"
      :start-position="previewStartPosition"
      closeable
      @change="onPreviewIndexChange"
    />

    <Teleport to="body">
      <div
        v-if="
          state.showPreview &&
          previewImageErrorAt >= 0 &&
          previewImageErrorAt === previewCurrentIndex
        "
        class="h5-preview-error-hint"
        @click.stop="retryPreviewImage"
      >
        <van-icon name="photo-fail" size="32" />
        <div class="preview-fallback-text">{{ imageLoadFailText }}</div>
      </div>
    </Teleport>

    <van-popup
      v-model:show="state.showActionPopup"
      destroy-on-close
      position="bottom"
      :z-index="H5_OVERLAY_Z.actionPopup"
      :style="{ padding: '16px' }"
    >
      <div class="action-popup-content">
        <div class="action-item" @click="showImageInfo">
          <div class="action-icon-wrapper">
            <IconifyIcon class="action-icon-inner" icon="custom:info-line" />
          </div>
          <span class="action-label">{{ t('h5.pages.search.actions.info') }}</span>
        </div>
        <div
          v-if="canFindSimilarSelected"
          class="action-item"
          @click="onFindSimilarSelected"
        >
          <div class="action-icon-wrapper">
            <IconifyIcon class="action-icon-inner" icon="custom:find-similar" />
          </div>
          <span class="action-label">{{ t('exploreCommon.findSimilar') }}</span>
        </div>
        <div class="action-item" @click="toggleSelectedFavorite">
          <div class="action-icon-wrapper">
            <IconifyIcon
              class="action-icon-inner"
              :icon="selectedItem?.isFavorite ? 'custom:star-fill' : 'custom:star'"
              :style="{ color: selectedItem?.isFavorite ? 'gold' : '' }"
            />
          </div>
          <span class="action-label">{{ selectedFavoriteActionLabel }}</span>
        </div>
        <div
          v-if="showPrivacySpaceActions && !inPrivacySpace"
          class="action-item"
          @click="addSelectedToPrivacySpace"
        >
          <div class="action-icon-wrapper">
            <IconifyIcon class="action-icon-inner" icon="custom:privacy-tip-outline" />
          </div>
          <span class="action-label">{{ t('exploreCommon.addToPrivacySpace') }}</span>
        </div>
        <div
          v-if="enablePrivacySpaceToolbar && inPrivacySpace"
          class="action-item"
          @click="removeSelectedFromPrivacySpace"
        >
          <div class="action-icon-wrapper">
            <IconifyIcon class="action-icon-inner" icon="custom:privacy-tip" />
          </div>
          <span class="action-label">{{ t('exploreCommon.removePrivacySpace') }}</span>
        </div>
        <div class="action-item" @click="saveSelectedMedia">
          <div class="action-icon-wrapper">
            <IconifyIcon class="action-icon-inner" icon="custom:download-line" />
          </div>
          <span class="action-label">{{ t('h5.pages.search.actions.save') }}</span>
        </div>
        <div class="action-item delete-action" @click="deleteSelectedMedia">
          <div class="action-icon-wrapper">
            <IconifyIcon class="action-icon-inner" icon="custom:delete-line" />
          </div>
          <span class="action-label">{{ t('h5.pages.search.actions.delete') }}</span>
        </div>
      </div>
    </van-popup>

    <div
      v-show="isImageInfoPanelOpen"
      class="image-info-backdrop"
      aria-hidden="true"
      @click="closeImageInfoPanel"
    />
    <van-floating-panel
      v-model:height="imageInfoPanelHeight"
      :anchors="imageInfoPanelAnchors"
      class="image-info-panel"
      @height-change="onImageInfoHeightChange"
    >
      <div class="image-info-content">
        <van-cell-group v-if="imageInfoItem">
          <van-cell
            v-for="key in infoKeys"
            :key="key"
            value-class="image-info-value"
            :title="t(`h5.pages.home.imageInfo.${key}`)"
            :value="handleInfoVal(imageInfoItem, key, t)"
          />
        </van-cell-group>
      </div>
    </van-floating-panel>

    <div
      v-if="list.length && !showIndicatorInBrowseChrome"
      class="browse-page-indicator"
      :class="{ 'browse-page-indicator--clickable': displayMode === 'fullscreen' }"
      :style="browsePageIndicatorStyle"
      @click="openJumpPopup"
    >
      {{ displayMode === 'fullscreen' ? fullscreenIndicatorText : waterfallIndicatorText }}
    </div>

    <H5FloatingButtons
      v-if="list.length"
      :enabled-keys="settingData.h5EnabledFloatingButtons || []"
      :position="settingData.h5FloatingButtonPosition || 'left'"
      :auto-play-on="fullscreenAutoPlayOn"
      :countdown="fullscreenAutoPlayCountdown"
      :interval-sec="fullscreenAutoPlayIntervalSec"
      :display-size="form.displaySize"
      :immersive-mode="immersiveMode"
      :is-current-favorite="isCurrentFullscreenFavorite"
      :show-image-playback-controls="showImagePlaybackFloats"
      :show-favorites="displayMode === 'fullscreen'"
      :hidden="state.showPreview"
      @toggle-auto-play="onToggleFullscreenAutoPlay"
      @cycle-interval="onCycleFullscreenInterval"
      @favorite-touch-start="handleFavoriteTouchStart"
      @favorite-touch-move="handleFavoriteTouchMove"
      @favorite-touch-end="handleFavoriteTouchEnd"
      @toggle-display-size="toggleDisplaySize"
      @toggle-immersive="onToggleImmersiveMode"
      @back-top="onFloatingBackTop"
    />

    <van-toast
      v-model:show="state.showFavoriteToast"
      :overlay="false"
      style="background-color: transparent"
    >
      <template #message>
        <img class="favorite-toast-icon" src="@h5/assets/images/star.gif" alt="" />
        <div v-if="state.isFavoriteHolding && favoriteHold.count" class="favorite-toast-count">
          +{{ favoriteHold.count }}
        </div>
      </template>
    </van-toast>

    <van-dialog
      v-model:show="state.showJumpPopup"
      class-name="browse-jump-dialog"
      :title="t('h5.pages.home.actions.jumpToIndex')"
      show-cancel-button
      @opened="onJumpDialogOpened"
      @confirm="jumpToIndex"
      @cancel="jumpIndex = ''"
    >
      <van-field
        ref="jumpFieldRef"
        v-model="jumpIndex"
        :placeholder="t('h5.pages.home.actions.enterIndex')"
        type="digit"
        :maxlength="String(browseResultTotal).length"
        @focus="onJumpDialogViewportChange(true)"
      />
    </van-dialog>

    <van-popup
      v-if="showBrowseSearch"
      v-model:show="state.showFilters"
      position="bottom"
      round
      class="browse-filters-popup"
    >
      <div class="filter-panel">
        <div class="filter-panel-header">
          <div class="filter-title">{{ t('h5.pages.search.filters.title') }}</div>
          <form class="filter-keyword-form" autocomplete="off" @submit.prevent="onApplyBrowseFilters">
            <van-search
              v-model="searchForm.filterKeywords"
              class="filter-keyword-input"
              :name="H5_SEARCH_FIELD_NAME"
              autocomplete="off"
              autocorrect="off"
              autocapitalize="off"
              :spellcheck="false"
              :placeholder="t('h5.pages.search.keywordPlaceholder')"
              @search="onApplyBrowseFilters"
            />
          </form>
        </div>
        <div class="filter-panel-body">
          <div class="filter-group">
            <div class="group-title">{{ t('h5.pages.search.filters.listMode') }}</div>
            <van-radio-group
              v-model="searchForm.isRandom"
              class="filter-options"
              direction="horizontal"
            >
              <van-radio
                v-for="o in listModeRadioOptions"
                :key="String(o.value)"
                :name="o.value"
              >
                {{ o.text }}
              </van-radio>
            </van-radio-group>
          </div>
          <div v-if="!searchForm.isRandom" class="filter-group">
            <div class="group-title">{{ t('pages.Setting.settingDataForm.sortField') }}</div>
            <van-radio-group
              v-model="searchForm.sortField"
              class="filter-options filter-options--sort"
              direction="horizontal"
            >
              <van-radio v-for="o in sortFieldRadioOptions" :key="o.value" :name="o.value">
                {{ o.text }}
              </van-radio>
            </van-radio-group>
          </div>
          <div v-if="!searchForm.isRandom" class="filter-group">
            <div class="group-title">{{ t('pages.Setting.settingDataForm.sortType') }}</div>
            <van-radio-group
              v-model="searchForm.sortType"
              class="filter-options"
              direction="horizontal"
            >
              <van-radio v-for="o in sortTypeRadioOptions" :key="o.value" :name="o.value">
                {{ o.text }}
              </van-radio>
            </van-radio-group>
          </div>
          <div class="filter-group">
            <div class="group-title">{{ t('exploreCommon.searchForm.filterType.placeholder') }}</div>
            <van-radio-group
              v-model="searchForm.filterType"
              class="filter-options"
              direction="horizontal"
            >
              <van-radio
                v-for="o in filterTypeDropdownOptions"
                :key="o.value"
                :name="o.value"
              >
                {{ o.text }}
              </van-radio>
            </van-radio-group>
          </div>
          <div class="filter-group">
            <div class="group-title">{{ t('exploreCommon.searchForm.orientation.placeholder') }}</div>
            <van-radio-group
              v-model="searchForm.orientation"
              class="filter-options"
              direction="horizontal"
            >
              <van-radio name="">{{ t('h5.pages.search.filters.all') }}</van-radio>
              <van-radio
                v-for="o in orientationOptions"
                :key="o.value"
                :name="String(o.value)"
              >
                {{ t(o.locale) }}
              </van-radio>
            </van-radio-group>
          </div>
          <div v-if="showBrowseQualityFilter" class="filter-group">
            <div class="group-title">{{ t('exploreCommon.searchForm.quality.placeholder') }}</div>
            <van-radio-group
              v-model="searchForm.quality"
              class="filter-options"
              direction="horizontal"
            >
              <van-radio name="">{{ t('h5.pages.search.filters.all') }}</van-radio>
              <van-radio v-for="q in qualityList" :key="q" :name="q">{{ q }}</van-radio>
            </van-radio-group>
          </div>
        </div>
        <div class="filter-actions">
          <van-button class="filter-reset-btn" plain @click="onResetBrowseFilters">
            <van-icon name="replay" />
          </van-button>
          <van-button class="filter-search-btn" type="primary" @click="onApplyBrowseFilters">
            <van-icon name="search" />
          </van-button>
        </div>
      </div>
    </van-popup>

    <H5PrivacyPasswordDialog ref="privacyPasswordDialogRef" />
  </div>
</template>

<style scoped lang="scss">
.page-browse-inner {
  position: relative;
  width: 100%;
  max-width: none;
  box-sizing: border-box;
  padding-bottom: var(--fbw-tabbar-height);
}
.page-browse.page-browse--fullscreen {
  height: 100vh;
  height: 100dvh;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
}
.page-browse--fullscreen .page-browse-inner {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}
.page-browse--fullscreen :deep(.van-pull-refresh) {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.page-browse--fullscreen :deep(.van-pull-refresh__track) {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}
.browse-pull-inner:not(.browse-pull-inner--fullscreen) {
  padding-top: 10px;
}
.browse-pull-inner--fullscreen {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}
.page-browse--fullscreen .fullscreen-slider {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}
.page-browse--fullscreen :deep(.virtual-list) {
  flex: 1;
  min-height: 0;
}
.fullscreen-slide {
  width: 100%;
  height: 100%;
  cursor: pointer;
  position: relative;
  box-sizing: border-box;
  background-color: rgba(0, 0, 0, 0.07);
}
.fullscreen-slide-media {
  position: absolute;
  inset: 0;
  z-index: 1;

  .fullscreen-slide-img {
    pointer-events: none;
    -webkit-user-drag: none;
    user-drag: none;
    touch-action: manipulation;
  }

  .media-touch-shield {
    z-index: 6;
  }
}
.fullscreen-slide-fallback {
  z-index: 2;
  color: var(--van-text-color-2);
  background: rgba(0, 0, 0, 0.06);
}
.fullscreen-slide-loading {
  position: absolute;
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%);
  z-index: 1;
}
.fullscreen-slide-img {
  width: 100%;
  height: 100%;
  display: block;
  object-position: center;
  opacity: 0;
  transition: opacity 0.2s ease;
}
.fullscreen-slide-img--ready {
  opacity: 1;
}
.fullscreen-slide-placeholder {
  width: 100%;
  height: 100%;
}
.fullscreen-slide-video-hint {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: none;
  color: rgba(255, 255, 255, 0.92);
  filter: drop-shadow(0 2px 8px rgba(0, 0, 0, 0.45));
}
.fullscreen-slide-play-icon {
  font-size: 56px;
  opacity: 0.82;
}

.chrome-mini-btn {
  width: 40px;
  height: 40px;
  min-width: 40px;
  border-radius: 50%;
  padding: 0;
  background: rgba(0, 0, 0, 0.45);
  backdrop-filter: blur(8px);
  border: none;
  color: #fff;
}
.chrome-mini-btn :deep(.van-icon) {
  color: #fff;
}
.browse-page-indicator--clickable {
  pointer-events: auto;
  cursor: pointer;
}
.favorite-toast-icon {
  width: 72px;
  height: 72px;
}
.favorite-toast-count {
  margin-top: 4px;
  font-size: 18px;
  font-weight: 600;
  color: gold;
  text-align: center;
}

.browse-page-indicator {
  padding: 4px 10px;
  border-radius: 999px;
  font-size: 13px;
  color: #fff;
  background: rgba(0, 0, 0, 0.45);
  pointer-events: none;
}
/* 顶栏基础样式见 h5/assets/styles/main.css */

.result-list {
  padding: 0 12px;
  display: flex;
  gap: 10px;
  align-items: flex-start;
}
.result-column {
  flex: 1;
  min-width: 0;
}
.result-list-wrap {
  padding-bottom: 12px;
}
.browse-skeleton--fullscreen {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.fullscreen-skeleton-slide {
  flex: 1;
  min-height: 240px;
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  padding: 24px 16px;
  box-sizing: border-box;
  background: rgba(0, 0, 0, 0.04);
}

.result-list-skeleton {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
  width: 100%;
}
.result-item {
  width: 100%;
  margin-bottom: 10px;
  padding: 0;
  background: #fff;
  border-radius: 10px;
  border: 1px solid rgba(0, 0, 0, 0.06);
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.04);
  overflow: hidden;
  break-inside: avoid;
  content-visibility: auto;
  contain-intrinsic-size: 280px;
  cursor: pointer;
  transition:
    transform 0.18s ease,
    box-shadow 0.18s ease,
    border-color 0.18s ease;
  -webkit-tap-highlight-color: transparent;
  transform: translateZ(0);

  &--pressing {
    transform: scale(0.97) translateZ(0);
    box-shadow: 0 1px 4px rgba(0, 0, 0, 0.1);
    border-color: rgba(0, 0, 0, 0.1);

    .preview-wrap::after {
      opacity: 1;
    }
  }
}
.preview-wrap > .h5-nsfw-content-mask,
.fullscreen-slide > .h5-nsfw-content-mask {
  z-index: 50;
}
.preview-wrap {
  border-radius: 0;
  overflow: hidden;
  background: rgba(0, 0, 0, 0.05);
  position: relative;

  &::after {
    content: '';
    position: absolute;
    inset: 0;
    z-index: 4;
    background: rgba(0, 0, 0, 0.1);
    opacity: 0;
    transition: opacity 0.18s ease;
    pointer-events: none;
  }
}
.preview-fallback {
  width: 100%;
  height: 100%;
  min-height: 120px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  gap: 8px;
  color: var(--van-text-color-2);
  background: rgba(0, 0, 0, 0.03);
}
.preview-fallback-text {
  font-size: 12px;
  line-height: 1.2;
  max-width: calc(100% - 20px);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  text-align: center;
}
.preview:not(.preview--inline-video),
.preview--poster-overlay {
  pointer-events: none;
  -webkit-user-drag: none;
  user-drag: none;
}
.preview {
  width: 100%;
  height: 100%;
  display: block;
  object-position: center;
  -webkit-touch-callout: none;
  -webkit-user-select: none;
  user-select: none;
  touch-action: manipulation;
}
.media-touch-shield {
  position: absolute;
  inset: 0;
  z-index: 5;
  background: transparent;
  -webkit-touch-callout: none;
  touch-action: manipulation;
}
.preview-wrap video,
.fullscreen-slide-media img,
.fullscreen-slide-video {
  -webkit-touch-callout: none;
  -webkit-user-select: none;
  user-select: none;
}
.preview-wrap--video .media-touch-shield {
  z-index: 2;
}
.preview-wrap--video {
  position: relative;
  cursor: pointer;
}
.preview-video-placeholder {
  width: 100%;
  height: 100%;
  min-height: 120px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--van-text-color-3);
  background: rgba(0, 0, 0, 0.06);
}
.preview--inline-video {
  position: relative;
  z-index: 1;
  width: 100%;
  height: 100%;
  display: block;
  object-position: center;
  background: #000;
}
.preview--poster-overlay,
.preview-fallback--overlay {
  position: absolute;
  inset: 0;
  z-index: 2;
}
.video-play-badge {
  position: absolute;
  inset: 0;
  z-index: 3;
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0;
  padding: 0;
  border: none;
  background: transparent;
  cursor: pointer;
  color: rgba(255, 255, 255, 0.58);
  filter: drop-shadow(0 1px 4px rgba(0, 0, 0, 0.35));
}
.preview-video-ph-icon {
  font-size: 40px;
  opacity: 0.55;
}
.video-play-badge-icon {
  font-size: 44px;
  opacity: 0.82;
}
.fullscreen-slide--video {
  position: relative;
}
.fullscreen-slide-video {
  width: 100%;
  height: 100%;
  display: block;
  object-position: center;
  background: #000;
}
.fullscreen-slide-video-btn {
  position: absolute;
  inset: 0;
  z-index: 2;
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0;
  padding: 0;
  border: none;
  background: transparent;
  cursor: pointer;
  color: rgba(255, 255, 255, 0.58);
  filter: drop-shadow(0 1px 4px rgba(0, 0, 0, 0.35));
}
.virtual-spacer {
  width: 100%;
}
.load-more-text {
  text-align: center;
  color: var(--van-text-color-3);
  font-size: 12px;
  padding: 8px 0 12px;
}

.image-info-backdrop {
  position: fixed;
  inset: 0;
  z-index: v-bind('H5_OVERLAY_Z.imageInfoBackdrop');
  background: rgba(0, 0, 0, 0.35);
}

.image-info-panel {
  z-index: v-bind('H5_OVERLAY_Z.imageInfoPanel');

  :deep(.van-floating-panel__content) {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    -webkit-overflow-scrolling: touch;
    touch-action: pan-y;
  }
}

.image-info-content {
  padding-bottom: env(safe-area-inset-bottom, 0px);
}
</style>

<!-- 预览 teleport 到 body，需非 scoped：禁用长按系统菜单/保存图片等 -->
<style lang="scss">
.h5-preview-error-hint {
  position: fixed;
  left: 50%;
  top: 50%;
  z-index: 2500;
  transform: translate(-50%, -50%);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  padding: 16px 20px;
  max-width: 80vw;
  border-radius: 12px;
  color: #fff;
  background: rgba(0, 0, 0, 0.72);
  pointer-events: auto;
}
.van-image-preview {
  -webkit-touch-callout: none;
}
.van-image-preview :deep(.van-image__error),
.van-image-preview :deep(.van-image__loading) {
  display: none;
}
.van-image-preview :deep(.van-swipe-item),
.van-image-preview__image {
  position: relative;
}
.van-image-preview img,
.van-image-preview__image img {
  pointer-events: none !important;
  -webkit-touch-callout: none !important;
  -webkit-user-select: none !important;
  -webkit-user-drag: none !important;
  user-select: none !important;
  touch-action: manipulation !important;
}
.van-image-preview :deep(.van-swipe-item)::after {
  content: '';
  position: absolute;
  inset: 0;
  z-index: 20;
  background: transparent;
  -webkit-touch-callout: none;
  touch-action: manipulation;
}

.browse-search-row {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1;
  min-width: 0;
}

.browse-search-form {
  flex: 1;
  min-width: 0;
  margin: 0;
}

.browse-search-input {
  width: 100%;
  padding: 0;
}

/* 隐私空间主题见 h5/assets/styles/main.css */

.chrome-mini-btn--active {
  color: #95d475 !important;
  box-shadow: inset 0 0 0 1px rgba(149, 212, 117, 0.45);
}

.browse-filters-popup :deep(.van-popup) {
  width: 100%;
  max-width: none;
  max-height: 60dvh;
  overflow: hidden;
}

.filter-panel {
  display: flex;
  flex-direction: column;
  width: 100%;
  max-width: none;
  max-height: 60dvh;
  padding: 16px 16px calc(16px + env(safe-area-inset-bottom, 0px));
  box-sizing: border-box;
}

.filter-panel-header {
  flex-shrink: 0;
}

.filter-panel-body {
  flex: 1 1 auto;
  min-height: 0;
  overflow-x: hidden;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
  overscroll-behavior: contain;
  margin: 0 -4px;
  padding: 0 4px;
}

.filter-title {
  margin-bottom: 12px;
  font-weight: 600;
  font-size: 15px;
}

.filter-keyword-form {
  margin: 0;
}

.filter-keyword-input {
  padding: 0;
  margin: 0;
}

.filter-keyword-input :deep(.van-search__content) {
  align-items: center;
}

.filter-group {
  padding: 10px 0;
  border-bottom: 1px solid var(--van-border-color);
}

.group-title {
  margin-bottom: 8px;
  font-size: 13px;
  color: var(--van-text-color-2);
}

.filter-options {
  display: flex;
  flex-wrap: wrap;
  gap: 10px 14px;
}

.filter-options :deep(.van-radio) {
  min-width: 96px;
}

.filter-actions {
  flex-shrink: 0;
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid var(--van-border-color);
  display: flex;
  gap: 10px;
}

.filter-reset-btn {
  width: 44px;
  min-width: 44px;
  padding: 0;
}

.filter-search-btn {
  flex: 1;
}
</style>
