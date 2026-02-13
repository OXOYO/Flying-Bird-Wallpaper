import { app, globalShortcut, BrowserWindow } from 'electron'
import localShortcut from 'electron-localshortcut'
import { keyboardShortcuts } from '../../common/publicData.js'
import { t } from '../../i18n/server.js'
import { isMac, isWin, isLinux } from '../utils/utils.mjs'

class ShortcutManager {
  static _instance = null

  static getInstance(logger, dbManager) {
    if (!ShortcutManager._instance) {
      ShortcutManager._instance = new ShortcutManager(logger, dbManager)
    }
    return ShortcutManager._instance
  }

  constructor(logger, dbManager) {
    if (ShortcutManager._instance) {
      return ShortcutManager._instance
    }

    this.logger = logger
    this.dbManager = dbManager
    this.registeredShortcuts = new Map()
    this.userCustomShortcuts = {}
    this._initialized = false
    this._initPromise = this._init()
    // 用于增量更新的缓存
    this._currentShortcuts = new Map()

    ShortcutManager._instance = this
  }

  // 初始化方法
  async _init() {
    try {
      // 加载用户自定义快捷键
      await this.loadUserCustomShortcuts()

      // 注册所有快捷键
      this.registerAllShortcuts()

      // 启动时检测冲突
      this.detectAndReportConflicts()

      this._initialized = true
      this.logger.info('快捷键管理器初始化完成')
      return true
    } catch (error) {
      this.logger.error(`快捷键管理器初始化失败: ${error.message}`)
      return false
    }
  }

  // 检测并报告冲突
  detectAndReportConflicts() {
    const conflicts = this.getShortcutConflicts()
    if (conflicts.success && conflicts.data && conflicts.data.length > 0) {
      this.logger.warn(`检测到 ${conflicts.data.length} 个快捷键冲突`)
      // 可以在这里添加通知机制，向渲染进程发送冲突信息
    }
  }

  // 等待初始化完成的方法
  async waitForInitialization() {
    if (this._initialized) {
      return true
    }
    return this._initPromise
  }

  // 加载用户自定义快捷键
  async loadUserCustomShortcuts() {
    try {
      const res = await this.dbManager.setSysRecord('customShortcuts')
      if (res.success && res.data?.storeData) {
        this.userCustomShortcuts = res.data.storeData || {}
      }
    } catch (error) {
      this.logger.error(`加载用户自定义快捷键失败: ${error.message}`)
      this.userCustomShortcuts = {}
    }
  }

  // 保存用户自定义快捷键
  async saveUserCustomShortcuts() {
    try {
      await this.dbManager.setSysRecord('customShortcuts', this.userCustomShortcuts)
      this.logger.info('用户自定义快捷键保存成功')
    } catch (error) {
      this.logger.error(`保存用户自定义快捷键失败: ${error.message}`)
    }
  }

  // 获取当前平台的快捷键
  getPlatformShortcuts() {
    const platform = isMac() ? 'mac' : isWin() ? 'win' : 'linux'

    const platformShortcuts = {}

    keyboardShortcuts.forEach((item) => {
      // 优先使用用户自定义快捷键
      const customShortcut = this.userCustomShortcuts[item.name]
      let shortcut
      if (customShortcut === '') {
        // 用户明确清空了快捷键
        shortcut = ''
      } else if (customShortcut !== undefined) {
        // 用户设置了自定义快捷键
        shortcut = customShortcut
      } else {
        // 使用默认快捷键
        shortcut = item.shortcuts[platform]
      }

      platformShortcuts[item.name] = {
        ...item,
        shortcut: shortcut,
        // 统一修饰键的显示名称
        displayShortcut: this.formatShortcutForDisplay(shortcut)
      }
    })

    return platformShortcuts
  }

  // 格式化快捷键用于显示
  formatShortcutForDisplay(shortcut) {
    if (!shortcut) return ''

    // 分割快捷键并格式化每个修饰键
    const parts = shortcut.split('+')
    const formattedParts = parts.map((part) => {
      return this.getPlatformModifierName(part)
    })

    return formattedParts.join('+')
  }

  // 获取指定名称的快捷键
  getShortcutByName(shortcutName) {
    const platformShortcuts = this.getPlatformShortcuts()
    const shortcutItem = Object.values(platformShortcuts).find((item) => item.name === shortcutName)
    return shortcutItem?.shortcut || ''
  }

