import { BaseEffect } from './BaseEffect'
import { Path } from 'leafer-ui'

export class SpectrumFlowerEffect extends BaseEffect {
  constructor(leafer, config) {
    super(leafer, config)
    this.petalCount = config.petalCount || 16
    this.petals = []
    this.initPetals()
  }

  initPetals() {
    for (let i = 0; i < this.petalCount; i++) {
      const path = new Path({
        fill: this.getFill(i),
        opacity: 0.7
      })
      this.leafer.add(path)
      this.petals.push(path)
    }
  }

  render(dataArray) {
    const { width, height } = this.leafer
    const centerX = width / 2
    const centerY = height / 2
    const baseR = Math.min(width, height) * 0.18
    const maxR = baseR * 2.2
    for (let i = 0; i < this.petalCount; i++) {
      const value = dataArray[i % dataArray.length] || 0
      const mapped = this.getMappedValue(value)
      const angle = (i * 2 * Math.PI) / this.petalCount
      const r = baseR + mapped * (maxR - baseR)
      // 花瓣形状：三点贝塞尔
      const angle1 = angle - Math.PI / this.petalCount
      const angle2 = angle + Math.PI / this.petalCount
      const x1 = centerX + Math.cos(angle) * r
      const y1 = centerY + Math.sin(angle) * r
      const x2 = centerX + Math.cos(angle1) * baseR
      const y2 = centerY + Math.sin(angle1) * baseR
      const x3 = centerX + Math.cos(angle2) * baseR
      const y3 = centerY + Math.sin(angle2) * baseR
      const d = `M${centerX},${centerY} Q${x2},${y2} ${x1},${y1} Q${x3},${y3} ${centerX},${centerY} Z`
      const path = this.petals[i]
      path.path = d
      path.fill = this.getFill(i)
      path.opacity = 0.5 + mapped * 0.5
    }
  }

  destroy() {
    this.petals.forEach((p) => p.remove())
    this.petals = []
  }
}
