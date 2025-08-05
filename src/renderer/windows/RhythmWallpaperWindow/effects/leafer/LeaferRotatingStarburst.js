import LeaferBase from '../base/LeaferBase'
import { Path } from 'leafer-ui'

export class LeaferRotatingStarburst extends LeaferBase {
  constructor(container, config) {
    super(container, config)
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
        stroke: this.getFill('linear'),
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

    // 计算整体音乐能量，影响旋转速度和射线长度
    const mappedValues = this.getMappedValues(this.getReducedValues(dataArray, this.rayCount))
    const energy = mappedValues.reduce((a, b) => a + b, 0) / mappedValues.length

    // 检查是否有音频，没有音频时不显示
    if (energy < 0.02) {
      this.rays.forEach((ray) => (ray.path = ''))
      return
    }

    this.angle += 0.005 + energy * 0.02 // 能量大时旋转更快

    for (let i = 0; i < this.rayCount; i++) {
      const mapped = mappedValues[i]
      const angle = this.angle + (i * (2 * Math.PI)) / this.rayCount
      const length = baseRadius + mapped * (maxLength - baseRadius) * (1 + energy * 0.5) // 能量大时射线更长
      const x1 = x
      const y1 = y
      const x2 = x + Math.cos(angle) * length
      const y2 = y + Math.sin(angle) * length
      this.rays[i].path = `M${x1},${y1} L${x2},${y2}`
      this.rays[i].stroke = this.getFill('linear')
      this.rays[i].opacity = 1 - mapped * 0.5 // 能量大时更不透明（透明度低）
    }
  }

  destroy() {
    this.rays.forEach((r) => r.remove())
    this.rays = []
    super.destroy()
  }
}
