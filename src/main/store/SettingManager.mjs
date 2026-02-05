import EventEmitter from 'node:events'
import { t, changeLanguage } from '../../i18n/server.js'
import { defaultSettingData } from '../../common/publicData.js'
import { generateSalt, hashPassword, verifyPassword } from '../utils/utils.mjs'

export default class SettingManager extends EventEmitter {
  // 单例实例
  static _instance = null

  // 获取单例实例
  static getInstance(logger, dbManager) {
    if (!SettingManager._instance) {
      SettingManager._instance = new SettingManager(logger, dbManager)
    }
    return SettingManager._instance
  }

  constructor(logger, dbManager) {
    super()

    // 防止直接实例化
    if (SettingManager._instance) {
      return SettingManager._instance
    }

    this.logger = logger
    this.dbManager = dbManager
    this._settingData = { ...defaultSettingData }
    this._initialized = false
    this._initPromise = this._init()

    SettingManager._instance = this
  }

  // 初始化方法
  async _init() {
    try {
      await this.getSettingData()

      this._initialized = true
      this.emit('SETTING_INITIALIZED', this._settingData)
      return true
    } catch (err) {
      this.logger.error(`设置管理器初始化失败: ${err.message}`)
      throw err
    }
  }

  // 等待初始化完成的方法
  async waitForInitialization() {
    if (this._initialized) {
      return this._settingData
    }
    return this._initPromise
  }

  // 获取设置数据
  get settingData() {
    return this._settingData
  }

  async getSettingData() {
    let ret = {
      success: false,
      message: t('messages.operationFail'),
      data: null
    }
    try {
      const res = await this.dbManager.getSysRecord('settingData')
      if (res.success && res.data?.storeData) {
        ret.success = true
        ret.message = t('messages.operationSuccess')
        ret.data = this._settingData = res.data.storeData
      } else {
        // 如果获取失败，使用默认设置
        this.logger.warn('从数据库获取设置失败，使用默认设置')
        ret.success = true
        ret.message = t('messages.useDefaultSettings')
        ret.data = this._settingData = { ...defaultSettingData }
      }
    } catch (err) {
      this.logger.error(`获取设置数据失败: ${err.message}`)
      // 发生错误时也使用默认设置
      ret.success = true
      ret.message = t('messages.useDefaultSettings')
      ret.data = this._settingData = { ...defaultSettingData }
    }
    return ret
  }

  // 合并更新设置数据
  async updateSettingData(data, isH5 = false) {
    let ret = {
      success: false,
      message: t('messages.operationFail'),
      data: null
    }

    const storeKey = 'settingData'

    if (!data) {
      return ret
    }

    try {
      const query_res = await this.dbManager.getSysRecord(storeKey)
      let storeData = { ...defaultSettingData }

      if (query_res.success && query_res.data?.storeData) {
        storeData = query_res.data.storeData
      } else {
        this.logger.warn(`未找到设置数据，将创建新的设置记录`)
      }

      // 合并数据
      const newStoreData = Object.assign({}, storeData, data)
      // 更新或插入数据到sys表
      const update_res = await this.dbManager.setSysRecord(storeKey, newStoreData, 'object')
      if (update_res.success) {
        this._settingData = newStoreData
        const localeVal = isH5 ? newStoreData.h5Locale : newStoreData.locale
        // 更新语言
        await changeLanguage(localeVal)
        // 触发语言变更事件
        this.emit('LANGUAGE_CHANGED', localeVal)
        ret = {
          success: true,
          message: t('messages.operationSuccess'),
          data: newStoreData
        }
      } else {
        this.logger.error(`更新设置数据失败：updateData => ${JSON.stringify(data)}`)
      }
    } catch (err) {
      this.logger.error(
        `更新设置数据失败：updateData => ${JSON.stringify(data)}, error: ${err.message}`
      )
    }

    return ret
  }

  // 验证隐私空间密码
  async checkPrivacyPassword(password) {
    let ret = {
      success: false,
      message: t('messages.operationFail')
    }
    const res = await this.dbManager.getPrivacyPassword()
    if (res.success) {
      if (!res.data) {
        ret = {
          success: false,
          message: t('messages.privacyPasswordNotSet')
        }
      } else {
        const { hash: storedHash, salt } = res.data
        if (verifyPassword(password, storedHash, salt)) {
          ret = {
            success: true,
            message: t('messages.operationSuccess')
          }
        } else {
          ret = {
            success: false,
            message: t('messages.passwordError')
          }
        }
      }
    }
    return ret
  }

  // 检查是否设置了隐私密码
  async hasPrivacyPassword() {
    let ret = {
      success: false,
      message: t('messages.operationFail'),
      data: false
    }
    const res = await this.dbManager.getPrivacyPassword()
    if (res.success) {
      ret = {
        success: true,
        message: t('messages.operationSuccess'),
        data: !!res.data
      }
    }
    return ret
  }

  // 更新隐私密码
  async updatePrivacyPassword(data) {
    let ret = {
      success: false,
      message: t('messages.operationFail')
    }

    if (!data) {
      return ret
    }

    // 处理隐私密码设置
    try {
      const storeKey = 'privacyPassword'
      // 处理新旧密码验证
      const query_res = await this.dbManager.getSysRecord(storeKey)
      if (query_res.success && query_res.data?.storeData) {
        const { hash: storedHash, salt } = query_res.data.storeData
        if (!verifyPassword(data.old, storedHash, salt)) {
          ret = {
            success: false,
            message: t('messages.oldPasswordError')
          }
          return ret
        }
      }
      if (!data.new) {
        ret = {
          success: false,
          message: t('messages.newPasswordNotEmpty')
        }
        return ret
      }
      // 检查完后更新待插入的密码
      const newSalt = generateSalt()
      const newHash = hashPassword(data.new, newSalt)
      const update_res = await this.dbManager.setSysRecord(
        storeKey,
        { hash: newHash, salt: newSalt },
        'object'
      )
      ret.success = update_res.success
      ret.message = update_res.message
    } catch (err) {
      this.logger.error(`处理隐私密码失败: ${err}`)
    }
    return ret
  }
}
