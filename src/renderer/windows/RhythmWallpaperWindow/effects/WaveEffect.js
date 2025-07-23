import { BaseEffect } from './BaseEffect'
import { Path } from 'leafer-ui'

export class WaveEffect extends BaseEffect {
  constructor(leafer, config) {
    super(leafer, {
      // 振幅
      amplitude: 1,
      ...config
    })
    this.densityOptions = {
      sparse: 64,
      normal: 128,
      dense: 256
    }
    this.pointCount = this.densityOptions[this.config.density] || this.densityOptions.normal
    this.path = new Path({
      fill: this.getFill('linear'),
      stroke: (this.config.colors && this.config.colors[0]) || '#00ffcc',
      strokeWidth: 3,
      shadow: this.config.shadow ? { color: '#000', blur: 8, x: 0, y: 2 } : undefined
    })
    this.leafer.add(this.path)
  }

  render(dataArray) {
    const { x, y, width, height } = this.bodySize
    const left = x - width / 2
    const top = y - height / 2
    const points = []

    const mappedValues = this.getMappedValues(this.getReducedValues(dataArray, this.pointCount))

    for (let i = 0; i < this.pointCount; i++) {
      // 横坐标：bodySize 区域内均匀分布
      const px = left + (i / (this.pointCount - 1)) * width
      // 纵坐标：bodySize 区域底部为基线，向上跳动
      const py = top + height - mappedValues[i] * height * (this.config.amplitude || 1)
      points.push([px, py])
    }

    // 波形两端落到底部
    if (points.length >= 2) {
      points[0][1] = top + height
      points[points.length - 1][1] = top + height
    }
    if (points.length < 2) return
    const isSilent = mappedValues.every((v) => v === 0)
    if (isSilent) return

    // 生成平滑曲线路径
    let d = this.catmullRom2bezier(points)
    // 闭合路径
    d += ` L${points[points.length - 1][0]},${top + height}`
    d += ` L${points[0][0]},${top + height} Z`
    this.path.path = d

    // 填充色
    const newFill = this.getFill('linear')
    if (this.path.fill !== newFill) {
      this.path.fill = newFill
    }

    this.path.stroke = (this.config.colors && this.config.colors[0]) || '#00ffcc'
    this.path.strokeWidth = 3
    this.path.shadow = this.config.shadow ? { color: '#000', blur: 8, x: 0, y: 2 } : undefined
  }

  destroy() {
    this.path.remove()
  }
}
