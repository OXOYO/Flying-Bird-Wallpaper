const { axios, ApiBase, calculateImageOrientation, calculateImageQuality } = global.FBW.apiHelpers
const RESOURCE_NAME = 'nasa'

export default class ResourceNasa extends ApiBase {
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
      site: 'https://nasa.gov/',
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
      q: query.keywords,
      media_type: 'image',
      page_size: query.pageSize,
      page: query.startPage
    }

    const res = await axios.get('https://images-api.nasa.gov/search', {
      params
    })
    if (res.status === 200 && res.data) {
      const resData = res.data.collection
      ret.total = resData.metadata.total_hits
      if (Array.isArray(resData.items)) {
        resData.items.forEach((item) => {
          const infoData = item.data[0]
          const imgData = item.links.find((linkItem) => linkItem.rel === 'canonical')

          if (infoData && imgData) {
            let url = imgData.href.split('?')[0]
            const quality = calculateImageQuality(imgData.width, imgData.height)
            const isLandscape = calculateImageOrientation(imgData.width, imgData.height)

            ret.list.push({
              resourceName: this.resourceName,
              fileName: [this.resourceName, infoData?.nasa_id].join('_'),
              fileExt: url.split('.').pop(),
              link: '',
              author: '',
              title: infoData?.title,
              desc: infoData?.description,
              url,
              quality,
              width: imgData.width,
              height: imgData.height,
              isLandscape
            })
          }
        })
      }
    }

    return ret
  }
}
