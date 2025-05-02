export default function setDynamicWallpaper(handlers) {
  if (!handlers || process.platform !== 'win32') return false

  const koffi = require('koffi')
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

  function callback(tophandle) {
    // 找到一个具有SHELLDLL_DefView的Windows
    const SHELLDLL_DefView = FindWindowExW(tophandle, 0, TEXT('SHELLDLL_DefView'), 0)
    if (SHELLDLL_DefView !== 0) {
      // 将其下一个同级分配给workerw
      const workerw = FindWindowExW(0, tophandle, TEXT('WorkerW'), 0)
      const isVisible = IsWindowVisible(workerw)
      if (isVisible) {
        // 设置窗口为未激活状态，否则这个窗口会遮挡视频
        ShowWindow(workerw, 0)
      }
      SetParent(handlers, progman)
    }
    return true
  }

  // 注册一个回调函数指针
  const callbackProto2 = koffi.proto('__stdcall', 'callbackProto2', 'bool', ['int32', 'int32'])
  const EnumWindows = lib.func('EnumWindows', 'bool', [koffi.pointer(callbackProto2), 'int32'])
  EnumWindows(callback, 0)

  return true
}

function TEXT(text) {
  return Buffer.from(`${text}\0`, 'ucs2')
}
