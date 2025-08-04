import { ThreeBase } from './ThreeBase.js'
import * as THREE from 'three'

export class ThreeParticle extends ThreeBase {
  constructor(container, config) {
    super(container, config)
    this.particles = []
    this.particleCount = 200
    this.particleSystem = null
  }

  initScene() {
    try {
      // 清空现有内容
      while (this.scene.children.length > 0) {
        this.scene.remove(this.scene.children[0])
      }

      // 设置相机位置
      this.camera.position.z = 15

      // 创建粒子几何体
      const geometry = new THREE.BufferGeometry()
      const positions = new Float32Array(this.particleCount * 3)
      const colors = new Float32Array(this.particleCount * 3)
      const sizes = new Float32Array(this.particleCount)

      for (let i = 0; i < this.particleCount; i++) {
        // 随机位置
        positions[i * 3] = (Math.random() - 0.5) * 10
        positions[i * 3 + 1] = (Math.random() - 0.5) * 10
        positions[i * 3 + 2] = (Math.random() - 0.5) * 10

        // 随机颜色
        const color = this.getColor('random')
        const rgb = this.hexToRgb(color)
        colors[i * 3] = rgb.r
        colors[i * 3 + 1] = rgb.g
        colors[i * 3 + 2] = rgb.b

        // 随机大小
        sizes[i] = Math.random() * 0.1 + 0.05
      }

      geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
      geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3))
      geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1))

      // 创建粒子材质
      const material = new THREE.PointsMaterial({
        size: 0.1,
        vertexColors: true,
        transparent: true,
        opacity: 0.8,
        blending: THREE.AdditiveBlending
      })

      this.particleSystem = new THREE.Points(geometry, material)
      this.scene.add(this.particleSystem)

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
      console.error('ThreeParticle: Error initializing scene:', error)
    }
  }

  render(data) {
    // 安全检查
    if (
      !this.particleSystem ||
      !this.particleSystem.geometry ||
      !this.particleSystem.geometry.attributes
    ) {
      console.warn('ThreeParticle: Particle system or geometry not initialized')
      return
    }

    const mappedData = this.getMappedValues(data)
    const reducedData = this.getReducedValues(mappedData, 16, 'max')
    const averageValue = reducedData.reduce((a, b) => a + b, 0) / reducedData.length

    // 计算总体音频强度
    const totalIntensity = reducedData.reduce((sum, val) => sum + val, 0) / reducedData.length

    // 动态相机移动
    this.camera.position.x = Math.sin(Date.now() * 0.001) * 2
    this.camera.position.y = Math.cos(Date.now() * 0.0008) * 1
    this.camera.lookAt(0, 0, 0)

    // 动态点光源
    if (this.pointLight) {
      this.pointLight.position.x = Math.sin(Date.now() * 0.002) * 10
      this.pointLight.position.y = Math.cos(Date.now() * 0.0015) * 5
      this.pointLight.intensity = 0.5 + totalIntensity * 2
    }

    const positions = this.particleSystem.geometry.attributes.position.array
    const time = Date.now() * 0.001

    for (let i = 0; i < this.particleCount; i++) {
      const index = i % reducedData.length
      const value = reducedData[index] || 0

      // 根据音频数据更新粒子位置
      const x = positions[i * 3]
      const y = positions[i * 3 + 1]
      const z = positions[i * 3 + 2]

      // 添加波动效果
      positions[i * 3] += Math.sin(time + i * 0.1) * 0.02 * value
      positions[i * 3 + 1] += Math.cos(time + i * 0.1) * 0.02 * value
      positions[i * 3 + 2] += Math.sin(time * 0.5 + i * 0.05) * 0.01 * value

      // 限制粒子在边界内
      positions[i * 3] = Math.max(-5, Math.min(5, positions[i * 3]))
      positions[i * 3 + 1] = Math.max(-5, Math.min(5, positions[i * 3 + 1]))
      positions[i * 3 + 2] = Math.max(-5, Math.min(5, positions[i * 3 + 2]))
    }

    this.particleSystem.geometry.attributes.position.needsUpdate = true

    // 更新粒子大小
    const sizes = this.particleSystem.geometry.attributes.size.array
    for (let i = 0; i < this.particleCount; i++) {
      const index = i % reducedData.length
      const value = reducedData[index] || 0
      sizes[i] = (0.05 + value * 0.3) * (1 + averageValue * 0.8)
    }
    this.particleSystem.geometry.attributes.size.needsUpdate = true

    // 整体旋转
    this.particleSystem.rotation.y += 0.01
    this.particleSystem.rotation.x += 0.005
    this.particleSystem.rotation.z += 0.003

    super.render(data)
  }
}
