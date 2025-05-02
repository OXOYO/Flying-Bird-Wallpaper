/**
 * 资源查询基类
 * */

export default class ApiBase {
  constructor(resourceName) {
    this.resourceName = resourceName
  }
  // 插件信息
  info() {
    throw new Error('子类必须实现info方法')
  }

  // 查询
  async search() {
    throw new Error('子类必须实现search方法')
  }
}