  // 注册所有快捷键
  registerAllShortcuts() {
    // 先注销所有已注册的快捷键
    this.unregisterAllShortcuts()

    // 注册全局快捷键
    this.registerGlobalShortcuts()

    // 注册所有本地快捷键
    this.registerAllLocalShortcuts()

    // 更新当前快捷键缓存
    this._updateCurrentShortcutsCache()
  }

  // 更新当前快捷键缓存
  _updateCurrentShortcutsCache() {
    const platformShortcuts = this.getPlatformShortcuts()
    this._currentShortcuts.clear()
    // 注销所有快捷键
    Object.entries(platformShortcuts).forEach(([name, item]) => {
      this._currentShortcuts.set(item.name, item.shortcut)
    })
  }
  unregisterAllShortcuts() {
    // 注销全局快捷键
    globalShortcut.unregisterAll()

    // 注销本地快捷键
    this.unregisterAllLocalShortcuts()

    this.registeredShortcuts.clear()
    this.logger.info('所有快捷键已注销')
  }

  // 注册全局快捷键
  registerGlobalShortcuts() {
    const platformShortcuts = this.getPlatformShortcuts()

    const globalShortcuts = Object.values(platformShortcuts).filter(
      (item) => item.type === 'global'
    )

    globalShortcuts.forEach((item) => {
      if (item.shortcut) {
        try {
          globalShortcut.register(item.shortcut, () => {
            this.handleShortcut(item)
          })
          this.registeredShortcuts.set(item.name, { type: 'global', shortcut: item.shortcut })
        } catch (error) {
          this.logger.error(`注册全局快捷键 ${item.shortcut} 失败: ${error.message}`)
        }
      }
    })
    this.logger.info(`注册了 ${this.registeredShortcuts.size} 个全局快捷键`)
  }

  // 注册本地快捷键
  registerLocalShortcuts(winName, isUnregister = false) {
    const platformShortcuts = this.getPlatformShortcuts()

    // 如果是注销操作，先注销所有已注册的本地快捷键
    if (isUnregister) {
      this.unregisterLocalShortcuts(winName)
    }

    // 主窗口快捷键
    if (winName) {
      const win = global.FBW?.[winName]?.win
      if (win) {
        const registeredCount = this.registeredShortcuts.size
        Object.values(platformShortcuts).forEach((item) => {
          if (item.shortcut && item.type === 'local' && item.windowNames.includes(winName)) {
            try {
              localShortcut.register(win, item.shortcut, () => {
                this.handleShortcut(item, winName, win)
              })
              this.registeredShortcuts.set(item.name, {
                type: 'local',
                shortcut: item.shortcut,
                winName
              })
            } catch (error) {
              this.logger.error(`${winName} 注册本地快捷键 ${item.shortcut} 失败: ${error.message}`)
            }
          }
        })
        this.logger.info(
          `${winName} 注册了 ${this.registeredShortcuts.size - registeredCount} 个本地快捷键`
        )
      }
    }
  }

  // 注销本地快捷键
  unregisterLocalShortcuts(winName) {
    if (winName) {
      const win = global.FBW?.[winName]?.win
      if (win) {
        // 只注销当前应用注册的本地快捷键
        this.registeredShortcuts.forEach((shortcutInfo, name) => {
          if (shortcutInfo.type === 'local' && shortcutInfo.winName === winName) {
            try {
              localShortcut.unregister(win, shortcutInfo.shortcut)
              this.registeredShortcuts.delete(name)
            } catch (error) {
              this.logger.error(
                `${winName} 注销本地快捷键 ${shortcutInfo.shortcut} 失败: ${error.message}`
              )
            }
          }
        })
        this.logger.info(`${winName} 注销了所有本地快捷键`)
      }
    }
  }

  // 注册所有本地快捷键
  registerAllLocalShortcuts() {
    const winNames = ['mainWindow', 'loadingWindow', 'viewImageWindow', 'suspensionBall']
    winNames.forEach((winName) => {
      this.registerLocalShortcuts(winName, true)
    })
  }

