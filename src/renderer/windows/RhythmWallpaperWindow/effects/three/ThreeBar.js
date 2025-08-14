import ThreeBase from '../base/ThreeBase.js'
import * as THREE from 'three'
import { colorList } from '@common/publicData.js'

export class ThreeBar extends ThreeBase {
  constructor(container, config) {
    super(container, config)
    this.config.colors =
      Array.isArray(this.config.colors) && this.config.colors.length > 0
        ? [...this.config.colors, ...colorList]
        : colorList
    this.bars = []
    this.densityOptions = {
      sparse: 2,
      normal: 64,
      dense: 128
    }
    this.barCount = this.densityOptions[this.config.density] || this.densityOptions.normal
    // 添加材质类型配置，默认为单色
    this.materialType = this.config.materialType || 'gradient' // 'single' 或 'gradient'
    this.init()
  }

  init() {
    try {
      // 获取盒子尺寸
      const { width, height, depth } = this.bodySize

      // 计算柱子的尺寸和间距
      const barWidth = width / (this.barCount * 2)
      const barDepth = depth / (this.barCount * 2)
      const barHeight = height * 0.1 // 增加初始高度为盒子高度的10%

      // 计算柱子的起始位置
      const startX = -width / 2 + barWidth / 2
      const startZ = -depth / 2 + barDepth / 2

      // 创建n*n个柱子
      for (let i = 0; i < this.barCount; i++) {
        for (let j = 0; j < this.barCount; j++) {
          // 创建柱子几何体
          const barGeometry = new THREE.BoxGeometry(barWidth, barHeight, barDepth)

          // 根据配置选择材质类型
          let barMaterials
          if (this.materialType === 'gradient') {
            barMaterials = this.createGradientMaterial(i, j)
          } else {
            barMaterials = this.createSingleColorMaterial(i, j)
          }

          const bar = new THREE.Mesh(barGeometry, barMaterials)

          // 设置柱子位置
          bar.position.x = startX + j * (width / this.barCount)
          bar.position.y = -height / 2 + barHeight / 2 // 放在地面上
          bar.position.z = startZ + i * (depth / this.barCount)

          // 启用阴影
          bar.castShadow = true
          bar.receiveShadow = true

          // 给柱子添加自定义属性，用于更新高度
          bar.userData = {
            baseHeight: barHeight,
            targetHeight: barHeight,
            currentHeight: barHeight
          }

          // 将柱子添加到场景和数组中
          this.scene.add(bar)
          this.bars.push(bar)
        }
      }
    } catch (error) {
      console.error('ThreeBar: Error initializing scene:', error)
    }
  }

  // 创建单色材质的方法
  createSingleColorMaterial(i, j) {
    const colors = this.config.colors

    // 根据柱子位置选择颜色，按顺序循环取
    const colorIndex = (i * this.barCount + j) % colors.length
    const baseColor = new THREE.Color(colors[colorIndex])

    // 创建基础材质
    const material = new THREE.MeshPhongMaterial({
      color: baseColor,
      transparent: true,
      opacity: 0.9,
      shininess: 30
    })

    // 为所有面使用相同的材质
    const materials = [
      material, // 右面
      material, // 左面
      material, // 上面
      material, // 下面
      material, // 前面
      material // 后面
    ]

    return materials
  }

  // 创建渐变色材质的方法
  createGradientMaterial(i, j) {
    const colors = this.config.colors

    // 创建着色器材质实现渐变效果
    const gradientMaterial = new THREE.ShaderMaterial({
      uniforms: {
        colors: { value: colors.map((color) => new THREE.Color(color)) },
        colorCount: { value: colors.length }
      },
      vertexShader: `
        varying vec3 vPosition;
        void main() {
          vPosition = position;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 colors[20];  // 最多支持20种颜色
        uniform int colorCount;   // 实际颜色数量
        varying vec3 vPosition;

        vec3 interpolateColors(float t) {
          // 确保t在[0,1]范围内
          t = clamp(t, 0.0, 1.0);
          
          // 处理空数组和单颜色情况
          if (colorCount <= 0) return vec3(0.0);
          if (colorCount == 1) return colors[0];
          
          float scaledT = t * float(colorCount - 1);
          int index = int(floor(scaledT));
          index = clamp(index, 0, colorCount - 1);
          int nextIndex = min(index + 1, colorCount - 1);
          
          // 精确处理t=1.0的边界情况
          float mixValue = (index == colorCount - 1) ? 1.0 : fract(scaledT);
          return mix(colors[index], colors[nextIndex], mixValue);
        }

        void main() {
          float t = (vPosition.y + 1.0) / 2.0;
          gl_FragColor = vec4(interpolateColors(t), 0.9);
        }
      `,
      transparent: true,
      side: THREE.DoubleSide
    })

    // 为所有面使用相同的渐变材质
    const materials = [
      gradientMaterial, // 右面
      gradientMaterial, // 左面
      gradientMaterial, // 上面
      gradientMaterial, // 下面
      gradientMaterial, // 前面
      gradientMaterial // 后面
    ]

    return materials
  }

  // 更新柱子高度时保持材质
  render(dataArray) {
    try {
      // 更新柱子的高度
      if (this.bars.length > 0 && dataArray) {
        // 获取音频数据并映射到合适范围
        const mappedValues = this.getMappedValues(
          this.getReducedValues(dataArray, this.bars.length)
        )

        // 更新每个柱子的高度
        for (let i = 0; i < this.bars.length; i++) {
          const bar = this.bars[i]
          const value = mappedValues[i] || 0

          // 计算目标高度（基于音频数据），增加高度变化范围
          const maxHeight = this.bodySize.height * 0.8 // 限制最大高度为盒子高度的80%
          const targetHeight = bar.userData.baseHeight + value * maxHeight

          // 平滑过渡效果
          bar.userData.currentHeight += (targetHeight - bar.userData.currentHeight) * 0.1

          // 确保柱子高度不超过限制
          bar.userData.currentHeight = Math.min(bar.userData.currentHeight, maxHeight)

          // 更新柱子的几何体和位置
          bar.scale.y = bar.userData.currentHeight / bar.userData.baseHeight
          bar.position.y = -this.bodySize.height / 2 + bar.userData.currentHeight / 2
        }
      }

      // 调用父类渲染方法
      super.render()
    } catch (error) {
      console.error('ThreeBar: Error in render:', error)
    }
  }
}
