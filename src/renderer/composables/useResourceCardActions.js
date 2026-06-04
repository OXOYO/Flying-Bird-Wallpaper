import { h, reactive, ref, toRaw } from 'vue'
import clipboard from 'clipboardy'
import { useTranslation } from 'i18next-vue'
import { storeToRefs } from 'pinia'
import { ElCheckbox } from 'element-plus'
import UseSettingStore from '@renderer/stores/settingStore.js'
import { applyExploreImageSrc, supportsAiVisionActions } from '@renderer/utils/resourceImageUrl.js'
import { hex2RGB } from '@renderer/utils/gen-color.js'
import { cloneForIpc } from '@renderer/utils/cloneForIpc.js'
import {
  applyFavoriteResourceToItem,
  applyResourceRowToItem,
  applyResolvedResourceFromResult,
  applyUnfavoriteToItem,
  resolveResourceSrcType
} from '@common/favoriteResourceUtils.js'
import { resolveFindSimilarEmptyMessage } from '@common/findSimilarUtils.js'

export function normalizeResourceItem(item, options = {}) {
  if (!item) return item
  const row = { ...item }
  const id = row.id ?? row.resourceId
  if (!row.uniqueKey && id != null) row.uniqueKey = String(id)
  row.srcType = resolveResourceSrcType(row)
  if (options.resourceType === 'remoteResource' && options.resourceName) {
    row.resourceName = options.resourceName
  }
  if (options.resourceType) {
    row.resourceType = options.resourceType
  }
  const { rawImageUrl, imageSrc } = applyExploreImageSrc(row, {
    resourceType: options.resourceType ?? 'localResource',
    gridHWRatio: options.gridHWRatio ?? 0.618
  })
  if (rawImageUrl) {
    row.rawImageUrl = rawImageUrl
    row.imageSrc = imageSrc
  }
  if (!row.videoSrc && row.fileType === 'video' && row.filePath) {
    row.videoSrc = `fbwtp://fbw/api/videos/get?filePath=${encodeURIComponent(row.filePath)}`
  }
  if (row.dominantColor && !row.dominantColorRgb) {
    row.dominantColorRgb = hex2RGB(row.dominantColor)
  }
  return row
}

export function buildResourceCardButtons(item, context, t) {
  if (!item) return []
  const {
    inPrivacySpace = false,
    isFavoritesMenu = false,
    isSearchMenu = false,
    isLocalResource = true
  } = context

  const ret = [
    {
      title: t('exploreCommon.setAsWallpaperWithDownload'),
      action: 'setAsWallpaperWithDownload',
      icon: 'custom:wallpaper'
    }
  ]
  if (item.fileType === 'image') {
    ret.push(
      { title: t('exploreCommon.doViewImage'), action: 'doViewImage', icon: 'custom:preview' }
    )
  }
  if (supportsAiVisionActions(item)) {
    ret.push(
      {
        title: t('exploreCommon.aiAnalyze'),
        action: 'aiAnalyze',
        icon: 'custom:ai-sparkles'
      },
      { title: t('exploreCommon.findSimilar'), action: 'findSimilar', icon: 'custom:find-similar' }
    )
  }
  if (item.isFavorite) {
    ret.push({
      title: t('exploreCommon.removeFavorites'),
      action: 'removeFavorites',
      icon: 'custom:star-fill'
    })
  } else {
    ret.push({
      title: t('exploreCommon.addToFavorites'),
      action: 'addToFavorites',
      icon: 'custom:star'
    })
  }
  if (!inPrivacySpace) {
    ret.push({
      title: t('exploreCommon.addToPrivacySpace'),
      action: 'addToPrivacySpace',
      icon: 'custom:privacy-tip-outline'
    })
  }
  if (isFavoritesMenu && inPrivacySpace) {
    ret.push({
      title: t('exploreCommon.removePrivacySpace'),
      action: 'removePrivacySpace',
      icon: 'custom:privacy-tip'
    })
  }
  if (item.filePath && (!isSearchMenu || (isSearchMenu && isLocalResource))) {
    ret.push(
      { title: t('exploreCommon.onCopyFilePath'), action: 'onCopyFilePath', icon: 'custom:copy' },
      { title: t('exploreCommon.onDeleteFile'), action: 'onDeleteFile', icon: 'custom:delete-line' },
      { title: t('exploreCommon.showItemInFolder'), action: 'showItemInFolder', icon: 'custom:folder-opened' }
    )
  }
  if (item.link) {
    ret.push({ title: t('exploreCommon.openLink'), action: 'openLink', icon: 'custom:link' })
  }
  if (item.srcType === 'url') {
    ret.push({
      title: t('exploreCommon.onDownloadFile'),
      action: 'onDownloadFile',
      icon: 'custom:download-line'
    })
  }
  ret.push({
    title: t('exploreCommon.viewInfo'),
    action: 'onViewInfo',
    icon: 'custom:info-outline-rounded'
  })
  return ret
}

