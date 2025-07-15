import { Path } from 'leafer-ui'

export class WaveEffect {
  constructor(leafer, config) {
    this.leafer = leafer
    this.config = config
    this.path = new Path({
      fill: 'none',
      stroke: this.getStroke(),
      strokeWidth: 3,
      shadow: this.config.shadow ? { color: '#000', blur: 8, x: 0, y: 2 } : undefined
    })
    this.leafer.add(this.path)
    this.pointCount = 128
  }

  getStroke() {
    if (this.config.gradient && this.config.gradient.length > 1) {
      return {
        type: 'linear',
        stops: this.config.gradient.map((color, i) => ({
          color,
          offset: i / (this.config.gradient.length - 1)
        })),
        from: { x: 0, y: 1 },
        to: { x: 1, y: 1 }
      }
    }
    return this.config.color || '#00ffcc'
  }

  render(dataArray) {
    const { width, height } = this.leafer
    const maxWaveHeight = height * (this.config.heightRatio || 0.5)
    const points = []
    const len = Math.min(this.pointCount, dataArray.length)
    for (let i = 0; i < len; i++) {
      const x = (i / (len - 1)) * width
      const y =
        height / 2 - ((dataArray[i] - 128) / 128) * maxWaveHeight * (this.config.amplitude || 1)
      points.push([x, y])
    }
    // 生成平滑曲线路径
    let d = `M${points[0][0]},${points[0][1]}`
    for (let i = 1; i < points.length; i++) {
      d += ` L${points[i][0]},${points[i][1]}`
    }
    this.path.d = d
    this.path.stroke = this.getStroke()
    this.path.shadow = this.config.shadow ? { color: '#000', blur: 8, x: 0, y: 2 } : undefined
  }

  destroy() {
    this.path.remove()
  }
}
