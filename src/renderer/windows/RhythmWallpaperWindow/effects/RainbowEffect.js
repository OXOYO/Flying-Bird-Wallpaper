import { BaseEffect } from './BaseEffect'
import { Path } from 'leafer-ui'
import { lerpHSL } from '@renderer/utils/gen-color.js'

export class RainbowEffect extends BaseEffect {
  constructor(leafer, config) {
    super(leafer, {
      smallExtraAngle: 0.25,
      // 彩虹条数
      rainbowCount: 48,
      // 光晕条数
      glowCount: 12,
      ...config
    })

    this.densityOptions = {
      sparse: { rainbowCount: 8, glowCount: 2 },
      normal: { rainbowCount: 16, glowCount: 4 },
      dense: { rainbowCount: 24, glowCount: 6 }
    }

    this.rainbowCount =
      this.densityOptions[this.config.density]?.rainbowCount ||
      this.densityOptions.normal.rainbowCount
    this.glowCount =
      this.densityOptions[this.config.density]?.glowCount || this.densityOptions.normal.glowCount

    this.arcs = []
    this.lastScale = 1
    this.init()
  }

  init() {
    this.arcs.forEach((p) => p.remove())
    this.arcs = []
    // 主彩虹+光晕
    const count = this.rainbowCount + this.glowCount
    for (let i = 0; i < count; i++) {
      const path = new Path({
        stroke: '#fff',
        strokeWidth: 1,
        opacity: 0.85,
        fill: null
      })
      this.leafer.add(path)
      this.arcs.push(path)
    }
  }

  getArcColor(t) {
    // t: 0(外)~1(内)，HSL插值
    if (!this.config.colors || this.config.colors.length === 0) {
      return '#fff'
    }
    if (this.config.colors.length === 1) return this.config.colors[0]
    const seg = this.config.colors.length - 1
    const pos = t * seg
    const idx = Math.floor(pos)
    const t2 = pos - idx
    const colorA = this.config.colors[idx]
    const colorB = this.config.colors[idx + 1] || this.config.colors[this.config.colors.length - 1]
    return lerpHSL(colorA, colorB, t2)
  }

  render(dataArray) {
    const { x, y, width, height } = this.bodySize

    // 确保有合理的尺寸
    if (width <= 0 || height <= 0) {
      return
    }

    // 使用固定的彩虹参数，避免复杂的几何计算
    const cx = x // bodySize的中心X坐标
    const cy = y + height / 2 // bodySize的底部，让彩虹底部对齐
    const r = Math.min(width, height) * 0.4 // 使用bodySize较小边的40%作为半径

    const mappedValues = this.getMappedValues(dataArray)
    const avgValue = mappedValues.reduce((a, b) => a + b, 0) / mappedValues.length

    // 检查是否有音频，没有音频时不显示
    if (avgValue < 0.02) {
      this.arcs.forEach((arc) => (arc.path = ''))
      return
    }

    // scale变化范围更大，弹性平滑
    const targetScale = 0.8 + avgValue * 1.1
    this.lastScale = this.lastScale * 0.7 + targetScale * 0.3
    const scale = this.lastScale
    const R = r * scale
    const arcWidth = R * 0.1 // 彩虹宽度为半径的10%
    // 固定的角度范围
    const startAngle = Math.PI + 0.2
    const endAngle = 2 * Math.PI - 0.2
    const seg = 180
    // 主彩虹弧
    const rainbowCount = this.rainbowCount
    for (let i = 0; i < rainbowCount; i++) {
      const t = i / (rainbowCount - 1)
      const rArc = R - t * arcWidth
      let d = ''
      for (let j = 0; j <= seg; j++) {
        const ang = startAngle + ((endAngle - startAngle) * j) / seg
        const px = cx + Math.cos(ang) * rArc
        const py = cy + Math.sin(ang) * rArc
        d += (j === 0 ? 'M' : 'L') + px + ',' + py + ' '
      }

      // 确保路径不为空
      if (d.trim() === '') {
        continue
      }

      this.arcs[i].path = d
      this.arcs[i].stroke = this.getArcColor(t)
      this.arcs[i].strokeWidth = arcWidth / rainbowCount
      this.arcs[i].opacity = 0.85
      this.arcs[i].fill = null
      if (i < 8) {
        this.arcs[i].shadow = {
          color: this.getArcColor(t),
          blur: 10 + 16 * (1 - t),
          x: 0,
          y: 0
        }
      } else {
        this.arcs[i].shadow = null
      }
    }
    // 简化的光晕
    const glowCount = this.glowCount
    for (let i = 0; i < glowCount; i++) {
      const t = i / (glowCount - 1)
      const rArc = R + t * (arcWidth * 0.5)
      let d = ''
      for (let j = 0; j <= seg; j++) {
        const ang = startAngle + ((endAngle - startAngle) * j) / seg
        const px = cx + Math.cos(ang) * rArc
        const py = cy + Math.sin(ang) * rArc
        d += (j === 0 ? 'M' : 'L') + px + ',' + py + ' '
      }
      if (d.trim() !== '') {
        this.arcs[rainbowCount + i].path = d
        this.arcs[rainbowCount + i].stroke = this.getArcColor(0)
        this.arcs[rainbowCount + i].strokeWidth = arcWidth / glowCount
        this.arcs[rainbowCount + i].opacity = 0.1 * (1 - t)
        this.arcs[rainbowCount + i].fill = null
        this.arcs[rainbowCount + i].shadow = null
      }
    }
  }

  destroy() {
    this.arcs.forEach((p) => p.remove())
    this.arcs = []
  }
}
