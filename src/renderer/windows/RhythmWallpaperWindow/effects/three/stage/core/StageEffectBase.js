import ThreeStageBase from '../../../base/ThreeStageBase.js'
import { getStageLayoutProfile } from '../../stageLayoutProfile.js'
import * as THREE from 'three'

/**
 * 舞台系 Three 效果基类：画布铺满窗口、霓虹盒相机贴合、地板对齐屏幕底边。
 * 子类在 initStage 中写入 layout.roomW/H/D 后，由 _refitOpening 迭代投影校正开口大小。
 */
export default class StageEffectBase extends ThreeStageBase {
  /** 效果区域 = 整个容器（与旧版小窗律动不同） */
  getBodySize() {
    const ret = { boundWidth: 0, boundHeight: 0, width: 0, height: 0, x: 0, y: 0 }
    if (!this.container) return ret

    const rect = this.container.getBoundingClientRect()
    const boundWidth = rect.width || window.innerWidth || 1920
    const boundHeight = rect.height || window.innerHeight || 1080
    if (boundWidth <= 0 || boundHeight <= 0) return ret

    return {
      boundWidth,
      boundHeight,
      width: boundWidth,
      height: boundHeight,
      x: boundWidth / 2,
      y: boundHeight / 2
    }
  }

  /** 视锥可见宽高 + 布局 profile，供 computeRoomSize / fitCameraToRoom */
  computeViewMetrics(width, height) {
    const aspect = width / Math.max(height, 1)
    const profile = getStageLayoutProfile({ aspect, width, height }, this.config)
    const vFovDeg = profile.vFovDeg
    const dist = profile.dist
    const vFov = (vFovDeg * Math.PI) / 180
    const visibleH = 2 * Math.tan(vFov / 2) * dist
    const visibleW = visibleH * aspect
    return { width, height, aspect, vFovDeg, dist, visibleW, visibleH, isWide: aspect > 1.8, profile }
  }

  fitCamera(view) {
    if (this.layout?.roomW) {
      this._refitOpening()
      return
    }
    this.camera.aspect = view.aspect
    this.camera.fov = view.vFovDeg
    this.camera.updateProjectionMatrix()
  }

  applySceneAtmosphere(roomBg, roomD, fogNearMul = 0.5, fogFarMul = 2.65) {
    this.scene.background = new THREE.Color(roomBg)
    this.scene.fog = new THREE.Fog(roomBg, roomD * fogNearMul, roomD * fogFarMul)
  }

  /** 霓虹盒：渐变墙 + 轻雾，强化纵深凹感 */
  applyNeonRoomAtmosphere(room) {
    const bg = room.roomBg ?? 0x030508
    this.scene.background = new THREE.Color(bg)
    this.scene.fog = new THREE.Fog(bg, room.roomD * 0.4, room.roomD * 2.9)
  }

  /** 有 room 布局时：对齐地板、投影 fit 开口、防止天花裁切 */
  _refitOpening() {
    this.stageRoot.position.set(0, 0, 0)
    this.fitCameraToRoom(this.layout)
    this._fitOpeningByProjection(this.layout, 6)
    this.alignFloorToScreenBottom(this.layout.floorY ?? 0, {
      targetNdcY: -1,
      strength: 1,
      epsilon: 0.002
    })
    this._syncCameraToStage()
    this._guardCeilingInView()
    this._fitOpeningByProjection(this.layout, 6)
    this._guardCeilingInView()
  }

  _guardCeilingInView() {
    const rh = this.layout.roomH
    const sy = this.stageRoot.position.y
    let lift = 0
    for (let i = 0; i < 8; i++) {
      const topMid = this._projectNdc(0, rh, 0)
      if (topMid.y >= 0.5) break
      lift += rh * 0.028
      const aim = this._getCameraAim(sy)
      const eyeY = aim.eyeY + lift
      const lookY = aim.lookY + lift * 0.38
      this._setCamera(eyeY, lookY, this.camera.position.z * 1.02, aim.lookZ)
    }
  }

  _getCameraAim(stageY = 0) {
    const { roomH, roomD } = this.layout
    const p = this.layout.profile
    return {
      eyeY: stageY + roomH * (p.eyeYRatio ?? 0.56),
      lookY: stageY + roomH * (p.lookYRatio ?? 0.22),
      lookZ: -roomD * (p.lookZ ?? 0.5)
    }
  }

  _syncCameraToStage() {
    const { eyeY, lookY, lookZ } = this._getCameraAim(this.stageRoot.position.y)
    this._setCamera(eyeY, lookY, this.camera.position.z, lookZ)
  }

