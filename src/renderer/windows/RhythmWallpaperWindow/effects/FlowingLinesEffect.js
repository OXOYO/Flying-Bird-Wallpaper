import { BaseEffect } from './BaseEffect'
import { Path } from 'leafer-ui'

export class FlowingLinesEffect extends BaseEffect {
  constructor(leafer, config) {
    super(leafer, config)
    this.lineCount = config.lineCount || 5
    this.pointCount = config.pointCount || 64
    this.paths = []
    this.initLines()
  }

  initLines() {
    for (let i = 0; i < this.lineCount; i++) {
      const path = new Path({
        stroke: this.getFill(i),
        strokeWidth: this.config.lineWidth + i,
        opacity: 0.7
      })
      this.leafer.add(path)
      this.paths.push(path)
    }
  }

  render(dataArray) {
    const { width, height } = this.leafer
    for (let l = 0; l < this.lineCount; l++) {
      const points = []
      for (let i = 0; i < this.pointCount; i++) {
        const x = (width / (this.pointCount - 1)) * i
        const baseY = (height / (this.lineCount + 1)) * (l + 1)
        const value = dataArray[(i + l * 7) % dataArray.length] || 0
        const mapped = this.getMappedValue(value)
        const y = baseY - mapped * 60
        points.push([x, y])
      }
      this.paths[l].path = this.catmullRom2bezier(points)
      this.paths[l].stroke = this.getFill(l)
      this.paths[l].opacity = 0.5 + 0.5 * Math.abs(Math.sin(Date.now() / 1000 + l))
    }
  }

  // 生成平滑曲线路径
  catmullRom2bezier(points) {
    let d = `M${points[0][0]},${points[0][1]}`
    for (let i = 0; i < points.length - 1; i++) {
      const p0 = points[i === 0 ? i : i - 1]
      const p1 = points[i]
      const p2 = points[i + 1]
      const p3 = points[i + 2 < points.length ? i + 2 : i + 1]
      const cp1x = p1[0] + (p2[0] - p0[0]) / 6
      const cp1y = p1[1] + (p2[1] - p0[1]) / 6
      const cp2x = p2[0] - (p3[0] - p1[0]) / 6
      const cp2y = p2[1] - (p3[1] - p1[1]) / 6
      d += ` C${cp1x},${cp1y} ${cp2x},${cp2y} ${p2[0]},${p2[1]}`
    }
    return d
  }

  destroy() {
    this.paths.forEach((p) => p.remove())
    this.paths = []
  }
}