/**
 * 与 ExploreCommon 卡片一致的资源操作
 * @param {object} options
 * @param {() => Array} options.getList
 * @param {(list: Array) => void} [options.setList]
 * @param {(item: object, index: number) => void} [options.onItemUpdated]
 * @param {(item: object, index: number) => void} [options.onItemRemoved]
 * @param {import('vue').Ref} [options.viewImageRef]
 * @param {import('vue').Ref} [options.viewInfoRef]
 * @param {() => object} [options.cardContext]
 * @param {(items: Array) => void} [options.onFindSimilarResult]
 * @param {() => object|null|undefined} [options.getSimilarScope]
 */
export function useResourceCardActions(options = {}) {
  const { t } = useTranslation()
  const settingStore = UseSettingStore()
  const { settingData } = storeToRefs(settingStore)

  const hoverCardIndex = ref(-1)
  const cardItemStatus = reactive({ index: -1, status: null })
  const viewSize = 5

  const getList = () => options.getList?.() || []
  const setList = (list) => options.setList?.(list)

  const cardContext = () =>
    options.cardContext?.() || {
      inPrivacySpace: false,
      isFavoritesMenu: false,
      isSearchMenu: false,
      isLocalResource: true
    }

  const getButtons = (item) => buildResourceCardButtons(item, cardContext(), t)

  const resolveListIndex = (item, index) => {
    const list = getList()
    if (!list.length) return -1
    if (index >= 0 && index < list.length && list[index]?.uniqueKey === item.uniqueKey) return index
    let i = list.findIndex((r) => r.uniqueKey === item.uniqueKey)
    if (i >= 0) return i
    if (item.id != null) i = list.findIndex((r) => r.id === item.id)
    return i
  }

  const setCardItemStatus = (index, status, callback) => {
    cardItemStatus.index = index
    cardItemStatus.status = status
    setTimeout(() => {
      cardItemStatus.index = -1
      cardItemStatus.status = null
      typeof callback === 'function' && callback()
    }, 300)
  }

  const patchListItem = (item, index, patch) => {
    const rowIndex = resolveListIndex(item, index)
    const list = [...getList()]
    if (rowIndex >= 0) {
      list[rowIndex] = { ...list[rowIndex], ...patch }
      setList(list)
      options.onItemUpdated?.(list[rowIndex], rowIndex)
    } else {
      options.onItemUpdated?.({ ...item, ...patch }, index)
    }
  }

  const removeListItem = (item, index) => {
    const rowIndex = resolveListIndex(item, index)
    const list = [...getList()]
    if (rowIndex >= 0) {
      list.splice(rowIndex, 1)
      setList(list)
      options.onItemRemoved?.(item, rowIndex)
    } else {
      options.onItemRemoved?.(item, index)
    }
  }

  const getViewRecords = (startIndex, size = viewSize) => {
    const list = getList()
    const len = list.length
    if (len <= size) return toRaw(list)
    startIndex = Math.max(0, Math.min(startIndex, len - 1))
    const start = Math.max(0, startIndex - Math.floor(size / 2))
    const end = Math.min(len, startIndex + Math.floor((size - 1) / 2 + 1))
    return toRaw(list).slice(start, end)
  }

  const doViewImage = async (item, index, inner = false) => {
    const list = cloneForIpc(getViewRecords(index, viewSize))
    const activeIndex = list.findIndex((i) => i.uniqueKey === item.uniqueKey)
    if (inner && options.viewImageRef?.value) {
      options.viewImageRef.value.view(activeIndex, list)
    } else {
      window.FBW.openViewImageWindow({ activeIndex, list })
    }
  }

  const onViewImagePrevMore = (item) => {
    const list = getList()
    const index = list.findIndex((i) => i.uniqueKey === item.uniqueKey)
    let empty = false
    if (index <= 0) {
      empty = true
    } else {
      let end = index < 0 ? 0 : index
      let start = Math.max(0, end - viewSize)
      if (end - start < viewSize) start = 0
      const slice = cloneForIpc(toRaw(list).slice(start, end))
      if (slice.length) {
        const activeIndex = Math.max(0, slice.findIndex((i) => i.uniqueKey === item.uniqueKey) - 1)
        options.viewImageRef?.value?.prepend(activeIndex, slice)
      } else {
        empty = true
      }
    }
    if (empty) {
      ElMessage({ type: 'warning', message: t('messages.noMoreData') })
      options.viewImageRef?.value?.resetLoading()
    }
  }

  const onViewImageNextMore = (item) => {
    const list = getList()
    const index = list.findIndex((i) => i.uniqueKey === item.uniqueKey)
    let empty = false
    if (index < 0 || index >= list.length - 1) {
      empty = true
    } else {
      const start = index + 1
      let end = start + viewSize
      if (end > list.length) {
        start = Math.max(0, list.length - viewSize)
        end = list.length
      }
      const slice = cloneForIpc(toRaw(list).slice(start, end))
      if (slice.length) {
        const ti = slice.findIndex((i) => i.uniqueKey === item.uniqueKey)
        const activeIndex = ti < slice.length - 1 ? ti + 1 : 0
        options.viewImageRef?.value?.append(activeIndex, slice)
      } else {
        empty = true
      }
    }
    if (empty) {
      ElMessage({ type: 'warning', message: t('messages.noMoreData') })
      options.viewImageRef?.value?.resetLoading()
    }
  }

  const setAsWallpaperWithDownload = async (item, index) => {
    const res = await window.FBW.setAsWallpaperWithDownload(cloneForIpc(item))
    if (res?.success && res.data) {
      applyResourceRowToItem(item, res.data)
      patchListItem(item, index, { ...item })
    }
    ElMessage({
      type: res?.success ? 'success' : 'error',
      message: res?.message || (res?.success ? t('messages.operationSuccess') : t('messages.operationFail'))
    })
    setCardItemStatus(index, res?.success ? 'success' : 'error')
  }

  const onAiAnalyze = async (item, index) => {
    if (!item) return
    const res = await window.FBW.analyzeResource({ id: item.id, item: cloneForIpc(item) })
    ElMessage({
      type: res?.success ? 'success' : 'error',
      message: res?.message || (res?.success ? t('messages.operationSuccess') : t('messages.operationFail'))
    })
    if (res?.success) {
      applyResolvedResourceFromResult(item, res)
      patchListItem(item, index, {
        ...item,
        ...(res.data && typeof res.data === 'object' ? res.data : {}),
        score: res.data?.score ?? item.score,
        aiAnalysisStatus: 'done'
      })
    }
    setCardItemStatus(index, res?.success ? 'success' : 'error')
  }

  const onFindSimilar = async (item) => {
    if (!item?.id) return
    const scope = options.getSimilarScope?.() ?? null
    const pageSize = Math.max(1, Number(options.getSimilarPageSize?.()) || 50)
    const plainScope = scope && typeof scope === 'object' ? cloneForIpc(scope) : null
    const res = await window.FBW.findSimilar({
      resourceId: Number(item.id),
      item: cloneForIpc(item),
      limit: pageSize,
      excludeIds: [],
      ...(plainScope ? { scope: plainScope } : {})
    })
    if (res?.success) {
      applyResolvedResourceFromResult(item, res)
    }
    if (res?.success && res.data?.list?.length) {
      const list = res.data.list.map((row) => normalizeResourceItem(row))
      options.onFindSimilarResult?.(list, item, {
        total: res.data?.total
      })
    } else if (res?.success) {
      ElMessage({
        type: 'info',
        message: resolveFindSimilarEmptyMessage(t, res.data?.emptyReason)
      })
    }
  }

  const addToFavorites = async (item, index, isPrivacySpace = false) => {
    const res = await window.FBW.addToFavorites(cloneForIpc(item), isPrivacySpace)
    if (res?.success) {
      applyFavoriteResourceToItem(item, res)
      const patch = { ...item, isFavorite: item.isFavorite ?? 1 }
      if (patch.fileType === 'video' && patch.filePath && !patch.videoSrc) {
        patch.videoSrc = `fbwtp://fbw/api/videos/get?filePath=${encodeURIComponent(patch.filePath)}`
      }
      patchListItem(item, index, patch)
    }
    setCardItemStatus(index, res?.success ? 'success' : 'error')
  }

  const removeFavorites = async (item, index, isPrivacySpace = false) => {
    const res = await window.FBW.removeFavorites(cloneForIpc(item), isPrivacySpace)
    if (res?.success) {
      applyUnfavoriteToItem(item, res)
      patchListItem(item, index, { isFavorite: 0, favorites: item.favorites ?? 0 })
    }
    setCardItemStatus(index, res?.success ? 'success' : 'error')
  }

  const onCopyFilePath = (filePath) => {
    clipboard
      .write(filePath)
      .then(() => ElMessage({ type: 'success', message: t('messages.copySuccess') }))
      .catch(() => ElMessage({ type: 'error', message: t('messages.copyFail') }))
  }

  const onDeleteFile = (item, index) => {
    const onConfirmDeleteFile = async () => {
      const res = await window.FBW.deleteFile(cloneForIpc(item))
      if (res?.success) {
        removeListItem(item, index)
      }
      setCardItemStatus(index, res?.success ? 'success' : 'error')
    }
    if (settingData.value.confirmOnDeleteFile) {
      ElMessageBox({
        type: 'warning',
        draggable: true,
        showCancelButton: true,
        message: h('div', { style: { marginTop: '20px' } }, [
          h('div', null, t('messages.confirmDelete')),
          h(ElCheckbox, {
            label: t('pages.Setting.settingDataForm.confirmOnDeleteFile'),
            checked: settingData.value.confirmOnDeleteFile,
            'onUpdate:modelValue': async (val) => {
              const r = await window.FBW.updateSettingData({ confirmOnDeleteFile: val })
              if (r?.success) settingStore.updateSettingData(r.data)
            }
          })
        ])
      }).then(onConfirmDeleteFile)
    } else {
      onConfirmDeleteFile()
    }
  }

  const onDownloadFile = async (item, index) => {
    const res = await window.FBW.downloadFile(cloneForIpc(item))
    if (res?.success && res.data) {
      applyResourceRowToItem(item, res.data)
      patchListItem(item, index, { ...item })
    }
    ElMessage({
      type: res?.success ? 'success' : 'error',
      message: res?.message || (res?.success ? t('messages.operationSuccess') : t('messages.operationFail'))
    })
    setCardItemStatus(index, res?.success ? 'success' : 'error')
  }

  const onViewInfo = (item) => {
    options.viewInfoRef?.value?.view(toRaw(item))
  }

  const onCardAction = (action, item, index) => {
    switch (action) {
      case 'setAsWallpaperWithDownload':
        setAsWallpaperWithDownload(item, index)
        break
      case 'doViewImage':
        doViewImage(item, index)
        break
      case 'addToFavorites':
        addToFavorites(item, index)
        break
      case 'removeFavorites':
        removeFavorites(item, index)
        break
      case 'addToPrivacySpace':
        addToFavorites(item, index, true)
        break
      case 'removePrivacySpace':
        removeFavorites(item, index, true)
        break
      case 'onCopyFilePath':
        onCopyFilePath(item.filePath)
        break
      case 'onDeleteFile':
        onDeleteFile(item, index)
        break
      case 'onDownloadFile':
        onDownloadFile(item, index)
        break
      case 'showItemInFolder':
        window.FBW.showItemInFolder(item.filePath)
        break
      case 'openLink':
        window.open(item.link, '_blank')
        break
      case 'onViewInfo':
        onViewInfo(item)
        break
      case 'aiAnalyze':
        onAiAnalyze(item, index)
        break
      case 'findSimilar':
        onFindSimilar(item)
        break
      default:
        break
    }
  }

  const onDblClickCard = (item, index) => {
    if (item.fileType === 'image') {
      doViewImage(item, index, true)
    }
  }

  return {
    hoverCardIndex,
    cardItemStatus,
    getButtons,
    onCardAction,
    onDblClickCard,
    onViewImagePrevMore,
    onViewImageNextMore,
    normalizeResourceItem
  }
}
