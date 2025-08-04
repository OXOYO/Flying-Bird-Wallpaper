import { LeaferBase } from './LeaferBase'
import { Ellipse } from 'leafer-ui'

export class LeaferLiquidRipple extends LeaferBase {
  constructor(leafer, config) {
    super(leafer, config)
    this.densityOptions = {
      sparse: 3,
      normal: 6,
      dense: 12
    }
    this.rippleCount = this.densityOptions[this.config.density] || this.densityOptions.normal
    this.ripples = []
    this.init()
  }

  init() {
    for (let i = 0; i < this.rippleCount; i++) {
      const ripple = new Ellipse({
        width: 100,
        height: 100,
        fill: null,
        stroke: this.getFill('loop', i),
        strokeWidth: 3,
        opacity: 0.5
      })
      this.leafer.add(ripple)
      this.ripples.push({
        shape: ripple,
        t: Math.random()
      })
    }
  }

  render(dataArray) {
    const { x, y, width, height } = this.bodySize
    // 计算整体音乐能量，影响涟漪大小和速度
    const mappedValues = this.getMappedValues(this.getReducedValues(dataArray, this.rippleCount))
    const energy = mappedValues.reduce((a, b) => a + b, 0) / mappedValues.length

    // 检查是否有音频，没有音频时不显示
    if (energy < 0.02) {
      this.ripples.forEach((ripple) => (ripple.shape.opacity = 0))
      return
    }

    for (let i = 0; i < this.rippleCount; i++) {
      const mapped = mappedValues[i]
      const r = Math.max(
        20,
        Math.min(width, height) * 0.08 +
          mapped * Math.min(width, height) * 0.24 * (1 + energy * 0.5) + // 能量大时涟漪更大
          Math.sin(Date.now() / (600 - energy * 200) + i) * 10 // 能量大时波动更快
      )
      const ripple = this.ripples[i]
      ripple.shape.width = r * 2
      ripple.shape.height = r * 2
      ripple.shape.x = x - r
      ripple.shape.y = y - r
      ripple.shape.opacity = (1 - mapped * 0.4) * (1 - energy * 0.3) // 能量大时更不透明（透明度低）
      ripple.shape.stroke = this.getFill('loop', i)
    }
  }

  destroy() {
    this.ripples.forEach((r) => r.shape.remove())
    this.ripples = []
  }
}
