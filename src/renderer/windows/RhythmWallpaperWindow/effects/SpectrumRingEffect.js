import { BaseEffect } from './BaseEffect'
import { Path } from 'leafer-ui'

export class SpectrumRingEffect extends BaseEffect {
  constructor(leafer, config) {
    super(leafer, {
      radius: 120,
      width: 32,
      heightRatio: 2,
      ...config
    })
    this.densityCount = {
      sparse: 16,
      normal: 32,
      dense: 64
    }
    this.segments = this.densityCount[this.config.densityType] || this.densityCount.normal
    this.paths = []
    this.initSegments()
  }

  initSegments() {
    for (let i = 0; i < this.segments; i++) {
      const path = new Path({
        fill: this.getFill(i),
        opacity: 0.8
      })
      this.leafer.add(path)
      this.paths.push(path)
    }
  }

  render(dataArray) {
    const { width, height } = this.leafer
    const centerX = width / 2
    const centerY = height / 2
    const angleStep = (2 * Math.PI) / this.segments
    for (let i = 0; i < this.segments; i++) {
      const value = dataArray[i] || 0
      const mapped = this.getMappedValue(value)
      const innerR = this.config.radius
      const outerR =
        this.config.radius + mapped * (this.config.heightRatio || 1) * this.config.radius
      const startAngle = i * angleStep
      const endAngle = startAngle + angleStep * 0.9
      const x1 = centerX + Math.cos(startAngle) * innerR
      const y1 = centerY + Math.sin(startAngle) * innerR
      const x2 = centerX + Math.cos(endAngle) * innerR
      const y2 = centerY + Math.sin(endAngle) * innerR
      const x3 = centerX + Math.cos(endAngle) * outerR
      const y3 = centerY + Math.sin(endAngle) * outerR
      const x4 = centerX + Math.cos(startAngle) * outerR
      const y4 = centerY + Math.sin(startAngle) * outerR
      const d = `M${x1},${y1} L${x2},${y2} L${x3},${y3} L${x4},${y4} Z`
      const path = this.paths[i]
      path.path = d
      path.fill = this.getFill(i)
      path.opacity = 0.7 + mapped * 0.3
    }
  }

  destroy() {
    this.paths.forEach((p) => p.remove())
    this.paths = []
  }
}
