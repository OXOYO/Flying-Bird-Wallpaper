import * as THREE from 'three'
import { colorIndexForColumn } from '../../stageColorTheme.js'

/**
 * 地面列向光晕：按墙上每列点亮行数/峰值画竖条渐变，Additive 混合。
 * 贴图 y=0 靠后墙，向下（朝观众）渐隐。
 */
export class MatrixFloorGlow {
  constructor(parent, layout, colors) {
    this.parent = parent
    this.layout = layout
    this._colors = colors

    const canvas = document.createElement('canvas')
    canvas.width = 256
    canvas.height = 80
    this._canvas = canvas
    this._ctx = canvas.getContext('2d')
    this._tex = new THREE.CanvasTexture(canvas)
    this._tex.minFilter = THREE.LinearFilter
    this._tex.magFilter = THREE.LinearFilter
    this._tex.wrapS = THREE.ClampToEdgeWrapping
    this._tex.wrapT = THREE.ClampToEdgeWrapping

    const geo = new THREE.PlaneGeometry(layout.roomW * 0.96, layout.roomD * 0.55)
    geo.rotateX(-Math.PI / 2)
    const mat = new THREE.MeshBasicMaterial({
      map: this._tex,
      transparent: true,
      opacity: 0.32,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
      fog: true
    })
    this.mesh = new THREE.Mesh(geo, mat)
    const z = layout.backZ * 0.12 + layout.floorZ * 0.88
    this.mesh.position.set(0, 0.012, z)
    parent.add(this.mesh)
  }

  update(matrixValues, cols, rows) {
    const ctx = this._ctx
    const w = this._canvas.width
    const h = this._canvas.height
    ctx.clearRect(0, 0, w, h)

    for (let c = 0; c < cols; c++) {
      let peak = 0
      let litRows = 0
      for (let r = 0; r < rows; r++) {
        const v = matrixValues[r * cols + c] ?? 0
        if (v > 0.32) litRows++
        peak = Math.max(peak, v)
      }

      if (peak < 0.34 && litRows === 0) continue

      const heightNorm = litRows > 0 ? litRows / rows : peak
      const reach = Math.max(3, Math.round(heightNorm * h * 0.92))

      const ci = colorIndexForColumn(c, cols, this._colors.length)
      const hex = this._colors[ci]
      const cr = (hex >> 16) & 255
      const cg = (hex >> 8) & 255
      const cb = hex & 255
      const x0 = Math.floor((c / cols) * w)
      const x1 = Math.floor(((c + 1) / cols) * w)
      const bw = Math.max(1, x1 - x0 + 1)

      const a = 0.08 + peak * 0.55
      // 贴图 y=0 贴后墙一侧，向下（朝观众）渐隐
      const grad = ctx.createLinearGradient(0, 0, 0, reach)
      grad.addColorStop(0, `rgba(${cr},${cg},${cb},${a * 0.55})`)
      grad.addColorStop(0.45, `rgba(${cr},${cg},${cb},${a * 0.22})`)
      grad.addColorStop(1, 'rgba(0,0,0,0)')
      ctx.fillStyle = grad
      ctx.fillRect(x0, 0, bw, reach)
    }
    this._tex.needsUpdate = true
  }

  dispose() {
    this._tex?.dispose()
    this.mesh?.geometry?.dispose()
    this.mesh?.material?.dispose()
    this.parent?.remove(this.mesh)
  }
}
