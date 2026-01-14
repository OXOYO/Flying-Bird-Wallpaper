import { genMixColor } from './gen-color.js'

// 设置css变量
export const setStyleProperty = (prop, color) => {
  document.documentElement.style.setProperty(prop, color)
}

// 更新品牌色变量
export const updateBrandExtendColorsVar = (color, name = 'primary') => {
  if (!color || !name) return
  const { DEFAULT, dark, light } = genMixColor(color)
  // 每种主题色由浅到深分为五个阶梯以供开发者使用。
  setStyleProperty(`--${name}-lighter-color`, light[5])
  setStyleProperty(`--${name}-light-color`, light[3])
  setStyleProperty(`--${name}-color`, DEFAULT)
  setStyleProperty(`--${name}-deep-color`, dark[2])
  setStyleProperty(`--${name}-deeper-color`, dark[4])

  // elementPlus主题色更新
  setStyleProperty(`--el-color-${name}`, DEFAULT)
  setStyleProperty(`--el-color-${name}-dark-2`, dark[2])
  setStyleProperty(`--el-color-${name}-light-3`, light[3])
  setStyleProperty(`--el-color-${name}-light-5`, light[5])
  setStyleProperty(`--el-color-${name}-light-7`, light[7])
  setStyleProperty(`--el-color-${name}-light-8`, light[8])
  setStyleProperty(`--el-color-${name}-light-9`, light[9])
}

// 更新主题色变量
export const updateThemeColorVar = (colors) => {
  // 遍历当前主题色，生成混合色，并更新到css变量
  for (const brand in colors) {
    if (['primary', 'success', 'info', 'warning', 'danger'].includes(brand)) {
      updateBrandExtendColorsVar(colors[brand], brand)
    }
  }
}
