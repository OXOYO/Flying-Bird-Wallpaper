import ThreeBase from '../base/ThreeBase.js'
import * as THREE from 'three'
import { hex2RGB } from '@renderer/utils/gen-color.js'

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

      // 创建条形 - 基于相机可见宽度计算
      const barWidth = 0.4
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

      this.initialized = true
    } catch (error) {
      console.error('ThreeBar: Error initializing scene:', error)
      this.initialized = false
    }
  }

  render(dataArray) {
    if (!this.initialized || !this.bars || this.bars.length === 0) {
      return
    }

    try {
      // 处理音频数据
      const mappedValues = this.getMappedValues(this.getReducedValues(dataArray, this.barCount))

      // 计算总体音频强度
      const totalIntensity = mappedValues.reduce((sum, val) => sum + val, 0) / mappedValues.length

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

        const value = mappedValues[index] || 0
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
        const currentRgb = hex2RGB(currentColor, true)
        const nextRgb = hex2RGB(nextColor, true)

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
      super.render(dataArray)
    } catch (error) {
      console.error('ThreeBar: Error in render:', error)
    }
  }
}
