import { BaseEffect } from './BaseEffect'
import { Path } from 'leafer-ui'

export class SpectrumFlowerEffect extends BaseEffect {
  constructor(leafer, config) {
    super(leafer, config)
    this.densityOptions = {
      sparse: 8,
      normal: 16,
      dense: 32
    }
    this.petalCount = this.densityOptions[this.config.density] || this.densityOptions.normal
    this.petals = []
    this.init()
  }

  init() {
    for (let i = 0; i < this.petalCount; i++) {
      const path = new Path({
        fill: this.getFill('loop', i),
        opacity: 0.7
      })
      this.leafer.add(path)
      this.petals.push(path)
    }
  }

  render(dataArray) {
    const { x, y, width, height } = this.bodySize
    const baseR = Math.min(width, height) * 0.18
    const maxR = baseR * 2.2
    const mappedValues = this.getMappedValues(this.getReducedValues(dataArray, this.petalCount))

    for (let i = 0; i < this.petalCount; i++) {
      const mapped = mappedValues[i]
      const angle = (i * 2 * Math.PI) / this.petalCount
      const r = baseR + mapped * (maxR - baseR)
      // 花瓣形状：三点贝塞尔
      const angle1 = angle - Math.PI / this.petalCount
      const angle2 = angle + Math.PI / this.petalCount
      const x1 = x + Math.cos(angle) * r
      const y1 = y + Math.sin(angle) * r
      const x2 = x + Math.cos(angle1) * baseR
      const y2 = y + Math.sin(angle1) * baseR
      const x3 = x + Math.cos(angle2) * baseR
      const y3 = y + Math.sin(angle2) * baseR
      const d = `M${x},${y} Q${x2},${y2} ${x1},${y1} Q${x3},${y3} ${x},${y} Z`
      const path = this.petals[i]
      path.path = d
      path.fill = this.getFill('loop', i)
      path.opacity = 0.5 + mapped * 0.5
    }
  }

  destroy() {
    this.petals.forEach((p) => p.remove())
    this.petals = []
  }
}
