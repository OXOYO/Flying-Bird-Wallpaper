/** 解析 #RGB / #RRGGBB */
export function parseHexColor(hex) {
  const raw = String(hex || '#808080').replace('#', '')
  if (raw.length === 3) {
    return {
      r: parseInt(raw[0] + raw[0], 16),
      g: parseInt(raw[1] + raw[1], 16),
      b: parseInt(raw[2] + raw[2], 16)
    }
  }
  return {
    r: parseInt(raw.slice(0, 2), 16) || 128,
    g: parseInt(raw.slice(2, 4), 16) || 128,
    b: parseInt(raw.slice(4, 6), 16) || 128
  }
}

/** 壁纸是否为浅色（如 #FFFFFF） */
export function isLightColor(hex) {
  const { r, g, b } = parseHexColor(hex)
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255
  return luminance > 0.72
}
