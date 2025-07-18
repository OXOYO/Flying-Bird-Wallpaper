import { BaseEffect } from './BaseEffect'
import { Path, Text } from 'leafer-ui'

const originalPoints = [
  { code: 'M', command: 'moveto', x: 1.450653, y: 780.39695 },
  {
    code: 'c',
    command: 'curveto',
    relative: true,
    x1: -10.175905,
    y1: 64.255398,
    x2: 36.031662,
    y2: 101.161718,
    x: 59.626108,
    y: 112.361614
  },
  {
    code: 'c',
    command: 'curveto',
    relative: true,
    x1: 23.594445,
    y1: 11.178562,
    x2: 63.274073,
    y2: 0,
    x: 78.825927,
    y: 0
  },
  {
    code: 'c',
    command: 'curveto',
    relative: true,
    x1: 116.542907,
    y1: 11.178562,
    x2: 366.759228,
    y2: 131.220103,
    x: 678.606972,
    y: 131.220103
  },
  {
    code: 'c',
    command: 'curveto',
    relative: true,
    x1: 0,
    y1: 0,
    x2: 504.635269,
    y2: 7.445264,
    x: 543.31224,
    y: -360.487287
  },
  {
    code: 'c',
    command: 'curveto',
    relative: true,
    x1: 9.19458,
    y1: -95.529771,
    x2: 4.885288,
    y2: -277.458732,
    x: -71.039334,
    y: -286.162651
  },
  {
    code: 'c',
    command: 'curveto',
    relative: true,
    x1: -63.956734,
    y1: -8.426588,
    x2: -102.121709,
    y2: 4.074628,
    x: -183.315615,
    y: 20.565141
  },
  {
    code: 'c',
    command: 'curveto',
    relative: true,
    x1: -53.908828,
    y1: 10.922564,
    x2: -189.011561,
    y2: 29.973052,
    x: -212.926004,
    y: 44.970245
  },
  {
    code: 'c',
    command: 'curveto',
    relative: true,
    x1: -260.989553,
    y1: 118.718887,
    x2: -403.324219,
    y2: 204.371417,
    x: -442.299853,
    y: 217.128631
  },
  {
    code: 'c',
    command: 'curveto',
    relative: true,
    x1: -29.439724,
    y1: 0,
    x2: -54.975485,
    y2: -7.359931,
    x: -62.100752,
    y: -69.972677
  },
  {
    code: 'c',
    command: 'curveto',
    relative: true,
    x1: 0,
    y1: -25.706426,
    x2: 98.089747,
    y2: -87.039184,
    x: 140.137353,
    y: -96.959091
  },
  {
    code: 'C',
    command: 'curveto',
    x1: 682.660267,
    y1: 452.869354,
    x2: 796.365867,
    y2: 435.333519,
    x: 809.720409,
    y: 435.333519
  },
  {
    code: 'c',
    command: 'curveto',
    relative: true,
    x1: 19.263819,
    y1: 0,
    x2: 441.489194,
    y2: -101.588381,
    x: 454.438406,
    y: -111.188291
  },
  {
    code: 'c',
    command: 'curveto',
    relative: true,
    x1: 12.949212,
    y1: -9.59991,
    x2: 26.62375,
    y2: -18.986489,
    x: 26.623751,
    y: -52.543508
  },
  {
    code: 'c',
    command: 'curveto',
    relative: true,
    x1: 0,
    y1: -15.359856,
    x2: -33.813016,
    y2: -49.663534,
    x: -72.319322,
    y: -91.455142
  },
  {
    code: 'c',
    command: 'curveto',
    relative: true,
    x1: -45.674238,
    y1: -49.556869,
    x2: -99.94573,
    y2: -107.092329,
    x: -140.606682,
    y: -120.788201
  },
  {
    code: 'C',
    command: 'curveto',
    x1: 1002.934597,
    y1: 20.958737,
    x2: 856.077308,
    y2: -10.912964,
    x: 727.779844,
    y: 3.572233
  },
  {
    code: 'C',
    command: 'curveto',
    x1: 446.929143,
    y1: 35.273269,
    x2: 271.677453,
    y2: 342.662388,
    x: 256.424263,
    y: 363.995521
  },
  {
    code: 'c',
    command: 'curveto',
    relative: true,
    x1: -64.852725,
    y1: 90.708483,
    x2: -116.542907,
    y2: 205.587406,
    x: -143.678653,
    y: 256.296264
  },
  {
    code: 'C',
    command: 'curveto',
    x1: 86.548522,
    y1: 669.272659,
    x2: 11.71189,
    y2: 735.149375,
    x: 1.450653,
    y: 780.39695
  },
  { code: 'Z', command: 'closepath' }
]

