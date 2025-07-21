import { BaseEffect } from './BaseEffect'
import { Path, Ellipse } from 'leafer-ui'

export class WindmillEffect extends BaseEffect {
  constructor(leafer, config) {
    super(leafer, config)
    this.densityOptions = {
      sparse: 4,
      normal: 6,
      dense: 8
    }
    this.bladeCount = this.densityOptions[this.config.density] || this.densityOptions.normal
    this.radius = 80
    this.angle = 0
    this.paths = []
    this.centerCircle = null
    this.init()
  }

  init() {
    this.paths.forEach((p) => p.remove())
    this.paths = []
    for (let i = 0; i < this.bladeCount; i++) {
      const path = new Path({
        opacity: 0.92
      })
      this.leafer.add(path)
      this.paths.push(path)
    }
    // 添加中心轴心
    if (!this.centerCircle) {
      const r = Math.min(this.bodySize.width, this.bodySize.height) * 0.22
      this.centerCircle = new Ellipse({
        x: this.bodySize.x - r * 0.084,
        y: this.bodySize.y - r * 0.084,
        width: r * 0.168,
        height: r * 0.168,
        fill: {
          type: 'linear',
          from: { x: 0, y: 0 },
          to: { x: r * 0.24, y: r * 0.24 },
          stops: [
            { offset: 0, color: '#fff' },
            { offset: 1, color: '#bbb' }
          ]
        },
        stroke: '#888',
        strokeWidth: 2,
        opacity: 0.85
      })
      this.leafer.add(this.centerCircle)
    }
  }

  render(dataArray) {
    const { x, y, width, height } = this.bodySize
    const mappedValues = this.getMappedValues(dataArray)
    const avgValue = mappedValues.reduce((a, b) => a + b, 0) / mappedValues.length
    const speed = 0.008 + avgValue * 0.1
    this.angle += speed
    const r = Math.min(width, height) * 0.22
    const bladeLength = r * 1.1
    const bladeWidth = r * 0.7
    for (let i = 0; i < this.bladeCount; i++) {
      const baseAngle = this.angle + (i * 2 * Math.PI) / this.bladeCount
      const x0 = x
      const y0 = y
      const x1 = x0 + Math.cos(baseAngle) * bladeLength
      const y1 = y0 + Math.sin(baseAngle) * bladeLength
      const ctrlAngle = baseAngle + Math.PI / 2.2
      const cx1 = x0 + Math.cos(ctrlAngle) * bladeWidth
      const cy1 = y0 + Math.sin(ctrlAngle) * bladeWidth
      const d = `M${x0},${y0} L${x1},${y1} Q${cx1},${cy1} ${x0},${y0} Z`
      const path = this.paths[i]
      const mainColor =
        (this.config.colors && this.config.colors[i % this.config.colors.length]) || '#00ffcc'
      path.path = d
      path.fill = {
        type: 'linear',
        from: { x: x0, y: y0 },
        to: { x: x1, y: y1 },
        stops: [
          { offset: 0, color: mainColor },
          { offset: 1, color: '#fff', opacity: 0.18 }
        ]
      }
      path.opacity = 0.92
    }
    // 更新中心轴心位置和大小
    if (this.centerCircle) {
      this.centerCircle.x = x - r * 0.084
      this.centerCircle.y = y - r * 0.084
      this.centerCircle.width = r * 0.168
      this.centerCircle.height = r * 0.168
    }
  }

  destroy() {
    this.paths.forEach((p) => p.remove())
    this.paths = []
    if (this.centerCircle) {
      this.centerCircle.remove()
      this.centerCircle = null
    }
  }
}
