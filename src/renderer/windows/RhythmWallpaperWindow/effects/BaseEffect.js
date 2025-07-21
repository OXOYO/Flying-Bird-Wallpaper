export class BaseEffect {
  constructor(leafer, config) {
    this.leafer = leafer
    this.config = config
    this.bodySize = this.getBodySize()
  }

  getBodySize() {
    const { width, height } = this.leafer
    const { widthRatio, heightRatio } = this.config
    const bodyWidth = width * widthRatio
    const bodyHeight = height * heightRatio
    const { x, y } = this.getPosition(width, height, bodyWidth, bodyHeight)
    return {
      width: bodyWidth,
      height: bodyHeight,
      x,
      y
    }
  }

  getPosition(width, height, bodyWidth, bodyHeight, margin = 0) {
    // bodyWidth/bodyHeight为效果自身宽高
    switch (this.config.position) {
      case 'top-left':
        return { x: margin + bodyWidth / 2, y: margin + bodyHeight / 2 }
      case 'top':
        return { x: width / 2, y: margin + bodyHeight / 2 }
      case 'top-right':
        return { x: width - margin - bodyWidth / 2, y: margin + bodyHeight / 2 }
      case 'right':
        return { x: width - margin - bodyWidth / 2, y: height / 2 }
      case 'bottom-right':
        return { x: width - margin - bodyWidth / 2, y: height - margin - bodyHeight / 2 }
      case 'bottom':
        return { x: width / 2, y: height - margin - bodyHeight / 2 }
      case 'bottom-left':
        return { x: margin + bodyWidth / 2, y: height - margin - bodyHeight / 2 }
      case 'left':
        return { x: margin + bodyWidth / 2, y: height / 2 }
      case 'center':
      default:
        return { x: width / 2, y: height / 2 }
    }
  }

  // 数据降维
  getReducedValues(list, count = 8) {
    const ret = []
    for (let i = 0; i < count; i++) {
      const start = Math.floor((i * list.length) / count)
      const end = Math.floor(((i + 1) * list.length) / count)
      let sum = 0
      for (let j = start; j < end; j++) {
        sum += list[j]
      }
      ret[i] = sum / (end - start)
    }
    return ret
  }

  // 数据归一化
  getMappedValues(list) {
    const ret = []
    for (let i = 0; i < list.length; i++) {
      ret[i] = this.getMappedValue(list[i])
    }
    return ret
  }

  // 数据归一化
  getMappedValue(value) {
    const animation = this.config?.animation || 'linear'
    switch (animation) {
      case 'linear':
        return value / 255
      case 'log':
        return Math.log2(1 + value) / Math.log2(256)
      case 'parabola':
        return Math.pow(value / 255, 2)
      case 'sqrt':
        return Math.sqrt(value / 255)
      case 'exp':
        return Math.pow(value / 255, 1.5)
      case 'sin':
        return Math.sin(((value / 255) * Math.PI) / 2)
      case 'bounce': {
        const x = value / 255
        let y
        if (x < 1 / 2.75) {
          y = 7.5625 * x * x
        } else if (x < 2 / 2.75) {
          y = 7.5625 * (x - 1.5 / 2.75) * (x - 1.5 / 2.75) + 0.75
        } else if (x < 2.5 / 2.75) {
          y = 7.5625 * (x - 2.25 / 2.75) * (x - 2.25 / 2.75) + 0.9375
        } else {
          y = 7.5625 * (x - 2.625 / 2.75) * (x - 2.625 / 2.75) + 0.984375
        }
        y = Math.min(1, Math.max(0, y))
        return Math.pow(y, 0.7)
      }
      case 'step': {
        const n = 5
        return Math.floor((value / 255) * n) / n
      }
      default:
        return value / 255
    }
  }

  getFill() {
    if (this.config.colors && this.config.colors.length > 1) {
      return {
        type: 'linear',
        stops: this.config.colors.map((color, idx) => ({
          color,
          offset: idx / (this.config.colors.length - 1)
        })),
        from: 'top',
        to: 'bottom'
      }
    }
    if (this.config.colors && this.config.colors.length > 0) {
      return this.config.colors[0]
    }
    return '#00ffcc'
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

  destroy() {
    // 子类需实现 lights/balls/bars/waves 的 remove
  }
}
