const { axios, ApiBase, calculateImageOrientation, calculateImageQuality } = global.FBW.apiHelpers
const RESOURCE_NAME = 'pixabay'

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
      site: 'https://www.pixabay.com/',
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
      key: query.secretKey,
      q: query.keywords,
      per_page: query.pageSize,
      page: query.startPage
    }
    // 处理图片方向 横向 horizontal, 纵向 portrait
    const orientation = Array.isArray(query.orientation) ? query.orientation : []
    if (orientation.length === 1) {
      params.orientation = orientation[0] === '1' ? 'horizontal' : 'vertical'
    }

    const res = await axios.get('https://pixabay.com/api', {
      params
    })
    if (res.status === 200 && res.data) {
      const resData = res.data
      ret.total = resData.total
      if (Array.isArray(resData.hits)) {
        ret.list = resData.hits.map((item) => {
          let url = (item.imageURL || item.largeImageURL).split('?')[0]
          const quality = calculateImageQuality(item.imageWidth, item.imageHeight)
          const isLandscape = calculateImageOrientation(item.imageWidth, item.imageHeight)
          return {
            resourceName: this.resourceName,
            fileName: [this.resourceName, item.id].join('_'),
            fileExt: url.split('.').pop(),
            link: item.pageURL,
            author: item.user,
            title: '',
            desc: '',
            url,
            quality,
            width: item.imageWidth,
            height: item.imageHeight,
            isLandscape
          }
        })
      }
    }

    return ret
  }
}
