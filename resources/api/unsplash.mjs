const { axios, ApiBase, calculateImageOrientation, calculateImageQuality } = global.FBW.apiHelpers
const RESOURCE_NAME = 'unsplash'

export default class ResourceUnsplash extends ApiBase {
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
      site: 'https://unsplash.com/',
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
      // 是否支持下载
      supportDownload: true
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

    const res = await axios.get('https://api.unsplash.com/search/photos', {
      params,
      headers: { Authorization: `Client-ID ${query.secretKey}` }
    })

    if (res.status === 200 && res.data) {
      const resData = res.data
      ret.total = resData.total
      if (Array.isArray(resData.results)) {
        ret.list = resData.results.map((item) => {
          const url = item.urls.raw.split('?')[0]
          const quality = calculateImageQuality(item.width, item.height)
          const isLandscape = calculateImageOrientation(item.width, item.height)
          return {
            resourceName: this.resourceName,
            fileName: [this.resourceName, item.id].join('_'),
            fileExt: 'jpg',
            link: item.links.html,
            author: item.user.name,
            title: item.slug,
            desc: item.description,
            url,
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
}