  // 注销所有本地快捷键
  unregisterAllLocalShortcuts() {
    const windows = BrowserWindow.getAllWindows()
    windows.forEach((win) => {
      // 只注销当前应用注册的本地快捷键
      this.registeredShortcuts.forEach((shortcutInfo, name) => {
        if (shortcutInfo.type === 'local') {
          try {
            localShortcut.unregister(win, shortcutInfo.shortcut)
          } catch (error) {
            // 忽略错误，可能窗口已经关闭
          }
        }
      })
    })
    // 清除注册记录
    this.registeredShortcuts.forEach((shortcutInfo, name) => {
      if (shortcutInfo.type === 'local') {
        this.registeredShortcuts.delete(name)
      }
    })
    this.logger.info('注销了所有本地快捷键')
  }

  // 处理快捷键事件
  handleShortcut(item, winName, win) {
    this.logger.info(
      winName
        ? `${winName} 触发快捷键 ${item.shortcut} : ${item.description}`
        : `触发快捷键 ${item.shortcut} : ${item.description}`
    )

    switch (item.name) {
      case 'quitApp':
        global.FBW.flags.isQuitting = true
        app.quit()
        break
      case 'closeWindow':
        if (win) {
          win.close()
        }
        break
      case 'minimizeWindow':
        if (win) {
          win.minimize()
        }
        break
      case 'toggleMainWindow':
        if (global.FBW?.mainWindow) {
          global.FBW.mainWindow.toggle()
        }
        break
      case 'toggleSuspensionBall':
        if (global.FBW?.suspensionBall) {
          global.FBW.suspensionBall.toggle()
        }
        break
      case 'nextWallpaper':
        if (global.FBW?.store) {
          global.FBW.store.doManualSwitchWallpaper('next')
        }
        break
      case 'prevWallpaper':
        if (global.FBW?.store) {
          global.FBW.store.doManualSwitchWallpaper('prev')
        }
        break
      case 'toggleAutoSwitch':
        if (global.FBW?.store) {
          global.FBW.store.toggleAutoSwitchWallpaper()
        }
        break
      case 'openSettings':
        if (global.FBW?.mainWindow) {
          global.FBW.mainWindow.reopen(() => {
            global.FBW.mainWindow.win.webContents.send('main:jumpToPage', 'Setting')
          })
        }
        break
      case 'checkUpdate':
        if (global.FBW?.updater) {
          global.FBW.updater.checkUpdate()
        }
        break
      case 'openAbout':
        if (global.FBW?.mainWindow) {
          global.FBW.mainWindow.reopen(() => {
            global.FBW.mainWindow.win.webContents.send('main:jumpToPage', 'About')
          })
        }
        break
      case 'editSelectAll':
        if (win) {
          win.webContents.selectAll()
        }
        break
      case 'editCopy':
        if (win) {
          win.webContents.copy()
        }
        break
      case 'editPaste':
        if (win) {
          win.webContents.paste()
        }
        break
      default:
        this.logger.warn(`未处理的快捷键: ${item.name}`)
    }
  }

  // 检测快捷键冲突
  getShortcutConflicts() {
    // 检测全局快捷键冲突
    const globalConflicts = this.detectGlobalConflicts()

    // 检测应用内快捷键冲突
    const appConflicts = this.detectAppConflicts()

    // 检测本地快捷键冲突
    const localConflicts = this.detectLocalConflicts()

    const conflictsResult = {
      success: true,
      message: t('messages.operationSuccess'),
      data: [...globalConflicts, ...appConflicts, ...localConflicts]
    }

    this.logger.info(
      `检测到 ${globalConflicts.length} 个全局快捷键冲突、${appConflicts.length} 个应用内快捷键冲突和 ${localConflicts.length} 个本地快捷键冲突`
    )

    return conflictsResult
  }

  // 清除缓存
  clearCache() {
    this._currentShortcuts.clear()
    this.logger.info('快捷键缓存已清除')
  }

