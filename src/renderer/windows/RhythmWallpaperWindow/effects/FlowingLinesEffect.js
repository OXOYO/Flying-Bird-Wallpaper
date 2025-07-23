import { BaseEffect } from './BaseEffect'
import { Path } from 'leafer-ui'

export class FlowingLinesEffect extends BaseEffect {
  constructor(leafer, config) {
    super(leafer, {
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
    const mappedValues = this.getMappedValues(this.getReducedValues(dataArray, this.pointCount))

    for (let l = 0; l < this.lineCount; l++) {
      const points = []

      for (let i = 0; i < this.pointCount; i++) {
        const px = x - width / 2 + (width / (this.pointCount - 1)) * i
        const baseY = y - height / 2 + (height / (this.lineCount + 1)) * (l + 1)
        const mapped = mappedValues[(i + l * 7) % mappedValues.length]
        const py = baseY - mapped * (height / 4)
        points.push([px, py])
      }
      this.paths[l].path = this.catmullRom2bezier(points)
      this.paths[l].stroke = this.getFill('linear')
      this.paths[l].opacity = 0.5 + 0.5 * Math.abs(Math.sin(Date.now() / 1000 + l))
    }
  }

  destroy() {
    this.paths.forEach((p) => p.remove())
    this.paths = []
  }
}
