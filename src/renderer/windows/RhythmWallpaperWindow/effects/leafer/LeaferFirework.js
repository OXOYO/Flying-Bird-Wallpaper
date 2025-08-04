import { LeaferBase } from './LeaferBase'
import { Ellipse } from 'leafer-ui'
import { Rect } from 'leafer-ui'

export class LeaferFirework extends LeaferBase {
  constructor(leafer, config) {
    super(leafer, config)
    this.densityOptions = {
      sparse: 8,
      normal: 16,
      dense: 32
    }
    this.fireworkCount = this.densityOptions[this.config.density] || this.densityOptions.normal
    this.fireworks = []
    this.particles = []
    this.trailParticles = [] // 轨迹粒子
  }

  render(dataArray) {
    const { x, y, width, height } = this.bodySize
    // 计算音律能量
    const mappedValues = this.getMappedValues(dataArray)
    const energy = mappedValues.reduce((a, b) => a + b, 0) / mappedValues.length
    // 发射频率随能量变化
    if (energy) {
      // 能量大时发射更多烟花
      const targetCount = Math.floor(this.fireworkCount * (0.3 + energy * 0.7))
      while (this.fireworks.length < targetCount) {
        this.launchFirework(x, y, width, height, energy)
      }
    }
    this.updateFireworks()
    this.updateParticles()
    this.updateTrailParticles()
  }

  // 随机位置发射，参数与能量相关
  launchFirework(x, y, width, height, energy) {
    const startX = x - width / 2 + Math.random() * width
    const startY = y + height / 2
    // 喷射高度随能量变化
    const minHeight = height * 0.2
    const maxHeight = height * 0.95
    const fireworkHeight = minHeight + (maxHeight - minHeight) * energy
    const endY = startY - fireworkHeight
    const color = this.getFill('random')
    // 发射速度随能量变化
    const minVx = -3.5,
      maxVx = 3.5
    const minVy = 2.5 + energy * 3,
      maxVy = 8 + energy * 4 // 能量大时速度更快
    const vx = Math.random() * (maxVx - minVx) + minVx
    const vy = -(Math.random() * (maxVy - minVy) + minVy)
    // 随机决定是否全部同色
    const allSameColor = Math.random() < 0.5
    // 随机决定轨迹类型
    const types = ['straight', 'parabola', 'curve']
    const trajectoryType = types[Math.floor(Math.random() * types.length)]
    const shape = new Ellipse({
      width: 8,
      height: 8,
      x: startX,
      y: startY,
      fill: color,
      opacity: 1
    })
    this.leafer.add(shape)
    this.fireworks.push({
      shape,
      x: startX,
      y: startY,
      vx,
      vy,
      endY,
      color,
      exploded: false,
      energy, // 记录能量，爆炸时用
      allSameColor,
      trajectoryType,
      t: 0, // 轨迹用时间参数
      life: 0
    })
  }

  updateFireworks() {
    for (let i = this.fireworks.length - 1; i >= 0; i--) {
      const fw = this.fireworks[i]
      if (!fw.exploded) {
        if (fw.trajectoryType === 'straight') {
          fw.x += fw.vx
          fw.y += fw.vy
        } else if (fw.trajectoryType === 'parabola') {
          fw.x += fw.vx
          fw.y += fw.vy
          fw.vy += 0.08 // 重力适中
        } else if (fw.trajectoryType === 'curve') {
          fw.t += 0.08
          fw.x += fw.vx + Math.sin(fw.t) * 2 // x方向扰动
          fw.y += fw.vy // y方向主运动
        }
        fw.shape.x = fw.x
        fw.shape.y = fw.y
        fw.shape.fill = fw.color
        // 生成更细的烟雾粒子
        this.trailParticles.push({
          x: fw.x,
          y: fw.y,
          radius: 1.2 + Math.random() * 1.0,
          alpha: 0.18 + Math.random() * 0.08,
          color: 'rgba(180,180,180,1)', // 烟雾
          life: 0,
          maxLife: 30 + Math.random() * 10,
          type: 'smoke',
          shape: null
        })
        // 生成更细的火焰粒子
        this.trailParticles.push({
          x: fw.x,
          y: fw.y,
          radius: 0.7 + Math.random() * 0.8,
          alpha: 0.25 + Math.random() * 0.15,
          color: 'rgba(255,180,60,1)', // 火焰
          life: 0,
          maxLife: 18 + Math.random() * 8,
          type: 'flame',
          shape: null
        })
        fw.life++
        if (fw.y <= fw.endY || fw.life > 300) {
          this.explode(fw.x, fw.y, fw.energy, fw.color, fw.allSameColor)
          fw.shape.remove()
          fw.exploded = true
          this.fireworks.splice(i, 1)
        }
      }
    }
  }

