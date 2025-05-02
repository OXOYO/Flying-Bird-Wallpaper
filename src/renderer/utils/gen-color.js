/**
 * 颜色生成
 */

const RGBUnit = 255
const HEX_MAP = {
  0: 0,
  1: 1,
  2: 2,
  3: 3,
  4: 4,
  5: 5,
  6: 6,
  7: 7,
  8: 8,
  9: 9,
  A: 10,
  B: 11,
  C: 12,
  D: 13,
  E: 14,
  F: 15
}
const rgbWhite = {
  r: 255,
  g: 255,
  b: 255
}
const rgbBlack = {
  r: 0,
  g: 0,
  b: 0
}

/**
 * RGB颜色转HSL颜色值
 * @param rgb { r: number, g: number, b: number }
 * @returns { h: number, s: number, l: number }
 */
function rgbToHsl(rgb) {
  let { r, g, b } = rgb
  const hsl = {
    h: 0,
    s: 0,
    l: 0
  }

  // 计算rgb基数 ∈ [0, 1]
  r /= RGBUnit
  g /= RGBUnit
  b /= RGBUnit
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)

  // 计算h
  if (max === min) {
    hsl.h = 0
  } else if (max === r) {
    hsl.h = 60 * ((g - b) / (max - min)) + (g >= b ? 0 : 360)
  } else if (max === g) {
    hsl.h = 60 * ((b - r) / (max - min)) + 120
  } else {
    hsl.h = 60 * ((r - g) / (max - min)) + 240
  }
  hsl.h = hsl.h > 360 ? hsl.h - 360 : hsl.h

  // 计算l
  hsl.l = (max + min) / 2

  // 计算s
  if (hsl.l === 0 || max === min) {
    // 灰/白/黑
    hsl.s = 0
  } else if (hsl.l > 0 && hsl.l <= 0.5) {
    hsl.s = (max - min) / (max + min)
  } else {
    hsl.s = (max - min) / (2 - (max + min))
  }

  return hsl
}

/**
 * hsl -> rgb
 * @param hsl { h: number, s: number, l: number }
 * @returns { r: number, g: number, b: number }
 */
function hslToRgb(hsl) {
  const { h, s, l } = hsl
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s
  const p = 2 * l - q
  const hUnit = h / 360 // 色相转换为 [0, 1]

  const Cr = fillCircleVal(hUnit + 1 / 3)
  const Cg = fillCircleVal(hUnit)
  const Cb = fillCircleVal(hUnit - 1 / 3)

  // 保持 [0, 1] 环状取值
  function fillCircleVal(val) {
    return val < 0 ? val + 1 : val > 1 ? val - 1 : val
  }

  function computedRgb(val) {
    let colorVal
    if (val < 1 / 6) {
      colorVal = p + (q - p) * 6 * val
    } else if (val >= 1 / 6 && val < 1 / 2) {
      colorVal = q
    } else if (val >= 1 / 2 && val < 2 / 3) {
      colorVal = p + (q - p) * 6 * (2 / 3 - val)
    } else {
      colorVal = p
    }
    return colorVal * 255
  }

  return {
    r: Number(computedRgb(Cr).toFixed(0)),
    g: Number(computedRgb(Cg).toFixed(0)),
    b: Number(computedRgb(Cb).toFixed(0))
  }
}

/**
 * 16进制颜色转换RGB
 * @param hex string
 * @returns { r: number, g: number, b: number }
 */
function hexToRGB(hex) {
  hex = hex.toUpperCase()
  const hexRegExp = /^#([0-9A-F]{6})$/
  if (!hexRegExp.test(hex)) {
    throw new Error('请传入合法的16进制颜色值，eg: #FF0000')
  }

  const hexValArr = (hexRegExp.exec(hex) || ['000000'])[1].split('')

  return {
    r: HEX_MAP[hexValArr[0]] * 16 + HEX_MAP[hexValArr[1]],
    g: HEX_MAP[hexValArr[2]] * 16 + HEX_MAP[hexValArr[3]],
    b: HEX_MAP[hexValArr[4]] * 16 + HEX_MAP[hexValArr[5]]
  }
}

/**
 * rgb 转 16进制
 * @param rgb { r: number, g: number, b: number }
 * @returns string
 */
function rgbToHex(rgb) {
  const HEX_MAP_REVERSE = {}
  for (const key in HEX_MAP) {
    HEX_MAP_REVERSE[HEX_MAP[key]] = key
  }
  function getRemainderAndQuotient(val) {
    val = Math.round(val)
    return `${HEX_MAP_REVERSE[Math.floor(val / 16)]}${HEX_MAP_REVERSE[val % 16]}`
  }

  return `#${getRemainderAndQuotient(rgb.r)}${getRemainderAndQuotient(rgb.g)}${getRemainderAndQuotient(rgb.b)}`
}

// hsl 转 16进制
function hslToHex(hsl) {
  return rgbToHex(hslToRgb(hsl))
}

// 16进制 转 hsl
function hexToHsl(hex) {
  return rgbToHsl(hexToRGB(hex))
}

// 生成混合色（混黑 + 混白）
function genMixColor(base) {
  // 基准色统一转换为RGB
  if (typeof base === 'string') {
    base = hexToRGB(base)
  } else if ('h' in base) {
    base = hslToRgb(base)
  }

  // 混合色
  function mix(color, mixColor, weight) {
    return {
      r: color.r * (1 - weight) + mixColor.r * weight,
      g: color.g * (1 - weight) + mixColor.g * weight,
      b: color.b * (1 - weight) + mixColor.b * weight
    }
  }

  return {
    DEFAULT: rgbToHex(base),
    dark: {
      1: rgbToHex(mix(base, rgbBlack, 0.1)),
      2: rgbToHex(mix(base, rgbBlack, 0.2)),
      3: rgbToHex(mix(base, rgbBlack, 0.3)),
      4: rgbToHex(mix(base, rgbBlack, 0.4)),
      5: rgbToHex(mix(base, rgbBlack, 0.5)),
      6: rgbToHex(mix(base, rgbBlack, 0.6)),
      7: rgbToHex(mix(base, rgbBlack, 0.7)),
      8: rgbToHex(mix(base, rgbBlack, 0.78)),
      9: rgbToHex(mix(base, rgbBlack, 0.85))
    },
    light: {
      1: rgbToHex(mix(base, rgbWhite, 0.1)),
      2: rgbToHex(mix(base, rgbWhite, 0.2)),
      3: rgbToHex(mix(base, rgbWhite, 0.3)),
      4: rgbToHex(mix(base, rgbWhite, 0.4)),
      5: rgbToHex(mix(base, rgbWhite, 0.5)),
      6: rgbToHex(mix(base, rgbWhite, 0.6)),
      7: rgbToHex(mix(base, rgbWhite, 0.7)),
      8: rgbToHex(mix(base, rgbWhite, 0.78)),
      9: rgbToHex(mix(base, rgbWhite, 0.85))
    }
  }
}

export { genMixColor, rgbToHsl, rgbToHex, hslToRgb, hslToHex, hexToRGB, hexToHsl }
