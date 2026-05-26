import EffectBase from './EffectBase.js'
import { colorList } from '@common/publicData.js'
import * as THREE from 'three'

/** 舞台区背景色（不透明黑场，遮住桌面壁纸） */
export const STAGE_BG_COLOR = 0x000000

export default class ThreeStageBase extends EffectBase {
  constructor(container, config) {
    super(container, config)
    this.scene = null
    this.camera = null
    this.renderer = null
    this.stageRoot = null
    this.layerBack = null
    this.layerMid = null
    this.layerFront = null
    this.view = { width: 0, height: 0, visibleW: 10, visibleH: 4, dist: 8 }
    this._dummy = new THREE.Object3D()
    this._floorProbe = new THREE.Vector3()
    this.initRenderer()
  }

  computeViewMetrics(width, height) {
    const aspect = width / Math.max(height, 1)
    const vFovDeg = aspect > 2.2 ? 34 : 40
    const vFov = (vFovDeg * Math.PI) / 180
    const dist = aspect > 2.2 ? 7.2 : 8.5
    const visibleH = 2 * Math.tan(vFov / 2) * dist
    const visibleW = visibleH * aspect
    return { width, height, aspect, vFovDeg, dist, visibleW, visibleH, isWide: aspect > 1.8 }
  }

  /** 俯视斜角看向盒内深处（侧墙 + 地面透视） */
  fitCamera(view) {
    this.camera.aspect = view.aspect
    this.camera.fov = view.vFovDeg
    const lookY = view.visibleH * 0.025
    const lookZ = -view.visibleH * 0.24
    this.camera.position.set(0, view.visibleH * 0.78, view.dist * 1.05)
    this.camera.lookAt(0, lookY, lookZ)
    this.camera.updateProjectionMatrix()
  }

  alignFloorToScreenBottom(floorY = 0, options = {}) {
    if (!this.camera || !this.stageRoot || options.skip) return
    const strength = options.strength ?? 1
    const targetNdcY = options.targetNdcY ?? -0.96
    let guard = 0
    while (guard < 32) {
      this._floorProbe.set(0, floorY, 0)
      this.stageRoot.updateMatrixWorld(true)
      this._floorProbe.applyMatrix4(this.stageRoot.matrixWorld)
      this._floorProbe.project(this.camera)
      const delta = targetNdcY - this._floorProbe.y
      const epsilon = options.epsilon ?? 0.008
      if (Math.abs(delta) < epsilon) break
      this.stageRoot.position.y += delta * this.view.visibleH * 0.45 * strength
      guard++
    }
  }

  /** 画布尺寸变化时更新渲染器（舞台子类会覆盖并做开口重贴合） */
  updateCanvasLayout() {
    const { width, height } = this.bodySize
    if (width <= 0 || height <= 0 || !this.renderer) return

    this.view = this.computeViewMetrics(width, height)
    this.camera.aspect = this.view.aspect
    this.camera.fov = this.view.vFovDeg
    this.fitCamera(this.view)
    this._applyRendererSize(width, height)
  }

  _applyRendererSize(width, height) {
    if (!this.renderer) return
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    this.renderer.setPixelRatio(dpr)
    this.renderer.setSize(width, height, false)
    const el = this.renderer.domElement
    el.style.left = '0'
    el.style.top = '0'
    el.style.width = `${width}px`
    el.style.height = `${height}px`
    if (this.backdrop) {
      this.backdrop.style.left = '0'
      this.backdrop.style.top = '0'
      this.backdrop.style.width = `${width}px`
      this.backdrop.style.height = `${height}px`
    }
  }

