import * as THREE from 'three'
import { getRhythmColors, heightColorHex } from '../../stageColorTheme.js'

const _color = new THREE.Color()
const _dim = new THREE.Color(0x0f141c)

/**
 * 地板柱阵：每格一个 Box + 独立材质（便于 per-cell 变色）。
 * 高度由 mapSpectrumToGridLevels 驱动，颜色沿律动配色自下而上插值。
 */
export class FloorGridPillars {
  constructor(parent, layout, config) {
    this.parent = parent
    this.config = config
    this.cols = layout.gridCols
    this.rows = layout.gridRows
    this.cellW = layout.gridCellW
    this.cellD = layout.gridCellD
    this.baseH = layout.pillarBaseH
    this.maxH = layout.pillarMaxH
    this.deckY = layout.deckY ?? layout.floorY ?? 0
    this.layout = layout
    this.count = this.cols * this.rows

    this.group = new THREE.Group()
    this._geo = new THREE.BoxGeometry(1, 1, 1)
    this._cells = []

    const sx = this.cellW * 0.78
    const sz = this.cellD * 0.78
    const gap = 0.06
    for (let z = 0; z < this.rows; z++) {
      for (let x = 0; x < this.cols; x++) {
        const px = layout.gridOx + (x + 0.5) * this.cellW
        const pz = layout.gridOz + (z + 0.5) * this.cellD
        const mat = new THREE.MeshBasicMaterial({
          color: _dim.clone(),
          toneMapped: false,
          fog: false,
          depthTest: true,
          depthWrite: true
        })
        const mesh = new THREE.Mesh(this._geo, mat)
        mesh.frustumCulled = false
        mesh.position.set(px, this.deckY + this.baseH / 2, pz)
        mesh.scale.set(sx * (1 - gap), this.baseH, sz * (1 - gap))
        this.group.add(mesh)
        this._cells.push({ mesh, mat, x, z })
      }
    }

    parent.add(this.group)
  }

  _applyColor(mat, v, hex, beatFlash) {
    if (v < 0.04) {
      mat.color.copy(_dim)
      return
    }
    _color.setHex(hex >>> 0)
    const boost = Math.min(1.28, 0.9 + v * 0.38 + beatFlash * 0.1)
    _color.multiplyScalar(boost)
    _color.r = Math.min(0.96, _color.r)
    _color.g = Math.min(0.96, _color.g)
    _color.b = Math.min(0.96, _color.b)
    mat.color.copy(_color)
  }

  /** 按格电平拉伸柱高，配色随高度在律动色带间插值 */
  update(levels, beatFlash = 0) {
    const colors = getRhythmColors(this.config)
    const pulseMul = 1 + beatFlash * 0.75
    const cols = this.cols
    const rows = this.rows
    const sx = this.cellW * 0.78
    const sz = this.cellD * 0.78
    const gap = 0.06

    for (const { mesh, mat, x, z } of this._cells) {
      const i = z * cols + x
      const v = levels[i] ?? 0
      const px = this.layout.gridOx + (x + 0.5) * this.cellW
      const pz = this.layout.gridOz + (z + 0.5) * this.cellD
      const lit = Math.max(0, v - 0.03)
      const h = (this.baseH * 0.35 + lit * this.maxH) * pulseMul
      const bh = Math.max(this.baseH * 0.2, h)

      mesh.position.set(px, this.deckY + bh / 2, pz)
      mesh.scale.set(sx * (1 - gap), bh, sz * (1 - gap))

      const hex = heightColorHex(Math.min(1, lit), colors)
      this._applyColor(mat, v, hex, beatFlash)
    }
  }

  dispose() {
    for (const { mat } of this._cells) mat?.dispose()
    this._geo?.dispose()
    this._cells = []
    this.parent?.remove(this.group)
  }
}