  // 检测本地快捷键冲突
  detectLocalConflicts() {
    const ret = []
    const platformShortcuts = this.getPlatformShortcuts()

    // 按窗口分组检测冲突
    const localShortcuts = {}
    Object.values(platformShortcuts).forEach((item) => {
      if (item.type === 'local' && item.windowNames) {
        item.windowNames.forEach((winName) => {
          if (!localShortcuts[winName]) {
            localShortcuts[winName] = []
          }
          localShortcuts[winName].push(item)
        })
      }
    })

    // 检测每个窗口内的快捷键冲突
    Object.entries(localShortcuts).forEach(([winName, shortcuts]) => {
      // 按快捷键分组
      const shortcutGroups = {}
      shortcuts.forEach((item) => {
        if (item.shortcut) {
          if (!shortcutGroups[item.shortcut]) {
            shortcutGroups[item.shortcut] = []
          }
          shortcutGroups[item.shortcut].push(item)
        }
      })

      // 检测重复的快捷键
      Object.entries(shortcutGroups).forEach(([shortcut, items]) => {
        if (items.length > 1) {
          // 为每个冲突的快捷键添加详细的冲突信息
          items.forEach((item) => {
            // 找出与当前快捷键冲突的其他快捷键
            const otherItems = items.filter((i) => i.name !== item.name)
            const conflictNames = otherItems.map((i) => i.name || i.description).join('、')

            ret.push({
              ...item,
              message: t('messages.conflictWindowShortcut', {
                name: conflictNames,
                window: winName
              })
            })
          })
        }
      })
    })

    return ret
  }

  // 检测全局快捷键冲突
  detectGlobalConflicts() {
    const ret = []
    const platformShortcuts = this.getPlatformShortcuts()

    Object.values(platformShortcuts).forEach((item) => {
      if (item.type === 'global' && item.shortcut) {
        try {
          // 使用try-register-unregister方法检测系统冲突
          const isRegistered = globalShortcut.isRegistered(item.shortcut)
          if (isRegistered) {
            ret.push({
              ...item,
              message: t('messages.conflictSystemShortcut')
            })
          } else {
            // 尝试注册并立即注销，检测是否与系统或其他应用冲突
            const canRegister = globalShortcut.register(item.shortcut, () => {})
            if (canRegister) {
              globalShortcut.unregister(item.shortcut)
            } else {
              ret.push({
                ...item,
                message: t('messages.conflictSystemShortcut')
              })
            }
          }
        } catch (error) {
          this.logger.error(`检测全局快捷键冲突失败: ${error.message}`)
          // 发生错误时，认为存在冲突
          ret.push({
            ...item,
            message: t('messages.conflictSystemShortcut')
          })
        }
      }
    })
    return ret
  }

  // 检测应用内快捷键冲突
  detectAppConflicts() {
    const ret = []
    const platformShortcuts = this.getPlatformShortcuts()

    // 按快捷键分组
    const shortcutGroups = {}
    Object.values(platformShortcuts).forEach((item) => {
      if (item.shortcut) {
        if (!shortcutGroups[item.shortcut]) {
          shortcutGroups[item.shortcut] = []
        }
        shortcutGroups[item.shortcut].push(item)
      }
    })

    // 检测重复的快捷键
    Object.entries(shortcutGroups).forEach(([shortcut, items]) => {
      if (items.length > 1) {
        // 为每个冲突的快捷键添加详细的冲突信息
        items.forEach((item) => {
          // 找出与当前快捷键冲突的其他快捷键
          const otherItems = items.filter((i) => i.name !== item.name)
          const conflictNames = otherItems.map((i) => i.name || i.description).join('、')

          ret.push({
            ...item,
            message: t('messages.conflictAppShortcut', { name: conflictNames })
          })
        })
      }
    })

    return ret
  }

  // 检查快捷键冲突
  checkShortcutConflict(shortcut, excludeName) {
    if (!shortcut)
      return {
        success: true,
        message: ''
      }

    // 检查系统冲突
    try {
      if (globalShortcut.isRegistered(shortcut)) {
        return {
          success: false,
          data: {
            type: 'system',
            shortcut
          },
          message: t('messages.conflictSystemShortcut')
        }
      }
    } catch (error) {
      this.logger.error(`检查系统快捷键冲突失败: ${error.message}`)
    }

    // 检查应用内冲突
    const platformShortcuts = this.getPlatformShortcuts()
    for (const [name, item] of Object.entries(platformShortcuts)) {
      if (item.name !== excludeName && item.shortcut === shortcut) {
        return {
          success: false,
          data: {
            type: 'app',
            shortcut,
            conflictId: item.name,
            conflictName: item.name || item.description
          },
          message: t('messages.conflictAppShortcut', { name: item.name || item.description })
        }
      }
    }

    return {
      success: true,
      message: ''
    }
  }

