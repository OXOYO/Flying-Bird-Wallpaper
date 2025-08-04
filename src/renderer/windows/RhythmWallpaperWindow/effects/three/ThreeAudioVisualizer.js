import { ThreeBase } from './ThreeBase.js'
import * as THREE from 'three'

export class ThreeAudioVisualizer extends ThreeBase {
  constructor(container, config) {
    super(container, config)
    this.bars = []
    this.particles = []
    this.rings = []
    this.barCount = 64
    this.particleCount = 100
    this.ringCount = 5
  }

  initScene() {
    // 创建柱状频谱
    this.createBars()

    // 创建粒子系统
    this.createParticles()

    // 创建环形
    this.createRings()

    // 添加光源
    this.addLights()
  }

  createBars() {
    const barWidth = 0.05
    const barSpacing = 0.08
    const startX = (-(this.barCount - 1) * barSpacing) / 2

    for (let i = 0; i < this.barCount; i++) {
      const geometry = new THREE.BoxGeometry(barWidth, 0.1, barWidth)
      const material = new THREE.MeshPhongMaterial({
        color: this.hexToNumber(this.getColor('loop', i)),
        transparent: true,
        opacity: 0.8,
        shininess: 100
      })
      const bar = new THREE.Mesh(geometry, material)

      bar.position.x = startX + i * barSpacing
      bar.position.y = 0
      bar.position.z = 0

      this.bars.push(bar)
      this.scene.add(bar)
    }
  }

  createParticles() {
    // 安全检查
    if (!this.particles) {
      this.particles = []
    }

    const geometry = new THREE.BufferGeometry()
    const positions = new Float32Array(this.particleCount * 3)
    const colors = new Float32Array(this.particleCount * 3)
    const sizes = new Float32Array(this.particleCount)

    for (let i = 0; i < this.particleCount; i++) {
      // 随机位置在球体表面
      const theta = Math.random() * Math.PI * 2
      const phi = Math.acos(Math.random() * 2 - 1)
      const radius = 3 + Math.random() * 2

      positions[i * 3] = radius * Math.sin(phi) * Math.cos(theta)
      positions[i * 3 + 1] = radius * Math.sin(phi) * Math.sin(theta)
      positions[i * 3 + 2] = radius * Math.cos(phi)

      // 随机颜色
      const color = this.getColor('random')
      const rgb = this.hexToRgb(color)
      colors[i * 3] = rgb.r
      colors[i * 3 + 1] = rgb.g
      colors[i * 3 + 2] = rgb.b

      sizes[i] = Math.random() * 0.1 + 0.05
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3))
    geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1))

    const material = new THREE.PointsMaterial({
      size: 0.1,
      vertexColors: true,
      transparent: true,
      opacity: 0.6,
      blending: THREE.AdditiveBlending
    })

    const particleSystem = new THREE.Points(geometry, material)
    this.particles.push(particleSystem)
    this.scene.add(particleSystem)
  }

  createRings() {
    for (let i = 0; i < this.ringCount; i++) {
      const ringGeometry = new THREE.RingGeometry(2 + i * 0.5, 2.2 + i * 0.5, 64)
      const ringMaterial = new THREE.MeshBasicMaterial({
        color: this.hexToNumber(this.getColor('loop', i)),
        transparent: true,
        opacity: 0.2,
        side: THREE.DoubleSide
      })

      const ring = new THREE.Mesh(ringGeometry, ringMaterial)
      ring.rotation.x = Math.PI / 2
      ring.position.z = -i * 0.5
      this.rings.push(ring)
      this.scene.add(ring)
    }
  }

  addLights() {
    // 环境光
    const ambientLight = new THREE.AmbientLight(0x404040, 0.4)
    this.scene.add(ambientLight)

    // 点光源
    const pointLight = new THREE.PointLight(0xffffff, 1, 100)
    pointLight.position.set(5, 5, 5)
    this.scene.add(pointLight)

    // 方向光
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8)
    directionalLight.position.set(0, 1, 1)
    this.scene.add(directionalLight)

    // 聚光灯
    const spotLight = new THREE.SpotLight(0xffffff, 0.5, 100, Math.PI / 4, 0.5)
    spotLight.position.set(0, 10, 0)
    spotLight.target.position.set(0, 0, 0)
    this.scene.add(spotLight)
    this.scene.add(spotLight.target)
  }

  render(data) {
    // 安全检查
    if (!this.bars || !this.particles || !this.rings) {
      console.warn('ThreeAudioVisualizer: Components not initialized')
      return
    }

    const mappedData = this.getMappedValues(data)
    const reducedData = this.getReducedValues(mappedData, this.barCount, 'max')
    const averageValue = reducedData.reduce((a, b) => a + b, 0) / reducedData.length
    const time = Date.now() * 0.001

    // 更新柱状频谱
    this.bars.forEach((bar, index) => {
      const value = reducedData[index] || 0
      const height = 0.1 + value * 4

      bar.scale.y = height / 0.1
      bar.position.y = height / 2

      // 颜色变化
      const color = this.getColor('loop', index)
      bar.material.color.setHex(this.hexToNumber(color))

      // 旋转效果
      bar.rotation.y += 0.02 + value * 0.01
      bar.rotation.z += 0.01 + value * 0.005
    })

    // 更新粒子系统
    this.particles.forEach((particleSystem, systemIndex) => {
      if (!particleSystem || !particleSystem.geometry || !particleSystem.geometry.attributes) {
        return
      }

      const positions = particleSystem.geometry.attributes.position.array
      const sizes = particleSystem.geometry.attributes.size.array

      for (let i = 0; i < this.particleCount; i++) {
        const index = i % reducedData.length
        const value = reducedData[index] || 0

        // 粒子位置波动
        const x = positions[i * 3]
        const y = positions[i * 3 + 1]
        const z = positions[i * 3 + 2]

        positions[i * 3] += Math.sin(time + i * 0.1) * 0.01 * value
        positions[i * 3 + 1] += Math.cos(time + i * 0.1) * 0.01 * value
        positions[i * 3 + 2] += Math.sin(time * 0.5 + i * 0.05) * 0.005 * value

        // 更新粒子大小
        sizes[i] = (0.05 + value * 0.3) * (1 + averageValue * 0.5)
      }

      particleSystem.geometry.attributes.position.needsUpdate = true
      particleSystem.geometry.attributes.size.needsUpdate = true

      // 整体旋转
      particleSystem.rotation.y += 0.005
      particleSystem.rotation.x += 0.002
    })

    // 更新环形
    this.rings.forEach((ring, index) => {
      const value = reducedData[index % reducedData.length] || 0

      ring.scale.setScalar(1 + value * 0.5)
      ring.rotation.z += 0.01 + value * 0.02
      ring.rotation.y += 0.005 + value * 0.01

      // 颜色和透明度
      const color = this.getColor('loop', index)
      ring.material.color.setHex(this.hexToNumber(color))
      ring.material.opacity = 0.1 + value * 0.3
    })

    super.render(data)
  }
}
