import { ThreeBase } from './ThreeBase.js'
import * as THREE from 'three'

export class ThreeWave extends ThreeBase {
  constructor(container, config) {
    super(container, config)
    this.waveGeometry = null
    this.waveMaterial = null
    this.waveMesh = null
    this.points = []
    this.segments = 128
    this.initialized = false
  }

  initScene() {
    try {
      // 清空现有内容
      while (this.scene.children.length > 0) {
        this.scene.remove(this.scene.children[0])
      }

      // 设置相机位置
      this.camera.position.z = 10

      // 创建波形几何体
      this.waveGeometry = new THREE.PlaneGeometry(8, 4, this.segments, 1)
      this.waveMaterial = new THREE.MeshPhongMaterial({
        color: this.hexToNumber(this.getColor('single', 0)),
        transparent: true,
        opacity: 0.8,
        side: THREE.DoubleSide,
        shininess: 200,
        emissive: 0x00ff00,
        emissiveIntensity: 0.2
      })

      this.waveMesh = new THREE.Mesh(this.waveGeometry, this.waveMaterial)
      this.scene.add(this.waveMesh)

      // 添加更强的光照
      const ambientLight = new THREE.AmbientLight(0xffffff, 0.4)
      this.scene.add(ambientLight)

      const directionalLight = new THREE.DirectionalLight(0xffffff, 1.0)
      directionalLight.position.set(0, 1, 1)
      this.scene.add(directionalLight)

      // 添加动态点光源
      this.pointLight = new THREE.PointLight(0x00ff88, 1, 20)
      this.pointLight.position.set(0, 5, 10)
      this.scene.add(this.pointLight)

      this.initialized = true
    } catch (error) {
      console.error('ThreeWave: Error initializing scene:', error)
      this.initialized = false
    }
  }

  render(data) {
    // 安全检查
    if (
      !this.initialized ||
      !this.waveGeometry ||
      !this.waveGeometry.attributes ||
      !this.waveGeometry.attributes.position
    ) {
      // 尝试重新初始化
      if (!this.initialized && this.scene) {
        this.initScene()
      }
      return
    }

    try {
      const mappedData = this.getMappedValues(data)
      const reducedData = this.getReducedValues(mappedData, this.segments + 1, 'max')

      // 计算总体音频强度
      const totalIntensity = reducedData.reduce((sum, val) => sum + val, 0) / reducedData.length

      // 动态相机移动
      this.camera.position.x = Math.sin(Date.now() * 0.001) * 1.5
      this.camera.position.y = Math.cos(Date.now() * 0.0008) * 0.5
      this.camera.lookAt(0, 0, 0)

      // 动态点光源
      if (this.pointLight) {
        this.pointLight.position.x = Math.sin(Date.now() * 0.002) * 8
        this.pointLight.position.y = Math.cos(Date.now() * 0.0015) * 4
        this.pointLight.intensity = 0.5 + totalIntensity * 2
      }

      const positions = this.waveGeometry.attributes.position.array
      const time = Date.now() * 0.001

      for (let i = 0; i <= this.segments; i++) {
        const x = (i / this.segments - 0.5) * 8
        const value = reducedData[i] || 0
        const waveHeight = value * 3

        // 添加正弦波效果
        const sineWave = Math.sin(x * 2 + time * 2) * 0.5
        const y = waveHeight + sineWave

        // 更新顶点位置
        positions[i * 3 + 1] = y
      }

      this.waveGeometry.attributes.position.needsUpdate = true
      this.waveGeometry.computeVertexNormals()

      // 更新颜色 - 使用config.colors实现渐变效果
      const intensity = Math.min(1, totalIntensity)
      const colorIndex = Math.floor(intensity * (this.config.colors.length - 1))
      const nextColorIndex = Math.min(colorIndex + 1, this.config.colors.length - 1)
      const colorProgress = intensity * (this.config.colors.length - 1) - colorIndex

      // 获取当前颜色和下一个颜色
      const currentColor = this.config.colors[colorIndex] || this.config.colors[0]
      const nextColor = this.config.colors[nextColorIndex] || this.config.colors[0]

      // 插值计算最终颜色
      const currentRgb = this.hexToRgb(currentColor)
      const nextRgb = this.hexToRgb(nextColor)

      const finalR = currentRgb.r + (nextRgb.r - currentRgb.r) * colorProgress
      const finalG = currentRgb.g + (nextRgb.g - currentRgb.g) * colorProgress
      const finalB = currentRgb.b + (nextRgb.b - currentRgb.b) * colorProgress

      const color = new THREE.Color(finalR, finalG, finalB)
      this.waveMaterial.color.copy(color)

      // 动态发光效果
      this.waveMaterial.emissive.copy(color)
      this.waveMaterial.emissiveIntensity = intensity * 0.5

      // 添加旋转效果
      this.waveMesh.rotation.x = Math.sin(time * 0.5) * 0.1
      this.waveMesh.rotation.y += 0.01
      this.waveMesh.rotation.z = Math.sin(time * 0.3) * 0.05

      super.render(data)
    } catch (error) {
      console.error('ThreeWave: Error in render:', error)
    }
  }
}
