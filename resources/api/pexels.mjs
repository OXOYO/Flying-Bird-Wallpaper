const { axios, ApiBase, calculateImageOrientation, calculateImageQuality } = global.FBW.apiHelpers
const RESOURCE_NAME = 'pexels'

export default class ResourcePexels extends ApiBase {
  constructor() {
    super(RESOURCE_NAME)
  }

  // 插件信息
  info() {
    return {
      // 插件名称
      label: RESOURCE_NAME,
      // 插件唯一标识
      value: RESOURCE_NAME,
      // 插件版本
      version: '1.0.0',
      // 插件描述
      description: '',
      // 插件作者
      author: 'OXOYO',
      // 插件i18n key
      locale: '',
      // 插件网站
      site: 'https://www.pexels.com/',
      // 是否启用
      enabled: true,
      // 是否远程，插件都是远程的
      remote: true,
      // 是否需要密钥
      requireSecretKey: true,
      // 密钥
      secretKey: '',
      // 是否支持搜索
      supportSearch: true,
      // 支持的搜索类型
      supportSearchTypes: ['images', 'videos'],
      // 搜索必要条件
      searchRequired: {
        keywords: true,
        orientation: false
      },
      // 是否支持下载
      supportDownload: true,
      // 下载必要条件
      downloadRequired: {
        keywords: true,
        orientation: false
      }
    }
  }

  async search(query) {
    let ret = {
      startPage: query.startPage,
      pageSize: query.pageSize,
      list: [],
      total: 0
    }

    const params = {
      query: query.keywords,
      per_page: query.pageSize,
      page: query.startPage
    }
    // 处理图片方向 横向 landscape, 纵向 portrait
    const orientation = Array.isArray(query.orientation) ? query.orientation : []
    if (orientation.length === 1) {
      params.orientation = orientation[0] === '1' ? 'landscape' : 'portrait'
    }
    // 查询类型 images || videos
    console.log('query.filterType', query.filterType)
    const filterType = query.filterType || 'images'
    const isImages = filterType === 'images'
    const isVideos = filterType === 'videos'
    const apiPath = isVideos
      ? 'https://api.pexels.com/videos/search'
      : 'https://api.pexels.com/v1/search'
    const payload = {
      params,
      headers: { Authorization: query.secretKey }
    }
    const res = await axios.get(apiPath, payload)
    if (res.status === 200 && res.data) {
      const resData = res.data
      ret.total = resData.total_results
      if (isImages) {
        if (Array.isArray(resData.photos)) {
          ret.list = resData.photos.map((item) => {
            let imageUrl = item.src.original.split('?')[0]
            const quality = calculateImageQuality(item.width, item.height)
            const isLandscape = calculateImageOrientation(item.width, item.height)
            return {
              resourceName: this.resourceName,
              fileName: [this.resourceName, item.id].join('_'),
              fileExt: imageUrl.split('.').pop(),
              fileType: 'image',
              link: item.url,
              author: item.photographer,
              title: item.alt,
              desc: '',
              imageUrl,
              quality,
              width: item.width,
              height: item.height,
              isLandscape
            }
          })
        }
      } else if (isVideos) {
        if (Array.isArray(resData.videos)) {
          ret.list = resData.videos.map((item) => {
            let imageUrl = item.image
            const videoItem = item.video_files[0]
            // TODO 此处应该改成处理Video的方法
            const quality = calculateImageQuality(videoItem.width, videoItem.height)
            const isLandscape = calculateImageOrientation(videoItem.width, videoItem.height)
            return {
              resourceName: this.resourceName,
              fileName: [this.resourceName, item.id].join('_'),
              fileExt: videoItem.link.split('.').pop(),
              fileType: 'video',
              link: item.url,
              author: item.user.name,
              title: item.alt,
              desc: '',
              imageUrl,
              videoUrl: videoItem.link,
              quality,
              width: videoItem.width,
              height: videoItem.height,
              isLandscape
            }
          })
        }
      }
    }

    return ret
  }
}
