export default class LocalStore {
  // 存储前缀
  #PREFIX
  // 拼接分隔符
  #SEPARATOR

  constructor(PREFIX) {
    this.#PREFIX = typeof PREFIX !== 'string' || !PREFIX ? 'FBW-H5' : PREFIX
    this.#SEPARATOR = '_'

    // 检查 localStorage 是否可用
    try {
      const testKey = `${this.#PREFIX}${this.#SEPARATOR}TEST`
      localStorage.setItem(testKey, '1')
      localStorage.removeItem(testKey)
    } catch (e) {
      throw new Error('localStorage 不可用')
    }
  }

  #handleKey(key) {
    return `${this.#PREFIX}${this.#SEPARATOR}${key}`
  }

  #checkKey(key) {
    let ret = {
      success: false,
      message: ''
    }
    if (typeof key !== 'string' || !key) {
      ret.message = 'key 必须为非空字符串！'
    } else {
      ret.success = true
    }
    return ret
  }

  set(...args) {
    let ret = {
      success: false,
      message: '操作失败！'
    }
    try {
      if (args.length < 2 || !args[0]) {
        ret.message = '参数错误！'
        return ret
      }

      const key = args[0]
      const checkRes = this.#checkKey(key)
      if (!checkRes.success) {
        ret.message = checkRes.message
        return ret
      }
      const val = args[1]
      const type = args[2] || typeof val
      let storeVal = val
      if (type === 'object') {
        storeVal = JSON.stringify(val)
        if (Array.isArray(val)) {
          type = 'array'
        } else if (val === null) {
          type = 'null'
        }
      }
      const data = JSON.stringify({
        val: storeVal,
        type
      })
      localStorage.setItem(this.#handleKey(key), data)
      ret.success = true
      ret.message = '操作成功！'
    } catch (err) {
      ret.success = false
      ret.message = err.message || '操作失败！'
    }
    return ret
  }

  get(key) {
    let ret = {
      success: false,
      message: '操作失败！',
      data: null
    }
    try {
      const checkRes = this.#checkKey(key)
      if (!checkRes.success) {
        ret.message = checkRes.message
        return ret
      }
      const raw = localStorage.getItem(this.#handleKey(key))
      if (!raw) {
        return ret
      }
      const data = JSON.parse(data)
      let val = data.val
      let type = data.type
      switch (type) {
        case 'number':
          val = Number(val)
          break
        case 'boolean':
          val = val === 'true' || val === true
          break
        case 'object':
        case 'array':
          val = JSON.parse(val)
          break
        case 'null':
          val = null
          break
      }
      ret.success = true
      ret.message = '操作成功！'
      ret.data = val
    } catch (err) {
      ret.success = false
      ret.message = err.message || '操作失败！'
    }
    return ret
  }

  remove(key) {
    let ret = {
      success: false,
      message: '操作失败！'
    }
    try {
      const checkRes = this.#checkKey(key)
      if (!checkRes.success) {
        ret.message = checkRes.message
        return ret
      }
      localStorage.removeItem(this.#handleKey(key))
      ret.success = true
      ret.message = '操作成功！'
    } catch (err) {
      ret.success = false
      ret.message = err.message || '操作失败！'
    }
    return ret
  }

  clear() {
    let ret = {
      success: false,
      message: '操作失败！'
    }
    // 只清除带 PREFIX 的 key
    try {
      Object.keys(localStorage).forEach((k) => {
        if (k.startsWith(this.#PREFIX + this.#SEPARATOR)) {
          localStorage.removeItem(k)
        }
      })
      ret.success = true
      ret.message = '操作成功！'
    } catch (err) {
      ret.success = false
      ret.message = err.message || '操作失败！'
    }
    return ret
  }

  has(key) {
    const checkRes = this.#checkKey(key)
    if (!checkRes.success) {
      return false
    }
    return !!localStorage.getItem(this.#handleKey(key))
  }
}
