import ThreeBase from '../base/ThreeBase.js'
// import * as THREE from 'three'
// import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'

export class ThreeBar extends ThreeBase {
  constructor(container, config) {
    super(container, config)

    this.init()
  }

  init() {
    // 计算当前相机下的可见宽度
    const fov = (this.camera.fov * Math.PI) / 180
    const aspect = this.camera.aspect
    const z = Math.abs(this.camera.position.z)
    const visibleWidth = 2 * z * Math.tan(fov / 2) * aspect

    const maxBarSpan = visibleWidth * 0.8 // 使用80%的可见宽度
    const adjustedSpacing = maxBarSpan / (this.barCount - 1)
    const startX = -maxBarSpan / 2

    for (let i = 0; i < this.barCount; i++) {
      // 创建几何体 - 增加初始高度
      const geometry = new THREE.BoxGeometry(barWidth, 0.5, barWidth)

      // 创建发光材质
      const material = new THREE.MeshPhongMaterial({
        color: 0x00ff00,
        transparent: true,
        opacity: 0.9,
        shininess: 200,
        emissive: 0x00ff00,
        emissiveIntensity: 0.2
      })

      // 创建网格
      const bar = new THREE.Mesh(geometry, material)

      // 设置位置 - 基于相机可见宽度均匀分布
      bar.position.x = startX + i * adjustedSpacing
      bar.position.y = 0
      bar.position.z = 0

      // 存储原始高度用于缩放计算
      bar.userData.originalHeight = 0.5
      bar.userData.index = i

      // 添加到数组和场景
      this.bars.push(bar)
      this.scene.add(bar)
    }
  }

  render(dataArray) {
    try {
      // === 更新柱子的高度 ===
      const bar = this.scene.getObjectByName('bar')
      if (bar && dataArray) {
        // 获取音频数据并映射到合适范围
        const mappedValues = this.getMappedValues(this.getReducedValues(dataArray, 1))
        const value = mappedValues[0] || 0

        // 添加平滑过渡效果
        const targetScaleY = 1 + value * 10
        bar.scale.y += (targetScaleY - bar.scale.y) * 0.1 // 0.1为插值系数，可根据需要调整
      }

      // 调用父类渲染方法
      super.render(dataArray)
    } catch (error) {
      console.error('ThreeBar: Error in render:', error)
    }
  }
}
