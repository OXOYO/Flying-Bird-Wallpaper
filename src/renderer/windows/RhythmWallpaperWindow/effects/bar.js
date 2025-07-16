import { Rect } from 'leafer-ui'

export class BarEffect {
  constructor(leafer, config) {
    this.leafer = leafer
    this.config = config
    this.bars = []
    this.barCount = 64 // 可根据实际频谱点数调整
    this.initBars()
  }

  initBars() {
    for (let i = 0; i < this.barCount; i++) {
      const rect = new Rect({
        width: 10,
        height: 10,
        x: 0,
        y: 0,
        fill: this.getFill(),
        shadow: this.config.shadow ? { color: '#000', blur: 10, x: 0, y: 2 } : undefined
      })
      this.leafer.add(rect)
      this.bars.push(rect)
    }
  }

  getFill() {
    if (this.config.gradient && this.config.gradient.length > 1) {
      return {
        type: 'linear',
        stops: this.config.gradient.map((color, i) => ({
          color,
          offset: i / (this.config.gradient.length - 1)
        })),
        from: 'top',
        to: 'bottom'
      }
    }
    return this.config.color || '#00ffcc'
  }

  render(dataArray) {
    const { width, height } = this.leafer
    const barWidth = (width * (this.config.widthRatio || 1)) / this.barCount
    const maxBarHeight = height * (this.config.heightRatio || 0.8)
    const renderType = this.config.renderType || 'linear'

    for (let i = 0; i < this.barCount; i++) {
      let value
      // 1. 频谱下标映射
      if (renderType === 'log') {
        const index = Math.floor(Math.pow(i / this.barCount, 2) * (dataArray.length - 1))
        value = dataArray[index] || 0
      } else {
        value = dataArray[i] || 0
      }

      // 2. 柱子高度权重
      let weight = 1
      if (renderType === 'parabola') {
        const center = (this.barCount - 1) / 2
        const distance = (i - center) / center
        weight = 1 - distance * distance // 抛物线分布
      }

      const barHeight = (value / 255) * maxBarHeight * weight
      const rect = this.bars[i]
      rect.width = barWidth * 0.8
      rect.height = barHeight
      rect.x = i * barWidth
      rect.y = height - barHeight
      rect.fill = this.getFill()
      rect.shadow = this.config.shadow ? { color: '#000', blur: 10, x: 0, y: 2 } : undefined
    }
  }

  destroy() {
    this.bars.forEach((rect) => rect.remove())
    this.bars = []
  }
}
