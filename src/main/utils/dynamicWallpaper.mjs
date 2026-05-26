const os = require('node:os')
const koffi = require('koffi')

const LWA_ALPHA = 0x2
const HWND_TOP = 0
const HWND_BOTTOM = 1
const SWP_NOSIZE = 0x0001
const SWP_NOMOVE = 0x0002
const SWP_NOACTIVATE = 0x0010
const SWP_SHOWWINDOW = 0x0040
const SW_SHOW = 5
const GWL_STYLE = -16
const WS_CHILD = 0x40000000
const GWL_EXSTYLE = -20
const WS_EX_LAYERED = 0x00080000
const WS_EX_TRANSPARENT = 0x00000020

const TEXT = (text) => Buffer.from(`${text}\0`, 'ucs2')

let win32 = null
let enumWindowsCallback = null
const enumFound = { iconsHost: 0, defView: 0 }

function getWin32() {
  if (win32) return win32

  const lib = koffi.load('user32.dll')
  const enumWindowsProto = koffi.proto('__stdcall', 'EnumWindowsProc', 'bool', ['int32', 'int32'])

  win32 = {
    lib,
    enumWindowsProto,
    FindWindowW: lib.func('FindWindowW', 'int32', ['string', 'string']),
    FindWindowExW: lib.func('FindWindowExW', 'int32', ['int32', 'int32', 'string', 'int32']),
    GetDesktopWindow: lib.func('GetDesktopWindow', 'int32', []),
    GetShellWindow: lib.func('GetShellWindow', 'int32', []),
    SendMessageTimeoutW: lib.func('SendMessageTimeoutW', 'int32', [
      'int32',
      'int32',
      'int32',
      'int32',
      'int32',
      'int32',
      'int32'
    ]),
    SetParent: lib.func('SetParent', 'int32', ['int32', 'int32']),
    SetWindowPos: lib.func('SetWindowPos', 'bool', [
      'int32',
      'int32',
      'int32',
      'int32',
      'int32',
      'int32',
      'uint32'
    ]),
    SetLayeredWindowAttributes: lib.func('SetLayeredWindowAttributes', 'bool', [
      'int32',
      'uint32',
      'uint8',
      'uint32'
    ]),
    SetWindowLongPtrW: lib.func('SetWindowLongPtrW', 'int32', ['int32', 'int32', 'int32']),
    GetWindowLongPtrW: lib.func('GetWindowLongPtrW', 'int32', ['int32', 'int32']),
    ShowWindow: lib.func('ShowWindow', 'bool', ['int32', 'int32']),
    EnumWindows: lib.func('EnumWindows', 'bool', [koffi.pointer(enumWindowsProto), 'int32'])
  }
  return win32
}

/** Win11 24H2 / 25H2（build >= 26100）桌面分层与旧版不同 */
export function isRaisedDesktopWindows() {
  if (process.platform !== 'win32') return false
  const build = parseInt(String(os.release()).split('.')[2] || '0', 10)
  return build >= 26100
}

function applyLayeredChildStyle(w, hwnd, alpha, clickThrough) {
  w.SetWindowLongPtrW(hwnd, GWL_STYLE, WS_CHILD)
  let exStyle = w.GetWindowLongPtrW(hwnd, GWL_EXSTYLE)
  exStyle |= WS_EX_LAYERED
  if (clickThrough) exStyle |= WS_EX_TRANSPARENT
  else exStyle &= ~WS_EX_TRANSPARENT
  w.SetWindowLongPtrW(hwnd, GWL_EXSTYLE, exStyle)
  w.SetLayeredWindowAttributes(hwnd, 0, alpha, LWA_ALPHA)
}

function showAndRaise(w, hwnd, flags) {
  w.ShowWindow(hwnd, SW_SHOW)
  w.SetWindowPos(hwnd, HWND_TOP, 0, 0, 0, 0, flags | SWP_SHOWWINDOW)
}

/**
 * 解析桌面各层 HWND（Win11 25H2 / 26200 兼容）
 */
