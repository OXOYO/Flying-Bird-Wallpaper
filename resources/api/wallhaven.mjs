const { axios, ApiBase, calculateImageOrientation, calculateImageQuality } = global.FBW.apiHelpers
const RESOURCE_NAME = 'wallhaven'

export default class ResourceWallhaven extends ApiBase {
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
      site: 'https://wallhaven.cc/',
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
      supportSearchTypes: ['images'],
      // 搜索必要条件
      searchRequired: {
        keywords: false,
        orientation: false
      },
      // 是否支持下载
      supportDownload: true,
      // 下载必要条件
      downloadRequired: {
        keywords: false,
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
      q: query.keywords,
      page: query.startPage
    }

    const res = await axios.get('https://wallhaven.cc/api/v1/search', {
      params
    })
    if (res.status === 200 && res.data) {
      const resData = res.data
      ret.total = resData.meta.total
      ret.pageSize = resData.meta.per_page
      if (Array.isArray(resData.data)) {
        ret.list = resData.data.map((item) => {
          const url = new URL(item.path)
          const imageUrl = url.href
          const fileExt = item.file_type.split('/')[1] || url.pathname.split('.').pop()
          const quality = calculateImageQuality(item.dimension_x, item.dimension_y)
          const isLandscape = calculateImageOrientation(item.dimension_x, item.dimension_y)
          return {
            resourceName: this.resourceName,
            fileName: [this.resourceName, item.id].join('_'),
            fileExt,
            fileType: 'image',
            link: item.url,
            author: '',
            title: '',
            desc: '',
            imageUrl,
            quality,
            width: item.dimension_x,
            height: item.dimension_y,
            isLandscape
          }
        })
      }
    }

    return ret
  }

  async getHotTags(query) {
    // Wallhaven API没有直接提供热门标签端点，返回常用壁纸主题
    return [
      'nature',
      'landscape',
      'anime',
      'city',
      'space',
      'abstract',
      'cars',
      'gaming',
      'minimal',
      'mountain',
      'forest',
      'ocean',
      'sunset',
      'night',
      'technology',
      'art',
      'music',
      'movies',
      'sports',
      'animals',
      'flowers',
      'architecture'
    ]
  }
}
