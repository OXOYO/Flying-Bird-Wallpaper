const { axios, ApiBase, calculateImageOrientation, calculateImageQuality } = global.FBW.apiHelpers
const RESOURCE_NAME = 'smms'

export default class ResourceSMMS extends ApiBase {
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
      site: 'https://sm.ms',
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
      // q: query.keywords,
      page: query.startPage
      // page_size: query.pageSize
    }

    const res = await axios.get('https://sm.ms/api/v2/upload_history', {
      params,
      headers: {
        Accept: 'application/json',
        Authorization: `Basic ${query.secretKey}`
      }
    })
    if (res.status === 200 && res.data) {
      const resData = res.data
      const { Count, PerPage, CurrentPage, TotalPages } = resData
      if (CurrentPage < TotalPages) {
        ret.total = PerPage * TotalPages
      } else if (TotalPages > 1) {
        ret.total = PerPage * (TotalPages - 1) + Count
      } else {
        ret.total = Count
      }
      if (Array.isArray(resData.data)) {
        ret.list = resData.data.map((item) => {
          let url = item.url.split('?')[0]
          const quality = calculateImageQuality(item.width, item.height)
          const isLandscape = calculateImageOrientation(item.width, item.height)
          return {
            resourceName: this.resourceName,
            fileName: [this.resourceName, item.hash].join('_'),
            fileExt: url.split('.').pop(),
            link: item.url,
            author: '',
            title: '',
            desc: '',
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
