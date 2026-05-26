/**
 * 舞台物理房间：尺寸计算 + 五面渐变壳体（正面开口朝相机）。
 * - buildStageRoom：演唱会柱（简单壳体 + floorZ 供柱阵）
 * - buildGradientRoomShell：霓虹墙/地柱/球体共用渐变墙
 */
import * as THREE from 'three'
import {
  buildStageTheme,
  sampleBackWallColor,
  sampleSideWallColor,
  sampleFloorColor,
  sampleCeilColor
} from './stageColorTheme.js'

/** 渐变墙网格分段，越大墙面明暗过渡越柔 */
const GRAD_SEG_X = 12
const GRAD_SEG_Y = 12
/** 天花略低于顶线、后墙略增高，避免共面缝隙露出 scene 纯黑底 */
const CEIL_Y_INSET = 0.025
const WALL_TOP_OVERLAP = 0.04

const _c0 = new THREE.Color()

function gradientWallMat(opts = {}) {
  return new THREE.MeshBasicMaterial({
    vertexColors: true,
    side: THREE.DoubleSide,
    depthWrite: true,
    depthTest: true,
    toneMapped: false,
    fog: true,
    ...opts
  })
}

/**
 * 按 UV 采样着色（u/v ∈ [0,1]），多分段让渐变与暗角更顺滑、对比更明显
 */
function makeMappedGradientPlane(w, h, colorAt, segX = GRAD_SEG_X, segY = GRAD_SEG_Y) {
  const geo = new THREE.PlaneGeometry(w, h, segX, segY)
  const pos = geo.attributes.position
  const arr = new Float32Array(pos.count * 3)
  const hw = w / 2
  const hh = h / 2
  for (let i = 0; i < pos.count; i++) {
    const u = (pos.getX(i) + hw) / w
    const v = (pos.getY(i) + hh) / h
    _c0.setHex(colorAt(u, v))
    arr[i * 3] = _c0.r
    arr[i * 3 + 1] = _c0.g
    arr[i * 3 + 2] = _c0.b
  }
  geo.setAttribute('color', new THREE.BufferAttribute(arr, 3))
  return new THREE.Mesh(geo, gradientWallMat())
}

/**
 * 房间宽高 = 当前视锥可见范围；深度由 heightRatio/widthRatio 与 profile.roomDepthMul 混合。
 */
export function computeRoomSize(view, profile, config = {}) {
  const wR = THREE.MathUtils.clamp(config.widthRatio ?? 1, 0.1, 1)
  const hR = THREE.MathUtils.clamp(config.heightRatio ?? 0.4, 0.1, 1)
  const depthT = THREE.MathUtils.clamp(hR * 0.65 + wR * 0.35, 0.12, 1)

  const roomW = view.visibleW
  const roomH = view.visibleH
  const depthMul = profile.roomDepthMul ?? 1.22
  const userDepth = THREE.MathUtils.clamp(config.roomDepthScale ?? 1, 0.85, 1.35)
  const roomD = view.visibleH * (0.34 + depthT * 0.96) * depthMul * userDepth
  const camZ = view.dist * (profile.camZScale ?? 0.78)

  return { roomW, roomH, roomD, camZ, depthT }
}

/** 五面渐变壳体（开口朝相机）；侧墙 u=1 为开口侧更亮，强化凹进感 */
export function buildGradientRoomShell(group, g, roomW, roomH, roomD, backZ) {
  const floor = makeMappedGradientPlane(roomW, roomD, (u, v) => sampleFloorColor(g, u, v))
  floor.rotation.x = -Math.PI / 2
  floor.position.set(0, 0.01, -roomD / 2)
  group.add(floor)

  const backH = roomH + WALL_TOP_OVERLAP
  const back = makeMappedGradientPlane(roomW, backH, (u, v) =>
    sampleBackWallColor(g, u, Math.min(1, (v * backH) / roomH))
  )
  back.position.set(0, backH / 2, backZ)
  group.add(back)

  const sideH = roomH + WALL_TOP_OVERLAP
  const mapSideV = (v) => Math.min(1, (v * sideH) / roomH)
  const left = makeMappedGradientPlane(roomD, sideH, (u, v) => sampleSideWallColor(g, u, mapSideV(v)))
  left.rotation.y = Math.PI / 2
  left.position.set(-roomW / 2, sideH / 2, -roomD / 2)
  group.add(left)

  const right = makeMappedGradientPlane(roomD, sideH, (u, v) => sampleSideWallColor(g, u, mapSideV(v)))
  right.rotation.y = -Math.PI / 2
  right.position.set(roomW / 2, sideH / 2, -roomD / 2)
  group.add(right)

  const ceiling = makeMappedGradientPlane(roomW, roomD, (u, v) => sampleCeilColor(g, u, v))
  ceiling.rotation.x = Math.PI / 2
  ceiling.position.set(0, roomH - CEIL_Y_INSET, -roomD / 2)
  ceiling.material = gradientWallMat({
    polygonOffset: true,
    polygonOffsetFactor: 1,
    polygonOffsetUnits: 1
  })
  group.add(ceiling)
}

export function buildStageRoom(group, view, profile, config = {}) {
  const theme = buildStageTheme(config)
  const { roomW, roomH, roomD, camZ } = computeRoomSize(view, profile, config)
  const backZ = -roomD

  buildGradientRoomShell(group, theme.grad, roomW, roomH, roomD, backZ)

  return {
    roomW,
    roomH,
    roomD,
    camZ,
    backZ,
    frontZ: 0,
    floorY: 0,
    floorZ: -roomD * (profile.barZRatio ?? 0.54),
    ceilingY: roomH,
    ceilingZ: -roomD / 2,
    roomBg: theme.wall
  }
}
