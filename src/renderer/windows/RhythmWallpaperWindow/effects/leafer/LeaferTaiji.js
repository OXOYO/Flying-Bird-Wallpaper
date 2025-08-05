import LeaferBase from '../base/LeaferBase'
import { Image, Platform } from 'leafer-ui'

export class LeaferTaiji extends LeaferBase {
  constructor(container, config) {
    super(container, config)
    const { x, y, width, height } = this.bodySize
    this.radius = Math.min(width, height) / 2
    this.center = { x: x - this.radius, y: y - this.radius }
    this.taijiImage = null
    this.init()
  }

  init() {
    if (this.taijiImage) {
      this.taijiImage.remove()
      this.taijiImage = null
    }
    // 标准太极SVG，中心为(0,0)
    const r = 100
    const taijiSVG = `
<svg width="${r * 2}" height="${r * 2}" viewBox="-${r} -${r} ${r * 2} ${r * 2}" xmlns="http://www.w3.org/2000/svg">
  <g>
    <circle cx="0" cy="0" r="${r}" fill="black"/>
    <path d="M0,-${r}
             A${r},${r} 0 1,1 0,${r}
             A${r / 2},${r / 2} 0 1,0 0,0
             A${r / 2},${r / 2} 0 1,1 0,-${r}
             Z" fill="white"/>
    <circle cx="0" cy="-${r / 2}" r="${r * 0.15}" fill="black"/>
    <circle cx="0" cy="${r / 2}" r="${r * 0.15}" fill="white"/>
  </g>
</svg>`

    this.taijiImage = new Image({
      url: Platform.toURL(taijiSVG, 'svg'),
      width: this.radius * 2,
      height: this.radius * 2,
      x: this.center.x,
      y: this.center.y,
      origin: 'center',
      draggable: false,
      shadow: {
        color: 'rgba(0,0,0,1)',
        x: 0,
        y: 8,
        blur: 24
      }
    })
    this.leafer.add(this.taijiImage)
  }

  render(dataArray) {
    // 计算整体音乐能量
    const mappedValues = this.getMappedValues(dataArray)
    const energy = mappedValues.reduce((a, b) => a + b, 0) / mappedValues.length

    // 检查是否有音频，没有音频时不显示
    if (energy < 0.02) {
      if (this.taijiImage) {
        this.taijiImage.opacity = 0
      }
      return
    }

    const speed = 0.05 + energy * 0.4 // 能量大时旋转更快
    if (this.taijiImage) {
      this.taijiImage.rotateOf('center', (speed * 180) / Math.PI)
    }
  }

  destroy() {
    if (this.taijiImage) {
      this.taijiImage.remove()
      this.taijiImage = null
    }
    super.destroy()
  }
}
