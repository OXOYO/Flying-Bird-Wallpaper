import path from 'node:path'
import { BrowserWindow, ipcMain, screen } from 'electron'
import { getWindowURL, preventContextMenu, isDev, isWin, isMac } from '../utils/utils.mjs'

/** 收起：仅图标；展开：横向工具条（左/右展开方向由屏幕位置决定） */
export const SUSPENSION_BALL_SIZES = {
  collapsed: { width: 52, height: 52 },
  /** 高度含顶部标题区，避免提示被裁切 */
  expanded: { width: 220, height: 66 }
}

/** 与 SuspensionBall.vue 中头像、内边距一致（padding: 0 12px 0 10px） */
const ICON_LAYOUT = {
  size: 30,
  marginStart: 10,
  marginEnd: 12
}

export default class SuspensionBall {
  static _instance = null

  static getInstance() {
    if (!SuspensionBall._instance) {
      SuspensionBall._instance = new SuspensionBall()
    }
    return SuspensionBall._instance
  }

  constructor() {
    if (SuspensionBall._instance) {
      return SuspensionBall._instance
    }

    this.url = getWindowURL('SuspensionBall')
    this.win = null
    this.mode = 'collapsed'
    /** 展开方向：left=工具栏在左、LOGO 在右；right=LOGO 在左、工具栏在右 */
    this.expandDirection = 'left'
    this.dragPrepared = false
    this.dragActive = false
    this.dragOffset = null
    this.dragTimer = null
    this.options = {
      width: SUSPENSION_BALL_SIZES.collapsed.width,
      height: SUSPENSION_BALL_SIZES.collapsed.height,
      minWidth: SUSPENSION_BALL_SIZES.collapsed.width,
      minHeight: SUSPENSION_BALL_SIZES.collapsed.height,
      frame: false,
      resizable: false,
      show: false,
      transparent: true,
      backgroundColor: '#00000000',
      titleBarStyle: 'hidden',
      hasShadow: false,
      alwaysOnTop: true,
      acceptFirstMouse: true,
      webPreferences: {
        preload: path.join(__dirname, '../preload/index.mjs'),
        sandbox: false,
        webSecurity: false,
        devTools: true,
        enableDragAndDrop: false
      }
    }

    this.bindIpcHandlers()
    SuspensionBall._instance = this
  }

  bindIpcHandlers() {
    const channels = [
      'main:openSuspensionBall',
      'main:closeSuspensionBall',
      'main:setSuspensionBallMode',
      'main:peekSuspensionBallExpandDirection',
      'main:suspensionBallDragPrepare',
      'main:suspensionBallDragActivate',
      'main:suspensionBallDragEnd'
    ]
    for (const channel of channels) {
      ipcMain.removeHandler(channel)
    }

    ipcMain.handle('main:openSuspensionBall', (event, params) => {
      this.open(params)
    })
    ipcMain.handle('main:closeSuspensionBall', (event, params) => {
      this.close(params)
    })
    ipcMain.handle('main:setSuspensionBallMode', (event, mode) => {
      this.setMode(mode)
    })
    ipcMain.handle('main:peekSuspensionBallExpandDirection', () => {
      const win = this.win
      if (!win || win.isDestroyed()) {
        return { success: false, expandDirection: 'left' }
      }
      return {
        success: true,
        expandDirection: this.resolveExpandDirection(win.getBounds())
      }
    })
    ipcMain.handle('main:suspensionBallDragPrepare', () => this.prepareDrag())
    ipcMain.handle('main:suspensionBallDragActivate', () => this.activateDrag())
    ipcMain.handle('main:suspensionBallDragEnd', () => this.endDrag())
  }

  isDraggingSession() {
    return this.dragPrepared || this.dragActive
  }

  stopDragLoop() {
    if (this.dragTimer) {
      clearInterval(this.dragTimer)
      this.dragTimer = null
    }
  }

