import { BaseEffect } from './BaseEffect'
import { Ellipse } from 'leafer-ui'

export class ParticleFountainEffect extends BaseEffect {
  constructor(leafer, config) {
    super(leafer, config)
    this.densityOptions = {
      sparse: 128,
      normal: 320,
      dense: 640
    }
    this.particleCount = this.densityOptions[this.config.density] || this.densityOptions.normal
    this.particles = []
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
      const spreadX = width * this.config.widthRatio
      const maxHeight = height * this.config.heightRatio

      if (Math.random() < mapped * 0.4) {
        // 横向分布
        p.x = width / 2 + (Math.random() - 0.5) * spreadX
        // 纵向分布（喷射起点在底部，最大喷射高度受 heightRatio 控制）
        p.y = height - 20
        p.vx = (Math.random() - 0.5) * 6 * (0.5 + mapped)
        // 竖直速度最大值受 heightRatio 控制
        p.vy = -Math.random() * maxHeight * 0.45 * mapped - 6
        p.shape.width = p.shape.height = 8 + mapped * 16
        p.shape.fill = this.getFill(i, mapped)
      }
      p.vy += 0.35 // 重力略增
      p.x += p.vx
      p.y += p.vy
      if (p.y > height) p.y = height - 20
      p.shape.x = p.x
      p.shape.y = p.y
      // 透明度更有层次
      p.shape.opacity = 0.3 + mapped * 0.7
    }
  }

  destroy() {
    this.particles.forEach((p) => p.shape.remove())
    this.particles = []
  }
}
