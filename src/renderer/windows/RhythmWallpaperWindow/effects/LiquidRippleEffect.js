import { BaseEffect } from './BaseEffect'
import { Ellipse } from 'leafer-ui'

export class LiquidRippleEffect extends BaseEffect {
  constructor(leafer, config) {
    super(leafer, config)
    this.densityOptions = {
      sparse: 3,
      normal: 6,
      dense: 12
    }
    this.rippleCount = this.densityOptions[this.config.density] || this.densityOptions.normal
    this.ripples = []
    this.init()
  }

  init() {
    for (let i = 0; i < this.rippleCount; i++) {
      const ripple = new Ellipse({
        width: 100,
        height: 100,
        fill: null,
        stroke: this.getFill(),
        strokeWidth: 3,
        opacity: 0.5
      })
      this.leafer.add(ripple)
      this.ripples.push({
        shape: ripple,
        t: Math.random()
      })
    }
  }

  render(dataArray) {
    const { x, y, width, height } = this.bodySize
    const mappedValues = this.getMappedValues(this.getReducedValues(dataArray, this.rippleCount))

    for (let i = 0; i < this.rippleCount; i++) {
      const mapped = mappedValues[i]
      const r = Math.max(
        20,
        Math.min(width, height) * 0.08 +
          mapped * Math.min(width, height) * 0.24 +
          Math.sin(Date.now() / 800 + i) * 10
      )
      const ripple = this.ripples[i]
      ripple.shape.width = r * 2
      ripple.shape.height = r * 2
      ripple.shape.x = x - r
      ripple.shape.y = y - r
      ripple.shape.opacity = 0.2 + mapped * 0.5
      ripple.shape.stroke = this.getFill(i)
    }
  }

  destroy() {
    this.ripples.forEach((r) => r.shape.remove())
    this.ripples = []
  }
}
