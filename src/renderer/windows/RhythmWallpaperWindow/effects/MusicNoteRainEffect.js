import { BaseEffect } from './BaseEffect'
import { Ellipse, Text } from 'leafer-ui'

const NOTE_CHARS = ['♪', '♫', '♬', '♩', '♭', '♯', '★', '✦', '✧']

export class MusicNoteRainEffect extends BaseEffect {
  constructor(leafer, config) {
    super(leafer, config)
    this.densityOptions = {
      sparse: 32,
      normal: 100,
      dense: 200
    }
    this.noteCount = this.densityOptions[this.config.density] || this.densityOptions.normal
    this.notes = []
    this.initNotes()
  }

  initNotes() {
    for (let i = 0; i < this.noteCount; i++) {
      const note = new Text({
        text: NOTE_CHARS[i % NOTE_CHARS.length],
        fontSize: 24 + Math.random() * 16,
        fill: this.getFill(i),
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
    const { width, height } = this.leafer
    for (let i = 0; i < this.noteCount; i++) {
      const value = dataArray[i % dataArray.length] || 0
      const mapped = this.getMappedValue(value)
      const n = this.notes[i]
      n.vy += 0.1 + mapped * 1.5
      n.y += n.vy
      if (n.y > height + 40) {
        n.y = -40
        n.x = Math.random() * width
        n.vy = 0
      }
      n.shape.x = n.x
      n.shape.y = n.y
      n.shape.opacity = 0.5 + mapped * 0.5
      n.shape.fill = this.getFill(i)
    }
  }

  destroy() {
    this.notes.forEach((n) => n.shape.remove())
    this.notes = []
  }
}
