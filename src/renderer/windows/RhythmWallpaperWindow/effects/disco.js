import { Path } from 'leafer-ui'

export class DiscoEffect {
  constructor(leafer, config) {
    this.leafer = leafer
    this.config = config
    this.lights = []
    this.lightCount = 12
    this.angle = 0
    this.initLights()
  }

  initLights() {
    for (let i = 0; i < this.lightCount; i++) {
      const path = new Path({
        fill: this.getFill(i),
        opacity: 0.7,
        shadow: this.config.shadow ? { color: '#fff', blur: 20, x: 0, y: 0 } : undefined
      })
      this.leafer.add(path)
      this.lights.push(path)
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
    // 多彩灯光
    const colors = [
      '#ff3cac',
      '#784ba0',
      '#2b86c5',
      '#42e695',
      '#ffb347',
      '#ffcc33',
      '#f7971e',
      '#ffd200',
      '#f44369',
      '#43cea2',
      '#185a9d',
      '#f857a6'
    ]
    return colors[i % colors.length]
  }

  render(dataArray) {
    const { width, height } = this.leafer
    const centerX = width / 2
    const centerY = height / 2
    const radius = Math.min(width, height) * 0.3
    this.angle += 0.01
    for (let i = 0; i < this.lightCount; i++) {
      const value = dataArray[i * 2] || 0
      const angle = this.angle + (i * (2 * Math.PI)) / this.lightCount
      const lightLength = radius + (value / 255) * radius * 0.7
      // 扇形光束
      const angleWidth = Math.PI / this.lightCount
      const x1 = centerX + Math.cos(angle - angleWidth) * radius
      const y1 = centerY + Math.sin(angle - angleWidth) * radius
      const x2 = centerX + Math.cos(angle + angleWidth) * radius
      const y2 = centerY + Math.sin(angle + angleWidth) * radius
      const x3 = centerX + Math.cos(angle) * lightLength
      const y3 = centerY + Math.sin(angle) * lightLength
      const d = `M${centerX},${centerY} L${x1},${y1} L${x3},${y3} L${x2},${y2} Z`
      const path = this.lights[i]
      path.d = d
      path.fill = this.getFill(i)
      path.opacity = 0.5 + (value / 255) * 0.5
      path.shadow = this.config.shadow ? { color: '#fff', blur: 20, x: 0, y: 0 } : undefined
    }
  }

  destroy() {
    this.lights.forEach((path) => path.remove())
    this.lights = []
  }
}
