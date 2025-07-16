import { BaseEffect } from './BaseEffect'
import { Rect } from 'leafer-ui'

export class DynamicGridEffect extends BaseEffect {
  constructor(leafer, config) {
    super(leafer, config)
    this.rows = config.rows || 8
    this.cols = config.cols || 16
    this.cells = []
    this.initGrid()
  }

  initGrid() {
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        const cell = new Rect({
          width: 24,
          height: 24,
          fill: this.getFill(r * this.cols + c),
          opacity: 0.7
        })
        this.leafer.add(cell)
        this.cells.push(cell)
      }
    }
  }

  render(dataArray) {
    const { width, height } = this.leafer
    const cellW = width / this.cols
    const cellH = height / this.rows
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        const idx = r * this.cols + c
        const value = dataArray[idx % dataArray.length] || 0
        const mapped = this.getMappedValue(value)
        const cell = this.cells[idx]
        cell.width = cellW * 0.8
        cell.height = cellH * (0.5 + mapped * 0.5)
        cell.x = c * cellW + cellW / 2
        cell.y = r * cellH + cellH / 2
        cell.opacity = 0.4 + mapped * 0.6
        cell.fill = this.getFill(idx)
      }
    }
  }

  destroy() {
    this.cells.forEach((cell) => cell.remove())
    this.cells = []
  }
}
