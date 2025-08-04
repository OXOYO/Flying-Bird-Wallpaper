import { LeaferBase } from './LeaferBase'
import { Ellipse } from 'leafer-ui'

export class LeaferBreathingHalo extends LeaferBase {
  constructor(leafer, config) {
    super(leafer, config)
    this.densityOptions = {
      sparse: 8,
      normal: 16,
      dense: 32
    }
    this.reduceCount = this.densityOptions[this.config.density] || this.densityOptions.normal

    this.halo = new Ellipse({
      width: 100,
      height: 100,
      fill: this.getFill('radial'),
      opacity: 0.5,
      shadow: this.config.shadow ? { color: '#00ffcc', blur: 40, x: 0, y: 0 } : undefined
    })
    this.leafer.add(this.halo)
  }

  render(dataArray) {
    const { x, y, width, height } = this.bodySize
    // 计算整体音乐能量，影响光环大小和亮度
    const mappedValues = this.getMappedValues(this.getReducedValues(dataArray, this.reduceCount))
    const energy = mappedValues.reduce((a, b) => a + b, 0) / mappedValues.length

    // 检查是否有音频，没有音频时不显示
    if (energy < 0.02) {
      this.halo.opacity = 0
      return
    }

    const baseRadius = Math.min(width, height) * 0.18
    const radius = baseRadius + energy * baseRadius * 1.2 // 能量大时光环更大
    this.halo.width = radius * 2
    this.halo.height = radius * 2
    this.halo.x = x - radius
    this.halo.y = y - radius
    this.halo.opacity = 1 - energy * 0.8 // 能量大时更不透明（透明度低）
    this.halo.shadow = this.config.shadow
      ? { color: '#00ffcc', blur: 30 + energy * 60, x: 0, y: 0 } // 能量大时光晕更强
      : undefined
  }

  destroy() {
    this.halo.remove()
  }
}
