import { buildStageTheme } from '../../stageColorTheme.js'
import { computeRoomSize, buildGradientRoomShell } from '../../StageRoomBox.js'

/**
 * 霓虹盒房间（墙 / 地柱 / 纹理球共用）。
 * 返回 roomW/H/D、关键 Z 平面与 matrixZ，供矩阵贴墙、相机 fitOpening 使用。
 *
 * @param {THREE.Group} group 通常 layerBack
 * @param {object} view computeViewMetrics 结果
 * @param {object} profile getStageLayoutProfile
 */
export function buildNeonRoom(group, view, profile, config = {}) {
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
    floorZ: -roomD * (profile.barZRatio ?? 0.56),
    ceilingY: roomH,
    ceilingZ: -roomD / 2,
    matrixZ: backZ + 0.04,
    roomBg: theme.wall
  }
}
