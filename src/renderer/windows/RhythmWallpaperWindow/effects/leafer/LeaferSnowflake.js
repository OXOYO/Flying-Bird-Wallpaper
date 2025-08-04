import { LeaferBase } from './LeaferBase'
import { Ellipse, Path } from 'leafer-ui'

export class LeaferSnowflake extends LeaferBase {
  constructor(leafer, config) {
    super(leafer, config)
    this.densityOptions = {
      sparse: 80,
      normal: 150,
      dense: 300
    }
    this.snowflakeCount = this.densityOptions[this.config.density] || this.densityOptions.normal
    this.snowflakes = []
    this.init()
  }

  init() {
    const { x, y, width, height } = this.bodySize

    // 初始化时让雪花分布在屏幕的不同位置，避免同时出现
    for (let i = 0; i < this.snowflakeCount; i++) {
      const snowflake = this.createSnowflake()
      this.leafer.add(snowflake)

      // 随机分布在屏幕上方和屏幕内
      const randomX = x - width / 2 + Math.random() * width
      const randomY = y - height / 2 - Math.random() * height * 0.8 - Math.random() * height * 0.5

      this.snowflakes.push({
        shape: snowflake,
        x: randomX,
        y: randomY,
        vx: (Math.random() - 0.5) * 1.0,
        vy: 3.0 + Math.random() * 4.0,
        swing: Math.random() * Math.PI * 2,
        swingSpeed: 0.01 + Math.random() * 0.02,
        type: Math.floor(Math.random() * 6), // 雪花类型
        rotation: Math.random() * Math.PI * 2, // 旋转角度
        rotationSpeed: (Math.random() - 0.5) * 0.02 // 旋转速度
      })

      // 立即设置雪花位置
      snowflake.x = randomX
      snowflake.y = randomY
    }
  }

  createSnowflake() {
    // 创建更明显的雪花形状
    const size = 8 + Math.random() * 12 // 增加雪花大小
    const type = Math.floor(Math.random() * 6) // 增加到6种类型
    let pathData = ''

    switch (type) {
      case 0:
        // 六角星雪花
        pathData = this.createHexagonalSnowflake(size)
        break
      case 1:
        // 简单雪花
        pathData = this.createSimpleSnowflake(size)
        break
      case 2:
        // 十字雪花
        pathData = this.createCrossSnowflake(size)
        break
      case 3:
        // 树枝状雪花
        pathData = this.createDendriticSnowflake(size)
        break
      case 4:
        // 板状雪花
        pathData = this.createPlateSnowflake(size)
        break
      case 5:
        // 星形雪花
        pathData = this.createStellarSnowflake(size)
        break
      default:
        pathData = this.createHexagonalSnowflake(size)
    }

    return new Path({
      path: pathData,
      fill: '#ffffff',
      stroke: '#ffffff',
      strokeWidth: 1,
      opacity: 0.8 + Math.random() * 0.2,
      shadow: this.config.shadow ? { color: '#ffffff', blur: 3, x: 0, y: 0 } : undefined
    })
  }

  createHexagonalSnowflake(size) {
    // 简单的六角星雪花 - 更容易看到
    let pathData = ''
    const arms = 6

    for (let i = 0; i < arms; i++) {
      const angle = (i * Math.PI * 2) / arms

      // 主臂 - 从中心到边缘
      const x1 = Math.cos(angle) * size * 0.1
      const y1 = Math.sin(angle) * size * 0.1
      const x2 = Math.cos(angle) * size
      const y2 = Math.sin(angle) * size

      pathData += `M${x1},${y1} L${x2},${y2} `

      // 简单的分支
      const branchAngle1 = angle + Math.PI / 6
      const branchAngle2 = angle - Math.PI / 6
      const branchLength = size * 0.4

      const bx1 = x2 + Math.cos(branchAngle1) * branchLength
      const by1 = y2 + Math.sin(branchAngle1) * branchLength
      const bx2 = x2 + Math.cos(branchAngle2) * branchLength
      const by2 = y2 + Math.sin(branchAngle2) * branchLength

      pathData += `M${x2},${y2} L${bx1},${by1} `
      pathData += `M${x2},${y2} L${bx2},${by2} `
    }

    return pathData
  }

  createSimpleSnowflake(size) {
    // 简单雪花 - 只有主臂
    let pathData = ''
    const arms = 6

    for (let i = 0; i < arms; i++) {
      const angle = (i * Math.PI * 2) / arms

      // 主臂 - 从中心到边缘
      const x1 = Math.cos(angle) * size * 0.1
      const y1 = Math.sin(angle) * size * 0.1
      const x2 = Math.cos(angle) * size
      const y2 = Math.sin(angle) * size

      pathData += `M${x1},${y1} L${x2},${y2} `
    }

    return pathData
  }

