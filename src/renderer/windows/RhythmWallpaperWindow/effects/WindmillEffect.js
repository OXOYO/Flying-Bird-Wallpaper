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
    this.center = { x: 0, y: 0 }
    this.angle = 0
    this.paths = []
    this.centerCircle = null
    this.initWindmill()
  }

  initWindmill() {
    const { width, height } = this.leafer
    this.center.x = width / 2
    this.center.y = height / 2
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
      const r = Math.min(width, height) * 0.22
      this.centerCircle = new Ellipse({
        x: this.center.x - r * 0.084,
        y: this.center.y - r * 0.084,
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
    const { width, height } = this.leafer
    if (width !== this.center.x * 2 || height !== this.center.y * 2) {
      this.initWindmill()
    }
    // 高频能量决定转速
    const highStart = Math.floor((dataArray.length * 2) / 3)
    const highFreqArray = dataArray.slice(highStart)
    const highFreqEnergy = highFreqArray.reduce((a, b) => a + b, 0) / highFreqArray.length / 255
    const speed = 0.008 + highFreqEnergy * 0.1
    this.angle += speed
    const r = Math.min(width, height) * 0.22
    const bladeLength = r * 1.1
    const bladeWidth = r * 0.7
    for (let i = 0; i < this.bladeCount; i++) {
      const baseAngle = this.angle + (i * 2 * Math.PI) / this.bladeCount
      // 纸风车风叶：中心->尖端->大弯曲->回中心
      const x0 = this.center.x
      const y0 = this.center.y
      // 风叶尖端（直线）
      const x1 = x0 + Math.cos(baseAngle) * bladeLength
      const y1 = y0 + Math.sin(baseAngle) * bladeLength
      // 控制点（远离中心，偏向风叶旋转方向，制造折弯）
      const ctrlAngle = baseAngle + Math.PI / 2.2 // 约81度偏转
      const cx = x0 + Math.cos(ctrlAngle) * bladeWidth
      const cy = y0 + Math.sin(ctrlAngle) * bladeWidth
      // 路径：中心->尖端->大弯曲贝塞尔->回中心
      const d = `M${x0},${y0} L${x1},${y1} Q${cx},${cy} ${x0},${y0} Z`
      const path = this.paths[i]
      path.path = d
      // 渐变填充
      const mainColor =
        (this.config.colors && this.config.colors[i % this.config.colors.length]) || '#00ffcc'
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
      this.centerCircle.x = this.center.x - r * 0.084
      this.centerCircle.y = this.center.y - r * 0.084
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