  initRenderer() {
    try {
      let { width, height, x, y } = this.bodySize
      if (width <= 0 || height <= 0) {
        const rect = this.container?.getBoundingClientRect?.()
        width = rect?.width || window.innerWidth || 1920
        height = rect?.height || window.innerHeight || 1080
        x = width / 2
        y = height / 2
        this.bodySize = { ...this.bodySize, width, height, x, y, boundWidth: width, boundHeight: height }
      }
      if (width <= 0 || height <= 0) return

      this.view = this.computeViewMetrics(width, height)

      this.scene = new THREE.Scene()
      this.scene.background = new THREE.Color(STAGE_BG_COLOR)
      this.scene.fog = null

      this.camera = new THREE.PerspectiveCamera(
        this.view.vFovDeg,
        this.view.aspect,
        0.1,
        Math.max(this.view.dist * 4, 80)
      )
      this.fitCamera(this.view)

      this.stageRoot = new THREE.Group()
      this.layerBack = new THREE.Group()
      this.layerMid = new THREE.Group()
      this.layerFront = new THREE.Group()
      this.layerBack.position.z = 0
      this.layerMid.position.z = 0
      this.layerFront.position.z = 0
      this.stageRoot.add(this.layerBack)
      this.stageRoot.add(this.layerMid)
      this.stageRoot.add(this.layerFront)
      this.scene.add(this.stageRoot)

      this.renderer = new THREE.WebGLRenderer({
        alpha: false,
        antialias: true,
        powerPreference: 'high-performance',
        preserveDrawingBuffer: false
      })
      this.renderer.autoClear = true
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      this.renderer.setPixelRatio(dpr)
      this.renderer.setSize(width, height, false)
      this.renderer.setClearColor(STAGE_BG_COLOR, 1)
      this.renderer.outputColorSpace = THREE.SRGBColorSpace
      this.renderer.toneMapping = THREE.NoToneMapping
      this.renderer.toneMappingExposure = 1
      this.renderer.shadowMap.enabled = false

      this.renderer.domElement.style.position = 'absolute'
      this.renderer.domElement.style.left = '0'
      this.renderer.domElement.style.top = '0'
      this.renderer.domElement.style.width = `${width}px`
      this.renderer.domElement.style.height = `${height}px`
      this.renderer.domElement.style.pointerEvents = 'none'

      if (this.config.debug) {
        this.renderer.domElement.style.border = '2px solid rgba(255,80,80,0.5)'
      }

      if (this.container) {
        this.backdrop = document.createElement('div')
        this.backdrop.style.cssText = [
          'position:fixed',
          'left:0',
          'top:0',
          'width:100vw',
          'height:100vh',
          'background:#000',
          'z-index:0',
          'pointer-events:none'
        ].join(';')
        this.renderer.domElement.style.zIndex = '1'
        this.renderer.domElement.style.background = '#000'
        this.container.appendChild(this.backdrop)
        this.container.appendChild(this.renderer.domElement)
      }
    } catch (error) {
      console.error('ThreeStageBase: initRenderer failed', error)
    }
  }

  getColor(type = 'single', index = 0) {
    const colors = this.config?.colors?.length ? this.config.colors : colorList
    if (type === 'random') return colors[Math.floor(Math.random() * colors.length)]
    if (type === 'loop') return colors[index % colors.length]
    return colors[index] || colors[0]
  }

  hexToNumber(hex) {
    return parseInt(String(hex).replace('#', ''), 16)
  }

  lerpColor(hexA, hexB, t) {
    const a = this.hexToNumber(hexA)
    const b = this.hexToNumber(hexB)
    const ar = (a >> 16) & 255
    const ag = (a >> 8) & 255
    const ab = a & 255
    const br = (b >> 16) & 255
    const bg = (b >> 8) & 255
    const bb = b & 255
    return (
      (Math.round(ar + (br - ar) * t) << 16) |
      (Math.round(ag + (bg - ag) * t) << 8) |
      Math.round(ab + (bb - ab) * t)
    )
  }

  renderScene() {
    if (this.renderer && this.scene && this.camera) {
      this.renderer.setClearColor(STAGE_BG_COLOR, 1)
      this.renderer.render(this.scene, this.camera)
    }
  }

  destroy() {
    try {
      const disposeNode = (node) => {
        node.traverse((obj) => {
          if (obj.geometry) obj.geometry.dispose()
          if (obj.material) {
            const mats = Array.isArray(obj.material) ? obj.material : [obj.material]
            mats.forEach((m) => m.dispose?.())
          }
        })
      }
      if (this.stageRoot) disposeNode(this.stageRoot)
      if (this.backdrop?.parentNode) {
        this.backdrop.parentNode.removeChild(this.backdrop)
      }
      this.backdrop = null
      if (this.renderer) {
        this.renderer.dispose()
        if (this.container?.contains(this.renderer.domElement)) {
          this.container.removeChild(this.renderer.domElement)
        }
      }
      this.scene = null
      this.camera = null
      this.renderer = null
      this.stageRoot = null
    } catch (error) {
      console.error('ThreeStageBase: destroy failed', error)
    }
  }
}
