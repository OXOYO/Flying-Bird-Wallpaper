import { BaseEffect } from './BaseEffect'
import { Path } from 'leafer-ui'

export class RotatingStarburstEffect extends BaseEffect {
  constructor(leafer, config) {
    super(leafer, config)
    this.rayCount = config.rayCount || 24
    this.rays = []
    this.angle = 0
    this.initRays()
  }

  initRays() {
    for (let i = 0; i < this.rayCount; i++) {
      const path = new Path({
        stroke: this.getFill(i),
        strokeWidth: 3,
        opacity: 0.7
      })
      this.leafer.add(path)
      this.rays.push(path)
    }
  }

  render(dataArray) {
    const { width, height } = this.leafer
    const centerX = width / 2
    const centerY = height / 2
    const baseRadius = Math.min(width, height) * 0.18
    const maxLength = baseRadius * 2.2
    this.angle += 0.01
    for (let i = 0; i < this.rayCount; i++) {
      const value = dataArray[i % dataArray.length] || 0
      const mapped = this.getMappedValue(value)
      const angle = this.angle + (i * (2 * Math.PI)) / this.rayCount
      const length = baseRadius + mapped * (maxLength - baseRadius)
      const x1 = centerX
      const y1 = centerY
      const x2 = centerX + Math.cos(angle) * length
      const y2 = centerY + Math.sin(angle) * length
      this.rays[i].d = `M${x1},${y1} L${x2},${y2}`
      this.rays[i].stroke = this.getFill(i)
      this.rays[i].opacity = 0.5 + mapped * 0.5
    }
  }

  destroy() {
    this.rays.forEach((r) => r.remove())
    this.rays = []
  }
}
