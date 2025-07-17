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
      fill: this.getFill(),
      stroke: (this.config.colors && this.config.colors[0]) || '#00ffcc',
      strokeWidth: 3,
      shadow: this.config.shadow ? { color: '#000', blur: 8, x: 0, y: 2 } : undefined
    })
    this.leafer.add(this.path)
  }

  // 生成平滑曲线路径
  catmullRom2bezier(points) {
    let d = `M${points[0][0]},${points[0][1]}`
    for (let i = 0; i < points.length - 1; i++) {
      const p0 = points[i - 1] || points[0]
      const p1 = points[i]
      const p2 = points[i + 1]
      const p3 = points[i + 2] || p2
      const cp1x = p1[0] + (p2[0] - p0[0]) / 6
      const cp1y = p1[1] + (p2[1] - p0[1]) / 6
      const cp2x = p2[0] - (p3[0] - p1[0]) / 6
      const cp2y = p2[1] - (p3[1] - p1[1]) / 6
      d += ` C${cp1x},${cp1y} ${cp2x},${cp2y} ${p2[0]},${p2[1]}`
    }
    return d
  }

  render(dataArray) {
    const { width, height } = this.leafer
    const waveWidth = width * (this.config.widthRatio || 1)
    const maxWaveHeight = height * (this.config.heightRatio || 0.5)
    const offsetX = (width - waveWidth) / 2 // 居中
    const points = []
    const len = Math.min(this.pointCount, dataArray.length)
    const animation = this.config.animation || 'linear'
    for (let i = 0; i < len; i++) {
      let index
      if (animation === 'log') {
        index = Math.floor(Math.pow(i / (len - 1), 2) * (dataArray.length - 1))
      } else {
        index = i
      }
      let value = dataArray[index] || 0

      // 振幅权重
      let weight = 1
      if (animation === 'parabola') {
        const center = (len - 1) / 2
        const distance = (i - center) / center
        weight = 1 - distance * distance
      }

      const x = offsetX + (i / (len - 1)) * waveWidth
      const y = height - (value / 255) * maxWaveHeight * (this.config.amplitude || 1) * weight
      points.push([x, y])
    }
    if (points.length >= 2) {
      points[0][1] = height
      points[points.length - 1][1] = height
    }
    if (points.length < 2) return // 没有足够点不渲染
    const isSilent = dataArray.every((v) => v === 0)
    if (isSilent) {
      return
    }
    // 生成平滑曲线路径
    let d = this.catmullRom2bezier(points)
    // 闭合路径
    d += ` L${points[points.length - 1][0]},${height}`
    d += ` L${points[0][0]},${height} Z`
    this.path.path = d

    // 填充色
    const newFill = this.getFill()
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
