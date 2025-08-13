import EffectBase from './EffectBase.js'
import { colorList } from '@common/publicData.js'
import { Leafer, Rect } from 'leafer-ui'

export default class LeaferBase extends EffectBase {
  constructor(container, config) {
    super(container, config)
    // 初始化leafer
    this.leafer = null
    this.debugRect = null
    this.initLeafer()
    this.renderDebug()
  }

  initLeafer() {
    try {
      if (!this.container) {
        console.error('LeaferBase: Container is required')
        return
      }
      if (this.leafer) {
        console.error('LeaferBase: Leafer already initialized')
        return
      }
      console.log('LeaferBase: this.bodySize', this.bodySize)
      this.leafer = new Leafer({
        view: this.container,
        width: this.bodySize.boundWidth,
        height: this.bodySize.boundHeight
      })
      console.log('LeaferBase: Leafer initialized successfully:', this.leafer)
    } catch (error) {
      console.error('LeaferBase: Error initializing leafer:', error)
    }
  }

  renderDebug() {
    if (!this.config.debug) return
    const { x, y, width, height } = this.bodySize
    // 绘制调试红框
    if (!this.debugRect) {
      this.debugRect = new Rect({
        x: x - width / 2,
        y: y - height / 2,
        width,
        height,
        stroke: 'red',
        strokeWidth: 2,
        fill: null
      })
      this.leafer.add(this.debugRect)
    } else {
      this.debugRect.x = x - width / 2
      this.debugRect.y = y - height / 2
      this.debugRect.width = width
      this.debugRect.height = height
    }
  }

  destroyDebug() {
    if (this.debugRect) {
      this.debugRect.remove()
      this.debugRect = null
    }
  }

  getFill(type = 'linear', index = 0) {
    const colors = this.config.colors || colorList
    if (type === 'linear') {
      return {
        type: 'linear',
        stops: colors.map((color, idx) => ({
          color,
          offset: idx / (colors.length - 1)
        })),
        from: 'top',
        to: 'bottom'
      }
    } else if (type === 'radial') {
      return {
        type: 'radial',
        stops: colors.map((color, idx) => ({
          color,
          offset: idx / (colors.length - 1)
        })),
        from: 'center'
      }
    } else if (type === 'random') {
      return colors[Math.floor(Math.random() * colors.length)]
    } else if (type === 'loop') {
      return colors[index % colors.length]
    } else if (type === 'single') {
      return colors[index]
    } else {
      return colors[index]
    }
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
    try {
      // 子类实现具体渲染逻辑
    } catch (error) {
      console.error('LeaferBase: Error in render:', error)
    }
  }

  destroy() {
    try {
      super.destroy()
      this.destroyDebug()
      // 销毁leafer
      this.leafer?.destroy()
      this.leafer = null
    } catch (error) {
      console.error('LeaferBase: Error destroying leafer:', error)
    }
  }
}
