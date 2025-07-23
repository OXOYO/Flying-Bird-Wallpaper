import { BaseEffect } from './BaseEffect'
import { Ellipse } from 'leafer-ui'

export class BreathingHaloEffect extends BaseEffect {
  constructor(leafer, config) {
    super(leafer, config)
    this.densityOptions = {
      sparse: 8,
      normal: 16,
      dense: 32
    }
    this.reduceCount = this.densityOptions[this.config.density] || this.densityOptions.normal

    this.halo = new Ellipse({
      width: 100,
      height: 100,
      fill: this.getFill('radial'),
      opacity: 0.5,
      shadow: this.config.shadow ? { color: '#00ffcc', blur: 40, x: 0, y: 0 } : undefined
    })
    this.leafer.add(this.halo)
  }

  render(dataArray) {
    const { x, y, width, height } = this.bodySize
    const mappedValues = this.getMappedValues(this.getReducedValues(dataArray, this.reduceCount))
    const avgVal = mappedValues.reduce((a, b) => a + b, 0) / mappedValues.length
    const baseRadius = Math.min(width, height) * 0.18
    const radius = baseRadius + avgVal * baseRadius * 0.7
    this.halo.width = radius * 2
    this.halo.height = radius * 2
    this.halo.x = x - radius
    this.halo.y = y - radius
    this.halo.opacity = 0.3 + avgVal * 0.7
    this.halo.shadow = this.config.shadow
      ? { color: '#00ffcc', blur: 40 + avgVal * 40, x: 0, y: 0 }
      : undefined
  }

  destroy() {
    this.halo.remove()
  }
}