// 1. 计算原始路径的包围盒
function getBoundingBox(points) {
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity
  for (const cmd of points) {
    ;['x', 'y', 'x1', 'y1', 'x2', 'y2'].forEach((k) => {
      if (cmd[k] !== undefined) {
        if (k[0] === 'x') {
          minX = Math.min(minX, cmd[k])
          maxX = Math.max(maxX, cmd[k])
        } else {
          minY = Math.min(minY, cmd[k])
          maxY = Math.max(maxY, cmd[k])
        }
      }
    })
  }
  return {
    minX,
    minY,
    maxX,
    maxY,
    width: maxX - minX,
    height: maxY - minY,
    centerY: (minY + maxY) / 2
  }
}

// 1. 标记需要变形的命令（如前N个命令，或y/y1/y2小于某阈值）
function isTopCommand(cmd, centerY) {
  // 这里以y/y1/y2小于200为例，你可根据实际木鱼顶部范围调整
  return (
    (cmd.y !== undefined && cmd.y < centerY) ||
    (cmd.y1 !== undefined && cmd.y1 < centerY) ||
    (cmd.y2 !== undefined && cmd.y2 < centerY)
  )
}

// 2. 动态生成 path 字符串
function getAnimatedPath(offset, centerY) {
  // 深拷贝，避免污染原始数据
  const cmds = originalPoints.map((cmd) => ({ ...cmd }))
  cmds.forEach((cmd, index) => {
    // if (isTopCommand(cmd, centerY)) {
    if (index > 8) {
      if (cmd.y !== undefined && cmd.y < centerY) cmd.y += offset
      if (cmd.y1 !== undefined && cmd.y1 < centerY) cmd.y1 += offset
      if (cmd.y2 !== undefined && cmd.y2 < centerY) cmd.y2 += offset
    }
  })
  // 重新拼接为SVG path字符串
  return cmds
    .map((cmd) => {
      if (cmd.code === 'M' || cmd.code === 'L') {
        return `${cmd.code}${cmd.x},${cmd.y}`
      }
      if (cmd.code === 'C') {
        return `${cmd.code}${cmd.x1},${cmd.y1} ${cmd.x2},${cmd.y2} ${cmd.x},${cmd.y}`
      }
      if (cmd.code === 'c') {
        return `${cmd.code}${cmd.x1},${cmd.y1} ${cmd.x2},${cmd.y2} ${cmd.x},${cmd.y}`
      }
      if (cmd.code === 'Q') {
        return `${cmd.code}${cmd.x1},${cmd.y1} ${cmd.x},${cmd.y}`
      }
      if (cmd.code === 'q') {
        return `${cmd.code}${cmd.x1},${cmd.y1} ${cmd.x},${cmd.y}`
      }
      if (cmd.code === 'Z' || cmd.code === 'z') {
        return cmd.code
      }
      // 其他命令可按需补充
      return ''
    })
    .join(' ')
}

export class MuyuEffect extends BaseEffect {
  constructor(leafer, config) {
    super(leafer, config)
    this.center = { x: 0, y: 0 }
    this.bodyPath = null
    this.beatTime = 0
    this.beatInterval = 800
    this.lastTimestamp = 0
    this.floatingTexts = []
    this.sum = 0
    this.lastNum = 0
    this.animateCenter = { x: 0, y: 0 }
    this.bodySize = {
      width: 0,
      height: 0,
      x: 0,
      y: 0,
      scale: 1
    }
    this.bbox = getBoundingBox(originalPoints)
    this.initMuyu()
  }

