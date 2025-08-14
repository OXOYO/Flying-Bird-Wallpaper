import EffectBase from './EffectBase.js'
import { colorList } from '@common/publicData.js'
import * as THREE from 'three'
import Stats from 'three/examples/jsm/libs/stats.module.js'

export default class ThreeBase extends EffectBase {
  constructor(container, config) {
    super(container, config)
    // 初始化three
    this.scene = null
    this.camera = null
    this.renderer = null
    this.stats = null
    this.initThree()
  }

  initThree() {
    try {
      const { width, height, depth, x, y } = this.bodySize

      // 创建场景
      this.scene = new THREE.Scene()

      // 创建相机
      // 根据box尺寸计算合适的FOV，确保能看到完整的盒子
      const maxDimension = Math.max(width, height, depth)
      const distance = maxDimension / (2 * Math.tan(Math.PI / 6)) // 60度FOV
      this.camera = new THREE.PerspectiveCamera(60, width / height, 0.1, distance * 2)
      this.camera.position.z = distance
      this.camera.lookAt(0, 0, 0)

      // 添加光照
      const ambientLight = new THREE.AmbientLight(0xffffff, 0.4)
      this.scene.add(ambientLight)

      const directionalLight = new THREE.DirectionalLight(0xffffff, 1.0)
      directionalLight.position.set(2, 2, 2)
      this.scene.add(directionalLight)

      // 创建立方体
      const boxGeometry = new THREE.BoxGeometry(width, height, depth)

      // 为立方体的每个面创建不同的材质，前面保持透明
      const boxMaterials = [
        new THREE.MeshPhongMaterial({
          color: 0xffffff,
          transparent: true,
          opacity: 0.6,
          side: THREE.BackSide
        }), // 右面
        new THREE.MeshPhongMaterial({
          color: 0xffffff,
          transparent: true,
          opacity: 0.6,
          side: THREE.BackSide
        }), // 左面
        new THREE.MeshPhongMaterial({
          color: 0xffffff,
          transparent: true,
          opacity: 0.6,
          side: THREE.BackSide
        }), // 上面
        new THREE.MeshPhongMaterial({
          color: 0xffffff,
          transparent: true,
          opacity: 0.6,
          side: THREE.BackSide
        }), // 下面
        new THREE.MeshPhongMaterial({
          color: 0xffffff,
          transparent: true,
          opacity: 0.0,
          side: THREE.DoubleSide,
          depthWrite: false // 禁用深度写入
        }), // 前面 - 完全透明
        new THREE.MeshPhongMaterial({
          color: 0xffffff,
          transparent: true,
          opacity: 0.2,
          side: THREE.BackSide
        }) // 后面
      ]

      // 添加实体网格
      const boxMesh = new THREE.Mesh(boxGeometry, boxMaterials)
      boxMesh.receiveShadow = true // 接收阴影
      const tank = new THREE.Object3D()
      tank.add(boxMesh)

      // 创建边框线
      const boxEdges = new THREE.EdgesGeometry(boxGeometry)
      const boxLines = new THREE.LineSegments(
        boxEdges,
        new THREE.LineBasicMaterial({ color: 0x000000 })
      )
      tank.add(boxLines)
      this.scene.add(tank)

      // 创建渲染器
      this.renderer = new THREE.WebGLRenderer({
        alpha: true,
        antialias: true,
        preserveDrawingBuffer: false
      })
      // 启用阴影映射
      this.renderer.shadowMap.enabled = true
      this.renderer.shadowMap.type = THREE.PCFSoftShadowMap
      this.renderer.setSize(width, height)
      this.renderer.setClearColor(0x000000, 0) // 完全透明背景
      this.renderer.setPixelRatio(window.devicePixelRatio)

      // 调试用红色边框，显示 bodySize 区域
      if (this.config.debug) {
        this.renderer.domElement.style.border = '2px solid red'
        // 初始化性能监控
        this.stats = new Stats()
        this.stats.showPanel(0) // 0: fps, 1: ms, 2: mb
        this.stats.dom.style.position = 'absolute'
        this.stats.dom.style.top = '50px'
        this.stats.dom.style.left = '50px'
      }

      // 设置渲染器 DOM 的绝对定位，实现偏移
      this.renderer.domElement.style.position = 'absolute'
      this.renderer.domElement.style.left = `${x - width / 2}px`
      this.renderer.domElement.style.top = `${y - height / 2}px`

      // 将渲染器添加到容器
      if (this.container) {
        this.container.appendChild(this.renderer.domElement)
        // 调试用，将性能监控添加到容器
        if (this.stats) {
          this.container.appendChild(this.stats.dom)
        }
        console.log('ThreeBase: Canvas added to container')
      }
    } catch (error) {
      console.error('ThreeBase: Error during initialization:', error)
    }
  }

  getColor(type = 'single', index = 0) {
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

  render() {
    try {
      // 更新性能监控
      if (this.stats) {
        this.stats.begin()
      }

      if (this.renderer && this.scene && this.camera) {
        this.renderer.render(this.scene, this.camera)
      }

      // 更新性能监控
      if (this.stats) {
        this.stats.end()
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
      // 移除性能监控
      if (this.stats && this.stats.dom) {
        this.container.removeChild(this.stats.dom)
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
