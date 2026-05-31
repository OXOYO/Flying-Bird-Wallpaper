import * as THREE from 'three'

/**
 * vizz 同款 PlaneGeometry 三角网格线框（含单元格对角线），顶点位移沿 +Z
 */
export function createVizzPlaneGridGeometry(width, height, segX, segZ) {
  const cols = segX + 1
  const rows = segZ + 1
  const vertCount = cols * rows

  const plane = new THREE.PlaneGeometry(width, height, segX, segZ)
  const posAttr = plane.attributes.position
  const pointPos = new Float32Array(posAttr.array)
  const basePointPos = new Float32Array(pointPos)
  basePointPos.set(pointPos)

  const frequencies = new Float32Array(vertCount)
  const displacements = new Float32Array(vertCount)

  plane.setAttribute('frequency', new THREE.BufferAttribute(frequencies, 1))
  plane.setAttribute('displacement', new THREE.BufferAttribute(displacements, 1))

  return {
    geometry: plane,
    pointPos,
    basePointPos,
    cols,
    rows,
    vertCount
  }
}

/** 将网格点位移 / 频谱写入 PlaneGeometry 属性 */
export function syncVizzPlaneGrid(grid, pointPos, frequencies, dispAxis = 2) {
  const { geometry, vertCount } = grid
  const pos = geometry.attributes.position.array
  const freq = geometry.attributes.frequency.array
  const disp = geometry.attributes.displacement.array
  const axis = dispAxis | 0

  for (let i = 0; i < vertCount; i++) {
    const i3 = i * 3
    pos[i3] = pointPos[i3]
    pos[i3 + 1] = pointPos[i3 + 1]
    pos[i3 + 2] = pointPos[i3 + 2]
    freq[i] = frequencies[i]
    disp[i] = Math.abs(pointPos[i3 + axis] - grid.basePointPos[i3 + axis])
  }

  geometry.attributes.position.needsUpdate = true
  geometry.attributes.frequency.needsUpdate = true
  geometry.attributes.displacement.needsUpdate = true
}
