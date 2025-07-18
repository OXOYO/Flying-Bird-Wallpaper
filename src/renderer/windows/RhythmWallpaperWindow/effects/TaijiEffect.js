import { BaseEffect } from './BaseEffect'
import { Image, Platform } from 'leafer-ui'

export class TaijiEffect extends BaseEffect {
  constructor(leafer, config) {
    super(leafer, config)
    this.center = { x: 0, y: 0 }
    this.radius = 80
    this.imageCenter = { x: 0, y: 0 }
    this.taijiImage = null
    this.initTaiji()
  }

  initTaiji() {
    const { width, height } = this.leafer
    this.center.x = width / 2
    this.center.y = height / 2
    this.radius = Math.min(width * this.config.widthRatio, height * this.config.heightRatio)
    this.imageCenter.x = this.center.x - this.radius
    this.imageCenter.y = this.center.y - this.radius

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
      x: this.imageCenter.x,
      y: this.imageCenter.y,
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
    const { width, height } = this.leafer
    if (width !== this.center.x * 2 || height !== this.center.y * 2) {
      this.initTaiji()
    }
    // 音频控制旋转
    const speed = dataArray.reduce((a, b) => a + b, 0) / dataArray.length / 255
    if (this.taijiImage) {
      this.taijiImage.rotateOf('center', (speed * 180) / Math.PI)
    }
  }

  destroy() {
    if (this.taijiImage) {
      this.taijiImage.remove()
      this.taijiImage = null
    }
  }
}
