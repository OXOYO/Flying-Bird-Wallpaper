import { ThreeBase } from './ThreeBase.js'
import * as THREE from 'three'

export class ThreeParticle extends ThreeBase {
  constructor(leafer, config) {
    super(leafer, config)
    this.particles = []
    this.particleCount = 200
    this.particleSystem = null
  }

  initScene() {
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

    // 添加环境光
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6)
    this.scene.add(ambientLight)
  }

  render(data) {
    const mappedData = this.getMappedValues(data)
    const reducedData = this.getReducedValues(mappedData, 16, 'max')
    const averageValue = reducedData.reduce((a, b) => a + b, 0) / reducedData.length

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
      positions[i * 3] += Math.sin(time + i * 0.1) * 0.01 * value
      positions[i * 3 + 1] += Math.cos(time + i * 0.1) * 0.01 * value
      positions[i * 3 + 2] += Math.sin(time * 0.5 + i * 0.05) * 0.005 * value

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
      sizes[i] = (0.05 + value * 0.2) * (1 + averageValue * 0.5)
    }
    this.particleSystem.geometry.attributes.size.needsUpdate = true

    // 整体旋转
    this.particleSystem.rotation.y += 0.005
    this.particleSystem.rotation.x += 0.002

    super.render(data)
  }
}
