import { BaseEffect } from './BaseEffect'
import { Path, Text } from 'leafer-ui'

export class MuyuEffect extends BaseEffect {
  constructor(leafer, config) {
    super(leafer, config)
    this.bodyPath = null
    this.beatTime = 0
    this.beatInterval = 800
    this.lastTimestamp = 0
    this.floatingTexts = []
    this.sum = 0
    this.lastNum = 0
    this.animateCenter = { x: 0, y: 0 }
    this.scale = 1
    this.init()
  }

  init() {
    const { x: centerX, y: centerY, width, height } = this.bodySize
    const w = width * 0.7
    const h = height * 0.6
    let d = ''
    // d += `M${centerX - w / 2},${centerY}`
    // d += `A${w / 2},${h / 2} 0 1,0 ${centerX + w / 2},${centerY}`
    // d += `A${w / 2},${h / 2} 0 1,0 ${centerX - w / 2},${centerY}`
    // const mouthY = centerY + h * 0.35
    // d += ` M${centerX - w * 0.15},${mouthY}`
    // d += `Q${centerX},${mouthY + h * 0.08} ${centerX + w * 0.15},${mouthY}`
    // const eyeLX = centerX - w * 0.18
    // const eyeLY = centerY - h * 0.18
    // d += ` M${eyeLX},${eyeLY}`
    // d += `a${w * 0.04},${h * 0.04} 0 1,0 ${w * 0.08},0 a${w * 0.04},${h * 0.04} 0 1,0 -${w * 0.08},0`
    // const eyeRX = centerX + w * 0.18
    // const eyeRY = centerY - h * 0.18
    // d += ` M${eyeRX},${eyeRY}`
    // d += `a${w * 0.04},${h * 0.04} 0 1,0 ${w * 0.08},0 a${w * 0.04},${h * 0.04} 0 1,0 -${w * 0.08},0`

    if (this.bodyPath) {
      this.bodyPath.remove()
      this.bodyPath = null
    }
    this.bodyPath = new Path({
      path: d,
      fill: '#bfa76f',
      stroke: '#8c6d29',
      strokeWidth: 4,
      shadow: {
        color: 'rgba(0,0,0,0.3)',
        x: 0,
        y: 16,
        blur: 32
      }
    })
    this.leafer.add(this.bodyPath)
    this.beatTime = 0
    this.lastTimestamp = 0
    this.floatingTexts = []
    this.sum = 0
    this.lastNum = 0
  }

  showCount(num) {
    const text = new Text({
      text: `+ ${num}`,
      fontSize: 20 + 20 * this.scale * 5,
      fill: '#ffd700',
      x: this.bodySize.x,
      y: this.bodySize.y - this.bodySize.height / 2 - 50,
      opacity: 1,
      bold: true,
      stroke: '#fff',
      strokeWidth: 4
    })
    this.leafer.add(text)
    this.floatingTexts.push({ text, time: 0 })
  }

  render(dataArray, timestamp = Date.now()) {
    // if (this.bodyPath) {
    //   this.bodyPath.scale = this.scale
    //   this.bodyPath.x = this.bodySize.x
    //   this.bodyPath.y = this.bodySize.y
    //   this.bodyPath.shadow = {
    //     color: 'rgba(0,0,0,0.5)',
    //     x: 0,
    //     y: 32 * this.scale,
    //     blur: 96 * this.scale
    //   }
    // }
    const avgValue = dataArray.reduce((a, b) => a + b, 0) / dataArray.length
    const energy = this.getMappedValue ? this.getMappedValue(avgValue) : avgValue / 255
    this.beatInterval = 1000 - 800 * energy
    if (!this.lastTimestamp) this.lastTimestamp = timestamp
    const dt = timestamp - this.lastTimestamp
    this.beatTime += dt
    this.lastTimestamp = timestamp
    // 顶部动画
    let offset = 0
    const maxOffset = 10 * Math.max(0.5, energy)
    if (this.beatTime < this.beatInterval / 2) {
      offset = maxOffset * (this.beatTime / (this.beatInterval / 2))
    } else if (this.beatTime < this.beatInterval) {
      offset = maxOffset * (1 - (this.beatTime - this.beatInterval / 2) / (this.beatInterval / 2))
    } else {
      this.beatTime = 0
      offset = 0
      // 敲击一次，显示功德
      const num = Math.floor(10 + 90 * energy)
      this.sum += num
      this.lastNum = num
      this.showCount(num)
    }
    if (this.bodyPath) {
      // 功德动画
      for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
        const obj = this.floatingTexts[i]
        obj.time += dt
        obj.text.y -= 0.5 * (dt / 16.7)
        obj.text.opacity = 1 - obj.time / 1200
        if (obj.time > 1200) {
          obj.text.remove()
          this.floatingTexts.splice(i, 1)
        }
      }
    }
  }

  destroy() {
    if (this.bodyPath) {
      this.bodyPath.remove()
      this.bodyPath = null
    }
    this.floatingTexts.forEach((obj) => obj.text.remove())
    this.floatingTexts = []
  }
}
