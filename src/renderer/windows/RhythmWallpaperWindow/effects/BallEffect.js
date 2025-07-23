import { Ellipse } from 'leafer-ui'
import { BaseEffect } from './BaseEffect'

export class BallEffect extends BaseEffect {
  constructor(leafer, config) {
    super(leafer, config)
    this.balls = []
    this.densityOptions = {
      sparse: 8,
      normal: 16,
      dense: 32
    }
    this.ballCount = this.densityOptions[this.config.density] || this.densityOptions.normal
    this.init()
  }

  init() {
    for (let i = 0; i < this.ballCount; i++) {
      const circle = new Ellipse({
        width: 20,
        height: 20,
        x: 0,
        y: 0,
        fill: this.getFill('random'),
        shadow: this.config.shadow ? { color: '#000', blur: 10, x: 0, y: 2 } : undefined
      })
      this.leafer.add(circle)
      this.balls.push(circle)
    }
  }

  render(dataArray) {
    const mappedValues = this.getMappedValues(this.getReducedValues(dataArray, this.ballCount))
    const ballSpacing = this.bodySize.width / (this.ballCount + 1)
    const minRadius = Math.max(4, (ballSpacing * 0.3) / 2)
    const maxRadius = Math.max(8, (ballSpacing * 0.9) / 2)

    for (let i = 0; i < this.ballCount; i++) {
      const value = mappedValues[i]
      const radius = minRadius + value * (maxRadius - minRadius)
      // 直接根据 value 计算 y 坐标
      const y = this.bodySize.y + this.bodySize.height / 2 - radius - value * this.bodySize.height

      const circle = this.balls[i]
      circle.width = radius * 2
      circle.height = radius * 2
      circle.x = this.bodySize.x - this.bodySize.width / 2 + (i + 1) * ballSpacing
      circle.y = y
      circle.fill = this.getFill('random')
      circle.shadow = this.config.shadow ? { color: '#000', blur: 10, x: 0, y: 2 } : undefined
    }
  }

  destroy() {
    this.balls.forEach((circle) => circle.remove())
    this.balls = []
  }
}
