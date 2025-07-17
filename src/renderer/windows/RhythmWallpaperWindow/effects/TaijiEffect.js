import { BaseEffect } from './BaseEffect'
import { Path, Ellipse } from 'leafer-ui'

export class TaijiEffect extends BaseEffect {
  constructor(leafer, config) {
    super(leafer, config)
    this.angle = 0
    this.center = { x: 0, y: 0 }
    this.radius = 80
    this.paths = []
    this.ellipses = []
    this.highlight = null
    this.initTaiji()
  }

  initTaiji() {
    const { width, height } = this.leafer
    this.center.x = width / 2
    this.center.y = height / 2
    this.radius = Math.min(width, height) * 0.28
    // 清除旧图形
    this.paths.forEach((p) => p.remove())
    this.ellipses.forEach((e) => e.remove())
    if (this.highlight) {
      this.highlight.remove()
      this.highlight = null
    }
    this.paths = []
    this.ellipses = []
    // 黑色大半圆
    const blackHalf = new Path({})
    this.leafer.add(blackHalf)
    this.paths.push(blackHalf)
    // 白色大半圆
    const whiteHalf = new Path({})
    this.leafer.add(whiteHalf)
    this.paths.push(whiteHalf)
    // 上小圆（白）
    const whiteSmall = new Ellipse({})
    this.leafer.add(whiteSmall)
    this.ellipses.push(whiteSmall)
    // 下小圆（黑）
    const blackSmall = new Ellipse({})
    this.leafer.add(blackSmall)
    this.ellipses.push(blackSmall)
    // 上鱼眼（黑）
    const blackEye = new Ellipse({})
    this.leafer.add(blackEye)
    this.ellipses.push(blackEye)
    // 下鱼眼（白）
    const whiteEye = new Ellipse({})
    this.leafer.add(whiteEye)
    this.ellipses.push(whiteEye)
    // 高光带
    this.highlight = new Path({})
    this.leafer.add(this.highlight)
  }

  render(dataArray) {
    const { width, height } = this.leafer
    if (width !== this.center.x * 2 || height !== this.center.y * 2) {
      this.initTaiji()
    }
    // 1. 音频控制旋转
    const highStart = Math.floor((dataArray.length * 2) / 3)
    const highFreqArray = dataArray.slice(highStart)
    const highFreqEnergy = highFreqArray.reduce((a, b) => a + b, 0) / highFreqArray.length / 255
    const speed = 0.008 + highFreqEnergy * 0.1
    this.angle += speed
    const r = this.radius
    const { x: cx, y: cy } = this.center
    // 旋转辅助
    function rotate(cx, cy, x, y, angle) {
      return {
        x: cx + (x - cx) * Math.cos(angle) - (y - cy) * Math.sin(angle),
        y: cy + (x - cx) * Math.sin(angle) + (y - cy) * Math.cos(angle)
      }
    }
    // 2. 黑鱼（上半大半圆+下半小圆，首尾都在圆心）
    let d1 = ''
    d1 += `M0,0`
    d1 += `L0,${-r}`
    d1 += `A${r},${r},0,0,1,0,${r}`
    d1 += `A${r / 2},${r / 2},0,1,0,0,0`
    d1 += 'Z'
    this.paths[0].path = d1
    this.paths[0].fill = '#000'
    this.paths[0].stroke = '#000'
    this.paths[0].strokeWidth = 2
    this.paths[0].opacity = 1
    this.paths[0].rotation = (this.angle * 180) / Math.PI
    this.paths[0].x = cx
    this.paths[0].y = cy
    // 3. 白鱼（下半大半圆+上半小圆，首尾都在圆心）
    let d2 = ''
    d2 += `M0,0`
    d2 += `L0,${r}`
    d2 += `A${r},${r},0,0,1,0,${-r}`
    d2 += `A${r / 2},${r / 2},0,1,0,0,0`
    d2 += 'Z'
    this.paths[1].path = d2
    this.paths[1].fill = '#fff'
    this.paths[1].stroke = '#000'
    this.paths[1].strokeWidth = 2
    this.paths[1].opacity = 1
    this.paths[1].rotation = (this.angle * 180) / Math.PI
    this.paths[1].x = cx
    this.paths[1].y = cy
    // 4. 白鱼鱼眼（黑色）
    const whiteEye = rotate(cx, cy, cx, cy - r / 2, this.angle)
    this.ellipses[2].x = whiteEye.x - r * 0.13
    this.ellipses[2].y = whiteEye.y - r * 0.13
    this.ellipses[2].width = r * 0.26
    this.ellipses[2].height = r * 0.26
    this.ellipses[2].fill = '#000'
    this.ellipses[2].stroke = '#000'
    this.ellipses[2].strokeWidth = 2
    this.ellipses[2].opacity = 1
    // 5. 黑鱼鱼眼（白色）
    const blackEye = rotate(cx, cy, cx, cy + r / 2, this.angle)
    this.ellipses[3].x = blackEye.x - r * 0.13
    this.ellipses[3].y = blackEye.y - r * 0.13
    this.ellipses[3].width = r * 0.26
    this.ellipses[3].height = r * 0.26
    this.ellipses[3].fill = '#fff'
    this.ellipses[3].stroke = '#000'
    this.ellipses[3].strokeWidth = 2
    this.ellipses[3].opacity = 1
    // 5. 外描边（大圆）
    if (!this.ellipses[4]) {
      const border = new Ellipse({})
      this.leafer.add(border)
      this.ellipses[4] = border
    }
    this.ellipses[4].x = cx - r
    this.ellipses[4].y = cy - r
    this.ellipses[4].width = r * 2
    this.ellipses[4].height = r * 2
    this.ellipses[4].fill = null
    this.ellipses[4].stroke = '#000'
    this.ellipses[4].strokeWidth = 2
    this.ellipses[4].opacity = 1
  }

  destroy() {
    this.paths.forEach((p) => p.remove())
    this.ellipses.forEach((e) => e.remove())
    if (this.highlight) {
      this.highlight.remove()
      this.highlight = null
    }
    this.paths = []
    this.ellipses = []
  }
}
