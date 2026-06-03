export const H5_BROWSE_DISPLAY_MODE_KEY = 'fbw_h5_browse_display_mode'
export const H5_BROWSE_DISPLAY_SIZE_KEY = 'fbw_h5_browse_display_size'
export const H5_BROWSE_IMMERSIVE_KEY = 'fbw_h5_browse_immersive'

const LEGACY_DISPLAY_MODE_KEYS = [
  'fbw_h5_search_display_mode',
  'fbw_h5_favorites_display_mode',
  'fbw_h5_history_display_mode',
  'fbw_h5_collections_display_mode'
]

export const DEFAULT_H5_DISPLAY_MODE = 'fullscreen'
export const DEFAULT_H5_DISPLAY_SIZE = 'cover'

export function readH5DisplayMode() {
  try {
    const stored = localStorage.getItem(H5_BROWSE_DISPLAY_MODE_KEY)
    if (stored === 'waterfall' || stored === 'fullscreen') {
      return stored
    }
    for (const key of LEGACY_DISPLAY_MODE_KEYS) {
      const legacy = localStorage.getItem(key)
      if (legacy === 'waterfall' || legacy === 'fullscreen') {
        writeH5DisplayMode(legacy)
        return legacy
      }
    }
  } catch {
    /* noop */
  }
  return DEFAULT_H5_DISPLAY_MODE
}

export function writeH5DisplayMode(mode) {
  if (mode !== 'waterfall' && mode !== 'fullscreen') {
    return
  }
  try {
    localStorage.setItem(H5_BROWSE_DISPLAY_MODE_KEY, mode)
  } catch {
    /* noop */
  }
}

export function readH5DisplaySize() {
  try {
    const stored = localStorage.getItem(H5_BROWSE_DISPLAY_SIZE_KEY)
    if (stored === 'cover' || stored === 'contain') {
      return stored
    }
  } catch {
    /* noop */
  }
  return DEFAULT_H5_DISPLAY_SIZE
}

export function writeH5DisplaySize(size) {
  if (size !== 'cover' && size !== 'contain') {
    return
  }
  try {
    localStorage.setItem(H5_BROWSE_DISPLAY_SIZE_KEY, size)
  } catch {
    /* noop */
  }
}

export function readH5ImmersiveMode() {
  try {
    const stored = localStorage.getItem(H5_BROWSE_IMMERSIVE_KEY)
    if (stored === '1' || stored === 'true') {
      return true
    }
    if (stored === '0' || stored === 'false') {
      return false
    }
  } catch {
    /* noop */
  }
  return false
}

export function writeH5ImmersiveMode(enabled) {
  try {
    localStorage.setItem(H5_BROWSE_IMMERSIVE_KEY, enabled ? '1' : '0')
  } catch {
    /* noop */
  }
}

/** keep-alive 切回页面时与全局偏好对齐 */
export function syncH5BrowsePreferencesFromStorage({ displayModeRef, displaySizeTarget }) {
  if (displayModeRef) {
    displayModeRef.value = readH5DisplayMode()
  }
  if (displaySizeTarget) {
    displaySizeTarget.displaySize = readH5DisplaySize()
  }
}
