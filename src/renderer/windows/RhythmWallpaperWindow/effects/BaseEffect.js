export class BaseEffect {
  constructor(leafer, config) {
    this.leafer = leafer
    this.config = config
  }

  getMappedValue(value) {
    switch (this.config.animation) {
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

  getFill(i) {
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

  destroy() {
    // 子类需实现 lights/balls/bars/waves 的 remove
  }
}
