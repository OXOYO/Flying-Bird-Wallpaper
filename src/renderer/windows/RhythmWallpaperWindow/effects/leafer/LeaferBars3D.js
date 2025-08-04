import { LeaferBase } from './LeaferBase'
import { Rect, Path } from 'leafer-ui'

export class LeaferBars3D extends LeaferBase {
  constructor(leafer, config) {
    super(leafer, config)
    this.densityOptions = {
      sparse: 16,
      normal: 32,
      dense: 64
    }
    this.barCount = this.densityOptions[this.config.density] || this.densityOptions.normal
    this.bars = []
    this.init()
  }

  init() {
    for (let i = 0; i < this.barCount; i++) {
      // 用 Path 代替 Rect，支持多边形
      const barFront = new Path({ opacity: 0.9 })
      const barSide = new Path({ opacity: 0.7 })
      const barTop = new Path({ opacity: 0.8 })
      this.leafer.add(barFront)
      this.leafer.add(barSide)
      this.leafer.add(barTop)
      this.bars.push({ front: barFront, side: barSide, top: barTop })
    }
  }

  render(dataArray) {
    const { x, y, width, height } = this.bodySize
    const barCount = this.barCount
    const gapRatio = 0.1 // 10% 用于间隔
    const maxScale = 1.4
    const baseBarWidth = width / (barCount * (1 - gapRatio) * maxScale)
    let currentX = x - width / 2
    const centerIndex = (barCount - 1) / 2
    const mappedValues = this.getMappedValues(this.getReducedValues(dataArray, barCount))
    const sideDepth = baseBarWidth * 0.25 // 侧面厚度

    // 渐变 stops
    let stops = []
    if (this.config.colors && this.config.colors.length > 1) {
      stops = this.config.colors.map((color, idx) => ({
        color: typeof color === 'string' ? color : '#00ffcc',
        offset: idx / (this.config.colors.length - 1)
      }))
    } else {
      stops = [
        { color: this.config.colors?.[0] || '#00ffcc', offset: 0 },
        { color: this.config.colors?.[0] || '#00ffcc', offset: 1 }
      ]
    }

    for (let i = 0; i < barCount; i++) {
      const mapped = mappedValues[i]
      const angle = ((i - centerIndex) / barCount) * Math.PI
      const scale = Math.cos(angle) * 0.6 + 0.8
      const barW = baseBarWidth * (1 - gapRatio) * scale
      const gap = baseBarWidth * gapRatio
      const barHeight = height * mapped * scale
      const bx = currentX
      const by = y + height / 2 - barHeight
      // 正面多边形
      const frontPath = `M${bx},${by} L${bx + barW},${by} L${bx + barW},${by + barHeight} L${bx},${by + barHeight} Z`
      // 右侧面多边形
      const sidePath = `M${bx + barW},${by} L${bx + barW + sideDepth},${by - sideDepth * 0.5} L${bx + barW + sideDepth},${by + barHeight - sideDepth * 0.5} L${bx + barW},${by + barHeight} Z`
      // 顶部面多边形
      const topPath = `M${bx},${by} L${bx + barW},${by} L${bx + barW + sideDepth},${by - sideDepth * 0.5} L${bx + sideDepth},${by - sideDepth * 0.5} Z`
      // 填充色
      let mainColor = '#00ffcc'
      if (this.config.colors && this.config.colors.length > 0) {
        mainColor = this.config.colors[i % this.config.colors.length] || '#00ffcc'
      }
      const sideColor = '#222222' // 右侧面用深色
      this.bars[i].front.path = frontPath
      this.bars[i].front.fill = this.getFill('linear')
      this.bars[i].front.opacity = 0.9
      this.bars[i].side.path = sidePath
      this.bars[i].side.fill = sideColor
      this.bars[i].side.opacity = 0.7
      // 顶部面渐变
      this.bars[i].top.path = topPath
      this.bars[i].top.fill = {
        type: 'linear',
        from: { x: bx, y: by },
        to: { x: bx, y: by - sideDepth * 0.5 },
        stops: [
          { offset: 0, color: '#fff', opacity: 0.8 },
          { offset: 1, color: mainColor }
        ]
      }
      this.bars[i].top.opacity = 0.8
      currentX += barW + gap
    }
  }

  destroy() {
    this.bars.forEach((b) => {
      b.front.remove()
      b.side.remove()
      b.top.remove()
    })
    this.bars = []
  }
}
