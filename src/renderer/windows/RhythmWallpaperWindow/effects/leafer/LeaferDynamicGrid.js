import { LeaferBase } from './LeaferBase'
import { Rect } from 'leafer-ui'
import { hex2RGB, rgb2HEX, lightenColor, darkenColor } from '@renderer/utils/gen-color.js'

export class LeaferDynamicGrid extends LeaferBase {
  constructor(leafer, config) {
    super(leafer, config)
    this.baseColor = this.config.colors[0] || '#00ffcc'
    this.densityOptions = {
      sparse: 256,
      normal: 128,
      dense: 64
    }
    this.cellWidth = this.densityOptions[this.config.density] || this.densityOptions.normal
    this.cellHeight = this.cellWidth
    this.cells = []
    this.init()
  }

  init() {
    // 清空旧格子
    this.cells.forEach((cell) => cell.remove())
    this.cells = []
    // 先创建足够多的格子（多余的隐藏/不渲染也可）
    const cols = Math.ceil(this.bodySize.width / this.cellWidth)
    const rows = Math.ceil(this.bodySize.height / this.cellHeight)
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const rect = new Rect({
          width: this.cellWidth,
          height: this.cellHeight,
          x: col * this.cellWidth,
          y: row * this.cellHeight,
          fill: this.getFill(row * cols + col, 0),
          shadow: this.config.shadow ? { color: '#000', blur: 0, x: 0, y: 0 } : null,
          opacity: 1
        })
        this.leafer.add(rect)
        this.cells.push(rect)
      }
    }
    this.cols = cols
    this.rows = rows
  }

  getFill(idx, mapped = 0) {
    const rgb = hex2RGB(this.baseColor)
    if (!rgb) return this.baseColor

    // mapped 越大，颜色越亮（可调节 0.6 为其它系数）
    const factor = 0.6
    const newR = Math.round(rgb.r + (255 - rgb.r) * mapped * factor)
    const newG = Math.round(rgb.g + (255 - rgb.g) * mapped * factor)
    const newB = Math.round(rgb.b + (255 - rgb.b) * mapped * factor)

    // 保证在 0~255
    const clamp = (v) => Math.max(0, Math.min(255, v))
    return rgb2HEX({ r: clamp(newR), g: clamp(newG), b: clamp(newB) })
  }

  render(dataArray) {
    const { x, y, width, height } = this.bodySize
    const cols = Math.ceil(width / this.cellWidth)
    const rows = Math.ceil(height / this.cellHeight)
    const mappedValues = this.getMappedValues(this.getReducedValues(dataArray, cols * rows))

    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const idx = row * cols + col
        const mapped = mappedValues[idx]
        const cell = this.cells[idx]
        // 位置
        let w = this.cellWidth
        let h = this.cellHeight
        if (col === cols - 1) w = width - col * this.cellWidth
        if (row === rows - 1) h = height - row * this.cellHeight
        const cellX = x - width / 2 + col * this.cellWidth
        const cellY = y - height / 2 + row * this.cellHeight
        cell.width = w
        cell.height = h
        cell.x = cellX
        cell.y = cellY
        cell.fill = this.getFill(idx, mapped)
        cell.opacity = 0.9
        if (this.config.shadow) {
          cell.innerShadow = {
            color: 'rgba(0,0,0,0.5)',
            blur: this.cellWidth / 4 + mapped * this.cellWidth,
            spread: mapped * this.cellWidth * 0.3,
            x: 0,
            y: 0
          }
        }
      }
    }
  }

  destroy() {
    this.cells.forEach((cell) => cell.remove())
    this.cells = []
  }
}
