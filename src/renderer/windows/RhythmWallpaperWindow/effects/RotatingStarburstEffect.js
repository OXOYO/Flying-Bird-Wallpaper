import { BaseEffect } from './BaseEffect'
import { Path } from 'leafer-ui'

export class RotatingStarburstEffect extends BaseEffect {
  constructor(leafer, config) {
    super(leafer, config)
    this.densityOptions = {
      sparse: 16,
      normal: 32,
      dense: 64
    }
    this.rayCount = this.densityOptions[this.config.density] || this.densityOptions.normal
    this.rays = []
    this.angle = 0
    this.init()
  }

  init() {
    for (let i = 0; i < this.rayCount; i++) {
      const path = new Path({
        stroke: this.getFill(),
        strokeWidth: 3,
        opacity: 0.7
      })
      this.leafer.add(path)
      this.rays.push(path)
    }
  }

  render(dataArray) {
    const { x, y, width, height } = this.bodySize
    const baseRadius = Math.min(width, height) * 0.18
    const maxLength = baseRadius * 2.2
    this.angle += 0.01
    const mappedValues = this.getMappedValues(this.getReducedValues(dataArray, this.rayCount))

    for (let i = 0; i < this.rayCount; i++) {
      const mapped = mappedValues[i]
      const angle = this.angle + (i * (2 * Math.PI)) / this.rayCount
      const length = baseRadius + mapped * (maxLength - baseRadius)
      const x1 = x
      const y1 = y
      const x2 = x + Math.cos(angle) * length
      const y2 = y + Math.sin(angle) * length
      this.rays[i].path = `M${x1},${y1} L${x2},${y2}`
      this.rays[i].stroke = this.getFill()
      this.rays[i].opacity = 0.5 + mapped * 0.5
    }
  }

  destroy() {
    this.rays.forEach((r) => r.remove())
    this.rays = []
  }
}
