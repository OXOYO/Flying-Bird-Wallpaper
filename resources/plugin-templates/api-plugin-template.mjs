/**
 * API插件模板
 * 将此文件复制到用户插件目录并修改以创建新的API插件
 * 用户插件目录:
 * Mac: ~/Library/Application Support/Flying Bird Wallpaper/plugins/api/
 * Windows: %APPDATA%\Flying Bird Wallpaper\plugins\api\
 * Linux: ~/.config/Flying Bird Wallpaper/plugins/api/
 */

// 导入必要的基类和工具
// 在主进程中，可以通过global.FBW.apiHelpers获取
const { axios, ApiBase, calculateImageOrientation, calculateImageQuality } = global.FBW.apiHelpers

const RESOURCE_NAME = 'api-plugin-template'

export default class YourApiPlugin extends ApiBase {
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
      author: '',
      // 插件i18n key
      locale: '',
      // 插件网站
      site: '',
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
      // 是否支持下载
      supportDownload: false
    }
  }

  async search(query) {
    // 返回的结果格式
    let ret = {
      startPage: query.startPage,
      pageSize: query.pageSize,
      list: [],
      total: 0
    }

    try {
      // 实现你的API搜索逻辑
      const params = {
        // 根据你的API需求设置参数
        query: query.keywords,
        per_page: query.pageSize,
        page: query.startPage
      }

      // 查询类型 images || videos
      const filterType = query.filterType || 'images'
      const isImages = filterType === 'images'
      const isVideos = filterType === 'videos'

      // 接口地址
      const apiPath = isVideos
        ? 'https://your-api-endpoint.com/videos/search'
        : 'https://your-api-endpoint.com/images/search'

      const res = await axios.get(apiPath, {
        params,
        // 如果需要认证
        headers: { Authorization: `Bearer ${query.secretKey}` }
      })

      if (res.status === 200 && res.data) {
        // 解析API响应
        const resData = res.data
        ret.total = resData.total || 0

        if (isImages) {
          if (Array.isArray(resData.images)) {
            ret.list = resData.images.map((item) => {
              const imageUrl = item.image_url
              const fileExt = item.file_ext
              const quality = calculateImageQuality(item.width, item.height)
              const isLandscape = calculateImageOrientation(item.width, item.height)

              return {
                resourceName: this.resourceName,
                fileName: [this.resourceName, item.id].join('_'),
                fileExt,
                fileType: 'image',
                link: item.page_url || '',
                author: item.author || '',
                title: item.title || '',
                desc: item.description || '',
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
              const imageUrl = item.image_url
              const videoUrl = item.video_url
              const fileExt = item.file_ext
              const quality = calculateImageQuality(item.width, item.height)
              const isLandscape = calculateImageOrientation(item.width, item.height)

              return {
                resourceName: this.resourceName,
                fileName: [this.resourceName, item.id].join('_'),
                fileExt,
                fileType: 'video',
                link: item.page_url || '',
                author: item.author || '',
                title: item.title || '',
                desc: item.description || '',
                imageUrl,
                videoUrl,
                quality,
                width: item.width,
                height: item.height,
                isLandscape
              }
            })
          }
        }
      }
    } catch (error) {
      console.error('API搜索失败:', error)
    }

    return ret
  }
}
