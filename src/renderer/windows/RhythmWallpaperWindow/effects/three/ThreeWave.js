import { ThreeBase } from './ThreeBase.js'
import * as THREE from 'three'

export class ThreeWave extends ThreeBase {
  constructor(leafer, config) {
    super(leafer, config)
    this.waveGeometry = null
    this.waveMaterial = null
    this.waveMesh = null
    this.points = []
    this.segments = 128
  }

  initScene() {
    // 创建波形几何体
    this.waveGeometry = new THREE.PlaneGeometry(8, 4, this.segments, 1)
    this.waveMaterial = new THREE.MeshBasicMaterial({
      color: this.getColor('single', 0),
      transparent: true,
      opacity: 0.7,
      side: THREE.DoubleSide,
      wireframe: false
    })

    this.waveMesh = new THREE.Mesh(this.waveGeometry, this.waveMaterial)
    this.scene.add(this.waveMesh)

    // 添加环境光
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6)
    this.scene.add(ambientLight)

    // 添加方向光
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8)
    directionalLight.position.set(0, 1, 1)
    this.scene.add(directionalLight)
  }

  render(data) {
    const mappedData = this.getMappedValues(data)
    const reducedData = this.getReducedValues(mappedData, this.segments + 1, 'max')

    const positions = this.waveGeometry.attributes.position.array
    const time = Date.now() * 0.001

    for (let i = 0; i <= this.segments; i++) {
      const x = (i / this.segments - 0.5) * 8
      const value = reducedData[i] || 0
      const waveHeight = value * 2

      // 添加正弦波效果
      const sineWave = Math.sin(x * 2 + time * 2) * 0.5
      const y = waveHeight + sineWave

      // 更新顶点位置
      positions[i * 3 + 1] = y
    }

    this.waveGeometry.attributes.position.needsUpdate = true
    this.waveGeometry.computeVertexNormals()

    // 更新颜色
    const color = this.getColor('random')
    this.waveMaterial.color.setHex(color)

    // 添加旋转效果
    this.waveMesh.rotation.x = Math.sin(time * 0.5) * 0.1
    this.waveMesh.rotation.y += 0.01

    super.render(data)
  }
}