  getIconAnchor(mode = this.mode, expandDirection = this.expandDirection) {
    if (mode === 'collapsed') return 'end'
    return expandDirection === 'right' ? 'start' : 'end'
  }

  getIconCenterInBounds(bounds, anchor = 'end') {
    const half = ICON_LAYOUT.size / 2
    if (anchor === 'start') {
      return {
        x: bounds.x + ICON_LAYOUT.marginStart + half,
        y: bounds.y + Math.round(bounds.height / 2)
      }
    }
    return {
      x: bounds.x + bounds.width - ICON_LAYOUT.marginEnd - half,
      y: bounds.y + Math.round(bounds.height / 2)
    }
  }

  getWindowOriginForIconCenter(iconCenter, size, anchor = 'end') {
    const half = ICON_LAYOUT.size / 2
    if (anchor === 'start') {
      return {
        x: Math.round(iconCenter.x - ICON_LAYOUT.marginStart - half),
        y: Math.round(iconCenter.y - Math.round(size.height / 2))
      }
    }
    return {
      x: Math.round(iconCenter.x - (size.width - ICON_LAYOUT.marginEnd - half)),
      y: Math.round(iconCenter.y - Math.round(size.height / 2))
    }
  }

  /** 悬浮球在屏幕左半区时向右展开，右半区时向左展开 */
  resolveExpandDirection(bounds) {
    const ballCenterX = bounds.x + bounds.width / 2
    const ballCenterY = bounds.y + bounds.height / 2
    const display = screen.getDisplayNearestPoint({ x: ballCenterX, y: ballCenterY })
    const midX = display.workArea.x + display.workArea.width / 2
    return ballCenterX < midX ? 'right' : 'left'
  }

  clampBoundsToWorkArea(x, y, width, height, refX, refY) {
    const display = screen.getDisplayNearestPoint({ x: refX, y: refY })
    const { workArea } = display
    return {
      x: Math.max(workArea.x, Math.min(x, workArea.x + workArea.width - width)),
      y: Math.max(workArea.y, Math.min(y, workArea.y + workArea.height - height))
    }
  }

  /** 缩放窗口时保持 LOGO 中心在屏幕上的位置不变 */
  resizeKeepingIconCenter(target, expandDirection = this.expandDirection) {
    const win = this.win
    if (!win || win.isDestroyed()) return

    const bounds = win.getBounds()
    if (bounds.width === target.width && bounds.height === target.height) {
      return
    }

    const anchorBefore = this.getIconAnchor(this.mode, this.expandDirection)
    const anchorAfter =
      target.width > SUSPENSION_BALL_SIZES.collapsed.width
        ? expandDirection === 'right'
          ? 'start'
          : 'end'
        : 'end'

    const iconCenter = this.getIconCenterInBounds(bounds, anchorBefore)
    const origin = this.getWindowOriginForIconCenter(iconCenter, target, anchorAfter)
    const { x, y } = this.clampBoundsToWorkArea(
      origin.x,
      origin.y,
      target.width,
      target.height,
      iconCenter.x,
      iconCenter.y
    )

    win.setBounds(
      {
        x,
        y,
        width: target.width,
        height: target.height
      },
      false
    )
  }

  applyDragPosition() {
    const win = this.win
    if (!win || win.isDestroyed() || !this.dragOffset) return

    const target = SUSPENSION_BALL_SIZES.collapsed
    const cursor = screen.getCursorScreenPoint()
    const iconCenter = {
      x: cursor.x - this.dragOffset.grabDeltaX,
      y: cursor.y - this.dragOffset.grabDeltaY
    }
    const origin = this.getWindowOriginForIconCenter(iconCenter, target)
    const { x, y } = this.clampBoundsToWorkArea(
      origin.x,
      origin.y,
      target.width,
      target.height,
      cursor.x,
      cursor.y
    )

    const bounds = win.getBounds()
    const sizeMatches = bounds.width === target.width && bounds.height === target.height
    if (bounds.x === x && bounds.y === y && sizeMatches) {
      return
    }

    if (sizeMatches) {
      win.setPosition(x, y, false)
    } else {
      win.setBounds({ x, y, width: target.width, height: target.height }, false)
    }
  }