  createCrossSnowflake(size) {
    // 十字雪花 - 更容易看到
    let pathData = ''

    // 水平线
    pathData += `M${-size},0 L${size},0 `

    // 垂直线
    pathData += `M0,${-size} L0,${size} `

    // 对角线
    pathData += `M${-size * 0.7},${-size * 0.7} L${size * 0.7},${size * 0.7} `
    pathData += `M${-size * 0.7},${size * 0.7} L${size * 0.7},${-size * 0.7} `

    return pathData
  }

  createDendriticSnowflake(size) {
    // 树枝状雪花 - 真实的树枝状结构
    let pathData = ''
    const arms = 6

    for (let i = 0; i < arms; i++) {
      const angle = (i * Math.PI * 2) / arms

      // 主臂
      const x1 = Math.cos(angle) * size * 0.1
      const y1 = Math.sin(angle) * size * 0.1
      const x2 = Math.cos(angle) * size
      const y2 = Math.sin(angle) * size

      pathData += `M${x1},${y1} L${x2},${y2} `

      // 第一层分支
      const branch1Angle1 = angle + Math.PI / 6
      const branch1Angle2 = angle - Math.PI / 6
      const branch1Length = size * 0.4

      const bx1 = x2 + Math.cos(branch1Angle1) * branch1Length
      const by1 = y2 + Math.sin(branch1Angle1) * branch1Length
      const bx2 = x2 + Math.cos(branch1Angle2) * branch1Length
      const by2 = y2 + Math.sin(branch1Angle2) * branch1Length

      pathData += `M${x2},${y2} L${bx1},${by1} `
      pathData += `M${x2},${y2} L${bx2},${by2} `

      // 第二层分支
      const branch2Length = size * 0.2
      const bx1_2 = bx1 + Math.cos(branch1Angle1 + Math.PI / 8) * branch2Length
      const by1_2 = by1 + Math.sin(branch1Angle1 + Math.PI / 8) * branch2Length
      const bx2_2 = bx2 + Math.cos(branch1Angle2 - Math.PI / 8) * branch2Length
      const by2_2 = by2 + Math.sin(branch1Angle2 - Math.PI / 8) * branch2Length

      pathData += `M${bx1},${by1} L${bx1_2},${by1_2} `
      pathData += `M${bx2},${by2} L${bx2_2},${by2_2} `
    }

    return pathData
  }

  createPlateSnowflake(size) {
    // 板状雪花 - 六边形板状结构
    let pathData = ''
    const sides = 6

    // 外六边形
    for (let i = 0; i < sides; i++) {
      const angle = (i * Math.PI * 2) / sides
      const x = Math.cos(angle) * size
      const y = Math.sin(angle) * size

      if (i === 0) {
        pathData += `M${x},${y} `
      } else {
        pathData += `L${x},${y} `
      }
    }
    pathData += 'Z '

    // 内六边形
    for (let i = 0; i < sides; i++) {
      const angle = (i * Math.PI * 2) / sides
      const x = Math.cos(angle) * size * 0.6
      const y = Math.sin(angle) * size

      if (i === 0) {
        pathData += `M${x},${y} `
      } else {
        pathData += `L${x},${y} `
      }
    }
    pathData += 'Z '

    // 中心点
    pathData += `M${-size * 0.1},0 L${size * 0.1},0 `
    pathData += `M0,${-size * 0.1} L0,${size * 0.1} `

    return pathData
  }

  createStellarSnowflake(size) {
    // 星形雪花 - 五角星形状
    let pathData = ''
    const points = 5

    for (let i = 0; i < points; i++) {
      const angle = (i * Math.PI * 2) / points - Math.PI / 2
      const x = Math.cos(angle) * size
      const y = Math.sin(angle) * size

      if (i === 0) {
        pathData += `M${x},${y} `
      } else {
        pathData += `L${x},${y} `
      }
    }
    pathData += 'Z '

    // 内部小星
    for (let i = 0; i < points; i++) {
      const angle = (i * Math.PI * 2) / points - Math.PI / 2
      const x = Math.cos(angle) * size * 0.4
      const y = Math.sin(angle) * size * 0.4

      if (i === 0) {
        pathData += `M${x},${y} `
      } else {
        pathData += `L${x},${y} `
      }
    }
    pathData += 'Z '

    return pathData
  }

