import { ThreeBase } from './ThreeBase.js'
import * as THREE from 'three'

export class ThreeSphere extends ThreeBase {
  constructor(leafer, config) {
    super(leafer, config)
    this.sphere = null
    this.sphereGeometry = null
    this.sphereMaterial = null
    this.rings = []
    this.ringCount = 8
  }

  initScene() {
    // 创建主球体
    this.sphereGeometry = new THREE.SphereGeometry(1, 32, 32)
    this.sphereMaterial = new THREE.MeshPhongMaterial({
      color: this.getColor('single', 0),
      transparent: true,
      opacity: 0.8,
      wireframe: false
    })

    this.sphere = new THREE.Mesh(this.sphereGeometry, this.sphereMaterial)
    this.scene.add(this.sphere)

    // 创建环形
    for (let i = 0; i < this.ringCount; i++) {
      const ringGeometry = new THREE.RingGeometry(1.2 + i * 0.3, 1.5 + i * 0.3, 32)
      const ringMaterial = new THREE.MeshBasicMaterial({
        color: this.getColor('loop', i),
        transparent: true,
        opacity: 0.3,
        side: THREE.DoubleSide
      })

      const ring = new THREE.Mesh(ringGeometry, ringMaterial)
      ring.rotation.x = Math.PI / 2
      this.rings.push(ring)
      this.scene.add(ring)
    }

    // 添加环境光
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.4)
    this.scene.add(ambientLight)

    // 添加点光源
    const pointLight = new THREE.PointLight(0xffffff, 1, 100)
    pointLight.position.set(5, 5, 5)
    this.scene.add(pointLight)

    // 添加方向光
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8)
    directionalLight.position.set(0, 1, 1)
    this.scene.add(directionalLight)
  }

  render(data) {
    const mappedData = this.getMappedValues(data)
    const reducedData = this.getReducedValues(mappedData, this.ringCount, 'max')
    const averageValue = reducedData.reduce((a, b) => a + b, 0) / reducedData.length

    const time = Date.now() * 0.001

    // 更新球体
    this.sphere.scale.setScalar(1 + averageValue * 0.5)
    this.sphere.rotation.y += 0.02
    this.sphere.rotation.x += 0.01

    // 更新球体颜色
    const sphereColor = this.getColor('random')
    this.sphere.material.color.setHex(sphereColor)

    // 更新环形
    this.rings.forEach((ring, index) => {
      const value = reducedData[index] || 0

      // 缩放环形
      ring.scale.setScalar(1 + value * 0.3)

      // 旋转环形
      ring.rotation.z += 0.01 + value * 0.02
      ring.rotation.y += 0.005 + value * 0.01

      // 更新颜色
      const color = this.getColor('loop', index)
      ring.material.color.setHex(color)

      // 更新透明度
      ring.material.opacity = 0.2 + value * 0.4
    })

    super.render(data)
  }
}