  _projectNdc(x, y, z) {
    const v = new THREE.Vector3(x, y, z)
    this.stageRoot.updateMatrixWorld(true)
    v.applyMatrix4(this.stageRoot.matrixWorld)
    v.project(this.camera)
    return v
  }

  _setCamera(camY, lookY, camZ, lookZ) {
    this.camera.position.set(0, camY, camZ)
    this.camera.up.set(0, 1, 0)
    this.camera.lookAt(0, lookY, lookZ)
    this.camera.updateProjectionMatrix()
  }

  updateCanvasLayout() {
    const bs = this.getBodySize()
    if (bs.width <= 0 || bs.height <= 0 || !this.renderer) return

    const w0 = this.bodySize?.width ?? 0
    const h0 = this.bodySize?.height ?? 0
    const a0 = this.view?.aspect ?? 0
    this.bodySize = bs
    this.view = this.computeViewMetrics(bs.width, bs.height)
    this._applyRendererSize(bs.width, bs.height)

    const sizeChanged = Math.abs(bs.width - w0) > 1 || Math.abs(bs.height - h0) > 1
    const aspectChanged = Math.abs(this.view.aspect - a0) > 0.001
    if (this.layout?.roomW && (sizeChanged || aspectChanged)) {
      this._refitOpening()
    } else if (!this.layout?.roomW) {
      this.fitCamera(this.view)
    }
  }

  _ensureCanvasSynced() {
    if (!this.container || !this.renderer) return
    const bs = this.getBodySize()
    if (bs.width <= 0 || bs.height <= 0) return
    const w0 = this.bodySize?.width ?? 0
    const h0 = this.bodySize?.height ?? 0
    if (Math.abs(bs.width - w0) > 1 || Math.abs(bs.height - h0) > 1) {
      this.updateCanvasLayout()
    }
  }

  renderScene() {
    this._ensureCanvasSynced()
    super.renderScene()
  }

  /**
   * 通过缩放相机 Z，使开口平面在 NDC 上接近 fitSpanX/Y（默认约满宽 2、高 1.82）。
   * layout.fitPlaneZ / fitSpanX / fitSpanY 可由子效果覆盖（如霓虹墙）。
   */
  _fitOpeningByProjection(layout, maxIter = 6) {
    const hw = layout.roomW / 2
    const rh = layout.roomH
    const pz = layout.fitPlaneZ ?? 0
    const target = layout.fitSpanX ?? 2
    const targetY = layout.fitSpanY ?? 1.82
    for (let i = 0; i < maxIter; i++) {
      const camZ = this.camera.position.z
      const bl = this._projectNdc(-hw, 0, pz)
      const br = this._projectNdc(hw, 0, pz)
      const tl = this._projectNdc(-hw, rh, pz)
      const spanX = br.x - bl.x
      const spanY = tl.y - bl.y
      if (!(spanX > 0.05) || !Number.isFinite(spanX) || !Number.isFinite(spanY)) break
      if (Math.abs(spanX - target) < 0.003 && Math.abs(spanY - targetY) < 0.003) break
      const ratio = THREE.MathUtils.clamp(
        Math.min(spanX / target, spanY / targetY),
        0.93,
        1.07
      )
      const nextZ = THREE.MathUtils.clamp(
        camZ * ratio,
        layout.roomD * 0.22,
        this.view.dist * 1.48
      )
      this.camera.position.z = nextZ
      this.camera.updateProjectionMatrix()
      layout.camZ = nextZ
    }
  }

  fitCameraToRoom(layout) {
    const p = layout.profile
    const { roomW, roomH, roomD } = layout
    const view = this.view
    const vFovRad = (p.vFovDeg * Math.PI) / 180
    let camZ = view.dist
    const parsed = (roomW / 2) / (Math.tan(vFovRad / 2) * view.aspect)
    if (Number.isFinite(parsed) && parsed > 0) camZ = parsed
    camZ = THREE.MathUtils.clamp(camZ, layout.roomD * 0.22, view.dist * 1.48)

    const sy = this.stageRoot?.position.y ?? 0
    const { eyeY, lookY, lookZ } = this._getCameraAim(sy)
    this.camera.aspect = view.aspect
    this.camera.fov = p.vFovDeg
    this.camera.near = 0.1
    this.camera.far = Math.max(view.dist * 8, camZ + roomD + roomH + sy + 24)
    this._setCamera(eyeY, lookY, camZ, lookZ)
    layout.camZ = camZ
  }
}
