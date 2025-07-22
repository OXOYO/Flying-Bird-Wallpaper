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
    this.scale = 1
    this.init()
  }

  init() {
    const { width, height, x, y } = this.bodySize
    const left = x - width / 2
    const top = y - height / 2
    this.scale = Math.min(width, height) / 100

    if (this.bodyPath) {
      this.bodyPath.remove()
      this.bodyPath = null
    }

    const d =
      'M -0.150824 69.7595 C -1.12926 74.3823 3.32743 79.5912 8.16072 78.2485 C 12.9659 77.677 17.5638 79.9433 22.1632 81.0368 C 39.5181 86.2427 58.3239 90.4334 76.2371 85.4075 C 86.1956 82.8583 96.2667 76.3528 99.0813 65.9148 C 100.777 58.9397 100.743 51.4157 98.8388 44.4908 C 97.9405 39.5601 92.4323 39.3648 88.4978 40.1547 C 81.242 41.7856 73.8221 42.6476 66.6147 44.484 C 55.3828 49.3498 44.6199 55.2186 33.6638 60.657 C 28.5362 62.2818 26.4775 53.6998 31.6609 52.2905 C 37.5746 47.7713 45.2231 47.214 52.2127 45.5055 C 58.7762 44.436 65.3208 43.3083 71.7614 41.6084 C 78.7891 39.8524 85.9003 38.3485 92.8097 36.1702 C 97.643 32.7838 91.9221 28.3028 89.4456 25.569 C 85.5551 21.201 81.2868 16.7796 75.4769 15.1564 C 63.5195 11.1944 49.4137 10.6781 38.5658 17.9504 C 26.7294 25.4721 18.9328 37.6149 12.2903 49.6425 C 9.701 54.6243 7.5084 59.8997 3.50599 63.9691 C 2.1067 65.755 0.473118 67.5235 -0.150824 69.7595 Z'

    this.bodyPath = new Path({
      path: d,
      fill: this.getFill(),
      stroke: null,
      scale: this.scale,
      x: left,
      y: top,
      origin: 'center',
      shadow: {
        color: 'rgba(0,0,0,0.5)',
        x: 0,
        y: 32 * this.scale,
        blur: 96 * this.scale
      }
    })

    const bounds = this.bodyPath.getBounds()

    // 计算红框中心和内容中心
    const boxCenterX = left + width / 2
    const boxCenterY = top + height / 2
    const contentCenterX = bounds.x + bounds.width / 2
    const contentCenterY = bounds.y + bounds.height / 2

    // 修正 bodyPath 的 x/y，使内容中心对齐红框中心
    const dx = boxCenterX - contentCenterX
    const dy = boxCenterY - contentCenterY
    this.bodyPath.x += dx
    this.bodyPath.y += dy

    this.leafer.add(this.bodyPath)
    this.beatTime = 0
    this.lastTimestamp = 0
    this.floatingTexts = []
  }

  showCount(num) {
    const { width, height, x, y } = this.bodySize
    // 字体大小为红框宽度的5%，最小16px，最大32px
    const fontSize = Math.min(Math.max(16, Math.min(width, height) * 0.1), 32)
    const text = new Text({
      text: `+ ${num}`,
      fontSize: fontSize,
      fill: '#ffd700',
      x: x - fontSize * 0.8,
      y: y - height / 2 - fontSize,
      opacity: 1,
      bold: true,
      stroke: '#fff',
      strokeWidth: 4
    })
    this.leafer.add(text)
    this.floatingTexts.push({ text, time: 0 })
  }

  render(dataArray, timestamp = Date.now()) {
    const mappedValues = this.getMappedValues(dataArray)
    const avgValue = mappedValues.reduce((a, b) => a + b, 0) / mappedValues.length
    this.beatInterval = 1000 - 800 * avgValue
    if (!this.lastTimestamp) this.lastTimestamp = timestamp
    const dt = timestamp - this.lastTimestamp
    this.beatTime += dt
    this.lastTimestamp = timestamp
    if (this.beatTime >= this.beatInterval) {
      this.beatTime = 0
      // 只有有音乐时才显示功德数，数量随energy变化
      if (avgValue) {
        const num = Math.ceil(avgValue)
        this.showCount(num)
      }
    }

    let hitScale = 1
    if (avgValue) {
      const baseVibrate = 0.02
      const vibrate = baseVibrate + avgValue * 0.05
      if (this.beatTime < this.beatInterval / 2) {
        hitScale = 1 - vibrate * (this.beatTime / (this.beatInterval / 2))
      } else if (this.beatTime < this.beatInterval) {
        hitScale =
          1 - vibrate * (1 - (this.beatTime - this.beatInterval / 2) / (this.beatInterval / 2))
      } else {
        hitScale = 1
      }
    } else {
      hitScale = 1
    }

    if (this.bodyPath) {
      const bounds = this.bodyPath.getBounds()

      this.bodyPath.scaleY = this.scale * hitScale
      this.bodyPath.offsetY = bounds.height - hitScale * bounds.height
    }
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

  destroy() {
    if (this.bodyPath) {
      this.bodyPath.remove()
      this.bodyPath = null
    }
    this.floatingTexts.forEach((obj) => obj.text.remove())
    this.floatingTexts = []
  }
}
