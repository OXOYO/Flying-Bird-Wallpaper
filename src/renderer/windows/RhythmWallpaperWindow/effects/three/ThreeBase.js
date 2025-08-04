import { colorList } from '../../../../../common/publicData.js'
import * as THREE from 'three'

export class ThreeBase {
  constructor(container, config) {
    this.container = container
    this.config = config
    this.scene = null
    this.camera = null
    this.renderer = null
    this.bodySize = this.getBodySize()
    this.initThree()
    this.initScene()
  }

  initThree() {
    try {
      const { width, height } = this.bodySize

      // 创建场景
      this.scene = new THREE.Scene()

      // 创建相机
      this.camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000)
      this.camera.position.z = 10 // 设置默认相机位置

      // 创建渲染器
      this.renderer = new THREE.WebGLRenderer({
        alpha: true,
        antialias: true,
        preserveDrawingBuffer: false
      })
      this.renderer.setSize(width, height)
      this.renderer.setClearColor(0x000000, 0) // 完全透明背景
      this.renderer.setPixelRatio(window.devicePixelRatio)

      // 将渲染器添加到容器
      if (this.container) {
        this.container.appendChild(this.renderer.domElement)
        console.log('ThreeBase: Canvas added to container')
      }
    } catch (error) {
      console.error('ThreeBase: Error during initialization:', error)
    }
  }

  initScene() {
    // 子类实现具体场景初始化
  }

  getBodySize() {
    try {
      if (!this.container) {
        console.warn('ThreeBase: Container not found')
        return { width: 100, height: 100, x: 0, y: 0 }
      }

      const rect = this.container.getBoundingClientRect()
      console.log('ThreeBase: Container rect:', rect)

      // 如果容器尺寸为0，使用默认值
      if (rect.width === 0 || rect.height === 0) {
        console.warn('ThreeBase: Container has zero size, using default values')
        return { width: 100, height: 100, x: 0, y: 0 }
      }

      const bodyWidth = rect.width * (this.config.widthRatio || 1)
      const bodyHeight = rect.height * (this.config.heightRatio || 1)
      const { x, y } = this.getPosition(rect.width, rect.height, bodyWidth, bodyHeight)

      const result = {
        width: bodyWidth,
        height: bodyHeight,
        x,
        y
      }

      console.log('ThreeBase: Body size calculated:', result)
      return result
    } catch (error) {
      console.error('ThreeBase: Error getting body size:', error)
      return { width: 100, height: 100, x: 0, y: 0 }
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
    try {
      if (!list || !Array.isArray(list) || list.length === 0) {
        return new Array(count).fill(0)
      }

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
    } catch (error) {
      console.error('ThreeBase: Error in getReducedValues:', error)
      return new Array(count).fill(0)
    }
  }

  // 数据归一化
  getMappedValues(list) {
    try {
      if (!list || (!Array.isArray(list) && !(list instanceof Uint8Array))) {
        return []
      }

      const ret = []
      for (let i = 0; i < list.length; i++) {
        ret[i] = this.getMappedValue(list[i])
      }
      return ret
    } catch (error) {
      console.error('ThreeBase: Error in getMappedValues:', error)
      return []
    }
  }

  // 数据归一化
  getMappedValue(value) {
    try {
      if (typeof value !== 'number' || isNaN(value)) {
        return 0
      }

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
    } catch (error) {
      console.error('ThreeBase: Error in getMappedValue:', error)
      return 0
    }
  }

  getColor(type = 'linear', index = 0) {
    try {
      const colors = this.config?.colors || colorList

      if (!colors || !Array.isArray(colors) || colors.length === 0) {
        console.warn('ThreeBase: Invalid colors array, using default color')
        return '#ffffff'
      }

      if (type === 'random') {
        return colors[Math.floor(Math.random() * colors.length)]
      } else if (type === 'loop') {
        return colors[index % colors.length]
      } else if (type === 'single') {
        return colors[index] || colors[0]
      } else {
        return colors[index] || colors[0]
      }
    } catch (error) {
      console.error('ThreeBase: Error in getColor:', error)
      return '#ffffff'
    }
  }

  hexToRgb(hex) {
    try {
      const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
      return result
        ? {
            r: parseInt(result[1], 16) / 255,
            g: parseInt(result[2], 16) / 255,
            b: parseInt(result[3], 16) / 255
          }
        : { r: 1, g: 1, b: 1 }
    } catch (error) {
      console.error('ThreeBase: Error in hexToRgb:', error)
      return { r: 1, g: 1, b: 1 }
    }
  }

  hexToNumber(hex) {
    try {
      return parseInt(hex.replace('#', '0x'))
    } catch (error) {
      console.error('ThreeBase: Error in hexToNumber:', error)
      return 0xffffff
    }
  }

  render(data) {
    try {
      // 子类实现具体渲染逻辑
      if (this.renderer && this.scene && this.camera) {
        this.renderer.render(this.scene, this.camera)
      }
    } catch (error) {
      console.error('ThreeBase: Error in render:', error)
    }
  }

  destroy() {
    try {
      if (this.renderer) {
        this.renderer.dispose()
      }
      if (this.container && this.renderer && this.renderer.domElement) {
        this.container.removeChild(this.renderer.domElement)
      }
      // 清理场景中的所有对象
      if (this.scene) {
        while (this.scene.children.length > 0) {
          this.scene.remove(this.scene.children[0])
        }
      }
    } catch (error) {
      console.error('ThreeBase: Error in destroy:', error)
    }
  }
}
