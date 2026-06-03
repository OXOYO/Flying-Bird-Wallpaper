import { buildH5LocalImageUrl } from '@h5/utils/imageUrl.js'

/** 合集等直连 DB 的行无 srcType，需与桌面 normalizeResourceItem 一致推断 */
const resolveBrowseSrcType = (item) => {
  if (item?.srcType) return item.srcType
  if (item?.filePath) return 'file'
  if (item?.link || item?.videoUrl || item?.imageUrl) return 'url'
  return 'file'
}

export const normalizeBrowseItem = (item) => {
  if (!item) return item

  const row = {
    ...item,
    id: item.resourceId ?? item.id,
    srcType: resolveBrowseSrcType(item)
  }
  const isVideo = row.fileType === 'video'

  if (isVideo) {
    let posterRaw = ''
    let videoSrc = ''

    if (row.srcType === 'file') {
      videoSrc = `/api/videos/get?filePath=${encodeURIComponent(row.filePath)}`
      if (row.posterPath) {
        posterRaw = buildH5LocalImageUrl(row.posterPath)
      } else {
        const iu = row.imageUrl || ''
        if (iu) {
          posterRaw = /^https?:\/\//i.test(iu) ? iu : buildH5LocalImageUrl(iu)
        }
      }
    } else {
      videoSrc = row.videoUrl || ''
      posterRaw = row.imageUrl || ''
    }

    return {
      ...row,
      isVideo: true,
      posterSrc: posterRaw,
      posterRawSrc: posterRaw,
      videoSrc,
      imageSrc: posterRaw,
      imageRawSrc: posterRaw
    }
  }

  if (row.srcType === 'file' && row.filePath) {
    const rawUrl = buildH5LocalImageUrl(row.filePath)
    return {
      ...row,
      isVideo: false,
      posterSrc: '',
      posterRawSrc: '',
      videoSrc: '',
      imageSrc: rawUrl,
      imageRawSrc: rawUrl
    }
  }
  return {
    ...row,
    isVideo: false,
    posterSrc: '',
    posterRawSrc: '',
    videoSrc: '',
    imageSrc: row.imageUrl || '',
    imageRawSrc: row.imageUrl || ''
  }
}

export const getBrowseItemKey = (item) =>
  String(item?.id || item?.uniqueKey || item?.filePath || item?.videoSrc || item?.imageSrc || '')

export const getBrowseListDedupKey = (item) => {
  if (item?.id != null && item.id !== '') return `id:${item.id}`
  if (item?.fileName) return `fn:${item.fileName}`
  if (item?.filePath) return `fp:${item.filePath}`
  const url =
    item?.imageRawSrc ||
    item?.imageSrc ||
    item?.imageUrl ||
    item?.posterRawSrc ||
    item?.posterSrc ||
    item?.videoSrc ||
    item?.videoUrl ||
    ''
  if (url) return `url:${url}`
  if (item?.uniqueKey) return `uk:${item.uniqueKey}`
  return ''
}
