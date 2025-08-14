export default class EffectBase {
  constructor(container, config) {
    this.container = container
    this.config = config
    this.bodySize = this.getBodySize()
  }

  init() {
    // 子类实现具体初始化逻辑
  }

  render(dataArray) {
    // 子类实现具体渲染逻辑
  }

  destroy() {
    // 子类实现具体销毁逻辑
  }

  getBodySize() {
    let ret = { boundWidth: 0, boundHeight: 0, width: 0, height: 0, x: 0, y: 0 }
    try {
      if (!this.container) {
        console.warn('EffectBase: Container not found')
        return ret
      }

      const rect = this.container.getBoundingClientRect()
      console.log('EffectBase: Container rect:', rect)
      const boundWidth = rect.width || 0
      const boundHeight = rect.height || 0

      // 如果容器尺寸为0，使用默认值
      if (boundWidth === 0 || boundHeight === 0) {
        console.warn('EffectBase: Container has zero size, using default values')
        return ret
      }

      const bodyWidth = boundWidth * (this.config.widthRatio || 1)
      const bodyHeight = boundHeight * (this.config.heightRatio || 1)
      const { x, y } = this.getPosition(boundWidth, boundHeight, bodyWidth, bodyHeight)

      ret = {
        boundWidth,
        boundHeight,
        width: bodyWidth,
        height: bodyHeight,
        depth: Math.min(bodyWidth, bodyHeight),
        x,
        y
      }

      console.log('EffectBase: Body size calculated:', ret)
      return ret
    } catch (error) {
      console.error('EffectBase: Error getting body size:', error)
      return ret
    }
  }

  /**
   * 计算内容（如特效层、Three.js 画布等）在父容器中的中心点坐标，支持多种对齐方式。
   *
   * @param {number} boundWidth - 父容器的宽度（像素，左上角为原点）。
   * @param {number} boundHeight - 父容器的高度（像素，左上角为原点）。
   * @param {number} bodyWidth - 内容自身的宽度（像素）。
   * @param {number} bodyHeight - 内容自身的高度（像素）。
   * @param {number} [margin=0] - 距离父容器边缘的边距（像素）。
   * @returns {{x: number, y: number}} 内容中心点在父容器坐标系中的像素坐标。
   *
   * 坐标系说明：
   *   - 原点 (0,0) 在父容器左上角
   *   - x 轴向右，y 轴向下，单位为像素
   *   - 返回值为内容“中心点”在父容器中的坐标
   *
   * 用途：
   *   - 用于将内容（如 Three.js 画布、特效层等）根据指定对齐方式放置在父容器内
   *   - 支持 top-left、top、top-right、right、bottom-right、bottom、bottom-left、left、center（默认）等位置
   */
  getPosition(boundWidth, boundHeight, bodyWidth, bodyHeight, margin = 0) {
    // bodyWidth/bodyHeight为效果自身宽高
    switch (this.config.position) {
      case 'top-left':
        return { x: margin + bodyWidth / 2, y: margin + bodyHeight / 2 }
      case 'top':
        return { x: boundWidth / 2, y: margin + bodyHeight / 2 }
      case 'top-right':
        return { x: boundWidth - margin - bodyWidth / 2, y: margin + bodyHeight / 2 }
      case 'right':
        return { x: boundWidth - margin - bodyWidth / 2, y: boundHeight / 2 }
      case 'bottom-right':
        return { x: boundWidth - margin - bodyWidth / 2, y: boundHeight - margin - bodyHeight / 2 }
      case 'bottom':
        return { x: boundWidth / 2, y: boundHeight - margin - bodyHeight / 2 }
      case 'bottom-left':
        return { x: margin + bodyWidth / 2, y: boundHeight - margin - bodyHeight / 2 }
      case 'left':
        return { x: margin + bodyWidth / 2, y: boundHeight / 2 }
      case 'center':
      default:
        return { x: boundWidth / 2, y: boundHeight / 2 }
    }
  }

  // 数据降维
  getReducedValues(list, count = 8, type = 'max') {
    try {
      if (!list || list.length === 0) {
        console.log('getReducedValues fill 0')
        return new Array(count).fill(0)
      }

      const ret = []
      for (let i = 0; i < count; i++) {
        const start = Math.floor((i * list.length) / count)
        const end = Math.floor(((i + 1) * list.length) / count)
        if (type === 'average') {
          let sum = 0
          for (let j = start; j < end; j++) {
            sum += list[j]
          }
          ret[i] = sum / (end - start)
        } else if (type === 'max') {
          ret[i] = Math.max(...list.slice(start, end))
        } else if (type === 'min') {
          ret[i] = Math.min(...list.slice(start, end))
        }
      }
      return ret
    } catch (error) {
      console.error('EffectBase: Error in getReducedValues:', error)
      return new Array(count).fill(0)
    }
  }

  // 数据归一化
  getMappedValues(list) {
    try {
      if (!list || list.length === 0) {
        return []
      }

      const ret = []
      for (let i = 0; i < list.length; i++) {
        ret[i] = this.getMappedValue(list[i])
      }
      return ret
    } catch (error) {
      console.error('EffectBase: Error in getMappedValues:', error)
      return []
    }
  }

  // 数据归一化
  getMappedValue(value) {
    try {
      if (typeof value !== 'number' || isNaN(value)) {
        return 0
      }
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
    } catch (error) {
      console.error('EffectBase: Error in getMappedValue:', error)
      return 0
    }
  }
}
