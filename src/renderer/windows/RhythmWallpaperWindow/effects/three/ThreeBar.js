import { ThreeBase } from './ThreeBase.js'
import * as THREE from 'three'

export class ThreeBar extends ThreeBase {
  constructor(container, config) {
    super(container, config)
    this.bars = []
    this.barCount = 32
    this.initialized = false

    // 在构造函数完成后初始化场景
    this.initScene()
  }

  initScene() {
    try {
      // 清空现有内容
      while (this.scene.children.length > 0) {
        this.scene.remove(this.scene.children[0])
      }
      this.bars = []

      // 设置相机位置 - 更远一些
      this.camera.position.z = 15

      // 添加更强的光照以增强3D效果
      const ambientLight = new THREE.AmbientLight(0xffffff, 0.4)
      this.scene.add(ambientLight)

      const directionalLight = new THREE.DirectionalLight(0xffffff, 1.0)
      directionalLight.position.set(10, 10, 5)
      this.scene.add(directionalLight)

      // 添加点光源创造动态光照
      this.pointLight = new THREE.PointLight(0x00ff88, 1, 20)
      this.pointLight.position.set(0, 5, 10)
      this.scene.add(this.pointLight)

      // 创建条形 - 增加大小和间距
      const barWidth = 0.4
      const barSpacing = 0.6
      const startX = (-(this.barCount - 1) * barSpacing) / 2

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

        // 设置位置 - 垂直排列
        bar.position.x = startX + i * barSpacing
        bar.position.y = 0
        bar.position.z = 0

        // 存储原始高度用于缩放计算
        bar.userData.originalHeight = 0.5
        bar.userData.index = i

        // 添加到数组和场景
        this.bars.push(bar)
        this.scene.add(bar)
      }

      this.initialized = true

      // 立即渲染一次
      this.render([])
    } catch (error) {
      console.error('ThreeBar: Error initializing scene:', error)
      this.initialized = false
    }
  }

  animate() {
    // 移除自己的动画循环，让外部控制
    // 这个方法现在只用于兼容性
  }

  render(data) {
    if (!this.initialized || !this.bars || this.bars.length === 0) {
      return
    }

    try {
      // 处理音频数据
      const mappedData = this.getMappedValues(data)
      const reducedData = this.getReducedValues(mappedData, this.barCount, 'max')

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

      // 更新每个条形
      this.bars.forEach((bar, index) => {
        if (!bar || !bar.geometry || !bar.material) {
          return
        }

        const value = reducedData[index] || 0
        const originalHeight = bar.userData.originalHeight || 0.5

        // 计算新高度 - 让变化更明显
        const newHeight = originalHeight + value * 15

        // 更新缩放
        bar.scale.y = newHeight / originalHeight

        // 更新颜色 - 使用config.colors实现渐变效果
        const intensity = Math.min(1, value)
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
        bar.material.color.copy(color)

        // 动态发光效果
        bar.material.emissive.copy(color)
        bar.material.emissiveIntensity = intensity * 0.5

        // 动态位置变化
        bar.position.z = value * 2
        bar.position.y = value * 0.5

        // 添加轻微的摆动效果
        const time = Date.now() * 0.001
        bar.rotation.z = Math.sin(time + index * 0.2) * 0.1 * intensity
        bar.rotation.x = Math.cos(time + index * 0.3) * 0.05 * intensity
      })

      // 调用父类的render方法进行实际渲染
      super.render(data)
    } catch (error) {
      console.error('ThreeBar: Error in render:', error)
    }
  }
}
