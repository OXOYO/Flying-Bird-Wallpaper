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
    const barCount = this.config.barCount || 32
    const widthRatio = this.config.widthRatio ?? 1
    const heightRatio = this.config.heightRatio ?? 1

    const totalBarWidth = width * widthRatio
    const barWidth = totalBarWidth / barCount
    const xOffset = (width - totalBarWidth) / 2 // 居中

    const centerIndex = (barCount - 1) / 2

    for (let i = 0; i < barCount; i++) {
      const value = dataArray[i % dataArray.length] || 0
      const mapped = this.getMappedValue(value)

      // 3D 透视比例
      const angle = ((i - centerIndex) / barCount) * Math.PI // -π/2 ~ π/2
      const scale = Math.cos(angle) * 0.6 + 0.8 // 中间1.4, 两侧0.2

      const barHeight = height * heightRatio * mapped * scale
      const x = xOffset + i * barWidth
      const y = height - barHeight

      const bar = this.bars[i]
      bar.x = x
      bar.y = y
      bar.width = barWidth * 0.8 * scale // 宽度也有透视
      bar.height = barHeight
      bar.opacity = 0.5 + mapped * 0.5
      bar.fill = this.getFill(i)
      // 可选：加顶部高光、底部阴影等进一步增强3D感
    }
  }

  destroy() {
    this.bars.forEach((b) => b.remove())
    this.bars = []
  }
}