  // 爆炸时粒子数量、大小、速度随能量变化
  explode(x, y, energy, mainColor, allSameColor) {
    const f = 600 // 透视焦距
    // 爆炸范围随能量变化
    const minR = 50 + energy * 50 // 50~100
    const maxR = 150 + energy * 100 // 150~250
    const explosionRadius = minR + Math.random() * (maxR - minR)
    // 主射线
    const mainCount = Math.round(16 + energy * 48) // 16~64
    for (let i = 0; i < mainCount; i++) {
      const mainRadius = 1.2 + Math.random() * 0.5 + energy * 1.2
      // 球面均匀采样
      const theta = Math.acos(1 - 2 * Math.random())
      const phi = 2 * Math.PI * Math.random()
      // 速度向量长度统一为 maxR / (粒子生命周期/2)
      const life = 1 / (0.007 + Math.random() * 0.004) / 2 // 取 fade 的倒数一半为大致生命周期
      const speed = explosionRadius / life
      const vx = Math.sin(theta) * Math.cos(phi) * speed
      const vy = Math.sin(theta) * Math.sin(phi) * speed
      const vz = Math.cos(theta) * speed
      const color = allSameColor ? mainColor : this.getFill('loop', i)
      const zNorm = (Math.cos(theta) + 1) / 2 // [0,1]
      const alpha = 0.7 + 0.5 * zNorm
      const scale = 0.7 + 0.7 * zNorm
      const shape = new Ellipse({
        width: mainRadius * 2 * scale,
        height: mainRadius * 2 * scale,
        x,
        y,
        fill: color,
        opacity: alpha
      })
      this.leafer.add(shape)
      this.particles.push({
        shape,
        cx: x,
        cy: y,
        px: 0,
        py: 0,
        pz: 0,
        vx,
        vy,
        vz,
        alpha: alpha,
        color,
        radius: mainRadius * scale,
        fade: 0.012 + Math.random() * 0.008,
        z: zNorm,
        life: 0
      })
    }
    // 次级粒子
    const subCount = Math.round(48 + energy * 96) // 48~144
    for (let i = 0; i < subCount; i++) {
      const subRadius = 0.6 + Math.random() * 0.5 + energy * 0.6

      // 球面均匀采样
      const theta = Math.acos(1 - 2 * Math.random())
      const phi = 2 * Math.PI * Math.random()
      const life = 1 / (0.011 + Math.random() * 0.006) / 2
      const speed = explosionRadius / life
      const vx = Math.sin(theta) * Math.cos(phi) * speed
      const vy = Math.sin(theta) * Math.sin(phi) * speed
      const vz = Math.cos(theta) * speed
      const color = allSameColor ? mainColor : this.getFill('random')
      const zNorm = (Math.cos(theta) + 1) / 2 // [0,1]
      const alpha = 0.4 + 0.4 * zNorm
      const scale = 0.7 + 0.5 * zNorm
      const shape = new Ellipse({
        width: subRadius * 2 * scale,
        height: subRadius * 2 * scale,
        x,
        y,
        fill: color,
        opacity: alpha
      })
      this.leafer.add(shape)
      this.particles.push({
        shape,
        cx: x,
        cy: y,
        px: 0,
        py: 0,
        pz: 0,
        vx,
        vy,
        vz,
        alpha: alpha,
        color,
        radius: subRadius * scale,
        fade: 0.012 + Math.random() * 0.012,
        z: zNorm,
        life: 0
      })
    }
  }

  updateParticles() {
    const f = 600 // 透视焦距
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i]
      // 三维运动
      p.px += p.vx
      p.py += p.vy
      p.pz += p.vz
      // 透视投影
      const denom = f - p.pz
      const screenX = p.cx + p.px * (f / denom)
      const screenY = p.cy + p.py * (f / denom)
      p.alpha -= p.fade
      p.shape.x = screenX
      p.shape.y = screenY
      p.shape.width = p.shape.height = p.radius * 2
      p.shape.opacity = Math.max(0, p.alpha)
      p.shape.fill = p.color
      if (p.alpha <= 0.01 || p.life > 100) {
        p.shape.remove()
        this.particles.splice(i, 1)
      }
    }
  }

  updateTrailParticles() {
    for (let i = this.trailParticles.length - 1; i >= 0; i--) {
      const p = this.trailParticles[i]
      p.life++
      if (p.type === 'explosionSmoke' && p.followParticle) {
        // 跟随爆炸粒子运动和扩展
        p.x = p.followParticle.x
        p.y = p.followParticle.y
        p.radius = p.followParticle.radius * p.radiusScale
        p.alpha = Math.min(0.18, p.followParticle.alpha * 0.7 * p.radiusScale)
      } else {
        p.alpha *= 0.96
        p.radius *= 1.02
      }
      if (!p.shape) {
        p.shape = new Ellipse({
          x: p.x,
          y: p.y,
          width: (p.radius || 1) * 2,
          height: (p.radius || 1) * 2,
          fill: p.color,
          opacity: p.alpha
        })
        this.leafer.add(p.shape)
      } else {
        p.shape.x = p.x
        p.shape.y = p.y
        p.shape.width = p.shape.height = (p.radius || 1) * 2
        p.shape.opacity = p.alpha
      }
      if (p.life > p.maxLife || p.alpha < 0.01) {
        p.shape.remove()
        this.trailParticles.splice(i, 1)
      }
    }
  }

  destroy() {
    this.trailParticles.forEach((p) => p.shape && p.shape.remove())
    this.trailParticles = []
    this.fireworks.forEach((fw) => fw.shape.remove())
    this.particles.forEach((p) => p.shape.remove())
    this.fireworks = []
    this.particles = []
  }
}
