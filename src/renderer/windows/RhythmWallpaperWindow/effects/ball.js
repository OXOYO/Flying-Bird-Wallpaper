import { Ellipse } from 'leafer-ui'

export class BallEffect {
  constructor(leafer, config) {
    this.leafer = leafer
    this.config = config
    this.balls = []
    this.ballCount = 16
    this.velocities = Array(this.ballCount).fill(0)
    this.positions = Array(this.ballCount).fill(0)
    this.initBalls()
  }

  initBalls() {
    for (let i = 0; i < this.ballCount; i++) {
      const circle = new Ellipse({
        radius: 20,
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

  getFill(i) {
    if (this.config.gradient && this.config.gradient.length > 1) {
      return {
        type: 'linear',
        stops: this.config.gradient.map((color, idx) => ({
          color,
          offset: idx / (this.config.gradient.length - 1)
        })),
        from: { x: 0, y: 1 },
        to: { x: 0, y: 0 }
      }
    }
    return this.config.color || '#00ffcc'
  }

  render(dataArray) {
    const { width, height } = this.leafer
    const maxBallHeight = height * (this.config.heightRatio || 0.8)
    const ballSpacing = width / (this.ballCount + 1)
    for (let i = 0; i < this.ballCount; i++) {
      const value = dataArray[i * 4] || 0
      // 简单弹跳物理
      const targetY = height - (value / 255) * maxBallHeight - 40
      // 模拟弹性
      this.velocities[i] += (targetY - this.positions[i]) * 0.2
      this.velocities[i] *= 0.7
      this.positions[i] += this.velocities[i]
      const circle = this.balls[i]
      circle.radius = 20 + (value / 255) * 10
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
