import LeaferBase from '../base/LeaferBase'
import { Path } from 'leafer-ui'

export class LeaferFlowingLines extends LeaferBase {
  constructor(container, config) {
    super(container, {
      lineWidth: 10,
      ...config
    })
    this.densityOptions = {
      sparse: { line: 4, point: 32 },
      normal: { line: 8, point: 64 },
      dense: { line: 16, point: 128 }
    }
    const density = this.densityOptions[this.config.density] || this.densityOptions.normal
    this.lineCount = density.line
    this.pointCount = density.point
    this.paths = []
    this.init()
  }

  init() {
    for (let i = 0; i < this.lineCount; i++) {
      const path = new Path({
        stroke: this.getFill('linear'),
        strokeWidth: this.config.lineWidth + i,
        opacity: 0.7
      })
      this.leafer.add(path)
      this.paths.push(path)
    }
  }

  render(dataArray) {
    const { x, y, width, height } = this.bodySize
    // 计算整体音乐能量，影响线条流动速度
    const mappedValues = this.getMappedValues(this.getReducedValues(dataArray, this.pointCount))
    const energy = mappedValues.reduce((a, b) => a + b, 0) / mappedValues.length

    // 检查是否有音频，没有音频时不显示
    if (energy < 0.02) {
      this.paths.forEach((path) => (path.opacity = 0))
      return
    }

    for (let l = 0; l < this.lineCount; l++) {
      const points = []

      for (let i = 0; i < this.pointCount; i++) {
        const px = x - width / 2 + (width / (this.pointCount - 1)) * i
        const baseY = y - height / 2 + (height / (this.lineCount + 1)) * (l + 1)
        const mapped = mappedValues[(i + l * 7) % mappedValues.length]
        const py = baseY - mapped * (height / 4) * (1 + energy * 0.3) // 能量大时波动幅度更大
        points.push([px, py])
      }
      this.paths[l].path = this.catmullRom2bezier(points)
      this.paths[l].stroke = this.getFill('linear')
      this.paths[l].opacity =
        (0.3 + 0.4 * Math.abs(Math.sin(Date.now() / (800 - energy * 300) + l))) * (1 + energy * 0.2) // 能量大时更不透明且闪烁更快
    }
  }

  destroy() {
    this.paths.forEach((p) => p.remove())
    this.paths = []
    super.destroy()
  }
}
