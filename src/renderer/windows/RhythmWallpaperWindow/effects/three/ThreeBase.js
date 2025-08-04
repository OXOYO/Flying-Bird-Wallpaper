import { colorList } from '@common/publicData.js'
import * as THREE from 'three'

export class ThreeBase {
  constructor(leafer, config) {
    this.leafer = leafer
    this.config = config
    this.scene = null
    this.camera = null
    this.renderer = null
    this.container = null
    this.bodySize = this.getBodySize()
    this.initThree()
  }

  initThree() {
    const { width, height, x, y } = this.bodySize

    // 创建容器
    this.container = document.createElement('div')
    this.container.style.position = 'absolute'
    this.container.style.left = `${x - width / 2}px`
    this.container.style.top = `${y - height / 2}px`
    this.container.style.width = `${width}px`
    this.container.style.height = `${height}px`
    this.container.style.pointerEvents = 'none'
    this.container.style.zIndex = '1000'

    // 添加到leafer容器
    this.leafer.view.parentElement.appendChild(this.container)

    // 创建场景
    this.scene = new THREE.Scene()

    // 创建相机
    this.camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000)
    this.camera.position.z = 5

    // 创建渲染器
    this.renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: true,
      preserveDrawingBuffer: true
    })
    this.renderer.setSize(width, height)
    this.renderer.setClearColor(0x000000, 0)
    this.container.appendChild(this.renderer.domElement)

    // 初始化场景
    this.initScene()
  }

  initScene() {
    // 子类实现具体场景初始化
  }

  getBodySize() {
    const { width, height } = this.leafer
    const { widthRatio, heightRatio } = this.config
    const bodyWidth = width * widthRatio
    const bodyHeight = height * heightRatio
    const { x, y } = this.getPosition(width, height, bodyWidth, bodyHeight)
    return {
      width: bodyWidth,
      height: bodyHeight,
      x,
      y
    }
  }

  getPosition(width, height, bodyWidth, bodyHeight, margin = 0) {
    switch (this.config.position) {
      case 'top-left':
        return { x: margin + bodyWidth / 2, y: margin + bodyHeight / 2 }
      case 'top':
        return { x: width / 2, y: margin + bodyHeight / 2 }
      case 'top-right':
        return { x: width - margin - bodyWidth / 2, y: margin + bodyHeight / 2 }
      case 'right':
        return { x: width - margin - bodyWidth / 2, y: height / 2 }
      case 'bottom-right':
        return { x: width - margin - bodyWidth / 2, y: height - margin - bodyHeight / 2 }
      case 'bottom':
        return { x: width / 2, y: height - margin - bodyHeight / 2 }
      case 'bottom-left':
        return { x: margin + bodyWidth / 2, y: height - margin - bodyHeight / 2 }
      case 'left':
        return { x: margin + bodyWidth / 2, y: height / 2 }
      case 'center':
      default:
        return { x: width / 2, y: height / 2 }
    }
  }

  // 数据降维
  getReducedValues(list, count = 8, type = 'max') {
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
  }

  // 数据归一化
  getMappedValues(list) {
    const ret = []
    for (let i = 0; i < list.length; i++) {
      ret[i] = this.getMappedValue(list[i])
    }
    return ret
  }

  // 数据归一化
  getMappedValue(value) {
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
  }

  getColor(type = 'linear', index = 0) {
    const colors = this.config.colors || colorList
    if (type === 'random') {
      return colors[Math.floor(Math.random() * colors.length)]
    } else if (type === 'loop') {
      return colors[index % colors.length]
    } else if (type === 'single') {
      return colors[index]
    } else {
      return colors[index]
    }
  }

  hexToRgb(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
    return result
      ? {
          r: parseInt(result[1], 16) / 255,
          g: parseInt(result[2], 16) / 255,
          b: parseInt(result[3], 16) / 255
        }
      : { r: 1, g: 1, b: 1 }
  }

  render(data) {
    // 子类实现具体渲染逻辑
    this.renderer.render(this.scene, this.camera)
  }

  destroy() {
    if (this.renderer) {
      this.renderer.dispose()
    }
    if (this.container && this.container.parentElement) {
      this.container.parentElement.removeChild(this.container)
    }
    // 清理场景中的所有对象
    if (this.scene) {
      while (this.scene.children.length > 0) {
        this.scene.remove(this.scene.children[0])
      }
    }
  }
}
