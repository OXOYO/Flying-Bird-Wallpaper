import { BaseEffect } from './BaseEffect'
import { Rect } from 'leafer-ui'

export class Bars3DEffect extends BaseEffect {
  constructor(leafer, config) {
    super(leafer, config)
    this.barCount = config.barCount || 32
    this.bars = []
    this.initBars()
  }

  initBars() {
    for (let i = 0; i < this.barCount; i++) {
      const bar = new Rect({
        width: 18,
        height: 40,
        fill: this.getFill(i),
        opacity: 0.8
      })
      this.leafer.add(bar)
      this.bars.push(bar)
    }
  }

  render(dataArray) {
    const { width, height } = this.leafer
    const centerX = width / 2
    const baseY = height * 0.7
    const barW = width / (this.barCount * 1.5)
    for (let i = 0; i < this.barCount; i++) {
      const value = dataArray[i % dataArray.length] || 0
      const mapped = this.getMappedValue(value)
      // 3D 透视效果
      const angle = (((i - this.barCount / 2) / this.barCount) * Math.PI) / 2
      const scale = Math.cos(angle) * 0.7 + 1
      const bar = this.bars[i]
      bar.width = barW * scale
      bar.height = 40 + mapped * 120 * scale
      bar.x = centerX + Math.sin(angle) * width * 0.35
      bar.y = baseY - bar.height
      bar.opacity = 0.5 + mapped * 0.5
      bar.fill = this.getFill(i)
    }
  }

  destroy() {
    this.bars.forEach((b) => b.remove())
    this.bars = []
  }
}
