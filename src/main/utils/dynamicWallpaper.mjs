const koffi = require('koffi')

const LWA_ALPHA = 0x2

const TEXT = (text) => {
  return Buffer.from(`${text}\0`, 'ucs2')
}

export const setWindowsDynamicWallpaper = (handlers) => {
  if (!handlers || process.platform !== 'win32') return false
  const lib = koffi.load('user32.dll')

  const FindWindowW = lib.func('FindWindowW', 'int32', ['string', 'string'])
  const SendMessageTimeoutW = lib.func('SendMessageTimeoutW', 'int32', [
    'int32',
    'int32',
    'int32',
    'int32',
    'int32',
    'int32',
    'int32'
  ])
  const FindWindowExW = lib.func('FindWindowExW', 'int32', ['int32', 'int32', 'string', 'int32'])
  const SetParent = lib.func('SetParent', 'int32', ['int32', 'int32'])
  const IsWindowVisible = lib.func('IsWindowVisible', 'bool', ['int32'])
  const ShowWindow = lib.func('ShowWindow', 'bool', ['int32', 'int32'])
  const SetWindowPos = lib.func('SetWindowPos', 'bool', [
    'int32',
    'int32',
    'int32',
    'int32',
    'int32',
    'int32',
    'uint32'
  ])
  const SetLayeredWindowAttributes = lib.func('SetLayeredWindowAttributes', 'bool', [
    'int32',
    'uint32',
    'uint8',
    'uint32'
  ])
  const HWND_BOTTOM = 1
  const SWP_NOSIZE = 0x0001
  const SWP_NOMOVE = 0x0002
  const SWP_NOACTIVATE = 0x0010
  const SetWindowLongPtrW = lib.func('SetWindowLongPtrW', 'int32', ['int32', 'int32', 'int32'])
  const GWL_STYLE = -16
  const WS_CHILD = 0x40000000
  const GWL_EXSTYLE = -20
  const WS_EX_LAYERED = 0x00080000
  const WS_EX_TRANSPARENT = 0x00000020
  const GetWindowLongPtrW = lib.func('GetWindowLongPtrW', 'int32', ['int32', 'int32'])

  // 要触发在桌面图标和墙纸之间创建WorkerW窗口，我们必须向程序管理器发送一条消息
  const progman = FindWindowW(TEXT('Progman'), null)

  // 该消息是未记录的消息，因此没有专用的Windows API名称，除了0x052C
  SendMessageTimeoutW(
    progman,
    0x052c, // 在程序管理器上生成墙纸工作程序的未记录消息
    0,
    0,
    0x0000,
    1000,
    0
  )

  const callback = (tophandle) => {
    // 找到一个具有SHELLDLL_DefView的Windows
    const SHELLDLL_DefView = FindWindowExW(tophandle, 0, TEXT('SHELLDLL_DefView'), 0)
    if (SHELLDLL_DefView !== 0) {
      // 这里的 tophandle 就是正确的 WorkerW
      SetParent(handlers, tophandle)
    }
    return true
  }

  // 注册一个回调函数指针
  const callbackProto2 = koffi.proto('__stdcall', 'callbackProto2', 'bool', ['int32', 'int32'])
  const EnumWindows = lib.func('EnumWindows', 'bool', [koffi.pointer(callbackProto2), 'int32'])
  EnumWindows(callback, 0)

  // 设置为子窗口样式
  SetWindowLongPtrW(handlers, GWL_STYLE, WS_CHILD)

  // 设置窗口扩展样式为 WS_EX_LAYERED | WS_EX_TRANSPARENT，实现点击穿透
  let exStyle = GetWindowLongPtrW(handlers, GWL_EXSTYLE)
  exStyle = exStyle | WS_EX_LAYERED | WS_EX_TRANSPARENT
  SetWindowLongPtrW(handlers, GWL_EXSTYLE, exStyle)

  // 设置窗口为半透明（50% 透明度）
  SetLayeredWindowAttributes(handlers, 0, 128, LWA_ALPHA)

  // 调整 Z 顺序
  SetWindowPos(handlers, HWND_BOTTOM, 0, 0, 0, 0, SWP_NOSIZE | SWP_NOMOVE | SWP_NOACTIVATE)

  return true
}

export const setWindowsDynamicWallpaperOpacity = (hwnd, alpha) => {
  const lib = koffi.load('user32.dll')
  const SetLayeredWindowAttributes = lib.func('SetLayeredWindowAttributes', 'bool', [
    'int32',
    'uint32',
    'uint8',
    'uint32'
  ])
  SetLayeredWindowAttributes(hwnd, 0, alpha, LWA_ALPHA)
}