function resolveDesktopLayers(w) {
  const empty = {
    progman: 0,
    defView: 0,
    iconsWorker: 0,
    wallpaperWorker: 0,
    iconsWorkerEnum: 0
  }

  const progman = w.FindWindowW(TEXT('Progman'), null)
  if (!progman) return empty

  w.SendMessageTimeoutW(progman, 0x052c, 0, 0, 0x0000, 1000, 0)

  const desktop = w.GetDesktopWindow()

  // Win11 25H2：先找到带图标的 WorkerW，再取其后一个 WorkerW 作为壁纸层（无 DefView）
  let scan = 0
  while (true) {
    scan = w.FindWindowExW(desktop, scan, TEXT('WorkerW'), 0)
    if (!scan) break
    const dv = w.FindWindowExW(scan, 0, TEXT('SHELLDLL_DefView'), 0)
    if (dv) {
      empty.iconsWorker = scan
      empty.defView = dv
      empty.wallpaperWorker = w.FindWindowExW(desktop, scan, TEXT('WorkerW'), 0)
      break
    }
  }

  // Progman 下：DefView + 无 DefView 的 WorkerW（壁纸）
  if (!empty.defView) {
    empty.defView = w.FindWindowExW(progman, 0, TEXT('SHELLDLL_DefView'), 0)
  }
  if (!empty.wallpaperWorker) {
    let child = 0
    while (true) {
      child = w.FindWindowExW(progman, child, TEXT('WorkerW'), 0)
      if (!child) break
      if (!w.FindWindowExW(child, 0, TEXT('SHELLDLL_DefView'), 0)) {
        empty.wallpaperWorker = child
      }
    }
  }

  // 经典 EnumWindows：含 DefView 的 WorkerW
  enumFound.iconsHost = 0
  enumFound.defView = 0
  if (!enumWindowsCallback) {
    enumWindowsCallback = koffi.register((topHandle) => {
      const dv = w.FindWindowExW(topHandle, 0, TEXT('SHELLDLL_DefView'), 0)
      if (dv) {
        enumFound.iconsHost = topHandle
        enumFound.defView = dv
      }
      return true
    }, koffi.pointer(w.enumWindowsProto))
  }
  w.EnumWindows(enumWindowsCallback, 0)
  empty.iconsWorkerEnum = enumFound.iconsHost
  if (!empty.defView && enumFound.defView) empty.defView = enumFound.defView
  if (!empty.iconsWorker && enumFound.iconsHost) empty.iconsWorker = enumFound.iconsHost

  empty.progman = progman
  return empty
}

/**
 * 按多种策略尝试挂载，Win11 25H2 优先「壁纸 WorkerW」
 */
function attachToDesktop(w, hwnd, layers, alpha, clickThrough) {
  const flags = SWP_NOSIZE | SWP_NOMOVE | SWP_NOACTIVATE
  const raised = isRaisedDesktopWindows()

  const strategies = []

  if (layers.wallpaperWorker) {
    strategies.push({
      name: 'wallpaper-worker',
      run: () => {
        w.SetParent(hwnd, layers.wallpaperWorker)
        applyLayeredChildStyle(w, hwnd, alpha, clickThrough)
        showAndRaise(w, hwnd, flags)
      }
    })
  }

  if (layers.progman && layers.defView && layers.wallpaperWorker) {
    strategies.push({
      name: 'progman-sandwich',
      run: () => {
        w.SetParent(hwnd, layers.progman)
        applyLayeredChildStyle(w, hwnd, alpha, clickThrough)
        w.SetWindowPos(hwnd, layers.wallpaperWorker, 0, 0, 0, 0, flags | SWP_SHOWWINDOW)
        w.SetWindowPos(layers.defView, hwnd, 0, 0, 0, 0, flags)
        w.ShowWindow(hwnd, SW_SHOW)
      }
    })
  }

  const classicHost = layers.iconsWorkerEnum || layers.iconsWorker
  if (classicHost && layers.defView) {
    strategies.push({
      name: 'icons-worker',
      run: () => {
        w.SetParent(hwnd, classicHost)
        applyLayeredChildStyle(w, hwnd, alpha, clickThrough)
        w.SetWindowPos(hwnd, HWND_BOTTOM, 0, 0, 0, 0, flags | SWP_SHOWWINDOW)
        w.SetWindowPos(layers.defView, HWND_TOP, 0, 0, 0, 0, flags)
        w.ShowWindow(hwnd, SW_SHOW)
      }
    })
  }

  if (layers.progman) {
    strategies.push({
      name: 'progman-fallback',
      run: () => {
        w.SetParent(hwnd, layers.progman)
        applyLayeredChildStyle(w, hwnd, alpha, clickThrough)
        showAndRaise(w, hwnd, flags)
      }
    })
  }

  const order = raised
    ? ['wallpaper-worker', 'progman-sandwich', 'icons-worker', 'progman-fallback']
    : ['icons-worker', 'wallpaper-worker', 'progman-sandwich', 'progman-fallback']

  for (const name of order) {
    const s = strategies.find((x) => x.name === name)
    if (!s) continue
    try {
      s.run()
      global.logger?.info?.(`setWindowsDynamicWallpaper: 使用策略 ${name}`)
      return { ok: true, mode: name }
    } catch (err) {
      global.logger?.warn?.(`setWindowsDynamicWallpaper: 策略 ${name} 失败 ${err}`)
    }
  }

  return { ok: false, mode: null }
}

/**
 * 将窗口挂到桌面壁纸层（图标下方、系统壁纸上方）
 */
export const setWindowsDynamicWallpaper = (hwnd, options = {}) => {
  if (!hwnd || process.platform !== 'win32') return false

  const alpha = options.alpha ?? 128
  const clickThrough = options.clickThrough !== false
  const w = getWin32()
  const layers = resolveDesktopLayers(w)

  if (!layers.progman && !layers.wallpaperWorker && !layers.iconsWorker) {
    global.logger?.warn?.('setWindowsDynamicWallpaper: 未找到桌面宿主')
    return false
  }

  const result = attachToDesktop(w, hwnd, layers, alpha, clickThrough)
  return result.ok
}

export const setWindowsDynamicWallpaperOpacity = (hwnd, alpha) => {
  if (!hwnd || process.platform !== 'win32') return false
  const w = getWin32()
  w.SetLayeredWindowAttributes(hwnd, 0, alpha, LWA_ALPHA)
  return true
}
