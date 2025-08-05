import ThreeBase from '../base/ThreeBase.js'
import * as THREE from 'three'
import { hex2RGB, hex2Number } from '@renderer/utils/gen-color.js'

export class ThreeSphere extends ThreeBase {
  constructor(container, config) {
    super(container, config)
    this.sphere = null
    this.sphereGeometry = null
    this.sphereMaterial = null
    this.rings = []
    this.ringCount = 8

    this.initScene()
  }

  initScene() {
    try {
      // 清空现有内容
      while (this.scene.children.length > 0) {
        this.scene.remove(this.scene.children[0])
      }

      // 设置相机位置
      this.camera.position.z = 8

      // 创建主球体
      this.sphereGeometry = new THREE.SphereGeometry(1, 32, 32)
      this.sphereMaterial = new THREE.MeshPhongMaterial({
        color: hex2Number(this.getColor('single', 0)),
        transparent: true,
        opacity: 0.8,
        shininess: 200,
        emissive: 0x00ff00,
        emissiveIntensity: 0.2
      })

      this.sphere = new THREE.Mesh(this.sphereGeometry, this.sphereMaterial)
      this.scene.add(this.sphere)

      // 创建环形
      for (let i = 0; i < this.ringCount; i++) {
        const ringGeometry = new THREE.RingGeometry(1.2 + i * 0.3, 1.5 + i * 0.3, 32)
        const ringMaterial = new THREE.MeshPhongMaterial({
          color: hex2Number(this.getColor('loop', i)),
          transparent: true,
          opacity: 0.3,
          side: THREE.DoubleSide,
          shininess: 100,
          emissive: 0x00ff00,
          emissiveIntensity: 0.1
        })

        const ring = new THREE.Mesh(ringGeometry, ringMaterial)
        ring.rotation.x = Math.PI / 2
        this.rings.push(ring)
        this.scene.add(ring)
      }

      // 添加更强的光照
      const ambientLight = new THREE.AmbientLight(0xffffff, 0.4)
      this.scene.add(ambientLight)

      const directionalLight = new THREE.DirectionalLight(0xffffff, 1.0)
      directionalLight.position.set(10, 10, 5)
      this.scene.add(directionalLight)

      // 添加动态点光源
      this.pointLight = new THREE.PointLight(0x00ff88, 1, 20)
      this.pointLight.position.set(0, 5, 10)
      this.scene.add(this.pointLight)
    } catch (error) {
      console.error('ThreeSphere: Error initializing scene:', error)
    }
  }

  render(data) {
    // 安全检查
    if (!this.sphere || !this.sphere.scale) {
      console.warn('ThreeSphere: Sphere not initialized')
      return
    }

    const mappedData = this.getMappedValues(data)
    const reducedData = this.getReducedValues(mappedData, this.ringCount, 'max')
    const averageValue = reducedData.reduce((a, b) => a + b, 0) / reducedData.length

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

    const time = Date.now() * 0.001

    // 更新球体
    this.sphere.scale.setScalar(1 + averageValue * 0.8)
    this.sphere.rotation.y += 0.02
    this.sphere.rotation.x += 0.01
    this.sphere.rotation.z += 0.005

    // 更新球体颜色 - 使用config.colors实现渐变效果
    const intensity = Math.min(1, totalIntensity)
    const colorIndex = Math.floor(intensity * (this.config.colors.length - 1))
    const nextColorIndex = Math.min(colorIndex + 1, this.config.colors.length - 1)
    const colorProgress = intensity * (this.config.colors.length - 1) - colorIndex

    // 获取当前颜色和下一个颜色
    const currentColor = this.config.colors[colorIndex] || this.config.colors[0]
    const nextColor = this.config.colors[nextColorIndex] || this.config.colors[0]

    // 插值计算最终颜色
    const currentRgb = hex2RGB(currentColor, true)
    const nextRgb = hex2RGB(nextColor, true)

    const finalR = currentRgb.r + (nextRgb.r - currentRgb.r) * colorProgress
    const finalG = currentRgb.g + (nextRgb.g - currentRgb.g) * colorProgress
    const finalB = currentRgb.b + (nextRgb.b - currentRgb.b) * colorProgress

    const color = new THREE.Color(finalR, finalG, finalB)
    this.sphere.material.color.copy(color)

    // 动态发光效果
    this.sphere.material.emissive.copy(color)
    this.sphere.material.emissiveIntensity = intensity * 0.5

    // 更新环形
    this.rings.forEach((ring, index) => {
      const value = reducedData[index] || 0

      // 缩放环形
      ring.scale.setScalar(1 + value * 0.5)

      // 旋转环形
      ring.rotation.z += 0.01 + value * 0.02
      ring.rotation.y += 0.005 + value * 0.01
      ring.rotation.x += 0.003 + value * 0.005

      // 更新颜色
      const ringIntensity = Math.min(1, value)
      const ringColorIndex = Math.floor(ringIntensity * (this.config.colors.length - 1))
      const ringNextColorIndex = Math.min(ringColorIndex + 1, this.config.colors.length - 1)
      const ringColorProgress = ringIntensity * (this.config.colors.length - 1) - ringColorIndex

      const ringCurrentColor = this.config.colors[ringColorIndex] || this.config.colors[0]
      const ringNextColor = this.config.colors[ringNextColorIndex] || this.config.colors[0]

      const ringCurrentRgb = hex2RGB(ringCurrentColor, true)
      const ringNextRgb = hex2RGB(ringNextColor, true)

      const ringFinalR = ringCurrentRgb.r + (ringNextRgb.r - ringCurrentRgb.r) * ringColorProgress
      const ringFinalG = ringCurrentRgb.g + (ringNextRgb.g - ringCurrentRgb.g) * ringColorProgress
      const ringFinalB = ringCurrentRgb.b + (ringNextRgb.b - ringCurrentRgb.b) * ringColorProgress

      const ringColor = new THREE.Color(ringFinalR, ringFinalG, ringFinalB)
      ring.material.color.copy(ringColor)

      // 动态发光效果
      ring.material.emissive.copy(ringColor)
      ring.material.emissiveIntensity = ringIntensity * 0.3

      // 更新透明度
      ring.material.opacity = 0.2 + value * 0.6
    })

    super.render(data)
  }
}
