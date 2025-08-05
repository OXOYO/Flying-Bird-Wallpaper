import EffectBase from './EffectBase.js'
import { colorList } from '@common/publicData.js'
import * as THREE from 'three'

export default class ThreeBase extends EffectBase {
  constructor(container, config) {
    super(container, config)
    // 初始化three
    this.scene = null
    this.camera = null
    this.renderer = null
    this.initThree()
  }

  initThree() {
    try {
      const { width, height, x = 0, y = 0 } = this.bodySize

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

      // 调试用红色边框，显示 bodySize 区域
      if (this.config.debug) {
        this.renderer.domElement.style.border = '2px solid red'
      }

      // 设置渲染器 DOM 的绝对定位，实现偏移
      this.renderer.domElement.style.position = 'absolute'
      this.renderer.domElement.style.left = `${x - width / 2}px`
      this.renderer.domElement.style.top = `${y - height / 2}px`

      // 将渲染器添加到容器
      if (this.container) {
        this.container.appendChild(this.renderer.domElement)
        console.log('ThreeBase: Canvas added to container')
      }
    } catch (error) {
      console.error('ThreeBase: Error during initialization:', error)
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

  render(dataArray) {
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
