const { axios, ApiBase, calculateImageOrientation, calculateImageQuality } = global.FBW.apiHelpers
const RESOURCE_NAME = 'openverse'

export default class ResourceOpenverse extends ApiBase {
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
      site: 'https://openverse.org/',
      // 是否启用
      enabled: true,
      // 是否远程，插件都是远程的
      remote: true,
      // 是否需要密钥
      requireSecretKey: false,
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
      page: query.startPage,
      page_size: query.pageSize
    }
    // 处理图片方向 横向 wide, 纵向 tall
    const orientation = Array.isArray(query.orientation) ? query.orientation : []
    if (orientation.length === 1) {
      params.aspect_ratio = orientation[0] === '1' ? 'wide' : 'tall'
    }

    const res = await axios.get('https://api.openverse.org/v1/images', {
      params,
      headers: {
        Accept: 'application/json'
      }
    })
    if (res.status === 200 && res.data) {
      const resData = res.data
      ret.total = resData.result_count
      if (Array.isArray(resData.results)) {
        ret.list = resData.results.map((item) => {
          const url = new URL(item.url)
          const imageUrl = url.href
          const quality = calculateImageQuality(item.width, item.height)
          const isLandscape = calculateImageOrientation(item.width, item.height)
          return {
            resourceName: this.resourceName,
            fileName: [this.resourceName, item.id].join('_'),
            fileExt: item.filetype,
            fleType: 'image',
            link: '',
            author: item.creator,
            title: item.title,
            desc: '',
            imageUrl,
            quality,
            width: item.width,
            height: item.height,
            isLandscape
          }
        })
      }
    }

    return ret
}

async getHotTags(query) {
  // Openverse API没有直接提供热门标签端点，返回常用开源图片主题
  return [
    'nature', 'landscape', 'animals', 'plants', 'technology', 'art', 
    'science', 'education', 'business', 'food', 'travel', 'people',
    'architecture', 'music', 'sports', 'health', 'space', 'environment', 'history', 'culture'
  ]
}
}