  // 更新快捷键
  async updateShortcut(name, newShortcut) {
    try {
      // 检查是否可编辑
      const shortcutItem = keyboardShortcuts.find((item) => item.name === name)
      if (shortcutItem && shortcutItem.editable === false) {
        return { success: false, message: t('messages.notEditableShortcut') }
      }

      // 规范化快捷键格式
      const normalizedShortcut = this.normalizeShortcut(newShortcut)

      // 验证快捷键格式
      if (normalizedShortcut && !this.isValidShortcut(normalizedShortcut)) {
        return { success: false, message: t('messages.invalidShortcutFormat') }
      }

      // 检测冲突
      const conflictRes = this.checkShortcutConflict(normalizedShortcut, name)
      if (!conflictRes.success) {
        return { success: false, message: conflictRes.message }
      }

      // 记录旧的快捷键值
      const oldShortcut = this._currentShortcuts.get(name)

      // 更新用户自定义快捷键
      if (normalizedShortcut !== undefined) {
        this.userCustomShortcuts[name] = normalizedShortcut
      } else {
        delete this.userCustomShortcuts[name]
      }

      // 保存
      await this.saveUserCustomShortcuts()

      // 清除缓存，确保下次获取时重新计算
      this.clearCache()

      // 使用增量更新机制
      this.updateShortcutIncrementally(name, oldShortcut, normalizedShortcut)

      // 更新缓存
      this._updateCurrentShortcutsCache()

      // 配置变更后检测冲突
      this.detectAndReportConflicts()

      return { success: true, message: t('messages.shortcutUpdateSuccess') }
    } catch (error) {
      this.logger.error(`更新快捷键失败: ${error.message}`)
      return { success: false, message: t('messages.shortcutUpdateFailed') }
    }
  }

  // 检查快捷键是否只包含修饰键
  isModifierOnlyShortcut(shortcut) {
    if (!shortcut) return false

    const modifiers = ['Command', 'Ctrl', 'Shift', 'Option', 'Alt', 'Super']
    const keys = shortcut.split('+')

    return keys.every((key) => modifiers.includes(key))
  }

  // 增量更新快捷键
  updateShortcutIncrementally(name, oldShortcut, newShortcut) {
    const shortcutItem = keyboardShortcuts.find((item) => item.name === name)
    if (!shortcutItem) return

    // 注销旧的快捷键
    if (oldShortcut) {
      if (shortcutItem.type === 'global') {
        globalShortcut.unregister(oldShortcut)
      } else if (shortcutItem.type === 'local' && shortcutItem.windowNames) {
        shortcutItem.windowNames.forEach((winName) => {
          const win = global.FBW?.[winName]?.win
          if (win) {
            localShortcut.unregister(win, oldShortcut)
          }
        })
      }
      this.registeredShortcuts.delete(name)
      this.logger.info(`已注销快捷键 ${oldShortcut} (${name})`)
    }

    // 注册新的快捷键
    if (newShortcut && !this.isModifierOnlyShortcut(newShortcut)) {
      if (shortcutItem.type === 'global') {
        try {
          globalShortcut.register(newShortcut, () => {
            this.handleShortcut(shortcutItem)
          })
          this.registeredShortcuts.set(name, { type: 'global', shortcut: newShortcut })
          this.logger.info(`已注册全局快捷键 ${newShortcut} (${name})`)
        } catch (error) {
          this.logger.error(`注册全局快捷键 ${newShortcut} 失败: ${error.message}`)
        }
      } else if (shortcutItem.type === 'local' && shortcutItem.windowNames) {
        shortcutItem.windowNames.forEach((winName) => {
          const win = global.FBW?.[winName]?.win
          if (win) {
            try {
              localShortcut.register(win, newShortcut, () => {
                this.handleShortcut(shortcutItem, winName, win)
              })
              this.registeredShortcuts.set(name, {
                type: 'local',
                shortcut: newShortcut,
                winName
              })
              this.logger.info(`${winName} 已注册本地快捷键 ${newShortcut} (${name})`)
            } catch (error) {
              this.logger.error(`${winName} 注册本地快捷键 ${newShortcut} 失败: ${error.message}`)
            }
          }
        })
      }
    } else if (newShortcut) {
      // 只包含修饰键的快捷键，跳过注册
      this.logger.warn(`跳过注册只包含修饰键的快捷键 ${newShortcut} (${name})`)
    }
  }

