import { Ellipse } from 'leafer-ui'
import { BaseEffect } from './BaseEffect'

export class BallEffect extends BaseEffect {
  constructor(leafer, config) {
    super(leafer, config)
    this.balls = []
    this.velocities = Array(this.config.ballCount).fill(0)
    this.positions = Array(this.config.ballCount).fill(0)
    this.initBalls()
  }

  initBalls() {
    for (let i = 0; i < this.config.ballCount; i++) {
      const circle = new Ellipse({
        width: 20,
        height: 20,
        x: 0,
        y: 0,
        fill: this.getFill(i),
        shadow: this.config.shadow ? { color: '#000', blur: 10, x: 0, y: 2 } : undefined
      })
      this.leafer.add(circle)
      this.balls.push(circle)
      this.positions[i] = 0
      this.velocities[i] = 0
    }
  }

  render(dataArray) {
    const { width, height } = this.leafer
    const maxBallHeight = height * this.config.heightRatio
    const ballSpacing = (width * this.config.widthRatio) / (this.config.ballCount + 1)
    const margin = 4 // 小球之间的最小间隔
    const maxRadius = Math.max(8, (ballSpacing - margin) / 2.2)
    const minRadius = Math.max(4, maxRadius * 0.3) // 最小半径更小
    for (let i = 0; i < this.config.ballCount; i++) {
      const value = dataArray[i * 4] || 0
      const mapped = this.getMappedValue(value) // 0~1
      const enhancedMapped = Math.pow(mapped, 0.7) // 拉大动态
      const radius = minRadius + enhancedMapped * (maxRadius - minRadius)
      const targetY = height - enhancedMapped * maxBallHeight - radius
      this.velocities[i] += (targetY - this.positions[i]) * 0.2
      this.velocities[i] *= 0.7
      this.positions[i] += this.velocities[i]
      const circle = this.balls[i]
      // circle.radius = radius
      circle.width = radius * 2 // 按 Leafer 文档，width/height 控制圆的大小
      circle.height = radius * 2
      circle.x = (i + 1) * ballSpacing
      circle.y = this.positions[i]
      circle.fill = this.getFill(i)
      circle.shadow = this.config.shadow ? { color: '#000', blur: 10, x: 0, y: 2 } : undefined
    }
  }

  destroy() {
    this.balls.forEach((circle) => circle.remove())
    this.balls = []
  }
}
