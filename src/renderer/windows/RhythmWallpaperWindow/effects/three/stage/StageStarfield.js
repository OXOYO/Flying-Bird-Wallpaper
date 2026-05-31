import * as THREE from 'three'

/**
 * Mesh Grid 背景星野（轻量点云）
 * @param {object} [options.room] 传入时星点仅生成在盒体后方/外侧，避免落在墙面上
 */
export function buildStageStarfield(parent, span = 48, options = {}) {
  const room = options.room
  const count = room ? (options.count ?? 520) : (options.count ?? 1400)
  const positions = new Float32Array(count * 3)

  for (let i = 0; i < count; i++) {
    if (room) {
      const backZ = room.backZ ?? -room.roomD
      const halfW = room.roomW * 0.55
      const topY = room.roomH + 2
      positions[i * 3] = (Math.random() - 0.5) * span * 1.8
      positions[i * 3 + 1] = topY + Math.random() * span * 0.55
      positions[i * 3 + 2] = backZ - 14 - Math.random() * span * 1.35
      if (Math.abs(positions[i * 3]) < halfW && positions[i * 3 + 1] < topY + span * 0.2) {
        positions[i * 3] += (positions[i * 3] >= 0 ? 1 : -1) * (halfW + 4)
      }
    } else {
      const u = Math.random()
      const v = Math.random()
      positions[i * 3] = (u - 0.5) * span * 1.6
      positions[i * 3 + 1] = 4 + v * span * 0.85
      positions[i * 3 + 2] = -8 - Math.random() * span * 1.1
    }
  }

  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  const mat = new THREE.PointsMaterial({
    color: room ? 0xa8b8d8 : 0xe8eeff,
    size: room ? 0.055 : 0.1,
    sizeAttenuation: true,
    transparent: true,
    opacity: room ? 0.38 : 0.65,
    depthWrite: false,
    fog: false
  })
  const points = new THREE.Points(geo, mat)
  points.renderOrder = -2
  parent.add(points)
  return { points, geo, mat }
}

export function disposeStageStarfield(starfield) {
  if (!starfield) return
  starfield.points?.parent?.remove(starfield.points)
  starfield.geo?.dispose()
  starfield.mat?.dispose()
}
