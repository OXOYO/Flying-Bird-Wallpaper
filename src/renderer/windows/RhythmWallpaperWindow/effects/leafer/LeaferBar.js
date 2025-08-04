import { LeaferBase } from './LeaferBase'
import { Rect } from 'leafer-ui'

export class LeaferBar extends LeaferBase {
  constructor(leafer, config) {
    super(leafer, config)
    this.bars = []
    this.densityOptions = {
      sparse: 32,
      normal: 64,
      dense: 128
    }
    this.barCount = this.densityOptions[this.config.density] || this.densityOptions.normal
    this.init()
  }

  init() {
    for (let i = 0; i < this.barCount; i++) {
      const rect = new Rect({
        width: 10,
        height: 10,
        x: 0,
        y: 0,
        fill: this.getFill('linear'),
        shadow: this.config.shadow ? { color: '#000', blur: 10, x: 0, y: 2 } : undefined
      })
      this.leafer.add(rect)
      this.bars.push(rect)
    }
  }

  render(dataArray) {
    const barWidth = this.bodySize.width / this.barCount
    const offsetX = this.bodySize.x - this.bodySize.width / 2
    const offsetY = this.bodySize.y - this.bodySize.height / 2
    const mappedValues = this.getMappedValues(this.getReducedValues(dataArray, this.barCount))

    for (let i = 0; i < this.barCount; i++) {
      const value = mappedValues[i]
      const rect = this.bars[i]
      rect.width = barWidth * 0.8
      rect.height = value * this.bodySize.height
      rect.x = offsetX + i * barWidth
      rect.y = offsetY + (this.bodySize.height - rect.height)
      rect.fill = this.getFill('linear')
      rect.shadow = this.config.shadow ? { color: '#000', blur: 10, x: 0, y: 2 } : undefined
    }
  }

  destroy() {
    this.bars.forEach((rect) => rect.remove())
    this.bars = []
  }
}
