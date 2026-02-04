/**
 * 小鸟壁纸  http://birdpaper.com.cn/
 *
 * 接口：
 *
 * 最新列表：http://wp.birdpaper.com.cn/intf/newestList?pageno=1&count=10
 *
 * 分类列表：
 * http://wp.birdpaper.com.cn/intf/GetListByCategory?cids=36&pageno=1&count=10      //4K
 * http://wp.birdpaper.com.cn/intf/GetListByCategory?cids=6&pageno=1&count=10       //美女
 * http://wp.birdpaper.com.cn/intf/GetListByCategory?cids=30&pageno=1&count=10      //爱情
 * http://wp.birdpaper.com.cn/intf/GetListByCategory?cids=9&pageno=1&count=10       //风景
 * http://wp.birdpaper.com.cn/intf/GetListByCategory?cids=15&pageno=1&count=10      //小清新
 * http://wp.birdpaper.com.cn/intf/GetListByCategory?cids=26&pageno=1&count=10      //动漫
 * http://wp.birdpaper.com.cn/intf/GetListByCategory?cids=11&pageno=1&count=10      //明星
 * http://wp.birdpaper.com.cn/intf/GetListByCategory?cids=14&pageno=1&count=10      //萌宠
 * http://wp.birdpaper.com.cn/intf/GetListByCategory?cids=5&pageno=1&count=10       //游戏
 * http://wp.birdpaper.com.cn/intf/GetListByCategory?cids=12&pageno=1&count=10      //汽车
 * http://wp.birdpaper.com.cn/intf/GetListByCategory?cids=10&pageno=1&count=10      //更多->炫酷时尚
 * http://wp.birdpaper.com.cn/intf/GetListByCategory?cids=29&pageno=1&count=10      //更多->月历壁纸
 * http://wp.birdpaper.com.cn/intf/GetListByCategory?cids=7&pageno=1&count=10       //更多->影视剧照
 * http://wp.birdpaper.com.cn/intf/GetListByCategory?cids=13&pageno=1&count=10      //更多->节日美图
 * http://wp.birdpaper.com.cn/intf/GetListByCategory?cids=22&pageno=1&count=10      //更多->军事天地
 * http://wp.birdpaper.com.cn/intf/GetListByCategory?cids=16&pageno=1&count=10      //更多->劲爆体育
 * http://wp.birdpaper.com.cn/intf/GetListByCategory?cids=18&pageno=1&count=10      //更多->BABY秀
 * http://wp.birdpaper.com.cn/intf/GetListByCategory?cids=35&pageno=1&count=10      //更多->文字控
 *
 * 分tag图片列表：tag获取不同的选项壁纸
 * http://wp.birdpaper.com.cn/intf/GetListByHotTag?tag=秦时明月&pageno=1&count=10     //秦时明月
 * http://wp.birdpaper.com.cn/intf/GetListByHotTag?tag=国漫&pageno=1&count=10        //国漫
 *
 * 搜索：
 * http://wp.birdpaper.com.cn/intf/search?content=猫咪&pageno=1&count=10        //搜索
 *
 * */

const { axios, ApiBase, calculateImageOrientation, calculateImageQuality } = global.FBW.apiHelpers
const RESOURCE_NAME = 'birdpaper'

export default class ResourceBirdPaper extends ApiBase {
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
      site: 'https://birdpaper.com.cn/',
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
      total: 0,
      list: []
    }
    // content=猫咪&pageno=1&count=10
    const params = {
      content: query.keywords,
      count: query.pageSize,
      pageno: query.startPage
    }
    const res = await axios.get('http://wp.birdpaper.com.cn/intf/search', {
      params
    })
    if (res.status === 200 && res.data) {
      ret.total = res.data.data.total_count
      ret.list = res.data.data.list.map((item) => {
        const url = new URL(item.url)
        const imageUrl = url.href
        const fileExt = url.pathname.split('.').pop()
        const quality = calculateImageQuality(item.width, item.height)
        const isLandscape = calculateImageOrientation(item.width, item.height)
        return {
          resourceName: this.resourceName,
          fileName: [this.resourceName, item.id].join('_'),
          fileExt,
          fileType: 'image',
          link: '',
          author: '',
          title: '',
          desc: '',
          imageUrl,
          quality,
          width: item.width,
          height: item.height,
          isLandscape
        }
      })
    }

    return ret
  }
}
