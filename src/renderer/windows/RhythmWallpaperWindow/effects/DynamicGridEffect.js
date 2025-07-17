import { BaseEffect } from './BaseEffect'
import { Rect } from 'leafer-ui'
import { hex2RGB, rgb2HEX, lightenColor, darkenColor } from '@renderer/utils/gen-color.js'

export class DynamicGridEffect extends BaseEffect {
  constructor(leafer, config) {
    super(leafer, config)
    this.baseColor = this.config.colors[0] || '#00ffcc'
    this.densityCount = {
      sparse: 180,
      normal: 120,
      dense: 60
    }
    this.cellWidth = this.densityCount[this.config.densityType] || this.densityCount.normal
    this.cellHeight = this.cellWidth
    this.cells = []
    this.initGrid()
  }

  initGrid() {
    // 清空旧格子
    this.cells.forEach((cell) => cell.remove())
    this.cells = []
    // 先创建足够多的格子（多余的隐藏/不渲染也可）
    const { width, height } = this.leafer
    const cols = Math.ceil(width / this.cellWidth)
    const rows = Math.ceil(height / this.cellHeight)
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
    const { width, height } = this.leafer
    const cols = Math.ceil(width / this.cellWidth)
    const rows = Math.ceil(height / this.cellHeight)

    // 如果窗口大小变了，重新生成格子
    if (cols !== this.cols || rows !== this.rows) {
      this.initGrid()
    }

    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const idx = row * cols + col
        const value = dataArray[idx % dataArray.length] || 0
        const mapped = this.getMappedValue(value)
        const cell = this.cells[idx]
        // 默认宽高
        let w = this.cellWidth
        let h = this.cellHeight
        // 最后一列
        if (col === cols - 1) w = width - col * this.cellWidth
        // 最后一行
        if (row === rows - 1) h = height - row * this.cellHeight
        // 位置
        const x = col * this.cellWidth
        const y = row * this.cellHeight
        // 固定宽高，无缝排列
        cell.width = w
        cell.height = h
        cell.x = x
        cell.y = y
        // 颜色深浅随 mapped 变化
        cell.fill = this.getFill(idx, mapped)
        // 透明度可选（如需更明显可调高基数）
        cell.opacity = 0.9
        // 阴影强度随 mapped 变化
        if (this.config.shadow) {
          cell.innerShadow = {
            color: 'rgba(0,0,0,0.5)', // 更淡
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
