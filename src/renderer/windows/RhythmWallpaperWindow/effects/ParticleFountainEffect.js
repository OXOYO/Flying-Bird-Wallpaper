import { BaseEffect } from './BaseEffect'
import { Ellipse } from 'leafer-ui'

export class ParticleFountainEffect extends BaseEffect {
  constructor(leafer, config) {
    super(leafer, config)
    this.particles = []
    this.particleCount = config.particleCount || 64
    this.initParticles()
  }

  initParticles() {
    for (let i = 0; i < this.particleCount; i++) {
      const particle = new Ellipse({
        width: 8,
        height: 8,
        fill: this.getFill(i),
        opacity: 0.8
      })
      this.leafer.add(particle)
      this.particles.push({
        shape: particle,
        x: 0,
        y: 0,
        vx: 0,
        vy: 0
      })
    }
  }

  render(dataArray) {
    const { width, height } = this.leafer
    for (let i = 0; i < this.particleCount; i++) {
      const value = dataArray[i % dataArray.length] || 0
      const mapped = this.getMappedValue(value)
      const p = this.particles[i]
      // 音乐能量驱动速度
      if (Math.random() < mapped * 0.2) {
        p.x = width / 2 + (Math.random() - 0.5) * 40
        p.y = height - 20
        p.vx = (Math.random() - 0.5) * 2
        p.vy = -Math.random() * 8 * mapped - 2
      }
      p.vy += 0.25 // 重力
      p.x += p.vx
      p.y += p.vy
      if (p.y > height) p.y = height - 20
      p.shape.x = p.x
      p.shape.y = p.y
      p.shape.opacity = 0.5 + mapped * 0.5
    }
  }

  destroy() {
    this.particles.forEach((p) => p.shape.remove())
    this.particles = []
  }
}