  // 重置快捷键到默认值
  async resetShortcut(name) {
    try {
      // 检查是否可编辑
      const shortcutItem = keyboardShortcuts.find((item) => item.name === name)
      if (shortcutItem && shortcutItem.editable === false) {
        return { success: false, message: t('messages.notEditableShortcut') }
      }

      // 记录旧的快捷键值
      const oldShortcut = this._currentShortcuts.get(name)

      // 从用户自定义快捷键中删除
      delete this.userCustomShortcuts[name]

      // 保存
      await this.saveUserCustomShortcuts()

      // 清除缓存，确保下次获取时重新计算
      this.clearCache()

      // 获取默认快捷键
      const platform = isMac() ? 'mac' : isWin() ? 'win' : 'linux'
      const newShortcut = shortcutItem.shortcuts[platform]

      // 使用增量更新机制
      this.updateShortcutIncrementally(name, oldShortcut, newShortcut)

      // 更新缓存
      this._updateCurrentShortcutsCache()

      return { success: true, message: t('messages.shortcutResetSuccess') }
    } catch (error) {
      this.logger.error(`重置快捷键失败: ${error.message}`)
      return { success: false, message: t('messages.shortcutResetFailed') }
    }
  }

  // 验证快捷键格式
  isValidShortcut(shortcut) {
    if (!shortcut) return true

    // 检查是否只包含修饰键
    if (this.isModifierOnlyShortcut(shortcut)) {
      return false
    }

    // 处理Linux平台的Super键
    if (isLinux() && shortcut.includes('Super')) {
      // Super键在Linux上是有效的
      const linuxShortcutRegex = /^([A-Za-z]+([+][A-Za-z0-9]+)*)$/
      return linuxShortcutRegex.test(shortcut)
    }

    // 其他平台的快捷键格式验证
    const shortcutRegex = /^([A-Za-z]+([+][A-Za-z0-9]+)*)$/
    return shortcutRegex.test(shortcut)
  }

  // 规范化快捷键格式
  normalizeShortcut(shortcut) {
    if (!shortcut) return ''

    let normalized = shortcut

    // 移除多余的空格
    normalized = normalized.replace(/\s+/g, '')

    // 处理Linux平台的Super键
    if (isLinux() && normalized.includes('Super')) {
      // 确保Super键格式正确
      normalized = normalized.replace(/Super\s*\+/g, 'Super+')
    }

    // 处理Windows平台的Windows键
    if (isWin() && normalized.includes('Windows')) {
      // 确保Windows键格式正确
      normalized = normalized.replace(/Windows\s*\+/g, 'Windows+')
    }

    // 处理macOS平台的Command键
    if (isMac() && normalized.includes('Command')) {
      // 确保Command键格式正确
      normalized = normalized.replace(/Command\s*\+/g, 'Command+')
    }

    // 确保修饰键顺序一致
    const modifiers = ['Command', 'Ctrl', 'Shift', 'Alt', 'Super', 'Windows']
    const parts = normalized.split('+')
    const keyPart = parts.filter((p) => !modifiers.includes(p)).join('+')
    const modifierParts = parts
      .filter((p) => modifiers.includes(p))
      .sort((a, b) => modifiers.indexOf(a) - modifiers.indexOf(b))

    if (keyPart) {
      normalized = [...modifierParts, keyPart].join('+')
    } else {
      normalized = modifierParts.join('+')
    }

    return normalized
  }

  // 获取平台特定的修饰键名称
  getPlatformModifierName(modifier) {
    if (isMac()) {
      // macOS平台的修饰键名称
      const macModifiers = {
        Command: 'Cmd',
        Ctrl: 'Ctrl',
        Option: 'Opt',
        Shift: 'Shift'
      }
      return macModifiers[modifier] || modifier
    } else if (isLinux()) {
      // Linux平台的修饰键名称
      const linuxModifiers = {
        Control: 'Ctrl',
        Meta: 'Super',
        Shift: 'Shift',
        Alt: 'Alt'
      }
      return linuxModifiers[modifier] || modifier
    } else {
      // Windows平台的修饰键名称
      const winModifiers = {
        Control: 'Ctrl',
        Shift: 'Shift',
        Alt: 'Alt',
        Windows: 'Win'
      }
      return winModifiers[modifier] || modifier
    }
  }
}

export default ShortcutManager
