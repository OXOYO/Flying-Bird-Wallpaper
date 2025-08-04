import { ThreeBase } from './ThreeBase.js'
import * as THREE from 'three'

export class ThreeBar extends ThreeBase {
  constructor(leafer, config) {
    super(leafer, config)
    this.bars = []
    this.barCount = 32
  }

  initScene() {
    // 创建条形几何体
    const barWidth = 0.1
    const barSpacing = 0.15
    const startX = (-(this.barCount - 1) * barSpacing) / 2

    for (let i = 0; i < this.barCount; i++) {
      const geometry = new THREE.BoxGeometry(barWidth, 0.1, barWidth)
      const material = new THREE.MeshBasicMaterial({
        color: this.getColor('loop', i),
        transparent: true,
        opacity: 0.8
      })
      const bar = new THREE.Mesh(geometry, material)

      bar.position.x = startX + i * barSpacing
      bar.position.y = 0
      bar.position.z = 0

      this.bars.push(bar)
      this.scene.add(bar)
    }

    // 添加环境光
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6)
    this.scene.add(ambientLight)

    // 添加点光源
    const pointLight = new THREE.PointLight(0xffffff, 1, 100)
    pointLight.position.set(0, 5, 5)
    this.scene.add(pointLight)
  }

  render(data) {
    const mappedData = this.getMappedValues(data)
    const reducedData = this.getReducedValues(mappedData, this.barCount, 'max')

    this.bars.forEach((bar, index) => {
      const value = reducedData[index] || 0
      const height = 0.1 + value * 3 // 最小高度0.1，最大高度3.1

      // 更新条形高度
      bar.scale.y = height / 0.1

      // 更新颜色
      const color = this.getColor('loop', index)
      bar.material.color.setHex(color)

      // 添加旋转效果
      bar.rotation.y += 0.02
      bar.rotation.z += 0.01
    })

    super.render(data)
  }
}
