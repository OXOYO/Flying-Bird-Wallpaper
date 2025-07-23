import { BaseEffect } from './BaseEffect'
import { Ellipse } from 'leafer-ui'

export class ParticleFountainEffect extends BaseEffect {
  constructor(leafer, config) {
    super(leafer, config)
    this.densityOptions = {
      sparse: 128,
      normal: 256,
      dense: 512
    }
    this.particleCount = this.densityOptions[this.config.density] || this.densityOptions.normal
    this.particles = []
    this.init()
  }

  init() {
    for (let i = 0; i < this.particleCount; i++) {
      const particle = new Ellipse({
        width: 8,
        height: 8,
        fill: this.getFill('random'),
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
    const { x, y, width, height } = this.bodySize
    const mappedValues = this.getMappedValues(this.getReducedValues(dataArray, this.particleCount))

    for (let i = 0; i < this.particleCount; i++) {
      const mapped = mappedValues[i]
      const p = this.particles[i]
      const spreadX = width
      const maxHeight = height

      if (Math.random() < mapped * 0.4) {
        // 横向分布
        p.x = x - width / 2 + Math.random() * width
        // 垂直分布（喷射起点在底部，最大喷射高度受 height 控制）
        p.y = y + height / 2 - 20
        p.vx = (Math.random() - 0.5) * 6 * (0.5 + mapped)
        // 垂直速度最大值受 height 控制
        p.vy = -Math.random() * maxHeight * 0.45 * mapped - 6
        p.shape.width = p.shape.height = 8 + mapped * 16
        p.shape.fill = this.getFill('random')
      }
      p.vy += 0.35 // 重力略增
      p.x += p.vx
      p.y += p.vy
      if (p.y > y + height / 2) p.y = y + height / 2 - 20
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
