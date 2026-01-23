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
          const sizeList = item.links
            .map((linkItem) => linkItem.size)
            .filter((size) => !isNaN(size))
          const maxSize = Math.max(...sizeList) + ''
          const imgData = item.links.find((linkItem) => linkItem.size + '' === maxSize)

          if (infoData && imgData) {
            const url = new URL(imgData.href)
            const imageUrl = url.href
            const fileExt = url.pathname.split('.').pop()
            const quality = calculateImageQuality(imgData.width, imgData.height)
            const isLandscape = calculateImageOrientation(imgData.width, imgData.height)

            ret.list.push({
              resourceName: this.resourceName,
              fileName: [this.resourceName, infoData?.nasa_id].join('_'),
              fileExt,
              fileType: 'image',
              link: '',
              author: '',
              title: infoData?.title,
              desc: infoData?.description,
              imageUrl,
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

async getHotTags(query) {
  // NASA API没有直接提供热门标签端点，返回太空相关主题标签
  return [
    'space', 'planets', 'nebula', 'galaxy', 'astronauts', 'moon', 
    'sun', 'stars', 'cosmos', 'spacecraft', 'satellite', 'black hole',
    'milky way', 'jupiter', 'mars', 'venus', 'saturn', 'earth', 'asteroid', 'comet'
  ]
}
}