  initMuyu() {
    const { width, height } = this.leafer
    this.center.x = width / 2
    this.center.y = height / 2
    if (this.bodyPath) {
      this.bodyPath.remove()
      this.bodyPath = null
    }
    // 计算缩放
    const scaleW = (width * this.config.widthRatio) / this.bbox.width
    const scaleH = (height * this.config.heightRatio) / this.bbox.height
    const scale = Math.min(scaleW, scaleH)
    this.bodySize.scale = scale
    // 居中偏移
    this.bodySize.width = this.bbox.width * scale
    this.bodySize.height = this.bbox.height * scale
    this.bodySize.x = this.center.x - this.bodySize.width / 2
    this.bodySize.y = this.center.y - this.bodySize.height / 2

    const d = getAnimatedPath(0, this.animateCenter.y)
    this.bodyPath = new Path({
      path: d,
      fill: '#222',
      stroke: null,
      scale,
      x: this.bodySize.x,
      y: this.bodySize.y,
      shadow: {
        color: 'rgba(0,0,0,0.5)',
        x: 0,
        y: 32 * scale,
        blur: 96 * scale
      }
    })

    this.leafer.add(this.bodyPath)
    this.beatTime = 0
    this.lastTimestamp = 0
    this.floatingTexts = []
    this.sum = 0
    this.lastNum = 0
  }

  showCount(num) {
    const text = new Text({
      text: `+ ${num}`,
      fontSize: 20 + 20 * this.bodySize.scale * 5,
      fill: '#ffd700',
      x: this.center.x,
      y: this.center.y - this.bodySize.height / 2 - 50,
      opacity: 1,
      bold: true,
      stroke: '#fff',
      strokeWidth: 4
    })
    this.leafer.add(text)
    this.floatingTexts.push({ text, time: 0 })
  }

  render(dataArray, timestamp = Date.now()) {
    const { width, height } = this.leafer
    if (width !== this.center.x * 2 || height !== this.center.y * 2) {
      this.initMuyu()
    }
    const avgValue = dataArray.reduce((a, b) => a + b, 0) / dataArray.length
    const energy = this.getMappedValue ? this.getMappedValue(avgValue) : avgValue / 255
    this.beatInterval = 1000 - 800 * energy
    if (!this.lastTimestamp) this.lastTimestamp = timestamp
    const dt = timestamp - this.lastTimestamp
    this.beatTime += dt
    this.lastTimestamp = timestamp
    // 顶部动画
    let offset = 0
    const maxOffset = 10 * Math.max(0.5, energy)
    if (this.beatTime < this.beatInterval / 2) {
      offset = maxOffset * (this.beatTime / (this.beatInterval / 2))
    } else if (this.beatTime < this.beatInterval) {
      offset = maxOffset * (1 - (this.beatTime - this.beatInterval / 2) / (this.beatInterval / 2))
    } else {
      this.beatTime = 0
      offset = 0
      // 敲击一次，显示功德
      const num = Math.floor(10 + 90 * energy)
      this.sum += num
      this.lastNum = num
      this.showCount(num)
    }
    if (this.bodyPath) {
      this.bodyPath.path = getAnimatedPath(offset, this.animateCenter.y)
    }
    // 功德动画
    for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
      const obj = this.floatingTexts[i]
      obj.time += dt
      obj.text.y -= 0.5 * (dt / 16.7)
      obj.text.opacity = 1 - obj.time / 1200
      if (obj.time > 1200) {
        obj.text.remove()
        this.floatingTexts.splice(i, 1)
      }
    }
  }

  destroy() {
    if (this.bodyPath) {
      this.bodyPath.remove()
      this.bodyPath = null
    }
    this.floatingTexts.forEach((obj) => obj.text.remove())
    this.floatingTexts = []
  }
}
