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
      sparse: { rainbowCount: 24, glowCount: 6 },
      normal: { rainbowCount: 48, glowCount: 12 },
      dense: { rainbowCount: 60, glowCount: 20 }
    }

    this.rainbowCount =
      this.densityOptions[this.config.density]?.rainbowCount ||
      this.densityOptions.normal.rainbowCount
    this.glowCount =
      this.densityOptions[this.config.density]?.glowCount || this.densityOptions.normal.glowCount

    this.arcs = []
    this.lastScale = 1
    this.initArcs()
  }

  initArcs() {
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
    if (!this.config.colors || this.config.colors.length === 0) return '#fff'
    if (this.config.colors.length === 1) return this.config.colors[0]
    const seg = this.config.colors.length - 1
    const pos = t * seg
    const idx = Math.floor(pos)
    const t2 = pos - idx
    const colorA = this.config.colors[idx]
    const colorB = this.config.colors[idx + 1] || this.config.colors[this.config.colors.length - 1]
    return lerpHSL(colorA, colorB, t2)
  }

  // getMappedValue(dataArray) {
  //   const type = this.config.animation
  //   const max = Math.max(...dataArray) / 255
  //   if (type === 'linear') {
  //     return max
  //   } else if (type === 'log') {
  //     return Math.log2(1 + max * 255) / Math.log2(256)
  //   } else if (type === 'parabola') {
  //     return Math.pow(max, 2)
  //   } else if (type === 'sqrt') {
  //     return Math.sqrt(max)
  //   } else if (type === 'exp') {
  //     return Math.pow(max, 1.5)
  //   } else if (type === 'sin') {
  //     const t = Date.now() / 500
  //     return 0.5 + 0.5 * Math.sin(t)
  //   } else if (type === 'bounce') {
  //     const t = Date.now() / 400
  //     let y = 0
  //     if (max < 1 / 2.75) {
  //       y = 7.5625 * max * max
  //     } else if (max < 2 / 2.75) {
  //       y = 7.5625 * (max - 1.5 / 2.75) * (max - 1.5 / 2.75) + 0.75
  //     } else if (max < 2.5 / 2.75) {
  //       y = 7.5625 * (max - 2.25 / 2.75) * (max - 2.25 / 2.75) + 0.9375
  //     } else {
  //       y = 7.5625 * (max - 2.625 / 2.75) * (max - 2.625 / 2.75) + 0.984375
  //     }
  //     return Math.min(1, Math.max(0, y))
  //   } else if (type === 'step') {
  //     return Math.floor(max * 5) / 5
  //   } else {
  //     return max
  //   }
  // }

  render(dataArray) {
    const { width, height } = this.leafer
    const widthRatio = this.config.widthRatio || 0.8
    const heightRatio = this.config.heightRatio || 0.3
    const left = (width * (1 - widthRatio)) / 2
    const arcHeight = height * heightRatio
    const cx = width / 2
    const dx = left - cx
    const r = (dx * dx + arcHeight * arcHeight) / (2 * arcHeight)
    const cy = height - arcHeight + r
    if (!isFinite(r) || r < 10 || cy < 0 || cy > 10 * height) {
      this.arcs.forEach((arc) => (arc.path = ''))
      return
    }
    const energy = this.getMappedValue(Math.max(...dataArray))
    // scale变化范围更大，弹性平滑
    const targetScale = 0.8 + energy * 1.1
    this.lastScale = this.lastScale * 0.7 + targetScale * 0.3
    const scale = this.lastScale
    const R = r * scale
    const arcWidth = Math.max(10, arcHeight * 0.5)
    // 角度范围，增加smallExtraAngle让两端超出屏幕
    const theta = Math.acos(dx / R)
    const smallExtraAngle =
      this.config.smallExtraAngle !== undefined ? this.config.smallExtraAngle : 0.25
    const startAngle = Math.PI + theta + smallExtraAngle
    const endAngle = 2 * Math.PI - theta - smallExtraAngle
    const seg = 180
    // 主彩虹弧
    const rainbowCount = this.rainbowCount
    for (let i = 0; i < rainbowCount; i++) {
      const t = i / (rainbowCount - 1)
      const rArc = R - t * arcWidth
      let d = ''
      for (let j = 0; j <= seg; j++) {
        const ang = startAngle + ((endAngle - startAngle) * j) / seg
        const x = cx + Math.cos(ang) * rArc
        const y = cy + Math.sin(ang) * rArc
        d += (j === 0 ? 'M' : 'L') + x + ',' + y + ' '
      }
      this.arcs[i].path = d
      this.arcs[i].stroke = this.getArcColor(t)
      this.arcs[i].strokeWidth = arcWidth / rainbowCount
      this.arcs[i].opacity = 0.85
      this.arcs[i].fill = null
      // 只给最外层8条加shadow
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
    // 光晕
    const glowCount = this.glowCount
    for (let i = 0; i < glowCount; i++) {
      const t = i / (glowCount - 1)
      const rArc = R + t * (arcWidth * 0.9)
      let d = ''
      for (let j = 0; j <= seg; j++) {
        const ang = startAngle + ((endAngle - startAngle) * j) / seg
        const x = cx + Math.cos(ang) * rArc
        const y = cy + Math.sin(ang) * rArc
        d += (j === 0 ? 'M' : 'L') + x + ',' + y + ' '
      }
      this.arcs[rainbowCount + i].path = d
      this.arcs[rainbowCount + i].stroke = this.getArcColor(0)
      this.arcs[rainbowCount + i].strokeWidth = (arcWidth / glowCount) * 1.5
      this.arcs[rainbowCount + i].opacity = 0.12 * (1 - t)
      this.arcs[rainbowCount + i].fill = null
      // 只给最外层4条加shadow
      if (i < 4) {
        this.arcs[rainbowCount + i].shadow = {
          color: this.getArcColor(0),
          blur: 22 + 28 * t,
          x: 0,
          y: 0
        }
      } else {
        this.arcs[rainbowCount + i].shadow = null
      }
    }
  }

  destroy() {
    this.arcs.forEach((p) => p.remove())
    this.arcs = []
  }
}
