import LeaferBase from '../base/LeaferBase'
import { Ellipse } from 'leafer-ui'

export class LeaferParticleFountain extends LeaferBase {
  constructor(container, config) {
    super(container, config)
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
    // 安全地计算整体能量，限制在合理范围内
    const mappedValues = this.getMappedValues(this.getReducedValues(dataArray, this.particleCount))
    const energy = Math.min(
      1,
      Math.max(0, mappedValues.reduce((a, b) => a + b, 0) / mappedValues.length)
    )

    for (let i = 0; i < this.particleCount; i++) {
      const mapped = mappedValues[i]
      const p = this.particles[i]
      const spreadX = width
      const maxHeight = height

      // 安全的发射概率计算
      const emitChance = Math.min(1, mapped * 0.4 * (1 + energy * 0.2))
      if (Math.random() < emitChance) {
        // 横向分布
        p.x = x - width / 2 + Math.random() * width
        // 垂直分布（喷射起点在底部，最大喷射高度受 height 控制）
        p.y = y + height / 2 - 20
        // 安全的速度计算
        p.vx = (Math.random() - 0.5) * 6 * (0.5 + mapped) * (1 + energy * 0.1)
        // 垂直速度最大值受 height 控制
        p.vy = -Math.random() * maxHeight * 0.45 * mapped * (1 + energy * 0.15) - 6
        p.shape.width = p.shape.height = 8 + mapped * 16
        p.shape.fill = this.getFill('random')
      }
      p.vy += 0.35 // 重力略增
      p.x += p.vx
      p.y += p.vy
      if (p.y > y + height / 2) p.y = y + height / 2 - 20
      p.shape.x = p.x
      p.shape.y = p.y
      // 安全的透明度计算 - 能量大时更不透明（透明度低）
      p.shape.opacity = Math.min(1, Math.max(0.1, (1 - mapped * 0.7) * (1 - energy * 0.05)))
    }
  }

  destroy() {
    this.particles.forEach((p) => p.shape.remove())
    this.particles = []
    super.destroy()
  }
}
