const { axios, ApiBase, calculateImageOrientation, calculateImageQuality } = global.FBW.apiHelpers
const RESOURCE_NAME = 'bing'

const getImageInfo = (url) => {
  // 使用正则表达式匹配图片的宽高和格式
  const regex = /(\d+)x(\d+)\.([a-zA-Z]+)/
  const match = url.match(regex)

  if (match) {
    const width = parseInt(match[1], 10)
    const height = parseInt(match[2], 10)
    const format = match[3]

    return {
      width: width,
      height: height,
      format: format
    }
  } else {
    return null // 如果没有匹配到，返回null
  }
}

export default class ResourceBing extends ApiBase {
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
      site: 'https://cn.bing.com/',
      // 是否启用
      enabled: false,
      // 是否远程，插件都是远程的
      remote: true,
      // 是否需要密钥
      requireSecretKey: false,
      // 密钥
      secretKey: '',
      // 是否支持搜索
      supportSearch: false,
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
      format: 'js',
      idx: '0',
      n: 1
    }

    const res = await axios.get('https://cn.bing.com/HPImageArchive.aspx', {
      params
    })
    if (res.status === 200 && res.data) {
      ret.total = res.data.images.length
      if (Array.isArray(res.data.images)) {
        res.data.images.forEach((item) => {
          const url = 'https://cn.bing.com' + item.url
          const imageInfo = getImageInfo(url)

          let quality = ''
          let isLandscape = 1
          if (imageInfo) {
            quality = calculateImageQuality(imageInfo.width, imageInfo.height)
            isLandscape = calculateImageOrientation(imageInfo.width, imageInfo.height)
          }

          ret.list.push({
            resourceName: this.resourceName,
            fileName: [this.resourceName, item.hash].join('_'),
            fileExt: imageInfo.format,
            link: '',
            author: '',
            title: item.title,
            desc: '',
            url,
            quality,
            width: imageInfo.width,
            height: imageInfo.height,
            isLandscape
          })
        })
      }
    }

    return ret
  }
}