  render(dataArray) {
    const { x, y, width, height } = this.bodySize
    const mappedValues = this.getMappedValues(this.getReducedValues(dataArray, this.snowflakeCount))
    const energy = Math.min(
      1,
      Math.max(0, mappedValues.reduce((a, b) => a + b, 0) / mappedValues.length)
    )

    // 移除这里的早期返回，让雪花始终能正确初始化和更新位置
    // 透明度会在后面的代码中根据能量调整

    // 根据能量调整雪花密度，让雪花连续飘落
    const baseDensity = 0.2 + energy * 0.8 // 基础密度随能量增加，更明显的节奏变化
    const activeCount = Math.floor(this.snowflakeCount * baseDensity)

    for (let i = 0; i < this.snowflakeCount; i++) {
      const mapped = mappedValues[i % mappedValues.length]
      const s = this.snowflakes[i]

      // 确保位置值有效
      if (isNaN(s.x) || !isFinite(s.x)) s.x = x - width / 2 + Math.random() * width
      if (isNaN(s.y) || !isFinite(s.y)) s.y = y - height / 2 - Math.random() * height * 0.5
      if (isNaN(s.vx) || !isFinite(s.vx)) s.vx = (Math.random() - 0.5) * 1.0
      if (isNaN(s.vy) || !isFinite(s.vy)) s.vy = 3.0 + Math.random() * 4.0

      // 更新雪花位置
      s.swing += s.swingSpeed
      s.rotation += s.rotationSpeed // 雪花旋转

      // 摆动效果
      const swingOffset = Math.sin(s.swing) * 1.5 * (1 + energy * 0.3)

      // 根据能量调整下落速度 - 减少加速度避免一顿一顿
      const speedMultiplier = 1.5 + energy * 1.0 // 适中的速度倍数
      s.vy += 0.03 * speedMultiplier // 减少加速度，让运动更平滑
      s.vx += (Math.random() - 0.5) * 0.1 * speedMultiplier // 减少随机漂移

      // 更新位置并防止 NaN
      const newX = s.x + s.vx + swingOffset
      const newY = s.y + s.vy

      if (!isNaN(newX) && isFinite(newX)) {
        s.x = newX
      }
      if (!isNaN(newY) && isFinite(newY)) {
        s.y = newY
      }

      // 边界处理 - 更自然的边界循环
      if (s.x < x - width / 2 - 10) s.x = x + width / 2 + 10
      if (s.x > x + width / 2 + 10) s.x = x - width / 2 - 10

      // 如果雪花落到底部，重新从顶部开始，但位置随机分布
      if (s.y > y + height / 2 + 10) {
        s.x = x - width / 2 + Math.random() * width
        s.y = y - height / 2 - Math.random() * height * 0.3 - 10
        s.vy = 3.0 + Math.random() * 4.0 // 大幅增加重置时的下落速度
        s.vx = (Math.random() - 0.5) * 1.0 // 大幅增加重置时的横向速度

        // 确保重置的值有效
        if (isNaN(s.x) || !isFinite(s.x)) s.x = 0
        if (isNaN(s.y) || !isFinite(s.y)) s.y = 0
        if (isNaN(s.vx) || !isFinite(s.vx)) s.vx = 0
        if (isNaN(s.vy) || !isFinite(s.vy)) s.vy = 3.0

        // 重新创建雪花形状，增加变化
        if (Math.random() < 0.3) {
          s.shape.remove()
          const newSnowflake = this.createSnowflake()
          this.leafer.add(newSnowflake)
          s.shape = newSnowflake
          s.type = Math.floor(Math.random() * 6) // 更新为6种类型
        }
      }

      // 更新雪花形状 - 添加安全检查防止 NaN
      if (!isNaN(s.x) && isFinite(s.x)) {
        s.shape.x = s.x
      }
      if (!isNaN(s.y) && isFinite(s.y)) {
        s.shape.y = s.y
      }
      if (!isNaN(s.rotation) && isFinite(s.rotation)) {
        s.shape.rotation = s.rotation
      }

      // 根据能量调整透明度和可见性 - 确保更多雪花可见
      let opacity
      if (energy < 0.02) {
        // 没有音乐时完全透明
        opacity = 0
      } else {
        // 有音乐时根据能量调整透明度
        const baseOpacity = 0.6 + Math.random() * 0.2 // 提高基础透明度
        const energyOpacity = 0.4 + energy * 0.6 // 能量高时更明显
        const mappedOpacity = 0.6 + mapped * 0.4 // 映射值高时更明显

        // 根据是否在活跃范围内调整，但差异不要太大
        const isActive = i < activeCount
        const activeMultiplier = isActive ? 1.0 : 0.6 // 非活跃雪花稍微透明一些

        opacity = Math.min(
          1,
          Math.max(0.2, baseOpacity * energyOpacity * mappedOpacity * activeMultiplier)
        )
      }
      s.shape.opacity = opacity

      // 根据能量调整大小
      const baseScale = 0.6 + Math.random() * 0.4
      const energyScale = 1 + energy * 0.3
      const mappedScale = 1 + mapped * 0.2
      const scale = baseScale * energyScale * mappedScale
      s.shape.scaleX = s.shape.scaleY = scale

      // 根据能量调整颜色
      if (energy > 0.6) {
        s.shape.fill = this.getFill('random')
      } else {
        s.shape.fill = '#ffffff'
      }

      // 根据能量调整阴影
      if (this.config.shadow) {
        s.shape.shadow = {
          color: energy > 0.6 ? this.getFill('random') : '#ffffff',
          blur: 2 + energy * 4,
          x: 0,
          y: 0
        }
      }
    }
  }

  destroy() {
    this.snowflakes.forEach((s) => s.shape.remove())
    this.snowflakes = []
  }
}
