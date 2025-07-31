import { BaseEffect } from './BaseEffect'
import { Path } from 'leafer-ui'

export class DiscoEffect extends BaseEffect {
  constructor(leafer, config) {
    super(leafer, config)
    this.densityOptions = {
      sparse: 8,
      normal: 16,
      dense: 32
    }
    this.lightCount = this.densityOptions[this.config.density] || this.densityOptions.normal
    this.lights = []
    this.angle = 0
    this.init()
  }

  init() {
    for (let i = 0; i < this.lightCount; i++) {
      const path = new Path({
        fill: this.getFill('loop', i),
        opacity: 0.7,
        shadow: this.config.shadow ? { color: '#fff', blur: 20, x: 0, y: 0 } : undefined
      })
      this.leafer.add(path)
      this.lights.push(path)
    }
  }

  render(dataArray) {
    const { x, y, width, height } = this.bodySize
    const centerX = x
    const centerY = y
    const radius = Math.min(width, height) * 0.3
    // 计算整体音乐能量，影响旋转速度和灯光亮度
    const mappedValues = this.getMappedValues(this.getReducedValues(dataArray, this.lightCount))
    const energy = mappedValues.reduce((a, b) => a + b, 0) / mappedValues.length

    // 检查是否有音频，没有音频时不显示
    if (energy < 0.02) {
      this.lights.forEach((light) => (light.opacity = 0))
      return
    }

    this.angle += 0.005 + energy * 0.02 // 能量大时旋转更快

    for (let i = 0; i < this.lightCount; i++) {
      const mapped = mappedValues[i]
      const angle = this.angle + (i * (2 * Math.PI)) / this.lightCount
      const lightLength = radius + mapped * radius * 0.7 * (1 + energy * 0.3) // 能量大时光束更长
      // 扇形光束
      const angleWidth = Math.PI / this.lightCount
      const x1 = centerX + Math.cos(angle - angleWidth) * radius
      const y1 = centerY + Math.sin(angle - angleWidth) * radius
      const x2 = centerX + Math.cos(angle + angleWidth) * radius
      const y2 = centerY + Math.sin(angle + angleWidth) * radius
      const x3 = centerX + Math.cos(angle) * lightLength
      const y3 = centerY + Math.sin(angle) * lightLength
      const d = `M${centerX},${centerY} L${x1},${y1} L${x3},${y3} L${x2},${y2} Z`
      const path = this.lights[i]
      path.path = d
      path.fill = this.getFill('loop', i)
      path.opacity = (1 - mapped * 0.4) * (1 - energy * 0.3) // 能量大时更不透明（透明度低）
      path.shadow = this.config.shadow ? { color: '#fff', blur: 20, x: 0, y: 0 } : undefined
    }
  }

  destroy() {
    this.lights.forEach((path) => path.remove())
    this.lights = []
  }
}
