import { BaseEffect } from './BaseEffect'
import { Ellipse, Text } from 'leafer-ui'

const NOTE_CHARS = ['♪', '♫', '♬', '♩', '♭', '♯', '★', '✦', '✧']

export class MusicNoteRainEffect extends BaseEffect {
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
        fill: this.getFill(),
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
    const mappedValues = this.getMappedValues(this.getReducedValues(dataArray, this.noteCount))

    for (let i = 0; i < this.noteCount; i++) {
      const mapped = mappedValues[i]
      const n = this.notes[i]
      n.vy += 0.1 + mapped * 1.5
      n.y += n.vy
      if (n.y > y + height / 2 + 40) {
        n.y = y - height / 2 - 40
        n.x = x - width / 2 + Math.random() * width
        n.vy = 0
      }
      n.shape.x = n.x
      n.shape.y = n.y
      n.shape.opacity = 0.5 + mapped * 0.5
      n.shape.fill = this.getFill()
    }
  }

  destroy() {
    this.notes.forEach((n) => n.shape.remove())
    this.notes = []
  }
}
