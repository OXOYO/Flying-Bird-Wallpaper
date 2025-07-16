import { BaseEffect } from './BaseEffect'
import { Ellipse } from 'leafer-ui'

export class LiquidRippleEffect extends BaseEffect {
  constructor(leafer, config) {
    super(leafer, config)
    this.ripples = []
    this.rippleCount = config.rippleCount || 6
    this.initRipples()
  }

  initRipples() {
    for (let i = 0; i < this.rippleCount; i++) {
      const ripple = new Ellipse({
        width: 100,
        height: 100,
        fill: null,
        stroke: this.getFill(i),
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
    const { width, height } = this.leafer
    const centerX = width / 2
    const centerY = height / 2
    for (let i = 0; i < this.rippleCount; i++) {
      const value = dataArray[i % dataArray.length] || 0
      const mapped = this.getMappedValue(value)
      const r = 40 + mapped * 120 + Math.sin(Date.now() / 800 + i) * 10
      const ripple = this.ripples[i]
      ripple.shape.width = r * 2
      ripple.shape.height = r * 2
      ripple.shape.x = centerX - r
      ripple.shape.y = centerY - r
      ripple.shape.opacity = 0.2 + mapped * 0.5
      ripple.shape.stroke = this.getFill(i)
    }
  }

  destroy() {
    this.ripples.forEach((r) => r.shape.remove())
    this.ripples = []
  }
}
