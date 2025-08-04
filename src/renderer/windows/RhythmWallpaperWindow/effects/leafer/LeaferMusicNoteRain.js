import { LeaferBase } from './LeaferBase'
import { Ellipse, Text } from 'leafer-ui'

const NOTE_CHARS = ['♪', '♫', '♬', '♩', '♭', '♯', '★', '✦', '✧']

export class LeaferMusicNoteRain extends LeaferBase {
  constructor(leafer, config) {
    super(leafer, config)
    this.densityOptions = {
      sparse: 32,
      normal: 64,
      dense: 128
    }
    this.noteCount = this.densityOptions[this.config.density] || this.densityOptions.normal
    this.notes = []
    this.init()
  }

  init() {
    for (let i = 0; i < this.noteCount; i++) {
      const note = new Text({
        text: NOTE_CHARS[i % NOTE_CHARS.length],
        fontSize: 24 + Math.random() * 16,
        fill: this.getFill('random'),
        opacity: 0.8
      })
      this.leafer.add(note)
      this.notes.push({
        shape: note,
        x: Math.random() * 800,
        y: -Math.random() * 600,
        vy: 0
      })
    }
  }

  render(dataArray) {
    const { x, y, width, height } = this.bodySize
    // 混合使用：频率对应 + 整体能量
    const mappedValues = this.getMappedValues(this.getReducedValues(dataArray, this.noteCount))
    const energy = mappedValues.reduce((a, b) => a + b, 0) / mappedValues.length

    // 检查是否有音频，没有音频时不显示
    if (energy < 0.02) {
      this.notes.forEach((note) => (note.shape.opacity = 0))
      return
    }

    for (let i = 0; i < this.noteCount; i++) {
      const mapped = mappedValues[i]
      const n = this.notes[i]
      n.vy += (0.1 + mapped * 1.5) * (1 + energy * 0.3) // 能量大时下落速度更快
      n.y += n.vy
      if (n.y > y + height / 2 + 40) {
        n.y = y - height / 2 - 40
        n.x = x - width / 2 + Math.random() * width
        n.vy = 0
      }
      n.shape.x = n.x
      n.shape.y = n.y
      n.shape.opacity = (1 - mapped * 0.4) * (1 - energy * 0.2) // 能量大时更不透明（透明度低）
      n.shape.fill = this.getFill('random')
    }
  }

  destroy() {
    this.notes.forEach((n) => n.shape.remove())
    this.notes = []
  }
}
