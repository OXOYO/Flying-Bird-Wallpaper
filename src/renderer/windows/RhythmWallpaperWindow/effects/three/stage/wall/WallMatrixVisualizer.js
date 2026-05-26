import * as THREE from 'three'
import { getRhythmColors, hexToNumber, colorIndexForColumn } from '../../stageColorTheme.js'

const PX = 4
/** 灯座缝（更深） */
const SLOT = '#05070d'
/** 未亮灯珠（中性暗灰，须明显亮于后墙与缝） */
const OFF_CELL = '#0f141c'
const LIT_MIN = 0.32

/**
 * 霓虹墙矩阵：离屏 Canvas 逐像素绘制灯珠，贴后墙 Plane。
 * 行 0=底、rows-1=顶；未亮格用 OFF_CELL，列色由 colorIndexForColumn 分区。
 */
export class WallMatrixVisualizer {
  constructor(parent, layout, config) {
    this.parent = parent
    this.layout = layout
    this.config = config
    this.cols = layout.matrixCols ?? 40
    this.rows = layout.matrixRows ?? 24
    this.group = new THREE.Group()
    parent.add(this.group)

    const { roomW, roomH, matrixZ } = layout
    const padX = roomW * (layout.matrixPadX ?? 0.004)
    const padY = roomH * (layout.matrixPadY ?? 0.008)
    this.gridW = roomW - padX * 2
    this.gridH = roomH - padY * 2
    this.gridOx = -roomW / 2 + padX
    this.gridOy = padY

    const canvas = document.createElement('canvas')
    canvas.width = this.cols * PX
    canvas.height = this.rows * PX
    this._canvas = canvas
    this._ctx = canvas.getContext('2d', { alpha: false })
    this._tex = new THREE.CanvasTexture(canvas)
    this._tex.colorSpace = THREE.SRGBColorSpace
    this._tex.magFilter = THREE.NearestFilter
    this._tex.minFilter = THREE.NearestFilter
    this._tex.generateMipmaps = false

    const geo = new THREE.PlaneGeometry(this.gridW, this.gridH)
    const mat = new THREE.MeshBasicMaterial({
      map: this._tex,
      toneMapped: false,
      fog: false,
      depthWrite: true,
      side: THREE.FrontSide
    })
    this.mesh = new THREE.Mesh(geo, mat)
    this.mesh.position.set(0, this.gridOy + this.gridH / 2, matrixZ + 0.06)
    this.mesh.renderOrder = 2
    this.group.add(this.mesh)
  }

  /**
   * matrixValues：行 0=底；Canvas 行序翻转使纹理 Y 与墙坐标一致。
   * v < LIT_MIN 画灭灯格 OFF_CELL。
   */
  update(matrixValues, beatFlash = 0) {
    const ctx = this._ctx
    const cols = this.cols
    const rows = this.rows
    const w = this._canvas.width
    const h = this._canvas.height
    const colors = getRhythmColors(this.config)
    const pulse = 1 + beatFlash * 0.22

    ctx.fillStyle = SLOT
    ctx.fillRect(0, 0, w, h)

    const gap = 1
    const cell = PX - gap

    for (let r = 0; r < rows; r++) {
      const py = (rows - 1 - r) * PX
      for (let c = 0; c < cols; c++) {
        const x = c * PX
        const v = matrixValues[r * cols + c] ?? 0

        if (v < LIT_MIN) {
          ctx.fillStyle = OFF_CELL
          ctx.fillRect(x, py, cell, cell)
          continue
        }

        const ci = colorIndexForColumn(c, cols, colors.length)
        const rgb = hexToNumber(colors[ci])
        let rr = (rgb >> 16) & 255
        let gg = (rgb >> 8) & 255
        let bb = rgb & 255
        const boost = (0.75 + v * 1.15) * pulse
        rr = Math.min(255, Math.round(rr * boost))
        gg = Math.min(255, Math.round(gg * boost))
        bb = Math.min(255, Math.round(bb * boost))
        ctx.fillStyle = `rgb(${rr},${gg},${bb})`
        ctx.fillRect(x, py, cell, cell)
      }
    }

    this._tex.needsUpdate = true
  }

  dispose() {
    this._tex?.dispose()
    this.mesh?.geometry?.dispose()
    this.mesh?.material?.dispose()
    this.parent?.remove(this.group)
  }
}
