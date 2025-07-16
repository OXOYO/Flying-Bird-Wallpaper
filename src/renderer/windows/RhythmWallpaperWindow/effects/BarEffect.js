import { BaseEffect } from './BaseEffect'
import { Rect } from 'leafer-ui'

export class BarEffect extends BaseEffect {
  constructor(leafer, config) {
    super(leafer, config)
    this.bars = []
    this.initBars()
  }

  initBars() {
    for (let i = 0; i < this.config.barCount; i++) {
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

  render(dataArray) {
    const { width, height } = this.leafer
    const barWidth = (width * (this.config.widthRatio || 1)) / this.config.barCount
    const maxBarHeight = height * (this.config.heightRatio || 0.8)
    const renderType = this.config.renderType || 'linear'

    for (let i = 0; i < this.config.barCount; i++) {
      let value
      // 1. 频谱下标映射
      if (renderType === 'log') {
        const index = Math.floor(Math.pow(i / this.config.barCount, 2) * (dataArray.length - 1))
        value = dataArray[index] || 0
      } else {
        value = dataArray[i] || 0
      }

      // 2. 柱子高度权重
      let weight = 1
      if (renderType === 'parabola') {
        const center = (this.config.barCount - 1) / 2
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