  prepareDrag() {
    const win = this.win
    if (!win || win.isDestroyed()) return { success: false }

    this.endDrag()

    if (this.mode === 'expanded') {
      this.resizeKeepingIconCenter(SUSPENSION_BALL_SIZES.collapsed)
      this.mode = 'collapsed'
    }

    const bounds = win.getBounds()
    const cursor = screen.getCursorScreenPoint()
    const iconCenter = this.getIconCenterInBounds(bounds, 'end')
    this.dragOffset = {
      grabDeltaX: cursor.x - iconCenter.x,
      grabDeltaY: cursor.y - iconCenter.y
    }
    this.dragPrepared = true
    return { success: true }
  }

  activateDrag() {
    if (!this.dragPrepared) return { success: false }
    if (this.dragActive) return { success: true }

    this.dragActive = true
    this.stopDragLoop()
    this.applyDragPosition()
    this.dragTimer = setInterval(() => this.applyDragPosition(), 1000 / 60)
    return { success: true }
  }

  endDrag() {
    this.stopDragLoop()
    this.dragPrepared = false
    this.dragActive = false
    this.dragOffset = null
    return { success: true }
  }

  setMode(mode = 'collapsed') {
    const win = this.win
    if (!win || win.isDestroyed()) return { success: false }
    if (this.isDraggingSession()) return { success: false, expandDirection: this.expandDirection }

    const nextMode = mode === 'expanded' ? 'expanded' : 'collapsed'
    const target = SUSPENSION_BALL_SIZES[nextMode]
    const [w, h] = win.getSize()

    let nextExpandDirection = this.expandDirection
    if (nextMode === 'expanded') {
      nextExpandDirection = this.resolveExpandDirection(win.getBounds())
    }

    if (this.mode === nextMode && w === target.width && h === target.height) {
      return { success: true, expandDirection: nextExpandDirection }
    }

    this.resizeKeepingIconCenter(target, nextExpandDirection)
    this.mode = nextMode
    this.expandDirection = nextExpandDirection
    return { success: true, expandDirection: this.expandDirection }
  }

  create() {
    this.win = new BrowserWindow(this.options)

    if (isDev()) {
      this.win.loadURL(this.url)
    } else {
      this.win.loadFile(this.url)
    }
  }

  async close(flag = true) {
    if (flag) {
      await global.FBW.store?.toggleSuspensionBallVisible(false)
    }
    this.win?.close()
  }

  destroy() {
    this.endDrag()
    this.win?.destroy()
  }

  createOrOpen() {
    if (this.win) {
      this.win.show()
      return
    }

    this.create()

    const { width } = screen.getPrimaryDisplay().workAreaSize
    this.win.setPosition(width - 100, 200)
    this.win.setVisibleOnAllWorkspaces(true)
    if (isWin() || isMac()) {
      this.win.setSkipTaskbar(true)
    }

    this.win.once('ready-to-show', () => {
      this.win.show()
      global.FBW.sendCommonData(this.win)
    })

    preventContextMenu(this.win)

    this.win.on('closed', async () => {
      this.win = null
      await global.FBW.store?.toggleSuspensionBallVisible(false)
    })
  }

  async toggle() {
    await global.FBW.store?.toggleSuspensionBallVisible()
    if (!this.win) {
      this.createOrOpen()
    } else if (this.win.isVisible()) {
      this.win.hide()
    } else {
      this.win.show()
      this.win.focus()
    }
  }

  async open(flag = true) {
    if (flag) {
      await global.FBW.store?.toggleSuspensionBallVisible(true)
    }
    if (!this.win) {
      this.createOrOpen()
    } else {
      this.win.show()
      this.win.focus()
    }
  }
}
