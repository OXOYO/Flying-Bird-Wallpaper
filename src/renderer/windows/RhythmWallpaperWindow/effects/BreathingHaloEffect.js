import { BaseEffect } from './BaseEffect'
import { Ellipse } from 'leafer-ui'

export class BreathingHaloEffect extends BaseEffect {
  constructor(leafer, config) {
    super(leafer, config)
    this.halo = new Ellipse({
      width: 100,
      height: 100,
      fill: this.getFill(0),
      opacity: 0.5,
      shadow: this.config.shadow ? { color: '#00ffcc', blur: 40, x: 0, y: 0 } : undefined
    })
    this.leafer.add(this.halo)
  }

  render(dataArray) {
    const { width, height } = this.leafer
    const centerX = width / 2
    const centerY = height / 2
    const value = dataArray[0] || 0
    const mapped = this.getMappedValue(value)
    const baseRadius = Math.min(width, height) * 0.18
    const radius = baseRadius + mapped * baseRadius * 0.7
    this.halo.width = radius * 2
    this.halo.height = radius * 2
    this.halo.x = centerX - this.halo.width / 2
    this.halo.y = centerY - this.halo.height / 2
    this.halo.opacity = 0.3 + mapped * 0.7
    this.halo.shadow = this.config.shadow
      ? { color: '#00ffcc', blur: 40 + mapped * 40, x: 0, y: 0 }
      : undefined
  }

  destroy() {
    this.halo.remove()
  }
}
